import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthService, TWO_FACTOR_CODE } from '../auth/auth.service';
import { Database } from '../data/database';
import { Caregiver } from '../models/caregivers';
import { isCpfChecksumValid } from '../rules/validators';
import { configureCoreTest } from '../testing/test-helpers';
import {
  BrowserDataService,
  FIRST_VISIT_NOTICE,
  PROTOTYPE_NOTICE,
  UiNoticeService,
} from './browser-data.service';
import { ConsentError, ConsentService } from './consent.service';
import { DataSubjectRequestError, DataSubjectRequestService } from './data-subject-request.service';
import { RETENTION_BLOCK_NOTE, RetentionService } from './retention.service';

function setup(): {
  db: Database;
  env: ReturnType<typeof configureCoreTest>;
  consent: ConsentService;
  retention: RetentionService;
  dsr: DataSubjectRequestService;
  auth: AuthService;
} {
  const env = configureCoreTest({ seed: true, time: '10:00' });
  const auth = TestBed.inject(AuthService);
  if (auth.selectProfile('u7').status === 'needs_two_factor') {
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
  }
  return {
    env,
    db: env.db,
    auth,
    consent: TestBed.inject(ConsentService),
    retention: TestBed.inject(RetentionService),
    dsr: TestBed.inject(DataSubjectRequestService),
  };
}

const newCaregiver = (db: Database): Caregiver =>
  db.caregivers.create({
    code: 'CUI-0341',
    fullName: 'Cuidadora Nova',
    cpf: '000.000.341-00',
    cpfIsFictitious: true,
    email: 'cuidadora.nova@exemplo.com.br',
    phone: '(34) 90000-0341',
    birthDate: '1980-01-01',
    sex: 'female',
    relationship: 'daughter',
    city: 'Uberlândia',
    dailyCareHours: 3,
    preferredChannel: 'app',
    digitalLiteracy: 'medium',
    status: 'active',
    enrolledAt: '2026-11-04',
    isPilot: false,
  });

