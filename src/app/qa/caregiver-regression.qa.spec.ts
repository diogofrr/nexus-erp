/**
 * Testes de regressão do QA do aplicativo do cuidador (`docs/13-qa-cuidador.md`).
 *
 * Convenções:
 * - Teste sem marca guarda um comportamento que o QA verificou e que não pode regredir.
 * - `it.fails(...)` com o comentário `QAC-NNN` guarda o comportamento CORRETO de um bug confirmado: a suíte continua
 *   verde e, quando o bug for corrigido, o teste passa a falhar (aí se tira o `.fails`). Os bugs de regra, serviço e dado
 *   (QAC-001 a 008 e 013 a 015) foram corrigidos na rodada do Fix A (`docs/15-correcoes-cuidador-a.md`) e seus testes
 *   perderam o `.fails`: agora validam o comportamento certo. Os de experiência (009, 010, 011) seguem com `.fails`.
 * - Só serviços e regras (sem tela). As varreduras de tela estão em `caregiver-ui.qa.spec.ts`.
 * - Dados 100% fictícios do seed. Nenhum teste toca em código de produção.
 */
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthService, TWO_FACTOR_CODE } from '../core/auth/auth.service';
import { CaregiverSessionService } from '../core/auth/caregiver-session.service';
import { CaregiverMessagesService } from '../core/care/caregiver-messages.service';
import { DoseCheckService } from '../core/care/dose-check.service';
import { ReviewRequestService } from '../core/care/review-request.service';
import { SessionBookingService } from '../core/care/session-booking.service';
import { WellbeingCheckService } from '../core/care/wellbeing-check.service';
import { Clock } from '../core/clock/clock.service';
import { SubscriptionService } from '../core/commerce/subscription.service';
import { Database } from '../core/data/database';
import { planIdOfCaregiver } from '../core/data/plan-lookup';
import { CaregiverActivitiesService } from '../core/groups/caregiver-activities.service';
import { CaregiverNetworkService } from '../core/network/caregiver-network.service';
import { ConsentService } from '../core/privacy/consent.service';
import { DataSubjectRequestService } from '../core/privacy/data-subject-request.service';
import { RetentionService } from '../core/privacy/retention.service';
import { SubjectRightsService } from '../core/privacy/subject-rights.service';
import { configureCoreTest } from '../core/testing/test-helpers';
import { CaregiverPlanService } from '../features/caregiver-app/plan/state/caregiver-plan.service';
import { ConversationsService } from '../features/caregiver-app/care/state/conversations.service';
import { AgendaService } from '../features/caregiver-app/routine/state/agenda.service';
import { MedicationService } from '../features/caregiver-app/routine/state/medication.service';
import { CaregiverContextService } from '../features/caregiver-app/state/caregiver-context.service';
import { ProfileService } from '../features/caregiver-app/start/state/profile.service';
import { WellbeingViewService } from '../features/caregiver-app/my-wellbeing/state/wellbeing-view.service';
import { PrivacyService } from '../features/caregiver-app/privacy/state/privacy.service';
import { phoneClosedNote } from '../features/caregiver-app/state/nexus-contact';

const ANA = 'cg_0001';
const MARIA = 'cg_0002';
const JOAO = 'cg_0003';
const RITA = 'cg_0008';
const ELZA = 'cg_0027';
const LOURDES = 'cg_0024';
const MARCOS = 'cg_0026';
const SONIA = 'cg_0016';
const RAIMUNDA = 'cg_0018';

/** Sobe o núcleo com o seed, o relógio simulado e (opcionalmente) a sessão de um cuidador. */
/**
 * O seed é gerado em relação a "hoje" (2026-11-04, quarta). `today` e `time` movem o relógio DEPOIS de gerar, para
 * os dados do seed ficarem como na demonstração e o teste poder olhar 24 horas antes, a virada do dia etc.
 */
function boot(caregiverId: string | null, options: { today?: string; time?: string; seedToday?: string } = {}) {
  const env = configureCoreTest({ seed: true, today: options.seedToday ?? "2026-11-04", time: "12:00" });
  if (options.today || options.time) {
    env.clock.setSimulated(options.today ?? "2026-11-04", options.time ?? "12:00");
  }
  if (caregiverId) {
    const outcome = TestBed.inject(CaregiverSessionService).signIn(caregiverId);
    if (outcome.status !== 'ok') {
      throw new Error(`não entrou: ${outcome.reason}`);
    }
  }
  return env;
}

function staffLogin(userId: string): void {
  const auth = TestBed.inject(AuthService);
  if (auth.selectProfile(userId).status === 'needs_two_factor') {
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
  }
}

/** Um horário aberto de psicólogo com registro ativo, sem prioridade e a pelo menos 2 dias de distância. */
function openSlot(db: Database, notPriority = true) {
  const slot = db.availabilitySlots
    .query((s) => s.status === 'open' && (!notPriority || !s.priorityOnly))
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0];
  if (!slot) {
    throw new Error('sem vaga aberta no seed');
  }
  return slot;
}

