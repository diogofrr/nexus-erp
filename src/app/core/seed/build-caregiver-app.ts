/**
 * Dados de demonstração do aplicativo do cuidador (docs/10-cuidador-contexto.md, "Pessoas de demonstração").
 * Roda por último e SEM sortear nada: não mexe na sequência do gerador de números e acrescenta só linhas novas,
 * então as contagens e os cenários que os testes do seed protegem continuam iguais.
 *
 * - As 10 pessoas de demonstração já têm pessoa idosa e medicamentos com horários (vêm de `build-caregivers`).
 *   Aqui entram os compromissos de HOJE e dos próximos dias de cada uma (a tela "Hoje" e a "Agenda" nunca ficam
 *   vazias na demonstração).
 * - Ana (C01) tem 3 remédios (4 doses por dia) e remédios marcados como dados nos últimos dias e os da manhã de hoje,
 *   para a tela mostrar o que já foi dado e o que falta.
 * - Rita (C08) tem um serviço da rede CONCLUÍDO e ainda sem avaliação (o cartão "Avaliar" de Hoje): é um pedido que já
 *   existia, de um cuidador de volume, reatribuído a ela, então as contagens de pedidos e as métricas da rede não mudam.
 * - Ana (C01) e Lourdes (C24) têm uma conversa FUTURA com o psicólogo (uma a mais em `careSessions` e uma vaga a mais em
 *   `availabilitySlots`, `booked`), para o "Para você" de Hoje e a Agenda aparecerem na demonstração. Os meses fechados
 *   (`monthSummaries`, de onde vem a ocupação de Rafael, 86,3% e 91,3%) não são tocados.
 * - João (C03) não autorizou compartilhar com a família e Ana autorizou (`scenarios.ts`).
 * - Raimunda (C18, pedido de exclusão aberto) entra na lista de pessoas de demonstração.
 */
import { addDays, addMinutes } from '../clock/date-utils';
import { AvailabilitySlot, CareAppointment, CareSession, DoseCheck, ISODate, Medication } from '../models';
import { sessionPriceCents } from '../rules/plans';
import { isBusinessDay } from '../rules/sla';
import { PSYCHOLOGIST, PsychologistKey, ROOM, caregiverId, elderId } from './refs';
import { SeedState } from './state';

/** Números dos cenários (C01...) que aparecem na entrada do aplicativo: 6 em destaque e mais 5 em "Ver mais exemplos". */
export const DEMO_CAREGIVER_NUMBERS: readonly number[] = [1, 2, 3, 8, 27, 24, 12, 26, 16, 4, 18];

const APPOINTMENT_KINDS: readonly { title: string; kind: CareAppointment['kind'] }[] = [
  { title: 'Sessão de fisioterapia', kind: 'physio' },
  { title: 'Retorno com geriatra', kind: 'medical' },
  { title: 'Consulta com clínico geral', kind: 'medical' },
  { title: 'Exames de sangue', kind: 'other' },
  { title: 'Consulta com cardiologista', kind: 'medical' },
  { title: 'Aplicação de vacina', kind: 'other' },
];

const TODAY_TIMES: readonly string[] = ['16:00', '17:30', '18:30'];

