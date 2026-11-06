import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../../core/clock/clock.service';
import { Channel } from '../../../core/models';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { copyOrSelect } from '../../../shared/ui/util/clipboard';
import { CaregiverContextService } from '../state/caregiver-context.service';
import { ContactDialogService } from '../state/contact-dialog.service';
import { COPY_EMAIL_FAILED, COPY_NUMBER_FAILED, EMAIL_COPIED, NUMBER_COPIED } from '../state/copy-feedback';
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
 * Em tela de celular a folha é curta (CXC-016): só o canal preferido e o telefone ficam à vista; os outros ficam atrás de
 * "Mais jeitos". O e-mail não quebra no meio; o resultado de "Copiar" aparece junto do botão tocado, e a falha em cor de aviso.
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
      <ul class="cg-contact__list" data-role="main-channels">
        @for (channel of mainChannels(); track channel.channel) {
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
                <p
                  class="cg-contact__value"
                  [class.cg-contact__value--email]="channel.channel === 'email'"
                  [attr.data-role]="'value-' + channel.channel"
                >{{ value }}</p>
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
              @if (feedback(); as note) {
                @if (note.channel === channel.channel) {
                  <!-- A frase fica AO LADO do botão que a pessoa tocou; a falha em cor de aviso (CXC-016). -->
                  <p class="cg-contact__status" [class.cg-contact__status--warn]="!note.ok" role="status" aria-live="polite">{{ note.text }}</p>
                }
              }
            </div>
          </li>
        }
      </ul>
      @if (otherChannels().length > 0) {
        <div>
          <button
            type="button"
            class="cg-link-btn"
            data-role="more-ways"
            [attr.aria-expanded]="moreOpen()"
            aria-controls="cg-contact-more"
            (click)="moreOpen.set(!moreOpen())"
          >
            {{ moreOpen() ? 'Menos jeitos' : 'Mais jeitos' }}
          </button>
        </div>
        @if (moreOpen()) {
          <ul class="cg-contact__list" id="cg-contact-more" data-role="more-channels">
            @for (channel of otherChannels(); track channel.channel) {
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
                    <p
                      class="cg-contact__value"
                      [class.cg-contact__value--email]="channel.channel === 'email'"
                      [attr.data-role]="'value-' + channel.channel"
                    >{{ value }}</p>
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
                  @if (feedback(); as note) {
                    @if (note.channel === channel.channel) {
                      <!-- A frase fica AO LADO do botão que a pessoa tocou; a falha em cor de aviso (CXC-016). -->
                      <p class="cg-contact__status" [class.cg-contact__status--warn]="!note.ok" role="status" aria-live="polite">{{ note.text }}</p>
                    }
                  }
                </div>
              </li>
            }
          </ul>
        }
      }
      <app-cg-note variant="soft" icon="info">{{ prototypeCall }}</app-cg-note>
      <app-cg-emergency-note />
      <ng-container cgSheetActions>
        <button type="button" class="cg-link-btn" (click)="service.close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class CgContactDialogComponent {
  protected readonly service = inject(ContactDialogService);
  protected readonly ctx = inject(CaregiverContextService);
  private readonly clock = inject(Clock);
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly prototypeCall = PROTOTYPE_CALL_NOTICE;
  /** Aviso depois de copiar (ou de não conseguir copiar), com o canal em que a pessoa tocou. */
  protected readonly feedback = signal<{ channel: Channel; text: string; ok: boolean } | null>(null);
  /** "Mais jeitos" aberto? Começa fechado. */
  protected readonly moreOpen = signal(false);

  protected readonly channels = computed<ContactChannel[]>(() =>
    contactChannels(this.ctx.preferredChannel(), this.clock.now()),
  );
  /** À vista: o canal preferido (primeiro) e o telefone. */
  protected readonly mainChannels = computed(() =>
    this.channels().filter((c) => c.channel === this.ctx.preferredChannel() || c.channel === 'phone'),
  );
  protected readonly otherChannels = computed(() => {
    const main = new Set(this.mainChannels().map((c) => c.channel));
    return this.channels().filter((c) => !main.has(c.channel));
  });

  protected onOpenChange(open: boolean): void {
    if (open) {
      this.service.open();
    } else {
      this.service.close();
      this.feedback.set(null);
      this.moreOpen.set(false);
    }
  }

  /**
   * Copia o número ou o e-mail. Se o navegador negar, o número fica SELECIONADO e a frase diz como copiar na mão
   * (AC-CG-161, UX C19).
   */
  protected async copy(channel: ContactChannel): Promise<void> {
    if (!channel.value) {
      return;
    }
    const email = channel.action === 'copy_email';
    const element = this.host.nativeElement.querySelector(`[data-role="value-${channel.channel}"]`);
    const copied = await copyOrSelect(channel.value, element, this.doc);
    this.feedback.set({
      channel: channel.channel,
      ok: copied,
      text: copied ? (email ? EMAIL_COPIED : NUMBER_COPIED) : email ? COPY_EMAIL_FAILED : COPY_NUMBER_FAILED,
    });
  }
}
