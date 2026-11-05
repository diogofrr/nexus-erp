import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatDateTime } from '@core/format';
import { EMERGENCY_NOTICE } from '@core/rules/governance';
import {
  OCCURRENCE_KIND_LABELS,
  OCCURRENCE_STATUS_LABELS,
  occurrenceClosureStatus,
  occurrenceStepLabels,
} from '@core/rules/governance-access';
import { POP07_AUTHORITIES, POP07_REMINDER } from '@core/rules/pop05';
import { BannerComponent, DialogService, PageContextService, ToastService } from '@shared/ui/overlay';
import {
  BadgeComponent,
  CardComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  NxMaskDirective,
  PageHeaderComponent,
  TimelineComponent,
  TimelineItem,
} from '@shared/ui';
import { map, startWith } from 'rxjs';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService } from '../state/governance.service';

/**
 * SCR-M13-08 Ocorrência (`/app/governanca/ocorrencias/:id`). Os passos do POP com a hora e o responsável de cada
 * um, as notificações a órgãos (POP-07) e o encerramento. Só o RT e o psicólogo do caso abrem (RN-ENC-11); o
 * psicólogo conduz os passos, só o RT encerra (RN-POP-14). POP-05 não encerra sem os 7 passos (RN-POP-05); POP-07
 * lembra de proteger a pessoa idosa sem abandonar quem cuida e exige a comunicação aos órgãos (RN-POP-07).
 */
