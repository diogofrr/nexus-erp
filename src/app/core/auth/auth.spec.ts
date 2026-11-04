import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogService } from '../audit/audit-log.service';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { AppUser } from '../models/access';
import { configureCoreTest } from '../testing/test-helpers';
import { MAX_TWO_FACTOR_FAILURES, AuthService, TWO_FACTOR_CODE } from './auth.service';
import { authGuard, guestGuard, moduleGuard, permissionGuard, roleGuard } from './guards';
import { INACTIVITY_CONFIG, InactivityService } from './inactivity.service';
import { SessionStore } from './session.store';

const ROLE_BY_USER: Record<string, string> = {
  u1: 'partner',
  u2: 'technical_lead',
  u3: 'psychologist',
  u7: 'support',
  u9: 'provider',
};

function setup(
  options: Parameters<typeof configureCoreTest>[0] = { seed: true },
): ReturnType<typeof configureCoreTest> & { auth: AuthService; audit: AuditLogService } {
  const env = configureCoreTest(options);
  return { ...env, auth: TestBed.inject(AuthService), audit: TestBed.inject(AuditLogService) };
}

function login(auth: AuthService, userId: string): void {
  const outcome = auth.selectProfile(userId);
  if (outcome.status === 'needs_two_factor') {
    expect(auth.verifyTwoFactor(TWO_FACTOR_CODE).status).toBe('ok');
  }
}

