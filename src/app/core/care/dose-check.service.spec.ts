import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Clock } from '../clock/clock.service';
import { RetentionService } from '../privacy/retention.service';
import { configureCoreTest } from '../testing/test-helpers';
import { DoseCheckError, DoseCheckService } from './dose-check.service';

function setup() {
  const env = configureCoreTest({ seed: true });
  const doses = TestBed.inject(DoseCheckService);
  return { ...env, doses, elder: 'el_0002', today: TestBed.inject(Clock).today() };
}

describe('Coleção doseChecks e DoseCheckService (RN-USR-07)', () => {
  it('a coleção existe, tem prefixo dose e entra na exportação, no reset e na limpeza', () => {
    const { db } = setup();
    expect(db.doseChecks.size()).toBeGreaterThan(0);
    expect(db.doseChecks.list()[0]?.id).toMatch(/^dose_\d{4}$/);
    expect(Array.isArray(db.buildExport().collections.doseChecks)).toBe(true);
    db.wipe();
    expect(db.doseChecks.size()).toBe(0);
    db.reset();
    expect(db.doseChecks.size()).toBeGreaterThan(0);
  });

  it('um arquivo de exportação antigo, sem a coleção doseChecks, ainda importa e a deixa vazia', () => {
    const { db } = setup();
    const envelope = db.buildExport();
    const collections: Record<string, unknown> = { ...envelope.collections };
    delete collections['doseChecks'];
    const result = db.importJson(JSON.stringify({ ...envelope, collections }));
    expect(result).toEqual({ ok: true, errors: [] });
    expect(db.doseChecks.size()).toBe(0);
    expect(db.caregivers.size()).toBe(340);
  });

  it('lista as doses do dia da pessoa idosa, em ordem, e marca e desmarca "dei"', () => {
    const { doses, elder, today } = setup();
    const before = doses.forElder(elder, today);
    // Dois remédios: um às 08:00 e 20:00, outro às 12:00.
    expect(before.map((d) => d.time)).toEqual(['08:00', '12:00', '20:00']);
    expect(before.every((d) => !d.given)).toBe(true);

    const first = before[0];
    expect(first).toBeDefined();
    if (!first) {
      return;
    }
    const mark = doses.mark(first.medicationId, today, first.time);
    expect(mark).toMatchObject({ medicationId: first.medicationId, date: today, time: first.time });
    expect(mark.givenAt.startsWith(today)).toBe(true);
    expect(doses.isGiven(first.medicationId, today, first.time)).toBe(true);
    expect(doses.forElder(elder, today)[0]?.given).toBe(true);

    expect(doses.unmark(first.medicationId, today, first.time)).toBe(true);
    expect(doses.isGiven(first.medicationId, today, first.time)).toBe(false);
    expect(doses.unmark(first.medicationId, today, first.time)).toBe(false);
  });

  it('marcar duas vezes não duplica', () => {
    const { db, doses, elder, today } = setup();
    const slot = doses.forElder(elder, today)[1];
    if (!slot) {
      throw new Error('sem dose para marcar');
    }
    const a = doses.mark(slot.medicationId, today, slot.time);
    const b = doses.mark(slot.medicationId, today, slot.time);
    expect(b.id).toBe(a.id);
    expect(
      db.doseChecks.count((d) => d.medicationId === slot.medicationId && d.date === today),
    ).toBe(1);
  });

  it('recusa horário que o remédio não tem, remédio inativo e dia que ainda não chegou', () => {
    const { db, doses, elder, today, clock } = setup();
    const slot = doses.forElder(elder, today)[0];
    if (!slot) {
      throw new Error('sem dose para marcar');
    }
    expect(() => doses.mark(slot.medicationId, today, '03:33')).toThrow(DoseCheckError);
    expect(() => doses.mark('med_inexistente', today, '08:00')).toThrow(DoseCheckError);
    expect(() => doses.mark(slot.medicationId, clock.addDays(1), slot.time)).toThrow(
      'Só dá para marcar o remédio de hoje ou de um dia que já passou.',
    );
    db.medications.update(slot.medicationId, { active: false });
    expect(() => doses.mark(slot.medicationId, today, slot.time)).toThrow(DoseCheckError);
    // Dia que já passou vale.
    db.medications.update(slot.medicationId, { active: true });
    expect(doses.mark(slot.medicationId, clock.addDays(-1), slot.time).date).toBe(
      clock.addDays(-1),
    );
  });

  it('a eliminação do titular apaga as marcações de remédio da pessoa idosa e as lista antes', () => {
    const { db } = setup();
    const retention = TestBed.inject(RetentionService);
    const medicationIds = db.medications.query((m) => m.elderId === 'el_0001').map((m) => m.id);
    const mine = (): number => db.doseChecks.count((d) => medicationIds.includes(d.medicationId));
    const before = mine();
    expect(before).toBeGreaterThan(0);
    expect(retention.plan('cg_0001').willErase).toContainEqual({
      key: 'doses',
      label: 'Marcações de remédios dados',
      count: before,
    });
    const total = db.doseChecks.size();
    retention.erase('cg_0001');
    expect(mine()).toBe(0);
    // As marcações de outras pessoas ficam.
    expect(db.doseChecks.size()).toBe(total - before);
  });
});
