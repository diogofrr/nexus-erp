import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Clock } from '@core/clock';
import { formatDate } from '@core/format';
import { ReferralCategory } from '@core/models';
import { EMERGENCY_NOTICE, REFERRAL_TABLE, validateReferral } from '@core/rules/governance';
import { referralReminder } from '@core/rules/governance-access';
import { startWith } from 'rxjs';
import { BannerComponent, DialogService, DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import {
  BadgeComponent,
  CardComponent,
  CellDirective,
  DataTableComponent,
  FilterChipsComponent,
  FilterOption,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  NxMaskDirective,
  PageHeaderComponent,
  TableColumn,
  createListState,
} from '@shared/ui';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService, ReferralRow } from '../state/governance.service';

const STATUS_LABEL: Record<string, string> = {
  registered: 'Registrado',
  acknowledged: 'Retorno recebido',
  closed: 'Encerrado',
};

/**
 * SCR-M13-05 e 06 Encaminhamentos (`/app/governanca/encaminhamentos`). O Quadro 12 (as 7 situações, destinos e
 * observações) e o registro dos encaminhamentos feitos, por código. Registrar: categoria do Quadro 12, só os
 * destinos daquela categoria, data, retorno opcional e, no agravamento clínico, "família comunicada". Nunca há
 * campo de valor ou comissão (RN-ENC-10). O que cada perfil vê segue RN-ENC-11 e o escopo 1.3.
 */
