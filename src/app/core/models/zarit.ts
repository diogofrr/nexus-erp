import { RetentionBlock } from './caregivers';
import { Audited, Channel, ID, ISODate, ISODateTime } from './primitives';

/** Faixas da Escala de Zarit: 0 a 20, 21 a 40, 41 a 60, 61 a 88 (RN-ZRT-08). */
export type ZaritBand = 'absent_or_small' | 'moderate' | 'moderate_to_severe' | 'severe';

export interface ZaritAddendum {
  at: ISODateTime;
  /** SENSITIVE. */
  content: string;
}

export interface ZaritAssessment extends Audited {
  caregiverId: ID;
  psychologistId: ID;
  kind: 'enrollment' | 'quarterly';
  /** 0 = adesão. */
  sequence: number;
  dueDate: ISODate;
  appliedAt?: ISODate;
  /** SENSITIVE: 22 inteiros de 0 a 4. */
  answers?: number[];
  /** SENSITIVE: 0 a 88, sempre calculado pelo sistema. */
  total?: number;
  /** SENSITIVE. */
  band?: ZaritBand;
  /** `due` (vence em até 14 dias) e `overdue` são DERIVADOS de `dueDate`. */
  status: 'scheduled' | 'completed';
  signedAt?: ISODateTime;
  addenda: ZaritAddendum[];
  retentionBlock?: RetentionBlock;
}

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface ZaritAlert extends Audited {
  assessmentId: ID;
  caregiverId: ID;
  level: 'yellow' | 'red';
  /** `overdue` é DERIVADO: vermelho sem contato depois de `deadlineAt`. */
  status: 'open' | 'contacted' | 'risk_assessed' | 'closed';
  /** Vermelho: 23:59 do dia da aplicação (RN-ZRT-14). */
  deadlineAt?: ISODateTime;
  contact?: { at: ISODateTime; byUserId: ID; channel: Channel; note?: string };
  riskAssessment?: { at: ISODateTime; byUserId: ID; level: RiskLevel; note: string };
  /** Amarelo: tarefa "revisar rede de apoio" concluída. */
  supportNetworkReviewDone?: boolean;
  referralIds: ID[];
  occurrenceId?: ID;
  closedAt?: ISODateTime;
  closureNote?: string;
  retentionBlock?: RetentionBlock;
}

export interface ArbeSettings {
  /** Horas diárias de cuidado: limite (padrão 8, "maior ou igual"). */
  hoursThreshold: number;
  /** Pedidos de apoio na janela (padrão 3). */
  supportRequestsThreshold: number;
  /** Janela em dias (padrão 30). */
  windowDays: number;
  /** Zarit mínima para o critério (padrão 41). */
  zaritThreshold: number;
  /** Zarit que torna o alerta crítico por si só (padrão 61). */
  criticalZarit: number;
}

export interface ArbeCriteria {
  hoursPerDay: { value: number; met: boolean };
  supportRequests: { value: number; met: boolean };
  zarit: { value: number | null; met: boolean };
}

export interface ArbeAlert extends Audited {
  caregiverId: ID;
  level: 'attention' | 'critical';
  generatedAt: ISODateTime;
  criteria: ArbeCriteria;
  status: 'generated' | 'confirmed' | 'contacted' | 'closed' | 'discarded';
  reviewedByUserId?: ID;
  contactedAt?: ISODateTime;
  closedAt?: ISODateTime;
  discardReason?: string;
  /** Motivo do encerramento (por exemplo, "consentimento revogado", RN-ARBE-09). */
  closureReason?: string;
  retentionBlock?: RetentionBlock;
}

/** Pedido do cuidador para rever uma decisão tomada com base nos resultados (RN-ZRT-20). */
export interface ReviewRequest extends Audited {
  caregiverId: ID;
  psychologistId: ID;
  about: 'zarit_decision' | 'arbe_alert';
  text: string;
  dueAt: ISODate;
  answer?: string;
  answeredAt?: ISODateTime;
}
