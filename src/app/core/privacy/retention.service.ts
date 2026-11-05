import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { Clock } from '../clock/clock.service';
import { addDays, dateOf } from '../clock/date-utils';
import { Database } from '../data/database';
import { ID, ISODate, RetentionBlock, Role } from '../models';
import {
  ACCESS_LOG_RETENTION_YEARS,
  CADASTRE_RETENTION_DAYS,
  DOCUMENTARY_RETENTION_BASIS,
  DOCUMENTARY_RETENTION_YEARS,
  cadastreErasureDate,
  isRetentionExpired,
  retentionBlockUntil,
} from '../rules/lgpd';
import { addYears } from '../clock/date-utils';
import { caregiverCode } from './pseudonym';

/** Data neutra no lugar do nascimento eliminado (o modelo exige uma data; a tela não a mostra). */
export const ERASED_DATE: ISODate = '1900-01-01';

/** Texto padrão do bloqueio por retenção (AC-M12-04). */
export const RETENTION_BLOCK_NOTE = `Retido por registro documental por ${DOCUMENTARY_RETENTION_YEARS} anos; motivo: ${DOCUMENTARY_RETENTION_BASIS}.`;

export interface ErasurePlan {
  caregiverId: ID;
  /** O que será apagado (rótulo e quantidade). `key` é estável; só os itens cadastrais passam à visão restrita. */
  willErase: { key: string; label: string; count: number }[];
  /** O que fica BLOQUEADO por registro documental (rótulo e quantidade). */
  willBlock: { key: string; label: string; count: number }[];
  /** Fim do bloqueio. Vazio se nada fica retido. */
  blockedUntil: ISODate | null;
  note: string | null;
}

/** Frase única da visão restrita: não diz quais registros clínicos existem nem quantos (CX-033, bloqueios 1.3). */
export const RESTRICTED_BLOCK_LABEL =
  'Registros clínicos, se houver, ficam retidos por 5 anos por obrigação legal. Quem acompanha o caso vê quais são.';

/** Quem não pode ver registro clínico individual (matriz 1.2): a sócia e o atendimento. */
export function seesClinicalErasureDetail(role: Role | null): boolean {
  return role === 'technical_lead' || role === 'psychologist';
}

/**
 * Plano de eliminação como o perfil pode ver (CX-033): a sócia e o atendimento não descobrem pela lista se o
 * cadastro tem Zarit, alerta ou ocorrência. Mantêm-se só os itens cadastrais; o resto vira uma frase única e o
 * bloqueio documental aparece sempre do mesmo jeito, haja ou não registro.
 */
export function erasurePlanFor(plan: ErasurePlan, role: Role | null): ErasurePlan {
  if (seesClinicalErasureDetail(role)) {
    return plan;
  }
  const cadastral = new Set(['identity', 'elder', 'messages', 'appointments']);
  return {
    ...plan,
    willErase: [
      ...plan.willErase.filter((i) => cadastral.has(i.key)),
      { key: 'other', label: 'Demais dados de uso e de acompanhamento ligados a este cadastro', count: 1 },
    ],
    willBlock: [{ key: 'clinical', label: RESTRICTED_BLOCK_LABEL, count: 1 }],
    blockedUntil: null,
    // A política de retenção é geral: a nota aparece sempre, haja ou não registro clínico.
    note: RETENTION_BLOCK_NOTE,
  };
}

export interface ErasureResult {
  plan: ErasurePlan;
  erasedRecords: number;
  blockedRecords: number;
}

export interface RetentionSimulation {
  asOf: ISODate;
  /** Cadastros encerrados há 30 dias ou mais que seriam eliminados. */
  cadastresToErase: ID[];
  /** Bloqueios documentais que chegariam ao fim do prazo. */
  documentaryBlocksExpired: {
    zaritAssessments: number;
    zaritAlerts: number;
    arbeAlerts: number;
    sessionNotes: number;
    occurrences: number;
  };
  /** Linhas de log com mais de 5 anos. */
  accessLogToDiscard: number;
}

/**
 * Retenção, anonimização e eliminação (RN-LGPD-20, 23, 24; M12; LP-19).
 *
 * - Eliminação: apaga o que não é registro documental (cadastro de contato, mensagens, medicamentos,
 *   compromissos, bem-estar) e BLOQUEIA o que é (aplicações e alertas da Zarit, ARBE, anotações de
 *   sessão, ocorrências) por 5 anos (a confirmar), informando motivo e prazo.
 * - Anonimização: substitui identificadores por código e mantém os agregados. Irreversível.
 */
