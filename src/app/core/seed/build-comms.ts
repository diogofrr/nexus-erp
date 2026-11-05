/**
 * Mensagens (28: app 9, WhatsApp 8, telefone 4, e-mail 7; 5 atrasadas), reclamações (5) e modelos de
 * resposta (6) (5.12). Para o resultado não depender da hora do dia, toda mensagem que não é uma das 5
 * atrasadas está respondida ou ainda muito longe do prazo.
 */
import { ISODate, ISODateTime, Channel, Complaint, Message, MessageTemplate } from '../models';
import { addDays } from '../clock/date-utils';
import { addBusinessHours, complaintDueAt, isBusinessDay, messageDueAt } from '../rules/sla';
import { OCCURRENCE, USER, caregiverId, complaintId, providerId } from './refs';
import { SeedState } from './state';

interface MsgSpec {
  channel: Channel;
  caregiver?: number;
  provider?: number;
  /** Data de recebimento. */
  date: ISODate;
  time: string;
  body: string;
  subject?: string;
  support?: boolean;
  risk?: boolean;
  /** `answered` (padrão) ou o estado de uma mensagem ainda sem resposta. */
  state?: 'answered' | 'new' | 'in_progress';
}

export function buildComms(s: SeedState): void {
  const { ctx, c } = s;
  /** `D+n` ajustado para o dia útil anterior (mensagens chegam em dia útil). */
  const d = (n: number): ISODate => {
    let date = ctx.d(n);
    while (!isBusinessDay(date)) {
      date = addDays(date, -1);
    }
    return date;
  };
  const bd = (n: number): ISODate => ctx.prevBusinessDay(n);

  const specs: MsgSpec[] = [
    // ===== Aplicativo (9) =====
    {
      channel: 'app',
      caregiver: 2,
      date: bd(3),
      time: '10:00',
      support: true,
      state: 'new',
      body: 'Estou muito cansada e não sei por onde começar a organizar a semana. Podem me ajudar?',
    },
    {
      channel: 'app',
      caregiver: 20,
      date: bd(4),
      time: '15:00',
      state: 'new',
      body: 'Preciso corrigir meu sobrenome no cadastro, ficou com uma letra errada.',
    },
    {
      channel: 'app',
      caregiver: 1,
      date: d(-5),
      time: '14:00',
      support: true,
      body: 'Estou há várias noites sem dormir direito e a rotina está pesada. Tem alguém para conversar?',
    },
    {
      channel: 'app',
      caregiver: 1,
      date: d(-12),
      time: '11:00',
      support: true,
      body: 'Gostaria de ajuda para dividir as tarefas do cuidado com a minha família.',
    },
    {
      channel: 'app',
      caregiver: 29,
      date: d(-6),
      time: '15:30',
      support: true,
      body: 'Tenho dificuldade para conciliar o trabalho e o cuidado. Pode me orientar?',
    },
    {
      channel: 'app',
      caregiver: 29,
      date: d(-14),
      time: '10:15',
      support: true,
      body: 'Não estou conseguindo manter os horários dos remédios organizados.',
    },
    {
      channel: 'app',
      caregiver: 24,
      date: d(-3),
      time: '16:00',
      body: 'Como faço para mudar o horário do meu encontro no grupo?',
    },
    {
      channel: 'app',
      caregiver: 27,
      date: d(-8),
      time: '09:00',
      body: 'Quais farmácias parceiras aceitam o Cartão Nexus aqui no bairro?',
    },
    {
      channel: 'app',
      caregiver: 12,
      date: bd(1),
      time: '15:00',
      state: 'in_progress',
      body: 'Queria entender como funciona a troca de plano no próximo ciclo.',
    },
    {
      channel: 'email',
      provider: 11,
      date: d(-7),
      time: '13:00',
      subject: 'Atualização de documentos',
      body: 'Segue em anexo o comprovante atualizado do registro profissional.',
    },
    // ===== WhatsApp (8) =====
    {
      channel: 'whatsapp',
      caregiver: 1,
      date: bd(1),
      time: '08:00',
      support: true,
      risk: true,
      state: 'new',
      body: 'Não aguento mais. Estou no limite e sem saber o que fazer hoje.',
    },
    {
      channel: 'whatsapp',
      caregiver: 1,
      date: d(-10),
      time: '09:45',
      support: true,
      body: 'Preciso conversar com alguém da equipe sobre o meu cansaço.',
    },
    {
      channel: 'whatsapp',
      caregiver: 28,
      date: bd(1),
      time: '14:00',
      state: 'new',
      body: 'Posso remarcar a conversa de acompanhamento para a próxima semana?',
    },
    {
      channel: 'whatsapp',
      caregiver: 29,
      date: d(-4),
      time: '11:30',
      support: true,
      body: 'Hoje foi um dia difícil. Posso falar com a psicóloga?',
    },
    {
      channel: 'whatsapp',
      caregiver: 2,
      date: d(-7),
      time: '16:20',
      support: true,
      body: 'Minha mãe piorou esta semana e eu estou sem ajuda em casa.',
    },
    {
      channel: 'whatsapp',
      caregiver: 6,
      date: d(-9),
      time: '10:10',
      body: 'Recebi o aviso da avaliação do atendimento, obrigada!',
    },
    {
      channel: 'whatsapp',
      caregiver: 27,
      date: d(-20),
      time: '15:40',
      body: 'Vocês têm outra opção de nutricionista na rede?',
    },
    {
      channel: 'whatsapp',
      caregiver: 21,
      date: d(-1),
      time: '12:30',
      body: 'Meu cartão já está ativo? Quero usar na farmácia hoje.',
    },
    // ===== Telefone (4) =====
    {
      channel: 'phone',
      caregiver: 3,
      date: d(-6),
      time: '10:30',
      support: true,
      body: 'Ligação do titular: pediu ajuda para entender o aplicativo e relatou cansaço.',
    },
    {
      channel: 'phone',
      caregiver: 3,
      date: d(-18),
      time: '14:30',
      support: true,
      body: 'Ligação do titular: pediu orientação sobre rotina de medicamentos.',
    },
    {
      channel: 'phone',
      caregiver: 2,
      date: d(-3),
      time: '11:00',
      support: true,
      body: 'Ligação do titular: relatou sobrecarga e pediu retorno da psicóloga.',
    },
    {
      channel: 'phone',
      caregiver: 11,
      date: d(-2),
      time: '16:30',
      body: 'Ligação do titular: agradeceu o contato e confirmou o encaminhamento.',
    },
    // ===== E-mail (7) =====
    {
      channel: 'email',
      provider: 17,
      date: bd(6),
      time: '09:00',
      state: 'new',
      subject: 'Integração pendente',
      body: 'Os documentos foram enviados. Aguardamos o retorno sobre a data da integração.',
    },
    {
      channel: 'email',
      provider: 16,
      date: d(-12),
      time: '15:00',
      subject: 'Registro vencido',
      body: 'Recebemos o aviso do registro vencido e vamos regularizar o quanto antes.',
    },
    {
      channel: 'email',
      provider: 11,
      date: d(-9),
      time: '10:00',
      subject: 'Dúvida sobre solicitações',
      body: 'Posso ver o endereço do usuário antes de aceitar a solicitação?',
    },
    {
      channel: 'email',
      caregiver: 18,
      date: d(-10),
      time: '14:00',
      subject: 'Solicitação de exclusão',
      body: 'Gostaria de pedir a exclusão dos meus dados do sistema.',
    },
    {
      channel: 'email',
      caregiver: 19,
      date: d(-30),
      time: '09:20',
      subject: 'Cópia dos meus dados',
      body: 'Peço uma cópia dos meus dados em formato que eu possa guardar.',
    },
    {
      channel: 'email',
      caregiver: 20,
      date: bd(1),
      time: '17:00',
      state: 'in_progress',
      subject: 'Correção de cadastro',
      body: 'Peço a correção de um dado do meu cadastro e envio o documento em anexo.',
    },
  ];

  const staff = [USER.camila, USER.wesley];
  specs.forEach((spec, k) => {
    const receivedAt: ISODateTime = ctx.at(spec.date, spec.time);
    const dueAt = messageDueAt(spec.channel, receivedAt);
    const state = spec.state ?? 'answered';
    const answered = state === 'answered';
    const firstResponseAt =
      spec.channel === 'phone'
        ? receivedAt
        : addBusinessHours(
            receivedAt,
            spec.channel === 'whatsapp' ? 1 : spec.channel === 'app' ? 2 : 4,
          );
    c.messages.push(
      ctx.entity<Message>(ctx.nextId('msg'), receivedAt, {
        channel: spec.channel,
        direction: 'in',
        ...(spec.caregiver ? { caregiverId: caregiverId(spec.caregiver) } : {}),
        ...(spec.provider ? { providerId: providerId(spec.provider) } : {}),
        ...(spec.subject ? { subject: spec.subject } : {}),
        body: spec.body,
        receivedAt,
        dueAt,
        ...(answered ? { firstResponseAt } : {}),
        status: state,
        ...(answered || state === 'in_progress'
          ? { assignedToUserId: staff[k % 2] as string }
          : {}),
        isSupportRequest: spec.support === true,
        ...(spec.risk ? { riskFlag: true } : {}),
      }),
    );
  });

  // ===== Reclamações (5) =====
  const complaint = (
    n: number,
    fields: Omit<Complaint, 'id' | 'createdAt' | 'updatedAt' | 'protocol' | 'dueAt'>,
    openedAt: ISODateTime,
  ): void => {
    c.complaints.push(
      ctx.entity<Complaint>(complaintId(n), openedAt, {
        protocol: `REC-${String(n).padStart(4, '0')}`,
        dueAt: complaintDueAt(openedAt),
        ...fields,
      }),
    );
  };
  complaint(
    1,
    {
      channel: 'phone',
      caregiverId: caregiverId(27),
      target: { type: 'provider', providerId: providerId(14) },
      description:
        'A titular relata que informações da família foram comentadas com terceiros pela profissional durante o atendimento.',
      severity: 'grave',
      graveCategory: 'confidentiality_breach',
      suspectedElderAbuse: false,
      status: 'in_progress',
      openedAt: ctx.dt(-6, '10:00'),
      events: [
        {
          at: ctx.dt(-6, '10:30'),
          byUserId: USER.camila,
          text: 'Reclamação registrada por telefone e classificada como grave (quebra de sigilo).',
        },
        {
          at: ctx.dt(-5, '09:00'),
          byUserId: USER.partner,
          text: 'Prestadora suspensa da busca e avaliação interna aberta.',
        },
      ],
    },
    ctx.dt(-6, '10:00'),
  );
  complaint(
    2,
    {
      channel: 'whatsapp',
      caregiverId: caregiverId(14),
      target: { type: 'provider', providerId: providerId(4) },
      description: 'O profissional faltou ao atendimento combinado sem avisar a família.',
      severity: 'grave',
      graveCategory: 'unjustified_absence',
      suspectedElderAbuse: false,
      status: 'open',
      openedAt: ctx.at(bd(2), '15:00'),
      events: [],
    },
    ctx.at(bd(2), '15:00'),
  );
  complaint(
    3,
    {
      channel: 'app',
      caregiverId: caregiverId(5),
      target: { type: 'platform' },
      description: 'O aplicativo não mostrou o lembrete do compromisso da semana.',
      severity: 'normal',
      suspectedElderAbuse: false,
      status: 'closed',
      openedAt: ctx.dt(-40, '09:00'),
      events: [
        {
          at: ctx.dt(-39, '10:00'),
          byUserId: USER.wesley,
          text: 'Resposta enviada explicando o ajuste feito nos lembretes.',
        },
        {
          at: ctx.dt(-38, '09:30'),
          byUserId: USER.wesley,
          text: 'Titular confirmou que o problema foi resolvido. Reclamação encerrada.',
        },
      ],
    },
    ctx.dt(-40, '09:00'),
  );
  complaint(
    4,
    {
      channel: 'phone',
      caregiverId: caregiverId(28),
      target: { type: 'other' },
      description:
        'Relato de preocupação com os cuidados prestados à pessoa idosa na residência (acesso restrito ao responsável técnico).',
      severity: 'normal',
      suspectedElderAbuse: true,
      status: 'in_progress',
      openedAt: ctx.dt(-5, '11:00'),
      occurrenceId: OCCURRENCE.o3,
      events: [
        {
          at: ctx.dt(-5, '11:20'),
          byUserId: USER.camila,
          text: 'Encaminhada ao responsável técnico (POP-07).',
        },
      ],
    },
    ctx.dt(-5, '11:00'),
  );
  complaint(
    5,
    {
      channel: 'email',
      caregiverId: caregiverId(15),
      target: { type: 'service' },
      description: 'Pedi informações sobre o plano e ainda não recebi resposta completa.',
      severity: 'normal',
      suspectedElderAbuse: false,
      status: 'open',
      openedAt: ctx.at(bd(8), '10:00'),
      events: [],
    },
    ctx.at(bd(8), '10:00'),
  );

  // ===== Modelos de resposta (6) =====
  const templates: [string, string][] = [
    [
      'Confirmação de recebimento',
      'Olá! Recebemos a sua mensagem e vamos responder dentro do prazo combinado. Obrigada por falar com a Nexus.',
    ],
    [
      'Pedido de apoio recebido',
      'Entendemos que o momento está puxado. Vamos pedir que um psicólogo da equipe entre em contato com você. Se precisar conversar agora, o CVV atende pelo 188. Em emergência, ligue para o SAMU (192).',
    ],
    [
      'Dúvida sobre planos',
      'A mensalidade não inclui serviços da rede nem atendimento psicológico. Posso explicar o que cada plano oferece?',
    ],
    [
      'Reclamação em análise',
      'Recebemos a sua reclamação e ela já está em análise. Você recebe uma resposta em até 5 dias úteis.',
    ],
    [
      'Opções na rede credenciada',
      'Encontramos mais de uma opção para o serviço que você procura. A escolha é sempre da sua família e o pagamento é feito direto ao profissional.',
    ],
    [
      'Encerramento do atendimento',
      'Ficamos à disposição. Se precisar, é só escrever pelo aplicativo, WhatsApp, telefone ou e-mail.',
    ],
  ];
  templates.forEach(([title, body]) => {
    c.messageTemplates.push(
      ctx.entity<MessageTemplate>(ctx.nextId('tpl'), ctx.dt(-300), { title, body }),
    );
  });
}
