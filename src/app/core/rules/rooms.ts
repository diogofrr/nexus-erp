/**
 * Salas do coworking e acessibilidade (RN-ATD-10, RN-GRP-11): a sala tem quatro atributos e só pode ser
 * reservada (sessão presencial no coworking, encontro presencial de grupo) se os quatro forem "sim".
 */
import { Room, RoomAccessibility } from '../models/care';

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
