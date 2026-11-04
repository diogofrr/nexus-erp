import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { formatDate } from '@core/format';
import type { Channel, ConsentKey, ConsentStatus, ID } from '@core/models';
import { ConsentChangeResult, ConsentError, ConsentService } from '@core/privacy';
import { CONSENT_LABELS } from '@core/rules';
import { BadgeComponent, BadgeVariant } from '../display/badge.component';
import { IconComponent } from '../display/icon.component';
import { uniqueId } from '../util/ids';
import { CONSENT_COPY } from './consent-copy';
import { SwitchComponent } from './switch.component';

export interface RevokeRequest {
  key: ConsentKey;
  /** Efeitos da revogação, em texto, para o diálogo de efeito mostrar ANTES de confirmar. */
  effects: readonly string[];
}

const STATUS_BADGE: Record<ConsentStatus, { variant: BadgeVariant; label: string; outline?: boolean }> = {
  granted: { variant: 'success', label: 'Ativo' },
  refused: { variant: 'neutral', label: 'Recusado', outline: true },
  revoked: { variant: 'danger', label: 'Revogado' },
  pending: { variant: 'attention', label: 'Pendente' },
};

/**
 * Consentimento granular (LP-04 a LP-06), uma linha `.consent` por finalidade, ligada ao `ConsentService`.
 * Linguagem simples, selo de estado (Ativo, Recusado, Revogado, Pendente, Desatualizado), versão, data e
 * "Ver histórico". NADA vem pré-marcado: o interruptor só liga depois de a pessoa ligar.
 *
 * - Ligar concede (`ConsentService.grant`, canal `channel`) e emite `changed`.
 * - Desligar NÃO revoga sozinho: emite `revokeRequested` com os efeitos, para o host abrir o diálogo de efeito
 *   e chamar `ConsentService.revoke`. Com `autoRevoke` revoga na hora (use só onde o efeito já está claro).
 *
 * ```html
 * <app-consent-toggle [caregiverId]="cg.id" key="whatsapp_contact"
 *                    (revokeRequested)="askRevoke($event)" (historyRequested)="openHistory($event)" />
 * ```
 */
@Component({
  selector: 'app-consent-toggle',
  imports: [BadgeComponent, IconComponent, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'consent', '[attr.data-status]': 'status()' },
  template: `
    <div>
      <h4 [id]="titleId">{{ copy().question }}</h4>
      <p>{{ label() }}</p>
      <p class="consent__meta">
        <app-badge [variant]="badge().variant" [outline]="!!badge().outline" dot>{{ badge().label }}</app-badge>
        @if (outdated()) {
          <app-badge variant="gold" icon="triangle-alert">Desatualizado: pedir novo aceite</app-badge>
        }
        @if (version()) {
          <span>Termo v{{ version() }}</span>
        }
        @if (since()) {
          <span>desde {{ since() }}</span>
        }
        <button type="button" class="btn-link" (click)="historyRequested.emit(key())">Ver histórico</button>
      </p>
      <details class="consent__details">
        <summary>Ver detalhes</summary>
        <dl class="consent__list">
          <dt>O que vamos fazer</dt>
          <dd>{{ copy().what }}</dd>
          <dt>Por quê</dt>
          <dd>{{ copy().why }}</dd>
          <dt>Quem vê</dt>
          <dd>{{ copy().who }}</dd>
          <dt>Se você disser não</dt>
          <dd>{{ copy().ifNo }}</dd>
          <dt>Se mudar de ideia</dt>
          <dd>{{ copy().change }}</dd>
        </dl>
      </details>
      @if (errorText()) {
        <p class="field__error" role="alert">
          <svg appIcon="circle-alert" size="sm"></svg><span><span class="sr-only">Erro: </span>{{ errorText() }}</span>
        </p>
      }
    </div>
    <app-switch
      [checked]="isOn()"
      [disabled]="readonly()"
      (checkedChange)="onSwitch($event)"
      >{{ isOn() ? 'Permitido' : 'Não permitido' }}</app-switch
    >
  `,
})
export class ConsentToggleComponent {
  private readonly consent = inject(ConsentService);

  readonly caregiverId = input.required<ID>();
  readonly key = input.required<ConsentKey>();
  /** Canal do registro (`in_person` quando a equipe registra no balcão). */
  readonly channel = input<Channel | 'in_person'>('in_person');
  /** Sem permissão para mudar: o interruptor fica desabilitado. */
  readonly readonly = input(false, { transform: booleanAttribute });
  /** Revoga direto ao desligar, sem pedir o diálogo de efeito. */
  readonly autoRevoke = input(false, { transform: booleanAttribute });

  readonly changed = output<ConsentChangeResult>();
  readonly revokeRequested = output<RevokeRequest>();
  readonly historyRequested = output<ConsentKey>();

  protected readonly titleId = uniqueId('app-consent');
  protected readonly errorText = signal<string | null>(null);
  private readonly switchRef = viewChild(SwitchComponent);

  protected readonly copy = computed(() => CONSENT_COPY[this.key()]);
  protected readonly label = computed(() => CONSENT_LABELS[this.key()]);
  protected readonly status = computed<ConsentStatus>(() => this.consent.status(this.caregiverId(), this.key()));
  protected readonly isOn = computed(() => this.status() === 'granted');
  protected readonly badge = computed(() => STATUS_BADGE[this.status()]);
  protected readonly version = computed(
    () => this.consent.get(this.caregiverId(), this.key())?.currentTermVersion ?? null,
  );
  protected readonly outdated = computed(() =>
    this.consent.outdated(this.caregiverId()).some((c) => c.key === this.key()),
  );
  protected readonly since = computed(() => {
    const events = this.consent.history(this.caregiverId(), this.key());
    const last = events[events.length - 1];
    return last ? formatDate(last.at) : null;
  });

  protected onSwitch(on: boolean): void {
    this.errorText.set(null);
    if (on) {
      this.run(() => this.consent.grant(this.caregiverId(), this.key(), { channel: this.channel() }));
      return;
    }
    if (this.status() !== 'granted') {
      return;
    }
    if (this.autoRevoke()) {
      this.run(() => this.consent.revoke(this.caregiverId(), this.key(), { channel: this.channel() }));
      return;
    }
    this.revokeRequested.emit({ key: this.key(), effects: this.consent.effectsOf(this.key(), 'revoke') });
    // O interruptor só desliga quando a revogação realmente acontecer.
    this.resetSwitch(true);
  }

  private resetSwitch(on: boolean): void {
    const control = this.switchRef();
    control?.checked.set(on);
    control?.sync();
  }

  private run(action: () => ConsentChangeResult): void {
    try {
      this.changed.emit(action());
    } catch (error) {
      this.errorText.set(
        error instanceof ConsentError ? error.message : 'Não foi possível salvar. Tente de novo; se continuar, avise a equipe.',
      );
      this.resetSwitch(this.isOn());
    }
  }

  /** Revoga agora (para o host chamar depois do diálogo de efeito). */
  revoke(): void {
    this.errorText.set(null);
    this.run(() => this.consent.revoke(this.caregiverId(), this.key(), { channel: this.channel() }));
  }
}
