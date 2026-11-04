/** Usuários de demonstração (5.1), psicólogos, salas (5.3) e catálogo de planos. */
import { defaultAppSettings, defaultPilotConfig } from '../data/defaults';
import { AppUser, Plan, PsychologistProfile, Room } from '../models';
import { DEFAULT_PLANS } from '../rules/plans';
import { restoreFinancialParams } from '../rules/finance';
import { ROLES_REQUIRING_TWO_FACTOR } from '../auth/permissions';
import { PSYCHOLOGIST, ROOM, USER, providerId } from './refs';
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
    USER.rafael,
    PSYCHOLOGIST.rafael.name,
    'rafael.moreira@exemplo.com.br',
    'psychologist',
    'Psicólogo da equipe: agenda, sessões e Zarit dos seus cuidadores. Agenda muito ocupada.',
    { psychologistId: PSYCHOLOGIST.rafael.id },
  );
  user(
    USER.beatriz,
    PSYCHOLOGIST.beatriz.name,
    'beatriz.nogueira@exemplo.com.br',
    'psychologist',
    'Psicóloga da equipe: acompanhamento dos seus cuidadores.',
    { psychologistId: PSYCHOLOGIST.beatriz.id },
  );
  user(
    USER.leticia,
    PSYCHOLOGIST.leticia.name,
    'leticia.amaral@exemplo.com.br',
    'psychologist',
    'Psicóloga da equipe: ocupação exatamente no limite de 80%.',
    { psychologistId: PSYCHOLOGIST.leticia.id },
  );
  user(
    USER.tiago,
    PSYCHOLOGIST.tiago.name,
    'tiago.brandao@exemplo.com.br',
    'psychologist',
    'Psicólogo que começou há um mês: agenda em formação.',
    { psychologistId: PSYCHOLOGIST.tiago.id },
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
  user(
    USER.dentist,
    'Dr. Eduardo Falcão',
    'eduardo.falcao@exemplo.com.br',
    'provider',
    'Cirurgião-dentista credenciado (CRO fictício): solicitações, nota e documentos no portal.',
    { providerId: providerId(11) },
  );
  user(
    USER.physio,
    'Dra. Renata Sampaio',
    'renata.sampaio@exemplo.com.br',
    'provider',
    'Fisioterapeuta credenciada na zona de excelência.',
    { providerId: providerId(1) },
  );
  user(
    USER.clinic,
    'Clínica Saúde Integral',
    'contato.saudeintegral@exemplo.com.br',
    'provider',
    'Prestador suspenso: vê o aviso neutro e envia justificativas.',
    { providerId: providerId(10) },
  );
  user(
    USER.rosimeire,
    'Cuidadora Rosimeire Tavares',
    'rosimeire.tavares@exemplo.com.br',
    'provider',
    'Prestadora nova, sem a cláusula de proteção de dados assinada.',
    { providerId: providerId(20) },
  );

  // Psicólogos (4)
  const hours: Record<keyof typeof PSYCHOLOGIST, number> = {
    rafael: 40,
    beatriz: 40,
    leticia: 40,
    tiago: 20,
  };
  (Object.keys(PSYCHOLOGIST) as (keyof typeof PSYCHOLOGIST)[]).forEach((key) => {
    const p = PSYCHOLOGIST[key];
    const profile = ctx.entity<PsychologistProfile>(p.id, key === 'tiago' ? ctx.dt(-30) : created, {
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
