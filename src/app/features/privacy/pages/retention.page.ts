import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { addDays, addMonths, addYears } from '@core/clock';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { RETENTION_BLOCK_NOTE, RetentionService } from '@core/privacy';
import { CardComponent, KpiComponent, KpiStripComponent, PageHeaderComponent, SegmentOption, SegmentedComponent } from '@shared/ui';
import { LgpdNavComponent } from '../components/lgpd-nav.component';

const HORIZONS: SegmentOption[] = [
  { value: 'today', label: 'Hoje' },
  { value: '30d', label: 'Daqui a 30 dias' },
  { value: '6m', label: 'Daqui a 6 meses' },
  { value: '1y', label: 'Daqui a 1 ano' },
  { value: '5y', label: 'Daqui a 5 anos' },
];

/**
 * SCR-M12-09 Retenção e eliminação (LP-19): a política de prazos e a simulação da passagem do tempo, que usa
 * o relógio do sistema (inclusive o simulado) como ponto de partida e mostra o que seria eliminado ou liberado
 * SEM mudar nada. Registro documental fica 5 anos (a confirmar); cadastro e contato, até 30 dias depois do
 * encerramento; log de acesso, 5 anos.
 */
@Component({
  selector: 'app-retention-page',
  imports: [CardComponent, KpiComponent, KpiStripComponent, LgpdNavComponent, PageHeaderComponent, SegmentedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Retenção e eliminação" description="Quanto tempo cada tipo de dado fica guardado e o que acontece depois." />
      <app-lgpd-nav />

      <app-card title="Política de prazos" [padded]="false">
        <div class="table-wrap table-wrap--flush">
          <table class="table table--stack">
            <caption class="sr-only">Política de retenção por classe de dado</caption>
            <thead><tr><th scope="col">Classe de dado</th><th scope="col">Prazo</th><th scope="col">Base</th><th scope="col">Observação</th></tr></thead>
            <tbody>
              @for (p of policies(); track p.id) {
                <tr>
                  <td data-label="Classe de dado" class="col-primary">{{ p.dataClass }}</td>
                  <td data-label="Prazo">{{ term(p.retentionYears, p.retentionDays) }}</td>
                  <td data-label="Base">{{ p.basis }}</td>
                  <td data-label="Observação">{{ p.note }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-card>

      <app-card title="Simular a passagem do tempo" subtitle="Só mostra o que aconteceria. Nada é apagado.">
        <div class="stack stack--6">
          <app-segmented label="Simular a passagem do tempo" [options]="horizons" [(value)]="horizon" />
          <p class="t-ui" role="status" data-role="simulation-date">Em {{ date(asOf()) }}:</p>
          <app-kpi-strip aria-label="Resultado da simulação">
            <app-kpi label="Cadastros a eliminar" [value]="simulation().cadastresToErase.length.toString()" context="encerrados há 30 dias ou mais" />
            <app-kpi label="Registros documentais liberados" [value]="released().toString()" context="fim do bloqueio por retenção" />
            <app-kpi label="Linhas de log a descartar" [value]="simulation().accessLogToDiscard.toString()" context="com mais de 5 anos" />
          </app-kpi-strip>
          @if (simulation().cadastresToErase.length > 0) {
            <p>Códigos dos cadastros: <span class="t-num">{{ codes() }}</span></p>
          }
          <p class="t-caption">{{ blockNote }}</p>
        </div>
      </app-card>
    </div>
  `,
})
export class RetentionPage {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly retention = inject(RetentionService);

  protected readonly horizons = HORIZONS;
  protected readonly horizon = signal<string | undefined>('today');
  protected readonly blockNote = RETENTION_BLOCK_NOTE;

  protected readonly policies = computed(() => this.db.retentionPolicies.all());
  protected readonly asOf = computed(() => {
    const today = this.clock.today();
    switch (this.horizon()) {
      case '30d':
        return addDays(today, 30);
      case '6m':
        return addMonths(today, 6);
      case '1y':
        return addYears(today, 1);
      case '5y':
        return addYears(today, 5);
      default:
        return today;
    }
  });
  protected readonly simulation = computed(() => {
    this.db.caregivers.all();
    this.db.zaritAssessments.all();
    return this.retention.simulate(this.asOf());
  });
  protected readonly released = computed(() => Object.values(this.simulation().documentaryBlocksExpired).reduce((a, b) => a + b, 0));
  protected readonly codes = computed(() =>
    this.simulation()
      .cadastresToErase.map((id) => this.db.caregivers.get(id)?.code ?? id)
      .join(', '),
  );

  protected date(value: string): string {
    return formatDate(value);
  }

  protected term(years: number | null, days: number | undefined): string {
    if (years !== null && years !== undefined) {
      return `${years} anos`;
    }
    return days ? `até ${days} dias depois do encerramento` : 'Conforme a finalidade';
  }
}