describe('ConsentService (RN-LGPD-03 a 06, 14; LP-04 a LP-06)', () => {
  it('cadastro novo nasce com os 6 consentimentos pendentes (AC-M03-02)', () => {
    const { db, consent } = setup();
    const cg = newCaregiver(db);
    expect(consent.list(cg.id).every((c) => c.status === 'pending')).toBe(true);
    const created = consent.initializeForNewCaregiver(cg.id);
    expect(created).toHaveLength(6);
    expect(created.every((c) => c.status === 'pending' && c.currentTermVersion === '1.0')).toBe(
      true,
    );
    expect(consent.initializeForNewCaregiver(cg.id)).toHaveLength(6);
    expect(db.consents.count((c) => c.caregiverId === cg.id)).toBe(6);
  });

  it('lê o estado e o histórico dos cenários do seed', () => {
    const { consent } = setup();
    expect(consent.status('cg_0016', 'health_data')).toBe('revoked');
    expect(consent.isActive('cg_0016', 'health_data')).toBe(false);
    expect(consent.isActive('cg_0001', 'health_data')).toBe(true);
    expect(consent.status('cg_0017', 'image_testimony')).toBe('refused');
    expect(consent.history('cg_0016', 'health_data').map((e) => e.status)).toEqual([
      'granted',
      'revoked',
    ]);
    expect(consent.list('cg_0001').map((c) => c.key)).toEqual([
      'health_data',
      'people_analytics',
      'family_sharing',
      'image_testimony',
      'whatsapp_contact',
      'pilot_tcle',
    ]);
    expect(consent.effectsOf('whatsapp_contact', 'refuse')[0]).toContain(
      'aplicativo, telefone ou e-mail',
    );
    expect(consent.effectsOf('family_sharing', 'revoke')[0]).toContain('desfeitos');
  });

  it('conceder, recusar e revogar geram eventos append-only e logs', () => {
    const { db, consent } = setup();
    const cg = newCaregiver(db);
    consent.initializeForNewCaregiver(cg.id);
    const events = db.consentEvents.size();
    const logs = db.accessLog.size();
    const granted = consent.grant(cg.id, 'health_data', {
      channel: 'in_person',
      evidence: 'Formulário em papel',
    });
    expect(granted.consent.status).toBe('granted');
    expect(granted.event).toMatchObject({
      key: 'health_data',
      status: 'granted',
      termVersion: '1.0',
      channel: 'in_person',
      registeredByUserId: 'u7',
      evidence: 'Formulário em papel',
    });
    expect(granted.event.at).toBe('2026-11-04T10:00:00-03:00');
    const refused = consent.refuse(cg.id, 'image_testimony', { channel: 'app' });
    expect(refused.consent.status).toBe('refused');
    consent.revoke(cg.id, 'health_data', { channel: 'phone' });
    expect(db.consentEvents.size()).toBe(events + 3);
    expect(db.accessLog.size()).toBe(logs + 3);
    expect(consent.history(cg.id).map((e) => `${e.key}:${e.status}`)).toEqual([
      'health_data:granted',
      'image_testimony:refused',
      'health_data:revoked',
    ]);
    expect(db.accessLog.list().at(-1)).toMatchObject({
      action: 'create',
      entity: 'consent_event',
      subjectCaregiverId: cg.id,
    });
  });

  it('recusar um consentimento não muda os outros nem bloqueia o Livre (LP-05, AC-M12-01)', () => {
    const { db, consent } = setup();
    const cg = newCaregiver(db);
    consent.initializeForNewCaregiver(cg.id);
    consent.grant(cg.id, 'health_data', { channel: 'app' });
    consent.grant(cg.id, 'whatsapp_contact', { channel: 'app' });
    const before = consent.list(cg.id).map((c) => `${c.key}:${c.status}`);
    consent.refuse(cg.id, 'image_testimony', { channel: 'app' });
    const after = consent.list(cg.id).map((c) => `${c.key}:${c.status}`);
    expect(after.filter((x) => !x.startsWith('image_testimony'))).toEqual(
      before.filter((x) => !x.startsWith('image_testimony')),
    );
    expect(db.caregivers.get(cg.id)?.status).toBe('active');
  });

  it('transições inválidas: revogar o que não foi concedido; recusar o que está concedido', () => {
    const { db, consent } = setup();
    const cg = newCaregiver(db);
    consent.initializeForNewCaregiver(cg.id);
    expect(() => consent.revoke(cg.id, 'health_data', { channel: 'app' })).toThrow(ConsentError);
    consent.grant(cg.id, 'health_data', { channel: 'app' });
    expect(() => consent.refuse(cg.id, 'health_data', { channel: 'app' })).toThrow(ConsentError);
    expect(() => consent.grant('cg_inexistente', 'health_data', { channel: 'app' })).toThrow(
      ConsentError,
    );
  });

  it('é preciso saber quem registrou', () => {
    const { db, consent, auth } = setup();
    const cg = newCaregiver(db);
    auth.logout();
    expect(() => consent.grant(cg.id, 'health_data', { channel: 'app' })).toThrow(
      'Informe quem está registrando',
    );
    expect(
      consent.grant(cg.id, 'health_data', { channel: 'app', registeredByUserId: 'u8' }).event
        .registeredByUserId,
    ).toBe('u8');
  });

  it('revogar a saúde aplica na hora os efeitos de RN-LGPD-14 (AC-M06-09, AC-M03-10)', () => {
    const { db, consent } = setup();
    expect(db.zaritAlerts.get('zal_0001')?.status).toBe('open');
    const result = consent.revoke('cg_0001', 'health_data', { channel: 'phone' });
    expect(db.caregivers.get('cg_0001')?.status).toBe('paused_by_consent_revocation');
    expect(
      db.zaritAlerts.query((a) => a.caregiverId === 'cg_0001' && a.status !== 'closed'),
    ).toHaveLength(0);
    const closed = db.zaritAlerts.get('zal_0001');
    expect(closed).toMatchObject({ status: 'closed', closureNote: 'consentimento revogado' });
    const arbe = db.arbeAlerts.query((a) => a.caregiverId === 'cg_0001');
    expect(
      arbe.every((a) => a.status === 'closed' && a.closureReason === 'consentimento revogado'),
    ).toBe(true);
    expect(result.appliedEffects.join(' ')).toContain('Cadastro pausado');
    expect(result.appliedEffects.join(' ')).toContain('Novas aplicações da Zarit ficam bloqueadas');
    expect(consent.isActive('cg_0001', 'health_data')).toBe(false);
  });

  it('conceder a saúde de novo reativa o cadastro pausado', () => {
    const { db, consent } = setup();
    expect(db.caregivers.get('cg_0016')?.status).toBe('paused_by_consent_revocation');
    const result = consent.grant('cg_0016', 'health_data', { channel: 'phone' });
    expect(db.caregivers.get('cg_0016')?.status).toBe('active');
    expect(result.appliedEffects[0]).toContain('reativado');
    expect(consent.history('cg_0016', 'health_data').map((e) => e.status)).toEqual([
      'granted',
      'revoked',
      'granted',
    ]);
  });

  it('revogar o TCLE tira do piloto; revogar o WhatsApp troca o canal; People Analytics só sai dos agregados', () => {
    const { db, consent } = setup();
    const pilot = consent.revoke('cg_0003', 'pilot_tcle', { channel: 'phone' });
    expect(db.caregivers.get('cg_0003')?.isPilot).toBe(false);
    expect(db.pilotEnrollments.find((p) => p.caregiverId === 'cg_0003')?.exitedAt).toBe(
      '2026-11-04',
    );
    expect(pilot.appliedEffects[0]).toContain('retirado do piloto');
    expect(db.caregivers.get('cg_0002')?.preferredChannel).toBe('whatsapp');
    consent.revoke('cg_0002', 'whatsapp_contact', { channel: 'phone' });
    expect(db.caregivers.get('cg_0002')?.preferredChannel).toBe('app');
    expect(
      consent.revoke('cg_0001', 'people_analytics', { channel: 'phone' }).appliedEffects,
    ).toEqual([]);
    expect(db.caregivers.get('cg_0001')?.status).toBe('active');
  });

  it('versão nova do termo deixa o consentimento "desatualizado" (LP-06)', () => {
    const { db, consent } = setup();
    expect(consent.outdated('cg_0001')).toHaveLength(0);
    const term = db.consentTerms.find((t) => t.key === 'health_data' && t.active)!;
    db.consentTerms.update(term.id, { version: '1.1' });
    expect(consent.activeTermVersion('health_data')).toBe('1.1');
    expect(consent.outdated('cg_0001').map((c) => c.key)).toEqual(['health_data']);
    consent.grant('cg_0001', 'health_data', { channel: 'app' });
    expect(consent.outdated('cg_0001')).toHaveLength(0);
  });
});

