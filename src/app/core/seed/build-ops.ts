/**
 * Grupos e capacitações (5.10: G1 a G8), governança (5.14: 10 POPs, 12 riscos, formação, conteúdos, normas)
 * e piloto (5.15: 15 cuidadores com TCLE).
 */
import { addMonths } from '../clock/date-utils';
import {
  Activity,
  ActivityEnrollment,
  ActivityKind,
  ActivityMeeting,
  GuidanceContent,
  ID,
  NormReference,
  PilotEnrollment,
  Pop,
  PopAcknowledgement,
  PopReview,
  RiskItem,
  TrainingEvent,
} from '../models';
import { popReviewState } from '../rules/governance';
import { POP05_STEPS, POP07_STEPS } from '../rules/pop05';
import { PSYCHOLOGIST, ROOM, USER, activityId, caregiverId, providerId } from './refs';
import { SCENARIO_PILOT_NUMBERS } from './scenarios';
import { SeedState } from './state';

const CONFIDENTIALITY =
  'Contrato de sigilo: o que for dito no grupo fica no grupo. Não compartilhamos relatos com familiares ou terceiros sem autorização. A atividade não promete resultado terapêutico.';

export function buildGroups(s: SeedState): void {
  const { ctx, c } = s;

  const meetings = (
    n: number,
    startDays: number,
    count: number,
    doneCount: number,
    startTime = '14:00',
    stepDays = 7,
  ): ActivityMeeting[] =>
    Array.from({ length: count }, (_, k) => ({
      id: `${activityId(n)}_m${k + 1}`,
      startAt: ctx.dt(startDays + k * stepDays, startTime),
      endAt: ctx.dt(
        startDays + k * stepDays,
        `${String(Number(startTime.slice(0, 2)) + 2).padStart(2, '0')}:00`,
      ),
      done: k < doneCount,
    }));

  const activity = (
    n: number,
    kind: ActivityKind,
    title: string,
    theme: Activity['theme'],
    leader: Activity['leaders'][number],
    mode: Activity['mode'],
    capacity: number,
    status: Activity['status'],
    meetingList: ActivityMeeting[],
    extra: Partial<Activity> = {},
  ): void => {
    c.activities.push(
      ctx.entity<Activity>(activityId(n), ctx.dt(-60), {
        kind,
        title,
        theme,
        character: kind === 'group_therapy' ? 'psychotherapy' : 'guidance',
        leaders: [leader],
        mode,
        meetings: meetingList,
        capacity,
        status,
        minPlan: kind === 'support_group' || kind === 'training' ? 'cuida' : null,
        requiresEligibility: kind === 'group_therapy',
        confidentialityText: CONFIDENTIALITY,
        ...(mode === 'in_person' ? { roomId: ROOM.girassol } : {}),
        ...extra,
      }),
    );
  };
  const psy = (key: keyof typeof PSYCHOLOGIST): Activity['leaders'][number] => ({
    type: 'psychologist',
    id: PSYCHOLOGIST[key].id,
    name: PSYCHOLOGIST[key].name,
    professionalRegistration: `${PSYCHOLOGIST[key].crp} (fictício)`,
  });

  activity(
    1,
    'support_group',
    'Sobrecarga e autocuidado',
    'caregiver_burden',
    psy('rafael'),
    'in_person',
    8,
    'full',
    meetings(1, 3, 4, 0),
  );
  activity(
    2,
    'training',
    'Prevenção de quedas',
    'fall_prevention',
    { type: 'provider', id: providerId(1), name: 'Dra. Renata Sampaio (profissional parceira)' },
    'in_person',
    12,
    'open',
    meetings(2, 10, 2, 0),
    { roomId: ROOM.ipe },
  );
  activity(
    3,
    'group_therapy',
    'Luto ambíguo, em grupo',
    'emotional_health',
    psy('leticia'),
    'in_person',
    8,
    'in_progress',
    meetings(3, -21, 8, 3, '16:00'),
    { roomId: ROOM.ipe },
  );
  activity(
    4,
    'open_conversation_circle',
    'Roda de conversa: cuidar de quem cuida',
    'self_care',
    psy('beatriz'),
    'in_person',
    30,
    'open',
    meetings(4, 15, 1, 0, '15:00'),
    { partnerOrg: 'CRAS' },
  );
  activity(
    5,
    'training',
    'Comunicação com pessoas com demência',
    'dementia_communication',
    { type: 'guest', name: 'Dr. Augusto Pedrosa (convidado)' },
    'online',
    12,
    'finished',
    meetings(5, -60, 1, 1, '19:00'),
  );
  activity(
    6,
    'training',
    'Administração segura de medicamentos',
    'safe_medication',
    { type: 'provider', id: providerId(7), name: 'Enf. Priscila Gouveia' },
    'online',
    12,
    'cancelled',
    meetings(6, 20, 2, 0, '19:00'),
  );
  activity(
    7,
    'support_group',
    'Prevenção de conflitos familiares',
    'family_conflict_prevention',
    psy('beatriz'),
    'online',
    12,
    'draft',
    meetings(7, 30, 4, 0, '19:00'),
  );
  activity(
    8,
    'support_group',
    'Organização da rotina',
    'routine_organization',
    psy('tiago'),
    'online',
    12,
    'open',
    meetings(8, 6, 4, 0, '19:00'),
  );

  const enroll = (
    n: number,
    who: { caregiver: number } | { external: { name: string; email: string } },
    status: ActivityEnrollment['status'],
    extra: Partial<ActivityEnrollment> = {},
  ): void => {
    const act = c.activities.find((a) => a.id === activityId(n)) as Activity;
    const done = act.meetings.filter((m) => m.done);
    const attendance =
      status === 'attended'
        ? act.meetings.map((m) => ({ meetingId: m.id, present: true }))
        : status === 'absent'
          ? act.meetings.map((m) => ({ meetingId: m.id, present: false }))
          : done.map((m) => ({ meetingId: m.id, present: true }));
    c.activityEnrollments.push(
      ctx.entity<ActivityEnrollment>(ctx.nextId('enr'), ctx.dt(-30), {
        activityId: act.id,
        ...('caregiver' in who
          ? { caregiverId: caregiverId(who.caregiver) }
          : { external: who.external }),
        status,
        confidentialityAcceptedAt: ctx.dt(-30, '10:00'),
        attendance,
        ...extra,
      }),
    );
  };
  [1, 8, 9, 11, 17, 21, 22, 23].forEach((n) => enroll(1, { caregiver: n }, 'enrolled'));
  enroll(1, { caregiver: 24 }, 'waitlist', { waitlistPosition: 1 });
  enroll(1, { caregiver: 27 }, 'waitlist', { waitlistPosition: 2 });
  [1, 8, 9, 21, 22, 23, 27].forEach((n) => enroll(2, { caregiver: n }, 'enrolled'));
  [4, 5, 13, 14, 15].forEach((n) =>
    enroll(3, { caregiver: n }, 'enrolled', { eligibleForGroupTherapy: true }),
  );
  [3, 4, 5, 10, 15, 19, 25].forEach((n) => enroll(4, { caregiver: n }, 'enrolled'));
  ['Ana Cláudia Ramos', 'Bento Siqueira', 'Cida Nogueira', 'Dario Esteves'].forEach((name, k) =>
    enroll(
      4,
      { external: { name, email: `participante.externo${k + 1}@exemplo.com.br` } },
      'enrolled',
    ),
  );
  [1, 8, 9, 11, 21, 22, 23, 24, 27].forEach((n) => enroll(5, { caregiver: n }, 'attended'));
  [17, 26].forEach((n) => enroll(5, { caregiver: n }, 'absent'));
  [8, 9, 21].forEach((n) => enroll(6, { caregiver: n }, 'cancelled'));
  [8, 9, 11, 23].forEach((n) => enroll(8, { caregiver: n }, 'enrolled'));
}

