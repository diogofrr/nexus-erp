import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { AuthService, TWO_FACTOR_CODE } from './core/auth/auth.service';
import { MODULES } from './core/auth/module-map';
import { Clock } from './core/clock/clock.service';
import { Database } from './core/data/database';
import {
  CROSS_TAB_SUBSCRIBE,
  LOCAL_STORAGE_BACKEND,
  SESSION_STORAGE_BACKEND,
} from './core/storage/storage-tokens';
import { CrossTabBus, FakeStorage, configureCoreTest } from './core/testing/test-helpers';
import { ModulePlaceholderComponent } from './features/_placeholder/module-placeholder.component';
import { ROUTES as AUTH_ROUTES } from './features/auth/auth.routes';

describe('App', () => {
  it('cria a raiz do aplicativo', async () => {
    configureCoreTest({ seed: true, providers: [provideRouter(routes)] });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('o placeholder mostra o título e "Módulo em construção"', async () => {
    TestBed.configureTestingModule({ imports: [ModulePlaceholderComponent] });
    const fixture = TestBed.createComponent(ModulePlaceholderComponent);
    fixture.componentRef.setInput('title', 'Cuidadores');
    fixture.componentRef.setInput('moduleId', 'M03');
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Cuidadores');
    expect(text).toContain('M03');
    expect(text).toContain('Módulo em construção');
  });

  it('cada módulo do mapa tem rota lazy e seu arquivo de rotas exporta ROUTES', async () => {
    const app = routes.find((r) => r.path === 'app');
    const children = app?.children ?? [];
    const segments = children.map((r) => r.path);
    MODULES.forEach((m) => expect(segments, m.key).toContain(m.segment));
    expect(routes.map((r) => r.path)).toEqual(
      expect.arrayContaining(['login', '403', 'app', '**']),
    );
    // O portal do prestador credenciado (M14) foi removido por decisão do dono.
    expect(routes.map((r) => r.path)).not.toContain('portal');
    expect(AUTH_ROUTES.length).toBeGreaterThan(0);
    // Carrega cada feature (os imports dinâmicos precisam resolver).
    const loaders = [...children, ...routes].filter((r) => typeof r.loadChildren === 'function');
    expect(loaders.length).toBe(21);
    for (const route of loaders) {
      const loaded = await (route.loadChildren as () => Promise<unknown>)();
      expect(Array.isArray(loaded)).toBe(true);
      expect((loaded as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it('o roteador leva o perfil ao seu painel e nega a rota de outro perfil (AC-M01-06)', async () => {
    const env = configureCoreTest({ seed: true, providers: [provideRouter(routes)] });
    void env;
    const router = TestBed.inject(Router);
    const auth = TestBed.inject(AuthService);

    // Sem sessão: vai à entrada.
    await router.navigateByUrl('/app/cuidadores');
    expect(router.url).toBe('/login');

    // Sócia abre o financeiro; atendimento não.
    auth.selectProfile('u1');
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
    await router.navigateByUrl('/app/financeiro');
    expect(router.url).toBe('/app/financeiro');
    auth.selectProfile('u7');
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
    await router.navigateByUrl('/app/painel');
    expect(router.url).toBe('/app/painel');
    await router.navigateByUrl('/app/financeiro');
    expect(router.url).toBe('/403');

    // Rota inexistente.
    await router.navigateByUrl('/nao-existe');
    expect(router.url).toBe('/nao-existe');
  });

  it('o inicializador do aplicativo gera o seed na primeira visita e não gera de novo na segunda', async () => {
    const local = new FakeStorage();
    const providers = [
      ...appConfig.providers,
      { provide: LOCAL_STORAGE_BACKEND, useValue: local },
      { provide: SESSION_STORAGE_BACKEND, useValue: new FakeStorage() },
      { provide: CROSS_TAB_SUBSCRIBE, useValue: new CrossTabBus().subscribe },
    ];
    TestBed.configureTestingModule({ providers });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    const db = TestBed.inject(Database);
    expect(db.caregivers.size()).toBe(340);
    expect(db.demoState()?.seedName).toBe('nexus-seed-1');
    db.caregivers.update('cg_0001', { fullName: 'Alterada' });
    TestBed.inject(Clock).stopTicker();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    expect(TestBed.inject(Database).caregivers.get('cg_0001')?.fullName).toBe('Alterada');
    TestBed.inject(Clock).stopTicker();
  });
});
