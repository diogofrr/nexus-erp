import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { Provider } from '@core/models';
import { BadgeComponent, IconComponent } from '@shared/ui';
import { DialogService, ToastService } from '@shared/ui/overlay';
import { NetworkAdminService, Result } from '../state/network-admin.service';

type StepKey = 'integration' | 'pops' | 'parallel' | 'clause';

interface Step {
  key: StepKey;
  title: string;
  text: string;
  date: string | undefined;
  button: string;
  effect: string;
}

/**
 * Integração do prestador (RN-REDE-16, 24, RN-POP-12 e RN-LGPD-13): integração concluída, ciência dos
 * procedimentos (POPs), aceite de não captar usuários por fora e cláusula de proteção de dados. A gestão
 * registra cada passo com a data de hoje; a ativação só vale com os três primeiros.
 */
@Component({
  selector: 'app-integration-steps',
  imports: [BadgeComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="checklist" role="list" aria-label="Integração do prestador">
      @for (step of steps(); track step.key) {
        <li class="checklist__item" [attr.data-state]="step.date ? 'ok' : 'pending'" [attr.data-step]="step.key">
          <svg [appIcon]="step.date ? 'circle-check' : 'clock'"></svg>
          <div>
            <div class="checklist__title">{{ step.title }}</div>
            <div class="checklist__text">{{ step.text }}</div>
          </div>
          <div class="cluster">
            @if (step.date) {
              <app-badge variant="success" icon="circle-check">Registrado em {{ format(step.date) }}</app-badge>
            } @else {
              <app-badge variant="attention" icon="clock">Pendente</app-badge>
              @if (canEdit()) {
                <button type="button" class="btn btn--sm" data-role="record-step" (click)="record(step)">
                  {{ step.button }}
                </button>
              }
            }
          </div>
        </li>
      }
    </ul>
  `,
})
export class IntegrationStepsComponent {
  private readonly db = inject(Database);
  private readonly admin = inject(NetworkAdminService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  readonly providerId = input.required<string>();
  protected readonly canEdit = computed(() => this.admin.isManager());

  protected readonly provider = computed<Provider | undefined>(() => this.db.providers.get(this.providerId()));

  protected readonly steps = computed<Step[]>(() => {
    const p = this.provider();
    return [
      {
        key: 'integration',
        title: 'Integração concluída',
        text: 'Modelo Nexus, regras de atendimento, sigilo e proteção de dados.',
        date: p?.integrationDoneAt,
        button: 'Registrar integração',
        effect: 'a integração fica registrada com a data de hoje',
      },
      {
        key: 'pops',
        title: 'Ciência dos procedimentos (POPs)',
        text: 'O prestador recebe os procedimentos e confirma que leu.',
        date: p?.popsAcknowledgedAt,
        button: 'Registrar ciência',
        effect: 'a ciência dos procedimentos fica registrada com a data de hoje',
      },
      {
        key: 'parallel',
        title: 'Aceite de não captar usuários por fora',
        text: 'O contato com usuários da Nexus não pode ser usado fora das condições da rede.',
        date: p?.parallelSolicitationBanAcceptedAt,
        button: 'Registrar aceite',
        effect: 'o aceite fica registrado com a data de hoje',
      },
      {
        key: 'clause',
        title: 'Cláusula de proteção de dados',
        text: 'Sem a cláusula assinada, a Nexus não repassa dados de usuários a este prestador.',
        date: p?.dataProtectionClauseSignedAt,
        button: 'Registrar assinatura',
        effect: 'a assinatura da cláusula fica registrada com a data de hoje',
      },
    ];
  });

  protected format(date: string): string {
    return formatDate(date);
  }

  protected async record(step: Step): Promise<void> {
    const provider = this.provider();
    if (!provider) {
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `${step.button} de ${provider.name}?`,
      message: 'O registro vale para a ativação e para o histórico do prestador.',
      effects: { keep: [step.effect] },
      confirmLabel: step.button,
    });
    if (!confirmed) {
      return;
    }
    const run: Record<StepKey, () => Result> = {
      integration: () => this.admin.recordIntegration(provider.id),
      pops: () => this.admin.recordPops(provider.id),
      parallel: () => this.admin.recordParallelBan(provider.id),
      clause: () => this.admin.recordClause(provider.id),
    };
    const result = run[step.key]();
    if (result.ok) {
      this.toasts.success(`${step.title}: registrado para ${provider.name}.`);
    } else {
      this.toasts.error(result.error);
    }
  }
}
