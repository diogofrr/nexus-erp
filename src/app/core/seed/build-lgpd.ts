/**
 * LGPD (5.13): 6 termos (v1.0) e 3 documentos, consentimentos e histórico, 5 solicitações do titular,
 * 80 entradas de log nos últimos 30 dias (login 14, view 40, supervise 12, reveal 5, export 3, denied 6),
 * 1 incidente simulado e a política de retenção.
 */
import { dsrDueDate } from '../rules/lgpd';
import { CONSENT_KEYS } from '../rules/lgpd';
import {
  AccessAction,
  AccessLogEntry,
  Consent,
  ConsentEvent,
  ConsentKey,
  ConsentTerm,
  DataSubjectRequest,
  Incident,
  PrivacyDocument,
  RetentionPolicy,
  Role,
} from '../models';
import { DSR, OCCURRENCE, USER, ZARIT_ALERT, caregiverId } from './refs';
import { SeedState } from './state';

export const DPO_NAME = 'Marina Quintela';
export const DPO_EMAIL = 'privacidade@exemplo.com.br';

const TERMS: Record<ConsentKey, { title: string; text: string }> = {
  health_data: {
    title: 'Termo de consentimento para dados de saúde',
    text: 'Autorizo o tratamento dos meus dados de saúde (Escala de Zarit, horas de cuidado e registro de bem-estar) para o acompanhamento psicológico oferecido pela Nexus. Posso retirar este consentimento quando quiser.',
  },
  people_analytics: {
    title: 'Termo de consentimento para indicadores agregados',
    text: 'Autorizo que meus dados entrem, de forma agregada e sem identificação, nos indicadores da Nexus sobre cuidadores, rede e equipe.',
  },
  family_sharing: {
    title: 'Termo de compartilhamento de informações com familiares',
    text: 'Autorizo compartilhar, item a item, as informações organizadas da pessoa idosa com familiares que eu indicar.',
  },
  image_testimony: {
    title: 'Termo de autorização de uso de imagem e depoimento',
    text: 'Autorizo o uso da minha imagem e do meu depoimento em materiais de comunicação da Nexus. Esta autorização é separada do contrato de serviço e posso retirá-la quando quiser.',
  },
  whatsapp_contact: {
    title: 'Termo de contato por WhatsApp',
    text: 'Autorizo a Nexus a entrar em contato por WhatsApp para atendimento, avisos e avaliação dos serviços da rede.',
  },
  pilot_tcle: {
    title: 'Termo de Consentimento Livre e Esclarecido do piloto',
    text: 'Concordo em participar do piloto por seis meses, com instrumentos na adesão, aos 3 e aos 6 meses. A participação é voluntária e não altera o acesso ao plano gratuito.',
  },
};

