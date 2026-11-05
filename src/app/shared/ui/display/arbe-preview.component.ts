import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import type { ArbeSettings } from '@core/models';
import { aggregateCount } from '@core/privacy';
import { ConsentService } from '@core/privacy/consent.service';
import { ArbePreviewPerson, countSupportRequests, previewArbeChange } from '@core/rules';
import { IconComponent } from './icon.component';

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Prévia dos parâmetros da ARBE (CX-021): "com estes limites, N cuidadores entrariam em alerta de atenção e M em
 * crítico", e quantos mudam de nível em relação aos limites de hoje. Só números, nunca nomes. Para a gestão, número
 * pequeno aparece como "menos de 5" (RN-KPI-02). Recebe os limites que estão no formulário, mesmo antes de salvar.
 *
 * ```html
 * <app-arbe-preview [settings]="draftSettings()" />
 * ```
 */
@Component({
  selector: 'app-arbe-preview',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card card--sunken card--pad stack stack--2" aria-labelledby="arbe-preview-title" data-role="arbe-preview">
      <h2 id="arbe-preview-title" class="card__title"><svg appIcon="gauge"></svg> O que muda com estes limites</h2>
      @if (summary(); as s) {
        <p class="t-ui" data-role="arbe-preview-proposed">
          Com estes limites, <strong>{{ s.proposedAttention }}</strong> entrariam em alerta de atenção e
          <strong>{{ s.proposedCritical }}</strong> em alerta crítico. Hoje são {{ s.currentAttention }} e
          {{ s.currentCritical }}.
        </p>
        <p class="t-ui" data-role="arbe-preview-changes">{{ s.changes }}</p>
        <p class="t-caption">
          Contamos só os cuidadores ativos, com psicólogo e consentimento de saúde. Nenhum nome aparece aqui.
        </p>
      } @else {
        <p class="t-ui" data-role="arbe-preview-invalid">Corrija os campos para ver o que mudaria.</p>
      }
    </section>
  `,
})
export class ArbePreviewComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly consent = inject(ConsentService);

  /** Limites do formulário; `null` quando o formulário ainda tem erro. */
  readonly settings = input<ArbeSettings | null>(null);

  private readonly people = computed<ArbePreviewPerson[]>(() => {
    const today = this.clock.today();
    const messages = this.db.messages.all();
    const lastScore = new Map<string, number>();
    this.db.zaritAssessments
      .all()
      .filter((z) => z.status === 'completed' && z.total !== undefined)
      .sort((a, b) => (a.appliedAt ?? '').localeCompare(b.appliedAt ?? ''))
      .forEach((z) => lastScore.set(z.caregiverId, z.total as number));
    return this.db.caregivers
      .all()
      .filter(
        (c) => c.status === 'active' && !!c.assignedPsychologistId && this.consent.isActive(c.id, 'health_data'),
      )
      .map((c) => ({
        id: c.id,
        dailyCareHours: c.dailyCareHours,
        lastZarit: lastScore.get(c.id) ?? null,
        supportRequestsIn: (windowDays: number) => countSupportRequests(messages, c.id, today, windowDays),
      }));
  });

  /** Quantos cuidadores mudam de nível com os limites do formulário. */
  readonly changedCount = computed(() => this.summary()?.changed ?? 0);
  /** A frase "N cuidadores mudam de nível: ...", para a confirmação de salvar. */
  readonly changeText = computed(() => this.summary()?.changes ?? '');

  protected readonly summary = computed(() => {
    const draft = this.settings();
    if (!draft) {
      return null;
    }
    const change = previewArbeChange(this.people(), this.db.settings.value().arbe, draft);
    const hide = this.auth.role() === 'partner';
    const min = this.db.settings.value().minGroupSizeForAggregates;
    const show = (n: number): string => {
      const agg = aggregateCount(n, min);
      return hide && !agg.sufficient ? agg.shortLabel : String(n);
    };
    const exact = !hide;
    let changes: string;
    if (change.changed === 0) {
      changes = 'Nenhum cuidador muda de nível com estes limites.';
    } else if (!exact && !aggregateCount(change.changed, min).sufficient) {
      changes = 'Menos de 5 cuidadores mudam de nível. Por privacidade, não mostramos o número.';
    } else {
      const parts: string[] = [];
      if (change.entering > 0) parts.push(`${plural(change.entering, 'passa a ter alerta', 'passam a ter alerta')}`);
      if (change.leaving > 0) parts.push(`${plural(change.leaving, 'deixa de ter alerta', 'deixam de ter alerta')}`);
      if (change.escalating > 0) parts.push(`${plural(change.escalating, 'sobe de atenção para crítico', 'sobem de atenção para crítico')}`);
      if (change.easing > 0) parts.push(`${plural(change.easing, 'desce de crítico para atenção', 'descem de crítico para atenção')}`);
      changes = `${plural(change.changed, 'cuidador muda', 'cuidadores mudam')} de nível: ${parts.join(', ')}.`;
    }
    return {
      proposedAttention: show(change.proposed.attention),
      proposedCritical: show(change.proposed.critical),
      currentAttention: show(change.current.attention),
      currentCritical: show(change.current.critical),
      changes,
      changed: change.changed,
    };
  });
}
