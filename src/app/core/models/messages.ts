import { GraveCategory } from './network';
import { Audited, Channel, ID, ISODateTime } from './primitives';

export interface Message extends Audited {
  channel: Channel;
  direction: 'in' | 'out';
  caregiverId?: ID;
  providerId?: ID;
  subject?: string;
  body: string;
  receivedAt: ISODateTime;
  /** Prazo calculado na chegada (RN-CAN-04). `overdue` é DERIVADO: agora maior que `dueAt` e não respondida. */
  dueAt: ISODateTime;
  firstResponseAt?: ISODateTime;
  status: 'new' | 'in_progress' | 'answered';
  assignedToUserId?: ID;
  /** Alimenta a ARBE (RN-USR-06). */
  isSupportRequest: boolean;
  /** Mensagem de risco: abre POP-05. */
  riskFlag?: boolean;
}

export interface ComplaintEvent {
  at: ISODateTime;
  byUserId: ID;
  text: string;
}

export interface Complaint extends Audited {
  /** `REC-0001`. */
  protocol: string;
  channel: Channel;
  caregiverId?: ID;
  target: {
    type: 'provider' | 'service' | 'platform' | 'nexus_psychologist' | 'other';
    providerId?: ID;
  };
  description: string;
  severity: 'normal' | 'grave';
  graveCategory?: GraveCategory;
  /** Cria ocorrência POP-07 restrita ao RT. */
  suspectedElderAbuse: boolean;
  status: 'open' | 'in_progress' | 'answered' | 'closed' | 'dismissed';
  openedAt: ISODateTime;
  /** 5 dias úteis (RN-POP-08). */
  dueAt: ISODateTime;
  events: ComplaintEvent[];
  occurrenceId?: ID;
}

export interface MessageTemplate extends Audited {
  title: string;
  body: string;
}
