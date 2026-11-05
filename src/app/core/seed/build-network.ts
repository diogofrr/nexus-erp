/**
 * Rede credenciada (5.8 e 5.9): 20 prestadores e 20 credenciamentos, 213 solicitações (124 históricas
 * `evaluated` e 89 dos últimos 30 dias), 124 avaliações com a SOMA das notas exata da tabela, instantâneos
 * das auditorias de D-28 e D-14, avaliações internas, documentos e histórico de status.
 */
import { addDays, weekday } from '../clock/date-utils';
import {
  Accreditation,
  ArpSnapshot,
  ChecklistItem,
  ChecklistKey,
  InternalReview,
  Provider,
  ProviderCategory,
  ProviderCouncil,
  ProviderDocument,
  ProviderEvaluation,
  ProviderStatus,
  ProviderStatusEvent,
  Rating,
  ServiceRequest,
  ServiceRequestStatus,
} from '../models';
import {
  arpBand,
  evaluationEditableUntil,
  evaluationScore,
  providerAverageFromSum,
} from '../rules/arp';
import { generateFictitiousPhone } from '../rules/validators';
import { slugify } from './names';
import { Rng } from './prng';
import { USER, caregiverId, providerId } from './refs';
import { SeedState } from './state';

interface ProviderDef {
  n: number;
  name: string;
  person: 'person' | 'company';
  category: ProviderCategory;
  specialty: string;
  council: ProviderCouncil;
  home: boolean;
  status: ProviderStatus;
  accreditation: Accreditation['status'];
  evals: number;
  sum: number;
  /** Quantas avaliações trazem reclamação grave no campo aberto. */
  graveEvals: number;
  graveCategory?: 'unjustified_absence' | 'confidentiality_breach';
  recent: number;
  recentRefused: number;
  /** Dias atrás da ativação (entradas na rede, K27). */
  activatedDaysAgo?: number;
}

const none: ProviderCouncil = { body: 'NONE', status: 'not_applicable' };

