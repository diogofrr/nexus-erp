import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { Clock, addDays, compareDateTimes, toIsoDateTime } from '@core/clock';
import { Database } from '@core/data';
import { RiskCaseService } from '@core/governance';
import {
  Channel,
  ID,
  ISODate,
  Occurrence,
  ReferralCategory,
  ReviewRequest,
  RiskLevel,
  TimeOfDay,
  ZaritAlert,
  ZaritAssessment,
  ZaritBand,
} from '@core/models';
import { ConsentService } from '@core/privacy/consent.service';
import {
  checkRedAlertClosure,
  nextZaritDueDate,
  redAlertDeadline,
  validateReferral,
  validateZaritAnswers,
  zaritAlertLevel,
  zaritBand,
  zaritEvolution,
  zaritTotal,
  ZaritEvolution,
} from '@core/rules';
import { ArbeService } from './arbe.service';
import { CLOSURE_FIELD_LABELS } from './zarit-labels';
import { ZaritAccessService } from './zarit-access.service';

export interface FieldError {
  field: string;
  message: string;
}
export type OpResult<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

function fail<T>(field: string, message: string): OpResult<T> {
  return { ok: false, errors: [{ field, message }] };
}

/** Texto do estado sem consentimento (UX 5.15, RN-ZRT-07, RN-LGPD-14). */
export const NO_CONSENT_TEXT =
  'Sem consentimento de dados de saúde. Sem ele, não é possível aplicar a escala nem guardar rascunho.';

export interface ApplyResult {
  assessment: ZaritAssessment;
  total: number;
  band: ZaritBand;
  alert: ZaritAlert | null;
  occurrence: Occurrence | null;
  next: ZaritAssessment;
}

export interface ContactInput {
  date: ISODate;
  time: TimeOfDay;
  byUserId: ID;
  channel: Channel | '';
  note?: string;
}

export interface RiskInput {
  level: RiskLevel | '';
  note: string;
}

export interface ReferralInput {
  category: ReferralCategory;
  destinations: readonly string[];
  familyCommunicated?: boolean;
}

/**
 * Zarit e alertas (M06, RN-ZRT-01 a 26, RN-POP-05). Aplicar a escala cria, de uma vez e sem redigitação: a
 * aplicação assinada, a próxima aplicação (3 meses depois), o alerta amarelo ou vermelho e, no vermelho, a
 * ocorrência POP-05 com prazo até 23:59 do dia. Contato, avaliação de risco e encaminhamento alimentam os
 * passos da ocorrência (A-29). Tudo grava pelo `Database`; o sino, a Governança e o painel leem de lá.
 *
 * Escrever o escore no log nunca acontece: o `detail` só diz o que foi feito.
 */
