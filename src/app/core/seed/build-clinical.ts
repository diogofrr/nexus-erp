/**
 * Zarit (158 concluídas: 38 de cenário e 120 de volume, mais as próximas agendadas), alertas (9 nomeados
 * Z-a a Z-i mais os históricos encerrados), ARBE (gerada pela própria regra), pedido de revisão,
 * ocorrências (O-1 a O-3) e encaminhamentos (10).
 */
import { addDays } from '../clock/date-utils';
import {
  ArbeAlert,
  Caregiver,
  Occurrence,
  OccurrenceStep,
  Referral,
  ReferralCategory,
  ReviewRequest,
  ZaritAlert,
  ZaritAssessment,
} from '../models';
import { countSupportRequests, evaluateArbe } from '../rules/arbe';
import { POP05_STEPS, POP07_AUTHORITIES, POP07_STEPS, redAlertDeadline } from '../rules/pop05';
import { nextZaritDueDate, zaritAlertLevel, zaritBand } from '../rules/zarit';
import { REFERRAL_TABLE } from '../rules/governance';
import { distributeAnswers } from './build-caregivers';
import { OCCURRENCE, PSYCHOLOGIST, USER, ZARIT_ALERT, caregiverId, complaintId } from './refs';
import { SeedState } from './state';

/** Ids fixos dos 10 encaminhamentos (5.14). */
export const REFERRAL_ID = {
  c03Caps: 'ref_0001',
  c11Urgency: 'ref_0002',
  c18Cras: 'ref_0003',
  c28Creas: 'ref_0004',
  c27Lawyer: 'ref_0005',
  c14Ubs: 'ref_0006',
  c26ClinicSchool: 'ref_0007',
  c02Caps: 'ref_0008',
  c24Cras: 'ref_0009',
  c05ClinicSchool: 'ref_0010',
} as const;

interface NamedAlert {
  id: string;
  status: ZaritAlert['status'];
  /** Dias depois da aplicação em que o contato foi feito (`undefined` = sem contato). */
  contactAfterDays?: number;
  risk?: 'low' | 'moderate' | 'high';
  closed?: boolean;
  supportReview?: boolean;
  referralIds?: string[];
  occurrenceId?: string;
}

const NAMED: Record<string, NamedAlert> = {
  '1:1': { id: ZARIT_ALERT.a, status: 'open', occurrenceId: OCCURRENCE.o2 },
  '2:1': { id: ZARIT_ALERT.b, status: 'open' },
  '3:0': {
    id: ZARIT_ALERT.c,
    status: 'closed',
    contactAfterDays: 0,
    risk: 'moderate',
    closed: true,
    referralIds: [REFERRAL_ID.c03Caps],
  },
  '3:1': { id: ZARIT_ALERT.d, status: 'contacted', contactAfterDays: 1, supportReview: true },
  '8:0': { id: ZARIT_ALERT.e, status: 'open', supportReview: false },
  '9:0': { id: ZARIT_ALERT.f, status: 'contacted', contactAfterDays: 1, supportReview: true },
  '10:0': { id: ZARIT_ALERT.g, status: 'closed', contactAfterDays: 0, risk: 'low', closed: true },
  '11:0': {
    id: ZARIT_ALERT.h,
    status: 'closed',
    contactAfterDays: 0,
    risk: 'high',
    closed: true,
    referralIds: [REFERRAL_ID.c11Urgency],
    occurrenceId: OCCURRENCE.o1,
  },
  '28:0': { id: ZARIT_ALERT.i, status: 'open', supportReview: false, occurrenceId: OCCURRENCE.o3 },
};