interface PopDef {
  code: Pop['code'];
  title: string;
  responsibleRole: Pop['responsibleRole'];
  responsible: string;
  objective: string;
  materials: string;
  steps: readonly string[];
  requiredRecord: string;
  indicators: string;
  reviewedDaysAgo: number;
}

const POPS: readonly PopDef[] = [
  {
    code: 'POP-01',
    title: 'Cadastro e acolhimento do usuário',
    responsibleRole: 'management',
    responsible: 'Gestão do negócio e da plataforma',
    reviewedDaysAgo: 200,
    objective:
      'Receber o cuidador com cuidado, registrar o cadastro dele e da pessoa idosa e deixar claros os termos e os canais da Nexus.',
    materials: 'Termos de uso, aviso de canais, termos de consentimento, formulário de cadastro.',
    steps: [
      'Acolher o cuidador e explicar o que a Nexus oferece e o que não oferece.',
      'Registrar o aceite dos termos de uso e o aviso de canais.',
      'Registrar os consentimentos, um a um.',
      'Cadastrar o cuidador e a pessoa idosa.',
      'Marcar a primeira aplicação da Escala de Zarit.',
    ],
    requiredRecord: 'Aceites, consentimentos, cadastro e primeira Zarit marcada.',
    indicators: 'Cadastros concluídos; consentimentos pendentes.',
  },
  {
    code: 'POP-02',
    title: 'Credenciamento, avaliação e descredenciamento de prestadores',
    responsibleRole: 'management',
    responsible: 'Gestão do negócio e da plataforma',
    reviewedDaysAgo: 400,
    objective:
      'Manter uma rede confiável: credenciar por critérios, avaliar de forma contínua e encerrar o vínculo com procedimento formal.',
    materials: 'Checklist de credenciamento, contrato, termo de proteção de dados, ficha da ARP.',
    steps: [
      'Conferir os cinco critérios de credenciamento e a validade dos documentos.',
      'Concluir a integração e registrar a ciência dos POPs.',
      'Coletar as avaliações e rodar a auditoria a cada 15 dias.',
      'Classificar em excelência, alerta ou descredenciamento.',
      'Na faixa de descredenciamento, suspender da busca e abrir a avaliação interna.',
      'Registrar a decisão e enviar o e-mail de encerramento.',
    ],
    requiredRecord:
      'Checklist, documentos, instantâneos da auditoria, avaliação interna e e-mail de encerramento.',
    indicators: 'Prestadores por faixa; taxa de recusa; credenciamentos em andamento.',
  },
  {
    code: 'POP-03',
    title: 'Cadastro e acompanhamento de parceiros do Cartão Nexus',
    responsibleRole: 'management',
    responsible: 'Gestão do negócio e da plataforma',
    reviewedDaysAgo: 150,
    objective: 'Cadastrar parceiros do Cartão Nexus e acompanhar o desconto concedido às famílias.',
    materials:
      'Ficha do parceiro, registro de validação jurídica e ética, registro de uso do cartão.',
    steps: [
      'Cadastrar o parceiro e o desconto.',
      'Se houver remuneração, registrar a validação jurídica e a ética antes de ativar.',
      'Ativar o parceiro e informar as famílias.',
      'Acompanhar os usos e a economia gerada.',
    ],
    requiredRecord: 'Ficha do parceiro e validações.',
    indicators: 'Parceiros ativos; economia concedida.',
  },
  {
    code: 'POP-04',
    title: 'Organização de grupos e capacitações',
    responsibleRole: 'management_and_technical_lead',
    responsible: 'Gestão e responsável técnico',
    reviewedDaysAgo: 90,
    objective:
      'Programar grupos e capacitações todo mês, com enquadramento correto entre orientação e psicoterapia.',
    materials: 'Programação mensal, contrato de sigilo, lista de presença.',
    steps: [
      'A gestão monta turmas, locais e comunicação.',
      'O responsável técnico valida o conteúdo e o enquadramento.',
      'Divulgar sem prometer resultado e com o registro profissional.',
      'Registrar inscrições, presença e o aceite do sigilo.',
    ],
    requiredRecord: 'Programação, inscrições, presença e aceite do sigilo.',
    indicators: 'Inscritos, presentes, taxa de presença e preenchimento de vagas.',
  },
  {
    code: 'POP-05',
    title: 'Situações de risco e encaminhamento de urgência',
    responsibleRole: 'technical_lead',
    responsible: 'Responsável técnico',
    reviewedDaysAgo: 120,
    objective:
      'Agir no mesmo dia diante de alerta vermelho, ARBE crítico ou relato de risco, com avaliação do psicólogo e encaminhamento quando necessário.',
    materials: 'Registro da ocorrência, lista de serviços de urgência, CVV (188) e SAMU (192).',
    steps: [...POP05_STEPS],
    requiredRecord:
      'Horário de cada passo, responsável, resultado da avaliação de risco, destino do encaminhamento e retorno.',
    indicators: 'Contato no mesmo dia.',
  },
  {
    code: 'POP-06',
    title: 'Proteção de dados e resposta a incidentes',
    responsibleRole: 'management',
    responsible: 'Gestão do negócio e da plataforma',
    reviewedDaysAgo: 380,
    objective:
      'Proteger os dados e agir rápido quando houver incidente, comunicando a ANPD e os titulares nos prazos legais.',
    materials: 'Registro de incidentes, política de privacidade, relatório de impacto.',
    steps: [
      'Conter o incidente e registrar data, descrição e dados afetados.',
      'Avaliar o risco aos titulares.',
      'Comunicar a ANPD e os titulares afetados em até 3 dias úteis.',
      'Registrar as medidas e revisar o procedimento.',
    ],
    requiredRecord: 'Incidente, comunicações e medidas.',
    indicators: 'Incidentes por mês; prazo de comunicação.',
  },
  {
    code: 'POP-07',
    title: 'Suspeita de violência contra a pessoa idosa',
    responsibleRole: 'technical_lead',
    responsible: 'Responsável técnico',
    reviewedDaysAgo: 100,
    objective:
      'Registrar sinais de alerta e comunicar os órgãos competentes, protegendo a pessoa idosa sem abandonar quem cuida.',
    materials:
      'Registro de ocorrência restrito, lista de órgãos, modelo de notificação compulsória.',
    steps: [...POP07_STEPS],
    requiredRecord: 'Sinais observados, comunicação aos órgãos e protocolo da notificação.',
    indicators: 'Ocorrências por categoria.',
  },
  {
    code: 'POP-08',
    title: 'Atendimento a reclamações',
    responsibleRole: 'management',
    responsible: 'Gestão do negócio e da plataforma',
    reviewedDaysAgo: 30,
    objective:
      'Responder as reclamações dentro do prazo e usar o que aprendemos para melhorar o serviço.',
    materials: 'Canal de reclamações, modelos de resposta, registro da reclamação.',
    steps: [
      'Registrar a reclamação e o canal.',
      'Responder em até 5 dias úteis.',
      'Classificar como grave quando for falta sem justificativa, quebra de sigilo ou equivalente.',
      'Encaminhar ao POP-07 se houver suspeita de violência ou negligência.',
      'Revisar na reunião mensal.',
    ],
    requiredRecord: 'Reclamação, linha do tempo e resposta.',
    indicators: 'Reclamações recebidas, abertas, resolvidas e tempo até a primeira resposta.',
  },
  {
    code: 'POP-09',
    title: 'Revisão de conteúdos de orientação',
    responsibleRole: 'technical_lead',
    responsible: 'Responsável técnico',
    reviewedDaysAgo: 60,
    objective:
      'Garantir que os conteúdos de orientação sejam revisados e aprovados antes de publicar.',
    materials: 'Rascunho do conteúdo, lista de verificação do tom de voz.',
    steps: [
      'Receber o rascunho.',
      'Revisar o conteúdo e o tom: sem promessa de resultado e sem jargão.',
      'Aprovar com a data da revisão.',
      'Publicar.',
    ],
    requiredRecord: 'Conteúdo, data e aprovação.',
    indicators: 'Conteúdos aguardando revisão.',
  },
  {
    code: 'POP-10',
    title: 'Encerramento do cadastro e exclusão de dados',
    responsibleRole: 'management',
    responsible: 'Gestão do negócio e da plataforma',
    reviewedDaysAgo: 250,
    objective: 'Encerrar cadastros e eliminar dados respeitando a retenção do registro documental.',
    materials: 'Solicitação do titular, política de retenção, log.',
    steps: [
      'Registrar o pedido e o motivo.',
      'Mostrar ao titular o que será eliminado e o que ficará bloqueado.',
      'Eliminar o que pode ser eliminado.',
      'Bloquear o registro documental até o fim do prazo.',
      'Registrar tudo no log.',
    ],
    requiredRecord: 'Solicitação, ações executadas e log.',
    indicators: 'Solicitações no prazo.',
  },
];

