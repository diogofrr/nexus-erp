import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatDateTime } from '@core/format';
import { ArbeAlert } from '@core/models';
import { arbeContactDeadline, isArbeContactLate } from '@core/rules';
import {
  BadgeComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  FilterOption,
  FormFieldComponent,
  NxInputDirective,
  PageHeaderComponent,
  createListState,
} from '@shared/ui';
import { DrawerComponent, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { ArbeService } from '../state/arbe.service';
import { ZaritAccessService } from '../state/zarit-access.service';
import { ARBE_LEVEL_VIEW, ARBE_STATUS_LABELS } from '../state/zarit-labels';

type DrawerMode = 'close' | 'discard';

const STATE_OPTIONS: FilterOption[] = [
  { value: 'abertos', label: 'Abertos' },
  { value: 'a-confirmar', label: 'A confirmar' },
  { value: 'encerrados', label: 'Encerrados e descartados' },
  { value: 'todos', label: 'Todos' },
];

/**
 * SCR-M06-07, ARBE (RN-ARBE-01 a 10): alertas de risco de esgotamento do cuidador, gerados por regra a partir
 * das horas diárias de cuidado, dos pedidos de apoio e da última pontuação da escala. Mostra os critérios
 * atendidos, e o psicólogo confirma, registra o contato, encerra ou descarta com motivo. O alerta é um sinal
 * para a escuta clínica, nunca uma conclusão. Os limites são lidos de Configurações (só o RT os edita).
 */
@Component({
  selector: 'app-arbe-page',
  imports: [
    BadgeComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    FormFieldComponent,
    NxInputDirective,
    PageHeaderComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Alertas de esgotamento (ARBE)"
        [count]="count()"
        description="Avaliação de risco de esgotamento: horas de cuidado, pedidos de apoio e pontuação da escala. É um sinal para a escuta, a decisão é do psicólogo."
      >
        @if (isSupervisor()) {
          <a class="btn" routerLink="/app/configuracoes/arbe" data-role="edit-limits">Editar os limites</a>
        }
        <a class="btn" routerLink="/app/acompanhamento/fila">Voltar à fila</a>
      </app-page-header>

      <section class="card card--pad stack stack--2" aria-labelledby="arbe-limits" data-role="limits">
        <h2 id="arbe-limits" class="card__title">Limites em vigor</h2>
        <ul class="t-ui stack stack--2">
          <li>Horas por dia de cuidado: {{ limits().hoursThreshold }} ou mais.</li>
          <li>Pedidos de apoio: {{ limits().supportRequestsThreshold }} ou mais em {{ limits().windowDays }} dias.</li>
          <li>Pontuação da escala: {{ limits().zaritThreshold }} ou mais.</li>
          <li>Alerta crítico: os 3 critérios, ou pontuação {{ limits().criticalZarit }} ou mais. Atenção: 2 dos 3 critérios.</li>
        </ul>
        <p class="t-caption">Só o responsável técnico muda os limites. Ao mudar, os alertas são recalculados.</p>
      </section>

      <app-filter-chips label="Situação" allLabel="" [options]="stateOptions" [value]="state()" (valueChange)="setState($event)" />

      @if (rows().length === 0) {
        <app-empty-state title="Nenhum alerta neste filtro" text="Quando os critérios forem atendidos, o alerta aparece aqui para você revisar." />
      }
      @for (row of rows(); track row.alert.id) {
        <article class="card card--pad stack stack--3" [attr.data-arbe]="row.alert.id" [attr.aria-labelledby]="'arbe-' + row.alert.id">
          <div class="cluster cluster--between">
            <h2 class="card__title" [id]="'arbe-' + row.alert.id">
              <span class="discreet">{{ row.name }}</span> <span class="code-chip">{{ row.code }}</span>
            </h2>
            <div class="cluster">
              <app-badge [variant]="levelView(row.alert.level).variant" [icon]="levelView(row.alert.level).icon" data-role="level">
                {{ levelView(row.alert.level).label }}
              </app-badge>
              <app-badge outline data-role="status">{{ statusLabel(row.alert.status) }}</app-badge>
              @if (row.late) {
                <app-badge variant="danger" icon="clock">Contato atrasado</app-badge>
              }
            </div>
          </div>
          <ul class="stack stack--2" role="list" aria-label="Critérios atendidos">
            @for (c of row.criteria; track c.label) {
              <li class="cluster">
                <app-badge [variant]="c.met ? 'attention' : 'neutral'" [outline]="!c.met" [icon]="c.met ? 'check' : 'minus'">{{ c.met ? 'Atende' : 'Não atende' }}</app-badge>
                <span>{{ c.label }}</span>
              </li>
            }
          </ul>
          <p class="t-caption">
            Gerado em {{ dateTime(row.alert.generatedAt) }}. Contato de referência até {{ date(row.deadline) }}.
            @if (row.alert.discardReason) {
              Motivo do descarte: {{ row.alert.discardReason }}
            }
            @if (row.alert.closureReason) {
              Encerramento: {{ row.alert.closureReason }}
            }
          </p>
          @if (row.canAct) {
            <div class="cluster">
              @if (row.alert.status === 'generated') {
                <button type="button" class="btn btn--primary" (click)="confirm(row.alert)" data-role="confirm">Confirmar alerta</button>
              }
              @if (row.alert.status === 'confirmed') {
                <button type="button" class="btn btn--primary" (click)="contact(row.alert)" data-role="contact">Registrar contato</button>
              }
              @if (row.alert.status === 'contacted') {
                <button type="button" class="btn btn--primary" (click)="openDrawer('close', row.alert)" data-role="close">Encerrar alerta</button>
              }
              @if (row.alert.status === 'generated' || row.alert.status === 'confirmed') {
                <button type="button" class="btn" (click)="openDrawer('discard', row.alert)" data-role="discard">Descartar com motivo</button>
              }
              <a class="btn btn--sm" [routerLink]="['/app/acompanhamento/cuidador', row.alert.caregiverId]">Ver histórico</a>
            </div>
          }
        </article>
      }
    </div>

    <app-drawer [(open)]="drawerOpen" [heading]="mode() === 'close' ? 'Encerrar o alerta' : 'Descartar o alerta'" subtitle="O registro fica no histórico do cuidador.">
      <div class="stack stack--6" data-role="arbe-drawer">
        <app-form-field
          [label]="mode() === 'close' ? 'Como o caso ficou' : 'Motivo do descarte'"
          controlId="arbe-note"
          [error]="drawerError()"
        >
          <textarea appInput rows="3" [value]="text()" (input)="text.set(valueOf($event))" data-role="arbe-text"></textarea>
        </app-form-field>
      </div>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="drawerOpen.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" (click)="submitDrawer()" data-role="arbe-submit">
          {{ mode() === 'close' ? 'Encerrar alerta' : 'Descartar alerta' }}
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class ArbePageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly access = inject(ZaritAccessService);
  private readonly arbe = inject(ArbeService);
  private readonly audit = inject(AuditLogService);
  private readonly toasts = inject(ToastService);

  protected readonly valueOf = valueOf;
  protected readonly stateOptions = STATE_OPTIONS;
  protected readonly list = createListState({ key: 'arbe', filterKeys: ['estado', 'filtro'] });
  protected readonly isSupervisor = computed(() => this.auth.role() === 'technical_lead');
  protected readonly limits = computed(() => this.db.settings.value().arbe);
  protected readonly state = computed(() => {
    const filters = this.list.filters();
    return filters['estado'] ?? (filters['filtro'] === 'alertas-a-confirmar' ? 'a-confirmar' : 'abertos');
  });

  protected readonly drawerOpen = signal(false);
  protected readonly mode = signal<DrawerMode>('close');
  protected readonly text = signal('');
  protected readonly drawerError = signal<string | null>(null);
  private target: ArbeAlert | null = null;

  protected readonly rows = computed(() => {
    const visible = new Map(this.access.visibleCaregivers().map((c) => [c.id, c] as const));
    const state = this.state();
    const now = this.clock.now();
    const settings = this.limits();
    return this.db.arbeAlerts
      .all()
      .filter((a) => {
        if (!visible.has(a.caregiverId)) {
          return false;
        }
        switch (state) {
          case 'abertos':
            return a.status === 'generated' || a.status === 'confirmed' || a.status === 'contacted';
          case 'a-confirmar':
            return a.status === 'generated';
          case 'encerrados':
            return a.status === 'closed' || a.status === 'discarded';
          default:
            return true;
        }
      })
      .sort((a, b) => (a.level === b.level ? b.generatedAt.localeCompare(a.generatedAt) : a.level === 'critical' ? -1 : 1))
      .map((alert) => {
        const caregiver = visible.get(alert.caregiverId);
        const c = alert.criteria;
        return {
          alert,
          name: caregiver?.fullName ?? 'Cuidador',
          code: caregiver?.code ?? '',
          canAct: this.access.canAct(alert.caregiverId),
          late: isArbeContactLate(alert, now),
          deadline: arbeContactDeadline(alert.level, alert.generatedAt),
          criteria: [
            { met: c.hoursPerDay.met, label: `Horas por dia de cuidado: ${c.hoursPerDay.value} (limite: ${settings.hoursThreshold} ou mais)` },
            { met: c.supportRequests.met, label: `Pedidos de apoio em ${settings.windowDays} dias: ${c.supportRequests.value} (limite: ${settings.supportRequestsThreshold} ou mais)` },
            { met: c.zarit.met, label: `Pontuação da escala: ${c.zarit.value ?? 'sem aplicação'} (limite: ${settings.zaritThreshold} ou mais)` },
          ],
        };
      });
  });
  protected readonly count = computed(() => `${this.rows().length} ${this.rows().length === 1 ? 'alerta' : 'alertas'}`);

  constructor() {
    // Limites novos (ou a primeira abertura) recalculam os alertas (AC-M06-13).
    effect(() => {
      this.db.settings.value();
      untracked(() => {
        const created = this.arbe.recomputeAll();
        if (created > 0) {
          this.audit.write('create', 'arbe_alert', undefined, undefined, `${created} alerta(s) gerado(s) no recálculo`);
        }
      });
    });
  }

  protected levelView(level: ArbeAlert['level']) {
    return ARBE_LEVEL_VIEW[level];
  }

  protected statusLabel(status: ArbeAlert['status']): string {
    return ARBE_STATUS_LABELS[status];
  }

  protected dateTime(value: string): string {
    return formatDateTime(value);
  }

  protected date(value: string): string {
    return formatDate(value);
  }

  protected setState(value: string | null): void {
    this.list.setFilter('filtro', null);
    this.list.setFilter('estado', value === 'abertos' ? null : value);
  }

  protected confirm(alert: ArbeAlert): void {
    const result = this.arbe.confirm(alert.id);
    this.toasts.show(
      result.ok
        ? { message: 'Alerta confirmado. Registre o contato com o cuidador.' }
        : { message: result.errors[0]?.message ?? 'Não foi possível confirmar.', tone: 'danger' },
    );
  }

  protected contact(alert: ArbeAlert): void {
    const result = this.arbe.registerContact(alert.id);
    this.toasts.show(
      result.ok
        ? { message: 'Contato registrado.' }
        : { message: result.errors[0]?.message ?? 'Não foi possível registrar.', tone: 'danger' },
    );
  }

  protected openDrawer(mode: DrawerMode, alert: ArbeAlert): void {
    this.mode.set(mode);
    this.target = alert;
    this.text.set('');
    this.drawerError.set(null);
    this.drawerOpen.set(true);
  }

  protected submitDrawer(): void {
    if (!this.target) {
      return;
    }
    const result =
      this.mode() === 'close' ? this.arbe.close(this.target.id, this.text()) : this.arbe.discard(this.target.id, this.text());
    if (!result.ok) {
      this.drawerError.set(result.errors[0]?.message ?? null);
      return;
    }
    this.drawerOpen.set(false);
    this.toasts.success(this.mode() === 'close' ? 'Alerta encerrado.' : 'Alerta descartado, com o motivo registrado.');
  }
}