export function buildLgpd(s: SeedState): void {
  const { ctx, c } = s;
  const rng = ctx.rng;
  const published = ctx.d(-365);

  // ===== Termos (6) e documentos (3) =====
  CONSENT_KEYS.forEach((key) => {
    c.consentTerms.push(
      ctx.entity<ConsentTerm>(ctx.nextId('cterm'), ctx.at(published), {
        key,
        version: '1.0',
        title: TERMS[key].title,
        text: TERMS[key].text,
        publishedAt: published,
        active: true,
      }),
    );
  });
  const doc = (kind: PrivacyDocument['kind'], body: string): void => {
    c.privacyDocuments.push(
      ctx.entity<PrivacyDocument>(ctx.nextId('pdc'), ctx.at(published), {
        kind,
        version: '1.0',
        body,
        dpoName: DPO_NAME,
        dpoEmail: DPO_EMAIL,
      }),
    );
  };
  doc(
    'privacy_policy',
    [
      'Esta política explica, em linguagem simples, como a Nexus trata os seus dados.',
      'O que coletamos: dados de cadastro, da pessoa idosa que você cuida, horas de cuidado, Escala de Zarit e mensagens com a equipe.',
      'Para que usamos: organizar a rotina de cuidados, acompanhar o seu bem-estar com psicólogos e qualificar a rede credenciada.',
      'Base legal: consentimento específico para dados de saúde e execução do contrato para dados de cadastro.',
      'Seus direitos: acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento, revogação do consentimento e revisão de decisões.',
      `Encarregada pelo tratamento de dados: ${DPO_NAME} (fictícia). Canal do titular: ${DPO_EMAIL}.`,
      'Protótipo de demonstração: todos os dados são fictícios e ficam apenas neste navegador.',
    ].join('\n\n'),
  );
  doc(
    'ripd',
    [
      'Relatório de impacto à proteção de dados pessoais (simulado).',
      'Dados tratados: cadastro, saúde (Zarit, ARBE, anotações), uso do aplicativo, avaliações da rede.',
      'Finalidades e bases: acompanhamento psicológico (consentimento e tutela da saúde); gestão da rede (legítimo interesse, com aviso).',
      'Risco principal (R10): vazamento ou perda de dados sensíveis. Medidas: controle de acesso por perfil, registro de acessos, pseudonimização na gestão, mascaramento em tela, plano de resposta a incidentes (POP-06).',
      'Riscos relacionados: acesso indevido por perfil sem necessidade (R10), compartilhamento com credenciado sem cláusula (RN-LGPD-13).',
    ].join('\n\n'),
  );
  doc(
    'service_contract',
    [
      'Contrato de prestação de serviços Nexus (simulado), separado do termo de consentimento e do termo de imagem.',
      'Objeto: acesso ao aplicativo e aos benefícios do plano contratado.',
      'A mensalidade não inclui serviços da rede nem atendimento psicológico.',
      'Canais da Nexus não substituem atendimento clínico. Em emergência, acione o SAMU (192).',
    ].join('\n\n'),
  );

  // ===== Consentimentos (6 por cuidador) e histórico append-only =====
  let registrar = 0;
  c.caregivers.forEach((cg) => {
    const plan = s.consentPlan.get(cg.id);
    if (!plan) {
      return;
    }
    CONSENT_KEYS.forEach((key) => {
      const status = plan[key];
      const at = ctx.at(cg.enrolledAt, '10:00');
      const byUserId = registrar % 2 === 0 ? USER.camila : USER.wesley;
      registrar += 1;
      const channel: ConsentEvent['channel'] =
        cg.preferredChannel === 'phone' ? 'in_person' : cg.preferredChannel;
      const pushEvent = (eventStatus: ConsentEvent['status'], eventAt: string): string => {
        const id = ctx.nextId('cev');
        c.consentEvents.push(
          ctx.entity<ConsentEvent>(id, eventAt, {
            caregiverId: cg.id,
            key,
            status: eventStatus,
            termVersion: '1.0',
            at: eventAt,
            channel,
            registeredByUserId: byUserId,
            evidence: `Registro ${id}`,
          }),
        );
        return id;
      };
      if (status === 'granted') {
        s.consentEventIds.set(`${cg.id}:${key}`, pushEvent('granted', at));
      } else if (status === 'refused') {
        pushEvent('refused', at);
      } else if (status === 'revoked') {
        pushEvent('granted', at);
        pushEvent('revoked', ctx.dt(-15, '11:00'));
      }
      c.consents.push(
        ctx.entity<Consent>(
          ctx.nextId('cns'),
          at,
          { caregiverId: cg.id, key, status, currentTermVersion: '1.0' },
          status === 'revoked' ? ctx.dt(-15, '11:00') : at,
        ),
      );
    });
  });

  // ===== Solicitações do titular (5) =====
  const request = (
    id: string,
    protocol: string,
    n: number,
    type: DataSubjectRequest['type'],
    openedDaysAgo: number,
    status: DataSubjectRequest['status'],
    extra: Partial<DataSubjectRequest> = {},
  ): void => {
    const openedAt = ctx.d(-openedDaysAgo);
    c.dataSubjectRequests.push(
      ctx.entity<DataSubjectRequest>(id, ctx.at(openedAt, '09:30'), {
        protocol,
        caregiverId: caregiverId(n),
        type,
        status,
        openedAt,
        dueAt: dsrDueDate(openedAt),
        ...extra,
      }),
    );
  };
  request(DSR.c18Erasure, 'DSR-0001', 18, 'erasure', 10, 'open');
  request(DSR.c19Portability, 'DSR-0002', 19, 'portability', 20, 'completed', {
    completedAt: ctx.d(-18),
    handledByUserId: USER.camila,
    resolutionNote: 'Arquivo JSON do titular gerado e entregue.',
  });
  request(DSR.c20Correction, 'DSR-0003', 20, 'correction', 13, 'in_progress', {
    handledByUserId: USER.wesley,
  });
  request(DSR.c16Revocation, 'DSR-0004', 16, 'consent_revocation', 15, 'completed', {
    completedAt: ctx.d(-15),
    handledByUserId: USER.camila,
    resolutionNote: 'Consentimento de saúde revogado e efeitos aplicados na hora.',
  });
  request(DSR.c02Review, 'DSR-0005', 2, 'decision_review', 4, 'in_progress', {
    handledByUserId: USER.camila,
  });

  // ===== Incidentes (2): 1 encerrado e 1 aberto, em contenção =====
  c.incidents.push(
    ctx.entity<Incident>('inc_0001', ctx.dt(-45, '14:10'), {
      occurredAt: ctx.dt(-45, '14:10'),
      description: 'E-mail com a agenda da semana enviado ao destinatário errado (simulado).',
      dataAffected: ['Nome do titular', 'Dia e horário de atendimento'],
      affectedSubjects: 1,
      measures:
        'Solicitado o descarte ao destinatário, revisão do endereço de envio e orientação à equipe de atendimento.',
      status: 'closed',
      communications: [
        {
          to: 'subjects',
          at: ctx.dt(-44, '10:00'),
          text: 'Titular informado sobre o envio indevido e as medidas adotadas.',
        },
        {
          to: 'ANPD',
          at: ctx.dt(-43, '16:00'),
          text: 'Comunicação do incidente à Autoridade Nacional de Proteção de Dados (simulada).',
        },
      ],
    }),
  );

  c.incidents.push(
    ctx.entity<Incident>('inc_0002', ctx.dt(-3, '09:30'), {
      occurredAt: ctx.dt(-3, '09:30'),
      description:
        'Planilha com a lista de inscritos de um grupo de apoio compartilhada por engano com outra turma (simulado).',
      dataAffected: ['Nome dos inscritos', 'Tema e horário do grupo'],
      affectedSubjects: 4,
      measures:
        'Acesso à planilha revogado. Aguardando a confirmação do descarte pela outra turma e a avaliação do risco pelo responsável técnico.',
      status: 'open',
      communications: [],
    }),
  );

  // ===== Retenção (6.7) =====
  const retention = (
    dataClass: string,
    retentionYears: number | null,
    basis: string,
    note: string,
    retentionDays?: number,
  ): void => {
    c.retentionPolicies.push(
      ctx.entity<RetentionPolicy>(ctx.nextId('ret'), ctx.at(published), {
        dataClass,
        retentionYears,
        ...(retentionDays ? { retentionDays } : {}),
        basis,
        note,
      }),
    );
  };
  retention(
    'Registro documental psicológico (Zarit, anotações, ocorrências clínicas)',
    5,
    'Res. CFP 1/2009 (a confirmar)',
    'Bloqueado após pedido de eliminação',
  );
  retention(
    'Cadastro e contato',
    null,
    'Execução do contrato',
    'Eliminação até 30 dias depois do encerramento',
    30,
  );
  retention(
    'Mensagens e solicitações de serviço',
    null,
    'Execução do contrato',
    'Até 30 dias depois do encerramento, se sem dado clínico',
    30,
  );
  retention('Log de acesso', 5, 'Segurança e auditoria', 'Preservado');
  retention(
    'Consentimentos (eventos)',
    5,
    'Prova de consentimento',
    'Cinco anos depois do fim do vínculo',
  );

  // ===== Log de auditoria (80) =====
  type Raw = Omit<AccessLogEntry, 'id' | 'createdAt' | 'updatedAt' | 'at'>;
  const raws: Raw[] = [];
  const roleOf = (userId: string): Role =>
    (c.users.find((u) => u.id === userId) as { role: Role }).role;
  const push = (
    action: AccessAction,
    userId: string,
    entity: string,
    extra: Partial<Raw> = {},
  ): void => {
    raws.push({ userId, role: roleOf(userId), action, entity, ...extra });
  };

  [
    USER.partner,
    USER.technicalLead,
    USER.rafael,
    USER.camila,
    USER.technicalLead,
    USER.beatriz,
    USER.wesley,
    USER.leticia,
    USER.partner,
    USER.tiago,
    USER.camila,
    USER.technicalLead,
    USER.rafael,
    USER.wesley,
  ].forEach((u) => push('login', u, 'session'));

  const viewsOf = (userId: string, caregivers: number[], count: number): void => {
    const entities = ['zarit_assessment', 'zarit_alert', 'session_note'];
    for (let k = 0; k < count; k += 1) {
      const n = caregivers[k % caregivers.length] as number;
      push('view', userId, entities[k % entities.length] as string, {
        subjectCaregiverId: caregiverId(n),
      });
    }
  };
  viewsOf(USER.rafael, [1, 3, 5, 10, 24], 12);
  viewsOf(USER.beatriz, [2, 6, 8, 12, 14, 16, 21], 9);
  viewsOf(USER.leticia, [4, 7, 9, 11, 13, 15, 17], 9);
  viewsOf(USER.tiago, [18, 19, 20, 22, 23, 25, 26, 27, 28, 29], 6);
  [OCCURRENCE.o1, OCCURRENCE.o2, OCCURRENCE.o3, OCCURRENCE.o2].forEach((id, k) =>
    push('view', USER.technicalLead, 'occurrence', {
      entityId: id,
      subjectCaregiverId: caregiverId([11, 1, 28, 1][k] as number),
    }),
  );

  const supervise: [number, string, string][] = [
    [2, 'zarit_alert', 'Supervisão do alerta vermelho vencido sem contato'],
    [1, 'zarit_alert', 'Acompanhar o alerta vermelho do dia e a ocorrência POP-05'],
    [11, 'zarit_assessment', 'Revisão do caso de Zarit 88 encaminhado à rede de urgência'],
    [28, 'zarit_assessment', 'Validação técnica do caso com suspeita de negligência'],
    [3, 'zarit_assessment', 'Supervisão da evolução no piloto'],
    [12, 'zarit_assessment', 'Conferência da redução ao fim do piloto'],
    [9, 'session_note', 'Supervisão de anotação, caso em amarelo'],
    [8, 'zarit_alert', 'Verificar a tarefa de revisão da rede de apoio'],
    [24, 'zarit_assessment', 'Acompanhamento do piloto no mês 4'],
    [14, 'zarit_assessment', 'Zarit vencida: orientar o psicólogo do caso'],
    [10, 'zarit_alert', 'Conferir encerramento de alerta vermelho'],
    [29, 'zarit_assessment', 'Revisão do alerta da ARBE (atenção)'],
  ];
  supervise.forEach(([n, entity, justification]) =>
    push('supervise', USER.technicalLead, entity, {
      subjectCaregiverId: caregiverId(n),
      justification,
    }),
  );

  const reveal: [string, string, number, string][] = [
    [USER.camila, 'cpf', 4, 'Conferir cadastro a pedido da família por telefone'],
    [USER.camila, 'phone', 15, 'Retornar contato solicitado pelo titular'],
    [USER.wesley, 'email', 20, 'Enviar documento solicitado pelo titular'],
    [USER.wesley, 'phone', 29, 'Retornar ligação sobre o cartão'],
    [USER.camila, 'cpf', 19, 'Confirmar identidade para a portabilidade'],
  ];
  reveal.forEach(([user, field, n, justification]) =>
    push('reveal', user, 'caregiver', {
      entityId: caregiverId(n),
      subjectCaregiverId: caregiverId(n),
      justification,
      detail: `campo: ${field}`,
    }),
  );

  push('export', USER.camila, 'subject_portability', {
    subjectCaregiverId: caregiverId(19),
    detail: 'exportação do titular (portabilidade)',
  });
  push('export', USER.partner, 'caregiver_list_csv', {
    detail: 'lista pseudonimizada, sem dados sensíveis',
  });
  push('export', USER.technicalLead, 'access_log_csv', { detail: 'log sem conteúdo clínico' });

  push('denied', USER.wesley, 'route', { detail: 'sem permissão em finance: /app/financeiro' });
  push('denied', USER.tiago, 'route', { detail: 'sem permissão em lgpd_audit_log: /app/lgpd/log' });
  push('denied', USER.rafael, 'route', { detail: 'sem permissão em finance: /app/financeiro' });
  push('denied', USER.rafael, 'route', {
    detail: `caso de outro psicólogo: /app/cuidadores/${caregiverId(2)}`,
  });
  push('denied', USER.camila, 'route', {
    detail: 'sem permissão em zarit_individual: /app/acompanhamento/fila',
  });
  push('denied', USER.partner, 'route', {
    detail: `sem permissão em zarit_individual: /app/acompanhamento/alertas/${ZARIT_ALERT.a}`,
  });

  // Distribui no tempo (D-29 a D-1), em ordem cronológica, com ids sequenciais.
  const shuffled = rng.shuffle(raws);
  const total = shuffled.length;
  const stamps = shuffled
    .map((_, k) => {
      const day = -29 + Math.floor((k * 28) / (total - 1));
      const minute = 8 * 60 + ((k * 53) % 600);
      const hh = String(Math.floor(minute / 60)).padStart(2, '0');
      const mm = String(minute % 60).padStart(2, '0');
      return ctx.dt(day, `${hh}:${mm}`);
    })
    .sort();
  shuffled.forEach((raw, k) => {
    const at = stamps[k] as string;
    c.accessLog.push(ctx.entity<AccessLogEntry>(ctx.nextId('log'), at, { at, ...raw }));
  });
}