describe('RetentionService: eliminação, bloqueio e anonimização (RN-LGPD-23, 24; AC-M12-04, 05)', () => {
  it('o plano mostra o que apaga e o que fica bloqueado por registro documental', () => {
    const { retention } = setup();
    const plan = retention.plan('cg_0018');
    expect(plan.willErase.map((i) => i.label).join(' ')).toContain('Dados de contato');
    expect(plan.willErase.map((i) => i.label)).toContain('Mensagens');
    expect(plan.willBlock.map((i) => i.label)).toContain('Aplicações da Escala de Zarit');
    expect(plan.blockedUntil).toBe('2031-11-04');
    expect(plan.note).toBe(
      'Retido por registro documental por 5 anos; motivo: Res. CFP 1/2009 (a confirmar).',
    );
    expect(RETENTION_BLOCK_NOTE).toBe(plan.note);
  });

  it('eliminar apaga contato e mensagens e BLOQUEIA Zarit e anotações', () => {
    const { db, retention } = setup();
    const messages = db.messages.count((m) => m.caregiverId === 'cg_0018');
    expect(messages).toBeGreaterThan(0);
    const result = retention.erase('cg_0018');
    expect(result.erasedRecords).toBeGreaterThan(0);
    expect(result.blockedRecords).toBeGreaterThan(0);
    const cg = db.caregivers.get('cg_0018')!;
    expect(cg).toMatchObject({
      status: 'closed',
      closedAt: '2026-11-04',
      fullName: 'Titular eliminado (CUI-0018)',
      phone: '(34) 90000-0000',
    });
    expect(cg.erasedAt).toBeDefined();
    expect(isCpfChecksumValid(cg.cpf)).toBe(false);
    expect(cg.email).toBe('cui-0018@exemplo.com.br');
    expect(db.messages.count((m) => m.caregiverId === 'cg_0018')).toBe(0);
    expect(db.elders.find((e) => e.caregiverId === 'cg_0018')?.fullName).toBe(
      'Eliminado (CUI-0018)',
    );
    const zarit = db.zaritAssessments.query(
      (z) => z.caregiverId === 'cg_0018' && z.status === 'completed',
    );
    expect(zarit.length).toBeGreaterThan(0);
    zarit.forEach((z) =>
      expect(z.retentionBlock).toMatchObject({
        until: '2031-11-04',
        basis: 'Res. CFP 1/2009 (a confirmar)',
      }),
    );
    expect(retention.isBlocked(zarit[0]!.retentionBlock)).toBe(true);
    expect(retention.isBlocked(zarit[0]!.retentionBlock, '2031-11-04')).toBe(false);
    expect(db.subscriptions.find((s) => s.caregiverId === 'cg_0018')?.status).toBe('cancelled');
    expect(db.accessLog.list().at(-1)).toMatchObject({
      action: 'delete',
      entity: 'caregiver_data',
      subjectCaregiverId: 'cg_0018',
    });
  });

  it('anonimizar troca identificadores pelo código e mantém os agregados', () => {
    const { db, retention } = setup();
    const zaritBefore = db.zaritAssessments.count((z) => z.caregiverId === 'cg_0019');
    retention.anonymize('cg_0019');
    const cg = db.caregivers.get('cg_0019')!;
    expect(cg).toMatchObject({
      fullName: 'CUI-0019',
      email: 'cui-0019@exemplo.com.br',
      phone: '(34) 90000-0000',
    });
    expect(cg.anonymizedAt).toBeDefined();
    expect(cg.status).toBe('active');
    expect(db.elders.find((e) => e.caregiverId === 'cg_0019')?.fullName).toBe(
      'Pessoa idosa de CUI-0019',
    );
    expect(db.zaritAssessments.count((z) => z.caregiverId === 'cg_0019')).toBe(zaritBefore);
    expect(db.caregivers.size()).toBe(340);
  });

  it('simula a passagem do tempo: cadastros a eliminar e bloqueios que vencem (LP-19)', () => {
    const { db, retention } = setup();
    db.caregivers.update('cg_0030', { status: 'closed', closedAt: '2026-09-01' });
    db.caregivers.update('cg_0031', { status: 'closed', closedAt: '2026-10-20' });
    const now = retention.simulate();
    expect(now.cadastresToErase).toEqual(['cg_0030']);
    expect(retention.simulate('2026-12-01').cadastresToErase).toEqual(['cg_0030', 'cg_0031']);
    expect(now.accessLogToDiscard).toBe(0);
    retention.erase('cg_0018');
    expect(retention.simulate('2031-11-03').documentaryBlocksExpired.zaritAssessments).toBe(0);
    expect(
      retention.simulate('2031-11-04').documentaryBlocksExpired.zaritAssessments,
    ).toBeGreaterThan(0);
    expect(retention.simulate('2032-01-01').accessLogToDiscard).toBe(db.accessLog.size());
    expect(retention.cadastreErasureDueDate('2026-11-04')).toBe('2026-12-04');
  });
});

