import { describe, expect, it } from 'vitest';
import {
  ROOM_ATTRIBUTES,
  firstFreeRoom,
  isRoomBookable,
  isRoomFreeAt,
  roomBlockReason,
  roomScore,
  timeRangesOverlap,
} from './rooms';

const full = { stepFreeAccess: true, adaptedRestroom: true, goodLighting: true, armrestSeating: true };

describe('salas e acessibilidade (RN-ATD-10, RN-GRP-11)', () => {
  it('só é reservável com os 4 atributos e a sala ativa', () => {
    expect(ROOM_ATTRIBUTES).toHaveLength(4);
    expect(isRoomBookable({ accessibility: full, active: true })).toBe(true);
    expect(isRoomBookable({ accessibility: full, active: false })).toBe(false);
    expect(isRoomBookable({ accessibility: { ...full, adaptedRestroom: false }, active: true })).toBe(false);
  });

  it('diz o que falta, com a contagem de 4 itens', () => {
    const jacaranda = { accessibility: { ...full, adaptedRestroom: false }, active: true };
    expect(roomScore(jacaranda)).toBe(3);
    expect(roomBlockReason(jacaranda)).toBe('Falta sanitário adaptado (3 de 4 itens de acessibilidade).');
    expect(roomBlockReason({ accessibility: { ...full, goodLighting: false, stepFreeAccess: false }, active: true })).toBe(
      'Falta acesso sem degraus, boa iluminação (2 de 4 itens de acessibilidade).',
    );
    expect(roomBlockReason({ accessibility: full, active: true })).toBeNull();
    expect(roomBlockReason({ accessibility: full, active: false })).toBe('Sala desativada.');
  });
});

describe('sala livre no horário (RN-ATD-10, QAC-013)', () => {
  const at = (hour: string) => `2026-11-12T${hour}:00-03:00` as const;
  const rooms = [
    { id: 'room_b', name: 'Sala Ipê', address: 'Rua A', accessibility: full, active: true, createdAt: '', updatedAt: '' },
    { id: 'room_a', name: 'Sala Girassol', address: 'Rua A', accessibility: full, active: true, createdAt: '', updatedAt: '' },
    {
      id: 'room_c',
      name: 'Sala Jacarandá',
      address: 'Rua A',
      accessibility: { ...full, adaptedRestroom: false },
      active: true,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('duas faixas se sobrepõem só quando uma começa antes de a outra terminar (encostar não conta)', () => {
    expect(timeRangesOverlap(at('15:00'), at('16:00'), at('15:30'), at('16:30'))).toBe(true);
    expect(timeRangesOverlap(at('15:00'), at('16:00'), at('15:00'), at('16:00'))).toBe(true);
    expect(timeRangesOverlap(at('15:00'), at('16:00'), at('16:00'), at('17:00'))).toBe(false);
    expect(timeRangesOverlap(at('15:00'), at('16:00'), at('13:00'), at('15:00'))).toBe(false);
  });

  it('uma sala ocupada na faixa não está livre; outra sala ou outro horário continuam livres', () => {
    const bookings = [{ roomId: 'room_a', startAt: at('15:00'), endAt: at('16:00') }];
    expect(isRoomFreeAt('room_a', at('15:00'), at('16:00'), bookings)).toBe(false);
    expect(isRoomFreeAt('room_a', at('16:00'), at('17:00'), bookings)).toBe(true);
    expect(isRoomFreeAt('room_b', at('15:00'), at('16:00'), bookings)).toBe(true);
  });

  it('escolhe a primeira sala livre por nome, só entre as reserváveis; sem sala livre devolve nada', () => {
    expect(firstFreeRoom(rooms, at('15:00'), at('16:00'), [])?.id).toBe('room_a');
    const taken = [{ roomId: 'room_a', startAt: at('15:00'), endAt: at('16:00') }];
    expect(firstFreeRoom(rooms, at('15:00'), at('16:00'), taken)?.id).toBe('room_b');
    const both = [...taken, { roomId: 'room_b', startAt: at('15:00'), endAt: at('16:00') }];
    // A Jacarandá não tem sanitário adaptado: nunca é oferecida (RN-ATD-10).
    expect(firstFreeRoom(rooms, at('15:00'), at('16:00'), both)).toBeUndefined();
  });
});