// ===========================================================================================================
// 2. Autorização no nível do objeto
// ===========================================================================================================
describe('QAC: autorização no nível do objeto (serviços chamados direto)', () => {
  it('rede: cancelar, avaliar e corrigir pedido de OUTRO cuidador é recusado e nada muda', () => {
    const { db } = boot(ANA);
    const network = TestBed.inject(CaregiverNetworkService);
    const rita = db.serviceRequests.require('srq_0126'); // concluído, sem avaliação, de Rita
    const elza = db.serviceRequests.require('srq_0197'); // enviado, de Elza
    expect(network.cancelRequest(ANA, elza.id).ok).toBe(false);
    expect(db.serviceRequests.require(elza.id).status).toBe('requested');
    expect(network.evaluate(ANA, rita.id, { technical: 5, punctuality: 5 }).ok).toBe(false);
    expect(db.serviceRequests.require(rita.id).status).toBe('completed');
    expect(network.correctEvaluation(ANA, 'srq_0086', { technical: 1, punctuality: 1 }).ok).toBe(false);
    expect(db.providerEvaluations.require('evl_0086').technicalQuality).not.toBe(1);
  });

  it('grupos: sair da inscrição de outro cuidador é recusado; plano Essencial não entra na terapia de grupo (docs/20)', () => {
    const { db } = boot(MARIA);
    const activities = TestBed.inject(CaregiverActivitiesService);
    expect(activities.leave(MARIA, 'enr_0001').ok).toBe(false); // inscrição de Ana
    expect(db.activityEnrollments.require('enr_0001').status).toBe('enrolled');
    const locked = activities.enroll(MARIA, 'act_0008', { contractAccepted: true }); // terapia de grupo: Cuida e Sustenta
    expect(locked.ok).toBe(false);
    expect(db.activityEnrollments.count((e) => e.caregiverId === MARIA && e.activityId === 'act_0008')).toBe(0);
  });

  it('rascunho, cancelada e finalizada não aparecem como atividade visível', () => {
    boot(ANA);
    const activities = TestBed.inject(CaregiverActivitiesService);
    ['act_0007', 'act_0006', 'act_0005', 'act_9999'].forEach((id) => expect(activities.visible(id), id).toBeUndefined());
    expect(activities.visible('act_0002')).toBeDefined();
    expect(activities.programme().map((a) => a.id)).not.toContain('act_0007');
  });

  it('terapia de grupo em andamento não aceita entrada nova (as inscrições estão encerradas)', () => {
    const { db } = boot(ANA);
    const outcome = TestBed.inject(CaregiverActivitiesService).enroll(ANA, 'act_0003', { contractAccepted: true });
    expect(outcome.ok).toBe(false);
    expect(db.activityEnrollments.count((e) => e.caregiverId === ANA && e.activityId === 'act_0003')).toBe(0);
  });

  it('pedido de dados: retirar o pedido de outro titular é recusado', () => {
    boot(ANA);
    const result = TestBed.inject(SubjectRightsService).withdraw(ANA, 'dsr_0005');
    expect(result.ok).toBe(false);
  });

  // QAC-001: os serviços de gravação do núcleo e das áreas confiam no id recebido. Com a sessão da Ana aberta, uma
  // chamada direta grava no registro de outra pessoa. O esperado é recusar (ou ler a sessão, não o parâmetro).
  it('QAC-001a: com a sessão da Ana, marcar dose de remédio da Maria é recusado', () => {
    const { db } = boot(ANA);
    const med = db.medications.find((m) => m.elderId === db.elders.find((e) => e.caregiverId === MARIA)?.id);
    expect(med).toBeDefined();
    const before = db.doseChecks.count();
    let threw = false;
    try {
      TestBed.inject(DoseCheckService).mark(med!.id, '2026-11-04', med!.times[0]!);
    } catch {
      threw = true;
    }
    expect(threw || db.doseChecks.count() === before).toBe(true);
    expect(db.doseChecks.count()).toBe(before);
  });

  it('QAC-001b: com a sessão da Ana, editar remédio e tirar compromisso da pessoa idosa da Maria é recusado', () => {
    const { db } = boot(ANA);
    const mariaElder = db.elders.find((e) => e.caregiverId === MARIA)!;
    const med = db.medications.find((m) => m.elderId === mariaElder.id)!;
    const appt = db.careAppointments.find((a) => a.elderId === mariaElder.id)!;
    let medicationChanged = false;
    let appointmentRemoved = false;
    try {
      TestBed.inject(MedicationService).update(med.id, { name: 'Alterado por outra pessoa', dosage: '', times: med.times, active: false });
      medicationChanged = db.medications.require(med.id).name === 'Alterado por outra pessoa';
    } catch {
      medicationChanged = false;
    }
    try {
      TestBed.inject(AgendaService).remove(appt.id);
      appointmentRemoved = !db.careAppointments.exists(appt.id);
    } catch {
      appointmentRemoved = false;
    }
    expect(medicationChanged).toBe(false);
    expect(appointmentRemoved).toBe(false);
  });

  it('QAC-001c: com a sessão da Ana, cancelar a conversa da Lourdes pelo serviço da tela é recusado', () => {
    const { db } = boot(ANA);
    const conversations = TestBed.inject(ConversationsService);
    const mine = conversations.next();
    expect(mine).not.toBeNull();
    // Objeto montado à mão: é da Ana (isMine passa), mas o id é da sessão da Lourdes.
    const forged = { ...mine!, id: 'ses_0062' };
    const result = conversations.cancel(forged);
    expect(result.ok).toBe(false);
    expect(db.careSessions.require('ses_0062').status).toBe('confirmed');
  });

  it('QAC-001d: o serviço de agendar/cancelar do núcleo cancela sessão de outra pessoa quando chamado direto', () => {
    const { db } = boot(ANA);
    // Quem chama é "responsável pela permissão" (docs/11): aqui ninguém conferiu o dono.
    const result = TestBed.inject(SessionBookingService).cancel('ses_0062', 'user');
    expect(result.ok).toBe(false);
    expect(db.careSessions.require('ses_0062').status).toBe('confirmed');
  });

  it('QAC-001e: com a sessão da Ana, mandar mensagem como a Maria e pedir a eliminação da Maria é recusado', () => {
    const { db } = boot(ANA);
    const messages = TestBed.inject(CaregiverMessagesService);
    const before = db.messages.count((m) => m.caregiverId === MARIA);
    messages.send(MARIA, { subject: 'x', body: 'texto escrito pela sessão da Ana' });
    TestBed.inject(SubjectRightsService).requestErasure(MARIA);
    expect(db.messages.count((m) => m.caregiverId === MARIA)).toBe(before);
    expect(db.caregivers.require(MARIA).status).toBe('active');
  });

  it('QAC-001f: com a sessão da Ana, revogar a autorização de saúde da Maria é recusado', () => {
    const { db } = boot(ANA);
    try {
      TestBed.inject(ConsentService).revoke(MARIA, 'health_data', { channel: 'app', registeredByUserId: ANA });
    } catch {
      /* recusar lançando também vale */
    }
    expect(db.consents.find((c) => c.caregiverId === MARIA && c.key === 'health_data')?.status).toBe('granted');
    expect(db.caregivers.require(MARIA).status).toBe('active');
  });

  it('o serviço de plano do cuidador só age sobre a assinatura da própria sessão', () => {
    const { db } = boot(MARIA);
    const mariaSub = db.subscriptions.find((s) => s.caregiverId === MARIA)!;
    const anaSub = db.subscriptions.find((s) => s.caregiverId === ANA)!;
    const result = TestBed.inject(CaregiverPlanService).confirm('cuida', { emergencyAccepted: true });
    expect(result.ok).toBe(true);
    expect(db.subscriptions.require(mariaSub.id).planId).toBe('cuida');
    expect(db.subscriptions.require(anaSub.id).planId).toBe('cuida'); // já era
    expect(db.subscriptions.require(anaSub.id).status).toBe('active');
  });
});

