import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService, ModuleKey, canAccessModule, moduleByKey } from '@core/auth';
import { RiskItem } from '@core/models';
import { PRIORITY_RISK_THRESHOLD } from '@core/rules/governance';
import { checkRiskEdit, controlModuleCode } from '@core/rules/governance-access';
import { PageContextService, ToastService } from '@shared/ui/overlay';
import {
  BadgeComponent,
  CardComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
} from '@shared/ui';
import { map } from 'rxjs';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService } from '../state/governance.service';

const MODULE_BY_CODE: Record<string, { key: ModuleKey; link: string }> = {
  M03: { key: 'caregivers', link: '/app/cuidadores' },
  M06: { key: 'zarit', link: '/app/acompanhamento' },
  M07: { key: 'groups', link: '/app/grupos' },
  M08: { key: 'network', link: '/app/rede' },
  M09: { key: 'partners', link: '/app/parceiros' },
  M10: { key: 'finance', link: '/app/financeiro' },
  M11: { key: 'messages', link: '/app/mensagens' },
  M12: { key: 'privacy', link: '/app/lgpd' },
  M13: { key: 'governance', link: '/app/governanca' },
};

const SCALE = [1, 2, 3, 4, 5] as const;
const PROBABILITY_LABELS = ['Muito baixa', 'Baixa', 'Média', 'Alta', 'Muito alta'];
const IMPACT_LABELS = ['Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito alto'];

/**
 * SCR-M13-04 Risco (`/app/governanca/riscos/:id`, o `:id` aceita o código `R9`). Edita P e I (a criticidade C é
 * sempre calculada, e na hora), o tratamento e mostra os controles do sistema que mitigam o risco, com link para
 * a tela de cada um. Só a gestão e o RT editam (RN-RISCO-21); risco prioritário exige plano de tratamento.
 */