describe('DataSubjectRequestService: direitos do titular (RN-LGPD-20, 21; LP-17, LP-18)', () => {
  it('abre com protocolo DSR-0000, prazo de 15 dias e estado aberto', () => {
    const { dsr, db } = setup();
    const request = dsr.open({ caregiverId: 'cg_0005', type: 'access' });
    expect(request).toMatchObject({
      protocol: 'DSR-0006',
      status: 'open',
      openedAt: '2026-11-04',
      dueAt: '2026-11-19',
      caregiverId: 'cg_0005',
    });
    expect(dsr.open({ caregiverId: 'cg_0005', type: 'sharing_info' }).protocol).toBe('DSR-0007');
    expect(db.accessLog.list().at(-1)).toMatchObject({
      action: 'create',
      entity: 'data_subject_request',
    });
    expect(() => dsr.open({ caregiverId: 'nao-existe', type: 'access' })).toThrow(
      DataSubjectRequestError,
    );
  });

  it('o prazo de 15 dias vem das configurações', () => {
    const { dsr, db } = setup();
    db.settings.patch({ dsrDeadlineDays: 10 });
    expect(dsr.open({ caregiverId: 'cg_0005', type: 'access' }).dueAt).toBe('2026-11-14');
  });

  it('o seed: exclusão vence em 5 dias, correção vence em breve (2 dias), portabilidade concluída (AC-M12-03)', () => {
    const { dsr } = setup();
    const byCaregiver = (n: number) => dsr.forCaregiver(`cg_00${n}`)[0]!;
    expect(dsr.deadline(byCaregiver(18))).toEqual({
      state: 'on_time',
      daysRemaining: 5,
      label: 'Vence em 5 dias',
    });
    expect(dsr.deadline(byCaregiver(20))).toEqual({
      state: 'due_soon',
      daysRemaining: 2,
      label: 'Vence em breve (2 dias)',
    });
    expect(dsr.deadline(byCaregiver(19)).state).toBe('done');
    expect(dsr.deadline(byCaregiver(18), '2026-11-12').state).toBe('overdue');
    expect(dsr.list().map((r) => r.dueAt)).toEqual([...dsr.list().map((r) => r.dueAt)].sort());
  });

  it('começar, concluir e rejeitar; rejeição exige motivo; solicitação encerrada não reabre', () => {
    const { dsr, db } = setup();
    const request = dsr.open({ caregiverId: 'cg_0005', type: 'correction' });
    expect(dsr.start(request.id)).toMatchObject({ status: 'in_progress', handledByUserId: 'u7' });
    expect(() => dsr.reject(request.id, '  ')).toThrow('motivo por escrito');
    const done = dsr.complete(request.id, 'Dado corrigido.');
    expect(done).toMatchObject({
      status: 'completed',
      completedAt: '2026-11-04',
      resolutionNote: 'Dado corrigido.',
    });
    expect(() => dsr.start(request.id)).toThrow('já foi encerrada');
    const other = dsr.open({ caregiverId: 'cg_0005', type: 'access' });
    expect(dsr.reject(other.id, 'Titular não identificado.')).toMatchObject({
      status: 'rejected_with_reason',
      rejectedReason: 'Titular não identificado.',
    });
    expect(db.dataSubjectRequests.get(other.id)?.status).toBe('rejected_with_reason');
  });

  it('atender a eliminação conclui informando motivo e prazo da retenção (AC-M12-04)', () => {
    const { dsr, db } = setup();
    const erasure = db.dataSubjectRequests.find((r) => r.caregiverId === 'cg_0018')!;
    const done = dsr.executeErasure(erasure.id);
    expect(done.status).toBe('completed');
    expect(done.retentionBlockNote).toBe(
      'Retido por registro documental por 5 anos; motivo: Res. CFP 1/2009 (a confirmar).',
    );
    expect(db.caregivers.get('cg_0018')?.status).toBe('closed');
    expect(() => dsr.executeErasure(erasure.id)).toThrow('já foi encerrada');
    const access = dsr.open({ caregiverId: 'cg_0005', type: 'access' });
    expect(() => dsr.executeErasure(access.id)).toThrow('não é de eliminação');
    expect(() => dsr.executeAnonymization(access.id)).toThrow('não é de anonimização');
  });

  it('atender a anonimização conclui a solicitação', () => {
    const { dsr, db } = setup();
    const request = dsr.open({ caregiverId: 'cg_0006', type: 'anonymization_or_blocking' });
    expect(dsr.executeAnonymization(request.id).status).toBe('completed');
    expect(db.caregivers.get('cg_0006')?.fullName).toBe('CUI-0006');
  });

  it('a portabilidade exporta SOMENTE os dados do titular e gera log export (AC-M03-13, LP-12)', () => {
    const { dsr, db } = setup();
    const before = db.accessLog.size();
    const data = dsr.exportSubject('cg_0019');
    expect(data.format).toBe('nexus-erp/titular/1');
    expect(data.subject.code).toBe('CUI-0019');
    expect(data.subject.consents).toHaveLength(6);
    expect((data.subject.zaritAssessments as unknown[]).length).toBeGreaterThan(0);
    expect((data.subject.dataSubjectRequests as { type: string }[])[0]!.type).toBe('portability');
    const json = dsr.exportSubjectJson('cg_0019');
    expect(JSON.parse(json).subject.code).toBe('CUI-0019');
    const others = json.match(/cg_\d{4}/g)!.filter((id) => id !== 'cg_0019');
    expect(others).toEqual([]);
    expect(json).not.toContain('Ana Paula Ferraz');
    expect(db.accessLog.size()).toBe(before + 2);
    expect(db.accessLog.list().at(-1)).toMatchObject({
      action: 'export',
      entity: 'subject_portability',
      subjectCaregiverId: 'cg_0019',
    });
  });
});