@Component({
  selector: 'app-governance-occurrence-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BadgeComponent,
    BannerComponent,
    CardComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    NxMaskDirective,
    PageHeaderComponent,
    TimelineComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .plain-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
  `,
  template: `
    <div class="page stack stack--6">
      @if (occurrence(); as o) {
        <app-page-header [title]="kindLabel()" [description]="'Cuidador ' + code() + ' · aberta em ' + opened()">
          <a class="btn" [routerLink]="['/app/cuidadores', o.caregiverId]" data-role="caregiver-link">Abrir o cuidador</a>
        </app-page-header>
        <app-governance-tabs />

        <div class="cluster" data-role="status">
          <span class="code-chip"><svg appIcon="shield-check"></svg>{{ code() }}</span>
          <app-badge [variant]="o.status === 'closed' ? 'success' : 'attention'" dot large>{{ statusLabel() }}</app-badge>
          <span class="t-ui t-muted">{{ doneCount() }} de {{ steps().length }} passos feitos</span>
        </div>

        <app-banner variant="info" heading="Acesso restrito" data-role="restricted">
          Só o responsável técnico e o psicólogo do caso abrem esta ocorrência.
        </app-banner>
        @if (isPop07()) {
          <app-banner variant="attention" heading="Lembrete do POP-07" data-role="reminder">{{ reminder }}</app-banner>
        } @else {
          <app-banner variant="info" heading="Em emergência" data-role="emergency">{{ emergency }}</app-banner>
        }

        <div class="layout-main-aside">
          <div class="stack stack--6">
            <app-card title="Passos" subtitle="Cada passo tem hora e responsável">
              <app-timeline label="Passos da ocorrência" [items]="timeline()" />
            </app-card>

            @if (canConduct() && pendingSteps().length > 0) {
              <app-card title="Registrar um passo" subtitle="A hora é a do sistema e o responsável é você">
                <form class="stack stack--3" novalidate [formGroup]="stepForm" (ngSubmit)="registerStep()" data-role="step-form">
                  <app-form-field label="Passo" controlId="occ-step">
                    <select appInput formControlName="step">
                      @for (s of pendingSteps(); track s.n) {
                        <option [value]="s.n">{{ s.n }}. {{ s.label }}</option>
                      }
                    </select>
                  </app-form-field>
                  <app-form-field label="Observação" optional hint="O que foi feito, sem dado desnecessário." controlId="occ-note">
                    <textarea appInput formControlName="note" rows="3"></textarea>
                  </app-form-field>
                  <div class="cluster cluster--end">
                    <button type="submit" class="btn btn--primary" data-role="register-step">Registrar passo</button>
                  </div>
                </form>
              </app-card>
            }

            @if (isPop07()) {
              <app-card title="Comunicação aos órgãos" subtitle="Notificação compulsória, conforme o POP-07">
                <div class="stack stack--3">
                  <ul class="list-card plain-list" data-role="authorities">
                    @for (a of authorities(); track $index) {
                      <li class="list-row">
                        <span><svg appIcon="landmark"></svg></span>
                        <span>
                          <span class="list-row__title">{{ a.body }}</span>
                          <span class="list-row__meta">
                            @if (a.at) {
                              Comunicado em {{ date(a.at) }}@if (a.protocol) {, protocolo {{ a.protocol }}}
                            } @else {
                              Ainda não comunicado
                            }
                          </span>
                        </span>
                        @if (a.at) {
                          <app-badge variant="success" icon="circle-check">Comunicado</app-badge>
                        } @else {
                          <app-badge variant="attention" icon="clock">Não comunicado</app-badge>
                        }
                      </li>
                    } @empty {
                      <li class="list-row"><span></span><span class="t-muted">Nenhum órgão registrado ainda.</span><span></span></li>
                    }
                  </ul>
                  @if (canConduct() && o.status !== 'closed') {
                    <form class="stack stack--3" novalidate [formGroup]="authorityForm" (ngSubmit)="registerAuthority()" data-role="authority-form">
                      <div class="form-grid">
                        <app-form-field label="Órgão" controlId="auth-body">
                          <select appInput formControlName="body">
                            @for (b of authorityOptions; track b) {
                              <option [value]="b">{{ b }}</option>
                            }
                          </select>
                        </app-form-field>
                        <app-form-field label="Data da comunicação" controlId="auth-date" [error]="authorityDateError()">
                          <input appInput appMask="date" formControlName="date" />
                        </app-form-field>
                        <app-form-field label="Protocolo" optional controlId="auth-protocol">
                          <input appInput formControlName="protocol" autocomplete="off" />
                        </app-form-field>
                      </div>
                      <div class="cluster cluster--end">
                        <button type="submit" class="btn" data-role="register-authority">Registrar comunicação</button>
                      </div>
                    </form>
                  }
                </div>
              </app-card>
            }
          </div>

          <aside class="stack stack--6" aria-label="Encerramento">
            <app-card title="Encerrar a ocorrência" variant="sunken">
              <div class="stack stack--3" data-role="closing">
                @if (o.status === 'closed') {
                  <p class="t-ui"><app-badge variant="success" icon="circle-check">Encerrada</app-badge></p>
                } @else {
                  @if (closure().ok) {
                    <p class="t-ui">Tudo registrado: a ocorrência está pronta para encerrar.</p>
                  } @else {
                    <p class="t-ui" data-role="missing">Para encerrar, falta:</p>
                    <ul class="stack stack--2 t-ui">
                      @if (closure().pendingSteps.length > 0) {
                        <li>{{ pendingText() }}</li>
                      }
                      @if (closure().missingNotification) {
                        <li>comunicar ao menos um órgão, com a data</li>
                      }
                    </ul>
                  }
                  @if (canClose()) {
                    <button type="button" class="btn btn--primary" data-role="close-occurrence" [disabled]="!closure().ok" (click)="close()">
                      Encerrar ocorrência
                    </button>
                  } @else {
                    <p class="t-caption" data-role="close-owner">
                      <svg appIcon="lock" size="sm"></svg> Só o responsável técnico encerra ocorrências.
                    </p>
                  }
                }
              </div>
            </app-card>
          </aside>
        </div>
      } @else {
        <app-page-header title="Ocorrência" />
        <app-empty-state
          kind="forbidden"
          title="Esta ocorrência não está disponível para o seu perfil"
          text="O acesso é restrito ao responsável técnico e ao psicólogo do caso."
        >
          <a class="btn" routerLink="/app/governanca/ocorrencias">Ver as ocorrências</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class OccurrencePageComponent {
  protected readonly svc = inject(GovernanceService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly pageContext = inject(PageContextService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly reminder = POP07_REMINDER;
  protected readonly emergency = EMERGENCY_NOTICE;
  protected readonly authorityOptions = POP07_AUTHORITIES;

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  protected readonly occurrence = computed(() => this.svc.occurrence(this.id()));
  protected readonly code = computed(() => {
    const o = this.occurrence();
    return o ? (this.db.caregivers.get(o.caregiverId)?.code ?? 'CUI-0000') : '';
  });
  protected readonly kindLabel = computed(() => {
    const o = this.occurrence();
    return o ? OCCURRENCE_KIND_LABELS[o.kind] : 'Ocorrência';
  });
  protected readonly statusLabel = computed(() => {
    const o = this.occurrence();
    return o ? OCCURRENCE_STATUS_LABELS[o.status] : '';
  });
  protected readonly opened = computed(() => {
    const o = this.occurrence();
    return o ? formatDateTime(o.openedAt) : '';
  });
  protected readonly isPop07 = computed(() => this.occurrence()?.kind === 'pop07_violence_suspicion');
  protected readonly steps = computed(() => this.occurrence()?.steps ?? []);
  protected readonly pendingSteps = computed(() => this.steps().filter((s) => !s.doneAt));
  protected readonly doneCount = computed(() => this.steps().filter((s) => s.doneAt).length);
  protected readonly authorities = computed(() => this.occurrence()?.authoritiesNotified ?? []);
  protected readonly closure = computed(() => {
    const o = this.occurrence();
    return o
      ? occurrenceClosureStatus(o)
      : { ok: false, pendingSteps: [] as number[], missingNotification: false };
  });
  protected readonly pendingText = computed(() => {
    const list = this.closure().pendingSteps;
    return list.length === 1 ? `o passo ${list[0]}` : `os passos ${list.join(', ')}`;
  });
  protected readonly canConduct = computed(() => {
    const o = this.occurrence();
    return !!o && o.status !== 'closed';
  });
  protected readonly canClose = this.svc.canOpenOrClose;

  protected readonly timeline = computed<TimelineItem[]>(() => {
    const labels = this.occurrence() ? occurrenceStepLabels(this.occurrence()!.kind) : [];
    return this.steps().map((s) => ({
      id: `step-${s.n}`,
      title: `${s.n}. ${s.label || labels[s.n - 1] || ''}`,
      text: s.note,
      timeLabel: s.doneAt
        ? `${formatDateTime(s.doneAt)} · por ${this.svc.userName(s.byUserId ?? '')}`
        : 'Pendente',
      tone: s.doneAt ? ('done' as const) : ('default' as const),
    }));
  });

  // ===== Formulários =====

  protected readonly stepForm = this.fb.group({
    step: this.fb.control(''),
    note: this.fb.control(''),
  });
  protected readonly authorityForm = this.fb.group({
    body: this.fb.control(POP07_AUTHORITIES[0] as string),
    date: this.fb.control<string | null>(null) as FormControl<string | null>,
    protocol: this.fb.control(''),
  });
  private readonly authoritySubmitted = signal(false);
  private readonly authorityDate = toSignal(
    this.authorityForm.controls.date.valueChanges.pipe(startWith(null as string | null)),
    { initialValue: null as string | null },
  );
  protected readonly authorityDateError = computed(() => {
    if (!this.authoritySubmitted()) {
      return null;
    }
    const date = this.authorityDate();
    if (!date) {
      return 'Informe a data da comunicação.';
    }
    return date > this.clock.today() ? 'A data da comunicação não pode ser no futuro.' : null;
  });

  constructor() {
    effect(() => {
      const o = this.occurrence();
      // Mantém o passo escolhido enquanto ele ainda está pendente; senão, vai ao próximo.
      const pending = this.pendingSteps();
      const current = Number(this.stepForm.controls.step.value);
      if (pending.length > 0 && !pending.some((s) => s.n === current)) {
        this.stepForm.controls.step.setValue(String(pending[0]?.n ?? ''));
      }
      this.pageContext.setCrumbs([
        { label: 'Governança', link: '/app/governanca' },
        { label: 'Ocorrências', link: '/app/governanca/ocorrencias' },
        { label: o ? this.code() : 'Ocorrência' },
      ]);
    });
    this.authorityForm.controls.date.setValue(this.clock.today());
    // Abrir a ocorrência é leitura de dado sensível: uma linha no log por abertura (não por passo registrado).
    effect(() => {
      const id = this.id();
      untracked(() => {
        const o = this.svc.occurrence(id);
        if (o) {
          this.audit.view('occurrence', o.id, o.caregiverId);
        }
      });
    });
  }

  protected date(value: string): string {
    return formatDate(value);
  }

  protected registerStep(): void {
    const o = this.occurrence();
    const n = Number(this.stepForm.controls.step.value);
    if (!o || !n) {
      return;
    }
    const result = this.svc.registerStep(o.id, n, this.stepForm.controls.note.value);
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível registrar o passo.');
      return;
    }
    this.stepForm.controls.note.setValue('');
    this.toasts.success(`Passo ${n} registrado às ${formatDateTime(this.clock.now()).slice(-5)}.`);
  }

  protected registerAuthority(): void {
    this.authoritySubmitted.set(true);
    const o = this.occurrence();
    if (!o || this.authorityDateError()) {
      return;
    }
    const v = this.authorityForm.getRawValue();
    // Se o órgão já está na lista sem data (ex.: o seed), completa essa linha em vez de duplicar.
    const index = o.authoritiesNotified.findIndex((a) => a.body === v.body && !a.at);
    const result = this.svc.registerAuthority(o.id, index >= 0 ? index : null, v.body, v.date as string, v.protocol);
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível registrar.');
      return;
    }
    this.authoritySubmitted.set(false);
    this.authorityForm.controls.protocol.setValue('');
    this.toasts.success(`Comunicação ao órgão registrada: ${v.body}.`);
  }

  protected async close(): Promise<void> {
    const o = this.occurrence();
    if (!o) {
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Encerrar a ocorrência de ${this.code()}?`,
      message: 'Todos os passos estão feitos, com hora e responsável.',
      effects: {
        block: ['novos passos e novas comunicações nesta ocorrência'],
        keep: ['o histórico dos passos', 'a comunicação aos órgãos', 'o registro no log de acesso'],
      },
      irreversibleNote: 'Uma ocorrência encerrada não volta a ser aberta.',
      confirmLabel: 'Encerrar ocorrência',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.closeOccurrence(o.id);
    if (result.ok) {
      this.toasts.success(`Ocorrência de ${this.code()} encerrada.`);
    } else {
      this.toasts.attention(result.message ?? 'Não foi possível encerrar.');
    }
  }
}
