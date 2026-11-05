import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Clock } from '@core/clock';
import { formatDate } from '@core/format';
import { NormReference } from '@core/models';
import { DrawerComponent, ToastService } from '@shared/ui/overlay';
import {
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  FormFieldComponent,
  NxInputDirective,
  NxMaskDirective,
  PageHeaderComponent,
  TableColumn,
} from '@shared/ui';
import { startWith } from 'rxjs';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService } from '../state/governance.service';

/**
 * SCR-M13-11 Normas citadas (`/app/governanca/normas`). As seis normas do plano (Código de Ética de 2005, as
 * resoluções CFP 1/2009, 6/2019, 13/2022 e 9/2024 e a LGPD) com o campo "vigência confirmada em", vazio no
 * começo: a vigência precisa ser conferida no site do CFP (RN-ETICA-17). Gestão e RT registram a conferência.
 */
@Component({
  selector: 'app-governance-norms-page',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    FormFieldComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Normas citadas"
        [count]="count()"
        description="A vigência de cada norma deve ser conferida no site do órgão e a data da conferência fica registrada aqui."
      />
      <app-governance-tabs />

      <app-data-table
        caption="Normas citadas no plano de negócios"
        noun="normas"
        [rows]="rows()"
        [columns]="columns"
        [rowKey]="rowKey"
        emptyTitle="Nenhuma norma cadastrada"
        emptyText="Quando houver normas citadas, elas aparecem aqui."
      >
        <ng-template appCell="confirmed" let-row>
          @if (row.norm.confirmedInForceAt) {
            <app-badge variant="success" icon="circle-check">Confirmada em {{ date(row.norm.confirmedInForceAt) }}</app-badge>
          } @else {
            <app-badge variant="attention" icon="clock">Ainda não confirmada</app-badge>
          }
        </ng-template>
        <ng-template appCell="actions" let-row let-selecting="selecting">
          @if (svc.role() === 'partner' || svc.role() === 'technical_lead') {
            <button type="button" class="btn btn--sm" data-role="confirm" [disabled]="selecting" (click)="openRow(row)">
              {{ row.norm.confirmedInForceAt ? 'Atualizar a conferência' : 'Confirmar vigência' }}
            </button>
          }
        </ng-template>
      </app-data-table>

      @if (svc.role() === 'partner' || svc.role() === 'technical_lead') {
      <app-drawer [(open)]="drawerOpen" heading="Confirmar a vigência" [subtitle]="target()?.name ?? ''">
        <form id="norm-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
          <app-form-field
            label="Vigência confirmada em"
            hint="Data em que você conferiu a norma no site do órgão."
            controlId="norm-date"
            [error]="dateError()"
          >
            <input appInput appMask="date" formControlName="date" />
          </app-form-field>
        </form>
        <ng-container drawerFooter>
          @if (target()?.confirmedInForceAt) {
            <button type="button" class="btn btn--ghost" data-role="clear" (click)="clear()">Remover a confirmação</button>
          }
          <button type="button" class="btn" (click)="drawerOpen.set(false)">Cancelar</button>
          <button type="submit" form="norm-form" class="btn btn--primary" data-role="submit">Registrar conferência</button>
        </ng-container>
      </app-drawer>
      }
    </div>
  `,
})
export class NormsPageComponent {
  protected readonly svc = inject(GovernanceService);
  private readonly clock = inject(Clock);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly rows = computed(() => this.svc.norms().map((norm) => ({ id: norm.id, norm })));
  protected readonly count = computed(() => `${this.svc.norms().length} normas`);

  protected readonly columns: TableColumn<{ id: string; norm: NormReference }>[] = [
    { key: 'name', header: 'Norma', primary: true, value: (r) => r.norm.name },
    { key: 'subject', header: 'Assunto', value: (r) => r.norm.subject },
    { key: 'confirmed', header: 'Vigência confirmada em', value: (r) => r.norm.confirmedInForceAt ?? '', noSearch: true },
    { key: 'actions', header: 'Ações', actions: true, noSearch: true },
  ];
  protected readonly rowKey = (row: { id: string }): string => row.id;

  protected readonly drawerOpen = signal(false);
  protected readonly target = signal<NormReference | null>(null);
  private readonly submitted = signal(false);
  protected readonly form = this.fb.group({
    date: this.fb.control<string | null>(null) as FormControl<string | null>,
  });
  private readonly dateValue = toSignal(this.form.controls.date.valueChanges.pipe(startWith(null as string | null)), {
    initialValue: null as string | null,
  });
  protected readonly dateError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    const date = this.dateValue();
    if (!date) {
      return 'Informe a data em que a norma foi conferida.';
    }
    return date > this.clock.today() ? 'A data da conferência não pode ser no futuro.' : null;
  });

  protected date(value: string): string {
    return formatDate(value);
  }

  protected openRow(row: { norm: NormReference }): void {
    this.target.set(row.norm);
    this.form.reset({ date: row.norm.confirmedInForceAt ?? this.clock.today() });
    this.submitted.set(false);
    this.drawerOpen.set(true);
  }

  protected submit(): void {
    this.submitted.set(true);
    const norm = this.target();
    if (!norm || this.dateError()) {
      return;
    }
    const result = this.svc.confirmNorm(norm.id, this.form.controls.date.value);
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível registrar.');
      return;
    }
    this.drawerOpen.set(false);
    const undo = result.undo;
    this.toasts.success(
      'Vigência registrada.',
      undo ? { label: 'Desfazer', run: undo } : undefined,
    );
  }

  protected clear(): void {
    const norm = this.target();
    if (!norm) {
      return;
    }
    const result = this.svc.confirmNorm(norm.id, null);
    if (result.ok) {
      this.drawerOpen.set(false);
      const undo = result.undo;
      this.toasts.success('Confirmação removida.', undo ? { label: 'Desfazer', run: undo } : undefined);
    }
  }
}
