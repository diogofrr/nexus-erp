import { Injectable, inject } from '@angular/core';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { Caregiver, ID } from '@core/models';

/**
 * Quem vê e quem age no acompanhamento (matriz 1.2, RN-ZRT-19, RN-ARBE-07): o resultado individual da Zarit e
 * os alertas são do psicólogo do caso (nível `C`) e do responsável técnico (supervisão `S`, com motivo e log).
 * A gestão vê só agregado (mínimo 5) e o atendimento não vê nada, nem "existe alerta".
 *
 * O RT também registra contato e avaliação de risco em nome da equipe quando o prazo do vermelho vence
 * (RN-ZRT-14, escalada ao RT, e UX F06). A aplicação da escala é só do psicólogo do caso (RN-ZRT-04).
 */
@Injectable({ providedIn: 'root' })
export class ZaritAccessService {
  private readonly auth = inject(AuthService);
  private readonly db = inject(Database);

  /** O usuário atual é o psicólogo do caso? */
  ownsCase(caregiver: Pick<Caregiver, 'assignedPsychologistId'> | undefined): boolean {
    const actor = this.auth.actor();
    return (
      actor?.role === 'psychologist' &&
      actor.psychologistId !== undefined &&
      caregiver?.assignedPsychologistId === actor.psychologistId
    );
  }

  isSupervisor(): boolean {
    return this.auth.role() === 'technical_lead';
  }

  /** Pode abrir o conteúdo individual (psicólogo do caso ou RT). */
  canView(caregiverId: ID): boolean {
    return this.ownsCase(this.db.caregivers.get(caregiverId)) || this.isSupervisor();
  }

  /** O RT precisa informar o motivo para abrir qualquer caso: nenhum é dele (F16-A, U-13). */
  mustJustify(caregiverId: ID): boolean {
    return this.isSupervisor() && !this.ownsCase(this.db.caregivers.get(caregiverId));
  }

  /** Aplica a escala: só o psicólogo do caso. */
  canApply(caregiverId: ID): boolean {
    return this.ownsCase(this.db.caregivers.get(caregiverId));
  }

  /** Registra contato, risco, encaminhamento e encerra: psicólogo do caso ou RT. */
  canAct(caregiverId: ID): boolean {
    return this.canView(caregiverId);
  }

  /** Cuidadores que o usuário pode acompanhar: os do psicólogo ou todos, para o RT. */
  visibleCaregivers(): Caregiver[] {
    const actor = this.auth.actor();
    if (this.isSupervisor()) {
      return [...this.db.caregivers.list()];
    }
    if (actor?.role === 'psychologist' && actor.psychologistId) {
      return this.db.caregivers.query((c) => c.assignedPsychologistId === actor.psychologistId);
    }
    return [];
  }

  /** Quem está agindo (id do usuário), para contato, risco e encaminhamento. */
  actorUserId(): ID {
    return this.auth.actor()?.userId ?? '';
  }

  /** "a Dra. Beatriz Nogueira", com artigo, para o portão de supervisão. */
  ownerName(caregiver: Pick<Caregiver, 'assignedPsychologistId'> | undefined): string {
    const psy = caregiver?.assignedPsychologistId
      ? this.db.psychologists.get(caregiver.assignedPsychologistId)
      : undefined;
    return psy ? `${psy.displayName.startsWith('Dra.') ? 'a' : 'o'} ${psy.displayName}` : 'outro psicólogo da equipe';
  }
}
