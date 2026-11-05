import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { describe, expect, it } from 'vitest';
import { Database } from '../data/database';
import { FakeStorage, configureCoreTest } from '../testing/test-helpers';
import { AuthService, TWO_FACTOR_CODE } from './auth.service';
import {
  CAREGIVER_ACCESS_BLOCK_TEXT,
  CAREGIVER_HOME_PATH,
  caregiverAccessBlock,
} from './caregiver-access';
import { CaregiverSessionService } from './caregiver-session.service';
import {
  authGuard,
  caregiverAreaGuard,
  caregiverGuard,
  guestGuard,
  homeRedirectGuard,
  moduleGuard,
  permissionGuard,
  roleGuard,
} from './guards';

function setup(): {
  db: Database;
  auth: AuthService;
  caregiver: CaregiverSessionService;
  router: Router;
  session: FakeStorage;
  local: FakeStorage;
} {
  const env = configureCoreTest({ seed: true, providers: [provideRouter([])] });
  return {
    db: env.db,
    session: env.session,
    local: env.local,
    auth: TestBed.inject(AuthService),
    caregiver: TestBed.inject(CaregiverSessionService),
    router: TestBed.inject(Router),
  };
}

function staffLogin(auth: AuthService, userId: string): void {
  if (auth.selectProfile(userId).status === 'needs_two_factor') {
    expect(auth.verifyTwoFactor(TWO_FACTOR_CODE).status).toBe('ok');
  }
}

describe('Quem pode entrar no aplicativo do cuidador (função pura)', () => {
  it('recusa cadastro inexistente, encerrado, anonimizado ou eliminado; aceita o resto', () => {
    expect(caregiverAccessBlock(undefined)).toBe('unknown');
    expect(caregiverAccessBlock(null)).toBe('unknown');
    expect(caregiverAccessBlock({ status: 'closed' })).toBe('closed');
    expect(
      caregiverAccessBlock({ status: 'active', anonymizedAt: '2026-11-01T10:00:00-03:00' }),
    ).toBe('anonymized');
    expect(caregiverAccessBlock({ status: 'closed', erasedAt: '2026-11-01T10:00:00-03:00' })).toBe(
      'erased',
    );
    // Pedido de exclusão aberto e consentimento de saúde revogado entram normalmente.
    expect(caregiverAccessBlock({ status: 'closure_requested' })).toBeNull();
    expect(caregiverAccessBlock({ status: 'paused_by_consent_revocation' })).toBeNull();
    expect(caregiverAccessBlock({ status: 'active' })).toBeNull();
  });

  it('cada motivo tem uma frase em linguagem simples, sem travessão', () => {
    Object.values(CAREGIVER_ACCESS_BLOCK_TEXT).forEach((text) => {
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toContain(String.fromCharCode(0x2013));
      expect(text).not.toContain(String.fromCharCode(0x2014));
    });
  });
});

describe('Sessão do cuidador (CaregiverSessionService)', () => {
  it('entra, guarda na chave nexus-erp:caregiver-session do armazenamento de sessão e sai', () => {
    const { caregiver, session, local } = setup();
    expect(caregiver.isSignedIn()).toBe(false);
    expect(caregiver.caregiverId()).toBeNull();

    const outcome = caregiver.signIn('cg_0001');
    expect(outcome.status).toBe('ok');
    expect(caregiver.isSignedIn()).toBe(true);
    expect(caregiver.caregiverId()).toBe('cg_0001');
    expect(caregiver.caregiver()?.fullName).toBe('Ana Paula Ferraz');
    const raw = session.getItem('nexus-erp:caregiver-session');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ caregiverId: 'cg_0001' });
    // Nada vai para o armazenamento persistente.
    expect(local.getItem('nexus-erp:caregiver-session')).toBeNull();

    caregiver.signOut();
    expect(caregiver.isSignedIn()).toBe(false);
    expect(session.getItem('nexus-erp:caregiver-session')).toBeNull();
  });

  it('a sessão sobrevive a recarregar a página (relê o armazenamento de sessão)', () => {
    const session = new FakeStorage();
    const local = new FakeStorage();
    configureCoreTest({ seed: true, session, local });
    TestBed.inject(CaregiverSessionService).signIn('cg_0003');
    TestBed.resetTestingModule();
    configureCoreTest({ seed: false, session, local });
    expect(TestBed.inject(CaregiverSessionService).isSignedIn()).toBe(true);
    expect(TestBed.inject(CaregiverSessionService).caregiverId()).toBe('cg_0003');
  });

  it('recusa cadastro desconhecido, encerrado, anonimizado e eliminado, sem abrir sessão', () => {
    const { db, caregiver, session } = setup();
    expect(caregiver.signIn('cg_9999')).toEqual({ status: 'denied', reason: 'unknown' });
    db.caregivers.update('cg_0004', { status: 'closed' });
    expect(caregiver.signIn('cg_0004')).toEqual({ status: 'denied', reason: 'closed' });
    db.caregivers.update('cg_0005', { anonymizedAt: '2026-11-01T10:00:00-03:00' });
    expect(caregiver.signIn('cg_0005')).toEqual({ status: 'denied', reason: 'anonymized' });
    db.caregivers.update('cg_0006', { erasedAt: '2026-11-01T10:00:00-03:00', status: 'closed' });
    expect(caregiver.signIn('cg_0006')).toEqual({ status: 'denied', reason: 'erased' });
    expect(caregiver.isSignedIn()).toBe(false);
    expect(session.getItem('nexus-erp:caregiver-session')).toBeNull();
  });

  it('quem tem pedido de exclusão aberto entra normalmente (cg_0018 e status closure_requested)', () => {
    const { db, caregiver } = setup();
    expect(db.dataSubjectRequests.find((r) => r.caregiverId === 'cg_0018' && r.type === 'erasure')?.status).toBe('open');
    expect(caregiver.signIn('cg_0018').status).toBe('ok');
    caregiver.signOut();
    db.caregivers.update('cg_0018', { status: 'closure_requested' });
    expect(caregiver.signIn('cg_0018').status).toBe('ok');
  });

  it('a sessão deixa de valer se o cadastro for encerrado depois de entrar', () => {
    const { db, caregiver } = setup();
    caregiver.signIn('cg_0001');
    db.caregivers.update('cg_0001', { status: 'closed' });
    expect(caregiver.isSignedIn()).toBe(false);
    expect(caregiver.caregiverId()).toBeNull();
  });

  it('uma sessão por vez: entrar como cuidador encerra a da equipe e entrar como equipe encerra a do cuidador', () => {
    const { db, auth, caregiver } = setup();
    staffLogin(auth, 'u7');
    expect(auth.isAuthenticated()).toBe(true);
    const logBefore = db.accessLog.size();
    caregiver.signIn('cg_0002');
    expect(auth.isAuthenticated()).toBe(false);
    expect(caregiver.isSignedIn()).toBe(true);
    // A saída da equipe é registrada no log; a entrada do cuidador não gera linha.
    expect(db.accessLog.size()).toBe(logBefore + 1);
    expect(db.accessLog.list().at(-1)).toMatchObject({ action: 'logout', userId: 'u7' });

    staffLogin(auth, 'u1');
    expect(caregiver.isSignedIn()).toBe(false);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('entrar e sair como cuidador não grava nada no log de auditoria', () => {
    const { db, caregiver } = setup();
    const before = db.accessLog.size();
    caregiver.signIn('cg_0001');
    caregiver.signOut();
    expect(db.accessLog.size()).toBe(before);
  });
});

