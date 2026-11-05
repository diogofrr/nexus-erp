import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../../core/clock/clock.service';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { CaregiverContextService } from '../state/caregiver-context.service';
import { ContactDialogService } from '../state/contact-dialog.service';
import {
  ContactChannel,
  PROTOTYPE_CALL_NOTICE,
  contactChannels,
} from '../state/nexus-contact';
import { CgEmergencyNoteComponent } from './cg-emergency-note.component';
import { CgNoteComponent } from './cg-note.component';
import { CgSheetComponent } from './cg-sheet.component';

/**
 * Diálogo "Como falar com a gente" (UX A.2.16, decisão 6 do contexto): o caminho para a equipe por telefone,
 * WhatsApp, aplicativo ou e-mail, SEM ligar de verdade. O canal que a pessoa prefere vem primeiro, com a
 * etiqueta "Seu canal preferido". Cada linha diz quando respondemos (RN-CAN-02) e tem a ação: "Copiar número",
 * "Copiar e-mail" ou "Escrever mensagem" (leva a Falar com a Nexus). Nenhum `tel:` nem `wa.me`. Fechado fora do
 * horário comercial, o telefone avisa quando abre.
 *
 * O shell monta UMA instância; qualquer tela abre por `ContactDialogService.open()`.
 */
@Component({
  selector: 'app-cg-contact-dialog',
  imports: [RouterLink, IconComponent, CgSheetComponent, CgNoteComponent, CgEmergencyNoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-sheet
      heading="Como falar com a gente"
      [open]="service.isOpen()"
      (openChange)="onOpenChange($event)"
    >
      <p class="cg-contact__lead">Escolha o jeito mais fácil para você.</p>
      <ul class="cg-contact__list">
        @for (channel of channels(); track channel.channel) {
          <li class="cg-contact__item">
            <span class="cg-contact__icon"><svg [appIcon]="channel.icon" size="lg"></svg></span>
            <div class="cg-contact__text">
              <p class="cg-contact__name">
                {{ channel.label }}
                @if (channel.channel === ctx.preferredChannel()) {
                  <span class="cg-contact__tag">Seu canal preferido</span>
                }
              </p>
              <p class="cg-contact__answer">{{ channel.answer }}</p>
              @if (channel.closedNote; as closed) {
                <p class="cg-contact__closed">{{ closed }}</p>
              }
              @if (channel.value; as value) {
                <p class="cg-contact__value" [attr.data-role]="'value-' + channel.channel">{{ value }}</p>
              }
              @if (channel.action === 'write_message') {
                <a class="btn cg-contact__action" routerLink="/cuidador/mais/ajuda" (click)="service.close()">
                  {{ channel.actionLabel }}
                </a>
              } @else {
                <button type="button" class="btn cg-contact__action" (click)="copy(channel)">
                  <svg appIcon="copy" size="sm"></svg>{{ channel.actionLabel }}
                </button>
              }
            </div>
          </li>
        }
      </ul>
      <p class="cg-contact__status" role="status" aria-live="polite">{{ feedback() }}</p>
      <app-cg-note variant="soft" icon="info">{{ prototypeCall }}</app-cg-note>
      <app-cg-emergency-note />
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" (click)="service.close()">Fechar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class CgContactDialogComponent {
  protected readonly service = inject(ContactDialogService);
  protected readonly ctx = inject(CaregiverContextService);
  private readonly clock = inject(Clock);
  private readonly doc = inject(DOCUMENT);

  protected readonly prototypeCall = PROTOTYPE_CALL_NOTICE;
  /** Aviso depois de copiar (ou de não conseguir copiar). */
  protected readonly feedback = signal('');

  protected readonly channels = computed<ContactChannel[]>(() =>
    contactChannels(this.ctx.preferredChannel(), this.clock.now()),
  );

  protected onOpenChange(open: boolean): void {
    if (open) {
      this.service.open();
    } else {
      this.service.close();
      this.feedback.set('');
    }
  }

  /** Copia o número ou o e-mail. Se o navegador negar, a frase diz como copiar na mão. */
  protected async copy(channel: ContactChannel): Promise<void> {
    if (!channel.value) {
      return;
    }
    const noun = channel.action === 'copy_email' ? 'E-mail' : 'Número';
    try {
      const clipboard = this.doc.defaultView?.navigator.clipboard;
      if (!clipboard) {
        throw new Error('sem área de transferência');
      }
      await clipboard.writeText(channel.value);
      this.feedback.set(`${noun} copiado.`);
    } catch {
      this.feedback.set('Não consegui copiar sozinho. Segure sobre o número e escolha Copiar.');
    }
  }
}
