import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CgAccent, accentClass } from './cg-accent';
import { CgIllustrationComponent, CgIllustrationName } from './cg-illustration.component';

/**
 * Estado vazio acolhedor do aplicativo: uma ilustração, um título serifado curto, UMA frase e (opcional) uma ação.
 * Usa as mesmas classes (`empty__title`, `empty__text`) do `app-empty-state` do design system, então quem testa por
 * elas continua testando. Nunca uma tela em branco; nunca culpa a pessoa.
 *
 * ```html
 * <app-cg-empty illustration="medicine" title="Nenhum remédio ainda" text="Cadastre e o app lembra os horários.">
 *   <button class="btn btn--primary">Cadastrar um remédio</button>
 * </app-cg-empty>
 * ```
 */
@Component({
  selector: 'app-cg-empty',
  imports: [CgIllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()', role: 'status' },
  template: `
    <app-cg-illustration class="cg-empty__art" [name]="illustration()" size="lg" tone="accent" />
    @if (headingLevel() === 2) {
      <h2 class="empty__title">{{ title() }}</h2>
    } @else {
      <h3 class="empty__title">{{ title() }}</h3>
    }
    @if (text(); as sentence) {
      <p class="empty__text">{{ sentence }}</p>
    }
    <div class="empty__actions"><ng-content /></div>
  `,
})
export class CgEmptyComponent {
  readonly title = input.required<string>();
  readonly text = input<string>();
  readonly illustration = input<CgIllustrationName>('empty');
  readonly accent = input<CgAccent | null>(null);
  /** Nível do título: 3 (padrão) ou 2, quando o vazio é o primeiro bloco depois do `h1`. Aceita `headingLevel="2"` ou `[headingLevel]="2"`. */
  readonly headingLevel = input<2 | 3, number | string>(3, { transform: (value) => (Number(value) === 2 ? 2 : 3) });

  protected readonly classes = computed(() => `empty cg-empty${accentClass(this.accent())}`);
}