// ===========================================================================================================
// 3. Sessão: o que a sessão de cuidador nunca pode fazer na equipe
// ===========================================================================================================
describe('QAC: a sessão do cuidador não tem poder de equipe', () => {
  it('a sessão do cuidador não é perfil da equipe: nenhuma permissão, nenhum papel', () => {
    boot(ANA);
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.role()).toBeNull();
    expect(auth.can('zarit_individual', 'view')).toBe(false);
    expect(auth.can('lgpd_audit_log', 'view')).toBe(false);
  });

  it('entrar como cuidador encerra a sessão da equipe, e entrar na equipe encerra a do cuidador', () => {
    boot(null);
    const auth = TestBed.inject(AuthService);
    const caregivers = TestBed.inject(CaregiverSessionService);
    staffLogin('u7');
    expect(auth.isAuthenticated()).toBe(true);
    expect(caregivers.signIn(ANA).status).toBe('ok');
    expect(auth.session()).toBeNull();
    expect(caregivers.isSignedIn()).toBe(true);
    staffLogin('u1');
    expect(caregivers.isSignedIn()).toBe(false);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('cadastro encerrado, anonimizado, eliminado ou inexistente não entra; pedido de exclusão e pausado entram', () => {
    const { db } = boot(null);
    const session = TestBed.inject(CaregiverSessionService);
    db.caregivers.update('cg_0010', { status: 'closed' });
    db.caregivers.update('cg_0011', { anonymizedAt: '2026-11-01T10:00:00-03:00' });
    db.caregivers.update('cg_0012', { erasedAt: '2026-11-01T10:00:00-03:00' });
    expect(session.signIn('cg_0010').status).toBe('denied');
    expect(session.signIn('cg_0011').status).toBe('denied');
    expect(session.signIn('cg_0012').status).toBe('denied');
    expect(session.signIn('cg_9999').status).toBe('denied');
    expect(session.signIn(RAIMUNDA).status).toBe('ok');
    expect(session.signIn(SONIA).status).toBe('ok');
  });

  it('a sessão que deixa de poder entrar (cadastro encerrado no meio do uso) vira "sem sessão" na hora', () => {
    const { db } = boot(ANA);
    const context = TestBed.inject(CaregiverContextService);
    expect(context.isSignedIn()).toBe(true);
    db.caregivers.update(ANA, { status: 'closed' });
    expect(context.isSignedIn()).toBe(false);
    expect(context.caregiverId()).toBeNull();
  });
});

// ===========================================================================================================
// 5. Autorização de saúde (RN-LGPD-14) na borda do serviço
// ===========================================================================================================
describe('QAC: autorização de saúde revogada (Sônia) na borda do serviço', () => {
  it('registrar humor sem a autorização é recusado no serviço', () => {
    const { db } = boot(SONIA);
    expect(() => TestBed.inject(WellbeingCheckService).record(SONIA, 3)).toThrow();
    expect(db.wellbeingChecks.count((w) => w.caregiverId === SONIA)).toBe(0);
  });

  it('o contato da equipe vale "none" sem a autorização, mesmo com alerta vermelho aberto', () => {
    const { db } = boot(SONIA);
    db.zaritAlerts.create({
      assessmentId: db.zaritAssessments.find((z) => z.caregiverId === SONIA)!.id,
      caregiverId: SONIA,
      level: 'red',
      status: 'open',
      deadlineAt: '2026-11-04T23:59:00-03:00',
      referralIds: [],
    });
    expect(TestBed.inject(CaregiverContextService).staffContact()).toBe('none');
  });

  it('retirar a autorização de saúde: cadastro pausado, alertas abertos encerrados, vaga prioritária some', () => {
    const { db } = boot(RITA);
    expect(db.zaritAlerts.count((a) => a.caregiverId === RITA && a.status !== 'closed')).toBeGreaterThan(0);
    const booking = TestBed.inject(SessionBookingService);
    expect(booking.canSeePriority(RITA)).toBe(true); // Cuida
    const outcome = TestBed.inject(PrivacyService).revoke('health_data');
    expect(outcome.ok).toBe(true);
    expect(db.caregivers.require(RITA).status).toBe('paused_by_consent_revocation');
    expect(db.zaritAlerts.count((a) => a.caregiverId === RITA && a.status !== 'closed')).toBe(0);
    expect(TestBed.inject(CaregiverContextService).healthConsent()).toBe(false);
    const history = TestBed.inject(ConsentService).history(RITA, 'health_data');
    expect(history.at(-1)).toMatchObject({ status: 'revoked', channel: 'app', registeredByUserId: RITA });
  });

  it('autorizar de novo religa: cadastro ativo, humor volta a gravar', () => {
    const { db } = boot(SONIA);
    expect(TestBed.inject(WellbeingViewService).authorizeAgain().ok).toBe(true);
    expect(db.caregivers.require(SONIA).status).toBe('active');
    expect(TestBed.inject(WellbeingCheckService).record(SONIA, 4).mood).toBe(4);
  });

  it('retirar saúde e pedir eliminação juntos: voltar atrás devolve o estado certo (pausado, não ativo)', () => {
    const { db } = boot(MARIA);
    TestBed.inject(PrivacyService).requestErasure();
    expect(db.caregivers.require(MARIA).status).toBe('closure_requested');
    TestBed.inject(PrivacyService).revoke('health_data');
    const pending = TestBed.inject(PrivacyService).pendingOf('erasure')!;
    expect(TestBed.inject(PrivacyService).withdraw(pending.id).ok).toBe(true);
    expect(db.caregivers.require(MARIA).status).toBe('paused_by_consent_revocation');
  });

  // QAC-002: só `record` confere a autorização. A leitura do humor e da linha do tempo não, então quem monta a tela
  // (ou outra tela futura) lê dado de saúde de quem retirou a autorização.
  it('QAC-002a: com a autorização retirada, a leitura do humor do dia devolve nada', () => {
    const { db } = boot(MARIA);
    const wellbeing = TestBed.inject(WellbeingCheckService);
    wellbeing.record(MARIA, 2);
    expect(wellbeing.forDay(MARIA, '2026-11-04')).toBeDefined();
    TestBed.inject(ConsentService).revoke(MARIA, 'health_data', { channel: 'app', registeredByUserId: MARIA });
    expect(db.consents.find((c) => c.caregiverId === MARIA && c.key === 'health_data')?.status).toBe('revoked');
    expect(wellbeing.forDay(MARIA, '2026-11-04')).toBeUndefined();
  });

  it('QAC-002b: com a autorização retirada, o serviço de "Como estou" não devolve a linha do tempo da escala', () => {
    boot(SONIA);
    const view = TestBed.inject(WellbeingViewService);
    expect(TestBed.inject(CaregiverContextService).healthConsent()).toBe(false);
    expect(view.timeline()).toEqual([]);
    expect(view.lastText()).toBeNull();
    expect(view.nextText()).toBeNull();
  });

  it('QAC-002c: sem a autorização, registrar pedido de revisão de decisão da escala é recusado no serviço', () => {
    const { db } = boot(SONIA);
    const before = db.reviewRequests.count((r) => r.caregiverId === SONIA);
    const result = TestBed.inject(ReviewRequestService).register(SONIA, 'zarit_decision', 'Quero rever a decisão tomada.');
    expect(result.ok).toBe(false);
    expect(db.reviewRequests.count((r) => r.caregiverId === SONIA)).toBe(before);
  });
});

// ===========================================================================================================
// 6. Plano
// ===========================================================================================================
describe('QAC: plano', () => {
  it('upgrade vale na hora, o cartão segue ativo, o aceite do aviso é gravado e a troca fica em nome do cuidador', () => {
    const { db } = boot(MARIA);
    const plan = TestBed.inject(CaregiverPlanService);
    expect(plan.needsEmergencyAcceptance('cuida')).toBe(true);
    expect(plan.confirm('cuida', { emergencyAccepted: false })).toMatchObject({ ok: false, field: 'acceptance' });
    expect(db.subscriptions.find((s) => s.caregiverId === MARIA)!.planId).toBe('essencial');
    const done = plan.confirm('cuida', { emergencyAccepted: true });
    expect(done).toMatchObject({ ok: true });
    expect(done.ok && done.message).toMatch(/^Plano alterado para o Cuida\. Cartão NX-\d{4}-\d{4} segue ativo\.$/);
    const sub = db.subscriptions.find((s) => s.caregiverId === MARIA)!;
    expect(sub).toMatchObject({ planId: 'cuida', status: 'active' });
    expect(db.caregivers.require(MARIA).emergencyNoticeAcceptedAt).toBeDefined();
    expect(db.planChanges.query((p) => p.subscriptionId === sub.id).at(-1)?.byUserId).toBeDefined();
    expect(db.planChanges.query((p) => p.subscriptionId === sub.id).some((p) => p.byUserId === MARIA)).toBe(true);
  });

  it('descer vale no fim do ciclo: o plano atual continua, o agendamento guarda data e destino; "manter" desfaz', () => {
    const { db } = boot(ANA);
    const plan = TestBed.inject(CaregiverPlanService);
    const context = TestBed.inject(CaregiverContextService);
    db.caregivers.update(ANA, { emergencyNoticeAcceptedAt: '2026-10-01T10:00:00-03:00' });
    expect(plan.confirm('essencial', { emergencyAccepted: false }).ok).toBe(true);
    const sub = db.subscriptions.find((s) => s.caregiverId === ANA)!;
    expect(sub).toMatchObject({ planId: 'cuida', status: 'cancel_scheduled', scheduledPlanId: 'essencial', scheduledChangeAt: '2026-11-06' });
    expect(context.planId()).toBe('cuida');
    expect(context.canUse('groups')).toBe(true);
    expect(plan.keep()).toEqual({ ok: true, message: 'Plano mantido.' });
    expect(db.subscriptions.require(sub.id)).toMatchObject({ status: 'active' });
    expect(db.subscriptions.require(sub.id).scheduledPlanId).toBeUndefined();
  });

  it('trocas repetidas (descer, subir, descer, cancelar): sempre uma única mudança futura no histórico', () => {
    const { db } = boot(ANA);
    const plan = TestBed.inject(CaregiverPlanService);
    db.caregivers.update(ANA, { emergencyNoticeAcceptedAt: '2026-10-01T10:00:00-03:00' });
    const sub = db.subscriptions.find((s) => s.caregiverId === ANA)!;
    const future = () => db.planChanges.query((p) => p.subscriptionId === sub.id && p.effectiveAt > '2026-11-04');
    expect(plan.confirm('essencial', { emergencyAccepted: true }).ok).toBe(true);
    expect(future()).toHaveLength(1);
    expect(plan.confirm('sustenta', { emergencyAccepted: true }).ok).toBe(true);
    expect(db.subscriptions.require(sub.id)).toMatchObject({ planId: 'sustenta', status: 'active' });
    expect(future()).toHaveLength(0);
    expect(plan.confirm('essencial', { emergencyAccepted: true }).ok).toBe(true);
    expect(plan.confirm('livre', { emergencyAccepted: true }).ok).toBe(true);
    expect(future()).toHaveLength(1);
    expect(db.subscriptions.require(sub.id)).toMatchObject({ planId: 'sustenta', status: 'cancel_scheduled', scheduledPlanId: 'livre' });
  });

  it('cancelar: no dia do fim do ciclo o plano vira Livre, o cartão é inativado e as turmas futuras saem', () => {
    const { db, clock } = boot(ANA);
    db.caregivers.update(ANA, { emergencyNoticeAcceptedAt: '2026-10-01T10:00:00-03:00' });
    expect(TestBed.inject(CaregiverPlanService).confirm('livre', { emergencyAccepted: true }).ok).toBe(true);
    const subscriptions = TestBed.inject(SubscriptionService);
    expect(subscriptions.applyDueChanges()).toBe(0);
    expect(db.benefitCards.find((c) => c.caregiverId === ANA)?.status).toBe('active');
    clock.setSimulated('2026-11-06', '12:00');
    expect(subscriptions.applyDueChanges()).toBe(1);
    expect(TestBed.inject(CaregiverContextService).planId()).toBe('livre');
    expect(db.benefitCards.find((c) => c.caregiverId === ANA)?.status).toBe('inactive');
    expect(TestBed.inject(CaregiverContextService).access('card').allowed).toBe(false);
    expect(TestBed.inject(CaregiverContextService).access('groups').allowed).toBe(false);
  });

  it('Marcos: cancelamento agendado para 13/11, "manter" desfaz e no dia nada muda; sem desfazer, vira Livre', () => {
    const a = boot(MARCOS);
    const context = TestBed.inject(CaregiverContextService);
    expect(context.scheduledChange()).toMatchObject({ kind: 'cancel', at: '2026-11-13' });
    expect(context.planId()).toBe('essencial');
    expect(TestBed.inject(CaregiverPlanService).keep().ok).toBe(true);
    a.clock.setSimulated('2026-11-13', '12:00');
    expect(TestBed.inject(SubscriptionService).applyDueChanges()).toBe(0);
    expect(context.planId()).toBe('essencial');
    TestBed.resetTestingModule();

    const b = boot(MARCOS);
    b.clock.setSimulated('2026-11-13', '12:00');
    expect(TestBed.inject(SubscriptionService).applyDueChanges()).toBe(1);
    expect(TestBed.inject(CaregiverContextService).planId()).toBe('livre');
    expect(b.db.benefitCards.find((c) => c.caregiverId === MARCOS)?.status).toBe('inactive');
  });

  it('plano pago pela empresa (Gisele, Rogério, Simone): nenhuma troca nem cancelamento, com a empresa nomeada', () => {
    const { db } = boot('cg_0021');
    const plan = TestBed.inject(CaregiverPlanService);
    expect(plan.isCorporate()).toBe(true);
    expect(plan.companyName()).toBeTruthy();
    expect(plan.quote('essencial').timing).toBe('blocked');
    expect(plan.quote('livre').timing).toBe('blocked');
    const before = JSON.stringify(db.subscriptions.find((s) => s.caregiverId === 'cg_0021'));
    expect(plan.confirm('sustenta', { emergencyAccepted: true }).ok).toBe(false);
    expect(JSON.stringify(db.subscriptions.find((s) => s.caregiverId === 'cg_0021'))).toBe(before);
  });

  it('pedido de exclusão aberto bloqueia a troca de plano, sem mudar a assinatura', () => {
    const { db } = boot(MARIA);
    TestBed.inject(PrivacyService).requestErasure();
    const before = JSON.stringify(db.subscriptions.find((s) => s.caregiverId === MARIA));
    expect(TestBed.inject(CaregiverPlanService).confirm('cuida', { emergencyAccepted: true }).ok).toBe(false);
    expect(JSON.stringify(db.subscriptions.find((s) => s.caregiverId === MARIA))).toBe(before);
  });

  it('Livre: bloqueios por plano (grupos, Cartão, conteúdo exclusivo, condições especiais), rodas abertas liberadas', () => {
    boot(JOAO);
    const context = TestBed.inject(CaregiverContextService);
    expect(context.access('groups').allowed).toBe(false);
    expect(context.access('card').allowed).toBe(false);
    expect(context.access('exclusive_content').allowed).toBe(false);
    expect(context.access('network_conditions').allowed).toBe(false);
    expect(context.access('individual_session').allowed).toBe(false);
    expect(context.access('request_service').allowed).toBe(true);
    ['groups', 'card', 'exclusive_content', 'network_conditions'].forEach((f) => {
      const reason = context.access(f as 'groups').reason ?? '';
      expect(reason).toMatch(/^Disponível a partir do plano (Essencial|Cuida)\.$/);
    });
  });

  // QAC-003: duas funções diferentes dizem "qual é o plano". A do núcleo usada para preço da conversa, vaga prioritária
  // e acesso a grupos cai na última assinatura mesmo cancelada; a do contexto (a que a tela mostra) diz Livre.
  it('QAC-003: com a única assinatura cancelada, o preço da conversa e o acesso a grupos seguem o plano Livre', () => {
    const { db } = boot(JOAO);
    const sub = db.subscriptions.find((s) => s.caregiverId === JOAO)!;
    db.subscriptions.update(sub.id, { planId: 'sustenta', status: 'cancelled' });
    expect(TestBed.inject(CaregiverContextService).planId()).toBe('livre'); // o que a tela mostra
    expect(planIdOfCaregiver(db, JOAO)).toBe('livre'); // o que o preço e os grupos usam
    expect(TestBed.inject(SessionBookingService).quote(JOAO).totalCents).toBe(12000);
  });

  // QAC-004: o ciclo de cobrança vai "escorregando": quem assinou em 31/01 tem 28/02 e depois 28/03, 28/04...
  it('QAC-004: assinatura iniciada em 31/01 cobra em 28/02 e depois em 31/03 (não em 28/03)', () => {
    const { db, clock } = boot(null, { today: '2026-01-31' });
    const subscriptions = TestBed.inject(SubscriptionService);
    const sub = subscriptions.startSubscription('cg_0010', 'essencial');
    expect(sub.nextCycleAt).toBe('2026-02-28');
    clock.setSimulated('2026-03-01', '12:00');
    subscriptions.applyDueChanges();
    expect(db.subscriptions.require(sub.id).nextCycleAt).toBe('2026-03-31');
  });
});

// ===========================================================================================================
// 7. Integridade cruzada com a visão da equipe
// ===========================================================================================================
describe('QAC: integridade cruzada com a visão da equipe', () => {
  it('agendar: vaga ocupada, sessão na agenda do psicólogo com o preço do plano e o formato pedido', () => {
    const { db } = boot(ANA);
    const conversations = TestBed.inject(ConversationsService);
    const slot = openSlot(db);
    const result = conversations.book({
      slotId: slot.id,
      psychologistId: slot.psychologistId,
      format: 'online',
      kind: 'guidance',
      address: '',
    });
    expect(result.ok).toBe(true);
    const session = result.ok ? result.session : null;
    expect(session).toMatchObject({ caregiverId: ANA, psychologistId: slot.psychologistId, slotId: slot.id, status: 'scheduled', priceCents: 0, discountPercent: 0, includedInPlan: true, kind: 'guidance' });
    expect(db.availabilitySlots.require(slot.id).status).toBe('booked');
    // O mesmo horário não pode ser vendido duas vezes.
    TestBed.inject(CaregiverSessionService).signIn(RITA);
    const second = TestBed.inject(ConversationsService).book({ slotId: slot.id, psychologistId: slot.psychologistId, format: 'online', kind: 'guidance', address: '' });
    expect(second.ok).toBe(false);
    // O que a equipe lê: a sessão aparece para o psicólogo dono do horário.
    expect(db.careSessions.query((s) => s.psychologistId === slot.psychologistId && s.id === session!.id)).toHaveLength(1);
  });

  it('agendar em casa: nasce sem a segurança do domicílio confirmada e a equipe não consegue confirmar sem ela', () => {
    const { db } = boot(ANA);
    const slot = openSlot(db);
    const result = TestBed.inject(ConversationsService).book({ slotId: slot.id, psychologistId: slot.psychologistId, format: 'in_person_home', kind: 'psychotherapy', address: 'Rua Exemplo, 10' });
    expect(result.ok).toBe(true);
    const session = db.careSessions.require(result.ok ? result.session.id : '');
    expect(session.homeVisitConfirmedSafe).toBe(false);
    expect(session.homeAddress).toBe('Rua Exemplo, 10');
  });

  it('agendar em casa sem endereço, sem o caráter ou com vaga que já passou é recusado com o campo certo', () => {
    const { db } = boot(ANA);
    const slot = openSlot(db);
    const conversations = TestBed.inject(ConversationsService);
    const base = { slotId: slot.id, psychologistId: slot.psychologistId, address: '' };
    expect(conversations.book({ ...base, format: 'in_person_home', kind: 'guidance' })).toMatchObject({ ok: false, field: 'homeAddress' });
    expect(conversations.book({ ...base, format: 'in_person_home', kind: 'guidance', address: '   ' })).toMatchObject({ ok: false, field: 'homeAddress' });
    expect(db.careSessions.count((s) => s.caregiverId === ANA && s.slotId === slot.id)).toBe(0);
    expect(db.availabilitySlots.require(slot.id).status).toBe('open');
  });

  it('cancelar com exatamente 24 horas libera a vaga sem custo; 1 minuto depois conta como falta e a vaga fica ocupada', () => {
    const exact = boot(LOURDES, { today: '2026-11-05', time: '14:00' });
    const session = exact.db.careSessions.require('ses_0062');
    expect(session.startAt).toBe('2026-11-06T14:00:00-03:00');
    const conversations = TestBed.inject(ConversationsService);
    const conversation = conversations.next()!;
    expect(conversation.late).toBe(false);
    expect(conversations.cancel(conversation).ok).toBe(true);
    expect(exact.db.careSessions.require('ses_0062').status).toBe('cancelled_by_user');
    expect(exact.db.availabilitySlots.require(session.slotId).status).toBe('open');
    TestBed.resetTestingModule();

    const late = boot(LOURDES, { today: '2026-11-05', time: '14:01' });
    const conv = TestBed.inject(ConversationsService).next()!;
    expect(conv.late).toBe(true);
    expect(TestBed.inject(ConversationsService).cancel(conv).ok).toBe(true);
    expect(late.db.careSessions.require('ses_0062').status).toBe('no_show');
    expect(late.db.availabilitySlots.require(session.slotId).status).toBe('booked');
  });

  it('conversa de hoje que já começou não pode mais ser cancelada nem remarcada e sai de "próximas"', () => {
    const { db } = boot(LOURDES, { today: '2026-11-06', time: '14:30' });
    const conversations = TestBed.inject(ConversationsService);
    expect(conversations.upcoming()).toHaveLength(0);
    const past = conversations.all().find((c) => c.id === 'ses_0062')!;
    expect(past.upcoming).toBe(false);
    const result = conversations.cancel(past);
    expect(result.ok).toBe(false);
    expect(db.careSessions.require('ses_0062').status).toBe('confirmed');
  });

  it('remarcar: o horário antigo reabre (24 h ou mais), o novo fecha e a sessão antiga aponta para a nova', () => {
    const { db } = boot(LOURDES);
    const conversations = TestBed.inject(ConversationsService);
    const old = db.careSessions.require('ses_0062');
    const slot = openSlot(db);
    const conv = conversations.next()!;
    const result = conversations.reschedule(conv, { slotId: slot.id, psychologistId: slot.psychologistId, format: 'online', kind: 'guidance', address: '' });
    expect(result.ok).toBe(true);
    expect(db.availabilitySlots.require(old.slotId).status).toBe('open');
    expect(db.availabilitySlots.require(slot.id).status).toBe('booked');
    expect(db.careSessions.require('ses_0062')).toMatchObject({ status: 'cancelled_by_user', rescheduleRequestedBy: 'user' });
    expect(db.careSessions.require('ses_0062').rescheduledToId).toBe(result.ok ? result.session.id : '');
  });

  it('pedir serviço na rede: pedido "enviado" visível à equipe; só um em andamento por profissional; sem profissional sem cláusula', () => {
    const { db } = boot(ANA);
    const network = TestBed.inject(CaregiverNetworkService);
    const first = network.createRequest(ANA, { providerId: 'prv_01', need: 'Fisioterapia em casa duas vezes por semana', modality: 'home' });
    expect(first.ok).toBe(true);
    const created = first.ok ? first.value : null;
    expect(Object.keys(created!).sort()).toEqual(['caregiverId', 'createdAt', 'id', 'modality', 'need', 'providerId', 'requestedAt', 'specialty', 'status', 'updatedAt']);
    expect(created).toMatchObject({ status: 'requested', caregiverId: ANA, providerId: 'prv_01', specialty: 'physiotherapy' });
    expect(network.createRequest(ANA, { providerId: 'prv_01', need: 'De novo', modality: 'home' }).ok).toBe(false);
    expect(network.createRequest(ANA, { providerId: 'prv_20', need: 'Cuidadora', modality: 'home' })).toMatchObject({ ok: false });
    ['prv_10', 'prv_16', 'prv_18', 'prv_19', 'prv_99'].forEach((id) => {
      const result = network.createRequest(ANA, { providerId: id, need: 'x', modality: 'at_provider' });
      expect(result, id).toMatchObject({ ok: false, error: 'Não encontramos este profissional.' });
      expect(network.viewOf(id), id).toBeUndefined();
    });
    expect(db.serviceRequests.count((r) => r.caregiverId === ANA && r.providerId === 'prv_01')).toBe(1);
  });

  it('avaliar e corrigir: a média do profissional só aparece com 5 avaliações e acompanha a correção', () => {
    const { db } = boot(ANA);
    const network = TestBed.inject(CaregiverNetworkService);
    // prv_13 não tem avaliações no seed: 4 avaliações de outras pessoas + a da Ana.
    db.providerEvaluations.removeWhere((e) => e.providerId === 'prv_13');
    for (let i = 0; i < 4; i += 1) {
      db.providerEvaluations.create({ serviceRequestId: `srq_fake_${i}`, providerId: 'prv_13', caregiverId: `cg_00${30 + i}`, technicalQuality: 5, punctualityCourtesy: 5, score: 5, editableUntil: '2026-11-01' });
    }
    const request = db.serviceRequests.create({ caregiverId: ANA, providerId: 'prv_13', specialty: 'psychology', need: 'Conversa', modality: 'at_provider', status: 'completed', requestedAt: '2026-11-01T10:00:00-03:00', completedAt: '2026-11-03T10:00:00-03:00' });
    expect(network.viewOf('prv_13')?.average).toBeNull();
    expect(network.evaluate(ANA, request.id, { technical: 4, punctuality: 3, comment: '  Atendeu bem  ' }).ok).toBe(true);
    expect(network.evaluate(ANA, request.id, { technical: 4, punctuality: 3 }).ok).toBe(false); // uma por serviço
    expect(db.serviceRequests.require(request.id).status).toBe('evaluated');
    expect(network.viewOf('prv_13')?.evaluationCount).toBe(5);
    expect(network.viewOf('prv_13')?.average).toBe(4.7); // (4 x 10 + 7) / 10 = 4,70
    const fixed = network.correctEvaluation(ANA, request.id, { technical: 5, punctuality: 5 });
    expect(fixed.ok).toBe(true);
    expect(network.viewOf('prv_13')?.average).toBe(5);
    expect(db.providerEvaluations.find((e) => e.serviceRequestId === request.id)?.comment).toBeUndefined();
  });

  it('avaliação: notas fora de 1 a 5, decimais e vazias são recusadas com o campo certo', () => {
    const { db } = boot(RITA);
    const network = TestBed.inject(CaregiverNetworkService);
    const id = 'srq_0126';
    [[0, 5, 'technical'], [6, 5, 'technical'], [4.5, 5, 'technical'], [null, 5, 'technical'], [5, 0, 'punctuality'], [5, -1, 'punctuality'], [5, null, 'punctuality'], [5, Number.NaN, 'punctuality']].forEach(
      ([t, p, field]) => {
        expect(network.evaluate(RITA, id, { technical: t as number | null, punctuality: p as number | null }), `${t}/${p}`).toMatchObject({ ok: false, field });
      },
    );
    expect(db.serviceRequests.require(id).status).toBe('completed');
  });

  it('inscrição em grupo: aceite do sigilo gravado, lista de espera em ordem, saída promove o primeiro da fila', () => {
    const { db } = boot(ANA);
    const activities = TestBed.inject(CaregiverActivitiesService);
    // act_0001 (lotada): Ana, Rita; espera: Lourdes (enr_0009) e Elza (enr_0010).
    const waiting = db.activityEnrollments.query((e) => e.activityId === 'act_0001' && e.status === 'waitlist').sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
    expect(waiting.length).toBeGreaterThan(0);
    const first = waiting[0]!;
    const left = activities.leave(ANA, 'enr_0001');
    expect(left.ok).toBe(true);
    expect(db.activityEnrollments.require('enr_0001').status).not.toBe('enrolled');
    expect(db.activityEnrollments.require(first.id).status).toBe('enrolled');
    expect(db.activities.require('act_0001').status).toBe('full');
    const missingSigil = activities.enroll(ANA, 'act_0002', { contractAccepted: false });
    expect(missingSigil).toMatchObject({ ok: false });
  });

  it('mensagem: chega à fila do atendimento como canal app, "nova", com o prazo de 24 horas úteis', () => {
    const { db } = boot(MARCOS, { today: '2026-11-04', time: '10:00' });
    const result = TestBed.inject(CaregiverMessagesService).send(MARCOS, { subject: 'Dúvida sobre o app', body: 'Como troco o horário?' });
    expect(result.ok).toBe(true);
    const message = db.messages.require(result.ok ? result.message.id : '');
    expect(message).toMatchObject({ channel: 'app', direction: 'in', status: 'new', caregiverId: MARCOS, isSupportRequest: false });
    expect(message.receivedAt).toBe('2026-11-04T10:00:00-03:00');
    // 24 horas úteis de 8h às 18h: quarta 10h + 8h (quarta) + 10h (quinta) + 6h (sexta) = sexta 14h
    expect(message.dueAt).toBe('2026-11-06T14:00:00-03:00');
    staffLogin('u7');
    expect(db.messages.query((m) => m.caregiverId === MARCOS)).toHaveLength(1);
  });

  it('mensagem fora do expediente e com feriado: conta a partir da abertura seguinte e pula feriado nacional', () => {
    const sat = boot(MARCOS, { today: '2026-11-07', time: '10:00' });
    const a = TestBed.inject(CaregiverMessagesService).send(MARCOS, { subject: '', body: 'sábado' });
    // sábado: começa na segunda 8h, 24 h úteis = seg 10 + ter 10 + qua 4 = quarta 12h
    expect(a.ok && sat.db.messages.require(a.message.id).dueAt).toBe('2026-11-11T12:00:00-03:00');
    TestBed.resetTestingModule();
    const holiday = boot(MARCOS, { today: '2026-11-19', time: '17:00' });
    const b = TestBed.inject(CaregiverMessagesService).send(MARCOS, { subject: '', body: 'quinta antes do feriado' });
    // quinta 17h: 1 h; sexta 20/11 é feriado (Consciência Negra); seg 23 (10) + ter 24 (10) + qua 25 (3) = quarta 11h
    expect(b.ok && holiday.db.messages.require(b.message.id).dueAt).toBe('2026-11-25T11:00:00-03:00');
  });

  it('mensagem em branco ou só com espaços não grava; HTML, emoji e texto enorme entram como texto', () => {
    const { db } = boot(MARCOS);
    const messages = TestBed.inject(CaregiverMessagesService);
    expect(messages.send(MARCOS, { subject: '', body: '   \n\t ' })).toEqual({ ok: false, error: 'Escreva a sua mensagem para enviar.' });
    expect(db.messages.count((m) => m.caregiverId === MARCOS)).toBe(0);
    const html = '<img src=x onerror=alert(1)> <b>negrito</b> \u{1F600}';
    expect(messages.send(MARCOS, { subject: '<i>assunto</i>', body: html }).ok).toBe(true);
    expect(messages.thread(MARCOS)[0]?.body).toBe(html);
  });

  it('consentimentos: cada mudança gera evento do canal app, sem tocar nos outros, e o histórico só cresce', () => {
    const { db } = boot(ANA);
    const privacy = TestBed.inject(PrivacyService);
    const before = db.consentEvents.count((e) => e.caregiverId === ANA);
    expect(privacy.revoke('image_testimony').ok).toBe(false); // pendente: não dá para retirar o que não foi dado
    expect(privacy.revoke('family_sharing').ok).toBe(true);
    expect(db.consentEvents.count((e) => e.caregiverId === ANA)).toBe(before + 1);
    expect(db.consents.find((c) => c.caregiverId === ANA && c.key === 'health_data')?.status).toBe('granted');
    expect(db.caregivers.require(ANA).status).toBe('active');
    expect(privacy.grant('family_sharing').ok).toBe(true);
    expect(privacy.historyOf('family_sharing').map((h) => h.label)).toEqual(['Você autorizou', 'Você retirou a autorização', 'Você autorizou']);
  });

  it('retirar a autorização de WhatsApp tira o canal preferido de WhatsApp e não mexe em plano nem em outras autorizações', () => {
    const { db } = boot(MARIA);
    expect(db.caregivers.require(MARIA).preferredChannel).toBe('whatsapp');
    expect(TestBed.inject(PrivacyService).revoke('whatsapp_contact').ok).toBe(true);
    expect(db.caregivers.require(MARIA).preferredChannel).toBe('app');
    expect(db.consents.find((c) => c.caregiverId === MARIA && c.key === 'health_data')?.status).toBe('granted');
    expect(TestBed.inject(CaregiverContextService).planId()).toBe('essencial');
  });

  it('pedido de cópia e de eliminação: protocolo, 15 dias corridos, um só em aberto por tipo, retirar volta ao estado anterior', () => {
    const { db } = boot(MARIA);
    const privacy = TestBed.inject(PrivacyService);
    expect(privacy.requestCopy().ok).toBe(true);
    const copy = privacy.pendingOf('access')!;
    expect(copy.protocol).toMatch(/^DSR-\d{4}$/);
    expect(db.dataSubjectRequests.require(copy.id)).toMatchObject({ type: 'access', status: 'open', openedAt: '2026-11-04', dueAt: '2026-11-19', channel: 'app' });
    expect(privacy.requestCopy()).toMatchObject({ ok: false, error: 'duplicate', duplicateOf: copy.protocol });
    expect(privacy.requestErasure().ok).toBe(true);
    expect(db.caregivers.require(MARIA).status).toBe('closure_requested');
    expect(privacy.requestErasure()).toMatchObject({ ok: false, error: 'duplicate' });
    const erasure = privacy.pendingOf('erasure')!;
    expect(privacy.withdraw(erasure.id).ok).toBe(true);
    expect(db.caregivers.require(MARIA).status).toBe('active');
    expect(db.dataSubjectRequests.require(erasure.id).status).toBe('rejected_with_reason');
    expect(db.caregivers.require(MARIA).fullName).toBe('Maria Aparecida Lemos');
  });

  it('prazo do pedido de dados no dia 14, 15 e 16: frase neutra, sem "vencido" nem "atrasado"', () => {
    const { db, clock } = boot(MARIA);
    const privacy = TestBed.inject(PrivacyService);
    privacy.requestCopy();
    const text = () => privacy.requests().find((r) => r.type === 'access')!.statusText;
    expect(text()).toBe('Faltam 15 dias para a resposta');
    clock.setSimulated('2026-11-18', '12:00');
    expect(text()).toBe('Falta 1 dia para a resposta');
    clock.setSimulated('2026-11-19', '12:00');
    expect(text()).toBe('O prazo termina hoje');
    clock.setSimulated('2026-11-20', '12:00');
    expect(text()).not.toMatch(/vencid|atrasad|Faltam -/i);
    expect(db.dataSubjectRequests.find((r) => r.caregiverId === MARIA && r.type === 'access')?.dueAt).toBe('2026-11-19');
  });

  it('exportar o arquivo do titular: só dados dele, sem registro de log de acesso e sem dado de outra pessoa', () => {
    const { db } = boot(ANA);
    const before = db.accessLog.count();
    const json = TestBed.inject(DataSubjectRequestService).exportSubjectJson(ANA);
    expect(db.accessLog.count()).toBe(before);
    const data = JSON.parse(json) as { subject: { code: string; caregiver: { id: string } } };
    expect(data.subject.caregiver.id).toBe(ANA);
    expect(json).not.toContain('Maria Aparecida');
    expect(json).not.toContain('cg_0002');
  });

  it('"Combinar um horário" cria mensagem do app marcada como pedido de apoio, visível à equipe', async () => {
    const { db } = boot(MARIA);
    const view = TestBed.inject(WellbeingViewService);
    const result = view.arrange('morning');
    expect(result.ok).toBe(true);
    const message = db.messages.query((m) => m.caregiverId === MARIA).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]!;
    expect(message).toMatchObject({ channel: 'app', direction: 'in', isSupportRequest: true });
  });

  it('doses: marcar e desfazer, idempotente, não aceita dia futuro, horário que o remédio não tem nem remédio em pausa', () => {
    const { db } = boot(ANA);
    const doses = TestBed.inject(DoseCheckService);
    const elder = db.elders.find((e) => e.caregiverId === ANA)!;
    const med = db.medications.find((m) => m.elderId === elder.id && m.active)!;
    const time = med.times[0]!;
    const existing = db.doseChecks.count((d) => d.medicationId === med.id && d.date === '2026-11-04' && d.time === time);
    const first = doses.mark(med.id, '2026-11-04', time);
    const second = doses.mark(med.id, '2026-11-04', time);
    expect(second.id).toBe(first.id);
    expect(db.doseChecks.count((d) => d.medicationId === med.id && d.date === '2026-11-04' && d.time === time)).toBe(Math.max(1, existing));
    expect(() => doses.mark(med.id, '2026-11-05', time)).toThrow();
    expect(() => doses.mark(med.id, '2026-11-04', '03:33')).toThrow();
    expect(doses.unmark(med.id, '2026-11-04', time)).toBe(true);
    expect(doses.unmark(med.id, '2026-11-04', time)).toBe(false);
    db.medications.update(med.id, { active: false });
    expect(() => doses.mark(med.id, '2026-11-04', time)).toThrow();
  });
});

