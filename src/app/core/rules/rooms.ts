/**
 * Salas do coworking e acessibilidade (RN-ATD-10, RN-GRP-11): a sala tem quatro atributos e só pode ser
 * reservada (sessão presencial no coworking, encontro presencial de grupo) se os quatro forem "sim".
 */
import { compareDateTimes } from '../clock/date-utils';
import { Room, RoomAccessibility } from '../models/care';
import { ID, ISODateTime } from '../models/primitives';

export const ROOM_ATTRIBUTES: readonly {
  key: keyof RoomAccessibility;
  label: string;
  /** Forma usada na frase "Falta ...". */
  missing: string;
}[] = [
  { key: 'stepFreeAccess', label: 'Acesso sem degraus', missing: 'acesso sem degraus' },
  { key: 'adaptedRestroom', label: 'Sanitário adaptado', missing: 'sanitário adaptado' },
  { key: 'goodLighting', label: 'Boa iluminação', missing: 'boa iluminação' },
  { key: 'armrestSeating', label: 'Assentos com apoio de braços', missing: 'assentos com apoio de braços' },
];

/** Quantos dos 4 itens de acessibilidade a sala tem. */
export function roomScore(room: Pick<Room, 'accessibility'>): number {
  return ROOM_ATTRIBUTES.filter((a) => room.accessibility[a.key]).length;
}

/** Sala reservável: ativa e com os 4 atributos (RN-ATD-10). */
export function isRoomBookable(room: Pick<Room, 'accessibility' | 'active'>): boolean {
  return room.active && roomScore(room) === ROOM_ATTRIBUTES.length;
}

/** Motivo de a sala não poder ser reservada ("Falta sanitário adaptado (3 de 4 itens de acessibilidade)."). */
export function roomBlockReason(room: Pick<Room, 'accessibility' | 'active'>): string | null {
  if (!room.active) {
    return 'Sala desativada.';
  }
  const missing = ROOM_ATTRIBUTES.filter((a) => !room.accessibility[a.key]).map((a) => a.missing);
  if (missing.length === 0) {
    return null;
  }
  return `Falta ${missing.join(', ')} (${ROOM_ATTRIBUTES.length - missing.length} de ${ROOM_ATTRIBUTES.length} itens de acessibilidade).`;
}

/** Uma sala ocupada numa faixa de horário (uma conversa presencial no coworking ou um encontro de grupo). */
export interface RoomBooking {
  roomId: ID;
  startAt: ISODateTime;
  endAt: ISODateTime;
}

/** Duas faixas de horário se sobrepõem? Terminar às 15h e começar às 15h não conta. */
export function timeRangesOverlap(
  aStart: ISODateTime,
  aEnd: ISODateTime,
  bStart: ISODateTime,
  bEnd: ISODateTime,
): boolean {
  return compareDateTimes(aStart, bEnd) < 0 && compareDateTimes(bStart, aEnd) < 0;
}

/** A sala está livre na faixa de horário? Duas conversas ou encontros nunca ocupam a mesma sala ao mesmo tempo (QAC-013). */
export function isRoomFreeAt(
  roomId: ID,
  startAt: ISODateTime,
  endAt: ISODateTime,
  bookings: readonly RoomBooking[],
): boolean {
  return !bookings.some((b) => b.roomId === roomId && timeRangesOverlap(startAt, endAt, b.startAt, b.endAt));
}

/**
 * A primeira sala (por nome) reservável e livre na faixa de horário, ou `undefined` se não há. Só entram as salas com os
 * 4 atributos de acessibilidade (RN-ATD-10): se nenhuma está livre, o formato presencial no coworking não existe para o
 * horário.
 */
export function firstFreeRoom<T extends Room>(
  rooms: readonly T[],
  startAt: ISODateTime,
  endAt: ISODateTime,
  bookings: readonly RoomBooking[],
): T | undefined {
  return [...rooms]
    .filter((room) => isRoomBookable(room))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .find((room) => isRoomFreeAt(room.id, startAt, endAt, bookings));
}