export const PROVIDER_DEFS: readonly ProviderDef[] = [
  {
    n: 1,
    name: 'Dra. Renata Sampaio',
    person: 'person',
    category: 'physiotherapy',
    specialty: 'Fisioterapia geriátrica',
    council: {
      body: 'CREFITO',
      number: '00001-F',
      state: 'MG',
      status: 'active',
      fictitious: true,
    },
    home: true,
    status: 'active',
    accreditation: 'active',
    evals: 12,
    sum: 116,
    graveEvals: 0,
    recent: 10,
    recentRefused: 1,
    activatedDaysAgo: 330,
  },
  {
    n: 2,
    name: 'Clínica Movimento Vital',
    person: 'company',
    category: 'physiotherapy',
    specialty: 'Fisioterapia e reabilitação',
    council: {
      body: 'CREFITO',
      number: '00002-J',
      state: 'MG',
      status: 'active',
      fictitious: true,
    },
    home: false,
    status: 'active',
    accreditation: 'active',
    evals: 9,
    sum: 83,
    graveEvals: 0,
    recent: 6,
    recentRefused: 0,
    activatedDaysAgo: 300,
  },
  {
    n: 3,
    name: 'Fisio em Casa Uberlândia',
    person: 'company',
    category: 'physiotherapy',
    specialty: 'Fisioterapia domiciliar',
    council: {
      body: 'CREFITO',
      number: '00003-J',
      state: 'MG',
      status: 'active',
      fictitious: true,
    },
    home: true,
    status: 'monitoring',
    accreditation: 'active',
    evals: 8,
    sum: 68,
    graveEvals: 0,
    recent: 7,
    recentRefused: 2,
    activatedDaysAgo: 270,
  },
  {
    n: 4,
    name: 'Aline Cristina Pires',
    person: 'person',
    category: 'professional_caregiver',
    specialty: 'Cuidadora de pessoas idosas',
    council: none,
    home: true,
    status: 'monitoring',
    accreditation: 'active',
    evals: 7,
    sum: 58,
    graveEvals: 0,
    recent: 8,
    recentRefused: 5,
    activatedDaysAgo: 240,
  },
  {
    n: 5,
    name: 'Valdir Antunes',
    person: 'person',
    category: 'professional_caregiver',
    specialty: 'Cuidador de pessoas idosas',
    council: none,
    home: true,
    status: 'active',
    accreditation: 'active',
    evals: 10,
    sum: 94,
    graveEvals: 0,
    recent: 5,
    recentRefused: 0,
    activatedDaysAgo: 220,
  },
  {
    n: 6,
    name: 'Cuidar Bem Home Care',
    person: 'company',
    category: 'home_care',
    specialty: 'Home care',
    council: none,
    home: true,
    status: 'monitoring',
    accreditation: 'active',
    evals: 6,
    sum: 53,
    graveEvals: 0,
    recent: 10,
    recentRefused: 3,
    activatedDaysAgo: 200,
  },
  {
    n: 7,
    name: 'Enf. Priscila Gouveia',
    person: 'person',
    category: 'nursing',
    specialty: 'Enfermagem domiciliar',
    council: { body: 'COREN', number: '000123', state: 'MG', status: 'active', fictitious: true },
    home: true,
    status: 'active',
    accreditation: 'active',
    evals: 14,
    sum: 137,
    graveEvals: 0,
    recent: 12,
    recentRefused: 1,
    activatedDaysAgo: 180,
  },
  {
    n: 8,
    name: 'Farmácia Vida Plena',
    person: 'company',
    category: 'pharmacy',
    specialty: 'Farmácia',
    council: none,
    home: false,
    status: 'active',
    accreditation: 'active',
    evals: 6,
    sum: 54,
    graveEvals: 0,
    recent: 6,
    recentRefused: 0,
    activatedDaysAgo: 160,
  },
  {
    n: 9,
    name: 'Drogaria Santa Clara',
    person: 'company',
    category: 'pharmacy',
    specialty: 'Farmácia',
    council: none,
    home: false,
    status: 'monitoring',
    accreditation: 'active',
    evals: 5,
    sum: 40,
    graveEvals: 0,
    recent: 4,
    recentRefused: 0,
    activatedDaysAgo: 150,
  },
  {
    n: 10,
    name: 'Clínica Saúde Integral',
    person: 'company',
    category: 'clinic',
    specialty: 'Clínica multiprofissional',
    council: none,
    home: false,
    status: 'suspended',
    accreditation: 'active',
    evals: 7,
    sum: 50,
    graveEvals: 1,
    graveCategory: 'unjustified_absence',
    recent: 3,
    recentRefused: 2,
    activatedDaysAgo: 140,
  },
  {
    n: 11,
    name: 'Dr. Eduardo Falcão',
    person: 'person',
    category: 'physiotherapy',
    specialty: 'Fisioterapia ortopédica e neurológica',
    council: { body: 'CREFITO', number: '00011-F', state: 'MG', status: 'active', fictitious: true },
    home: false,
    status: 'active',
    accreditation: 'active',
    evals: 10,
    sum: 94,
    graveEvals: 0,
    recent: 4,
    recentRefused: 0,
    activatedDaysAgo: 210,
  },
  {
    n: 12,
    name: 'Dra. Sônia Peixoto',
    person: 'person',
    category: 'physiotherapy',
    specialty: 'Fisioterapia respiratória',
    council: { body: 'CREFITO', number: '00012-F', state: 'MG', status: 'active', fictitious: true },
    home: false,
    status: 'monitoring',
    accreditation: 'active',
    evals: 6,
    sum: 52,
    graveEvals: 0,
    recent: 3,
    recentRefused: 0,
    activatedDaysAgo: 190,
  },
  {
    n: 13,
    name: 'Dra. Valéria Costa',
    person: 'person',
    category: 'psychology',
    specialty: 'Psicologia (rede credenciada)',
    council: { body: 'CRP', number: '00221', state: '04', status: 'active', fictitious: true },
    home: false,
    status: 'active',
    accreditation: 'active',
    evals: 3,
    sum: 27,
    graveEvals: 0,
    recent: 3,
    recentRefused: 0,
    activatedDaysAgo: 120,
  },
  {
    n: 14,
    name: 'Nutri Camila Rezende',
    person: 'person',
    category: 'nutrition',
    specialty: 'Nutrição',
    council: { body: 'CRN', number: '00231', state: '9', status: 'active', fictitious: true },
    home: false,
    status: 'suspended',
    accreditation: 'active',
    evals: 8,
    sum: 69,
    graveEvals: 2,
    graveCategory: 'unjustified_absence',
    recent: 4,
    recentRefused: 1,
    activatedDaysAgo: 100,
  },
  {
    n: 15,
    name: 'Dr. Heitor Magalhães',
    person: 'person',
    category: 'legal',
    specialty: 'Advocacia (previdenciário e curatela)',
    council: { body: 'OAB', number: '00314', state: 'MG', status: 'active', fictitious: true },
    home: false,
    status: 'active',
    accreditation: 'active',
    evals: 5,
    sum: 46,
    graveEvals: 0,
    recent: 2,
    recentRefused: 0,
    activatedDaysAgo: 90,
  },
  {
    n: 16,
    name: 'Dra. Isadora Leal',
    person: 'person',
    category: 'physiotherapy',
    specialty: 'Fisioterapia',
    council: {
      body: 'CREFITO',
      number: '00016-F',
      state: 'MG',
      status: 'active',
      fictitious: true,
    },
    home: true,
    status: 'candidate',
    accreditation: 'pending_documents',
    evals: 0,
    sum: 0,
    graveEvals: 0,
    recent: 0,
    recentRefused: 0,
  },
  {
    n: 17,
    name: 'Equipamentos Cuidar+',
    person: 'company',
    category: 'specialized_service',
    specialty: 'Equipamentos e adaptações para a casa',
    council: none,
    home: true,
    status: 'candidate',
    accreditation: 'in_review',
    evals: 0,
    sum: 0,
    graveEvals: 0,
    recent: 0,
    recentRefused: 0,
  },
  {
    n: 18,
    name: 'Cuidadores Express',
    person: 'company',
    category: 'professional_caregiver',
    specialty: 'Agência de cuidadores',
    council: none,
    home: true,
    status: 'rejected',
    accreditation: 'rejected',
    evals: 0,
    sum: 0,
    graveEvals: 0,
    recent: 0,
    recentRefused: 0,
  },
  {
    n: 19,
    name: 'Dr. Otávio Lima',
    person: 'person',
    category: 'physiotherapy',
    specialty: 'Fisioterapia',
    council: {
      body: 'CREFITO',
      number: '00019-F',
      state: 'MG',
      status: 'inactive',
      fictitious: true,
    },
    home: true,
    status: 'deaccredited',
    accreditation: 'active',
    evals: 6,
    sum: 36,
    graveEvals: 3,
    graveCategory: 'unjustified_absence',
    recent: 0,
    recentRefused: 0,
    activatedDaysAgo: 330,
  },
  {
    n: 20,
    name: 'Cuidadora Rosimeire Tavares',
    person: 'person',
    category: 'professional_caregiver',
    specialty: 'Cuidadora de pessoas idosas',
    council: none,
    home: true,
    status: 'active',
    accreditation: 'active',
    evals: 2,
    sum: 17,
    graveEvals: 0,
    recent: 2,
    recentRefused: 0,
    activatedDaysAgo: 20,
  },
];