export function buildCaregiverApp(s: SeedState): void {
  const { ctx, c } = s;

  DEMO_CAREGIVER_NUMBERS.forEach((n, i) => {
    const elder = elderId(n);
    const createdAt = ctx.at(ctx.d(-30), '10:00');
    // Um compromisso hoje (no fim da tarde), outro em 1 a 3 dias e outro em 4 a 6 dias.
    const slots: { day: number; time: string }[] = [
      { day: 0, time: TODAY_TIMES[i % TODAY_TIMES.length] as string },
      { day: 1 + (i % 3), time: '09:30' },
      { day: 4 + (i % 3), time: '14:00' },
    ];
    slots.forEach((slot, k) => {
      const kind = APPOINTMENT_KINDS[(i + k * 2) % APPOINTMENT_KINDS.length] as {
        title: string;
        kind: CareAppointment['kind'];
      };
      c.careAppointments.push(
        ctx.entity<CareAppointment>(ctx.nextId('apt'), createdAt, {
          elderId: elder,
          title: kind.title,
          at: ctx.dt(slot.day, slot.time),
          kind: kind.kind,
          reminder: true,
        }),
      );
    });
  });

  // Ana: um terceiro remédio, de manhã cedo (4 doses por dia), para a lista de Hoje passar de 3 linhas.
  const ana = elderId(1);
  if (c.medications.filter((m) => m.elderId === ana && m.active).length < 3) {
    c.medications.push(
      ctx.entity<Medication>(ctx.nextId('med'), ctx.at(ctx.d(-30), '10:00'), {
        elderId: ana,
        name: 'Omeprazol',
        dosage: '20 mg',
        times: ['07:30'],
        active: true,
      }),
    );
  }

  // Ana: remédios dados nos últimos 4 dias (menos o da noite de anteontem) e os de antes das 9h de hoje.
  const anaMeds = c.medications.filter((m) => m.elderId === ana && m.active);
  const marks: { day: number; medicationId: string; time: string }[] = [];
  anaMeds.forEach((m) => {
    m.times.forEach((time) => {
      for (let day = -4; day <= -1; day += 1) {
        const skipped = day === -2 && time === '20:00';
        if (!skipped) {
          marks.push({ day, medicationId: m.id, time });
        }
      }
      if (time <= '08:00') {
        marks.push({ day: 0, medicationId: m.id, time });
      }
    });
  });
  marks
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time) || a.medicationId.localeCompare(b.medicationId))
    .forEach((mark) => {
      const date = ctx.d(mark.day);
      const givenAt = addMinutes(ctx.at(date, mark.time), 7);
      c.doseChecks.push(
        ctx.entity<DoseCheck>(ctx.nextId('dose'), givenAt, {
          medicationId: mark.medicationId,
          date,
          time: mark.time,
          givenAt,
        }),
      );
    });


  // Rita: um serviço concluído e sem avaliação. Reatribui o primeiro pedido concluído de um cuidador de volume, de um
  // prestador que aparece na busca (ativo ou em monitoramento), para não criar pedido novo.
  const demoIds = new Set(DEMO_CAREGIVER_NUMBERS.map((n) => caregiverId(n)));
  const visibleProviders = new Set(
    c.providers.filter((p) => p.status === 'active' || p.status === 'monitoring').map((p) => p.id),
  );
  const index = c.serviceRequests.findIndex(
    (r) =>
      r.status === 'completed' &&
      !r.evaluationId &&
      visibleProviders.has(r.providerId) &&
      !demoIds.has(r.caregiverId) &&
      Number(r.caregiverId.slice(3)) > 29,
  );
  const request = c.serviceRequests[index];
  if (request) {
    c.serviceRequests[index] = { ...request, caregiverId: caregiverId(8) };
  }

  // Ana e Lourdes: uma conversa futura com o psicólogo, cada uma com a vaga correspondente já ocupada.
  addDemoSession(s, {
    caregiverNumber: 1,
    psychologist: 'rafael',
    businessDays: 3,
    status: 'scheduled',
    modality: 'online',
  });
  addDemoSession(s, {
    caregiverNumber: 24,
    psychologist: 'leticia',
    businessDays: 2,
    status: 'confirmed',
    modality: 'in_person_coworking',
  });
}

/** Horários que o psicólogo atende (os mesmos de `build-sessions`), na ordem em que a demonstração os escolhe. */
const SESSION_HOURS: readonly string[] = [
  '10:00',
  '14:00',
  '15:00',
  '16:00',
  '11:00',
  '09:00',
  '17:00',
  '08:00',
];

interface DemoSession {
  caregiverNumber: number;
  psychologist: PsychologistKey;
  /** Dias úteis a partir de hoje (fim de semana e feriado nacional não contam). */
  businessDays: number;
  status: 'scheduled' | 'confirmed';
  modality: 'online' | 'in_person_coworking';
}

/** O dia útil de número `n` depois de hoje: n = 1 é o primeiro dia útil seguinte. */
function businessDayAfter(today: ISODate, n: number): ISODate {
  let date = today;
  let remaining = n;
  while (remaining > 0) {
    date = addDays(date, 1);
    if (isBusinessDay(date)) {
      remaining -= 1;
    }
  }
  return date;
}

/**
 * Uma conversa futura, sem sortear: o primeiro horário em que o psicólogo não tem nenhuma vaga (livre, ocupada ou
 * bloqueada) naquele dia. A vaga nasce `booked` e o preço já vem com o desconto do plano da pessoa (RN-ATD-05).
 */
function addDemoSession(s: SeedState, spec: DemoSession): void {
  const { ctx, c } = s;
  const psy = PSYCHOLOGIST[spec.psychologist];
  const date = businessDayAfter(ctx.today, spec.businessDays);
  const taken = new Set(
    c.availabilitySlots
      .filter((x) => x.psychologistId === psy.id && x.date === date)
      .map((x) => x.start),
  );
  const hour = SESSION_HOURS.find((h) => !taken.has(h));
  if (!hour) {
    return;
  }
  const end = `${String(Number(hour.slice(0, 2)) + 1).padStart(2, '0')}:00`;
  const owner = caregiverId(spec.caregiverNumber);
  const planId = c.subscriptions.find((sub) => sub.caregiverId === owner)?.planId ?? 'livre';
  const discount = c.plans.find((p) => p.id === planId)?.psychSessionDiscountPercent ?? 0;

  const slotId = ctx.nextId('slot');
  c.availabilitySlots.push(
    ctx.entity<AvailabilitySlot>(slotId, ctx.dt(-20, '08:00'), {
      psychologistId: psy.id,
      date,
      start: hour,
      end,
      status: 'booked',
      priorityOnly: false,
    }),
  );
  c.careSessions.push(
    ctx.entity<CareSession>(ctx.nextId('ses'), ctx.dt(-2, '10:00'), {
      caregiverId: owner,
      psychologistId: psy.id,
      slotId,
      startAt: ctx.at(date, hour),
      durationMin: 60,
      modality: spec.modality,
      ...(spec.modality === 'in_person_coworking' ? { roomId: ROOM.girassol } : {}),
      kind: 'psychotherapy',
      status: spec.status,
      priceCents: sessionPriceCents(s.singletons.settings.sessionBasePriceCents, discount),
      discountPercent: discount,
    }),
  );
}
