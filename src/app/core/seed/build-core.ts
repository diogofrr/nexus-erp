/** Usuários de demonstração da equipe (5.1), psicólogos, salas (5.3) e catálogo de planos. */
import { defaultAppSettings, defaultPilotConfig } from '../data/defaults';
import { AppUser, Plan, PsychologistProfile, Room } from '../models';
import { DEFAULT_PLANS } from '../rules/plans';
import { restoreFinancialParams } from '../rules/finance';
import { ROLES_REQUIRING_TWO_FACTOR } from '../auth/permissions';
import { PSYCHOLOGIST, ROOM, USER } from './refs';
import { SeedState } from './state';

export function buildCore(s: SeedState): void {
  const { ctx, c } = s;
  const created = ctx.dt(-365, '08:00');

  const user = (
    id: string,
    displayName: string,
    email: string,
    role: AppUser['role'],
    demoDescription: string,
    extra: Partial<AppUser> = {},
  ): void => {
    c.users.push(
      ctx.entity<AppUser>(id, created, {
        displayName,
        email,
        role,
        active: true,
        requiresTwoFactor: ROLES_REQUIRING_TWO_FACTOR.includes(role),
        demoDescription,
        ...extra,
      }),
    );
  };

  user(
    USER.partner,
    'Helena Prado Vasconcelos',
    'helena.vasconcelos@exemplo.com.br',
    'partner',
    'Sócia e gestão: planos, rede, parcerias, finanças e comunicação. Vê saúde só de forma agregada.',
  );
  user(
    USER.technicalLead,
    'Dra. Cecília Montenegro',
    'cecilia.montenegro@exemplo.com.br',
    'technical_lead',
    'Responsável técnico (CRP-04/00001, fictício): supervisão dos casos, POPs de risco e parâmetros da ARBE.',
  );
  user(
    USER.jessica,
    PSYCHOLOGIST.jessica.name,
    'jessica.rosa@exemplo.com.br',
    'psychologist',
    'Equipe de psicologia: agenda, sessões e Zarit dos seus cuidadores. Agenda muito ocupada.',
    { psychologistId: PSYCHOLOGIST.jessica.id },
  );
  user(
    USER.isabelle,
    PSYCHOLOGIST.isabelle.name,
    'isabelle.ramos@exemplo.com.br',
    'psychologist',
    'Equipe de psicologia: acompanhamento dos seus cuidadores.',
    { psychologistId: PSYCHOLOGIST.isabelle.id },
  );
  user(
    USER.marina,
    PSYCHOLOGIST.marina.name,
    'marina.gomes@exemplo.com.br',
    'psychologist',
    'Equipe de psicologia: ocupação exatamente no limite de 80%.',
    { psychologistId: PSYCHOLOGIST.marina.id },
  );
  user(
    USER.gustavo,
    PSYCHOLOGIST.gustavo.name,
    'gustavo.medeiros@exemplo.com.br',
    'psychologist',
    'Equipe de psicologia, começou há um mês: agenda em formação.',
    { psychologistId: PSYCHOLOGIST.gustavo.id },
  );
  user(
    USER.camila,
    'Camila Duarte',
    'camila.duarte@exemplo.com.br',
    'support',
    'Atendimento: cadastros, assinaturas, mensagens, reclamações e solicitações do titular. Sem dado clínico.',
  );
  user(
    USER.wesley,
    'Wesley Lacerda',
    'wesley.lacerda@exemplo.com.br',
    'support',
    'Atendimento: caixa de mensagens e registros em nome do usuário.',
  );
  // Os 3 integrantes que completam a equipe de psicologia (7 no total): começaram nesta semana, ainda sem cuidadores.
  (
    [
      ['joao', 'joao.eduardo@exemplo.com.br'],
      ['mariaJose', 'maria.jose@exemplo.com.br'],
      ['luzia', 'luzia.luzdalma@exemplo.com.br'],
    ] as const
  ).forEach(([key, email]) =>
    user(
      USER[key],
      PSYCHOLOGIST[key].name,
      email,
      'psychologist',
      'Equipe de psicologia, começou nesta semana: agenda ainda sem horários e sem cuidadores.',
      { psychologistId: PSYCHOLOGIST[key].id },
    ),
  );

  // Equipe de psicologia (7)
  const hours: Record<keyof typeof PSYCHOLOGIST, number> = {
    jessica: 40,
    isabelle: 40,
    marina: 40,
    gustavo: 20,
    joao: 20,
    mariaJose: 20,
    luzia: 20,
  };
  const newcomers: ReadonlySet<string> = new Set(['joao', 'mariaJose', 'luzia']);
  (Object.keys(PSYCHOLOGIST) as (keyof typeof PSYCHOLOGIST)[]).forEach((key) => {
    const p = PSYCHOLOGIST[key];
    const profile = ctx.entity<PsychologistProfile>(p.id, newcomers.has(key) ? ctx.dt(-5) : key === 'gustavo' ? ctx.dt(-30) : created, {
      userId: p.userId,
      displayName: p.name,
      crp: p.crp,
      crpStatus: 'active',
      isTechnicalLead: false,
      weeklyAvailableHours: hours[key],
    });
    c.psychologists.push(profile);
    s.psychologistById.set(profile.id, profile);
  });

  // Salas (3): a Jacarandá não tem sanitário adaptado e serve ao teste de bloqueio.
  const room = (id: string, name: string, number: number, adaptedRestroom: boolean): void => {
    c.rooms.push(
      ctx.entity<Room>(id, created, {
        name,
        address: `Rua Exemplo, ${number}, Uberlândia`,
        accessibility: {
          stepFreeAccess: true,
          adaptedRestroom,
          goodLighting: true,
          armrestSeating: true,
        },
        active: true,
      }),
    );
  };
  room(ROOM.girassol, 'Sala Girassol', 120, true);
  room(ROOM.ipe, 'Sala Ipê', 120, true);
  room(ROOM.jacaranda, 'Sala Jacarandá', 120, false);

  // Planos (4)
  DEFAULT_PLANS.forEach((def) => {
    c.plans.push({
      ...def,
      benefits: [...def.benefits],
      createdAt: created,
      updatedAt: created,
    } as Plan);
  });

  s.singletons.settings = defaultAppSettings();
  s.singletons.financialParams = restoreFinancialParams();
  s.singletons.pilotConfig = defaultPilotConfig();
}