const RISKS: readonly [
  `R${number}`,
  string,
  string,
  1 | 2 | 3 | 4 | 5,
  1 | 2 | 3 | 4 | 5,
  string,
  string[],
][] = [
  [
    'R1',
    'Conversão do plano gratuito abaixo do esperado',
    'Financeiro',
    4,
    5,
    'Medição no piloto antes da expansão; revisão dos benefícios dos planos',
    ['Conversão realizada (K03)', 'Parâmetros e projeção financeira (M10)'],
  ],
  [
    'R2',
    'Baixa adesão por resistência à busca de ajuda',
    'Mercado',
    4,
    4,
    'Comunicação de orientação; indicação de profissionais; rodas de conversa abertas',
    ['Rodas de conversa abertas (M07)', 'Conteúdos de orientação (M13)'],
  ],
  [
    'R3',
    'Falta de padronização entre prestadores',
    'Qualidade',
    4,
    4,
    'Critérios de credenciamento; integração; avaliação pelos usuários',
    ['Checklist de credenciamento (M08)', 'ARP e auditoria quinzenal (M08)'],
  ],
  [
    'R4',
    'Identificação de violência contra a pessoa idosa',
    'Ético-legal',
    3,
    5,
    'POP-07; notificação compulsória; rede protetiva',
    ['Ocorrências POP-07 (M13)', 'Registro de encaminhamentos (M13)'],
  ],
  [
    'R5',
    'Agravamento do quadro psíquico do cuidador',
    'Clínico',
    3,
    5,
    'POP-05; encaminhamento à rede de saúde mental',
    ['Alertas da Zarit e ARBE (M06)', 'Ocorrências POP-05 (M13)'],
  ],
  [
    'R6',
    'Conduta inadequada de profissional da rede',
    'Jurídico-reputacional',
    3,
    4,
    'Verificação de registro; contrato; descredenciamento',
    ['Checklist de credenciamento (M08)', 'ARP e avaliação interna (M08)'],
  ],
  [
    'R7',
    'Baixa familiaridade digital do público',
    'Operacional-social',
    4,
    3,
    'WhatsApp e telefone como canais alternativos',
    ['Caixa de mensagens com quatro canais (M11)', 'Registro em nome do usuário (M11)'],
  ],
  [
    'R8',
    'Custo do aplicativo acima do previsto',
    'Financeiro',
    3,
    4,
    'Versão mínima; contratação por etapas',
    ['Custos e investimento (M10)'],
  ],
  [
    'R9',
    'Remuneração indevida por encaminhamento',
    'Ético-legal',
    2,
    5,
    'Vedação de porcentagem sobre serviços psicológicos; validação jurídica das parcerias',
    [
      'Validação jurídica e ética de parceiros (M09)',
      'Cadastro da rede sem qualquer valor por encaminhamento (M08)',
    ],
  ],
  [
    'R10',
    'Vazamento ou perda de dados sensíveis',
    'Tecnológico-jurídico',
    2,
    5,
    'Criptografia; controle de acesso; plano de resposta a incidentes',
    [
      'Log de acesso (M12)',
      'Consentimentos (M12)',
      'Pseudonimização e mascaramento (M03)',
      'Incidentes (M12)',
    ],
  ],
  [
    'R11',
    'Poucos parceiros no Cartão Nexus',
    'Comercial',
    3,
    3,
    'Prospecção na fase 1; benefícios simples para o parceiro',
    ['Funil de parceiros (M09)'],
  ],
  [
    'R12',
    'Divergência entre sócios',
    'Societário',
    2,
    4,
    'Acordo de sócios com regras de saída',
    ['Registro de decisões da gestão (M13)'],
  ],
];

