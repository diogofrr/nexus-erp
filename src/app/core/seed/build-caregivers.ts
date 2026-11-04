/**
 * Cuidadores (29 de cenário + 311 de volume), pessoas idosas, medicamentos, compromissos, bem-estar e uso do app.
 * Os de volume (5.6): todos no plano Livre, consentimento de saúde em 85%, 120 com Zarit de adesão
 * distribuída em 24 / 46 / 36 / 14 pelas quatro faixas, datas entre D-170 e D-60.
 */
import { addDays, addYears } from '../clock/date-utils';
import {
  Caregiver,
  Elder,
  Medication,
  CareAppointment,
  WellbeingCheck,
  AppUsageSummary,
  Dependency,
  ConsentKey,
  ConsentStatus,
  ID,
} from '../models';
import { generateFictitiousCpf, generateFictitiousPhone } from '../rules/validators';
import { caregiverCode } from '../privacy/pseudonym';
import { ELDER_FIRST_NAMES, FIRST_NAMES, LAST_NAMES, slugify } from './names';
import { PSYCHOLOGIST, PsychologistKey, caregiverId, elderId } from './refs';
import { SCENARIOS, ZaritPoint } from './scenarios';
import { SeedState } from './state';
import { pad4 } from './context';

const CONDITIONS: readonly string[] = [
  'Hipertensão e dificuldade de locomoção',
  'Diabetes e baixa visão',
  'Esquecimentos frequentes e uso de bengala',
  'Sequelas de AVC, com apoio para banho e alimentação',
  'Osteoporose e risco de quedas',
  'Doença de Parkinson em acompanhamento',
  'Insuficiência cardíaca controlada',
  'Demência em fase inicial',
];

const MEDICATIONS: readonly { name: string; dosage: string }[] = [
  { name: 'Losartana', dosage: '50 mg' },
  { name: 'Metformina', dosage: '850 mg' },
  { name: 'Sinvastatina', dosage: '20 mg' },
  { name: 'Omeprazol', dosage: '20 mg' },
  { name: 'Levotiroxina', dosage: '50 mcg' },
  { name: 'Donepezila', dosage: '5 mg' },
  { name: 'AAS', dosage: '100 mg' },
  { name: 'Furosemida', dosage: '40 mg' },
];

const APPOINTMENTS: readonly { title: string; kind: CareAppointment['kind'] }[] = [
  { title: 'Consulta de rotina com clínico geral', kind: 'medical' },
  { title: 'Sessão de fisioterapia', kind: 'physio' },
  { title: 'Retorno com geriatra', kind: 'medical' },
  { title: 'Atendimento com psicólogo da Nexus', kind: 'psychological' },
  { title: 'Exames de sangue', kind: 'other' },
];

const FEATURES: readonly string[] = [
  'agenda',
  'medicamentos',
  'conteudos',
  'rede',
  'mensagens',
  'cartao',
  'grupos',
  'registro_de_bem_estar',
];
const OTHER_CITIES: readonly string[] = ['Uberaba', 'Araguari', 'Araxá', 'Ituiutaba'];

interface Draft {
  n: number;
  fullName: string;
  age: number;
  sex: Caregiver['sex'];
  relationship: Caregiver['relationship'];
  city: string;
  hours: number;
  channel: Caregiver['preferredChannel'];
  literacy: Caregiver['digitalLiteracy'];
  dependency: Dependency;
  psy?: PsychologistKey;
  isPilot: boolean;
  corporate: boolean;
  enrolledAt: string;
  consents: Record<ConsentKey, ConsentStatus>;
  scenario: boolean;
}

function defaultConsents(isPilot: boolean): Record<ConsentKey, ConsentStatus> {
  return {
    health_data: 'granted',
    people_analytics: 'granted',
    family_sharing: 'granted',
    image_testimony: 'pending',
    whatsapp_contact: 'granted',
    pilot_tcle: isPilot ? 'granted' : 'pending',
  };
}

/** Distribui `total` em 22 respostas de 0 a 4 (determinístico). */
export function distributeAnswers(total: number, rnd: () => number): number[] {
  const answers = new Array<number>(22).fill(0);
  let left = total;
  let guard = 0;
  while (left > 0 && guard < 10_000) {
    guard += 1;
    const i = Math.floor(rnd() * 22);
    if ((answers[i] as number) < 4) {
      answers[i] = (answers[i] as number) + 1;
      left -= 1;
    }
  }
  return answers;
}

