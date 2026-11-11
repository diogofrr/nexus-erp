import { CareAppointment, ISODate, ISODateTime } from '../../../../core/models';
import { IconName } from '../../../../shared/ui/display/icon.component';
import { CgEventType } from '../../state/event-type';
import { CgCalendarKind } from '../../ui/cg-calendar.component';

/** Uma linha da Agenda: compromisso da pessoa idosa, conversa do próprio cuidador com o psicólogo ou encontro em que está inscrito. */
export interface AgendaEntry {
  key: string;
  at: ISODateTime;
  date: ISODate;
  time: string;
  title: string;
  support: string | null;
  icon: IconName;
  /** O tipo, para a marca do calendário (a conversa e o encontro do próprio cuidador são `you`). */
  kind: CgCalendarKind;
  /** A conversa ou o encontro da própria pessoa: leva para a tela deles (S-27). */
  forYou: boolean;
  /** O tipo do encontro, para o selo (`app-cg-event-badge`); `null` fora dos encontros. */
  eventType: CgEventType | null;
  /** Para onde a linha "Para você" leva, com a consulta da URL quando precisa. */
  link: string | null;
  linkQuery: Record<string, string> | null;
  appointment: CareAppointment | null;
  /** Compromisso de hoje cuja hora já passou: a etiqueta neutra "Já passou" (a hora já está no título, CXC-001). */
  passed: boolean;
}
