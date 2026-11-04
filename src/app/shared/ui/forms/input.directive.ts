import { Directive, ElementRef, computed, inject, input } from '@angular/core';
import { uniqueId } from '../util/ids';
import { NX_FIELD } from './field-context';

/**
 * Aplica o visual do design system (`.input`, `.select`, `.textarea`) conforme a tag e liga o controle ao
 * `app-form-field` (id, `aria-describedby`, `aria-invalid`, `aria-required`).
 *
 * ```html
 * <input appInput formControlName="name" />
 * <textarea appInput formControlName="note"></textarea>
 * <select appInput formControlName="plan"><option value="livre">Livre</option></select>
 * ```
 * Dentro de um `app-form-field` NÃO ponha `id` no controle: o campo decide o id.
 */
@Directive({
  selector: 'input[appInput], select[appInput], textarea[appInput]',
  exportAs: 'appInput',
  host: {
    '[class.input]': "tag === 'input'",
    '[class.select]': "tag === 'select'",
    '[class.textarea]': "tag === 'textarea'",
    '[attr.id]': 'resolvedId()',
    '[attr.aria-describedby]': 'field?.describedBy() ?? null',
    '[attr.aria-invalid]': 'field?.invalid() ? "true" : null',
    '[attr.aria-required]': 'field?.required() ? "true" : null',
  },
})
export class NxInputDirective {
  readonly field = inject(NX_FIELD, { optional: true });
  readonly tag = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName.toLowerCase();
  /** Id próprio, usado só fora de um `app-form-field`. */
  readonly id = input<string | undefined>(undefined);
  private readonly ownId = uniqueId('app-input');
  readonly resolvedId = computed(() => this.field?.controlId() ?? this.id() ?? this.ownId);
}
