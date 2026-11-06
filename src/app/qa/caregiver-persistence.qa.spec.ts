/**
 * QA do aplicativo do cuidador: persistência, robustez e cadastro de quem é novo (`docs/13-qa-cuidador.md`).
 * `it.fails(...)` com `QAC-NNN` guarda o comportamento CORRETO de um bug confirmado (ver `caregiver-regression.qa.spec.ts`).
 */
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthService, TWO_FACTOR_CODE } from '../core/auth/auth.service';
import { CaregiverSessionService } from '../core/auth/caregiver-session.service';
import { DoseCheckService } from '../core/care/dose-check.service';
import { configureCoreTest } from '../core/testing/test-helpers';
import { CaregiverContextService } from '../features/caregiver-app/state/caregiver-context.service';
import { CaregiverDirectory } from '../features/caregivers/state/caregiver-directory.service';
import { SignupService } from '../features/caregiver-app/start/state/signup.service';
import { bootCaregiverApp, settleCaregiver } from '../features/caregiver-app/testing';

const ANA = 'cg_0001';

function boot(caregiverId: string | null) {
  const env = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
  if (caregiverId) {
    expect(TestBed.inject(CaregiverSessionService).signIn(caregiverId).status).toBe('ok');
  }
  return env;
}

afterEach(() => TestBed.resetTestingModule());

describe('QAC: persistência e robustez', () => {
  it('banco antigo sem a coleção doseChecks abre sem erro, marca dose e guarda depois de recarregar', () => {
    const first = boot(null);
    const raw = JSON.parse(first.db.exportJson()) as { collections: Record<string, unknown[]> };
    expect(raw.collections['doseChecks']!.length).toBeGreaterThan(0);
    // O navegador de quem usou a versão anterior não tem a chave da coleção nova.
    const local = first.local;
    const doseKey = [...local.data.keys()].find((k) => k.endsWith(':doseChecks'));
    expect(doseKey).toBeDefined();
    local.data.delete(doseKey!);
    TestBed.resetTestingModule();
    const env = configureCoreTest({ seed: false, local, session: first.session, today: '2026-11-04', time: '12:00' });
    expect(env.db.doseChecks.count()).toBe(0);
    expect(env.db.medications.count()).toBeGreaterThan(0);
    TestBed.inject(CaregiverSessionService).signIn(ANA);
    const elder = env.db.elders.find((e) => e.caregiverId === ANA)!;
    const med = env.db.medications.find((m) => m.elderId === elder.id && m.active)!;
    TestBed.inject(DoseCheckService).mark(med.id, '2026-11-04', med.times[0]!);
    TestBed.resetTestingModule();
    const again = configureCoreTest({ seed: false, local, session: first.session, today: '2026-11-04', time: '12:00' });
    expect(again.db.doseChecks.count()).toBe(1);
  });

  it('exportar e importar guarda as marcações de remédio; uma cópia sem doseChecks esvazia as marcações em vez de deixar sobras', () => {
    const { db } = boot(ANA);
    const before = db.doseChecks.count();
    expect(before).toBeGreaterThan(0);
    const json = db.exportJson();
    expect(db.importJson(json).ok).toBe(true);
    expect(db.doseChecks.count()).toBe(before);
    const old = JSON.parse(json) as { collections: Record<string, unknown> };
    delete old.collections['doseChecks'];
    expect(db.importJson(JSON.stringify(old)).ok).toBe(true);
    expect(db.doseChecks.count()).toBe(0);
  });

  it('"Resetar para o seed" com o cuidador dentro: a sessão segue valendo para quem existe no seed e cai para quem foi criado no cadastro', () => {
    const { db } = boot(ANA);
    const session = TestBed.inject(CaregiverSessionService);
    expect(session.isSignedIn()).toBe(true);
    db.seed();
    expect(session.isSignedIn()).toBe(true);
    expect(TestBed.inject(CaregiverContextService).planId()).toBe('cuida');
    const created = TestBed.inject(SignupService).create(
      { ...TestBed.inject(SignupService).example(), whatsapp: '', choices: {} },
      '2026-11-04T12:00:00-03:00',
    );
    expect(session.caregiverId()).toBe(created.caregiverId);
    db.seed();
    expect(session.isSignedIn()).toBe(false);
  });

  // QAC-010 (corrigido no Fix B): o shell do cuidador mostra uma faixa calma quando o navegador não guarda (a mesma fonte da
  // equipe, `StorageService.notices`), e o aviso do "Dei" não diz só "anotado". Antes era `it.fails`.
  it('QAC-010: com o armazenamento do navegador cheio, o cuidador é avisado de que o "Dei" não foi guardado', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/rotina/remedios' });
    app.local.failOnSet = true;
    const dei = Array.from(app.root.querySelectorAll<HTMLElement>('main button')).find((b) => (b.textContent ?? '').trim() === 'Dei');
    expect(dei).toBeDefined();
    dei!.click();
    await settleCaregiver(app.fixture);
    const text = (app.root.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Dado às');
    // A marcação existe só em memória (o armazenamento recusou a gravação)...
    const key = [...app.local.data.keys()].find((k) => k.endsWith(':doseChecks'));
    const stored = JSON.parse(key ? (app.local.data.get(key) ?? '[]') : '[]') as unknown[];
    expect(stored.length).toBeLessThan(app.db.doseChecks.count());
    // ...e a tela precisa dizer isso em algum lugar.
    expect(text).toMatch(/espaço de armazenamento|não foi guardad|não ficou guardad|só ficam em memória|não está guardando/i);
    // A faixa calma do shell e o aviso rápido do "Dei" dizem o que fazer e que a marca não foi guardada.
    expect((app.root.querySelector('[data-role="storage-note"]')?.textContent ?? '').trim()).toBe(
      'O navegador não está guardando o que você faz. Libere espaço ou o armazenamento do site e recarregue.',
    );
    expect(text).toContain('mas não foi guardado');
  });

  it('QAC-010: com o armazenamento bloqueado desde o começo a faixa já está no alto; com o armazenamento normal ela não aparece', async () => {
    const blocked = await bootCaregiverApp(ANA, { url: '/cuidador/hoje', noStorage: true });
    expect(blocked.root.querySelector('[data-role="storage-note"]')).not.toBeNull();
    TestBed.resetTestingModule();
    const normal = await bootCaregiverApp(ANA, { url: '/cuidador/hoje' });
    expect(normal.root.querySelector('[data-role="storage-note"]')).toBeNull();
  });

  it('armazenamento do navegador bloqueado desde o começo: o app do cuidador abre e funciona em memória', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/hoje', noStorage: true });
    expect(app.root.querySelector('main h1')?.textContent).toContain('Ana');
    expect(app.root.textContent).toContain('Dei');
  });
});