describe('Login simulado por perfil (M01)', () => {
  it('lista exatamente os 12 usuários de demonstração (AC-M01-01)', () => {
    const { auth } = setup();
    expect(auth.demoUsers()).toHaveLength(12);
    auth.demoUsers().forEach((u) => {
      expect(u.demoDescription.length).toBeGreaterThan(10);
      expect(u.email.endsWith('@exemplo.com.br')).toBe(true);
    });
  });

  it('equipe exige o código 123456; credenciado entra sem segundo fator (AC-M01-02)', () => {
    const { auth } = setup();
    expect(auth.state()).toBe('anonymous');
    const staff = auth.selectProfile('u1');
    expect(staff).toMatchObject({ status: 'needs_two_factor', code: '123456' });
    expect(auth.state()).toBe('pending_2fa');
    expect(auth.pendingTwoFactorCode()).toBe('123456');
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.verifyTwoFactor('123456').status).toBe('ok');
    expect(auth.state()).toBe('authenticated');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.role()).toBe('partner');
    expect(auth.pendingTwoFactorCode()).toBeNull();
    auth.logout();
    expect(auth.selectProfile('u9')).toMatchObject({ status: 'authenticated' });
    expect(auth.state()).toBe('authenticated');
    expect(auth.role()).toBe('provider');
  });

  it('todos os perfis de equipe pedem o código e os 4 credenciados não', () => {
    const { auth } = setup();
    auth.demoUsers().forEach((u: AppUser) => {
      const outcome = auth.selectProfile(u.id);
      expect(outcome.status).toBe(u.role === 'provider' ? 'authenticated' : 'needs_two_factor');
      auth.cancelPendingTwoFactor();
      auth.logout();
    });
  });

  it('código errado mostra erro e não entra; o terceiro erro seguido volta à entrada (AC-M01-03)', () => {
    const { auth } = setup();
    auth.selectProfile('u2');
    expect(auth.verifyTwoFactor('000000')).toEqual({ status: 'wrong_code', attemptsLeft: 2 });
    expect(auth.verifyTwoFactor('111111')).toEqual({ status: 'wrong_code', attemptsLeft: 1 });
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.verifyTwoFactor('222222')).toEqual({ status: 'too_many_attempts' });
    expect(auth.state()).toBe('anonymous');
    expect(auth.session()).toBeNull();
    expect(auth.endReason()).toBe('two_factor_failures');
    expect(MAX_TWO_FACTOR_FAILURES).toBe(3);
  });

  it('o código precisa ter exatamente 6 dígitos numéricos', () => {
    const { auth } = setup();
    auth.selectProfile('u2');
    ['12345', '1234567', 'abcdef', '12 456', ''].forEach((code) =>
      expect(auth.verifyTwoFactor(code)).toEqual({ status: 'invalid_format' }),
    );
    expect(auth.verifyTwoFactor('123456').status).toBe('ok');
  });

  it('sem sessão pendente não há o que confirmar', () => {
    const { auth } = setup();
    expect(auth.verifyTwoFactor('123456')).toEqual({ status: 'no_pending_session' });
    login(auth, 'u1');
    expect(auth.verifyTwoFactor('123456')).toEqual({ status: 'no_pending_session' });
  });

  it('usuário inativo ou desconhecido não entra e a tentativa fica no log', () => {
    const { auth, db } = setup();
    db.users.update('u7', { active: false });
    const before = db.accessLog.size();
    expect(auth.selectProfile('u7')).toEqual({ status: 'denied', reason: 'inactive_user' });
    expect(auth.selectProfile('nao-existe')).toEqual({ status: 'denied', reason: 'unknown_user' });
    expect(auth.isAuthenticated()).toBe(false);
    expect(db.accessLog.size()).toBe(before + 1);
    expect(db.accessLog.list().at(-1)).toMatchObject({ action: 'denied', userId: 'u7' });
  });

  it('cada login e logout gera linha no log com perfil e horário (AC-M01-05)', () => {
    const { auth, db } = setup();
    const before = db.accessLog.size();
    login(auth, 'u7');
    auth.logout();
    const entries = db.accessLog.list().slice(before);
    expect(entries.map((e) => e.action)).toEqual(['login', 'logout']);
    entries.forEach((e) => {
      expect(e).toMatchObject({ userId: 'u7', role: 'support', entity: 'session' });
      expect(e.at).toBe('2026-11-04T12:00:00-03:00');
    });
  });

  it('trocar de perfil encerra a sessão anterior e registra a saída', () => {
    const { auth, db } = setup();
    login(auth, 'u1');
    const before = db.accessLog.size();
    auth.selectProfile('u9');
    expect(
      db.accessLog
        .list()
        .slice(before)
        .map((e) => `${e.action}:${e.userId}`),
    ).toEqual(['logout:u1', 'login:u9']);
    expect(auth.role()).toBe('provider');
    expect(auth.endReason()).toBeNull();
  });

  it('a sessão fica só em sessionStorage e some ao fechar a aba (AC-M01-04)', () => {
    const { auth, local, session } = setup();
    login(auth, 'u3');
    expect(session.data.has('nexus-erp:session')).toBe(true);
    expect(local.data.has('nexus-erp:session')).toBe(false);
    const stored = JSON.parse(session.data.get('nexus-erp:session') as string);
    expect(stored).toMatchObject({ userId: 'u3', role: 'psychologist', twoFactorVerified: true });
    // Nova aba: sessionStorage vazio e o mesmo localStorage.
    TestBed.resetTestingModule();
    const again = configureCoreTest({ local });
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    again.session.data.set('nexus-erp:session', JSON.stringify(stored));
    TestBed.resetTestingModule();
    const reloaded = configureCoreTest({ local, session: again.session });
    expect(reloaded.db.users.size()).toBe(12);
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
  });

  it('o ator carrega o psicólogo ou o prestador do usuário', () => {
    const { auth } = setup();
    login(auth, 'u3');
    expect(auth.actor()).toEqual({
      userId: 'u3',
      role: 'psychologist',
      psychologistId: 'psy_0001',
    });
    login(auth, 'u9');
    expect(auth.actor()).toEqual({ userId: 'u9', role: 'provider', providerId: 'prv_11' });
  });

  it('can e canOnRecord do usuário logado; sem sessão nega', () => {
    const { auth } = setup();
    expect(auth.can('dashboard', 'view')).toBe(false);
    login(auth, 'u3');
    expect(auth.can('zarit_individual', 'view')).toBe(true);
    expect(auth.can('finance', 'view')).toBe(false);
    expect(
      auth.canOnRecord('caregiver_registry', 'view', { assignedPsychologistId: 'psy_0001' }),
    ).toBe(true);
    expect(
      auth.canOnRecord('caregiver_registry', 'view', { assignedPsychologistId: 'psy_0002' }),
    ).toBe(false);
    expect(auth.hasRole('psychologist', 'support')).toBe(true);
    expect(auth.hasRole('partner')).toBe(false);
  });

  it('a rota pedida antes do login fica em memória, não na URL', () => {
    const { auth } = setup();
    auth.setReturnUrl('/app/cuidadores');
    expect(auth.consumeReturnUrl()).toBe('/app/cuidadores');
    expect(auth.consumeReturnUrl()).toBeNull();
  });
});

