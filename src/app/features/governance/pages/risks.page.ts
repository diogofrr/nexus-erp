import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RiskRow } from '@core/rules/governance';
import { HeatMatrixComponent } from '@shared/ui/charts';
import {
  BadgeComponent,
  CardComponent,
  CellDirective,
  DataTableComponent,
  KpiComponent,
  KpiStripComponent,
  PageHeaderComponent,
  TableColumn,
} from '@shared/ui';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService } from '../state/governance.service';

/**
 * SCR-M13-03 Riscos (`/app/governanca/riscos`). A matriz 5 x 5 (probabilidade por impacto, a célula mostra o
 * número P x I) e o registro R1 a R12 com P, I, C calculado, categoria e tratamento, do mais crítico para o
 * menos. Prioritário: C 12 ou mais (RN-RISCO-02). A linha abre o risco, onde P e I se editam.
 */
@Component({
  selector: 'app-governance-risks-page',
  imports: [
    BadgeComponent,
    CardComponent,
    CellDirective,
    DataTableComponent,
    HeatMatrixComponent,
    KpiComponent,
    KpiStripComponent,
    PageHeaderComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Riscos"
        [count]="count()"
        description="Criticidade C = probabilidade x impacto, de 1 a 5. Prioritário quando C é 12 ou mais."
      />
      <app-governance-tabs />

      <app-kpi-strip>
        <app-kpi label="Riscos prioritários" [value]="svc.priorityCount()" [context]="'de ' + svc.risks().length + ' riscos'" />
        <app-kpi label="Maior criticidade" [value]="top()?.criticality ?? 0" [context]="top()?.risk?.code + ' · ' + top()?.risk?.title" />
        <app-kpi label="Não prioritários" [value]="svc.risks().length - svc.priorityCount()" context="C abaixo de 12" />
      </app-kpi-strip>

      <app-card title="Matriz de risco" subtitle="Probabilidade (linhas) por impacto (colunas)">
        <app-heat-matrix [risks]="heatRisks()" />
      </app-card>

      <section class="stack stack--3" aria-labelledby="risk-register">
        <h2 id="risk-register" class="t-strong">Registro de riscos</h2>
        <app-data-table
          caption="Registro de riscos, do mais crítico para o menos"
          noun="riscos"
          [rows]="svc.risks()"
          [columns]="columns"
          [rowKey]="rowKey"
          rowClickable
          (rowClick)="open($event)"
        >
          <ng-template appCell="code" let-row>
            <strong class="t-num">{{ row.risk.code }}</strong>
          </ng-template>
          <ng-template appCell="priority" let-row>
            @if (row.priority) {
              <app-badge variant="danger" icon="triangle-alert">Prioritário</app-badge>
            } @else {
              <app-badge variant="neutral" dot>Acompanhamento</app-badge>
            }
          </ng-template>
        </app-data-table>
      </section>
    </div>
  `,
})
export class RisksPageComponent {
  protected readonly svc = inject(GovernanceService);
  private readonly router = inject(Router);

  protected readonly top = computed<RiskRow | undefined>(() => this.svc.risks()[0]);
  protected readonly count = computed(() => `${this.svc.risks().length} riscos`);
  protected readonly heatRisks = computed(() =>
    this.svc.risks().map((r) => ({
      code: r.risk.code,
      probability: r.risk.probability,
      impact: r.risk.impact,
      title: r.risk.title,
    })),
  );

  protected readonly columns: TableColumn<RiskRow>[] = [
    { key: 'code', header: 'Risco', primary: true, value: (r) => r.risk.code, sortable: true, sortValue: (r) => Number(r.risk.code.slice(1)) },
    { key: 'title', header: 'Descrição', value: (r) => r.risk.title },
    { key: 'category', header: 'Categoria', value: (r) => r.risk.category, sortable: true },
    { key: 'p', header: 'P', align: 'end', value: (r) => r.risk.probability, sortable: true },
    { key: 'i', header: 'I', align: 'end', value: (r) => r.risk.impact, sortable: true },
    { key: 'c', header: 'C', align: 'end', value: (r) => r.criticality, sortable: true },
    { key: 'priority', header: 'Prioridade', value: (r) => (r.priority ? 'Prioritário' : 'Acompanhamento') },
    { key: 'treatment', header: 'Tratamento', value: (r) => r.risk.treatment },
  ];
  protected readonly rowKey = (row: RiskRow): string => row.risk.code;

  protected open(row: RiskRow): void {
    void this.router.navigate(['/app/governanca/riscos', row.risk.code]);
  }
}