// ===========================================================================================================
// Entradas do usuário, perfil e cadastro
// ===========================================================================================================
describe('QAC: perfil e entradas', () => {
  const daily = (hours: number, channel: 'app' | 'whatsapp' | 'phone' | 'email' = 'app') => ({ hours, channel, whatsapp: '' });

  it('horas por dia: de 0 a 24 inteiras; negativo, 25, decimal, NaN e Infinity são recusados com texto humano', () => {
    const { db } = boot(MARIA);
    const profile = TestBed.inject(ProfileService);
    [0, 24, 12].forEach((h) => expect(() => profile.updateDaily(MARIA, daily(h))).not.toThrow());
    [-1, 25, 8.5, Number.NaN, Number.POSITIVE_INFINITY, 1e9].forEach((h) => {
      expect(() => profile.updateDaily(MARIA, daily(h)), String(h)).toThrow('As horas por dia devem ser de 0 a 24.');
    });
    expect(db.caregivers.require(MARIA).dailyCareHours).toBe(12);
  });

  it('perfil: menos de 18 anos, telefone e e-mail fora do formato, nome curto e cidade vazia dão frases próprias', () => {
    const { db } = boot(ANA);
    const profile = TestBed.inject(ProfileService);
    const ok = { fullName: 'Ana Paula Ferraz', birthDate: '1981-03-10', phone: '(34) 90000-0123', email: 'ana@exemplo.com.br', city: 'Uberlândia' };
    expect(profile.updateYou(ANA, { ...ok, birthDate: '2008-11-04' })).toBe(true); // exatamente 18 anos hoje passa
    expect(() => profile.updateYou(ANA, { ...ok, birthDate: '2008-11-05' })).toThrow('Você precisa ter 18 anos ou mais.');
    expect(() => profile.updateYou(ANA, { ...ok, phone: '123' })).toThrow('O telefone deve ter o formato (34) 90000-0000.');
    expect(() => profile.updateYou(ANA, { ...ok, email: 'a@b' })).toThrow('Use um e-mail que termine em @exemplo.com.br.');
    expect(() => profile.updateYou(ANA, { ...ok, fullName: 'A' })).toThrow('Informe o nome completo.');
    expect(() => profile.updateYou(ANA, { ...ok, city: '   ' })).toThrow('Informe a cidade.');
    expect(db.caregivers.require(ANA).birthDate).toBe('2008-11-04');
  });

  it('perfil: data de nascimento da pessoa idosa no futuro é recusada', () => {
    boot(ANA);
    const profile = TestBed.inject(ProfileService);
    expect(() => profile.updateElder(ANA, { fullName: 'Dona Alice', birthDate: '2030-01-01', relationship: 'daughter', dependency: 'partial' })).toThrow('A data de nascimento dela não pode ser no futuro.');
  });

  // QAC-005: em "Seu dia a dia" o canal WhatsApp é aceito sem a autorização de contato por WhatsApp; no cadastro
  // (S-40) o mesmo caso vira "aplicativo". A tela de Mais deixa a pessoa se dizer "prefere WhatsApp" sem consentir.
  it('QAC-005: escolher WhatsApp como canal preferido sem a autorização de WhatsApp não grava o canal', () => {
    const { db } = boot(ANA);
    TestBed.inject(PrivacyService).revoke('whatsapp_contact');
    expect(db.consents.find((c) => c.caregiverId === ANA && c.key === 'whatsapp_contact')?.status).toBe('revoked');
    try {
      TestBed.inject(ProfileService).updateDaily(ANA, { hours: 11, channel: 'whatsapp', whatsapp: '(34) 90000-0000' });
    } catch {
      /* recusar também vale */
    }
    expect(db.caregivers.require(ANA).preferredChannel).not.toBe('whatsapp');
  });

  // QAC-006: RN-ARBE-10 ("a correção gera nova avaliação ARBE"). Mudar as horas por dia só grava o número.
  it('QAC-006: corrigir as horas por dia gera nova avaliação da ARBE (sem avisar a pessoa)', () => {
    const { db } = boot(JOAO);
    // João: 8 horas (limite), Zarit abaixo do limite; 2 pedidos de apoio na janela + 24 horas bastam para "atenção"
    // quando a escala já passa do limite. Para isolar a regra: Ana tem Zarit 63 e 11 horas.
    TestBed.inject(CaregiverSessionService).signIn(ANA);
    const before = db.arbeAlerts.count((a) => a.caregiverId === ANA);
    db.arbeAlerts.removeWhere((a) => a.caregiverId === ANA);
    TestBed.inject(ProfileService).updateDaily(ANA, { hours: 24, channel: 'app', whatsapp: '' });
    expect(before).toBeGreaterThanOrEqual(0);
    expect(db.arbeAlerts.count((a) => a.caregiverId === ANA)).toBeGreaterThan(0);
  });
});

