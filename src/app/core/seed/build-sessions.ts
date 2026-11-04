/**
 * Agenda (5.2): resumo dos 2 meses fechados por psicólogo e 60 sessões em D-14 a D+14
 * (24 `done`, 3 `no_show`, 4 canceladas, 8 `confirmed`, 21 `scheduled`; 50% on-line, 35% coworking, 15% em
 * domicílio; 85% psicoterapia), 20 anotações assinadas e 4 em rascunho, 12 vagas abertas e 3 bloqueadas
 * nas próximas duas semanas (4 prioritárias).
 */
import { addDays, addMonthsToYearMonth, isWeekend, yearMonthOf } from '../clock/date-utils';
import {
  AvailabilitySlot,
  CareSession,
  PsychologistMonthSummary,
  SessionNote,
  SessionModality,
} from '../models';
import { sessionPriceCents } from '../rules/plans';
import { PSYCHOLOGIST, PsychologistKey, ROOM } from './refs';
import { SeedState } from './state';

const HOURS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
const KEYS: PsychologistKey[] = ['rafael', 'beatriz', 'leticia', 'tiago'];

/** Meses fechados (5.2): [disponíveis, realizadas] por psicólogo no mês -2 e no mês -1. */
const SUMMARIES: Record<PsychologistKey, [[number, number], [number, number]]> = {
  rafael: [
    [160, 138],
    [160, 146],
  ],
  beatriz: [
    [160, 136],
    [160, 112],
  ],
  leticia: [
    [160, 128],
    [160, 128],
  ],
  tiago: [
    [0, 0],
    [80, 40],
  ],
};

const NOTE_TEXTS: readonly string[] = [
  'Sessão de acompanhamento. Relato de cansaço e dificuldade para organizar a rotina. Combinado retorno em duas semanas.',
  'Conversa sobre divisão de tarefas com a família. Orientação sobre pausas curtas ao longo do dia.',
  'Acompanhamento do manejo do estresse. Cuidador relata melhora do sono nesta semana.',
  'Escuta sobre a relação com a pessoa idosa e os limites do cuidado. Sugerida a roda de conversa aberta.',
  'Revisão da rede de apoio da família. Definidos dois contatos para pedir ajuda nos fins de semana.',
];

