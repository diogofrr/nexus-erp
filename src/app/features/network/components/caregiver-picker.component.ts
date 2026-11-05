import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { Database } from '@core/data';
import { FormFieldComponent, IconComponent, NxInputDirective } from '@shared/ui';
import { NetworkAdminService } from '../state/network-admin.service';

const LIMIT = 6;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Escolha do cuidador que fez o pedido. A gestão busca só pelo código (`CUI-0042`); o atendimento busca pelo
 * código ou pelo nome (LP-08). Mostra no máximo 6 resultados, sem nunca listar CPF nem contato.
 */
@Component({
  selector: 'app-caregiver-picker',
  imports: [FormFieldComponent, NxInputDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-field [label]="label()" [hint]="hint()" [controlId]="controlId()" [error]="error()">
      <input
        appInput
        type="search"
        autocomplete="off"
        [value]="term()"
        [attr.placeholder]="placeholder()"
        (input)="onTerm($event)"
      />
    </app-form-field>
    @if (selectedText(); as chosen) {
      <p class="t-ui" data-role="picked">
        <svg appIcon="circle-check" size="sm"></svg>
        Cuidador escolhido: <strong class="discreet">{{ chosen }}</strong>
        <button type="button" class="btn btn--ghost btn--sm" (click)="clear()">Trocar</button>
      </p>
    } @else if (term().trim().length >= 2) {
      @if (matches().length === 0) {
        <p class="t-caption" data-role="no-match">{{ noMatch() }}</p>
      } @else {
        <ul class="list-card" [attr.aria-label]="'Resultados para ' + label()">
          @for (item of matches(); track item.id) {
            <li>
              <button type="button" class="list-row" data-role="pick" (click)="pick(item.id)">
                <span class="list-row__main">
                  <span class="list-row__title discreet">{{ item.text }}</span>
                </span>
              </button>
            </li>
          }
        </ul>
      }
    }
  `,
})
export class CaregiverPickerComponent {
  private readonly db = inject(Database);
  private readonly admin = inject(NetworkAdminService);

  readonly label = input('Cuidador');
  readonly hint = input('');
  readonly controlId = input('caregiver-picker');
  readonly error = input<string | null>(null);
  readonly value = model<string | null>(null);

  protected readonly term = signal('');

  protected readonly placeholder = computed(() =>
    this.admin.isManager() ? 'Código, por exemplo CUI-0001' : 'Nome ou código, por exemplo CUI-0001',
  );
  protected readonly noMatch = computed(() =>
    this.admin.isManager()
      ? 'A gestão busca por código, por exemplo CUI-0001.'
      : 'Nada encontrado. Confira o nome ou o código.',
  );

  protected readonly matches = computed(() => {
    const query = normalize(this.term());
    if (query.length < 2) {
      return [];
    }
    const byCodeOnly = this.admin.isManager();
    return this.db.caregivers
      .all()
      .filter((c) => normalize(c.code).includes(query) || (!byCodeOnly && normalize(c.fullName).includes(query)))
      .slice(0, LIMIT)
      .map((c) => ({ id: c.id, text: this.admin.caregiverLabel(c.id).text }));
  });

  protected readonly selectedText = computed(() => {
    const id = this.value();
    return id ? this.admin.caregiverLabel(id).text : null;
  });

  protected onTerm(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
  }

  protected pick(id: string): void {
    this.value.set(id);
  }

  protected clear(): void {
    this.value.set(null);
    this.term.set('');
  }
}
