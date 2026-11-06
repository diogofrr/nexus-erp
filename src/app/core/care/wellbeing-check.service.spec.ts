import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Clock } from '../clock/clock.service';
import { configureCoreTest } from '../testing/test-helpers';
import { WellbeingCheckService, WellbeingError } from './wellbeing-check.service';

function setup() {
  const env = configureCoreTest({ seed: true });
  return {
    ...env,
    wellbeing: TestBed.inject(WellbeingCheckService),
    today: TestBed.inject(Clock).today(),
  };
}

describe('WellbeingCheckService (RN-USR-05, S-29, RN-LGPD-04 e 14)', () => {
  it('anota o humor de hoje e, ao anotar de novo, troca o do dia (um registro por dia)', () => {
    const { wellbeing, db, today } = setup();
    const before = db.wellbeingChecks.count((c) => c.caregiverId === 'cg_0002' && c.date === today);
    expect(before).toBe(0);
    const first = wellbeing.record('cg_0002', 4);
    expect(first).toMatchObject({ caregiverId: 'cg_0002', date: today, mood: 4 });
    expect(wellbeing.forDay('cg_0002', today)?.mood).toBe(4);
    const second = wellbeing.record('cg_0002', 2);
    expect(second.id).toBe(first.id);
    expect(wellbeing.forDay('cg_0002', today)?.mood).toBe(2);
    expect(db.wellbeingChecks.count((c) => c.caregiverId === 'cg_0002' && c.date === today)).toBe(1);
  });

  it('recusa o humor sem a autorização de dados de saúde, na borda do serviço', () => {
    const { wellbeing, db, today } = setup();
    // Sônia (cg_0016) retirou a autorização de saúde no seed.
    expect(() => wellbeing.record('cg_0016', 3)).toThrow(WellbeingError);
    expect(db.wellbeingChecks.count((c) => c.caregiverId === 'cg_0016' && c.date === today)).toBe(0);
  });
});