export function buildSessions(s: SeedState): void {
  const { ctx, c } = s;
  const rng = ctx.rng;
  const planOfCaregiver = new Map(
    c.subscriptions.map((sub) => [sub.caregiverId, sub.planId] as const),
  );
  const discountOf = (planId: string): number =>
    (c.plans.find((p) => p.id === planId) as { psychSessionDiscountPercent: number })
      .psychSessionDiscountPercent;

  // ===== Meses fechados =====
  const month1 = addMonthsToYearMonth(yearMonthOf(ctx.today), -1);
  const month2 = addMonthsToYearMonth(yearMonthOf(ctx.today), -2);
  KEYS.forEach((key) => {
    const [m2, m1] = SUMMARIES[key];
    [
      [month2, m2],
      [month1, m1],
    ].forEach(([month, [available, done]]) => {
      c.monthSummaries.push(
        ctx.entity<PsychologistMonthSummary>(ctx.nextId('pms'), ctx.dt(-1, '23:00'), {
          psychologistId: PSYCHOLOGIST[key].id,
          month: month as string,
          availableHours: available as number,
          doneHours: done as number,
        }),
      );
    });
  });

  // ===== Combinações (data, hora) possíveis por período =====
  const pastDays: string[] = [];
  for (let i = -14; i <= -1; i += 1) {
    const d = addDays(ctx.today, i);
    if (!isWeekend(d)) {
      pastDays.push(d);
    }
  }
  const futureDays: string[] = [];
  for (let i = 0; i <= 14; i += 1) {
    const d = addDays(ctx.today, i);
    if (!isWeekend(d)) {
      futureDays.push(d);
    }
  }
  const combos = (days: string[]): { date: string; hour: string }[] =>
    days.flatMap((date) => HOURS.map((hour) => ({ date, hour })));

  const pastQuota: Record<PsychologistKey, number> = {
    rafael: 10,
    beatriz: 8,
    leticia: 8,
    tiago: 5,
  };
  const futureQuota: Record<PsychologistKey, number> = {
    rafael: 10,
    beatriz: 7,
    leticia: 7,
    tiago: 5,
  };

  interface Plan {
    key: PsychologistKey;
    date: string;
    hour: string;
    past: boolean;
  }
  const plan: Plan[] = [];
  /** Vagas livres candidatas (só depois de hoje e fora das sessões), por psicólogo. */
  const freeShare: Record<PsychologistKey, number> = {
    rafael: 4,
    beatriz: 3,
    leticia: 3,
    tiago: 5,
  };
  const freeSlots: { key: PsychologistKey; date: string; hour: string }[] = [];
  KEYS.forEach((key) => {
    rng
      .sample(combos(pastDays), pastQuota[key])
      .forEach((p) => plan.push({ key, date: p.date, hour: p.hour, past: true }));
    const sessions = rng.sample(combos(futureDays), futureQuota[key]);
    const taken = new Set(sessions.map((p) => `${p.date} ${p.hour}`));
    sessions.forEach((p) => plan.push({ key, date: p.date, hour: p.hour, past: false }));
    const candidates = combos(futureDays.filter((d) => d > ctx.today)).filter(
      (p) => !taken.has(`${p.date} ${p.hour}`),
    );
    rng
      .sample(candidates, freeShare[key])
      .forEach((p) => freeSlots.push({ key, date: p.date, hour: p.hour }));
  });

  // Atributos sorteados e embaralhados (50% on-line, 35% coworking, 15% domicílio; 85% psicoterapia).
  const modalities = rng.shuffle<SessionModality>([
    ...new Array<SessionModality>(30).fill('online'),
    ...new Array<SessionModality>(21).fill('in_person_coworking'),
    ...new Array<SessionModality>(9).fill('in_person_home'),
  ]);
  const kinds = rng.shuffle<CareSession['kind']>([
    ...new Array<CareSession['kind']>(51).fill('psychotherapy'),
    ...new Array<CareSession['kind']>(9).fill('guidance'),
  ]);
  const pastStatuses = rng.shuffle<CareSession['status']>([
    ...new Array<CareSession['status']>(24).fill('done'),
    ...new Array<CareSession['status']>(3).fill('no_show'),
    ...new Array<CareSession['status']>(2).fill('cancelled_by_user'),
    ...new Array<CareSession['status']>(2).fill('cancelled_by_psychologist'),
  ]);

  const pastPlan = plan.filter((p) => p.past);
  const futurePlan = plan
    .filter((p) => !p.past)
    .sort((a, b) => (a.date + a.hour < b.date + b.hour ? -1 : 1));
  const ordered: (Plan & { status: CareSession['status'] })[] = [
    ...pastPlan.map((p, i) => ({ ...p, status: pastStatuses[i] as CareSession['status'] })),
    ...futurePlan.map((p, i) => ({
      ...p,
      status: (i < 8 ? 'confirmed' : 'scheduled') as CareSession['status'],
    })),
  ];

  const pools = new Map<PsychologistKey, string[]>();
  KEYS.forEach((key) => {
    pools.set(
      key,
      c.caregivers
        .filter(
          (cg) =>
            cg.assignedPsychologistId === PSYCHOLOGIST[key].id &&
            cg.status === 'active' &&
            s.consentPlan.get(cg.id)?.health_data === 'granted',
        )
        .map((cg) => cg.id),
    );
  });
  const poolCursor = new Map<PsychologistKey, number>();
  const doneSessions: CareSession[] = [];

  ordered.forEach((p, i) => {
    const pool = pools.get(p.key) as string[];
    const cursor = poolCursor.get(p.key) ?? rng.int(0, Math.max(0, pool.length - 1));
    poolCursor.set(p.key, cursor + 1);
    const cgId = pool[cursor % pool.length] as string;
    const modality = modalities[i] as SessionModality;
    const planId = planOfCaregiver.get(cgId) ?? 'livre';
    const discount = discountOf(planId);
    const startAt = ctx.at(p.date, p.hour);
    const slotId = ctx.nextId('slot');
    const sessionId = ctx.nextId('ses');
    const confirmedOrDone = p.status === 'done' || p.status === 'confirmed';
    const end = `${String(Number(p.hour.slice(0, 2)) + 1).padStart(2, '0')}:00`;

    c.availabilitySlots.push(
      ctx.entity<AvailabilitySlot>(slotId, ctx.dt(-20, '08:00'), {
        psychologistId: PSYCHOLOGIST[p.key].id,
        date: p.date,
        start: p.hour,
        end,
        status: 'booked',
        priorityOnly: false,
      }),
    );
    const session = ctx.entity<CareSession>(sessionId, ctx.dt(-16, '10:00'), {
      caregiverId: cgId,
      psychologistId: PSYCHOLOGIST[p.key].id,
      slotId,
      startAt,
      durationMin: 60,
      modality,
      ...(modality === 'in_person_coworking'
        ? { roomId: rng.chance(0.5) ? ROOM.girassol : ROOM.ipe }
        : {}),
      ...(modality === 'in_person_home'
        ? {
            homeAddress: `Rua Exemplo, ${rng.int(10, 900)}, Uberlândia`,
            homeVisitConfirmedSafe: confirmedOrDone,
          }
        : {}),
      kind: kinds[i] as CareSession['kind'],
      status: p.status,
      ...(modality === 'online' && p.status === 'done'
        ? { remoteFormatConfirmedPertinent: true }
        : {}),
      priceCents: sessionPriceCents(s.singletons.settings.sessionBasePriceCents, discount),
      discountPercent: discount,
      ...(p.status === 'cancelled_by_user'
        ? { cancelledAt: ctx.at(addDays(p.date, -2), '10:00') }
        : {}),
      ...(p.status === 'cancelled_by_psychologist'
        ? { cancelledAt: ctx.at(addDays(p.date, -1), '09:00') }
        : {}),
    });
    c.careSessions.push(session);
    if (p.status === 'done') {
      doneSessions.push(session);
    }
  });

  // ===== Anotações: 24 sessões realizadas, 20 assinadas e 4 em rascunho (as mais recentes) =====
  const byDate = [...doneSessions].sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
  byDate.forEach((session, i) => {
    const draft = i >= byDate.length - 4;
    const signedAt = ctx.at(addDays(session.startAt.slice(0, 10), 0), '19:00');
    c.sessionNotes.push(
      ctx.entity<SessionNote>(ctx.nextId('note'), session.startAt, {
        sessionId: session.id,
        authorPsychologistId: session.psychologistId,
        content: NOTE_TEXTS[i % NOTE_TEXTS.length] as string,
        status: draft ? 'draft' : 'signed',
        ...(draft ? {} : { signedAt }),
        addenda:
          !draft && i % 9 === 0
            ? [
                {
                  at: ctx.dt(-1, '08:30'),
                  content: 'Adendo: retorno confirmado para a próxima quinzena.',
                },
              ]
            : [],
      }),
    );
  });

  // ===== Vagas livres (12) e bloqueadas (3) nas próximas duas semanas =====
  freeSlots.forEach((p, i) => {
    const blocked = i >= 12;
    c.availabilitySlots.push(
      ctx.entity<AvailabilitySlot>(ctx.nextId('slot'), ctx.dt(-20, '08:00'), {
        psychologistId: PSYCHOLOGIST[p.key].id,
        date: p.date,
        start: p.hour,
        end: `${String(Number(p.hour.slice(0, 2)) + 1).padStart(2, '0')}:00`,
        status: blocked ? 'blocked' : 'open',
        priorityOnly: !blocked && i % 3 === 0,
      }),
    );
  });
}
