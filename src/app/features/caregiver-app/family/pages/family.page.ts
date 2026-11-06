import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { CONSENT_COPY } from '../../../../shared/ui/forms/consent-copy';
import { copyOrSelect } from '../../../../shared/ui/util/clipboard';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { COPY_TEXT_FAILED } from '../../state/copy-feedback';
import { firstNameOf } from '../../state/people-format';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgSwitchComponent } from '../../ui/cg-switch.component';
import { FamilyShareService } from '../state/family-share.service';
import { FamilyShareChoices, NO_FAMILY_CHOICES, anyChosen } from '../state/family-text';

const COPIED = 'Texto copiado. Cole na conversa da sua família.';

/**
 * Família (UX C20, `/cuidador/mais/familia`): um texto com a rotina da pessoa idosa, para copiar e colar na conversa
 * da família. Três chaves, todas desligadas ("Compromissos de hoje", "Compromissos desta semana", "Remédios de hoje
 * (nome e horário)"), a caixa com o texto (muda a cada chave) e **Copiar texto**. Não há envio por e-mail nem por
 * WhatsApp. Nada de conversa com psicólogo, grupo ou resultado da escala entra aqui. Sem a autorização de compartilhar
 * com a família (consentimento c), no lugar das chaves aparece o cartão de autorização com **Autorizo** e **Agora
 * não** de peso igual.
 */
@Component({
  selector: 'app-family-page',
  imports: [CgCardComponent, CgNoteComponent, CgPageHeaderComponent, CgSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .family-box {
      min-height: 5rem;
      padding: 1rem;
      border: 2px solid var(--cg-border-control);
      border-radius: var(--cg-radius-control);
      background: var(--cg-surface);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      user-select: all;
    }
    .family-box.is-empty {
      color: var(--cg-text-soft);
      user-select: none;
    }
    .family-reason,
    .family-status,
    .family-lead {
      margin: 0;
    }
    .family-reason {
      color: var(--cg-text-soft);
      font-weight: var(--fw-semibold);
    }
    .family-status {
      color: var(--cg-ok-fg);
      font-weight: var(--fw-semibold);
    }
    .family-actions {
      display: grid;
      gap: var(--cg-gap-stack);
    }
    .family-actions .btn {
      width: 100%;
    }
    @media (min-width: 48rem) {
      .family-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .family-actions .btn {
        width: auto;
        min-width: 12.5rem;
      }
    }
  `,
  template: `
    <app-cg-page-header title="Família" [description]="description()" backLink="/cuidador/mais" backLabel="Mais" />

    <div class="cg-stack cg-reading">
      @if (!service.authorized()) {
        <app-cg-card title="Para compartilhar, precisamos da sua autorização" variant="soft" icon="lock">
          <p class="family-lead"><strong>{{ copy.question }}</strong></p>
          <p class="family-lead">{{ copy.what }}</p>
          <p class="family-lead">{{ copy.who }}</p>
          <p class="family-lead">{{ copy.change }}</p>
          <div cgCardFooter class="family-actions">
            <button type="button" class="btn" (click)="authorize()">Autorizo</button>
            <button type="button" class="btn" (click)="declined.set(true)">Agora não</button>
          </div>
        </app-cg-card>
        @if (declined()) {
          <app-cg-note variant="soft" icon="info">Tudo bem. Nada foi compartilhado. Você pode autorizar quando quiser.</app-cg-note>
        }
      } @else {
        <section class="cg-stack cg-stack--tight" aria-labelledby="family-items-title">
          <h2 class="cg-section__title" id="family-items-title">O que incluir?</h2>
          <app-cg-switch
            label="Compromissos de hoje"
            onText="Vai no texto"
            offText="Não vai no texto"
            [checked]="choices().today"
            (checkedChange)="choose('today', $event)"
          />
          <app-cg-switch
            label="Compromissos desta semana"
            onText="Vai no texto"
            offText="Não vai no texto"
            [checked]="choices().week"
            (checkedChange)="choose('week', $event)"
          />
          <app-cg-switch
            label="Remédios de hoje (nome e horário)"
            onText="Vai no texto"
            offText="Não vai no texto"
            [checked]="choices().medications"
            (checkedChange)="choose('medications', $event)"
          />
        </section>

        <section class="cg-stack cg-stack--tight" aria-labelledby="family-text-title">
          <h2 class="cg-section__title" id="family-text-title">O texto</h2>
          <div
            #box
            class="family-box"
            [class.is-empty]="text() === null"
            role="region"
            aria-label="Texto para a sua família"
            tabindex="0"
          >{{ text() ?? 'Escolha o que você quer compartilhar.' }}</div>
          @if (!anySelected()) {
            <p class="family-reason" id="family-reason">Ligue pelo menos um item.</p>
          }
          <div class="family-actions">
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="!anySelected()"
              [attr.aria-describedby]="anySelected() ? null : 'family-reason'"
              (click)="copyText()"
            >Copiar texto</button>
          </div>
          @if (status(); as message) {
            <p class="family-status" role="status">{{ message }}</p>
          }
        </section>
      }

      <app-cg-note variant="soft" icon="lock">Nada de conversa com psicólogo, grupo ou resultado da escala entra aqui.</app-cg-note>
    </div>
  `,
})
export class FamilyPage {
  protected readonly service = inject(FamilyShareService);
  private readonly ctx = inject(CaregiverContextService);
  private readonly toasts = inject(ToastService);
  private readonly doc = inject(DOCUMENT);
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  protected readonly copy = CONSENT_COPY.family_sharing;
  protected readonly choices = signal<FamilyShareChoices>(NO_FAMILY_CHOICES);
  protected readonly declined = signal(false);
  protected readonly status = signal<string | null>(null);

  protected readonly description = computed(() => {
    const elder = this.ctx.elder();
    const first = elder ? firstNameOf(elder.fullName) : 'quem você cuida';
    return `Gere um texto com a rotina de ${first} para mandar à sua família. Você escolhe o que entra.`;
  });
  protected readonly anySelected = computed(() => anyChosen(this.choices()));
  /** O texto dos itens ligados (muda a cada chave); `null` com tudo desligado. */
  protected readonly text = computed(() => (this.service.authorized() ? this.service.text(this.choices()) : null));

  protected choose(item: keyof FamilyShareChoices, on: boolean): void {
    this.status.set(null);
    this.choices.update((current) => ({ ...current, [item]: on }));
  }

  protected authorize(): void {
    this.service.authorize();
    this.declined.set(false);
    this.toasts.show({ message: 'Autorização registrada. Escolha o que você quer compartilhar.', durationMs: 8000 });
  }

  /** Copia o texto. Se o navegador negar, a caixa fica selecionada e a frase diz como copiar na mão. */
  protected async copyText(): Promise<void> {
    const content = this.text();
    if (content === null) {
      return;
    }
    const element = this.box()?.nativeElement;
    if (await copyOrSelect(content, element, this.doc)) {
      this.status.set(null);
      this.toasts.show({ message: COPIED, durationMs: 8000 });
    } else {
      element?.focus();
      this.status.set(COPY_TEXT_FAILED);
    }
  }
}
