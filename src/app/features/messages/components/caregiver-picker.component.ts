import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import type { Caregiver } from '@core/models';
import { IconComponent, normalizeText, uniqueId } from '@shared/ui';

/**
 * Escolha de cuidador por busca (nome ou código). A gestão busca só por código (A-09, LP-08) e vê só o
 * código; o atendimento vê o nome (com `discreet`). Mostra no máximo 6 resultados por vez.
 */
@Component({
  selector: 'app-caregiver-picker',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'field' },
  template: `
    <span class="field__label" [id]="labelId">{{ label() }}</span>
    @if (hint()) {
      <span class="field__hint">{{ hint() }}</span>
    }
    @if (selected(); as chosen) {
      <div class="cluster cluster--between sunken p-3" data-role="picked">
        <span class="cluster">
          <svg appIcon="user-check" size="sm"></svg>
          <strong class="discreet">{{ display(chosen) }}</strong>
          @if (!codeOnly()) {
            <span class="t-muted t-caption">{{ chosen.code }}</span>
          }
        </span>
        <button type="button" class="btn btn--sm btn--ghost" (click)="clear()">Trocar</button>
      </div>
    } @else {
      <div class="input-wrap">
        <svg appIcon="search"></svg>
        <input
          class="input"
          type="search"
          autocomplete="off"
          data-role="picker-search"
          [id]="inputId"
          [attr.aria-labelledby]="labelId"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.placeholder]="codeOnly() ? 'Código, por exemplo CUI-0001' : 'Nome ou código'"
          [value]="term()"
          (input)="onTerm($event)"
        />
      </div>
      @if (term().trim().length >= 2) {
        @if (results().length === 0) {
          <p class="t-muted t-caption" role="status">
            @if (codeOnly()) {
              A gestão busca por código, por exemplo CUI-0001.
            } @else {
              Nenhum cuidador encontrado. Confira o nome ou o código.
            }
          </p>
        } @else {
          <ul class="list-card" role="listbox" [attr.aria-labelledby]="labelId">
            @for (c of results(); track c.id) {
              <li role="none">
                <button
                  type="button"
                  role="option"
                  class="list-row"
                  data-role="picker-option"
                  [attr.aria-selected]="false"
                  (click)="choose(c)"
                >
                  <span class="avatar avatar--sm" aria-hidden="true"><svg appIcon="user" size="sm"></svg></span>
                  <span class="list-row__main">
                    <span class="list-row__title discreet">{{ display(c) }}</span>
                    @if (!codeOnly()) {
                      <span class="list-row__meta">{{ c.code }}</span>
                    }
                  </span>
                  <span></span>
                </button>
              </li>
            }
          </ul>
        }
      }
    }
    @if (error()) {
      <span class="field__error">
        <svg appIcon="circle-alert" size="sm"></svg>
        <span><span class="sr-only">Erro: </span>{{ error() }}</span>
      </span>
    }
  `,
})
export class CaregiverPickerComponent {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);

  readonly label = input('Cuidador');
  readonly hint = input<string>();
  readonly error = input<string | null>(null);
  /** Id do cuidador escolhido (`null` = ninguém). */
  readonly value = model<string | null>(null);

  protected readonly term = signal('');
  protected readonly labelId = uniqueId('app-picker-label');
  protected readonly inputId = uniqueId('app-picker');
  protected readonly codeOnly = computed(() => this.auth.role() === 'partner');

  protected readonly selected = computed<Caregiver | undefined>(() => {
    const id = this.value();
    return id ? this.db.caregivers.get(id) : undefined;
  });

  protected readonly results = computed(() => {
    const text = normalizeText(this.term());
    if (text.length < 2) {
      return [];
    }
    const only = this.codeOnly();
    return this.db.caregivers
      .all()
      .filter((c) =>
        only ? normalizeText(c.code).includes(text) : normalizeText(`${c.fullName} ${c.code}`).includes(text),
      )
      .slice(0, 6);
  });

  protected display(c: Caregiver): string {
    return this.codeOnly() ? c.code : c.fullName;
  }

  protected onTerm(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
  }

  protected choose(c: Caregiver): void {
    this.value.set(c.id);
    this.term.set('');
  }

  protected clear(): void {
    this.value.set(null);
  }
}