// ===========================================================================================================
// Datas e textos
// ===========================================================================================================
describe('QAC: datas e textos de horário', () => {
  it('telefone fechado: de noite, sábado, domingo e feriado a frase diz quando abre', () => {
    // quarta 20h -> amanhã; sexta 19h -> segunda; sábado -> segunda; domingo 15/11 (e feriado)
    expect(phoneClosedNote('2026-11-04T20:00:00-03:00')).toBe('Fechado agora. Abrimos amanhã às 8h.');
    expect(phoneClosedNote('2026-11-04T07:00:00-03:00')).toBe('Fechado agora. Abrimos hoje às 8h.');
    expect(phoneClosedNote('2026-11-04T12:00:00-03:00')).toBeUndefined();
    expect(phoneClosedNote('2026-11-04T18:00:00-03:00')).toBe('Fechado agora. Abrimos amanhã às 8h.');
    expect(phoneClosedNote('2026-11-04T17:59:00-03:00')).toBeUndefined();
  });

  // QAC-007: AC-CG-39 e AC-CG-164 pedem "na segunda às 8h" quando o próximo dia útil não é amanhã.
  it('QAC-007: sexta à noite e fim de semana dizem "Abrimos na segunda às 8h" (e o dia da semana em feriado)', () => {
    expect(phoneClosedNote('2026-11-06T19:00:00-03:00')).toBe('Fechado agora. Abrimos na segunda às 8h.');
    expect(phoneClosedNote('2026-11-07T10:00:00-03:00')).toBe('Fechado agora. Abrimos na segunda às 8h.');
  });

  it('o relógio: "hoje" muda à meia-noite e a conversa de hoje às 23:59 ainda é de hoje', () => {
    const { clock } = boot(LOURDES, { today: '2026-11-06', time: '23:59' });
    expect(clock.today()).toBe('2026-11-06');
    expect(TestBed.inject(CaregiverContextService).today()).toBe('2026-11-06');
    clock.setSimulated('2026-11-07', '00:00');
    expect(TestBed.inject(CaregiverContextService).today()).toBe('2026-11-07');
  });

  it('o Clock devolve sempre o horário de Brasília (-03:00), também na virada do dia', () => {
    const { clock } = boot(null, { today: '2026-12-31', time: '23:59' });
    expect(clock.now()).toBe('2026-12-31T23:59:00-03:00');
    expect(clock.addMonths(1, '2026-01-31')).toBe('2026-02-28');
    expect(TestBed.inject(Clock).isSimulated()).toBe(true);
  });
});