describe('Inatividade: aviso aos 28 e expiração aos 30 minutos (AC-M01-07)', () => {
  const MIN = 60_000;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function ready(): {
    auth: AuthService;
    inactivity: InactivityService;
    store: SessionStore;
    start: number;
    clock: Clock;
  } {
    const { auth, clock } = setup();
    login(auth, 'u3');
    const inactivity = TestBed.inject(InactivityService);
    const store = TestBed.inject(SessionStore);
    const start = Date.now();
    inactivity.start();
    inactivity.registerActivity(start);
    inactivity.extend(start);
    return { auth, inactivity, store, start, clock };
  }

  it('a configuração padrão é de 30 minutos com aviso aos 28', () => {
    setup();
    expect(TestBed.inject(INACTIVITY_CONFIG)).toMatchObject({
      timeoutMs: 30 * MIN,
      warningMs: 28 * MIN,
    });
  });

  it('ativo antes dos 28 minutos, aviso entre 28 e 30, expirado aos 30', () => {
    const { auth, inactivity, store, start } = ready();
    expect(inactivity.evaluate(start + 27 * MIN + 59_000)).toBe('active');
    expect(inactivity.warningVisible()).toBe(false);
    expect(auth.state()).toBe('authenticated');
    expect(inactivity.evaluate(start + 28 * MIN)).toBe('warning');
    expect(inactivity.warningVisible()).toBe(true);
    expect(inactivity.secondsLeft()).toBe(120);
    expect(store.expiring()).toBe(true);
    expect(auth.state()).toBe('expiring');
    expect(inactivity.evaluate(start + 30 * MIN)).toBe('expired');
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.state()).toBe('expired');
    expect(auth.endReason()).toBe('inactivity');
  });

  it('"continuar" no aviso reinicia a contagem', () => {
    const { auth, inactivity, start } = ready();
    inactivity.evaluate(start + 29 * MIN);
    expect(inactivity.warningVisible()).toBe(true);
    inactivity.extend(start + 29 * MIN);
    expect(inactivity.warningVisible()).toBe(false);
    expect(inactivity.evaluate(start + 50 * MIN)).toBe('active');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('atividade comum reinicia, mas com o aviso na tela só o "continuar" vale', () => {
    const { inactivity, start } = ready();
    inactivity.registerActivity(start + 20 * MIN);
    expect(inactivity.evaluate(start + 45 * MIN)).toBe('active'); // 25 min depois da atividade
    inactivity.evaluate(start + 20 * MIN + 29 * MIN);
    expect(inactivity.warningVisible()).toBe(true);
    inactivity.registerActivity(start + 20 * MIN + 29 * MIN + 1000);
    expect(inactivity.warningVisible()).toBe(true);
  });

  it('o logout em 30 minutos grava o log de inatividade', () => {
    const { inactivity, start } = ready();
    const db = TestBed.inject(Database);
    inactivity.evaluate(start + 31 * MIN);
    expect(db.accessLog.list().at(-1)).toMatchObject({
      action: 'logout',
      userId: 'u3',
      detail: 'sessão expirada por inatividade',
    });
  });

  it('avançar o relógio SIMULADO não derruba a sessão (a inatividade usa o tempo real)', () => {
    const { auth, inactivity, start, clock } = ready();
    clock.setSimulated('2027-01-01', '12:00');
    expect(inactivity.evaluate(start + 1000)).toBe('active');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('parar o monitoramento volta a "idle"', () => {
    const { inactivity } = ready();
    inactivity.stop();
    expect(inactivity.status()).toBe('idle');
    expect(inactivity.secondsLeft()).toBeNull();
    expect(inactivity.evaluate(Date.now() + 99 * MIN)).toBe('idle');
  });
});

describe('Guards de rota (AC-GL-04, AC-M01-06)', () => {
  let router: Router;

  function run(guard: CanActivateFn, url: string): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }
  const path = (tree: boolean | UrlTree): string =>
    tree instanceof UrlTree ? router.serializeUrl(tree) : String(tree);

  function boot(): { auth: AuthService; db: Database } {
    const env = configureCoreTest({ seed: true, providers: [provideRouter([])] });
    router = TestBed.inject(Router);
    return { auth: TestBed.inject(AuthService), db: env.db };
  }

  it('sem sessão, authGuard leva a /login e guarda a rota pedida em memória', () => {
    const { auth } = boot();
    expect(path(run(authGuard, '/app/painel'))).toBe('/login');
    expect(auth.consumeReturnUrl()).toBe('/app/painel');
  });

  it('com o segundo fator pendente, leva a /login/2fa', () => {
    const { auth } = boot();
    auth.selectProfile('u1');
    expect(path(run(authGuard, '/app/painel'))).toBe('/login/2fa');
  });

  it('autenticado passa; quem já entrou é levado da entrada à sua tela inicial', () => {
    const { auth } = boot();
    login(auth, 'u9');
    expect(run(authGuard, '/portal')).toBe(true);
    expect(path(run(guestGuard, '/login'))).toBe('/portal');
    auth.logout();
    expect(run(guestGuard, '/login')).toBe(true);
    login(auth, 'u1');
    expect(path(run(guestGuard, '/login'))).toBe('/app/painel');
  });

  it('provider abrindo /app/financeiro vai a /403 e grava denied (AC-M01-06)', () => {
    const { auth, db } = boot();
    login(auth, 'u9');
    const before = db.accessLog.size();
    expect(path(run(moduleGuard('finance'), '/app/financeiro'))).toBe('/403');
    const entry = db.accessLog.list().at(-1)!;
    expect(db.accessLog.size()).toBe(before + 1);
    expect(entry).toMatchObject({
      action: 'denied',
      userId: 'u9',
      role: 'provider',
      entity: 'route',
    });
    expect(entry.detail).toContain('/app/financeiro');
  });

  it('moduleGuard segue a matriz: o psicólogo não abre assinaturas, o atendimento não abre a Zarit', () => {
    const { auth } = boot();
    login(auth, 'u3');
    expect(run(moduleGuard('zarit'), '/app/acompanhamento')).toBe(true);
    expect(path(run(moduleGuard('subscriptions'), '/app/assinaturas'))).toBe('/403');
    auth.logout();
    login(auth, 'u7');
    expect(path(run(moduleGuard('zarit'), '/app/acompanhamento'))).toBe('/403');
    expect(run(moduleGuard('network'), '/app/rede')).toBe(true);
  });

  it('permissionGuard(resource) e roleGuard(...roles)', () => {
    const { auth } = boot();
    login(auth, 'u2');
    expect(run(permissionGuard('zarit_individual'), '/app/acompanhamento/fila')).toBe(true);
    expect(path(run(permissionGuard('finance'), '/app/financeiro'))).toBe('/403');
    expect(run(permissionGuard('lgpd_audit_log', 'update'), '/app/lgpd/log')).toBe(true);
    expect(path(run(permissionGuard('lgpd_audit_log', 'supervise'), '/app/lgpd/log'))).toBe('/403');
    expect(run(roleGuard('technical_lead', 'partner'), '/x')).toBe(true);
    expect(path(run(roleGuard('provider'), '/portal'))).toBe('/403');
    // Recurso só embutido (plano do cuidador) não é tela para o psicólogo.
    auth.logout();
    login(auth, 'u3');
    expect(path(run(permissionGuard('plans_subscriptions'), '/app/assinaturas'))).toBe('/403');
  });

  it('sem sessão, os guards de permissão levam a /login', () => {
    boot();
    expect(path(run(permissionGuard('dashboard'), '/app/painel'))).toBe('/login');
    expect(path(run(roleGuard('partner'), '/x'))).toBe('/login');
    expect(path(run(moduleGuard('dashboard'), '/app/painel'))).toBe('/login');
  });

  it('cada perfil abre o próprio painel', () => {
    const { auth } = boot();
    Object.keys(ROLE_BY_USER).forEach((userId) => {
      auth.logout();
      login(auth, userId);
      const role = ROLE_BY_USER[userId];
      if (role === 'provider') {
        expect(run(moduleGuard('provider-portal'), '/portal')).toBe(true);
        expect(path(run(moduleGuard('dashboard'), '/app/painel'))).toBe('/403');
      } else {
        expect(run(moduleGuard('dashboard'), '/app/painel')).toBe(true);
      }
    });
  });
});