describe('QAC: cadastro de quem é novo e o que a equipe vê', () => {
  it('nasce CUI-0341 no plano Livre, com 6 consentimentos, eventos do canal app e o aviso de emergência aceito', () => {
    const { db } = boot(null);
    const signup = TestBed.inject(SignupService);
    const example = signup.example();
    const created = signup.create(
      { ...example, whatsapp: '', choices: { health_data: 'granted', whatsapp_contact: 'refused', family_sharing: 'pending' } },
      '2026-11-04T12:00:00-03:00',
    );
    expect(created.caregiver).toMatchObject({ id: 'cg_0341', code: 'CUI-0341', status: 'active', emergencyNoticeAcceptedAt: '2026-11-04T12:00:00-03:00' });
    expect(db.subscriptions.find((s) => s.caregiverId === 'cg_0341')).toMatchObject({ planId: 'livre', status: 'active', payer: 'self' });
    const consents = db.consents.query((c) => c.caregiverId === 'cg_0341');
    expect(consents).toHaveLength(6);
    expect(Object.fromEntries(consents.map((c) => [c.key, c.status]))).toMatchObject({
      health_data: 'granted',
      whatsapp_contact: 'refused',
      family_sharing: 'pending',
      people_analytics: 'pending',
      image_testimony: 'pending',
      pilot_tcle: 'pending',
    });
    expect(db.consentEvents.query((e) => e.caregiverId === 'cg_0341').map((e) => e.channel)).toEqual(['app', 'app']);
    expect(db.elders.find((e) => e.caregiverId === 'cg_0341')).toBeDefined();
    expect(TestBed.inject(CaregiverSessionService).caregiverId()).toBe('cg_0341');
    // O que a equipe vê: o novo cuidador está na lista do ERP.
    const auth = TestBed.inject(AuthService);
    auth.selectProfile('u7');
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
    expect(TestBed.inject(CaregiverDirectory).rows().some((r) => r.id === 'cg_0341')).toBe(true);
  });

  it('canal WhatsApp sem a autorização de WhatsApp nasce como aplicativo, e CPF repetido é recusado', () => {
    const { db } = boot(null);
    const signup = TestBed.inject(SignupService);
    const base = signup.example();
    const first = signup.create({ ...base, channel: 'whatsapp', whatsapp: '(34) 90000-0001', choices: { whatsapp_contact: 'refused' } }, '2026-11-04T12:00:00-03:00');
    expect(first.caregiver.preferredChannel).toBe('app');
    expect(db.caregivers.require(first.caregiverId).whatsapp).toBe('(34) 90000-0001');
    TestBed.inject(CaregiverSessionService).signOut();
    expect(() => signup.create({ ...base, whatsapp: '', choices: {} }, '2026-11-04T12:00:00-03:00')).toThrow('Já existe um cuidador com este CPF fictício.');
  });
});