// ===========================================================================================================
// Integridade da eliminação (RN-LGPD-21 e 24) com o que o cuidador escreveu pelo aplicativo
// ===========================================================================================================
describe('QAC: eliminação do titular e o que o cuidador escreveu', () => {
  // QAC-008: a eliminação apaga mensagens, humor, remédios e agenda, mas deixa o texto livre do pedido de serviço, o
  // texto do pedido de revisão, o comentário da avaliação e o endereço de casa da conversa.
  it('QAC-008: depois da eliminação não sobra texto livre do titular (pedido, revisão, comentário, endereço)', () => {
    const { db } = boot(ANA);
    const network = TestBed.inject(CaregiverNetworkService);
    network.createRequest(ANA, { providerId: 'prv_01', need: 'MARCADOR-PEDIDO fisioterapia para a minha mãe', modality: 'home' });
    db.reviewRequests.create({ caregiverId: ANA, psychologistId: 'psy_0001', about: 'zarit_decision', text: 'MARCADOR-REVISAO', dueAt: '2026-11-19' });
    const done = db.serviceRequests.find((r) => r.caregiverId === ANA && r.status === 'evaluated')!;
    const evaluation = db.providerEvaluations.require(done.evaluationId!);
    db.providerEvaluations.update(evaluation.id, { comment: 'MARCADOR-COMENTARIO' });
    const slot = openSlot(db);
    TestBed.inject(ConversationsService).book({ slotId: slot.id, psychologistId: slot.psychologistId, format: 'in_person_home', kind: 'guidance', address: 'MARCADOR-ENDERECO, 10' });
    staffLogin('u7');
    TestBed.inject(RetentionService).erase(ANA);
    const dump = JSON.stringify({
      requests: db.serviceRequests.list(),
      reviews: db.reviewRequests.list(),
      evaluations: db.providerEvaluations.list(),
      sessions: db.careSessions.list(),
    });
    ['MARCADOR-PEDIDO', 'MARCADOR-REVISAO', 'MARCADOR-COMENTARIO', 'MARCADOR-ENDERECO'].forEach((marker) => {
      expect(dump.includes(marker), marker).toBe(false);
    });
  });
});

