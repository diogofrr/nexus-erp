import { describe, expect, it } from 'vitest';
import {
  CARE_INVITE,
  CARE_INVITE_HEADING,
  CARE_INVITE_TEXT,
  CARE_TODAY_TEXT,
  careTodayHeading,
  teamCallWhen,
} from './care-note';

/** 2026-11-04 é uma quarta-feira; 06/11 é sexta; 07/11 sábado; 08/11 domingo; 09/11 segunda (sem feriado nacional na semana). */
const at = (date: string, time: string): string => `${date}T${time}:00-03:00`;

describe('A nota de cuidado: "hoje" só em horário comercial (CXC-003, RN-CAN-03)', () => {
  it('dentro do expediente (segunda a sexta, 8h às 18h) a equipe fala hoje', () => {
    expect(teamCallWhen(at('2026-11-04', '08:00'))).toBe('hoje');
    expect(teamCallWhen(at('2026-11-04', '12:00'))).toBe('hoje');
    expect(teamCallWhen(at('2026-11-04', '17:59'))).toBe('hoje');
    expect(careTodayHeading(at('2026-11-04', '12:00'))).toBe('A equipe de psicologia vai falar com você hoje.');
  });

  it('depois das 18h de um dia útil diz "amanhã de manhã" (nunca "hoje")', () => {
    expect(teamCallWhen(at('2026-11-04', '18:00'))).toBe('amanhã de manhã');
    expect(teamCallWhen(at('2026-11-05', '21:11'))).toBe('amanhã de manhã');
    expect(careTodayHeading(at('2026-11-05', '21:11'))).toBe('A equipe de psicologia vai falar com você amanhã de manhã.');
  });

  it('na sexta à noite e no sábado diz "na segunda de manhã"; no domingo, a segunda já é amanhã', () => {
    expect(teamCallWhen(at('2026-11-06', '19:00'))).toBe('na segunda de manhã');
    expect(teamCallWhen(at('2026-11-07', '10:00'))).toBe('na segunda de manhã');
    expect(teamCallWhen(at('2026-11-08', '15:00'))).toBe('amanhã de manhã');
  });

  it('antes de a equipe abrir, num dia útil, ela ainda fala hoje, de manhã', () => {
    expect(teamCallWhen(at('2026-11-04', '06:30'))).toBe('hoje de manhã');
  });

  it('o contato que não aconteceu vira um convite: sem "responsável técnica" e sem "não conseguiu falar com você"', () => {
    expect(CARE_INVITE_HEADING).toBe('Queremos falar com você.');
    expect(CARE_INVITE_TEXT).toBe('Se quiser, fale com a gente agora.');
    expect(CARE_INVITE).toBe('Queremos falar com você. Se quiser, fale com a gente agora.');
    expect(CARE_TODAY_TEXT).toBe('Você não precisa fazer nada.');
    for (const text of [CARE_INVITE, CARE_TODAY_TEXT, careTodayHeading(at('2026-11-05', '21:00'))]) {
      expect(text).not.toMatch(/responsável técnica|conseguiu|alerta|vencid|atrasad|[!\u2014\u2013]/i);
    }
  });
});
