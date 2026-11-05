import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { AuthService } from '@core/auth';
import { formatDate } from '@core/format';
import type { Channel, ConsentKey, ConsentStatus, ID } from '@core/models';
import { ConsentError, ConsentService } from '@core/privacy';
import { CONSENT_KEYS, CONSENT_LABELS } from '@core/rules';
import { Database } from '@core/data';
import { BadgeComponent, BadgeVariant } from '../display/badge.component';
import { uniqueId } from '../util/ids';
import { TimelineComponent, TimelineItem } from '../display/timeline.component';
import { CONSENT_COPY } from '../forms/consent-copy';
import { DialogService } from '../overlay/dialog.service';
import { ToastService } from '../overlay/toast.service';

type ConsentChannel = Channel | 'in_person';

const STATUS_BADGE: Record<ConsentStatus, { variant: BadgeVariant; label: string; outline?: boolean }> = {
  granted: { variant: 'success', label: 'Ativo' },
  refused: { variant: 'neutral', label: 'Recusado', outline: true },
  revoked: { variant: 'danger', label: 'Revogado' },
  pending: { variant: 'attention', label: 'Pendente' },
};

const CHANNELS: readonly { value: ConsentChannel; label: string }[] = [
  { value: 'in_person', label: 'Presencial' },
  { value: 'phone', label: 'Telefone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'app', label: 'Aplicativo' },
  { value: 'email', label: 'E-mail' },
];

const EVENT_TITLES: Record<'granted' | 'refused' | 'revoked', string> = {
  granted: 'Consentimento concedido',
  refused: 'Consentimento recusado',
  revoked: 'Consentimento revogado',
};

interface ConsentRow {
  key: ConsentKey;
  label: string;
  status: ConsentStatus;
  version: string | null;
  since: string | null;
  outdated: boolean;
  badge: { variant: BadgeVariant; label: string; outline?: boolean };
}

/**
 * Consentimentos de UM titular (LP-04 a LP-06, F02 etapa 3, F12): seis cartões independentes, nada
 * pré-marcado, com selo de estado, versão do termo, data, canal e histórico em linha do tempo
 * APPEND-ONLY (não tem editar nem apagar). Quem pode registrar (`lgpd_consents_requests`) vê "Concorda",
 * "Não concorda" e "Revogar"; revogar abre o diálogo de efeito antes. Recusar um não muda os outros.
 *
 * ```html
 * <app-consent-manager [caregiverId]="cg.id" (changed)="refresh()" />
 * ```
 */
@Component({
  selector: 'app-consent-manager',
  imports: [BadgeComponent, TimelineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canEdit()) {
      <div class="form-grid">
        <div class="field">
          <label class="field__label" [attr.for]="channelId">Como foi dado o consentimento</label>
          <select class="select" [id]="channelId" (change)="onChannel($event)">
            @for (option of channels; track option.value) {
              <option [value]="option.value" [selected]="option.value === channel()">{{ option.label }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label class="field__label" [attr.for]="evidenceId">Evidência <span class="field__opt">(opcional)</span></label>
          <input class="input" [id]="evidenceId" autocomplete="off" [value]="evidence()" (input)="onEvidence($event)" />
        </div>
      </div>
      <p class="t-caption">O registro fica em nome de quem está conectado e entra no histórico, que não se edita nem se apaga.</p>
    } @else {
      <p class="t-caption">Seu perfil só consulta os consentimentos.</p>
    }
    <div class="list-card">
      @for (row of rows(); track row.key) {
        <section class="consent" [attr.data-status]="row.status" [attr.data-key]="row.key" [attr.aria-label]="row.label">
          <div>
            <h4>{{ copy[row.key].question }}</h4>
            <p>{{ row.label }}</p>
            <p class="consent__meta">
              <app-badge [variant]="row.badge.variant" [outline]="!!row.badge.outline" dot>{{ row.badge.label }}</app-badge>
              @if (row.outdated) {
                <app-badge variant="gold" icon="triangle-alert">Desatualizado: pedir novo aceite</app-badge>
              }
              @if (row.version) {
                <span>Termo v{{ row.version }}</span>
              }
              @if (row.since) {
                <span>desde {{ row.since }}</span>
              }
              <button type="button" class="btn-link" [attr.aria-expanded]="historyKey() === row.key" (click)="toggleHistory(row.key)">
                {{ historyKey() === row.key ? 'Esconder histórico' : 'Ver histórico' }}
              </button>
            </p>
            <details class="consent__details">
              <summary>Ver detalhes</summary>
              <dl class="consent__list">
                <dt>O que vamos fazer</dt><dd>{{ copy[row.key].what }}</dd>
                <dt>Por quê</dt><dd>{{ copy[row.key].why }}</dd>
                <dt>Quem vê</dt><dd>{{ copy[row.key].who }}</dd>
                <dt>Se você disser não</dt><dd>{{ copy[row.key].ifNo }}</dd>
                <dt>Se mudar de ideia</dt><dd>{{ copy[row.key].change }}</dd>
              </dl>
            </details>
            @if (historyKey() === row.key) {
              @if (historyItems().length > 0) {
                <app-timeline [label]="'Histórico de ' + row.label" [items]="historyItems()" />
              } @else {
                <p class="t-caption">Ainda não há registro. Nada vem marcado.</p>
              }
            }
          </div>
          @if (canEdit()) {
            <div class="cluster">
              @if (row.status === 'granted') {
                @if (row.outdated) {
                  <button type="button" class="btn btn--sm" (click)="grant(row.key)">Registrar novo aceite</button>
                }
                <button type="button" class="btn btn--sm btn--danger-quiet" (click)="revoke(row.key)">Revogar consentimento</button>
              } @else {
                <button type="button" class="btn btn--sm" (click)="grant(row.key)">
                  {{ row.status === 'revoked' ? 'Registrar concordância de novo' : 'Registrar concordância' }}
                </button>
                @if (row.status !== 'refused') {
                  <button type="button" class="btn btn--sm" (click)="refuse(row.key)">Registrar recusa</button>
                }
              }
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class ConsentManagerComponent {
  private readonly consent = inject(ConsentService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly db = inject(Database);

  readonly caregiverId = input.required<ID>();
  /** Algo mudou (para quem hospeda recarregar resumos). */
  readonly changed = output<void>();

  protected readonly copy = CONSENT_COPY;
  protected readonly channels = CHANNELS;
  protected readonly channelId = uniqueId('app-consent-channel');
  protected readonly evidenceId = uniqueId('app-consent-evidence');
  protected readonly channel = signal<ConsentChannel>('in_person');
  protected readonly evidence = signal('');
  protected readonly historyKey = signal<ConsentKey | null>(null);

  protected readonly canEdit = computed(() => this.auth.can('lgpd_consents_requests', 'update'));

  protected readonly rows = computed<ConsentRow[]>(() => {
    const id = this.caregiverId();
    const outdated = new Set(this.consent.outdated(id).map((c) => c.key));
    // As leituras dependem dos sinais do banco, então a tela acompanha cada registro.
    this.db.consentEvents.all();
    this.db.consents.all();
    return CONSENT_KEYS.map((key) => {
      const status = this.consent.status(id, key);
      const events = this.consent.history(id, key);
      const last = events[events.length - 1];
      return {
        key,
        label: CONSENT_LABELS[key],
        status,
        version: this.consent.get(id, key)?.currentTermVersion ?? null,
        since: last ? formatDate(last.at) : null,
        outdated: outdated.has(key),
        badge: STATUS_BADGE[status],
      };
    });
  });

  protected readonly historyItems = computed<TimelineItem[]>(() => {
    const key = this.historyKey();
    this.db.consentEvents.all();
    if (!key) {
      return [];
    }
    return [...this.consent.history(this.caregiverId(), key)].reverse().map((e) => ({
      id: e.id,
      title: EVENT_TITLES[e.status],
      at: e.at,
      tone: e.status === 'granted' ? 'done' : e.status === 'revoked' ? 'danger' : 'default',
      text: `Termo v${e.termVersion}, ${CHANNELS.find((c) => c.value === e.channel)?.label ?? e.channel}. Registrado por ${this.db.users.get(e.registeredByUserId)?.displayName ?? 'usuário'}.${e.evidence ? ` Evidência: ${e.evidence}.` : ''}`,
    }));
  });

  protected onChannel(event: Event): void {
    this.channel.set((event.target as HTMLSelectElement).value as ConsentChannel);
  }

  protected onEvidence(event: Event): void {
    this.evidence.set((event.target as HTMLInputElement).value);
  }

  protected toggleHistory(key: ConsentKey): void {
    this.historyKey.set(this.historyKey() === key ? null : key);
  }

  private options(): { channel: ConsentChannel; evidence?: string } {
    const evidence = this.evidence().trim();
    return { channel: this.channel(), ...(evidence ? { evidence } : {}) };
  }

  protected grant(key: ConsentKey): void {
    this.run(() => {
      const result = this.consent.grant(this.caregiverId(), key, this.options());
      this.toasts.success(
        `Consentimento registrado: ${CONSENT_LABELS[key]}.${result.appliedEffects.length > 0 ? ` ${result.appliedEffects.join(' ')}` : ''}`,
      );
    });
  }

  protected refuse(key: ConsentKey): void {
    this.run(() => {
      this.consent.refuse(this.caregiverId(), key, this.options());
      this.toasts.success(`Recusa registrada: ${CONSENT_LABELS[key]}. Os outros consentimentos não mudam.`);
    });
  }

  protected async revoke(key: ConsentKey): Promise<void> {
    const effects = this.consent.effectsOf(key, 'revoke');
    const { confirmed } = await this.dialogs.confirm({
      title: `Retirar o consentimento: ${CONSENT_LABELS[key]}?`,
      message: effects.join(' '),
      effects: {
        keep: [
          'o histórico de consentimentos, que não se edita nem se apaga',
          ...(key === 'health_data' ? ['o registro psicológico já feito, por 5 anos'] : []),
        ],
      },
      confirmLabel: 'Revogar consentimento',
      busyLabel: 'Revogando...',
      run: () => {
        const result = this.consent.revoke(this.caregiverId(), key, this.options());
        this.toasts.success(
          `Consentimento revogado.${result.appliedEffects.length > 0 ? ` ${result.appliedEffects.join(' ')}` : ''}`,
        );
      },
    });
    if (confirmed) {
      this.changed.emit();
    }
  }

  private run(action: () => void): void {
    try {
      action();
      this.changed.emit();
    } catch (error) {
      this.toasts.error(
        error instanceof ConsentError ? error.message : 'Não foi possível salvar. Tente de novo; se continuar, avise a equipe.',
      );
    }
  }
}