export function buildGovernance(s: SeedState): void {
  const { ctx, c } = s;

  // ===== POPs (10) =====
  POPS.forEach((def) => {
    const lastReviewedAt = ctx.d(-def.reviewedDaysAgo);
    const triggered = def.code === 'POP-08';
    c.pops.push(
      ctx.entity<Pop>(ctx.nextId('pop'), ctx.at(lastReviewedAt), {
        code: def.code,
        title: def.title,
        responsibleRole: def.responsibleRole,
        objective: def.objective,
        responsible: def.responsible,
        materials: def.materials,
        steps: [...def.steps],
        requiredRecord: def.requiredRecord,
        indicators: def.indicators,
        lastReviewedAt,
        reviewState: popReviewState(lastReviewedAt, ctx.today, triggered),
      }),
    );
    c.popReviews.push(
      ctx.entity<PopReview>(ctx.nextId('prev'), ctx.at(lastReviewedAt), {
        popCode: def.code,
        reviewedAt: lastReviewedAt,
        reviewedByUserId:
          def.responsibleRole === 'technical_lead' ? USER.technicalLead : USER.partner,
        note: triggered
          ? 'Revisão acionada por incidente de resposta atrasada.'
          : 'Revisão periódica concluída.',
      }),
    );
  });

  // ===== Riscos (12) =====
  RISKS.forEach(([code, title, category, probability, impact, treatment, controls]) => {
    c.risks.push(
      ctx.entity<RiskItem>(ctx.nextId('risk'), ctx.dt(-300), {
        code,
        title,
        category,
        probability,
        impact,
        treatment,
        controls,
      }),
    );
  });

  // ===== Formação (6 eventos) e ciência dos POPs =====
  const training = (
    front: TrainingEvent['front'],
    title: string,
    daysFromToday: number,
    attendees: TrainingEvent['attendees'],
  ): void => {
    c.trainingEvents.push(
      ctx.entity<TrainingEvent>(ctx.nextId('trn'), ctx.dt(Math.min(daysFromToday, 0) - 5), {
        front,
        title,
        date: ctx.d(daysFromToday),
        attendees,
      }),
    );
  };
  const prov = (n: number, present: boolean): TrainingEvent['attendees'][number] => ({
    personType: 'provider',
    personId: providerId(n),
    present,
  });
  const usr = (id: ID): TrainingEvent['attendees'][number] => ({
    personType: 'user',
    personId: id,
    present: true,
  });
  training(
    'provider_integration',
    'Integração de credenciados: modelo Nexus, sigilo e proteção de dados',
    -23,
    [prov(20, true), prov(13, true), prov(15, true), prov(12, true)],
  );
  training('provider_integration', 'Integração de credenciados (próxima turma)', 7, [
    prov(17, false),
    prov(16, false),
  ]);
  training(
    'group_professionals',
    'Formação dos profissionais de grupos: sobrecarga, luto ambíguo e linguagem acessível',
    -60,
    [usr(USER.rafael), usr(USER.beatriz), usr(USER.leticia)],
  );
  training(
    'management',
    'Formação da gestão: plataforma, atendimento, encaminhamentos e situações de risco',
    -90,
    [usr(USER.partner), usr(USER.technicalLead), usr(USER.camila), usr(USER.wesley)],
  );
  training('continuing', 'Formação continuada: estudo de casos com a rede', -45, [
    prov(1, true),
    prov(2, true),
    prov(5, true),
    prov(7, true),
    prov(11, true),
  ]);
  training('continuing', 'Formação continuada: atualização técnica', -135, [
    prov(1, true),
    prov(3, true),
    prov(7, true),
    prov(11, true),
    prov(12, false),
  ]);
  c.providers
    .filter((p) => p.popsAcknowledgedAt)
    .forEach((p) => {
      ['POP-02', 'POP-06', 'POP-07', 'POP-08'].forEach((popCode) => {
        c.popAcknowledgements.push(
          ctx.entity<PopAcknowledgement>(
            ctx.nextId('pack'),
            ctx.at(p.popsAcknowledgedAt as string),
            {
              popCode,
              personType: 'provider',
              personId: p.id,
              at: p.popsAcknowledgedAt as string,
            },
          ),
        );
      });
    });

  // ===== Conteúdos de orientação (8: 5 publicados, 2 em revisão, 1 rascunho; 1 exclusivo) =====
  const content = (
    title: string,
    body: string,
    status: GuidanceContent['status'],
    exclusive = false,
  ): void => {
    c.guidanceContents.push(
      ctx.entity<GuidanceContent>(ctx.nextId('gdc'), ctx.dt(-70), {
        title,
        body,
        status,
        exclusive,
        ...(status === 'published'
          ? { approvedByUserId: USER.technicalLead, approvedAt: ctx.d(-60) }
          : {}),
      }),
    );
  };
  content(
    'Como organizar os medicamentos da semana',
    'Separe os remédios por dia e horário em uma caixa organizadora. Anote mudanças de dose junto da data e confirme com o profissional que prescreveu.',
    'published',
  );
  content(
    'Pausas curtas para quem cuida',
    'Reserve momentos de descanso ao longo do dia, mesmo que de poucos minutos. Peça ajuda a alguém da família para cobrir uma tarefa por semana.',
    'published',
  );
  content(
    'Conversar com a pessoa idosa sobre as decisões do dia a dia',
    'Explique o que vai fazer antes de fazer e ouça a preferência dela. Organizar o cuidado não significa decidir por quem é cuidado.',
    'published',
  );
  content(
    'Prevenção de quedas em casa',
    'Mantenha os caminhos livres, use tapetes antiderrapantes e boa iluminação. Revise o calçado e o apoio no banheiro.',
    'published',
  );
  content(
    'Planilha de rotina semanal ampliada',
    'Modelo com horários de medicamentos, consultas, refeições e revezamento da família, disponível para assinantes.',
    'published',
    true,
  );
  content(
    'Rotina de sono e descanso de quem cuida',
    'Orientações gerais sobre horários regulares e ambiente tranquilo para dormir. Em caso de insônia persistente, procure um profissional de saúde.',
    'in_review',
  );
  content(
    'Direitos da pessoa idosa: o que saber',
    'Resumo em linguagem simples sobre benefícios, atendimento prioritário e canais de denúncia, como o Disque 100.',
    'in_review',
  );
  content(
    'Alimentação e prevenção de engasgo',
    'Cuidados básicos na hora da refeição: postura, ritmo e alimentos mais seguros.',
    'draft',
  );

  // ===== Normas citadas (6), sem "vigência confirmada em" =====
  const norms: [string, string][] = [
    [
      'Código de Ética Profissional do Psicólogo (CFP, 2005)',
      'Conduta profissional, sigilo, divulgação e vedação de remuneração por encaminhamento',
    ],
    [
      'Resolução CFP nº 1/2009',
      'Registro documental decorrente da prestação de serviços psicológicos',
    ],
    ['Resolução CFP nº 6/2019', 'Elaboração de documentos escritos pela(o) psicóloga(o)'],
    ['Resolução CFP nº 13/2022', 'Psicoterapia e atividades de orientação e psicoeducação'],
    [
      'Resolução CFP nº 9/2024',
      'Serviços psicológicos prestados por meios de tecnologia da informação e comunicação',
    ],
    ['Lei nº 13.709/2018 (LGPD)', 'Proteção de dados pessoais'],
  ];
  norms.forEach(([name, subject]) =>
    c.norms.push(ctx.entity<NormReference>(ctx.nextId('norm'), ctx.dt(-300), { name, subject })),
  );
}