@Component({
  selector: 'app-governance-risk-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BadgeComponent,
    CardComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (risk(); as r) {
        <app-page-header [title]="r.code + ' · ' + r.title" [description]="'Categoria: ' + r.category" />
        <app-governance-tabs />

        <div class="cluster" data-role="risk-level">
          <app-badge [variant]="priority() ? 'danger' : 'neutral'" [icon]="priority() ? 'triangle-alert' : 'info'" large>
            Criticidade {{ criticality() ?? '?' }}
            {{ priority() ? ' · Prioritário' : ' · Acompanhamento' }}
          </app-badge>
          <span class="t-ui t-muted" data-role="formula">C = P x I = {{ values().probability }} x {{ values().impact }}</span>
        </div>

        <div class="layout-main-aside">
          <form class="stack stack--6" novalidate [formGroup]="form" (ngSubmit)="save()">
            <app-card
              title="Probabilidade e impacto"
              subtitle="Escala de 1 a 5. A criticidade é calculada, nunca digitada."
            >
              <div class="form-grid">
                <app-form-field label="Probabilidade (P)" controlId="risk-p" [error]="errors().probability ?? null">
                  <select appInput formControlName="probability">
                    @for (n of scale; track n) {
                      <option [ngValue]="n">{{ n }} · {{ probabilityLabel(n) }}</option>
                    }
                  </select>
                </app-form-field>
                <app-form-field label="Impacto (I)" controlId="risk-i" [error]="errors().impact ?? null">
                  <select appInput formControlName="impact">
                    @for (n of scale; track n) {
                      <option [ngValue]="n">{{ n }} · {{ impactLabel(n) }}</option>
                    }
                  </select>
                </app-form-field>
              </div>
            </app-card>

            <app-card
              title="Plano de tratamento"
              [subtitle]="priority() ? 'Obrigatório: risco prioritário (C de ' + threshold + ' ou mais)' : 'O que a Nexus faz para reduzir este risco'"
            >
              <app-form-field label="Tratamento" controlId="risk-treatment" [error]="errors().treatment ?? null">
                <textarea appInput formControlName="treatment" rows="4"></textarea>
              </app-form-field>
            </app-card>

            @if (canEdit()) {
              <div class="cluster cluster--end">
                <button type="submit" class="btn btn--primary" data-role="save">Salvar risco</button>
              </div>
            } @else {
              <p class="t-ui t-muted" data-role="read-only">
                <svg appIcon="lock" size="sm"></svg> Você pode ler este risco. Só a gestão e o responsável técnico editam.
              </p>
            }
          </form>

          <aside class="stack stack--6" aria-label="Controles do sistema">
            <app-card title="Controles do sistema" subtitle="O que mitiga este risco hoje" variant="sunken">
              <ul class="stack stack--2" data-role="controls">
                @for (c of controls(); track c.text) {
                  <li>
                    @if (c.link) {
                      <a [routerLink]="c.link">{{ c.text }}</a>
                    } @else {
                      {{ c.text }}
                    }
                  </li>
                }
              </ul>
            </app-card>
          </aside>
        </div>
      } @else {
        <app-page-header title="Risco não encontrado" />
        <app-empty-state kind="error" title="Não encontramos este risco" text="Confira o código (de R1 a R12) ou volte ao registro.">
          <a class="btn" routerLink="/app/governanca/riscos">Ver os riscos</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class RiskPageComponent {
  private readonly svc = inject(GovernanceService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly pageContext = inject(PageContextService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly scale = SCALE;
  protected readonly threshold = PRIORITY_RISK_THRESHOLD;

  private readonly param = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });
  protected readonly risk = computed<RiskItem | undefined>(() => {
    const wanted = this.param();
    return this.svc.riskByCode(wanted.toUpperCase()) ?? this.svc.risks().find((r) => r.risk.id === wanted)?.risk;
  });

  protected readonly canEdit = this.svc.canEditRisks;
  private readonly submitted = signal(false);
  private readonly tick = signal(0);

  protected readonly form = this.fb.group({
    probability: this.fb.control(1) as FormControl<number>,
    impact: this.fb.control(1) as FormControl<number>,
    treatment: this.fb.control(''),
  });

  protected readonly values = computed(() => {
    this.tick();
    const v = this.form.getRawValue();
    return { probability: v.probability, impact: v.impact, treatment: v.treatment };
  });
  protected readonly criticality = computed(() => {
    const v = this.values();
    return Number.isInteger(v.probability) && Number.isInteger(v.impact) ? v.probability * v.impact : null;
  });
  protected readonly priority = computed(() => (this.criticality() ?? 0) >= this.threshold);
  protected readonly errors = computed<Partial<Record<'probability' | 'impact' | 'treatment', string>>>(() => {
    this.tick();
    return this.submitted() ? checkRiskEdit(this.values()).errors : {};
  });

  protected readonly controls = computed(() =>
    (this.risk()?.controls ?? []).map((text) => {
      const code = controlModuleCode(text);
      const target = code ? MODULE_BY_CODE[code] : undefined;
      const role = this.auth.role();
      const link =
        target && role && canAccessModule(role, moduleByKey(target.key)) ? target.link : null;
      return { text, link };
    }),
  );

  constructor() {
    effect(() => {
      const r = this.risk();
      if (r) {
        this.form.reset(
          { probability: r.probability, impact: r.impact, treatment: r.treatment },
          { emitEvent: false },
        );
        this.submitted.set(false);
        this.tick.update((n) => n + 1);
      }
      this.pageContext.setCrumbs([
        { label: 'Governança', link: '/app/governanca' },
        { label: 'Riscos', link: '/app/governanca/riscos' },
        { label: r?.code ?? 'Risco' },
      ]);
    });
    this.form.valueChanges.subscribe(() => this.tick.update((n) => n + 1));
    if (!this.canEdit()) {
      this.form.disable({ emitEvent: false });
    }
  }

  protected probabilityLabel(n: number): string {
    return PROBABILITY_LABELS[n - 1] ?? '';
  }

  protected impactLabel(n: number): string {
    return IMPACT_LABELS[n - 1] ?? '';
  }

  protected save(): void {
    const r = this.risk();
    if (!r) {
      return;
    }
    this.submitted.set(true);
    this.tick.update((n) => n + 1);
    const v = this.values();
    const check = checkRiskEdit(v);
    if (!check.ok) {
      return;
    }
    const wasPriority = r.probability * r.impact >= this.threshold;
    const result = this.svc.updateRisk(r.id, v);
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível salvar.');
      return;
    }
    const nowPriority = (v.probability as number) * (v.impact as number) >= this.threshold;
    const change =
      wasPriority !== nowPriority
        ? nowPriority
          ? ' O risco passou a ser prioritário.'
          : ' O risco deixou de ser prioritário.'
        : '';
    const undo = result.undo;
    this.toasts.success(
      `${r.code} salvo: criticidade ${(v.probability as number) * (v.impact as number)}.${change}`,
      undo ? { label: 'Desfazer', run: undo } : undefined,
    );
  }
}
