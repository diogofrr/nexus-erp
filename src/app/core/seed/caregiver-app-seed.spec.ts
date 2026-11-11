import { describe, expect, it } from 'vitest';
import { addDays, dateOf, isWeekend } from '../clock/date-utils';
import { doseProgress, dosesForDate } from '../rules/medication-doses';
import { DEMO_CAREGIVER_NUMBERS, caregiverId, elderId, generateSeed } from './index';

const TODAY = '2026-11-04';

describe('Seed do aplicativo do cuidador', () => {
  const { collections: c } = generateSeed(TODAY);

  it('as contagens que os testes do seed protegem continuam iguais', () => {
    expect(c.caregivers).toHaveLength(340);
    expect(c.elders).toHaveLength(340);
    expect(c.messages).toHaveLength(28);
    // 60 do seed original + 3 conversas futuras de demonstração (Ana, Lourdes e Elza; a de Elza veio com o docs/20).
    expect(c.careSessions).toHaveLength(63);
    expect(c.consents).toHaveLength(340 * 6);
  });

  it('é determinístico: a mesma data gera exatamente os mesmos remédios dados e compromissos', () => {
    const again = generateSeed(TODAY).collections;
    expect(again.doseChecks).toEqual(c.doseChecks);
    expect(again.careAppointments).toEqual(c.careAppointments);
    expect(again.medications).toEqual(c.medications);
  });

  it('as 11 pessoas de demonstração têm pessoa idosa, remédio ativo com horários e compromisso hoje e nos próximos dias', () => {
    expect(DEMO_CAREGIVER_NUMBERS).toEqual([1, 2, 3, 8, 27, 24, 12, 26, 16, 4, 18]);
    DEMO_CAREGIVER_NUMBERS.forEach((n) => {
      const id = caregiverId(n);
      const elder = c.elders.find((e) => e.caregiverId === id);
      expect(elder?.id, id).toBe(elderId(n));
      const meds = c.medications.filter((m) => m.elderId === elder?.id && m.active);
      expect(meds.length, id).toBeGreaterThanOrEqual(1);
      meds.forEach((m) => expect(m.times.length).toBeGreaterThan(0));
      const days = c.careAppointments
        .filter((a) => a.elderId === elder?.id)
        .map((a) => dateOf(a.at))
        .sort();
      expect(days, id).toContain(TODAY);
      expect(
        days.filter((d) => d > TODAY && d <= addDays(TODAY, 7)).length,
        id,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it('Ana tem remédios marcados nos últimos dias e o da manhã de hoje, e ainda falta dar o resto de hoje', () => {
    const meds = c.medications.filter((m) => m.elderId === elderId(1));
    const checks = c.doseChecks.filter((d) => meds.some((m) => m.id === d.medicationId));
    expect(checks.length).toBeGreaterThanOrEqual(10);
    const progress = doseProgress(dosesForDate(TODAY, meds, checks));
    expect(progress.given).toBeGreaterThanOrEqual(1);
    expect(progress.given).toBeLessThan(progress.total);
    expect(doseProgress(dosesForDate(addDays(TODAY, -1), meds, checks)).complete).toBe(true);
    // Anteontem faltou a dose da noite: a lista não mente.
    const twoDaysAgo = doseProgress(dosesForDate(addDays(TODAY, -2), meds, checks));
    expect(twoDaysAgo.given).toBe(twoDaysAgo.total - 1);
  });

  it('cobre os casos que as telas do aplicativo precisam (UX D.5, P-05): a a g', () => {
    // (a) Ana: 3 remédios e 4 doses por dia, com compromisso hoje e em outro dia.
    const anaMeds = c.medications.filter((m) => m.elderId === elderId(1) && m.active);
    expect(anaMeds.flatMap((m) => m.times)).toHaveLength(4);
    // (b) Rita tem um serviço concluído sem avaliação, de um prestador que aparece na busca.
    const ritaRequest = c.serviceRequests.find(
      (r) => r.caregiverId === caregiverId(8) && r.status === 'completed' && !r.evaluationId,
    );
    expect(ritaRequest).toBeDefined();
    expect(['active', 'monitoring']).toContain(
      c.providers.find((p) => p.id === ritaRequest?.providerId)?.status,
    );
    // (c) Ana autorizou compartilhar com a família e João não.
    const family = (n: number): string | undefined =>
      c.consents.find((x) => x.caregiverId === caregiverId(n) && x.key === 'family_sharing')?.status;
    expect(family(1)).toBe('granted');
    expect(family(3)).toBe('pending');
    // (d) Maria tem um pedido de revisão aberto, com prazo.
    const review = c.reviewRequests.find((r) => r.caregiverId === caregiverId(2) && !r.answeredAt);
    expect(review?.dueAt).toBeDefined();
    // (e) Raimunda tem um pedido de eliminação aberto e entra na lista de demonstração.
    expect(
      c.dataSubjectRequests.some(
        (d) => d.caregiverId === caregiverId(18) && d.type === 'erasure' && d.status === 'open',
      ),
    ).toBe(true);
    expect(DEMO_CAREGIVER_NUMBERS).toContain(18);
    // (f) João tem mensagem por telefone registrada pela equipe.
    expect(
      c.messages.some((m) => m.caregiverId === caregiverId(3) && m.channel === 'phone'),
    ).toBe(true);
    // (g) Marcos tem a mudança de plano agendada.
    expect(
      c.subscriptions.find((s) => s.caregiverId === caregiverId(26))?.scheduledChangeAt,
    ).toBe(addDays(TODAY, 9));
  });

  it('Ana, Lourdes e Elza têm uma conversa futura com o psicólogo, com a vaga ocupada e incluída na cota do plano (docs/20)', () => {
    const slotOf = (id: string) => c.availabilitySlots.find((x) => x.id === id);
    const ana = c.careSessions.find((x) => x.caregiverId === caregiverId(1) && x.startAt.slice(0, 10) > TODAY);
    expect(ana).toMatchObject({
      psychologistId: 'psy_0001',
      status: 'scheduled',
      modality: 'online',
      discountPercent: 0,
      priceCents: 0,
      includedInPlan: true,
    });
    // 3 dias úteis a partir de quarta, 04/11/2026: quinta, sexta e segunda, 09/11.
    expect(dateOf(ana?.startAt ?? '')).toBe('2026-11-09');
    expect(slotOf(ana?.slotId ?? '')).toMatchObject({ status: 'booked', psychologistId: 'psy_0001', date: '2026-11-09' });

    const lourdes = c.careSessions.find((x) => x.caregiverId === caregiverId(24) && x.startAt.slice(0, 10) > TODAY);
    expect(lourdes).toMatchObject({
      psychologistId: 'psy_0003',
      status: 'confirmed',
      modality: 'in_person_coworking',
      discountPercent: 0,
      includedInPlan: true,
    });
    expect(c.rooms.find((r) => r.id === lourdes?.roomId)?.accessibility).toEqual({
      stepFreeAccess: true,
      adaptedRestroom: true,
      goodLighting: true,
      armrestSeating: true,
    });
    expect(slotOf(lourdes?.slotId ?? '')?.status).toBe('booked');
    [ana, lourdes].forEach((x) => expect(isWeekend(dateOf(x?.startAt ?? ''))).toBe(false));
  });

  it('as três conversas de demonstração não dividem o horário com nenhuma outra sessão do psicólogo', () => {
    const futureOf = (n: number) =>
      c.careSessions.find((x) => x.caregiverId === caregiverId(n) && x.startAt.slice(0, 10) > TODAY);
    [futureOf(1), futureOf(24), futureOf(27)].forEach((demo) => {
      const same = c.careSessions.filter(
        (x) => x.psychologistId === demo?.psychologistId && x.startAt === demo?.startAt,
      );
      expect(same).toHaveLength(1);
      const slots = c.availabilitySlots.filter(
        (x) => x.psychologistId === demo?.psychologistId && x.date === dateOf(demo?.startAt ?? '') && `${x.date}T${x.start}` === (demo?.startAt ?? '').slice(0, 16),
      );
      expect(slots).toHaveLength(1);
    });
  });

  it('os meses fechados de Rafael continuam em 160/138 e 160/146 (86,3% e 91,3%)', () => {
    const rows = c.monthSummaries
      .filter((m) => m.psychologistId === 'psy_0001')
      .sort((a, b) => (a.month < b.month ? -1 : 1));
    expect(rows.map((m) => [m.availableHours, m.doneHours])).toEqual([
      [160, 138],
      [160, 146],
    ]);
  });

  it('toda marcação aponta para um remédio que existe e para um horário dele', () => {
    c.doseChecks.forEach((d) => {
      const med = c.medications.find((m) => m.id === d.medicationId);
      expect(med, d.id).toBeDefined();
      expect(med?.times).toContain(d.time);
    });
    expect(new Set(c.doseChecks.map((d) => d.id)).size).toBe(c.doseChecks.length);
  });
});

describe('Seed do aplicativo do cuidador: conversas futuras só no Cuida e no Sustenta (docs/20)', () => {
  it('ninguém do Livre ou do Essencial tem conversa individual agendada ou confirmada; o histórico fica, avulso', () => {
    const { collections: c } = generateSeed(TODAY);
    const plans = new Map(c.subscriptions.map((s) => [s.caregiverId, s.planId] as const));
    const future = c.careSessions.filter((s) => s.status === 'scheduled' || s.status === 'confirmed');
    expect(future.length).toBeGreaterThan(0);
    future.forEach((s) => expect(['cuida', 'sustenta'], s.id).toContain(plans.get(s.caregiverId)));
    const history = c.careSessions.filter((s) => !['cuida', 'sustenta'].includes(plans.get(s.caregiverId) ?? 'livre'));
    expect(history.length).toBeGreaterThan(0);
    history.forEach((s) => expect(s.includedInPlan).toBe(false));
  });
});
