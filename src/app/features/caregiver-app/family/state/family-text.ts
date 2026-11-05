/**
 * O texto pronto para a família (UX C20, RN-USR-11, RN-LGPD-05 c, RN-ATD-18, RN-GRP-10): a rotina da pessoa idosa,
 * só com o que o cuidador marcar, para copiar e colar. Função PURA: recebe os dados já escolhidos e devolve o texto.
 *
 * O que entra: o PRIMEIRO NOME da pessoa idosa, a data, os compromissos (hora, título e, se houver, onde), o nome e o
 * horário dos remédios do dia e o primeiro nome de quem envia. O que NUNCA entra, por construção (a função não
 * recebe): dose, condição de saúde, conversa com o psicólogo, grupo, escala, plano ou qualquer dado do cuidador além
 * do primeiro nome.
 */
import { dateOf, timeOf } from '../../../../core/clock/date-utils';
import { ISODate, ISODateTime } from '../../../../core/models';
import { formatDayLong, formatDayShort } from '../../state/day-format';

/** O que a pessoa liga, item a item (todos desligados por padrão). */
export interface FamilyShareChoices {
  today: boolean;
  week: boolean;
  medications: boolean;
}

export const NO_FAMILY_CHOICES: FamilyShareChoices = { today: false, week: false, medications: false };

export interface FamilyAppointment {
  at: ISODateTime;
  title: string;
  place?: string | undefined;
}

export interface FamilyDose {
  time: string;
  medicationName: string;
}

export interface FamilyShareData {
  elderFirstName: string;
  caregiverFirstName: string;
  today: ISODate;
  /** Compromissos de hoje. */
  appointmentsToday: readonly FamilyAppointment[];
  /** Compromissos dos próximos 7 dias, sem os de hoje (S-38). */
  appointmentsWeek: readonly FamilyAppointment[];
  /** Remédios do dia (nome e horário, sem dose). */
  doses: readonly FamilyDose[];
}

export function anyChosen(choices: FamilyShareChoices): boolean {
  return choices.today || choices.week || choices.medications;
}

const byTime = <T extends { at: ISODateTime }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.at.localeCompare(b.at));

function place(item: FamilyAppointment): string {
  const text = item.place?.trim();
  return text ? ` (${text})` : '';
}

/** `null` quando nenhum item está ligado (a caixa mostra "Escolha o que você quer compartilhar."). */
export function buildFamilyText(data: FamilyShareData, choices: FamilyShareChoices): string | null {
  if (!anyChosen(choices)) {
    return null;
  }
  const parts: string[] = [`Rotina de ${data.elderFirstName}, ${formatDayLong(data.today)}.`];
  if (choices.today) {
    const items = byTime(data.appointmentsToday).map((a) => `${timeOf(a.at)} ${a.title.trim()}${place(a)}`);
    parts.push(`Compromissos de hoje: ${items.length > 0 ? items.join('; ') : 'nenhum'}.`);
  }
  if (choices.week) {
    const items = byTime(data.appointmentsWeek).map(
      (a) => `${formatDayShort(dateOf(a.at), data.today)}, ${timeOf(a.at)} ${a.title.trim()}${place(a)}`,
    );
    parts.push(`Compromissos desta semana: ${items.length > 0 ? items.join('; ') : 'nenhum'}.`);
  }
  if (choices.medications) {
    const items = [...data.doses]
      .sort((a, b) => a.time.localeCompare(b.time) || a.medicationName.localeCompare(b.medicationName, 'pt-BR'))
      .map((d) => `${d.time} ${d.medicationName}`);
    parts.push(`Remédios de hoje: ${items.length > 0 ? items.join(', ') : 'nenhum'}.`);
  }
  parts.push(`Enviado por ${data.caregiverFirstName} pelo app Nexus.`);
  return parts.join(' ');
}