@Injectable({ providedIn: 'root' })
export class RetentionService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);

  /** O que a eliminação apagaria e o que ficaria bloqueado (mostrar ANTES de confirmar, AC-M12-04). */
  plan(caregiverId: ID): ErasurePlan {
    this.db.caregivers.require(caregiverId);
    const elder = this.db.elders.find((e) => e.caregiverId === caregiverId);
    const elderId = elder?.id;
    const sessions = this.db.careSessions
      .query((s) => s.caregiverId === caregiverId)
      .map((s) => s.id);
    const count = {
      messages: this.db.messages.count((m) => m.caregiverId === caregiverId),
      medications: elderId ? this.db.medications.count((m) => m.elderId === elderId) : 0,
      appointments: elderId ? this.db.careAppointments.count((a) => a.elderId === elderId) : 0,
      wellbeing: this.db.wellbeingChecks.count((w) => w.caregiverId === caregiverId),
      usage: this.db.appUsage.count((u) => u.caregiverId === caregiverId),
      zarit: this.db.zaritAssessments.count(
        (z) => z.caregiverId === caregiverId && z.status === 'completed',
      ),
      pendingScale: this.db.zaritAssessments.count(
        (z) => z.caregiverId === caregiverId && z.status !== 'completed',
      ),
      zaritAlerts: this.db.zaritAlerts.count((a) => a.caregiverId === caregiverId),
      arbe: this.db.arbeAlerts.count((a) => a.caregiverId === caregiverId),
      notes: this.db.sessionNotes.count((n) => sessions.includes(n.sessionId)),
      occurrences: this.db.occurrences.count((o) => o.caregiverId === caregiverId),
    };
    const willErase = [
      {
        key: 'identity',
        label:
          'Dados de contato e identificação do cuidador (nome, CPF, e-mail, telefone, nascimento, sexo, cidade e horas de cuidado)',
        count: 1,
      },
      ...(elder
        ? [{ key: 'elder', label: 'Identificação e condições de saúde da pessoa idosa', count: 1 }]
        : []),
      { key: 'messages', label: 'Mensagens', count: count.messages },
      { key: 'medications', label: 'Medicamentos', count: count.medications },
      { key: 'appointments', label: 'Compromissos de cuidado', count: count.appointments },
      {
        key: 'pendingScale',
        label: 'Aplicações da escala ainda não feitas (agendadas)',
        count: count.pendingScale,
      },
      { key: 'wellbeing', label: 'Registros de bem-estar', count: count.wellbeing },
      { key: 'usage', label: 'Resumo de uso do aplicativo', count: count.usage },
    ].filter((i) => i.count > 0);
    const willBlock = [
      { key: 'zarit', label: 'Aplicações da Escala de Zarit', count: count.zarit },
      { key: 'zaritAlerts', label: 'Alertas de Zarit', count: count.zaritAlerts },
      { key: 'arbe', label: 'Alertas da ARBE', count: count.arbe },
      { key: 'notes', label: 'Anotações de sessão', count: count.notes },
      { key: 'occurrences', label: 'Ocorrências POP-05 e POP-07', count: count.occurrences },
    ].filter((i) => i.count > 0);
    const blockedUntil = willBlock.length > 0 ? retentionBlockUntil(this.clock.today()) : null;
    return {
      caregiverId,
      willErase,
      willBlock,
      blockedUntil,
      note: willBlock.length > 0 ? RETENTION_BLOCK_NOTE : null,
    };
  }

  /**
   * Elimina o que não é registro documental e bloqueia o que é. O cadastro vai a `closed`; o código
   * (`CUI-0000`) permanece para os registros retidos e os agregados.
   */
  erase(caregiverId: ID): ErasureResult {
    const plan = this.plan(caregiverId);
    const caregiver = this.db.caregivers.require(caregiverId);
    const elder = this.db.elders.find((e) => e.caregiverId === caregiverId);
    const nowIso = this.clock.now();
    const today = this.clock.today();
    let erased = 0;

    erased += this.db.messages.removeWhere((m) => m.caregiverId === caregiverId);
    erased += this.db.wellbeingChecks.removeWhere((w) => w.caregiverId === caregiverId);
    // QA-006: a aplicação futura da escala não é registro documental (nada foi aplicado). Sem ela, o titular
    // eliminado não volta à fila do psicólogo nem ganha "próxima aplicação".
    erased += this.db.zaritAssessments.removeWhere(
      (z) => z.caregiverId === caregiverId && z.status !== 'completed',
    );
    erased += this.db.appUsage.removeWhere((u) => u.caregiverId === caregiverId);
    if (elder) {
      erased += this.db.medications.removeWhere((m) => m.elderId === elder.id);
      erased += this.db.careAppointments.removeWhere((a) => a.elderId === elder.id);
      this.db.elders.update(elder.id, {
        fullName: `Eliminado (${caregiver.code})`,
        birthDate: ERASED_DATE,
        conditionsSummary: undefined,
      });
      erased += 1;
    }
    this.db.caregivers.update(caregiverId, {
      fullName: `Titular eliminado (${caregiver.code})`,
      cpf: '000.000.000-00',
      email: `${caregiver.code.toLowerCase()}@exemplo.com.br`,
      phone: '(34) 90000-0000',
      whatsapp: undefined,
      sociodemographics: undefined,
      weeklyOrganizationHours: undefined,
      // Dados cadastrais que a lista "será eliminado" cobre (QA-006): sem eles não há elegibilidade ao piloto.
      birthDate: ERASED_DATE,
      city: '',
      dailyCareHours: 0,
      isPilot: false,
      status: 'closed',
      closedAt: today,
      erasedAt: nowIso,
    });
    erased += 1;
    // Assinatura encerrada e cartão inativado (RN-CRT-03).
    this.db.subscriptions.updateWhere(
      (s) => s.caregiverId === caregiverId && s.status !== 'cancelled',
      { status: 'cancelled' },
    );
    this.db.benefitCards.updateWhere(
      (c) => c.caregiverId === caregiverId && c.status === 'active',
      { status: 'inactive', inactivatedAt: today },
    );

    const blocked = this.blockDocumentaryRecords(caregiverId);
    this.audit.write(
      'delete',
      'caregiver_data',
      caregiverId,
      caregiverId,
      `eliminação: ${erased} registro(s) apagado(s), ${blocked} bloqueado(s)`,
    );
    return { plan, erasedRecords: erased, blockedRecords: blocked };
  }

  /**
   * Anonimiza: troca nome, CPF, e-mail e telefone por código e mantém a contagem nos agregados.
   * IRREVERSÍVEL (a interface pede confirmação).
   */
  anonymize(caregiverId: ID): void {
    const caregiver = this.db.caregivers.require(caregiverId);
    const code = caregiver.code || caregiverCode(0);
    this.db.caregivers.update(caregiverId, {
      fullName: code,
      cpf: '000.000.000-00',
      email: `${code.toLowerCase()}@exemplo.com.br`,
      phone: '(34) 90000-0000',
      whatsapp: undefined,
      sociodemographics: undefined,
      anonymizedAt: this.clock.now(),
    });
    const elder = this.db.elders.find((e) => e.caregiverId === caregiverId);
    if (elder) {
      this.db.elders.update(elder.id, {
        fullName: `Pessoa idosa de ${code}`,
        conditionsSummary: undefined,
      });
    }
    this.audit.write(
      'update',
      'caregiver_anonymization',
      caregiverId,
      caregiverId,
      'anonimização irreversível',
    );
  }

  /** Simula a passagem do tempo (LP-19): o que seria eliminado ou liberado na data `asOf`. */
  simulate(asOf: ISODate = this.clock.today()): RetentionSimulation {
    const cadastresToErase = this.db.caregivers
      .query(
        (c) =>
          c.status === 'closed' &&
          !c.erasedAt &&
          c.closedAt !== undefined &&
          isRetentionExpired(cadastreErasureDate(c.closedAt, CADASTRE_RETENTION_DAYS), asOf),
      )
      .map((c) => c.id);
    const expired = (block: RetentionBlock | undefined): boolean =>
      block !== undefined && isRetentionExpired(block.until, asOf);
    const cutoff = addYears(asOf, -ACCESS_LOG_RETENTION_YEARS);
    return {
      asOf,
      cadastresToErase,
      documentaryBlocksExpired: {
        zaritAssessments: this.db.zaritAssessments.count((r) => expired(r.retentionBlock)),
        zaritAlerts: this.db.zaritAlerts.count((r) => expired(r.retentionBlock)),
        arbeAlerts: this.db.arbeAlerts.count((r) => expired(r.retentionBlock)),
        sessionNotes: this.db.sessionNotes.count((r) => expired(r.retentionBlock)),
        occurrences: this.db.occurrences.count((r) => expired(r.retentionBlock)),
      },
      accessLogToDiscard: this.db.accessLog.count((l) => dateOf(l.at) < cutoff),
    };
  }

  /** `true` se o registro está bloqueado por retenção na data. */
  isBlocked(block: RetentionBlock | undefined, asOf: ISODate = this.clock.today()): boolean {
    return block !== undefined && !isRetentionExpired(block.until, asOf);
  }

  /** Data a partir da qual o cadastro encerrado deve ser eliminado. */
  cadastreErasureDueDate(closedAt: ISODate): ISODate {
    return addDays(closedAt, CADASTRE_RETENTION_DAYS);
  }

  private blockDocumentaryRecords(caregiverId: ID): number {
    const block: RetentionBlock = {
      until: retentionBlockUntil(this.clock.today()),
      basis: DOCUMENTARY_RETENTION_BASIS,
      blockedAt: this.clock.now(),
    };
    const sessionIds = new Set(
      this.db.careSessions.query((s) => s.caregiverId === caregiverId).map((s) => s.id),
    );
    let blocked = 0;
    blocked += this.db.zaritAssessments.updateWhere(
      (z) => z.caregiverId === caregiverId && z.status === 'completed',
      { retentionBlock: block },
    );
    blocked += this.db.zaritAlerts.updateWhere((a) => a.caregiverId === caregiverId, {
      retentionBlock: block,
    });
    blocked += this.db.arbeAlerts.updateWhere((a) => a.caregiverId === caregiverId, {
      retentionBlock: block,
    });
    blocked += this.db.sessionNotes.updateWhere((n) => sessionIds.has(n.sessionId), {
      retentionBlock: block,
    });
    blocked += this.db.occurrences.updateWhere((o) => o.caregiverId === caregiverId, {
      retentionBlock: block,
    });
    return blocked;
  }
}
