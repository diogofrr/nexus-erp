import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CgAccent, accentClass } from './cg-accent';

/** Raio do anel no desenho de 100 x 100. */
const RADIUS = 42;
/** Comprimento da circunferência: o que o traço precisa cobrir para o anel fechar. */
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type CgRingSize = 'sm' | 'md' | 'lg';

/**
 * Anel de progresso (SVG): "2 de 4 remédios dados" sem escrever. O anel enche em 700 ms ao aparecer (sem movimento com
 * "reduzir movimento") e vira verde quando fecha. No centro, o número em serifa e "de N" (ou o conteúdo projetado). Tem
 * nome acessível ("2 de 4 dados"): quem usa leitor de tela ouve a mesma coisa. Com `max` 0 não desenhe o anel.
 *
 * ```html
 * <app-cg-progress-ring [value]="progress().given" [max]="progress().total" label="dados" />
 * ```
 */
@Component({
  selector: 'app-cg-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    role: 'img',
    '[attr.aria-label]': 'accessibleName()',
    '[style.--cg-ring-circ]': 'circumference',
  },
  template: `
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle class="cg-ring__track" cx="50" cy="50" [attr.r]="radius" />
      <circle
        class="cg-ring__bar"
        cx="50"
        cy="50"
        [attr.r]="radius"
        [attr.stroke-dasharray]="circumference"
        [attr.stroke-dashoffset]="offset()"
        transform="rotate(-90 50 50)"
      />
    </svg>
    <span class="cg-ring__center" aria-hidden="true">
      <ng-content>
        <span class="cg-ring__value">{{ value() }}</span>
        <span class="cg-ring__of">de {{ max() }}</span>
      </ng-content>
    </span>
  `,
})
export class CgProgressRingComponent {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  /** O que se conta, para o nome acessível: "dados" fica "2 de 4 dados". */
  readonly label = input('');
  readonly size = input<CgRingSize>('lg');
  readonly accent = input<CgAccent | null>(null);

  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;
  protected readonly ratio = computed(() => {
    const max = this.max();
    return max > 0 ? Math.min(1, Math.max(0, this.value() / max)) : 0;
  });
  protected readonly offset = computed(() => CIRCUMFERENCE * (1 - this.ratio()));
  protected readonly done = computed(() => this.max() > 0 && this.value() >= this.max());
  protected readonly accessibleName = computed(() => `${this.value()} de ${this.max()}${this.label() ? ` ${this.label()}` : ''}`);
  protected readonly classes = computed(
    () => `cg-ring cg-ring--${this.size()}${this.done() ? ' is-done' : ''}${accentClass(this.accent())}`,
  );
}
