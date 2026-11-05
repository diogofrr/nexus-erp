import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/auth/auth.service';
import { CaregiverSessionService } from '../../core/auth/caregiver-session.service';
import { Clock } from '../../core/clock/clock.service';
import { Database } from '../../core/data/database';
import { CoreTestOptions, FakeStorage, configureCoreTest } from '../../core/testing/test-helpers';
import { HARD_NAVIGATE } from '../../shared/ui/overlay/hard-navigation';
import { ViewportService, NavLayout } from '../../layout/state/viewport.service';
import { CaregiverContextService } from './state/caregiver-context.service';

/**
 * Ajudantes de teste do aplicativo do cuidador, no estilo de `layout/testing.ts` (`bootApp`): sobem a raiz do
 * aplicativo com o roteador de verdade, o seed completo e a sessão de um cuidador. Só para `*.spec.ts`; nenhum
 * código do app importa este arquivo.
 *
 * ```ts
 * const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/remedios' });
 * expect(app.root.querySelector('h1')?.textContent).toContain('Remédios');
 * app.context.canUse('groups');           // plano Cuida: true
 * ```
 */
export interface BootedCaregiverApp {
  fixture: ComponentFixture<App>;
  root: HTMLElement;
  router: Router;
  /** A sessão da equipe (fica fora quando o cuidador entra). */
  auth: AuthService;
  session: CaregiverSessionService;
  context: CaregiverContextService;
  db: Database;
  clock: Clock;
  local: FakeStorage;
  sessionBackend: FakeStorage;
  /** Endereços para onde o app pediu uma recarga completa. */
  hardNavigations: string[];
}

export interface CaregiverBootOptions extends Omit<CoreTestOptions, 'providers'> {
  /** Rota aberta ao subir (padrão `/cuidador/hoje`). */
  url?: string;
  /**
   * Largura simulada do aplicativo: `drawer` (abaixo de 1024 px, barra inferior) ou `full` e `rail` (navegação no
   * cabeçalho). O jsdom não tem `matchMedia`, então o padrão é a tela larga.
   */
  layout?: NavLayout;
}

/** Espera o app acomodar (roteamento, efeitos e renderização). */
export async function settleCaregiver(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await fixture.whenStable();
  }
}

/**
 * Sobe o aplicativo com o cuidador `caregiverId` já dentro (por exemplo `cg_0001`, a Ana). Com `null`, ninguém
 * está dentro (cadastro de quem é novo, entrada). A sessão é aberta ANTES da primeira navegação, então os guards
 * já enxergam o cuidador.
 */
export async function bootCaregiverApp(
  caregiverId: string | null,
  options: CaregiverBootOptions = {},
): Promise<BootedCaregiverApp> {
  const hardNavigations: string[] = [];
  const { url, layout, ...core } = options;
  const env = configureCoreTest({
    seed: true,
    ...core,
    providers: [
      provideRouter(routes),
      { provide: HARD_NAVIGATE, useValue: (path: string) => hardNavigations.push(path) },
    ],
  });
  const session = TestBed.inject(CaregiverSessionService);
  if (caregiverId) {
    const outcome = session.signIn(caregiverId);
    if (outcome.status !== 'ok') {
      throw new Error(`O cuidador ${caregiverId} não pôde entrar: ${outcome.reason}`);
    }
  }
  if (layout) {
    TestBed.inject(ViewportService).set(layout);
  }
  const fixture = TestBed.createComponent(App);
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url ?? '/cuidador/hoje');
  await settleCaregiver(fixture);
  return {
    fixture,
    root: fixture.nativeElement as HTMLElement,
    router,
    auth: TestBed.inject(AuthService),
    session,
    context: TestBed.inject(CaregiverContextService),
    db: env.db,
    clock: env.clock,
    local: env.local,
    sessionBackend: env.session,
    hardNavigations,
  };
}
