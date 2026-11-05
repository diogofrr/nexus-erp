import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { formatDateTime } from '@core/format';
import { Occurrence } from '@core/models';
import {
  OCCURRENCE_KIND_LABELS,
  OCCURRENCE_STATUS_LABELS,
  occurrenceClosureStatus,
  occurrenceStepLabels,
} from '@core/rules/governance-access';
import { DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import {
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  KpiComponent,
  KpiStripComponent,
  NxInputDirective,
  PageHeaderComponent,
  TableColumn,
} from '@shared/ui';
import { startWith } from 'rxjs';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService } from '../state/governance.service';

interface OccurrenceRow {
  id: string;
  occurrence: Occurrence;
  code: string;
  done: number;
  total: number;
  note: string;
}

/**
 * SCR-M13-07 Ocorrências (`/app/governanca/ocorrencias`). POP-05 e POP-07 com restrição de acesso: o responsável
 * técnico vê todas; o psicólogo vê as dos seus casos; a gestão vê só as contagens e o atendimento não abre esta
 * tela (RN-ENC-11, escopo 1.3). O RT abre ocorrências novas; os passos têm hora e responsável.
 */
@Component({
  selector: 'app-governance-occurrences-page',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    KpiComponent,
    KpiStripComponent,
    NxInputDirective,
    PageHeaderComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Ocorrências"
        description="Situações de risco (POP-05) e suspeitas de violência contra a pessoa idosa (POP-07). Acesso restrito ao responsável técnico e ao psicólogo do caso."
      >
        @if (svc.canOpenOrClose()) {
          <button type="button" class="btn btn--primary" data-role="new" (click)="openNew()">Abrir ocorrência</button>
        }
      </app-page-header>
      <app-governance-tabs />

      @if (auth.role() === 'partner') {
        <app-kpi-strip data-role="counts-only">
          <app-kpi label="Situações de risco (POP-05)" [value]="svc.occurrenceCounts().pop05" context="total registrado" />
          <app-kpi label="Suspeitas de violência (POP-07)" [value]="svc.occurrenceCounts().pop07" context="total registrado" />
          <app-kpi label="Em aberto" [value]="svc.occurrenceCounts().open" context="sem os casos" />
        </app-kpi-strip>
        <app-empty-state
          kind="private"
          title="A gestão vê só as contagens"
          text="Os casos, os passos e os órgãos comunicados ficam com o responsável técnico e o psicólogo do caso, por privacidade."
        />
      } @else {
        <app-data-table
          caption="Ocorrências dos casos que você acompanha"
          noun="ocorrências"
          [rows]="rows()"
          [columns]="columns"
          [rowKey]="rowKey"
          rowClickable
          (rowClick)="open($event)"
          emptyTitle="Nenhuma ocorrência para você"
          emptyText="Quando houver uma situação de risco nos seus casos, ela aparece aqui com os passos e os prazos."
        >
          <ng-template appCell="kind" let-row>
            <strong>{{ kindLabel(row.occurrence.kind) }}</strong>
          </ng-template>
          <ng-template appCell="code" let-row>
            <span class="code-chip"><svg appIcon="shield-check"></svg>{{ row.code }}</span>
          </ng-template>
          <ng-template appCell="status" let-row>
            <app-badge [variant]="row.occurrence.status === 'closed' ? 'success' : 'attention'" dot>{{ statusLabel(row.occurrence.status) }}</app-badge>
          </ng-template>
        </app-data-table>
      }

      @if (svc.canOpenOrClose()) {
      <app-drawer [(open)]="newOpen" heading="Abrir ocorrência" subtitle="Os passos nascem pendentes">
        <form id="occ-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
          <app-form-field label="Tipo de ocorrência" controlId="occ-kind">
            <select appInput formControlName="kind">
              <option value="pop05_risk">POP-05 · Situação de risco</option>
              <option value="pop07_violence_suspicion">POP-07 · Suspeita de violência</option>
            </select>
          </app-form-field>
          <app-form-field label="Código do cuidador" hint="No formato CUI-0000." controlId="occ-code" [error]="codeError()">
            <input appInput formControlName="code" autocomplete="off" placeholder="CUI-0000" />
          </app-form-field>
          @if (prefs.fillWithExample()) {
            <div>
              <button type="button" class="btn btn--ghost btn--sm" data-role="fill-example" (click)="fillExample()">Preencher com exemplo</button>
            </div>
          }
          <p class="t-caption">
            O acesso fica restrito a você e ao psicólogo do caso. Cada passo é registrado com a hora e o
            responsável.
          </p>
        </form>
        <ng-container drawerFooter>
          <button type="button" class="btn" (click)="newOpen.set(false)">Cancelar</button>
          <button type="submit" form="occ-form" class="btn btn--primary" data-role="submit">Abrir ocorrência</button>
        </ng-container>
      </app-drawer>
      }
    </div>
  `,
})
export class OccurrencesPageComponent {
  protected readonly svc = inject(GovernanceService);
  protected readonly prefs = inject(UiPrefsService);
  protected readonly auth = inject(AuthService);
  private readonly db = inject(Database);
  private readonly audit = inject(AuditLogService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly rows = computed<OccurrenceRow[]>(() =>
    this.svc
      .occurrences()
      .map((o) => {
        const closure = occurrenceClosureStatus(o);
        const total = occurrenceStepLabels(o.kind).length;
        return {
          id: o.id,
          occurrence: o,
          code: this.db.caregivers.get(o.caregiverId)?.code ?? 'CUI-0000',
          done: total - closure.pendingSteps.length,
          total,
          note:
            o.status === 'closed'
              ? 'Encerrada'
              : closure.pendingSteps.length > 0
                ? `Passo ${closure.pendingSteps[0]} pendente`
                : closure.missingNotification
                  ? 'Notificação a órgão ainda não comunicada'
                  : 'Pronta para encerrar',
        };
      })
      .sort(
        (a, b) =>
          Number(a.occurrence.status === 'closed') - Number(b.occurrence.status === 'closed') ||
          b.occurrence.openedAt.localeCompare(a.occurrence.openedAt),
      ),
  );

  protected readonly columns: TableColumn<OccurrenceRow>[] = [
    { key: 'kind', header: 'Tipo', primary: true, value: (r) => OCCURRENCE_KIND_LABELS[r.occurrence.kind], sortable: true },
    { key: 'code', header: 'Cuidador', value: (r) => r.code, sortable: true },
    { key: 'opened', header: 'Aberta em', value: (r) => formatDateTime(r.occurrence.openedAt), sortable: true, sortValue: (r) => r.occurrence.openedAt },
    { key: 'status', header: 'Estado', value: (r) => OCCURRENCE_STATUS_LABELS[r.occurrence.status] },
    { key: 'steps', header: 'Passos', align: 'end', value: (r) => `${r.done} de ${r.total}` },
    { key: 'note', header: 'Pendência', value: (r) => r.note },
  ];
  protected readonly rowKey = (row: OccurrenceRow): string => row.id;

  constructor() {
    if (this.auth.can('occurrences', 'view')) {
      // A lista de ocorrências é dado sensível: abrir a tela fica no log (sem texto clínico).
      this.audit.view('occurrence_list', undefined, undefined, 'lista de ocorrências');
    }
  }

  protected kindLabel(kind: Occurrence['kind']): string {
    return OCCURRENCE_KIND_LABELS[kind];
  }

  protected statusLabel(status: Occurrence['status']): string {
    return OCCURRENCE_STATUS_LABELS[status];
  }

  protected open(row: OccurrenceRow): void {
    void this.router.navigate(['/app/governanca/ocorrencias', row.id]);
  }

  // ===== Abrir ocorrência =====

  protected readonly newOpen = signal(false);
  private readonly submitted = signal(false);
  protected readonly form = this.fb.group({
    kind: this.fb.control<Occurrence['kind']>('pop05_risk'),
    code: this.fb.control(''),
  });
  private readonly codeText = toSignal(this.form.controls.code.valueChanges.pipe(startWith('')), {
    initialValue: '',
  });
  protected readonly codeError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    const code = this.codeText();
    if (code.trim().length === 0) {
      return 'Informe o código do cuidador, por exemplo CUI-0001.';
    }
    return this.svc.caregiverByCode(code) ? null : 'Não encontramos esse código. Confira se ele tem o formato CUI-0000.';
  });

  protected fillExample(): void {
    this.form.patchValue({ kind: 'pop05_risk', code: 'CUI-0004' });
    this.submitted.set(false);
  }

  protected openNew(): void {
    this.form.reset({ kind: 'pop05_risk', code: '' });
    this.submitted.set(false);
    this.newOpen.set(true);
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.codeError()) {
      return;
    }
    const v = this.form.getRawValue();
    const result = this.svc.openOccurrence({ kind: v.kind, caregiverCode: v.code });
    if (!result.ok || !result.id) {
      this.toasts.attention(result.message ?? 'Não foi possível abrir a ocorrência.');
      return;
    }
    this.newOpen.set(false);
    this.toasts.success(`Ocorrência aberta para ${v.code.trim().toUpperCase()}. Registre o primeiro passo.`);
    void this.router.navigate(['/app/governanca/ocorrencias', result.id]);
  }
}
