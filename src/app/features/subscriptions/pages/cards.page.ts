import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { SubscriptionError, SubscriptionService } from '@core/commerce/subscription.service';
import { Database } from '@core/data';
import { formatDate, formatMoney } from '@core/format';
import type { ID, PlanId } from '@core/models';
import { caregiverLabel } from '@core/privacy/caregiver-label';
import { cardDiscountCents } from '@core/rules';
import {
  BadgeComponent,
  CardComponent,
  CellDirective,
  DataTableComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FilterChipsComponent,
  FormFieldComponent,
  KpiComponent,
  KpiStripComponent,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  PageHeaderComponent,
  PlanBadgeComponent,
  TableColumn,
  createListState,
} from '@shared/ui';
import { DrawerComponent, ToastService } from '@shared/ui/overlay';

interface CardRow {
  id: ID;
  caregiverId: ID;
  number: string;
  label: string;
  code: string;
  pseudonymized: boolean;
  planId: PlanId;
  active: boolean;
  issuedAt: string;
  uses: number;
  savedCents: number;
}

/**
 * SCR-M04-04 Cartões e SCR-M04-05 Registrar uso do cartão. O cartão existe só para quem tem assinatura paga
 * (o Livre não tem linha aqui). O uso grava o desconto do parceiro (R$ 100,00 a 10% resulta R$ 10,00) e só
 * parceiro ativo aparece na lista. A gestão e o atendimento registram; o responsável técnico só lê.
 */
