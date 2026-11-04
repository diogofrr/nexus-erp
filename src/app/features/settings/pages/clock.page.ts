import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Clock } from '../../../core/clock/clock.service';
import { isValidIsoDate } from '../../../core/clock/date-utils';
import { DateBrPipe } from '../../../core/format/pipes';
import { GlyphComponent } from '../../../shared/ui/overlay/glyph.component';
import { ToastService } from '../../../shared/ui/overlay/toast.service';

/** Mensagem de data inválida (catálogo de erros, 7.4). */
export const CLOCK_DATE_ERROR =
  'Informe a data de hoje no formato dd/mm/aaaa, por exemplo 12/11/2026.';

/** `12/11/2026` vira `2026-11-12`; devolve `null` se o texto não é uma data válida. */
export function parseBrDate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) {
    return null;
  }
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidIsoDate(iso) ? iso : null;
}

/**
 * Relógio simulado (SCR-M15-02, E-06, AC-M15-04): define a data de "hoje" (D0) para testar prazos, ciclos,
 * auditoria e SLA. "+1 dia", "+7 dias", "+1 mês" e "Voltar ao relógio real". Enquanto está ativo, o chip
 * "Hoje (simulado)" aparece na barra superior de toda tela. A sessão NÃO cai ao avançar a data: a
 * inatividade usa o tempo real.
 */
@Component({
  selector: 'app-settings-clock-page',
  imports: [GlyphComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Relógio simulado</h1>
            <p class="page-header__desc">
              Mude a data de hoje para ver como ficam os prazos, as aplicações da escala, a
              auditoria quinzenal e as solicitações do titular.
            </p>
          </div>
        </div>
      </header>

      <div class="stack stack--6">
        <section class="card card--pad stack stack--3" aria-labelledby="nx-clock-now">
          <h2 class="card__title" id="nx-clock-now">Hoje no protótipo</h2>
          @if (clock.isSimulated()) {
            <p class="cluster">
              <span class="badge badge--gold badge--lg"
                ><svg appGlyph="clock" glyphSize="sm"></svg>Simulado</span
              >
              <strong class="t-display t-num" data-role="today">{{
                clock.today() | dateBr
              }}</strong>
            </p>
            <p class="t-muted t-ui">A data real de hoje é {{ realToday() | dateBr }}.</p>
          } @else {
            <p class="cluster">
              <span class="badge badge--outline badge--lg"
                ><svg appGlyph="clock" glyphSize="sm"></svg>Relógio real</span
              >
              <strong class="t-display t-num" data-role="today">{{
                clock.today() | dateBr
              }}</strong>
            </p>
          }
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="nx-clock-set">
          <h2 class="card__title" id="nx-clock-set">Definir a data</h2>
          <form class="cluster" novalidate (submit)="apply($event)">
            <div class="field" [class.field--error]="!!error()">
              <label class="field__label" for="nx-clock-date">Data de hoje</label>
              <input
                class="input"
                id="nx-clock-date"
                type="text"
                inputmode="numeric"
                placeholder="dd/mm/aaaa"
                autocomplete="off"
                [attr.aria-invalid]="error() ? 'true' : null"
                [attr.aria-describedby]="error() ? 'nx-clock-error' : null"
                [value]="text()"
                (input)="onInput($event)"
              />
              @if (error()) {
                <span class="field__error" id="nx-clock-error">
                  <svg appGlyph="circle-alert"></svg>
                  <span><span class="sr-only">Erro: </span>{{ error() }}</span>
                </span>
              }
            </div>
            <button type="submit" class="btn btn--primary" data-role="apply">Definir data</button>
          </form>
          <div class="cluster">
            <button type="button" class="btn" data-role="plus-1d" (click)="advance(1, 'dia')">
              +1 dia
            </button>
            <button type="button" class="btn" data-role="plus-7d" (click)="advance(7, 'dias')">
              +7 dias
            </button>
            <button type="button" class="btn" data-role="plus-1m" (click)="advanceMonth()">
              +1 mês
            </button>
            <button
              type="button"
              class="btn btn--ghost"
              data-role="real"
              [disabled]="!clock.isSimulated()"
              (click)="backToReal()"
            >
              <svg appGlyph="undo-2"></svg>Voltar ao relógio real
            </button>
          </div>
          <p class="t-muted t-ui">
            A data simulada vale para todos os prazos do sistema. Avançar a data não encerra a sua
            sessão.
          </p>
        </section>
      </div>
    </div>
  `,
})
export class ClockPageComponent {
  protected readonly clock = inject(Clock);
  private readonly toasts = inject(ToastService);

  protected readonly text = signal('');
  protected readonly error = signal<string | null>(null);
  /** A data real de hoje (ignora a simulação). */
  protected readonly realToday = computed(() => this.clock.realNow().slice(0, 10));

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    if (this.error()) {
      this.error.set(null);
    }
  }

  protected apply(event: Event): void {
    event.preventDefault();
    const iso = parseBrDate(this.text());
    if (!iso) {
      this.error.set(CLOCK_DATE_ERROR);
      return;
    }
    this.clock.setSimulated(iso);
    this.text.set('');
    this.toasts.success(`Hoje (simulado) agora é ${this.format()}.`);
  }

  protected advance(days: number, unit: string): void {
    this.clock.advanceDays(days);
    this.toasts.success(`Avançou ${days} ${unit}. Hoje (simulado) agora é ${this.format()}.`);
  }

  protected advanceMonth(): void {
    this.clock.advanceMonths(1);
    this.toasts.success(`Avançou 1 mês. Hoje (simulado) agora é ${this.format()}.`);
  }

  protected backToReal(): void {
    this.clock.resetToReal();
    this.toasts.success('Voltou ao relógio real.');
  }

  private format(): string {
    return this.clock.today().split('-').reverse().join('/');
  }
}