export function buildPilot(s: SeedState): void {
  const { ctx, c } = s;
  const ids: ID[] = [...SCENARIO_PILOT_NUMBERS.map((n) => caregiverId(n)), ...s.volumePilotIds];
  const dates: string[] = [];
  ids.forEach((id) => {
    const cg = c.caregivers.find((x) => x.id === id);
    const points = s.zaritPoints.get(id) ?? [];
    const enrolledAt = s.enrollmentDate.get(id) as string;
    dates.push(enrolledAt);
    const due = (months: number): string => addMonths(enrolledAt, months);
    const status = (index: number, dueDate: string): 'done' | 'pending' | 'missed' =>
      points.length > index ? 'done' : dueDate < ctx.today ? 'missed' : 'pending';
    const done3 = points.length > 1;
    const n = Number(id.slice(3));
    c.pilotEnrollments.push(
      ctx.entity<PilotEnrollment>(ctx.nextId('pil'), ctx.at(enrolledAt), {
        caregiverId: id,
        enrolledAt,
        tcleConsentEventId: s.consentEventIds.get(`${id}:pilot_tcle`) as string,
        windows: [
          { name: 'enrollment', dueDate: enrolledAt, status: 'done' },
          { name: 'month3', dueDate: due(3), status: status(1, due(3)) },
          { name: 'month6', dueDate: due(6), status: status(2, due(6)) },
        ],
        ...(cg?.weeklyOrganizationHours !== undefined
          ? { weeklyHoursStart: cg.weeklyOrganizationHours }
          : {}),
        ...(n === 12
          ? {
              weeklyHoursEnd: Math.max(1, (cg?.weeklyOrganizationHours ?? 10) - 4),
              satisfaction: 5 as const,
              wouldRecommend: true,
              chosenPlan: 'essencial' as const,
              chosenReason: 'Cartão Nexus e condições especiais na rede',
            }
          : {}),
        ...(done3 && n !== 12 && cg?.weeklyOrganizationHours !== undefined
          ? {
              weeklyHoursEnd: Math.max(1, cg.weeklyOrganizationHours - 2),
              satisfaction: (n % 2 === 0 ? 4 : 5) as 4 | 5,
              wouldRecommend: true,
            }
          : {}),
      }),
    );
  });
  const earliest = [...dates].sort()[0] as string;
  s.singletons.pilotConfig = {
    ...s.singletons.pilotConfig,
    startedAt: earliest,
    goalsLocked: true,
    goalChangeLog: [],
  };
}