describe('BrowserDataService e UiNoticeService (LP-01, AC-M12-10)', () => {
  it('o banner da primeira visita some depois do "Entendi" e grava nexus-erp:ui-notice com a data', () => {
    const env = configureCoreTest({ seed: true });
    const notice = TestBed.inject(UiNoticeService);
    expect(notice.bannerVisible()).toBe(true);
    notice.acknowledge();
    expect(notice.bannerVisible()).toBe(false);
    expect(notice.acknowledgedAt()).toBe('2026-11-04');
    expect(JSON.parse(env.local.data.get('nexus-erp:ui-notice') as string)).toEqual({
      at: '2026-11-04',
    });
    TestBed.resetTestingModule();
    configureCoreTest({ local: env.local });
    expect(TestBed.inject(UiNoticeService).bannerVisible()).toBe(false);
    expect(PROTOTYPE_NOTICE).toBe(
      'Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador.',
    );
    expect(FIRST_VISIT_NOTICE.acknowledge).toBe('Entendi');
  });

  it('apagar todos os dados limpa as chaves nexus-erp:, encerra a sessão e volta o banner', () => {
    const { env, auth, db } = setup();
    const notice = TestBed.inject(UiNoticeService);
    notice.acknowledge();
    env.local.data.set('outro-app:chave', 'fica');
    const service = TestBed.inject(BrowserDataService);
    expect(service.usage().totalBytes).toBeGreaterThan(100_000);
    service.eraseAll();
    expect([...env.local.data.keys()]).toEqual(['outro-app:chave']);
    expect(env.session.data.size).toBe(0);
    expect(auth.isAuthenticated()).toBe(false);
    expect(db.caregivers.size()).toBe(0);
    expect(notice.bannerVisible()).toBe(true);
    expect(service.usage().items).toEqual([]);
  });
});
