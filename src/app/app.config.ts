import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { InactivityService } from './core/auth/inactivity.service';
import { Clock } from './core/clock/clock.service';
import { Database } from './core/data/database';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Na inicialização: garante esquema e dados (seed na primeira visita), liga o tique do relógio
    // e a inatividade da sessão (aviso aos 28 minutos, expiração aos 30).
    provideAppInitializer(() => {
      inject(Database).ensureSeeded();
      inject(Clock).startTicker();
      inject(InactivityService).bindToAuth();
    }),
  ],
};
