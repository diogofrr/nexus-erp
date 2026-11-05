import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '../../../shared/ui/display/icon.component';

/** Estados calmos (UX A.1.4): cuidado, informação, aguardando, feito, passou do horário e problema. */
export type CgNoteVariant = 'care' | 'info' | 'soft' | 'ok' | 'late' | 'error';

const DEFAULT_ICON: Readonly<Record<CgNoteVariant, IconName>> = {
  care: 'hand-heart',
  info: 'info',
  soft: 'clock',
  ok: 'circle-check',
  late: 'clock',
  error: 'circle-alert',
};

/**
 * Aviso calmo (UX A.2.5): TODA mensagem de estado do aplicativo. Ícone mais texto, nunca só cor. `error` é o único
 * com `role="alert"` e é só para erro de formulário e falha do sistema: pontuação, contato da equipe, plano e
 * consentimento nunca são vermelhos. `late` (âmbar) é só para o que é da pessoa idosa (remédio, compromisso).
 *
 * ```html
 * <app-cg-note variant="care" heading="A equipe vai falar com você hoje">Por telefone.</app-cg-note>
 * <app-cg-note variant="soft" icon="lock">Pedido enviado.<button cgNoteActions class="cg-link-btn">Ver</button></app-cg-note>
 * ```
 */
@Component({
  selector: 'app-cg-note',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'cg-note cg-note--' + variant()",
    '[attr.role]': "variant() === 'error' ? 'alert' : 'status'",
  },
  template: `
    <svg class="cg-note__icon" [appIcon]="iconName()" size="lg"></svg>
    <div class="cg-note__body">
      @if (heading(); as text) {
        <p class="cg-note__title">{{ text }}</p>
      }
      <div class="cg-note__text"><ng-content /></div>
      <div class="cg-note__actions"><ng-content select="[cgNoteActions]" /></div>
    </div>
  `,
})
export class CgNoteComponent {
  readonly variant = input<CgNoteVariant>('info');
  readonly heading = input<string>();
  /** Troca o ícone padrão do estado (`clock`, `hourglass` ou `lock` no "aguardando"). */
  readonly icon = input<IconName>();

  protected readonly iconName = computed<IconName>(() => this.icon() ?? DEFAULT_ICON[this.variant()]);
}
