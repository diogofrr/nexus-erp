import {
  DestroyRef,
  Injectable,
  InjectionToken,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Clock } from '../clock/clock.service';
import { epochMs } from '../clock/date-utils';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

export interface InactivityConfig {
  /** Expiração por inatividade (padrão 30 minutos, E-03). */
  timeoutMs: number;
  /** Aviso de expiração (padrão aos 28 minutos, 2 minutos antes). */
  warningMs: number;
  /** Intervalo de verificação. */
  tickMs: number;
}

export const INACTIVITY_CONFIG = new InjectionToken<InactivityConfig>('INACTIVITY_CONFIG', {
  providedIn: 'root',
  factory: () => ({ timeoutMs: 30 * 60_000, warningMs: 28 * 60_000, tickMs: 1000 }),
});

export type InactivityStatus = 'idle' | 'active' | 'warning' | 'expired';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Inatividade da sessão (AC-M01-07): aviso aos 28 minutos e expiração aos 30, em signals.
 * Mede o tempo FÍSICO (`Clock.realNowMs`): avançar o relógio simulado de demonstração não derruba a sessão.
 *
 * O shell mostra o modal quando `warningVisible()` é verdadeiro e chama `extend()` ("continuar") ou
 * `auth.logout()` ("sair"). Ligue ao login com `bindToAuth()` (feito no `app.config.ts`).
 */
@Injectable({ providedIn: 'root' })
export class InactivityService {
  private readonly config = inject(INACTIVITY_CONFIG);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly store = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly statusSignal = signal<InactivityStatus>('idle');
  private readonly secondsLeftSignal = signal<number | null>(null);
  private lastActivityMs = 0;
  private lastTouchMs = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listening = false;

  readonly status = this.statusSignal.asReadonly();
  /** Segundos até expirar (`null` quando não monitora). */
  readonly secondsLeft = this.secondsLeftSignal.asReadonly();
  /** O aviso de expiração está visível (SCR-M01-04)? */
  readonly warningVisible = computed(() => this.statusSignal() === 'warning');

  private readonly onActivity = (): void => this.registerActivity();

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Liga e desliga o monitoramento conforme o login. Chame no contexto de injeção (inicializador do app). */
  bindToAuth(): void {
    effect(() => {
      const authenticated = this.store.isAuthenticated();
      untracked(() => (authenticated ? this.start() : this.stop()));
    });
  }

  /** Começa a monitorar. A base é o `lastActivityAt` da sessão (sobrevive a recarregar a página). */
  start(): void {
    const session = this.store.session();
    this.lastActivityMs = session ? epochMs(session.lastActivityAt) : this.clock.realNowMs();
    this.lastTouchMs = this.lastActivityMs;
    this.statusSignal.set('active');
    this.attachListeners();
    if (this.timer === null) {
      this.timer = setInterval(() => this.evaluate(), this.config.tickMs);
    }
    this.evaluate();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.detachListeners();
    this.statusSignal.set('idle');
    this.secondsLeftSignal.set(null);
    this.store.setExpiring(false);
  }

  /**
   * Houve atividade do usuário. Enquanto o aviso está na tela, só `extend()` reinicia (o usuário decide
   * entre "continuar" e "sair"). A gravação na sessão é limitada a uma vez a cada 15 segundos.
   */
  registerActivity(nowMs: number = this.clock.realNowMs()): void {
    if (this.statusSignal() === 'warning' || this.statusSignal() === 'expired') {
      return;
    }
    this.lastActivityMs = nowMs;
    this.secondsLeftSignal.set(Math.ceil(this.config.timeoutMs / 1000));
    if (nowMs - this.lastTouchMs >= 15_000) {
      this.lastTouchMs = nowMs;
      this.auth.touch();
    }
  }

  /** "Continuar": reinicia a contagem e fecha o aviso. */
  extend(nowMs: number = this.clock.realNowMs()): void {
    this.lastActivityMs = nowMs;
    this.lastTouchMs = nowMs;
    this.statusSignal.set('active');
    this.store.setExpiring(false);
    this.auth.touch();
    this.evaluate(nowMs);
  }

  /** Reavalia o estado. Exposto para testes (passe o instante). */
  evaluate(nowMs: number = this.clock.realNowMs()): InactivityStatus {
    if (this.statusSignal() === 'idle') {
      return 'idle';
    }
    const elapsed = nowMs - this.lastActivityMs;
    if (elapsed >= this.config.timeoutMs) {
      this.statusSignal.set('expired');
      this.secondsLeftSignal.set(0);
      this.store.setExpiring(false);
      this.stopTimerOnly();
      this.auth.logout('inactivity');
      return 'expired';
    }
    this.secondsLeftSignal.set(Math.ceil((this.config.timeoutMs - elapsed) / 1000));
    if (elapsed >= this.config.warningMs) {
      this.statusSignal.set('warning');
      this.store.setExpiring(true);
      return 'warning';
    }
    this.statusSignal.set('active');
    this.store.setExpiring(false);
    return 'active';
  }

  private stopTimerOnly(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.detachListeners();
  }

  private attachListeners(): void {
    if (this.listening || typeof document === 'undefined') {
      return;
    }
    ACTIVITY_EVENTS.forEach((name) =>
      document.addEventListener(name, this.onActivity, { passive: true, capture: true }),
    );
    this.listening = true;
  }

  private detachListeners(): void {
    if (!this.listening || typeof document === 'undefined') {
      return;
    }
    ACTIVITY_EVENTS.forEach((name) =>
      document.removeEventListener(name, this.onActivity, { capture: true }),
    );
    this.listening = false;
  }
}
