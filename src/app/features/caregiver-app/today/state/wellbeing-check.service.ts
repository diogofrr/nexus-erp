import { Injectable, inject } from '@angular/core';
import { Clock } from '../../../../core/clock/clock.service';
import { Database } from '../../../../core/data/database';
import { ID, ISODate, WellbeingCheck } from '../../../../core/models';
import { ConsentService } from '../../../../core/privacy/consent.service';

/** O humor não pôde ser anotado (sem a autorização de dados de saúde). A frase é para a tela. */
export class WellbeingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WellbeingError';
  }
}

export type MoodScore = WellbeingCheck['mood'];

/**
 * "Como você está hoje?" (RN-USR-05). O humor é DADO DE SAÚDE: só se anota com a autorização de saúde vigente
 * (S-29, RN-LGPD-04 e 14), e a checagem fica AQUI, na borda do serviço, não só na tela. Um registro por dia: tocar
 * de novo em "Mudar" substitui o do dia. O cuidador não gera linha de log do próprio dado. A coleção
 * `wellbeingChecks` também é lida por Como estou (P2), só para leitura.
 *
 * ```ts
 * const wellbeing = inject(WellbeingCheckService);
 * wellbeing.forDay('cg_0001', '2026-11-04');   // WellbeingCheck | undefined (reativo)
 * wellbeing.record('cg_0001', 4);              // grava ou troca o do dia
 * ```
 */
@Injectable({ providedIn: 'root' })
export class WellbeingCheckService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly consent = inject(ConsentService);

  /** O registro do dia (reativo: lê a coleção por signal). */
  forDay(caregiverId: ID, date: ISODate): WellbeingCheck | undefined {
    return this.db.wellbeingChecks.find((c) => c.caregiverId === caregiverId && c.date === date);
  }

  /** Anota o humor de hoje, ou troca o que já estava anotado. Sem autorização de saúde, recusa. */
  record(caregiverId: ID, mood: MoodScore): WellbeingCheck {
    if (!this.consent.isActive(caregiverId, 'health_data')) {
      throw new WellbeingError('Para anotar como você está, precisamos da sua autorização de dados de saúde.');
    }
    const date = this.clock.today();
    const existing = this.forDay(caregiverId, date);
    return existing
      ? this.db.wellbeingChecks.update(existing.id, { mood })
      : this.db.wellbeingChecks.create({ caregiverId, date, mood });
  }
}