@Component({
  selector: 'app-governance-referrals-page',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    BannerComponent,
    CardComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    FilterChipsComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Encaminhamentos"
        [count]="count()"
        description="Quando a demanda passa do que a Nexus faz, o encaminhamento faz parte do serviço. A escolha é sempre do cuidador."
      >
        @if (svc.canCreateReferral()) {
          <button type="button" class="btn btn--primary" data-role="new" (click)="openNew()">Novo encaminhamento</button>
        }
      </app-page-header>
      <app-governance-tabs />

      <app-banner variant="info" heading="Em emergência" data-role="emergency">{{ emergency }}</app-banner>

      <app-card title="Fluxo de encaminhamento à rede de apoio" subtitle="Quadro 12 do plano de negócios">
        <div class="table-wrap">
          <table class="table table--stack" data-density="comfortable" data-role="quadro-12">
            <caption class="sr-only">Situações, encaminhamentos e observações</caption>
            <thead>
              <tr>
                <th scope="col">Situação identificada</th>
                <th scope="col">Encaminhamento</th>
                <th scope="col">Observações</th>
              </tr>
            </thead>
            <tbody>
              @for (rule of table; track rule.category) {
                <tr>
                  <td data-label="Situação identificada" class="col-primary">{{ rule.situation }}</td>
                  <td data-label="Encaminhamento">{{ rule.destinations.join('; ') }}</td>
                  <td data-label="Observações">{{ rule.observation }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="t-caption">Nenhum psicólogo, sócio ou credenciado recebe ou paga valor por encaminhar.</p>
      </app-card>

      @if (restricted().length > 0) {
        <app-banner variant="info" heading="Restrito ao responsável técnico e ao psicólogo do caso" data-role="restricted">
          Por privacidade, a gestão vê só o total por categoria:
          @for (item of restricted(); track item.label; let last = $last) {
            {{ item.label }}: {{ item.count }}{{ last ? '.' : ';' }}
          }
        </app-banner>
      }

      <section class="stack stack--3" aria-labelledby="ref-register">
        <h2 id="ref-register" class="t-strong">Encaminhamentos registrados</h2>
        <app-data-table
          caption="Encaminhamentos registrados"
          noun="encaminhamentos"
          [rows]="rows()"
          [columns]="columns"
          [rowKey]="rowKey"
          [filtersActive]="list.hasActive()"
          emptyTitle="Nenhum encaminhamento por aqui"
          emptyText="Quando um encaminhamento for registrado, ele aparece nesta lista com o código do cuidador."
          (filtersCleared)="list.clear()"
        >
          <app-filter-chips
            appTableFilters
            label="Estado"
            [options]="statusOptions()"
            [value]="status()"
            (valueChange)="list.setFilter('estado', $event)"
          />
          <ng-template appCell="code" let-row>
            <span class="code-chip"><svg appIcon="shield-check"></svg>{{ row.code }}</span>
          </ng-template>
          <ng-template appCell="status" let-row>
            <app-badge
              [variant]="row.referral.status === 'closed' ? 'success' : row.referral.status === 'acknowledged' ? 'info' : 'attention'"
              dot
              >{{ statusLabel(row.referral.status) }}</app-badge
            >
          </ng-template>
          <ng-template appCell="actions" let-row let-selecting="selecting">
            @if (svc.canCreateReferral()) {
              @if (row.referral.status === 'registered') {
                <button type="button" class="btn btn--sm" data-role="return" [disabled]="selecting" (click)="openReturn(row)">
                  Registrar retorno
                </button>
              } @else if (row.referral.status === 'acknowledged') {
                <button type="button" class="btn btn--sm" data-role="close-referral" [disabled]="selecting" (click)="close(row)">
                  Encerrar
                </button>
              }
            }
          </ng-template>
        </app-data-table>
      </section>

      @if (svc.canCreateReferral()) {
      <app-drawer [(open)]="newOpen" heading="Novo encaminhamento" subtitle="Escolha a situação do Quadro 12">
        <form id="referral-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
          <app-form-field
            label="Código do cuidador"
            hint="A gestão e o responsável técnico trabalham com o código, no formato CUI-0000."
            controlId="ref-code"
            [error]="err('code')"
          >
            <input appInput formControlName="code" autocomplete="off" placeholder="CUI-0000" />
          </app-form-field>
          <app-form-field label="Situação identificada" controlId="ref-category" [error]="err('category')">
            <select appInput formControlName="category">
              @for (rule of table; track rule.category) {
                <option [value]="rule.category">{{ rule.situation }}</option>
              }
            </select>
          </app-form-field>
          @if (reminder(); as text) {
            <app-banner variant="attention" data-role="reminder">{{ text }}</app-banner>
          }
          <app-form-field label="Destinos" group controlId="ref-destinations" [error]="err('destinations')">
            <div role="group" aria-label="Destinos desta situação" data-role="destinations">
              @for (d of destinations(); track d) {
                <label class="check">
                  <input type="checkbox" [checked]="selected().includes(d)" (change)="toggle(d)" />
                  <span>{{ d }}</span>
                </label>
              }
            </div>
          </app-form-field>
          @if (needsFamily()) {
            <app-form-field label="Família comunicada" group controlId="ref-family" [error]="err('family')">
              <label class="check">
                <input type="checkbox" formControlName="family" />
                <span>A família foi comunicada, como pede o agravamento clínico</span>
              </label>
            </app-form-field>
          }
          <app-form-field label="Data do encaminhamento" controlId="ref-date" [error]="err('date')">
            <input appInput appMask="date" formControlName="date" />
          </app-form-field>
          <app-form-field label="Retorno do destino" optional hint="Se o destino já respondeu, escreva aqui." controlId="ref-outcome">
            <textarea appInput formControlName="outcome" rows="3"></textarea>
          </app-form-field>
          @if (prefs.fillWithExample()) {
            <div>
              <button type="button" class="btn btn--ghost btn--sm" data-role="fill-example" (click)="fillExample()">Preencher com exemplo</button>
            </div>
          }
          <p class="t-caption">
            Quem registra: você. Este registro não tem campo de valor ou comissão, porque ninguém
            recebe nem paga por encaminhar.
          </p>
        </form>
        <ng-container drawerFooter>
          <button type="button" class="btn" (click)="newOpen.set(false)">Cancelar</button>
          <button type="submit" form="referral-form" class="btn btn--primary" data-role="submit">Registrar encaminhamento</button>
        </ng-container>
      </app-drawer>

      <app-drawer [(open)]="returnOpen" heading="Registrar retorno do destino" [subtitle]="returnSubtitle()">
        <form id="return-form" class="stack stack--3" novalidate [formGroup]="returnForm" (ngSubmit)="submitReturn()">
          <app-form-field label="O que o destino respondeu" controlId="ret-outcome" [error]="returnError()">
            <textarea appInput formControlName="outcome" rows="4"></textarea>
          </app-form-field>
        </form>
        <ng-container drawerFooter>
          <button type="button" class="btn" (click)="returnOpen.set(false)">Cancelar</button>
          <button type="submit" form="return-form" class="btn btn--primary" data-role="submit-return">Registrar retorno</button>
        </ng-container>
      </app-drawer>
      }
    </div>
  `,
})
export class ReferralsPageComponent {
  protected readonly svc = inject(GovernanceService);
  protected readonly prefs = inject(UiPrefsService);
  private readonly clock = inject(Clock);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly table = REFERRAL_TABLE;
  protected readonly emergency = EMERGENCY_NOTICE;

  protected readonly list = createListState({ key: 'governance-referrals', filterKeys: ['estado'] });
  protected readonly status = computed(() => this.list.filters()['estado'] ?? null);

  protected readonly rows = computed(() => {
    const filter = this.status();
    return this.svc.referrals().rows.filter((r) => !filter || r.referral.status === filter);
  });
  protected readonly count = computed(() => {
    const n = this.rows().length;
    return `${n} ${n === 1 ? 'encaminhamento' : 'encaminhamentos'}`;
  });
  protected readonly statusOptions = computed<FilterOption[]>(() =>
    ['registered', 'acknowledged', 'closed'].map((value) => ({
      value,
      label: STATUS_LABEL[value] as string,
      count: this.svc.referrals().rows.filter((r) => r.referral.status === value).length,
    })),
  );
  protected readonly restricted = computed(() =>
    [...this.svc.referrals().restrictedCounts.entries()].map(([category, count]) => ({
      label: REFERRAL_TABLE.find((r) => r.category === category)?.situation ?? category,
      count,
    })),
  );

  protected readonly columns: TableColumn<ReferralRow>[] = [
    { key: 'date', header: 'Data', primary: true, value: (r) => formatDate(r.referral.at), sortable: true, sortValue: (r) => r.referral.at },
    { key: 'code', header: 'Cuidador', value: (r) => r.code, sortable: true },
    {
      key: 'situation',
      header: 'Situação',
      value: (r) => REFERRAL_TABLE.find((x) => x.category === r.referral.category)?.situation ?? '',
    },
    { key: 'destinations', header: 'Destinos', value: (r) => r.referral.destinations.join('; ') },
    { key: 'by', header: 'Registrado por', value: (r) => r.byName },
    { key: 'status', header: 'Estado', value: (r) => STATUS_LABEL[r.referral.status] },
    { key: 'outcome', header: 'Retorno', value: (r) => r.referral.outcome ?? '' },
    { key: 'actions', header: 'Ações', actions: true, noSearch: true },
  ];
  protected readonly rowKey = (row: ReferralRow): string => row.referral.id;

  // ===== Novo encaminhamento =====

  protected readonly newOpen = signal(false);
  private readonly submitted = signal(false);
  protected readonly selected = signal<string[]>([]);
  protected readonly form = this.fb.group({
    code: this.fb.control(''),
    category: this.fb.control<ReferralCategory>('psychiatric_follow_up'),
    family: this.fb.control(false),
    date: this.fb.control<string | null>(null) as FormControl<string | null>,
    outcome: this.fb.control(''),
  });
  private readonly category = toSignal(
    this.form.controls.category.valueChanges.pipe(startWith(this.form.controls.category.value)),
    { initialValue: this.form.controls.category.value },
  );
  private readonly family = toSignal(
    this.form.controls.family.valueChanges.pipe(startWith(false)),
    { initialValue: false },
  );
  private readonly codeText = toSignal(this.form.controls.code.valueChanges.pipe(startWith('')), {
    initialValue: '',
  });
  private readonly dateValue = toSignal(
    this.form.controls.date.valueChanges.pipe(startWith(null as string | null)),
    { initialValue: null as string | null },
  );

  constructor() {
    // Trocar a situação troca os destinos possíveis: o que estava marcado deixa de valer.
    effect(() => {
      this.category();
      untracked(() => this.selected.set([]));
    });
  }

  protected readonly rule = computed(() => REFERRAL_TABLE.find((r) => r.category === this.category()));
  protected readonly destinations = computed(() => this.rule()?.destinations ?? []);
  protected readonly reminder = computed(() => referralReminder(this.category()));
  protected readonly needsFamily = computed(() => this.rule()?.requiresFamilyCommunicated === true);

  protected readonly errors = computed<Record<string, string>>(() => {
    if (!this.submitted()) {
      return {};
    }
    const found: Record<string, string> = {};
    const code = this.codeText();
    if (code.trim().length === 0) {
      found['code'] = 'Informe o código do cuidador, por exemplo CUI-0014.';
    } else if (!this.svc.caregiverByCode(code)) {
      found['code'] = 'Não encontramos esse código. Confira se ele tem o formato CUI-0000.';
    }
    const check = validateReferral(this.category(), this.selected(), this.needsFamily() ? this.family() : undefined);
    if (this.selected().length === 0) {
      found['destinations'] = 'Escolha ao menos um destino.';
    }
    if (this.needsFamily() && !this.family()) {
      found['family'] = 'No agravamento clínico, marque que a família foi comunicada.';
    }
    if (!check.valid && !found['destinations'] && !found['family']) {
      found['destinations'] = check.errors[0] ?? 'Revise os destinos.';
    }
    const date = this.dateValue();
    if (!date) {
      found['date'] = 'Informe a data do encaminhamento.';
    } else if (date > this.clock.today()) {
      found['date'] = 'A data do encaminhamento não pode ser no futuro.';
    }
    return found;
  });

  protected err(field: string): string | null {
    return this.errors()[field] ?? null;
  }

  protected fillExample(): void {
    this.form.patchValue({ code: 'CUI-0004', category: 'psychiatric_follow_up', date: this.clock.today(), outcome: '' });
    this.selected.set(['CAPS de referência']);
    this.submitted.set(false);
  }

  protected openNew(): void {
    this.form.reset({
      code: '',
      category: 'psychiatric_follow_up',
      family: false,
      date: this.clock.today(),
      outcome: '',
    });
    this.selected.set([]);
    this.submitted.set(false);
    this.newOpen.set(true);
  }

  protected toggle(destination: string): void {
    this.selected.update((list) =>
      list.includes(destination) ? list.filter((d) => d !== destination) : [...list, destination],
    );
  }

  protected submit(): void {
    this.submitted.set(true);
    if (Object.keys(this.errors()).length > 0) {
      return;
    }
    const v = this.form.getRawValue();
    const result = this.svc.createReferral({
      caregiverCode: v.code,
      category: v.category,
      destinations: this.selected(),
      date: v.date as string,
      ...(v.outcome.trim() ? { outcome: v.outcome } : {}),
      ...(this.needsFamily() ? { familyCommunicated: v.family } : {}),
    });
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível registrar.');
      return;
    }
    this.newOpen.set(false);
    this.toasts.success(
      `Encaminhamento registrado para ${v.code.trim().toUpperCase()}: ${this.selected().join(', ')}.`,
    );
  }

  // ===== Retorno e encerramento =====

  protected readonly returnOpen = signal(false);
  private returnTarget: ReferralRow | null = null;
  private readonly returnSubmitted = signal(false);
  protected readonly returnForm = this.fb.group({ outcome: this.fb.control('') });
  private readonly returnText = toSignal(this.returnForm.controls.outcome.valueChanges.pipe(startWith('')), {
    initialValue: '',
  });
  protected readonly returnSubtitle = signal('');
  protected readonly returnError = computed(() =>
    this.returnSubmitted() && this.returnText().trim().length < 5
      ? 'Escreva o retorno do destino, com ao menos 5 caracteres.'
      : null,
  );

  protected statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  protected openReturn(row: ReferralRow): void {
    this.returnTarget = row;
    this.returnForm.reset({ outcome: '' });
    this.returnSubmitted.set(false);
    this.returnSubtitle.set(`${row.code} · ${formatDate(row.referral.at)}`);
    this.returnOpen.set(true);
  }

  protected submitReturn(): void {
    this.returnSubmitted.set(true);
    if (this.returnError() || !this.returnTarget) {
      return;
    }
    const result = this.svc.registerReferralReturn(this.returnTarget.referral.id, this.returnForm.controls.outcome.value);
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível registrar.');
      return;
    }
    this.returnOpen.set(false);
    this.toasts.success('Retorno do destino registrado.');
  }

  protected async close(row: ReferralRow): Promise<void> {
    const { confirmed } = await this.dialogs.confirm({
      title: `Encerrar o encaminhamento de ${row.code}?`,
      message: 'O destino já respondeu e o cuidador seguiu o caminho combinado.',
      effects: { keep: ['o retorno do destino', 'a data e quem registrou'] },
      irreversibleNote: 'Um encaminhamento encerrado não volta a ser editado.',
      confirmLabel: 'Encerrar encaminhamento',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.closeReferral(row.referral.id);
    if (result.ok) {
      this.toasts.success(`Encaminhamento de ${row.code} encerrado.`);
    } else {
      this.toasts.attention(result.message ?? 'Não foi possível encerrar.');
    }
  }
}