describe('Guards do aplicativo do cuidador', () => {
  function run(guard: CanActivateFn, url: string): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }
  const where = (router: Router, tree: boolean | UrlTree): string =>
    tree instanceof UrlTree ? router.serializeUrl(tree) : String(tree);

  it('caregiverGuard: com sessão de cuidador passa', () => {
    const { caregiver } = setup();
    caregiver.signIn('cg_0001');
    expect(run(caregiverGuard, '/cuidador/hoje')).toBe(true);
  });

  it('caregiverGuard: sem sessão vai a /login e guarda a rota pedida em memória', () => {
    const { auth, router } = setup();
    expect(where(router, run(caregiverGuard, '/cuidador/rotina/agenda'))).toBe('/login');
    expect(auth.consumeReturnUrl()).toBe('/cuidador/rotina/agenda');
  });

  it('caregiverGuard: a equipe com sessão volta ao painel; segundo fator pendente volta ao código', () => {
    const { auth, router } = setup();
    expect(auth.selectProfile('u1').status).toBe('needs_two_factor');
    expect(where(router, run(caregiverGuard, '/cuidador/hoje'))).toBe('/login/2fa');
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
    expect(where(router, run(caregiverGuard, '/cuidador/hoje'))).toBe('/app/painel');
  });

  it('caregiverAreaGuard: abre para quem não entrou e para o cuidador, nunca para a equipe', () => {
    const { auth, caregiver, router } = setup();
    expect(run(caregiverAreaGuard, '/cuidador/comecar')).toBe(true);
    caregiver.signIn('cg_0001');
    expect(run(caregiverAreaGuard, '/cuidador/hoje')).toBe(true);
    staffLogin(auth, 'u3');
    expect(where(router, run(caregiverAreaGuard, '/cuidador/hoje'))).toBe('/app/painel');
  });

  it('a sessão de cuidador nunca abre /app/**: os guards da equipe levam a /cuidador/hoje, sem guardar a rota', () => {
    const { auth, caregiver, router } = setup();
    caregiver.signIn('cg_0001');
    expect(where(router, run(authGuard, '/app/painel'))).toBe(CAREGIVER_HOME_PATH);
    expect(where(router, run(moduleGuard('dashboard'), '/app/painel'))).toBe(CAREGIVER_HOME_PATH);
    expect(where(router, run(permissionGuard('dashboard'), '/app/painel'))).toBe(
      CAREGIVER_HOME_PATH,
    );
    expect(where(router, run(roleGuard('partner'), '/app/financeiro'))).toBe(CAREGIVER_HOME_PATH);
    expect(auth.consumeReturnUrl()).toBeNull();
  });

  it('guestGuard: o cuidador que já entrou não vê a entrada, e a equipe segue como antes', () => {
    const { auth, caregiver, router } = setup();
    expect(run(guestGuard, '/login')).toBe(true);
    caregiver.signIn('cg_0001');
    expect(where(router, run(guestGuard, '/login'))).toBe(CAREGIVER_HOME_PATH);
    caregiver.signOut();
    staffLogin(auth, 'u1');
    expect(where(router, run(guestGuard, '/login'))).toBe('/app/painel');
  });

  it('homeRedirectGuard: a raiz leva cada um ao seu lugar', () => {
    const { auth, caregiver, router } = setup();
    expect(where(router, run(homeRedirectGuard, '/'))).toBe('/login');
    caregiver.signIn('cg_0001');
    expect(where(router, run(homeRedirectGuard, '/'))).toBe(CAREGIVER_HOME_PATH);
    caregiver.signOut();
    staffLogin(auth, 'u2');
    expect(where(router, run(homeRedirectGuard, '/'))).toBe('/app/painel');
    auth.logout();
    expect(auth.selectProfile('u1').status).toBe('needs_two_factor');
    expect(where(router, run(homeRedirectGuard, '/'))).toBe('/login/2fa');
  });
});