const NEEDS: Record<ProviderCategory, string> = {
  physiotherapy: 'Sessões de fisioterapia para a pessoa idosa',
  professional_caregiver: 'Cuidador(a) para acompanhar a pessoa idosa durante o dia',
  home_care: 'Atendimento de home care após internação',
  nursing: 'Curativos e aplicação de medicação em casa',
  pharmacy: 'Entrega de medicamentos de uso contínuo',
  clinic: 'Avaliação multiprofissional',
  psychology: 'Acompanhamento psicológico pela rede',
  nutrition: 'Orientação nutricional para a pessoa idosa',
  legal: 'Orientação sobre benefícios e curatela',
  specialized_service: 'Adaptação do banheiro e do quarto',
};

const COMMENTS: readonly string[] = [
  'Atendimento pontual e cuidadoso.',
  'Explicou tudo com clareza para a família.',
  'Chegou no horário combinado e foi cordial.',
  'Bom atendimento, voltaria a contratar.',
  'Poderia ter explicado melhor as orientações finais.',
  'Atendeu bem, mas houve um pequeno atraso.',
];

const GRAVE_COMMENTS: Record<'unjustified_absence' | 'confidentiality_breach', string> = {
  unjustified_absence: 'O profissional faltou ao atendimento combinado sem avisar a família.',
  confidentiality_breach: 'Informações da família foram comentadas com terceiros.',
};