export function buildCaregivers(s: SeedState): void {
  const { ctx, c } = s;
  const rng = ctx.rng;
  const drafts: Draft[] = [];

  // ===== Cenário (29) =====
  SCENARIOS.forEach((def) => {
    const points = def.zarit(ctx);
    const id = caregiverId(def.n);
    s.zaritPoints.set(id, points);
    if (def.nextDue) {
      s.nextDueOverride.set(id, def.nextDue(ctx));
    }
    const consents = { ...defaultConsents(def.pilot), ...def.consents };
    drafts.push({
      n: def.n,
      fullName: def.fullName,
      age: def.age,
      sex: def.sex,
      relationship: def.relationship,
      city: def.city ?? 'Uberlândia',
      hours: def.hours,
      channel: def.channel,
      literacy: def.literacy,
      dependency: def.dependency,
      psy: def.psy,
      isPilot: def.pilot,
      corporate: def.corporate === true,
      enrolledAt: def.enrolledAt ? def.enrolledAt(ctx) : (points[0] as ZaritPoint).appliedAt,
      consents,
      scenario: true,
    });
  });

  // ===== Volume (311) =====
  const volumeCount = 311;
  const order = rng.shuffle(Array.from({ length: volumeCount }, (_, i) => i));
  const healthGranted = new Set(order.slice(0, 264)); // 85% de 311
  const withZarit = order.slice(0, 120);
  const pilotSlots = new Set(withZarit.slice(0, 7));
  const bandRanges: [number, number][] = [
    [0, 20],
    [21, 40],
    [41, 60],
    [61, 88],
  ];
  const bandList = rng.shuffle([
    ...new Array<number>(24).fill(0),
    ...new Array<number>(46).fill(1),
    ...new Array<number>(36).fill(2),
    ...new Array<number>(14).fill(3),
  ]);
  const zaritByIndex = new Map<number, ZaritPoint>();
  withZarit.forEach((index, k) => {
    const [lo, hi] = bandRanges[bandList[k] as number] as [number, number];
    let daysAgo = rng.int(60, 170);
    if (pilotSlots.has(index)) {
      // 6 pilotos com mês 3 ainda por vir; 1 com a janela do mês 3 perdida (missed).
      daysAgo = k === 6 ? 120 : rng.int(62, 85);
    }
    zaritByIndex.set(index, { appliedAt: ctx.d(-daysAgo), total: rng.int(lo, hi) });
  });
  const psyWeights: PsychologistKey[] = [
    'rafael',
    'rafael',
    'rafael',
    'beatriz',
    'beatriz',
    'leticia',
    'leticia',
    'tiago',
    'tiago',
  ];

  for (let i = 0; i < volumeCount; i += 1) {
    const n = 30 + i;
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const last2 = rng.pick(LAST_NAMES);
    const isPilot = pilotSlots.has(i);
    const zarit = zaritByIndex.get(i);
    const consents = defaultConsents(isPilot);
    if (!healthGranted.has(i)) {
      consents.health_data = 'pending';
      consents.people_analytics = 'pending';
      consents.family_sharing = rng.chance(0.2) ? 'granted' : 'pending';
    } else {
      consents.people_analytics = rng.chance(0.8) ? 'granted' : 'pending';
      consents.family_sharing = rng.chance(0.4) ? 'granted' : 'pending';
    }
    consents.image_testimony = rng.chance(0.12)
      ? 'granted'
      : rng.chance(0.06)
        ? 'refused'
        : 'pending';
    consents.whatsapp_contact = rng.chance(0.6)
      ? 'granted'
      : rng.chance(0.15)
        ? 'refused'
        : 'pending';
    const dependency: Dependency = isPilot
      ? rng.pick<Dependency>(['partial', 'total'])
      : rng.chance(0.55)
        ? 'partial'
        : rng.chance(0.67)
          ? 'total'
          : 'independent';
    const enrolledAt = zarit ? zarit.appliedAt : ctx.d(-rng.int(5, 180));
    if (zarit) {
      s.zaritPoints.set(caregiverId(n), [zarit]);
    }
    drafts.push({
      n,
      fullName: `${first.name} ${last} ${last2}`,
      age: rng.int(35, 72),
      sex: first.sex,
      relationship:
        first.sex === 'male'
          ? rng.pick<Caregiver['relationship']>(['son', 'son', 'spouse'])
          : rng.pick<Caregiver['relationship']>([
              'daughter',
              'daughter',
              'daughter',
              'spouse',
              'daughter_in_law',
              'grandchild',
            ]),
      city: isPilot || rng.chance(0.92) ? 'Uberlândia' : rng.pick(OTHER_CITIES),
      hours: rng.int(2, 6),
      channel: rng.pick<Caregiver['preferredChannel']>([
        'app',
        'app',
        'whatsapp',
        'whatsapp',
        'phone',
        'email',
      ]),
      literacy: rng.pick<Caregiver['digitalLiteracy']>(['low', 'medium', 'medium', 'high']),
      dependency,
      ...(zarit ? { psy: rng.pick(psyWeights) } : {}),
      isPilot,
      corporate: false,
      enrolledAt,
      consents,
      scenario: false,
    });
    if (isPilot) {
      s.volumePilotIds.push(caregiverId(n));
    }
  }

  // ===== Entidades =====
  drafts.forEach((d) => {
    const id = caregiverId(d.n);
    const code = caregiverCode(d.n);
    s.enrollmentDate.set(id, d.enrolledAt);
    s.consentPlan.set(id, d.consents);
    const surname = d.fullName.split(' ').slice(-1)[0] as string;
    const emailLocal = d.scenario ? slugify(d.fullName) : `${slugify(d.fullName)}.${pad4(d.n)}`;
    const birthDate = addDays(addYears(ctx.today, -d.age), -rng.int(1, 300));
    const phone = generateFictitiousPhone(d.n);
    const paused = d.consents.health_data === 'revoked';
    const createdAt = ctx.at(d.enrolledAt, '09:00');
    const caregiver: Caregiver = ctx.entity<Caregiver>(id, createdAt, {
      code,
      fullName: d.fullName,
      cpf: generateFictitiousCpf(d.n),
      cpfIsFictitious: true,
      email: `${emailLocal}@exemplo.com.br`,
      phone,
      ...(d.channel === 'whatsapp' || rng.chance(0.5) ? { whatsapp: phone } : {}),
      birthDate,
      sex: d.sex,
      relationship: d.relationship,
      city: d.city,
      dailyCareHours: d.hours,
      ...(d.isPilot ? { weeklyOrganizationHours: rng.int(6, 12) } : {}),
      sociodemographics: {
        education: rng.pick([
          'Ensino médio',
          'Ensino superior',
          'Ensino fundamental',
          'Pós-graduação',
        ]),
        incomeBand: rng.pick([
          'Até 2 salários mínimos',
          '2 a 5 salários mínimos',
          'Mais de 5 salários mínimos',
        ]),
        employment: rng.pick(['Empregada(o)', 'Autônoma(o)', 'Aposentada(o)', 'Sem vínculo']),
      },
      preferredChannel: d.channel,
      digitalLiteracy: d.literacy,
      status: paused ? 'paused_by_consent_revocation' : 'active',
      enrolledAt: d.enrolledAt,
      ...(d.psy ? { assignedPsychologistId: PSYCHOLOGIST[d.psy].id } : {}),
      ...(d.corporate ? { corporateAccountId: 'corp_0001' } : {}),
      isPilot: d.isPilot,
    });
    c.caregivers.push(caregiver);

    // Pessoa idosa (uma por cuidador, RN-USR-10). Os de volume têm cadastro mínimo.
    const elder = ctx.entity<Elder>(elderId(d.n), createdAt, {
      caregiverId: id,
      fullName: `${rng.pick(ELDER_FIRST_NAMES)} ${surname}`,
      birthDate: addDays(addYears(ctx.today, -rng.int(72, 92)), -rng.int(1, 300)),
      dependency: d.dependency,
      ...(d.scenario ? { conditionsSummary: rng.pick(CONDITIONS) } : {}),
    });
    c.elders.push(elder);

    if (d.scenario) {
      const meds = rng.sample(MEDICATIONS, 2);
      meds.forEach((m, k) => {
        c.medications.push(
          ctx.entity<Medication>(ctx.nextId('med'), createdAt, {
            elderId: elder.id,
            name: m.name,
            dosage: m.dosage,
            times: k === 0 ? ['08:00', '20:00'] : ['12:00'],
            active: true,
          }),
        );
      });
      const appt = rng.pick(APPOINTMENTS);
      c.careAppointments.push(
        ctx.entity<CareAppointment>(ctx.nextId('apt'), createdAt, {
          elderId: elder.id,
          title: appt.title,
          at: ctx.dt(rng.int(2, 25), rng.pick(['09:00', '10:30', '14:00', '15:30'])),
          kind: appt.kind,
          reminder: true,
        }),
      );
      if (d.n <= 10 && d.consents.health_data === 'granted') {
        for (let k = 0; k < 3; k += 1) {
          c.wellbeingChecks.push(
            ctx.entity<WellbeingCheck>(ctx.nextId('wbc'), ctx.dt(-(k * 7 + 2), '20:00'), {
              caregiverId: id,
              date: ctx.d(-(k * 7 + 2)),
              mood: (d.n <= 3 ? rng.int(1, 3) : rng.int(2, 5)) as WellbeingCheck['mood'],
            }),
          );
        }
      }
    }

    // Uso do aplicativo (K31): dados simulados.
    const accesses = d.n === 26 ? 12 : rng.chance(0.15) ? 0 : rng.int(1, 28);
    c.appUsage.push(
      ctx.entity<AppUsageSummary>(ctx.nextId('use'), ctx.dt(-1, '23:00'), {
        caregiverId: id,
        accesses30d: accesses,
        distinctFeatures:
          accesses === 0 ? [] : rng.sample(FEATURES, rng.int(1, Math.min(6, FEATURES.length))),
        ...(accesses > 0 ? { lastAccessAt: ctx.dt(-rng.int(0, 20), '19:30') } : {}),
      }),
    );
  });
}

/** Ids dos cuidadores de cenário (C01 a C29). */
export function scenarioIds(): ID[] {
  return SCENARIOS.map((d) => caregiverId(d.n));
}
