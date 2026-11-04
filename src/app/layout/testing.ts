import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from '../app';
import { routes } from '../app.routes';
import { AuthService, TWO_FACTOR_CODE } from '../core/auth/auth.service';
import { Clock } from '../core/clock/clock.service';
import { Database } from '../core/data/database';
import { CoreTestOptions, FakeStorage, configureCoreTest } from '../core/testing/test-helpers';
import { HARD_NAVIGATE } from '../shared/ui/overlay/hard-navigation';

/**
 * Ajudantes de teste do shell e das telas de M01 e M15: sobem a raiz do aplicativo com o roteador de verdade,
 * o seed completo e (opcionalmente) um usuário conectado. Só para `*.spec.ts`; nenhum código do app importa
 * este arquivo.
 */
export interface BootedApp {
  fixture: ComponentFixture<App>;
  root: HTMLElement;
  router: Router;
  auth: AuthService;
  db: Database;
  clock: Clock;
  local: FakeStorage;
  session: FakeStorage;
  /** Endereços para onde o app pediu uma recarga completa (apagar tudo). */
  hardNavigations: string[];
}

export interface BootOptions extends Omit<CoreTestOptions, 'providers'> {
  /** Usuário do seed que já entra (`u1`, `u9`...). Sem ele, ninguém está conectado. */
  userId?: string;
  /** Rota aberta ao subir. */
  url?: string;
}

/** Entra como o usuário do seed, passando pelo segundo fator quando o perfil exige. */
export function signIn(userId: string): void {
  const auth = TestBed.inject(AuthService);
  const outcome = auth.selectProfile(userId);
  if (outcome.status === 'needs_two_factor') {
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
  }
}

/** Espera o app acomodar (roteamento, efeitos e renderização). */
export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await fixture.whenStable();
  }
}

export async function bootApp(options: BootOptions = {}): Promise<BootedApp> {
  const hardNavigations: string[] = [];
  const env = configureCoreTest({
    seed: true,
    ...options,
    providers: [
      provideRouter(routes),
      { provide: HARD_NAVIGATE, useValue: (path: string) => hardNavigations.push(path) },
    ],
  });
  if (options.userId) {
    signIn(options.userId);
  }
  const fixture = TestBed.createComponent(App);
  const router = TestBed.inject(Router);
  await router.navigateByUrl(options.url ?? (options.userId === 'u9' ? '/portal' : '/app/painel'));
  await settle(fixture);
  return {
    fixture,
    root: fixture.nativeElement as HTMLElement,
    router,
    auth: TestBed.inject(AuthService),
    db: env.db,
    clock: env.clock,
    local: env.local,
    session: env.session,
    hardNavigations,
  };
}
