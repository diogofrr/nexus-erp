import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { InactivityService } from './core/auth/inactivity.service';
import { Clock } from './core/clock/clock.service';
import { Database } from './core/data/database';
import { UiPrefsService } from './shared/ui/overlay/ui-prefs.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Nova página abre no topo; voltar ao histórico restaura a rolagem (a lista volta onde estava, U-05).
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    // Na inicialização: aplica o tema escolhido (antes da primeira tela, sem piscar), garante esquema e dados
    // (seed na primeira visita), liga o tique do relógio e a inatividade da sessão (aviso aos 28 minutos,
    // expiração aos 30).
    provideAppInitializer(() => {
      inject(UiPrefsService);
      inject(Database).ensureSeeded();
      inject(Clock).startTicker();
      inject(InactivityService).bindToAuth();
    }),
  ],
};