export function buildClinical(s: SeedState): void {
  const { ctx, c } = s;
  const rng = ctx.rng;
  const userOfPsy = (psyId: string): string =>
    (c.psychologists.find((p) => p.id === psyId) as { userId: string }).userId;
  // Os 9 alertas nomeados (Z-a a Z-i) têm ids fixos: os demais começam depois deles.
  ctx.reserve('zal', 9);
  const stampOn = (date: string): string =>
    date === ctx.today ? ctx.at(date, '00:10') : ctx.at(date, '17:30');

  // ===== Aplicações e alertas =====
  c.caregivers.forEach((cg: Caregiver) => {
    const points = s.zaritPoints.get(cg.id);
    if (!points || !cg.assignedPsychologistId) {
      return;
    }
    const n = Number(cg.id.slice(3));
    const psyUser = userOfPsy(cg.assignedPsychologistId);
    points.forEach((point, k) => {
      const assessmentId = ctx.nextId('zar');
      const prev = points[k - 1];
      c.zaritAssessments.push(
        ctx.entity<ZaritAssessment>(assessmentId, stampOn(point.appliedAt), {
          caregiverId: cg.id,
          psychologistId: cg.assignedPsychologistId as string,
          kind: k === 0 ? 'enrollment' : 'quarterly',
          sequence: k,
          dueDate: prev ? nextZaritDueDate(prev.appliedAt) : point.appliedAt,
          appliedAt: point.appliedAt,
          answers: distributeAnswers(point.total, () => rng.next()),
          total: point.total,
          band: zaritBand(point.total),
          status: 'completed',
          signedAt: stampOn(point.appliedAt),
          addenda: [],
        }),
      );

      const level = zaritAlertLevel(point.total);
      if (!level) {
        return;
      }
      const named = NAMED[`${n}:${k}`];
      const closedGeneric = !named;
      const id = named ? named.id : ctx.nextId('zal');
      const contactDays = named ? named.contactAfterDays : 0;
      const contactAt =
        contactDays === undefined
          ? undefined
          : ctx.at(addDays(point.appliedAt, contactDays), contactDays === 0 ? '10:30' : '11:00');
      const status = named ? named.status : 'closed';
      const riskLevel = named ? named.risk : level === 'red' ? 'low' : undefined;
      const alert: ZaritAlert = ctx.entity<ZaritAlert>(id, stampOn(point.appliedAt), {
        assessmentId,
        caregiverId: cg.id,
        level,
        status,
        ...(level === 'red' ? { deadlineAt: redAlertDeadline(point.appliedAt) } : {}),
        ...(contactAt || closedGeneric
          ? {
              contact: {
                at: contactAt ?? ctx.at(point.appliedAt, '10:30'),
                byUserId: psyUser,
                channel: cg.preferredChannel,
                note: 'Contato realizado pela equipe.',
              },
            }
          : {}),
        ...(level === 'red' && riskLevel && (named ? named.closed : true)
          ? {
              riskAssessment: {
                at: ctx.at(point.appliedAt, '11:15'),
                byUserId: psyUser,
                level: riskLevel,
                note:
                  riskLevel === 'high'
                    ? 'Risco avaliado como alto; encaminhamento imediato conforme o POP-05.'
                    : 'Avaliação de risco registrada pelo psicólogo do caso.',
              },
            }
          : {}),
        ...(level === 'yellow'
          ? { supportNetworkReviewDone: named ? (named.supportReview ?? false) : true }
          : {}),
        referralIds: named?.referralIds ?? [],
        ...(named?.occurrenceId ? { occurrenceId: named.occurrenceId } : {}),
        ...((named ? named.closed : true)
          ? {
              closedAt: ctx.at(point.appliedAt, '17:00'),
              closureNote: 'Alerta encerrado pelo psicólogo do caso.',
            }
          : {}),
      });
      c.zaritAlerts.push(alert);
    });

    // Próxima aplicação agendada (RN-ZRT-05), salvo consentimento revogado.
    const override = s.nextDueOverride.get(cg.id);
    const consent = s.consentPlan.get(cg.id);
    if (override !== null && consent?.health_data === 'granted') {
      const last = points[points.length - 1] as { appliedAt: string };
      c.zaritAssessments.push(
        ctx.entity<ZaritAssessment>(ctx.nextId('zar'), ctx.at(last.appliedAt), {
          caregiverId: cg.id,
          psychologistId: cg.assignedPsychologistId,
          kind: 'quarterly',
          sequence: points.length,
          dueDate: override ?? nextZaritDueDate(last.appliedAt),
          status: 'scheduled',
          addenda: [],
        }),
      );
    }
  });

  // ===== ARBE (gerada pelas regras sobre horas, pedidos de apoio e Zarit) =====
  const arbeSettings = s.singletons.settings.arbe;
  c.caregivers.forEach((cg) => {
    const points = s.zaritPoints.get(cg.id);
    const consent = s.consentPlan.get(cg.id);
    if (!points || consent?.health_data !== 'granted' || !cg.assignedPsychologistId) {
      return;
    }
    const last = points[points.length - 1] as { appliedAt: string; total: number };
    const result = evaluateArbe(
      {
        dailyCareHours: cg.dailyCareHours,
        supportRequestsInWindow: countSupportRequests(
          c.messages,
          cg.id,
          ctx.today,
          arbeSettings.windowDays,
        ),
        lastZarit: last.total,
      },
      arbeSettings,
    );
    if (!result) {
      return;
    }
    const n = Number(cg.id.slice(3));
    const psyUser = userOfPsy(cg.assignedPsychologistId);
    const generatedAt = stampOn(n === 29 ? ctx.d(-2) : n === 3 ? ctx.d(-10) : last.appliedAt);
    let status: ArbeAlert['status'] = 'closed';
    const extra: Partial<ArbeAlert> = {};
    if (n === 1 || n === 29) {
      status = 'generated';
    } else if (n === 2) {
      status = 'confirmed';
      extra.reviewedByUserId = psyUser;
    } else if (n === 3) {
      status = 'contacted';
      extra.reviewedByUserId = psyUser;
      extra.contactedAt = ctx.dt(-9, '11:00');
    } else {
      extra.reviewedByUserId = psyUser;
      extra.closedAt = ctx.at(last.appliedAt, '17:30');
    }
    c.arbeAlerts.push(
      ctx.entity<ArbeAlert>(ctx.nextId('arb'), generatedAt, {
        caregiverId: cg.id,
        level: result.level,
        generatedAt,
        criteria: result.criteria,
        status,
        ...extra,
      }),
    );
  });

  // ===== Pedido de revisão (C02) =====
  c.reviewRequests.push(
    ctx.entity<ReviewRequest>(ctx.nextId('rvw'), ctx.dt(-4, '14:00'), {
      caregiverId: caregiverId(2),
      psychologistId: PSYCHOLOGIST.beatriz.id,
      about: 'zarit_decision',
      text: 'Peço que a decisão de acompanhamento prioritário seja revista, porque me sinto mais preparada do que o resultado indica.',
      dueAt: ctx.d(6),
    }),
  );

  // ===== Encaminhamentos (10, cobrindo as 7 categorias do Quadro 12) =====
  const referral = (
    id: string,
    n: number,
    category: ReferralCategory,
    destinations: string[],
    daysAgo: number,
    by: string,
    status: Referral['status'],
    extra: Partial<Referral> = {},
  ): void => {
    c.referrals.push(
      ctx.entity<Referral>(id, ctx.dt(-daysAgo, '15:00'), {
        caregiverId: caregiverId(n),
        category,
        destinations,
        at: ctx.d(-daysAgo),
        byUserId: by,
        status,
        ...extra,
      }),
    );
  };
  const dest = (category: ReferralCategory): string[] => [
    ...(REFERRAL_TABLE.find((r) => r.category === category)?.destinations ?? []),
  ];
  referral(
    REFERRAL_ID.c03Caps,
    3,
    'psychiatric_follow_up',
    ['CAPS de referência'],
    100,
    USER.rafael,
    'acknowledged',
    { outcome: 'Cuidador iniciou acompanhamento no CAPS.' },
  );
  referral(
    REFERRAL_ID.c11Urgency,
    11,
    'severe_distress_or_suicide_risk',
    dest('severe_distress_or_suicide_risk'),
    2,
    USER.leticia,
    'registered',
    { occurrenceId: OCCURRENCE.o1 },
  );
  referral(
    REFERRAL_ID.c18Cras,
    18,
    'social_vulnerability',
    ['CRAS do território'],
    30,
    USER.tiago,
    'registered',
  );
  referral(
    REFERRAL_ID.c28Creas,
    28,
    'rights_violation_or_neglect',
    ['CREAS', 'Disque 100'],
    5,
    USER.technicalLead,
    'registered',
    { occurrenceId: OCCURRENCE.o3 },
  );
  referral(
    REFERRAL_ID.c27Lawyer,
    27,
    'social_security_or_guardianship',
    ['Advogado da rede'],
    25,
    USER.tiago,
    'acknowledged',
    { outcome: 'Família atendida pelo advogado Dr. Heitor Magalhães, da rede.' },
  );
  referral(
    REFERRAL_ID.c14Ubs,
    14,
    'elder_clinical_worsening',
    ['UBS de referência'],
    18,
    USER.beatriz,
    'registered',
    { familyCommunicated: true },
  );
  referral(
    REFERRAL_ID.c26ClinicSchool,
    26,
    'caregiver_cannot_afford_care',
    ['Clínicas-escola'],
    40,
    USER.tiago,
    'closed',
    { outcome: 'Atendimento iniciado na clínica-escola. Plano gratuito mantido.' },
  );
  referral(
    REFERRAL_ID.c02Caps,
    2,
    'psychiatric_follow_up',
    ['UBS', 'CAPS de referência'],
    1,
    USER.technicalLead,
    'registered',
  );
  referral(
    REFERRAL_ID.c24Cras,
    24,
    'social_vulnerability',
    ['CRAS do território'],
    55,
    USER.rafael,
    'acknowledged',
    { outcome: 'Família cadastrada nos benefícios do território.' },
  );
  referral(
    REFERRAL_ID.c05ClinicSchool,
    5,
    'caregiver_cannot_afford_care',
    ['Serviços públicos'],
    60,
    USER.rafael,
    'closed',
    { outcome: 'Encaminhamento concluído.' },
  );

  // ===== Ocorrências (3) =====
  const steps = (
    labels: readonly string[],
    done: number,
    baseDate: string,
    byUserId: string,
    firstTime: string,
  ): OccurrenceStep[] =>
    labels.map((label, k) => ({
      n: k + 1,
      label,
      ...(k < done
        ? {
            doneAt: ctx.at(
              baseDate,
              k === 0
                ? firstTime
                : baseDate === ctx.today
                  ? `00:${20 + 10 * k}`
                  : `${String(10 + k).padStart(2, '0')}:${k % 2 === 0 ? '00' : '30'}`,
            ),
            byUserId,
          }
        : {}),
    }));
  c.occurrences.push(
    ctx.entity<Occurrence>(OCCURRENCE.o1, ctx.dt(-2, '09:50'), {
      kind: 'pop05_risk',
      caregiverId: caregiverId(11),
      openedAt: ctx.dt(-2, '09:50'),
      status: 'closed',
      restrictedToUserIds: [USER.technicalLead, USER.leticia],
      steps: steps(POP05_STEPS, 7, ctx.d(-2), USER.leticia, '09:50').map((st, k) =>
        k === 0
          ? st
          : {
              ...st,
              note:
                k === 3
                  ? 'Encaminhada à rede de urgência em saúde mental; informado o CVV (188).'
                  : undefined,
            },
      ),
      authoritiesNotified: [],
      sourceAlertId: ZARIT_ALERT.h,
    }),
    ctx.entity<Occurrence>(OCCURRENCE.o2, ctx.dt(0, '00:20'), {
      kind: 'pop05_risk',
      caregiverId: caregiverId(1),
      openedAt: ctx.dt(0, '00:20'),
      status: 'in_progress',
      restrictedToUserIds: [USER.technicalLead, USER.rafael],
      steps: steps(POP05_STEPS, 2, ctx.today, USER.rafael, '00:20').map((st, k) =>
        k === 1
          ? {
              ...st,
              note: 'Tentativas de ligação sem retorno até agora; contato efetivo pendente.',
            }
          : st,
      ),
      authoritiesNotified: [],
      sourceAlertId: ZARIT_ALERT.a,
    }),
    ctx.entity<Occurrence>(OCCURRENCE.o3, ctx.dt(-5, '11:20'), {
      kind: 'pop07_violence_suspicion',
      caregiverId: caregiverId(28),
      elderId: `el_${String(28).padStart(4, '0')}`,
      openedAt: ctx.dt(-5, '11:20'),
      status: 'open',
      restrictedToUserIds: [USER.technicalLead, USER.tiago],
      steps: steps(POP07_STEPS, 1, ctx.d(-5), USER.technicalLead, '11:20'),
      authoritiesNotified: POP07_AUTHORITIES.slice(0, 2).map((body) => ({ body })),
      sourceAlertId: ZARIT_ALERT.i,
      sourceComplaintId: complaintId(4),
    }),
  );
}
