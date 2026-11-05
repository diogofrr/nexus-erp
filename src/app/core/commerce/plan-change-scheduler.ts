import { Injectable, Injector, computed, effect, inject, untracked } from '@angular/core';
import { Clock } from '../clock/clock.service';
import { SubscriptionService } from './subscription.service';

/**
 * Aplica as mudanças de plano agendadas sem depender de uma tela aberta (M04, RN-PLN-14).
 *
 * Descida de plano e cancelamento só valem no fim do ciclo. Antes, quem aplicava era a tela de assinaturas ou
 * de cadastro ao abrir; agora o aplicativo também aplica ao iniciar (`start`) e SEMPRE que a data de hoje muda,
 * seja pela virada real do dia ou por o relógio simulado (M15) avançar. O trabalho em si é do
 * `SubscriptionService.applyDueChanges`, que continua sendo chamado pelas telas e é idempotente.
 *
 * Só o inicializador do aplicativo liga este serviço: testes de tela e de serviço não o instanciam, então nada
 * muda de um instante para outro dentro deles.
 */
@Injectable({ providedIn: 'root' })
export class PlanChangeScheduler {
  private readonly clock = inject(Clock);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly injector = inject(Injector);

  /** Só muda quando o DIA muda: o tique do relógio a cada 30 segundos não dispara nada. */
  private readonly today = computed(() => this.clock.today());
  private started = false;

  /** Aplica o que já venceu agora e passa a aplicar quando a data de hoje muda. Chamar uma vez, na inicialização. */
  start(): number {
    if (this.started) {
      return 0;
    }
    this.started = true;
    const applied = this.subscriptions.applyDueChanges();
    let last = this.today();
    effect(
      () => {
        const day = this.today();
        untracked(() => {
          if (day !== last) {
            last = day;
            this.subscriptions.applyDueChanges();
          }
        });
      },
      { injector: this.injector },
    );
    return applied;
  }
}