@Injectable({ providedIn: 'root' })
export class ZaritService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly consent = inject(ConsentService);
  private readonly access = inject(ZaritAccessService);
  private readonly risk = inject(RiskCaseService);
  private readonly arbe = inject(ArbeService);

  // ===== Leitura =====

  consentGranted(caregiverId: ID): boolean {
    return this.consent.isActive(caregiverId, 'health_data');
  }

  /** Aplicações concluídas, da adesão à mais recente. */
  completedOf(caregiverId: ID): ZaritAssessment[] {
    return this.db.zaritAssessments
      .query((z) => z.caregiverId === caregiverId && z.status === 'completed')
      .sort((a, b) => a.sequence - b.sequence || (a.appliedAt ?? '').localeCompare(b.appliedAt ?? ''));
  }

  /** Próxima aplicação agendada (a de vencimento mais próximo). */
  pendingOf(caregiverId: ID): ZaritAssessment | undefined {
    return this.db.zaritAssessments
      .query((z) => z.caregiverId === caregiverId && z.status === 'scheduled')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  }

  /** Evolução da última aplicação em relação à adesão (RN-ZRT-16, 17). */
  evolutionOf(caregiverId: ID): ZaritEvolution | null {
    const done = this.completedOf(caregiverId);
    const first = done[0];
    const last = done.at(-1);
    if (!first || !last || first.total === undefined || last.total === undefined) {
      return null;
    }
    return done.length < 2 ? { kind: 'reference', display: 'referência' } : zaritEvolution(first.total, last.total);
  }

  /** Quando é a próxima aplicação: a agendada ou 3 meses depois da última (RN-ZRT-05). */
  nextDueDate(caregiverId: ID): ISODate | null {
    const pending = this.pendingOf(caregiverId);
    if (pending) {
      return pending.dueDate;
    }
    const last = this.completedOf(caregiverId).at(-1);
    return last?.appliedAt ? nextZaritDueDate(last.appliedAt) : null;
  }

  alertsOf(caregiverId: ID): ZaritAlert[] {
    return this.db.zaritAlerts
      .query((a) => a.caregiverId === caregiverId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ===== Aplicar (F05) =====

  /**
   * Conclui a aplicação. O total e a faixa são calculados aqui (RN-ZRT-03), nunca digitados. Sem consentimento
   * de saúde não grava nada (RN-ZRT-07). Resultado de 41 a 60 cria alerta amarelo; de 61 a 88, alerta vermelho
   * com prazo 23:59 de hoje e ocorrência POP-05.
   */
  apply(caregiverId: ID, answers: readonly number[]): OpResult<ApplyResult> {
    if (!this.access.canApply(caregiverId)) {
      return fail('access', 'Só o psicólogo do caso aplica a escala.');
    }
    const caregiver = this.db.caregivers.get(caregiverId);
    if (!caregiver || caregiver.status !== 'active' || !this.consentGranted(caregiverId)) {
      return fail('consent', NO_CONSENT_TEXT);
    }
    const check = validateZaritAnswers(answers);
    if (!check.valid) {
      return fail('answers', check.errors.join(' '));
    }
    const psychologistId = caregiver.assignedPsychologistId as ID;
    const total = zaritTotal(answers);
    const band = zaritBand(total);
    const level = zaritAlertLevel(total);
    const today = this.clock.today();
    const now = this.clock.now();
    const pending = this.pendingOf(caregiverId);
    const sequence = pending ? pending.sequence : this.completedOf(caregiverId).length;
    const filled = {
      psychologistId,
      kind: sequence === 0 ? ('enrollment' as const) : ('quarterly' as const),
      appliedAt: today,
      answers: [...answers],
      total,
      band,
      status: 'completed' as const,
      signedAt: now,
      addenda: [],
    };
    const assessment = pending
      ? this.db.zaritAssessments.update(pending.id, filled)
      : this.db.zaritAssessments.create({ caregiverId, sequence, dueDate: today, ...filled });
    this.audit.write('create', 'zarit_assessment', assessment.id, caregiverId, 'aplicação da escala concluída');

    const next = this.db.zaritAssessments.create({
      caregiverId,
      psychologistId,
      kind: 'quarterly',
      sequence: sequence + 1,
      dueDate: nextZaritDueDate(today),
      status: 'scheduled',
      addenda: [],
    });

    let alert: ZaritAlert | null = null;
    let occurrence: Occurrence | null = null;
    if (level) {
      alert = this.db.zaritAlerts.create({
        assessmentId: assessment.id,
        caregiverId,
        level,
        status: 'open',
        referralIds: [],
        ...(level === 'red' ? { deadlineAt: redAlertDeadline(today) } : { supportNetworkReviewDone: false }),
      });
      this.audit.write('create', 'zarit_alert', alert.id, caregiverId, `alerta ${level === 'red' ? 'vermelho' : 'amarelo'} criado`);
      if (level === 'red') {
        occurrence = this.risk.openPop05({ caregiverId, sourceAlertId: alert.id, at: now });
        alert = this.db.zaritAlerts.update(alert.id, { occurrenceId: occurrence.id });
      }
    }
    // A combinação das horas, dos pedidos de apoio e da nova pontuação pode gerar ou mudar o alerta de esgotamento.
    this.arbe.evaluateCaregiver(caregiverId);
    return { ok: true, value: { assessment, total, band, alert, occurrence, next } };
  }

  /** Adendo à aplicação assinada: o resultado original nunca é editado (RN-ZRT-21). */
  addAddendum(assessmentId: ID, content: string): OpResult<ZaritAssessment> {
    const assessment = this.db.zaritAssessments.get(assessmentId);
    if (!assessment || assessment.status !== 'completed') {
      return fail('addendum', 'O adendo vale só para uma aplicação concluída.');
    }
    if (!this.access.canApply(assessment.caregiverId)) {
      return fail('addendum', 'Só o psicólogo do caso adiciona adendo.');
    }
    if (content.trim().length < 3) {
      return fail('addendum', 'Escreva o adendo antes de salvar.');
    }
    const updated = this.db.zaritAssessments.update(assessmentId, {
      addenda: [...assessment.addenda, { at: this.clock.now(), content: content.trim() }],
    });
    this.audit.write('update', 'zarit_assessment', assessmentId, assessment.caregiverId, 'adendo à aplicação');
    return { ok: true, value: updated };
  }

  // ===== Alerta: contato, risco, encaminhamento, encerramento (F06) =====

  private alertGuard(alertId: ID): { alert: ZaritAlert } | { error: OpResult<never> } {
    const alert = this.db.zaritAlerts.get(alertId);
    if (!alert) {
      return { error: fail('alert', 'Alerta não encontrado.') };
    }
    if (!this.access.canAct(alert.caregiverId)) {
      return { error: fail('alert', 'Só o psicólogo do caso e o responsável técnico tratam este alerta.') };
    }
    if (alert.status === 'closed') {
      return { error: fail('alert', 'O alerta já foi encerrado. Só é possível adicionar adendo.') };
    }
    return { alert };
  }

  /**
   * Registra o contato (hora, quem fez, canal e anotação). O horário não pode ser depois de agora. O cronômetro
   * para; contato depois do prazo das 23:59 fica no histórico como atraso. Alimenta os passos 1 e 2 da ocorrência.
   */
  registerContact(alertId: ID, input: ContactInput): OpResult<{ alert: ZaritAlert; late: boolean }> {
    const guarded = this.alertGuard(alertId);
    if ('error' in guarded) {
      return guarded.error;
    }
    const { alert } = guarded;
    if (alert.contact) {
      return fail('contact', 'O contato deste alerta já foi registrado.');
    }
    const errors: FieldError[] = [];
    if (!/^\d{2}:\d{2}$/.test(input.time)) {
      errors.push({ field: 'time', message: 'Informe o horário do contato.' });
    }
    const by = this.db.users.get(input.byUserId);
    if (!by || (by.role !== 'psychologist' && by.role !== 'technical_lead')) {
      errors.push({ field: 'by', message: 'Informe quem fez o contato.' });
    }
    if (!input.channel) {
      errors.push({ field: 'channel', message: 'Escolha o canal do contato.' });
    }
    let at = '';
    if (errors.length === 0) {
      at = toIsoDateTime(input.date, input.time);
      if (compareDateTimes(at, this.clock.now()) > 0) {
        errors.push({ field: 'time', message: 'O horário do contato não pode ser depois de agora.' });
      }
    }
    if (errors.length > 0 || !input.channel) {
      return { ok: false, errors };
    }
    const updated = this.db.zaritAlerts.update(alertId, {
      status: 'contacted',
      contact: {
        at,
        byUserId: input.byUserId,
        channel: input.channel,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
    });
    this.audit.write('update', 'zarit_alert', alertId, alert.caregiverId, 'contato registrado');
    if (alert.occurrenceId) {
      this.risk.stepDone(alert.occurrenceId, 1, { byUserId: input.byUserId, at, note: 'Acolhimento no primeiro contato.' });
      this.risk.stepDone(alert.occurrenceId, 2, {
        byUserId: input.byUserId,
        at,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      });
    }
    const late = !!alert.deadlineAt && compareDateTimes(at, alert.deadlineAt) > 0;
    return { ok: true, value: { alert: updated, late } };
  }

  /** Avaliação de risco (nível e nota obrigatórios). Vem depois do contato. Alimenta o passo 3 da ocorrência. */
  registerRisk(alertId: ID, input: RiskInput): OpResult<ZaritAlert> {
    const guarded = this.alertGuard(alertId);
    if ('error' in guarded) {
      return guarded.error;
    }
    const { alert } = guarded;
    if (!alert.contact) {
      return fail('risk', 'Registre o contato antes da avaliação de risco.');
    }
    const errors: FieldError[] = [];
    if (!input.level) {
      errors.push({ field: 'riskLevel', message: 'Escolha o nível: baixo, moderado ou alto.' });
    }
    if (input.note.trim().length < 3) {
      errors.push({ field: 'riskNote', message: 'Escreva a nota da avaliação de risco.' });
    }
    if (errors.length > 0 || !input.level) {
      return { ok: false, errors };
    }
    const now = this.clock.now();
    const byUserId = this.access.actorUserId();
    const updated = this.db.zaritAlerts.update(alertId, {
      status: 'risk_assessed',
      riskAssessment: { at: now, byUserId, level: input.level, note: input.note.trim() },
    });
    this.audit.write('update', 'zarit_alert', alertId, alert.caregiverId, 'avaliação de risco registrada');
    if (alert.occurrenceId) {
      this.risk.stepDone(alert.occurrenceId, 3, { byUserId, at: now, note: 'Avaliação de risco registrada pelo psicólogo.' });
    }
    return { ok: true, value: updated };
  }

  /** Encaminhamento (Quadro 12): grava em `referrals`, liga ao alerta e alimenta os passos 4 e 5 da ocorrência. */
  registerReferral(alertId: ID, input: ReferralInput): OpResult<ZaritAlert> {
    const guarded = this.alertGuard(alertId);
    if ('error' in guarded) {
      return guarded.error;
    }
    const { alert } = guarded;
    const check = validateReferral(input.category, input.destinations, input.familyCommunicated);
    if (!check.valid) {
      return fail('referral', input.destinations.length === 0 ? 'Escolha ao menos um destino do encaminhamento.' : check.errors.join(' '));
    }
    const byUserId = this.access.actorUserId();
    const elder = this.db.elders.find((e) => e.caregiverId === alert.caregiverId);
    const referral = this.risk.registerReferral({
      caregiverId: alert.caregiverId,
      category: input.category,
      destinations: input.destinations,
      byUserId,
      ...(alert.occurrenceId ? { occurrenceId: alert.occurrenceId } : {}),
      ...(elder ? { elderId: elder.id } : {}),
      ...(input.familyCommunicated !== undefined ? { familyCommunicated: input.familyCommunicated } : {}),
    });
    const updated = this.db.zaritAlerts.update(alertId, { referralIds: [...alert.referralIds, referral.id] });
    if (alert.occurrenceId) {
      this.risk.stepDone(alert.occurrenceId, 4, {
        byUserId,
        note: 'Encaminhamento registrado. Em emergência, SAMU 192; CVV 188.',
      });
      if (this.lastSessionWasRemote(alert.caregiverId)) {
        this.risk.stepDone(alert.occurrenceId, 5, {
          byUserId,
          note: 'Atendimento remoto: encaminhar à rede presencial (Res. CFP 9/2024).',
        });
      }
    }
    return { ok: true, value: updated };
  }

  private lastSessionWasRemote(caregiverId: ID): boolean {
    const last = this.db.careSessions
      .query((s) => s.caregiverId === caregiverId && s.status === 'done')
      .sort((a, b) => b.startAt.localeCompare(a.startAt))[0];
    return last?.modality === 'online';
  }

  /** Campos que ainda faltam para encerrar o vermelho, em texto (AC-M06-06): "nível e nota da avaliação de risco". */
  missingForClosure(alert: ZaritAlert): string[] {
    if (alert.level !== 'red') {
      return alert.supportNetworkReviewDone ? [] : ['a revisão da rede de apoio'];
    }
    const check = checkRedAlertClosure(alert, alert.riskAssessment?.level === 'high');
    return check.missing.map((field) => CLOSURE_FIELD_LABELS[field]);
  }

  /**
   * Encerra o alerta. O vermelho não encerra sem horário do contato, quem fez, avaliação de risco e, se o risco
   * for alto, o encaminhamento (RN-ZRT-15). Depois de encerrado, só adendo. No vermelho, grava o passo 6 da ocorrência.
   */
  closeAlert(alertId: ID, note?: string): OpResult<ZaritAlert> {
    const guarded = this.alertGuard(alertId);
    if ('error' in guarded) {
      return guarded.error;
    }
    const { alert } = guarded;
    const missing = this.missingForClosure(alert);
    if (missing.length > 0) {
      return fail('close', `Falta: ${missing.join(', ')}.`);
    }
    const now = this.clock.now();
    const byUserId = this.access.actorUserId();
    const updated = this.db.zaritAlerts.update(alertId, {
      status: 'closed',
      closedAt: now,
      closureNote: note?.trim() || 'Alerta encerrado pelo psicólogo do caso.',
    });
    this.audit.write('update', 'zarit_alert', alertId, alert.caregiverId, 'alerta encerrado');
    if (alert.occurrenceId) {
      const occurrence = this.db.occurrences.get(alert.occurrenceId);
      const done = (n: number): boolean => !!occurrence?.steps.find((s) => s.n === n)?.doneAt;
      if (!done(4)) {
        this.risk.stepDone(alert.occurrenceId, 4, { byUserId, at: now, note: 'Encaminhamento não foi necessário neste caso.' });
      }
      if (!done(5)) {
        this.risk.stepDone(alert.occurrenceId, 5, { byUserId, at: now, note: 'Não se aplica: o atendimento não era remoto.' });
      }
      this.risk.stepDone(alert.occurrenceId, 6, { byUserId, at: now, note: 'Alerta encerrado com os registros completos.' });
    }
    return { ok: true, value: updated };
  }

  /** Amarelo: a tarefa "revisar rede de apoio da família" foi feita (RN-ZRT-12). */
  completeSupportReview(alertId: ID): OpResult<ZaritAlert> {
    const guarded = this.alertGuard(alertId);
    if ('error' in guarded) {
      return guarded.error;
    }
    const { alert } = guarded;
    if (alert.level !== 'yellow') {
      return fail('review', 'A revisão da rede de apoio é do alerta amarelo.');
    }
    const updated = this.db.zaritAlerts.update(alertId, { supportNetworkReviewDone: true });
    this.audit.write('update', 'zarit_alert', alertId, alert.caregiverId, 'revisão da rede de apoio feita');
    return { ok: true, value: updated };
  }

  // ===== Pedidos de revisão (RN-ZRT-20) =====

  /** Registra o pedido do cuidador para rever uma decisão. Prazo e resposta ficam registrados. */
  registerReviewRequest(caregiverId: ID, about: ReviewRequest['about'], text: string): OpResult<ReviewRequest> {
    const caregiver = this.db.caregivers.get(caregiverId);
    if (!caregiver || !this.access.canAct(caregiverId)) {
      return fail('caregiver', 'Escolha um cuidador que você acompanha.');
    }
    if (text.trim().length < 5) {
      return fail('text', 'Escreva o pedido do cuidador.');
    }
    const request = this.db.reviewRequests.create({
      caregiverId,
      psychologistId: caregiver.assignedPsychologistId as ID,
      about,
      text: text.trim(),
      dueAt: addDays(this.clock.today(), this.db.settings.get().dsrDeadlineDays),
    });
    this.audit.write('create', 'review_request', request.id, caregiverId, 'pedido de revisão registrado');
    return { ok: true, value: request };
  }

  answerReview(requestId: ID, answer: string): OpResult<ReviewRequest> {
    const request = this.db.reviewRequests.get(requestId);
    if (!request || !this.access.canAct(request.caregiverId)) {
      return fail('request', 'Só o psicólogo do caso responde ao pedido.');
    }
    if (request.answeredAt) {
      return fail('answer', 'Este pedido já foi respondido.');
    }
    if (answer.trim().length < 5) {
      return fail('answer', 'Escreva a resposta ao cuidador.');
    }
    const updated = this.db.reviewRequests.update(requestId, {
      answer: answer.trim(),
      answeredAt: this.clock.now(),
    });
    this.audit.write('update', 'review_request', requestId, request.caregiverId, 'pedido de revisão respondido');
    return { ok: true, value: updated };
  }
}
