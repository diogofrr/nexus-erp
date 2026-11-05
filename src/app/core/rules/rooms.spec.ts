import { describe, expect, it } from 'vitest';
import { ROOM_ATTRIBUTES, isRoomBookable, roomBlockReason, roomScore } from './rooms';

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
