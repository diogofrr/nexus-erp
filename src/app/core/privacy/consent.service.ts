import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { CaregiverOwnership } from '../auth/caregiver-ownership';
import { SessionStore } from '../auth/session.store';
import { Clock } from '../clock/clock.service';
import { dateOf } from '../clock/date-utils';
import { Database } from '../data/database';
import { Channel, Consent, ConsentEvent, ConsentKey, ConsentStatus, ID } from '../models';
import { CONSENT_EFFECTS, CONSENT_KEYS, isConsentActive, isConsentOutdated } from '../rules/lgpd';

/** Transição de consentimento inválida (por exemplo, revogar o que não foi concedido). */
export class ConsentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsentError';
  }
}

export interface ConsentChangeOptions {
  channel: Channel | 'in_person';
  /** Evidência do registro (número do protocolo, "assinado em papel"...). */
  evidence?: string;
  /** Quem registrou. Sem isso, usa o usuário da sessão. */
  registeredByUserId?: ID;
}

export interface ConsentChangeResult {
  consent: Consent;
  event: ConsentEvent;
  /** Efeitos aplicados na hora (por exemplo, alertas encerrados), em pt-BR, para a interface mostrar. */
  appliedEffects: string[];
}

const DEFAULT_TERM_VERSION = '1.0';

