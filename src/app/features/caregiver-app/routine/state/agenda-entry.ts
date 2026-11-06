import { CareAppointment, ISODate, ISODateTime } from '../../../../core/models';
import { IconName } from '../../../../shared/ui/display/icon.component';
import { CgCalendarKind } from '../../ui/cg-calendar.component';

/** Uma linha da Agenda: compromisso da pessoa idosa ou conversa do próprio cuidador com o psicólogo. */
export interface AgendaEntry {
  key: string;
  at: ISODateTime;
  date: ISODate;
  time: string;
  title: string;
  support: string | null;
  icon: IconName;
  /** O tipo, para a marca do calendário (a conversa do próprio cuidador é `you`). */
  kind: CgCalendarKind;
  /** A conversa da própria pessoa: leva a "Conversar com um psicólogo" (S-27). */
  forYou: boolean;
  appointment: CareAppointment | null;
  /** Compromisso de hoje cuja hora já passou: a etiqueta neutra "Já passou" (a hora já está no título, CXC-001). */
  passed: boolean;
}