/** Divide `sum` em `count` notas inteiras de 1 a 5, preservando a soma EXATA (5.8). */
export function splitScores(sum: number, count: number, rng: Rng): number[] {
  if (count <= 0) {
    return [];
  }
  const base = Math.floor(sum / count);
  const rest = sum - base * count;
  const scores = new Array<number>(count).fill(base).map((v, i) => (i < rest ? v + 1 : v));
  for (let step = 0; step < count * 6; step += 1) {
    const i = rng.int(0, count - 1);
    const j = rng.int(0, count - 1);
    if (i !== j && (scores[i] as number) < 5 && (scores[j] as number) > 1) {
      scores[i] = (scores[i] as number) + 1;
      scores[j] = (scores[j] as number) - 1;
    }
  }
  return rng.shuffle(scores);
}

export function buildNetwork(s: SeedState): void {
  const { ctx, c } = s;
  const rng = ctx.rng;
  const allCaregivers = c.caregivers.map((cg) => cg.id);
  const monday = addDays(ctx.today, -((weekday(ctx.today) + 6) % 7));

  PROVIDER_DEFS.forEach((def) => {
    const id = providerId(def.n);
    const accId = `acr_${String(def.n).padStart(4, '0')}`;
    const activated = def.activatedDaysAgo !== undefined ? ctx.d(-def.activatedDaysAgo) : undefined;
    const isCandidate = def.status === 'candidate' || def.status === 'rejected';
    const hasClause = !isCandidate && def.n !== 20;

    c.providers.push(
      ctx.entity<Provider>(id, ctx.dt(-(def.activatedDaysAgo ?? 40) - 20), {
        name: def.name,
        personType: def.person,
        category: def.category,
        specialtyLabel: def.specialty,
        council: def.council,
        city: 'Uberlândia',
        homeCare: def.home,
        conditionsForNexusUsers:
          'Horário prioritário e condições combinadas para usuários da Nexus. O pagamento é feito direto ao profissional.',
        email: `${slugify(def.name)}@exemplo.com.br`,
        phone: generateFictitiousPhone(500 + def.n),
        status: def.status,
        accreditationId: accId,
        ...(activated
          ? {
              integrationDoneAt: addDays(activated, -3),
              popsAcknowledgedAt: addDays(activated, -3),
              parallelSolicitationBanAcceptedAt: addDays(activated, -3),
            }
          : {}),
        ...(hasClause && activated ? { dataProtectionClauseSignedAt: addDays(activated, -4) } : {}),
        availability: isCandidate
          ? []
          : [-28, -21, -14, -7, 0].map((offset, k) => ({
              weekStart: addDays(monday, offset),
              slots: def.n === 4 && k === 4 ? 4 : 10,
            })),
        highlight:
          providerAverageFromSum(def.sum, def.evals) !== null &&
          (providerAverageFromSum(def.sum, def.evals) as number) >= 4.5 &&
          def.status === 'active',
      }),
    );

    // ===== Credenciamento e checklist dos 5 critérios =====
    const checkDate = activated ? addDays(activated, -5) : ctx.d(-15);
    const hasCouncil = def.council.body !== 'NONE';
    const item = (
      key: ChecklistKey,
      status: ChecklistItem['status'],
      note?: string,
    ): ChecklistItem => ({
      status: key === 'council_registry' && !hasCouncil ? 'not_applicable' : status,
      checkedBy: def.n === 13 && key === 'council_registry' ? USER.technicalLead : USER.partner,
      checkedAt: checkDate,
      ...(note ? { note } : {}),
    });
    const checklist: Accreditation['checklist'] = {
      council_registry: item('council_registry', 'ok'),
      training_proof: item('training_proof', 'ok'),
      accreditation_contract: item('accreditation_contract', 'ok'),
      data_protection_term: item('data_protection_term', 'ok'),
      continuous_evaluation_accepted: item('continuous_evaluation_accepted', 'ok'),
    };
    if (def.n === 16) {
      checklist.council_registry = {
        status: 'pending',
        checkedBy: USER.partner,
        checkedAt: ctx.d(-12),
        note: 'Registro no conselho com validade vencida.',
      };
    }
    if (def.n === 18) {
      checklist.training_proof = {
        status: 'failed',
        checkedBy: USER.partner,
        checkedAt: ctx.d(-20),
        note: 'Sem comprovação de formação.',
      };
      checklist.accreditation_contract = {
        status: 'failed',
        checkedBy: USER.partner,
        checkedAt: ctx.d(-20),
        note: 'Contrato de credenciamento não assinado.',
      };
    }
    c.accreditations.push(
      ctx.entity<Accreditation>(accId, ctx.dt(-(def.activatedDaysAgo ?? 30) - 15), {
        providerId: id,
        status: def.accreditation,
        checklist,
        ...(def.n === 18
          ? {
              rejectionReason:
                'Sem contrato de credenciamento assinado e sem comprovação de formação.',
              decidedAt: ctx.d(-20),
              decidedBy: USER.partner,
            }
          : {}),
        ...(activated ? { decidedAt: addDays(activated, -3), decidedBy: USER.partner } : {}),
      }),
    );

    // ===== Documentos =====
    const doc = (
      kind: ProviderDocument['kind'],
      fileName: string,
      validUntil?: string,
      status: ProviderDocument['status'] = 'valid',
    ): void => {
      c.providerDocuments.push(
        ctx.entity<ProviderDocument>(
          ctx.nextId('pdoc'),
          ctx.dt(-(def.activatedDaysAgo ?? 40) - 10),
          {
            providerId: id,
            kind,
            fileName,
            issuedAt: addDays(activated ?? ctx.d(-60), -10),
            ...(validUntil ? { validUntil } : {}),
            status,
          },
        ),
      );
    };
    if (def.n !== 18) {
      doc('identity', `documento-identificacao-${def.n}.pdf`);
      doc('training_proof', `comprovacao-formacao-${def.n}.pdf`);
      doc('contract', `contrato-credenciamento-${def.n}.pdf`);
      doc('data_protection_term', `termo-protecao-dados-${def.n}.pdf`);
    } else {
      doc('identity', 'documento-identificacao-18.pdf');
    }
    if (hasCouncil) {
      if (def.n === 16) {
        doc('council_registry', 'registro-crefito-16.pdf', ctx.d(-12), 'expired');
      } else {
        doc('council_registry', `registro-conselho-${def.n}.pdf`, ctx.d(200 + def.n * 17));
      }
    }

    // ===== Histórico de status (entradas e saídas, K27) =====
    const event = (
      from: ProviderStatus | null,
      to: ProviderStatus,
      daysAgo: number,
      reason: string,
      by = USER.partner,
    ): void => {
      c.providerStatusEvents.push(
        ctx.entity<ProviderStatusEvent>(ctx.nextId('pse'), ctx.dt(-daysAgo, '10:00'), {
          providerId: id,
          from,
          to,
          reason,
          byUserId: by,
        }),
      );
    };
    if (def.n === 18) {
      event(null, 'candidate', 40, 'Credenciamento solicitado');
      event('candidate', 'rejected', 20, 'Reprovado: sem contrato e sem comprovação de formação');
    } else if (isCandidate) {
      event(null, 'candidate', def.n === 16 ? 35 : 25, 'Credenciamento solicitado');
    } else {
      event(
        null,
        'active',
        def.activatedDaysAgo as number,
        'Credenciamento aprovado e integração concluída',
      );
      if (def.status === 'monitoring') {
        event('active', 'monitoring', 28, 'Média na zona de alerta na auditoria quinzenal');
      }
      if (def.n === 10) {
        event('active', 'suspended', 28, 'Média abaixo de 4,0 na auditoria quinzenal');
      }
      if (def.n === 14) {
        event('active', 'monitoring', 28, 'Média na zona de alerta na auditoria quinzenal');
        event('monitoring', 'suspended', 5, 'Terceira reclamação grave registrada');
      }
      if (def.n === 19) {
        event('active', 'suspended', 75, 'Três reclamações graves registradas');
        event(
          'suspended',
          'deaccredited',
          60,
          'Descredenciamento confirmado na avaliação interna',
          USER.partner,
        );
      }
    }
  });

  // ===== Avaliações e solicitações históricas (124) =====
  const evaluationsByProvider = new Map<string, ProviderEvaluation[]>();
  PROVIDER_DEFS.filter((d) => d.evals > 0).forEach((def) => {
    const id = providerId(def.n);
    const scores = splitScores(def.sum, 2 * def.evals, rng);
    const lastBack = def.n === 19 ? 70 : 34;
    const list: ProviderEvaluation[] = [];
    for (let k = 0; k < def.evals; k += 1) {
      const daysAgo = rng.int(lastBack, 200);
      const requestedAt = ctx.dt(-daysAgo, '10:00');
      const completedAt = ctx.dt(-daysAgo + 2, '16:00');
      const cgId = rng.pick(allCaregivers);
      const requestId = ctx.nextId('srq');
      const evalId = ctx.nextId('evl');
      const technical = scores[2 * k] as Rating;
      const punctuality = scores[2 * k + 1] as Rating;
      const grave = k < def.graveEvals && def.graveCategory;
      const evaluation = ctx.entity<ProviderEvaluation>(evalId, ctx.dt(-daysAgo + 3, '09:00'), {
        serviceRequestId: requestId,
        providerId: id,
        caregiverId: cgId,
        technicalQuality: technical,
        punctualityCourtesy: punctuality,
        ...(grave
          ? {
              comment:
                GRAVE_COMMENTS[
                  def.graveCategory as 'unjustified_absence' | 'confidentiality_breach'
                ],
            }
          : rng.chance(0.5)
            ? { comment: rng.pick(COMMENTS) }
            : {}),
        score: evaluationScore(technical, punctuality),
        ...(grave
          ? {
              grave: {
                category: def.graveCategory as 'unjustified_absence' | 'confidentiality_breach',
                classifiedBy: USER.partner,
                classifiedAt: ctx.d(-daysAgo + 5),
              },
            }
          : {}),
        editableUntil: evaluationEditableUntil(ctx.d(-daysAgo + 3)),
      });
      list.push(evaluation);
      c.providerEvaluations.push(evaluation);
      c.serviceRequests.push(
        ctx.entity<ServiceRequest>(requestId, requestedAt, {
          caregiverId: cgId,
          providerId: id,
          specialty: def.category,
          need: NEEDS[def.category],
          modality: def.home ? 'home' : 'at_provider',
          status: 'evaluated',
          requestedAt,
          respondedAt: ctx.dt(-daysAgo, '11:00'),
          completedAt,
          evaluationId: evalId,
        }),
      );
    }
    evaluationsByProvider.set(id, list);
  });

  // ===== Solicitações dos últimos 30 dias (89) =====
  const reasonRefused = [
    'Agenda cheia nesta semana',
    'Fora da área de atendimento',
    'Horário indisponível',
  ];
  PROVIDER_DEFS.filter((d) => d.recent > 0).forEach((def, j) => {
    const id = providerId(def.n);
    const statuses: ServiceRequestStatus[] = [];
    for (let k = 0; k < def.recentRefused; k += 1) {
      statuses.push(k % 2 === 0 ? 'refused_by_provider' : 'cancelled_by_provider');
    }
    const restCount = def.recent - def.recentRefused;
    const cycle: ServiceRequestStatus[] =
      def.n === 11
        ? ['requested', 'requested', 'accepted', 'completed']
        : def.n === 20
          ? ['requested', 'requested']
          : def.n === 4
            ? ['accepted', 'completed', 'cancelled_by_user']
            : ['completed', 'accepted', 'cancelled_by_user', 'completed', 'requested'];
    for (let k = 0; k < restCount; k += 1) {
      statuses.push(cycle[k % cycle.length] as ServiceRequestStatus);
    }
    statuses.forEach((status, k) => {
      const daysAgo =
        status === 'completed' ? 4 + ((j * 5 + k * 3) % 25) : 1 + ((j * 5 + k * 3) % 28);
      const requestedAt = ctx.dt(-daysAgo, `${String(9 + (k % 6)).padStart(2, '0')}:00`);
      const caregiver =
        def.n === 11 && k === 0
          ? caregiverId(3)
          : def.n === 11 && k === 1
            ? caregiverId(27)
            : rng.pick(allCaregivers);
      c.serviceRequests.push(
        ctx.entity<ServiceRequest>(ctx.nextId('srq'), requestedAt, {
          caregiverId: caregiver,
          providerId: id,
          specialty: def.category,
          need: NEEDS[def.category],
          modality: def.home ? 'home' : 'at_provider',
          status,
          requestedAt,
          ...(status !== 'requested' && status !== 'cancelled_by_user'
            ? { respondedAt: ctx.dt(-daysAgo, `${String(11 + (k % 6)).padStart(2, '0')}:00`) }
            : {}),
          ...(status === 'completed' ? { completedAt: ctx.dt(-daysAgo + 2, '16:00') } : {}),
          ...(status === 'refused_by_provider' || status === 'cancelled_by_provider'
            ? { reason: reasonRefused[k % reasonRefused.length] as string }
            : {}),
        }),
      );
    });
  });

  // ===== Instantâneos das auditorias de D-28 e D-14 (RN-ARP-05) =====
  const graveFromComplaints = (providerIdValue: string, until: string): number =>
    c.complaints.filter(
      (rec) =>
        rec.severity === 'grave' &&
        rec.target.providerId === providerIdValue &&
        rec.openedAt.slice(0, 10) <= until,
    ).length;
  [-28, -14].forEach((offset) => {
    const auditDate = ctx.d(offset);
    PROVIDER_DEFS.filter((d) => d.evals > 0 && d.n !== 19).forEach((def) => {
      const id = providerId(def.n);
      const evals = (evaluationsByProvider.get(id) ?? []).filter(
        (e) => e.createdAt.slice(0, 10) <= auditDate,
      );
      const graves =
        evals.filter((e) => e.grave && e.grave.classifiedAt <= auditDate).length +
        graveFromComplaints(id, auditDate);
      const sum = evals.reduce((acc, e) => acc + e.technicalQuality + e.punctualityCourtesy, 0);
      const average = providerAverageFromSum(sum, evals.length);
      c.arpSnapshots.push(
        ctx.entity<ArpSnapshot>(ctx.nextId('arp'), ctx.at(auditDate, '08:00'), {
          providerId: id,
          auditDate,
          average,
          evaluationCount: evals.length,
          band: arpBand(average, graves),
          graveComplaintCount: graves,
          auditedBy: USER.partner,
        }),
      );
    });
  });

  // ===== Avaliações internas =====
  c.internalReviews.push(
    ctx.entity<InternalReview>(ctx.nextId('irv'), ctx.dt(-28, '09:00'), {
      providerId: providerId(10),
      openedAt: ctx.d(-28),
      trigger: 'average_below_4',
      justification:
        'Reconhecemos o resultado das avaliações e já reorganizamos a escala da equipe para evitar faltas e atrasos. Pedimos a reavaliação do credenciamento.',
      justificationAt: ctx.dt(-6, '15:20'),
    }),
    ctx.entity<InternalReview>(ctx.nextId('irv'), ctx.dt(-5, '09:00'), {
      providerId: providerId(14),
      openedAt: ctx.d(-5),
      trigger: 'grave_complaints',
    }),
    ctx.entity<InternalReview>(ctx.nextId('irv'), ctx.dt(-75, '09:00'), {
      providerId: providerId(19),
      openedAt: ctx.d(-75),
      trigger: 'grave_complaints',
      justification: 'Houve imprevistos pessoais nas datas indicadas. Peço compreensão.',
      justificationAt: ctx.dt(-70, '10:00'),
      decision: 'confirm_deaccreditation',
      decidedBy: USER.partner,
      decidedAt: ctx.d(-61),
      decisionNote: 'Três faltas sem justificativa confirmadas. Credenciamento encerrado.',
      closureEmail: {
        to: `${slugify('Dr. Otávio Lima')}@exemplo.com.br`,
        subject: 'Encerramento do credenciamento na rede Nexus',
        body: 'Informamos o encerramento do seu credenciamento na rede Nexus, após a avaliação interna das reclamações registradas. Agradecemos o período de parceria.',
        sentAt: ctx.dt(-60, '10:30'),
      },
    }),
  );
}
