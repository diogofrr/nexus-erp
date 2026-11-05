import { describe, expect, it } from 'vitest';
import { DEFAULT_ARBE_SETTINGS } from './arbe';
import { previewArbeChange } from './arbe-preview';

const person = (id: string, hours: number, zarit: number | null, support = 0) => ({
  id,
  dailyCareHours: hours,
  lastZarit: zarit,
  supportRequestsIn: () => support,
});

describe('Prévia dos limites da ARBE (CX-021)', () => {
  const people = [
    person('a', 11, 63, 4), // crítico hoje
    person('b', 9, 35, 3), // atenção hoje (2 de 3)
    person('c', 4, 20, 0), // sem alerta
    person('d', 8, 45, 0), // atenção hoje (horas e escala)
  ];

  it('com os mesmos limites nada muda', () => {
    const preview = previewArbeChange(people, DEFAULT_ARBE_SETTINGS, DEFAULT_ARBE_SETTINGS);
    expect(preview.changed).toBe(0);
    expect(preview.current).toEqual({ attention: 2, critical: 1 });
    expect(preview.proposed).toEqual(preview.current);
  });

  it('limites mais baixos fazem mais cuidadores entrarem em alerta, e dizem quantos mudam de nível', () => {
    const lower = { ...DEFAULT_ARBE_SETTINGS, hoursThreshold: 4, zaritThreshold: 20 };
    const preview = previewArbeChange(people, DEFAULT_ARBE_SETTINGS, lower);
    expect(preview.entering).toBe(1);
    expect(preview.proposed.attention + preview.proposed.critical).toBeGreaterThan(
      preview.current.attention + preview.current.critical,
    );
    expect(preview.changed).toBe(preview.entering + preview.leaving + preview.escalating + preview.easing);
  });

  it('limites mais altos fazem cuidadores deixarem o alerta e a pontuação crítica sobe de nível', () => {
    const higher = { ...DEFAULT_ARBE_SETTINGS, hoursThreshold: 12, zaritThreshold: 70, criticalZarit: 80 };
    const preview = previewArbeChange(people, DEFAULT_ARBE_SETTINGS, higher);
    expect(preview.leaving).toBeGreaterThan(0);
    expect(preview.proposed.critical).toBeLessThanOrEqual(preview.current.critical);
  });

  it('a janela de dias também conta: menos dias, menos pedidos de apoio', () => {
    const windowed = [
      { id: 'w', dailyCareHours: 9, lastZarit: 20, supportRequestsIn: (days: number) => (days >= 30 ? 3 : 1) },
    ];
    const preview = previewArbeChange(windowed, DEFAULT_ARBE_SETTINGS, { ...DEFAULT_ARBE_SETTINGS, windowDays: 7 });
    expect(preview.current.attention).toBe(1);
    expect(preview.proposed.attention).toBe(0);
    expect(preview.leaving).toBe(1);
  });
});