// ===========================================================================================================
// 7 (continuação). O que a equipe faz volta certo para o cuidador, e o prazo de correção da avaliação
// ===========================================================================================================
describe('QAC: ida e volta com a visão da equipe', () => {
  it('conversa em casa pedida pelo cuidador: o psicólogo só confirma com a segurança do domicílio confirmada', async () => {
    const { CareSessionsService } = await import('../features/care-sessions/state/care-sessions.service');
    const { db } = boot(ANA);
    const slot = openSlot(db);
    const booked = TestBed.inject(ConversationsService).book({ slotId: slot.id, psychologistId: slot.psychologistId, format: 'in_person_home', kind: 'guidance', address: 'Rua Exemplo, 10' });
    expect(booked.ok).toBe(true);
    const sessionId = booked.ok ? booked.session.id : '';
    const psychologist = db.psychologists.require(slot.psychologistId);
    staffLogin(db.users.require(psychologist.userId).id);
    const sessions = TestBed.inject(CareSessionsService);
    expect(sessions.confirm(sessionId).ok).toBe(false);
    expect(db.careSessions.require(sessionId).status).toBe('scheduled');
    expect(sessions.confirm(sessionId, true).ok).toBe(true);
    expect(db.careSessions.require(sessionId)).toMatchObject({ status: 'confirmed', homeVisitConfirmedSafe: true });
  });

  it('o psicólogo cancela: a vaga volta, a conversa some de "próximas" e a situação é "Cancelada pelo psicólogo", sem falta para o cuidador', async () => {
    const { CareSessionsService } = await import('../features/care-sessions/state/care-sessions.service');
    const { db } = boot(LOURDES);
    const session = db.careSessions.require('ses_0062');
    staffLogin(db.users.require(db.psychologists.require(session.psychologistId).userId).id);
    expect(TestBed.inject(CareSessionsService).cancel('ses_0062', 'psychologist').ok).toBe(true);
    expect(db.careSessions.require('ses_0062').status).toBe('cancelled_by_psychologist');
    expect(db.availabilitySlots.require(session.slotId).status).toBe('open');
    TestBed.inject(CaregiverSessionService).signIn(LOURDES);
    const conversations = TestBed.inject(ConversationsService);
    expect(conversations.upcoming()).toHaveLength(0);
    const shown = conversations.all().find((c) => c.id === 'ses_0062')!;
    expect(shown.statusText).toMatch(/psicólog/i);
    expect(shown.statusText).not.toMatch(/falta|no_show/i);
  });

  it('a equipe aceita e conclui o pedido: o cuidador passa a ver "Concluído: avalie" e consegue avaliar uma vez', async () => {
    const { NetworkAdminService } = await import('../features/network/state/network-admin.service');
    const { db } = boot(ANA);
    const network = TestBed.inject(CaregiverNetworkService);
    const created = network.createRequest(ANA, { providerId: 'prv_01', need: 'Fisioterapia', modality: 'home' });
    expect(created.ok).toBe(true);
    const id = created.ok ? created.value.id : '';
    staffLogin('u1'); // a gestão registra a resposta do profissional (ele não tem login)
    const admin = TestBed.inject(NetworkAdminService);
    expect(admin.respond(id, { accept: true }).ok).toBe(true);
    expect(admin.complete(id).ok).toBe(true);
    TestBed.inject(CaregiverSessionService).signIn(ANA);
    expect(network.toEvaluateCount(ANA)).toBe(1);
    expect(network.evaluate(ANA, id, { technical: 5, punctuality: 4 }).ok).toBe(true);
    expect(db.serviceRequests.require(id).status).toBe('evaluated');
    expect(network.toEvaluateCount(ANA)).toBe(0);
  });

  // QAC-012 (decidido): o prazo de correção vai até D+7 inclusive, como diz a RN-ARP-16 ("em até 7 dias"). O texto do
  // AC-CG-134 foi corrigido em `docs/10-cuidador-ux.md` para o mesmo ("7 dias ou menos"; "mais de 7 dias" encerra).
  // Este teste guarda o comportamento da regra.
  it('prazo de correção da avaliação (RN-ARP-16): editável até D+7 inclusive e encerrado em D+8', () => {
    const { db, clock } = boot(RITA);
    const network = TestBed.inject(CaregiverNetworkService);
    expect(network.evaluate(RITA, 'srq_0126', { technical: 5, punctuality: 5 }).ok).toBe(true);
    const evaluation = db.providerEvaluations.find((e) => e.serviceRequestId === 'srq_0126')!;
    expect(evaluation.editableUntil).toBe('2026-11-11');
    clock.setSimulated('2026-11-11', '23:59');
    expect(network.ordersOf(RITA).find((o) => o.request.id === 'srq_0126')?.evaluation?.canEdit).toBe(true);
    clock.setSimulated('2026-11-12', '00:00');
    expect(network.ordersOf(RITA).find((o) => o.request.id === 'srq_0126')?.evaluation?.canEdit).toBe(false);
    expect(network.correctEvaluation(RITA, 'srq_0126', { technical: 1, punctuality: 1 })).toMatchObject({ ok: false, error: 'Prazo de correção encerrado.' });
  });
});

