import { describe, expect, it } from 'vitest';
import { hoursPerCase, projectRedistribution, receiveBlockReason } from './redistribution';

const rafael = { id: 'psy_0001', caregivers: 40, availableHours: 160, doneHours: 146 };
const beatriz = { id: 'psy_0002', caregivers: 30, availableHours: 160, doneHours: 112 };
const tiago = { id: 'psy_0004', caregivers: 10, availableHours: 160, doneHours: 80 };

describe('Prévia da redistribuição (RN-EQP-05, CX-010)', () => {
  it('as horas que viajam com o caso são as médias de quem cede', () => {
    expect(hoursPerCase(rafael)).toBeCloseTo(3.65, 2);
    expect(hoursPerCase({ caregivers: 0, doneHours: 0 })).toBe(0);
  });

  it('mostra a ocupação de hoje e a estimada de quem cede e de quem recebe', () => {
    const [from, to] = projectRedistribution(rafael, [{ party: tiago, cases: 10 }]);
    expect(from).toMatchObject({ id: 'psy_0001', caregiversBefore: 40, caregiversAfter: 30, before: 91.3 });
    expect(from?.after).toBeCloseTo(68.4, 1);
    expect(to).toMatchObject({ id: 'psy_0004', caregiversAfter: 20, before: 50 });
    expect(to?.after).toBeCloseTo(72.8, 1);
    expect(from?.exceedsLimit).toBe(false);
    expect(to?.exceedsLimit).toBe(false);
  });

  it('avisa quando quem recebe passaria de 80%: a Dra. Beatriz, a 70%, estoura com todos os casos', () => {
    const [from, to] = projectRedistribution(rafael, [{ party: beatriz, cases: 40 }]);
    expect(from?.caregiversAfter).toBe(0);
    expect(from?.after).toBe(0);
    expect(to?.before).toBe(70);
    expect(to?.after).toBeGreaterThan(80);
    expect(to?.exceedsLimit).toBe(true);
  });

  it('dividir entre dois receptores soma os casos e o limite é estritamente maior que 80%', () => {
    const projection = projectRedistribution(rafael, [
      { party: beatriz, cases: 5 },
      { party: tiago, cases: 5 },
    ]);
    expect(projection).toHaveLength(3);
    expect(projection[0]?.caregiversAfter).toBe(30);
    expect(projection[1]?.caregiversAfter).toBe(35);
    expect(projection[2]?.caregiversAfter).toBe(15);
    const exactly = projectRedistribution(
      { id: 'a', caregivers: 10, availableHours: 100, doneHours: 100 },
      [{ party: { id: 'b', caregivers: 10, availableHours: 100, doneHours: 70 }, cases: 1 }],
    );
    expect(exactly[1]?.after).toBe(80);
    expect(exactly[1]?.exceedsLimit).toBe(false);
  });

  it('quem cede nunca fica com horas negativas e sem agenda a ocupação é n/d', () => {
    const [from, to] = projectRedistribution({ id: 'a', caregivers: 2, availableHours: 100, doneHours: 10 }, [
      { party: { id: 'b', caregivers: 0, availableHours: 0, doneHours: 0 }, cases: 5 },
    ]);
    expect(from?.caregiversAfter).toBe(0);
    expect(from?.after).toBe(0);
    expect(to?.before).toBeNull();
    expect(to?.after).toBeNull();
    expect(to?.exceedsLimit).toBe(false);
  });

  it('o texto do bloqueio distingue "no limite" (80,0%) de "acima do limite" (CX-011)', () => {
    expect(receiveBlockReason(80)).toBe('no limite de 80%, não recebe mais casos');
    expect(receiveBlockReason(85)).toBe('acima do limite de 80%, não recebe mais casos');
    expect(receiveBlockReason(79.9)).toBeNull();
    expect(receiveBlockReason(null)).toBeNull();
  });
});