@Component({
  selector: 'app-cards-page',
  imports: [
    BadgeComponent,
    CardComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    ErrorSummaryComponent,
    FilterChipsComponent,
    FormFieldComponent,
    KpiComponent,
    KpiStripComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    PlanBadgeComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Cartões Nexus" [count]="countText()" description="Só quem tem assinatura paga tem cartão.">
        @if (canRegister()) {
          <button type="button" class="btn btn--primary" (click)="openDrawer()">Registrar uso do cartão</button>
        }
        <a class="btn" routerLink="/app/assinaturas">Ver as assinaturas</a>
      </app-page-header>

      <app-kpi-strip aria-label="Resumo dos cartões">
        <app-kpi label="Cartões ativos" [value]="activeCount().toString()" context="com assinatura paga" />
        <app-kpi label="Usos registrados" [value]="usageCount().toString()" context="em parceiros ativos e antigos" />
        <app-kpi label="Economia gerada" [value]="money(totalSaved())" context="desconto somado dos usos" />
      </app-kpi-strip>

      <app-filter-chips label="Situação do cartão" [options]="statusOptions()" [value]="status()" (valueChange)="list.setFilter('status', $event)" allLabel="Todos" [allCount]="rows().length" />

      <app-data-table
        caption="Cartões Nexus"
        noun="cartões"
        [rows]="filtered()"
        [columns]="columns()"
        [filtersActive]="list.hasActive()"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [search]="list.search()"
        (searchChange)="list.search.set($event)"
        [page]="list.page()"
        (pageChange)="list.setPage($event)"
        searchable
        searchLabel="Buscar cartão"
        searchPlaceholder="Número do cartão ou código"
        emptyTitle="Nenhum cartão por aqui"
        emptyText="O cartão é emitido quando o cuidador assina um plano pago."
        (filtersCleared)="list.clear()"
      >
        <ng-template appCell="person" let-row>
          @if (row.pseudonymized) { <span class="code-chip">{{ row.code }}</span> } @else { <span class="col-primary discreet">{{ row.label }}</span> <span class="code-chip">{{ row.code }}</span> }
        </ng-template>
        <ng-template appCell="plan" let-row><app-plan-badge [plan]="row.planId" /></ng-template>
        <ng-template appCell="status" let-row>
          <app-badge [variant]="row.active ? 'success' : 'neutral'" [icon]="row.active ? 'circle-check' : 'ban'">{{ row.active ? 'Ativo' : 'Inativo' }}</app-badge>
        </ng-template>
        <ng-template appCell="actions" let-row>
          @if (canRegister() && row.active) {
            <button type="button" class="btn btn--sm" [attr.aria-label]="'Registrar uso do cartão ' + row.number" (click)="openDrawer(row.id)">Registrar uso</button>
          }
        </ng-template>
      </app-data-table>

      <app-card title="Uso por parceiro" subtitle="Quanto cada parceiro recebeu em compras com o cartão" [padded]="false">
        @if (byPartner().length === 0) {
          <p class="card__body t-muted">Nenhum uso registrado ainda.</p>
        } @else {
          <div class="table-wrap table-wrap--flush">
            <table class="table table--stack">
              <caption class="sr-only">Uso do cartão por parceiro</caption>
              <thead><tr><th scope="col">Parceiro</th><th scope="col" class="col-num">Usos</th><th scope="col" class="col-num">Compras</th><th scope="col" class="col-num">Desconto</th></tr></thead>
              <tbody>
                @for (p of byPartner(); track p.id) {
                  <tr>
                    <td data-label="Parceiro" class="col-primary">{{ p.name }}</td>
                    <td data-label="Usos" class="col-num">{{ p.uses }}</td>
                    <td data-label="Compras" class="col-num">{{ money(p.amount) }}</td>
                    <td data-label="Desconto" class="col-num">{{ money(p.saved) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </app-card>
    </div>

    <app-drawer [(open)]="drawerOpen" heading="Registrar uso do cartão" subtitle="O desconto vem do parceiro">
      <form id="nx-usage-form" class="stack stack--3" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-error-summary [items]="summary()" />
        <app-form-field label="Cartão" controlId="nx-usage-card" [forceErrors]="submitted()">
          <select appInput formControlName="cardId">
            <option [ngValue]="null">Escolha o cartão</option>
            @for (c of activeCards(); track c.id) {
              <option [ngValue]="c.id">{{ c.number }}, {{ c.pseudonymized ? c.code : c.label }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="Parceiro" hint="Só parceiros ativos aceitam o cartão." controlId="nx-usage-partner" [forceErrors]="submitted()">
          <select appInput formControlName="partnerId">
            <option [ngValue]="null">Escolha o parceiro</option>
            @for (p of partners(); track p.id) {
              <option [ngValue]="p.id">{{ p.name }}, {{ p.discountPercent }}% de desconto</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="Data da compra" controlId="nx-usage-date" [forceErrors]="submitted()">
          <input appInput appMask="date" formControlName="date" />
        </app-form-field>
        <app-form-field label="Valor da compra" controlId="nx-usage-amount" [forceErrors]="submitted()">
          <input appInput class="input--num" appMask="currency" formControlName="amount" />
        </app-form-field>
        @if (preview(); as p) {
          <p class="banner" role="status" data-role="discount">Desconto de {{ p.percent }}%: {{ money(p.discount) }}. O cuidador paga {{ money(p.pay) }}.</p>
        }
        @if (error()) {
          <p class="field__error" role="alert">{{ error() }}</p>
        }
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="drawerOpen.set(false)">Voltar</button>
        <button type="submit" form="nx-usage-form" class="btn btn--primary">Registrar uso</button>
      </ng-container>
    </app-drawer>
  `,
})
export class CardsPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly service = inject(SubscriptionService);
  private readonly toasts = inject(ToastService);

  protected readonly list = createListState({ key: 'cards', filterKeys: ['status'], defaultSort: { key: 'number', direction: 'asc' } });
  protected readonly drawerOpen = signal(false);
  protected readonly submitted = signal(false);
  protected readonly summary = signal<ErrorSummaryItem[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly canRegister = computed(() => this.auth.can('plans_subscriptions', 'update'));
  protected readonly partner = computed(() => this.auth.role() === 'partner');

  protected readonly form = new FormGroup({
    cardId: new FormControl<ID | null>(null, [NxValidators.required('o cartão')]),
    partnerId: new FormControl<ID | null>(null, [NxValidators.required('o parceiro')]),
    date: new FormControl<string | null>(this.clock.today(), [NxValidators.required('a data da compra')]),
    amount: new FormControl<number | null>(null, [NxValidators.required('o valor da compra')]),
  });
  private readonly formValue = signal(this.form.getRawValue());

  constructor() {
    this.service.applyDueChanges();
    this.form.valueChanges.subscribe(() => this.formValue.set(this.form.getRawValue()));
  }

  protected readonly rows = computed<CardRow[]>(() => {
    const role = this.auth.role();
    const caregivers = new Map(this.db.caregivers.all().map((c) => [c.id, c] as const));
    const usages = this.db.cardUsages.all();
    return this.db.benefitCards.all().flatMap((card): CardRow[] => {
      const cg = caregivers.get(card.caregiverId);
      if (!cg) {
        return [];
      }
      const own = usages.filter((u) => u.cardId === card.id);
      const label = caregiverLabel(role, cg);
      return [
        {
          id: card.id,
          caregiverId: cg.id,
          number: card.number,
          label: label.text,
          code: cg.code,
          pseudonymized: label.pseudonymized,
          planId: this.service.planOf(cg.id),
          active: card.status === 'active',
          issuedAt: card.issuedAt,
          uses: own.length,
          savedCents: own.reduce((sum, u) => sum + u.discountCents, 0),
        },
      ];
    });
  });

  protected readonly status = computed(() => this.list.filters()['status'] ?? null);
  protected readonly statusOptions = computed(() => [
    { value: 'ativo', label: 'Ativos', count: this.rows().filter((r) => r.active).length },
    { value: 'inativo', label: 'Inativos', count: this.rows().filter((r) => !r.active).length },
  ]);
  protected readonly filtered = computed(() => {
    const s = this.status();
    return this.rows().filter((r) => !s || (s === 'ativo') === r.active);
  });
  protected readonly countText = computed(() => `${this.filtered().length} cartões`);
  protected readonly activeCards = computed(() => this.rows().filter((r) => r.active));
  protected readonly activeCount = computed(() => this.activeCards().length);
  protected readonly usageCount = computed(() => this.db.cardUsages.size());
  protected readonly totalSaved = computed(() => this.db.cardUsages.all().reduce((sum, u) => sum + u.discountCents, 0));
  protected readonly partners = computed(() => {
    this.db.partners.all();
    return this.service.activePartners();
  });
  protected readonly byPartner = computed(() => {
    const usages = this.db.cardUsages.all();
    return this.db.partners
      .all()
      .map((p) => {
        const own = usages.filter((u) => u.partnerId === p.id);
        return { id: p.id, name: p.name, uses: own.length, amount: own.reduce((s, u) => s + u.amountCents, 0), saved: own.reduce((s, u) => s + u.discountCents, 0) };
      })
      .filter((p) => p.uses > 0)
      .sort((a, b) => b.saved - a.saved);
  });

  protected readonly preview = computed(() => {
    const v = this.formValue();
    const partner = v.partnerId ? this.db.partners.get(v.partnerId) : undefined;
    if (!partner || !v.amount || v.amount <= 0) {
      return null;
    }
    const discount = cardDiscountCents(v.amount, partner.discountPercent);
    return { percent: partner.discountPercent, discount, pay: v.amount - discount };
  });

  protected readonly columns = computed<TableColumn<CardRow>[]>(() => [
    { key: 'number', header: 'Cartão', primary: true, sortable: true, value: (r) => r.number },
    { key: 'person', header: this.partner() ? 'Código' : 'Cuidador', sortable: true, sortValue: (r) => (this.partner() ? r.code : r.label), searchText: (r) => `${r.pseudonymized ? '' : r.label} ${r.code}` },
    { key: 'plan', header: 'Plano', sortable: true, noSearch: true, sortValue: (r) => r.planId },
    { key: 'status', header: 'Situação', sortable: true, noSearch: true, sortValue: (r) => (r.active ? 0 : 1) },
    { key: 'issued', header: 'Emitido em', sortable: true, noSearch: true, value: (r) => formatDate(r.issuedAt), sortValue: (r) => r.issuedAt },
    { key: 'uses', header: 'Usos', align: 'end', sortable: true, noSearch: true, value: (r) => r.uses },
    { key: 'saved', header: 'Economia', align: 'end', sortable: true, noSearch: true, value: (r) => formatMoney(r.savedCents), sortValue: (r) => r.savedCents },
    { key: 'actions', header: 'Ações', actions: true },
  ]);

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected openDrawer(cardId?: ID): void {
    this.submitted.set(false);
    this.summary.set([]);
    this.error.set(null);
    this.form.reset({ cardId: cardId ?? null, partnerId: null, date: this.clock.today(), amount: null });
    this.drawerOpen.set(true);
  }

  protected save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const items: ErrorSummaryItem[] = [
      ['nx-usage-card', 'o cartão', this.form.controls.cardId],
      ['nx-usage-partner', 'o parceiro', this.form.controls.partnerId],
      ['nx-usage-date', 'a data da compra', this.form.controls.date],
      ['nx-usage-amount', 'o valor da compra', this.form.controls.amount],
    ].flatMap(([id, what, control]) =>
      (control as FormControl).invalid ? [{ controlId: id as string, message: `Informe ${what as string}.` }] : [],
    );
    this.summary.set(items);
    if (items.length > 0) {
      return;
    }
    const v = this.form.getRawValue();
    try {
      const usage = this.service.registerCardUsage({
        cardId: v.cardId as ID,
        partnerId: v.partnerId as ID,
        date: v.date as string,
        amountCents: v.amount as number,
      });
      this.toasts.success(`Uso registrado. Desconto de ${formatMoney(usage.discountCents)}.`);
      this.drawerOpen.set(false);
    } catch (e) {
      this.error.set(e instanceof SubscriptionError ? e.message : 'Não foi possível salvar. Tente de novo; se continuar, avise a equipe.');
    }
  }
}