// ===========================================================================================================
// Mais achados confirmados
// ===========================================================================================================
describe('QAC: sala do coworking e arquivo do titular', () => {
  // QAC-013: a conversa em coworking sempre fica com "a primeira sala reservável" (ordem alfabética), sem olhar se a sala
  // já está em uso no mesmo horário por outra conversa. Duas pessoas, dois psicólogos, mesmo horário: mesma sala.
  it('QAC-013: duas conversas em coworking no mesmo horário não ficam na mesma sala', () => {
    const { db } = boot(ANA);
    const make = (psychologistId: string) =>
      db.availabilitySlots.create({ psychologistId, date: '2026-11-12', start: '15:00', end: '16:00', status: 'open', priorityOnly: false });
    const a = make('psy_0001');
    const b = make('psy_0002');
    const first = TestBed.inject(ConversationsService).book({ slotId: a.id, psychologistId: 'psy_0001', format: 'in_person_coworking', kind: 'guidance', address: '' });
    TestBed.inject(CaregiverSessionService).signIn(RITA);
    const second = TestBed.inject(ConversationsService).book({ slotId: b.id, psychologistId: 'psy_0002', format: 'in_person_coworking', kind: 'guidance', address: '' });
    expect(first.ok && second.ok).toBe(true);
    const rooms = [first, second].map((r) => (r.ok ? db.careSessions.require(r.session.id).roomId : undefined));
    expect(rooms[0]).toBeDefined();
    expect(rooms[0]).not.toBe(rooms[1]);
  });

  // QAC-014: o arquivo "Meus dados" entrega ao titular as marcas internas da equipe nas mensagens (sinalização de risco,
  // dúvida de risco e quem assumiu) e dados de tratamento do pedido. O titular tem direito aos dados dele, não às
  // marcas de triagem de risco do atendimento (POP-05 é restrito).
  it('QAC-014: o arquivo do titular não leva a marca interna de risco das mensagens nem quem as assumiu', () => {
    const { db } = boot(ANA);
    const message = db.messages.create({
      channel: 'app',
      direction: 'in',
      caregiverId: ANA,
      body: 'Estou muito cansada',
      receivedAt: '2026-11-03T09:00:00-03:00',
      dueAt: '2026-11-04T09:00:00-03:00',
      status: 'in_progress',
      isSupportRequest: true,
      riskFlag: true,
      riskDoubt: true,
      assignedToUserId: 'u7',
    });
    expect(message.riskFlag).toBe(true);
    const json = TestBed.inject(DataSubjectRequestService).exportSubjectJson(ANA);
    expect(json).not.toContain('riskFlag');
    expect(json).not.toContain('riskDoubt');
    expect(json).not.toContain('assignedToUserId');
  });
});

describe('QAC: limites das entradas de texto e de data', () => {
  // QAC-015: o Começar limita o nome a 120 caracteres, mas o resto do app não limita nada: um compromisso, um remédio,
  // um pedido de serviço e uma mensagem de 10 mil caracteres são aceitos e gravados (e o armazenamento do navegador é pequeno).
  it('QAC-015a: textos livres de 10 mil caracteres são recusados (compromisso, remédio, pedido de serviço, mensagem)', () => {
    const { db } = boot(ANA);
    const huge = 'x'.repeat(10_000);
    const elderId = db.elders.find((e) => e.caregiverId === ANA)!.id;
    let accepted = 0;
    try {
      TestBed.inject(AgendaService).add(elderId, { title: huge, kind: 'other', date: '2026-11-10', time: '10:00', place: '', reminder: true });
      accepted += 1;
    } catch { /* recusar vale */ }
    try {
      TestBed.inject(MedicationService).add(elderId, { name: huge, dosage: '', times: ['08:00'], active: true });
      accepted += 1;
    } catch { /* recusar vale */ }
    const request = TestBed.inject(CaregiverNetworkService).createRequest(ANA, { providerId: 'prv_01', need: huge, modality: 'home' });
    accepted += request.ok ? 1 : 0;
    const message = TestBed.inject(CaregiverMessagesService).send(ANA, { subject: '', body: huge });
    accepted += message.ok ? 1 : 0;
    expect(accepted).toBe(0);
  });

  it('QAC-015b: a data de nascimento da pessoa idosa precisa ser uma data que existe (30/02 é recusado)', () => {
    boot(ANA);
    let threw = false;
    try {
      TestBed.inject(ProfileService).updateElder(ANA, { fullName: 'Dona Alice', birthDate: '2026-02-30', relationship: 'daughter', dependency: 'partial' });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
