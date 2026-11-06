import { Injectable, inject } from '@angular/core';
import { CaregiverOwnership } from '../auth/caregiver-ownership';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { ID, ISODate, WellbeingCheck } from '../models';
import { ConsentService } from '../privacy/consent.service';

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
 * de novo em "Mudar" substitui o do dia. O cuidador não gera linha de log do próprio dado. Hoje (P1) e Como estou (P2)
 * usam este mesmo serviço, por isso ele mora no núcleo.
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
  private readonly ownership = inject(CaregiverOwnership);

  /**
   * O registro do dia (reativo: lê a coleção por signal). Sem a autorização de saúde vigente devolve nada: o humor é dado de
   * saúde e a leitura também cessa na borda do serviço, não só na tela (RN-LGPD-14, S-28; QAC-002). Reconceder religa.
   */
  forDay(caregiverId: ID, date: ISODate): WellbeingCheck | undefined {
    if (!this.canRead(caregiverId)) {
      return undefined;
    }
    return this.db.wellbeingChecks.find((c) => c.caregiverId === caregiverId && c.date === date);
  }

  /** Os registros de um período (inclusive as duas pontas), do mais recente. Vale a mesma regra de `forDay`. */
  range(caregiverId: ID, from: ISODate, to: ISODate): WellbeingCheck[] {
    if (!this.canRead(caregiverId)) {
      return [];
    }
    return this.db.wellbeingChecks
      .query((w) => w.caregiverId === caregiverId && w.date >= from && w.date <= to)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Anota o humor de hoje, ou troca o que já estava anotado. Sem autorização de saúde, recusa. */
  record(caregiverId: ID, mood: MoodScore): WellbeingCheck {
    this.ownership.assertCaregiver(caregiverId);
    if (!this.consent.isActive(caregiverId, 'health_data')) {
      throw new WellbeingError('Para anotar como você está, precisamos da sua autorização de dados de saúde.');
    }
    const date = this.clock.today();
    const existing = this.forDay(caregiverId, date);
    return existing
      ? this.db.wellbeingChecks.update(existing.id, { mood })
      : this.db.wellbeingChecks.create({ caregiverId, date, mood });
  }

  private canRead(caregiverId: ID): boolean {
    return this.ownership.ownsCaregiver(caregiverId) && this.consent.isActive(caregiverId, 'health_data');
  }
}