/**
 * Consentimento granular por finalidade (RN-LGPD-03 a 06, 14; LP-04 a LP-06).
 * Seis consentimentos independentes: recusar imagem ou WhatsApp não bloqueia o resto. Cada concessão,
 * recusa ou revogação é um `ConsentEvent` append-only (nunca se edita nem se apaga) e gera log.
 * A revogação do consentimento de saúde aplica na hora os efeitos de RN-LGPD-14.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly session = inject(SessionStore);
  private readonly ownership = inject(CaregiverOwnership);

  // ===== Leitura =====

  get(caregiverId: ID, key: ConsentKey): Consent | undefined {
    return this.db.consents.find((c) => c.caregiverId === caregiverId && c.key === key);
  }

  /** Estado atual; `pending` se nunca houve registro. */
  status(caregiverId: ID, key: ConsentKey): ConsentStatus {
    return this.get(caregiverId, key)?.status ?? 'pending';
  }

  isActive(caregiverId: ID, key: ConsentKey): boolean {
    return isConsentActive(this.status(caregiverId, key));
  }

  /** Os seis consentimentos do titular, na ordem canônica (os ausentes aparecem como `pending`). */
  list(
    caregiverId: ID,
  ): { key: ConsentKey; status: ConsentStatus; version: string | null; consent?: Consent }[] {
    return CONSENT_KEYS.map((key) => {
      const consent = this.get(caregiverId, key);
      return {
        key,
        status: consent?.status ?? 'pending',
        version: consent?.currentTermVersion ?? null,
        ...(consent ? { consent } : {}),
      };
    });
  }

  /** Histórico do titular (mais antigo primeiro). */
  history(caregiverId: ID, key?: ConsentKey): ConsentEvent[] {
    return this.db.consentEvents
      .query((e) => e.caregiverId === caregiverId && (key === undefined || e.key === key))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id.localeCompare(b.id)));
  }

  /** Versão ativa do termo da chave. */
  activeTermVersion(key: ConsentKey): string {
    return (
      this.db.consentTerms.find((t) => t.key === key && t.active)?.version ?? DEFAULT_TERM_VERSION
    );
  }

  /** Consentimentos dados em versão antiga do termo: "desatualizado" (LP-06). */
  outdated(caregiverId: ID): Consent[] {
    return this.db.consents.query(
      (c) =>
        c.caregiverId === caregiverId &&
        c.status === 'granted' &&
        isConsentOutdated(c.currentTermVersion, this.activeTermVersion(c.key)),
    );
  }

  /** Efeitos de recusar ou revogar, em texto, para mostrar ANTES de confirmar. */
  effectsOf(key: ConsentKey, action: 'refuse' | 'revoke'): readonly string[] {
    const e = CONSENT_EFFECTS[key];
    return action === 'refuse' ? [e.ifRefused] : e.ifRevoked;
  }

  // ===== Escrita =====

  /** Cria os 6 consentimentos em `pending` de um cadastro novo (AC-M03-02). Idempotente. */
  initializeForNewCaregiver(caregiverId: ID): Consent[] {
    const missing = CONSENT_KEYS.filter((key) => !this.get(caregiverId, key));
    this.db.consents.createMany(
      missing.map((key) => ({
        caregiverId,
        key,
        status: 'pending' as ConsentStatus,
        currentTermVersion: this.activeTermVersion(key),
      })),
    );
    return CONSENT_KEYS.map((key) => this.get(caregiverId, key) as Consent);
  }

  grant(caregiverId: ID, key: ConsentKey, options: ConsentChangeOptions): ConsentChangeResult {
    return this.apply(caregiverId, key, 'granted', options);
  }

  /** Recusa. Só vale se não está concedido (para tirar um consentimento dado, use `revoke`). Não muda os demais. */
  refuse(caregiverId: ID, key: ConsentKey, options: ConsentChangeOptions): ConsentChangeResult {
    if (this.status(caregiverId, key) === 'granted') {
      throw new ConsentError(
        'Este consentimento está concedido. Para retirá-lo, registre a revogação.',
      );
    }
    return this.apply(caregiverId, key, 'refused', options);
  }

  /** Revogação. Só vale para consentimento concedido. */
  revoke(caregiverId: ID, key: ConsentKey, options: ConsentChangeOptions): ConsentChangeResult {
    if (this.status(caregiverId, key) !== 'granted') {
      throw new ConsentError('Só é possível revogar um consentimento que foi concedido.');
    }
    return this.apply(caregiverId, key, 'revoked', options);
  }

  // ===== Internos =====

  private apply(
    caregiverId: ID,
    key: ConsentKey,
    status: ConsentEvent['status'],
    options: ConsentChangeOptions,
  ): ConsentChangeResult {
    // Com a sessão de um cuidador aberta, só se decide sobre a própria autorização (QAC-001).
    this.ownership.assertCaregiver(caregiverId);
    const caregiver = this.db.caregivers.get(caregiverId);
    if (!caregiver) {
      throw new ConsentError('Titular não encontrado.');
    }
    const registeredByUserId = options.registeredByUserId ?? this.session.user()?.id;
    if (!registeredByUserId) {
      throw new ConsentError('Informe quem está registrando o consentimento.');
    }
    const termVersion = this.activeTermVersion(key);
    const event = this.db.consentEvents.append({
      caregiverId,
      key,
      status,
      termVersion,
      at: this.clock.now(),
      channel: options.channel,
      registeredByUserId,
      ...(options.evidence ? { evidence: options.evidence } : {}),
    });
    const existing = this.get(caregiverId, key);
    const consent = existing
      ? this.db.consents.update(existing.id, { status, currentTermVersion: termVersion })
      : this.db.consents.create({ caregiverId, key, status, currentTermVersion: termVersion });
    const appliedEffects = this.applyEffects(caregiverId, key, status);
    this.audit.write('create', 'consent_event', event.id, caregiverId, `${key}: ${status}`);
    return { consent, event, appliedEffects };
  }

  private applyEffects(caregiverId: ID, key: ConsentKey, status: ConsentEvent['status']): string[] {
    const effects: string[] = [];
    const caregiver = this.db.caregivers.require(caregiverId);
    const now = this.clock.now();
    if (key === 'health_data' && status === 'revoked') {
      if (caregiver.status === 'active') {
        this.db.caregivers.update(caregiverId, { status: 'paused_by_consent_revocation' });
        effects.push('Cadastro pausado por revogação do consentimento de saúde.');
      }
      const closedZarit = this.db.zaritAlerts.updateWhere(
        (a) => a.caregiverId === caregiverId && a.status !== 'closed',
        { status: 'closed', closedAt: now, closureNote: 'consentimento revogado' },
      );
      if (closedZarit > 0) {
        effects.push(`${closedZarit} alerta(s) de Zarit encerrado(s): consentimento revogado.`);
      }
      const closedArbe = this.db.arbeAlerts.updateWhere(
        (a) => a.caregiverId === caregiverId && a.status !== 'closed' && a.status !== 'discarded',
        { status: 'closed', closedAt: now, closureReason: 'consentimento revogado' },
      );
      if (closedArbe > 0) {
        effects.push(`${closedArbe} alerta(s) da ARBE encerrado(s): consentimento revogado.`);
      }
      effects.push(
        'Novas aplicações da Zarit ficam bloqueadas e o cuidador sai dos painéis agregados.',
      );
    }
    if (
      key === 'health_data' &&
      status === 'granted' &&
      caregiver.status === 'paused_by_consent_revocation'
    ) {
      this.db.caregivers.update(caregiverId, { status: 'active' });
      effects.push('Cadastro reativado: o consentimento de saúde foi concedido de novo.');
    }
    if (key === 'pilot_tcle' && status === 'revoked') {
      if (caregiver.isPilot) {
        this.db.caregivers.update(caregiverId, { isPilot: false });
      }
      const exited = this.db.pilotEnrollments.updateWhere(
        (p) => p.caregiverId === caregiverId && !p.exitedAt,
        { exitedAt: dateOf(now) },
      );
      effects.push(
        exited > 0
          ? 'Cuidador retirado do piloto. Os dados já coletados seguem as regras de retenção.'
          : 'Cuidador fora do piloto.',
      );
    }
    if (
      key === 'whatsapp_contact' &&
      status === 'revoked' &&
      caregiver.preferredChannel === 'whatsapp'
    ) {
      this.db.caregivers.update(caregiverId, { preferredChannel: 'app' });
      effects.push('Canal preferido trocado de WhatsApp para aplicativo.');
    }
    return effects;
  }
}
