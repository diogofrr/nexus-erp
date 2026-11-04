import { describe, expect, it } from 'vitest';
import { AccessLevel, Resource, Role } from '../models/access';
import {
  MODULES,
  ModuleKey,
  canAccessModule,
  homePathFor,
  menuFor,
  moduleByKey,
} from './module-map';
import {
  Actor,
  BLOCKED_DATA,
  PERMISSION_MATRIX,
  ROLES,
  ROLES_REQUIRING_TWO_FACTOR,
  accessCell,
  accessLevel,
  can,
  canOnRecord,
  canOpenAnyRoute,
  canOpenRoute,
  canSeeFinancialValues,
  canUseSubArea,
  canWriteSubArea,
  isAggregateOnly,
  isOwnProviderRecord,
  isOwnRecord,
  ownershipOfCaregiver,
  providerCaregiverView,
  providerRequestVisibility,
  providerSeesComplaint,
  redactComplaintForProvider,
  redactEvaluationForProvider,
  requiresJustification,
  zaritVisibility,
} from './permissions';

/** A matriz do escopo (seção 1.2), retranscrita aqui como oráculo: partner, RT, psicólogo, atendimento, credenciado. */
const EXPECTED: Record<
  Resource,
  [AccessLevel, AccessLevel, AccessLevel, AccessLevel, AccessLevel]
> = {
  access_profile: ['L', 'L', 'L', 'L', 'L'],
  dashboard: ['T', 'T', 'T', 'T', 'T'],
  caregiver_registry: ['A', 'S', 'P', 'E', '-'],
  elder_care: ['-', 'S', 'P', 'L', '-'],
  plans_subscriptions: ['T', 'L', 'L', 'E', '-'],
  care_schedule: ['A', 'L', 'P', 'E', '-'],
  session_notes: ['-', 'S', 'C', '-', '-'],
  occupancy: ['L', 'L', 'P', '-', '-'],
  rooms: ['E', 'L', 'L', 'L', '-'],
  zarit_individual: ['-', 'S', 'C', '-', '-'],
  zarit_aggregate: ['A', 'A', 'A', '-', '-'],
  arbe_settings: ['L', 'T', 'L', '-', '-'],
  groups: ['T', 'E', 'E', 'E', '-'],
  network: ['T', 'L', '-', 'L', 'P'],
  partners_corporate: ['T', '-', '-', 'L', '-'],
  finance: ['T', '-', '-', '-', '-'],
  indicators: ['T', 'A', 'A', 'L', '-'],
  pilot: ['T', 'A', '-', '-', '-'],
  message_inbox: ['T', 'L', 'P', 'T', 'P'],
  complaints: ['T', 'L', '-', 'T', 'P'],
  lgpd_consents_requests: ['T', 'E', '-', 'E', '-'],
  lgpd_audit_log: ['L', 'T', '-', '-', '-'],
  governance: ['T', 'T', 'L', 'L', 'L'],
  occurrences: ['A', 'T', 'C', '-', '-'],
  provider_portal: ['-', '-', '-', '-', 'T'],
  settings: ['T', 'E', '-', '-', '-'],
};

const ORDER: Role[] = ['partner', 'technical_lead', 'psychologist', 'support', 'provider'];

describe('Matriz de permissões (escopo, seção 1.2)', () => {
  it('cada célula da matriz é igual à do escopo', () => {
    (Object.keys(EXPECTED) as Resource[]).forEach((resource) => {
      ORDER.forEach((role, i) => {
        expect(accessLevel(role, resource), `${resource} x ${role}`).toBe(EXPECTED[resource][i]);
      });
    });
    expect(Object.keys(PERMISSION_MATRIX)).toHaveLength(Object.keys(EXPECTED).length);
  });

  it('são cinco perfis e a equipe exige dois fatores (RN-LGPD-15)', () => {
    expect(ROLES).toEqual(ORDER);
    expect(ROLES_REQUIRING_TWO_FACTOR).toEqual([
      'partner',
      'technical_lead',
      'psychologist',
      'support',
    ]);
  });

  it('a linha do escopo "M10 Financeiro e indicadores" foi desdobrada sem dar valores ao RT, ao psicólogo e ao atendimento (seção 1.3)', () => {
    (['technical_lead', 'psychologist', 'support', 'provider'] as Role[]).forEach((r) =>
      expect(canSeeFinancialValues(r)).toBe(false),
    );
    expect(canSeeFinancialValues('partner')).toBe(true);
    expect(canUseSubArea('support', 'indicators', 'operational')).toBe(true);
    expect(canUseSubArea('support', 'indicators', 'clinical')).toBe(false);
  });
});

describe('can(role, resource, action): níveis', () => {
  it('L só lê; E lê, cria, edita, exporta e revela; T faz tudo menos supervisionar', () => {
    expect(can('partner', 'arbe_settings', 'view')).toBe(true);
    expect(can('partner', 'arbe_settings', 'update')).toBe(false);
    expect(can('support', 'caregiver_registry', 'update')).toBe(true);
    expect(can('support', 'caregiver_registry', 'delete')).toBe(false);
    expect(can('support', 'caregiver_registry', 'reveal')).toBe(true);
    expect(can('partner', 'finance', 'delete')).toBe(true);
    expect(can('partner', 'finance', 'decide')).toBe(true);
    expect(can('partner', 'finance', 'supervise')).toBe(false);
  });

  it('A só vê agregado ou pseudonimizado: nunca view nem reveal (AC-M03-04)', () => {
    expect(can('partner', 'caregiver_registry', 'view')).toBe(false);
    expect(can('partner', 'caregiver_registry', 'view_aggregate')).toBe(true);
    expect(can('partner', 'caregiver_registry', 'reveal')).toBe(false);
    expect(isAggregateOnly('partner', 'zarit_aggregate')).toBe(true);
    expect(isAggregateOnly('partner', 'finance')).toBe(false);
  });

  it('P e C valem só para registros próprios: own=false nega, omitido permite no nível de tela', () => {
    expect(can('psychologist', 'caregiver_registry', 'view')).toBe(true);
    expect(can('psychologist', 'caregiver_registry', 'view', { own: true })).toBe(true);
    expect(can('psychologist', 'caregiver_registry', 'view', { own: false })).toBe(false);
    expect(can('psychologist', 'caregiver_registry', 'update', { own: true })).toBe(false); // P sem edição
    expect(can('psychologist', 'care_schedule', 'update', { own: true })).toBe(true); // "P (E)"
    expect(can('psychologist', 'care_schedule', 'update', { own: false })).toBe(false);
    expect(can('psychologist', 'zarit_individual', 'create', { own: true })).toBe(true); // C
    expect(can('psychologist', 'zarit_individual', 'create', { own: false })).toBe(false);
    expect(can('psychologist', 'session_notes', 'view', { own: false })).toBe(false);
  });

  it('S lê tudo mas só supervisiona (não edita anotação de outro psicólogo) e exige justificativa', () => {
    expect(can('technical_lead', 'session_notes', 'view')).toBe(true);
    expect(can('technical_lead', 'session_notes', 'supervise')).toBe(true);
    expect(can('technical_lead', 'session_notes', 'update')).toBe(false);
    expect(can('technical_lead', 'zarit_individual', 'create')).toBe(false);
    expect(requiresJustification('technical_lead', 'session_notes', 'view')).toBe(true);
    expect(requiresJustification('technical_lead', 'zarit_individual', 'supervise')).toBe(true);
    expect(requiresJustification('psychologist', 'zarit_individual', 'view')).toBe(false);
    expect(requiresJustification('partner', 'finance', 'view')).toBe(false);
  });

  it('sem acesso (-) nega tudo', () => {
    (
      [
        'view',
        'view_aggregate',
        'create',
        'update',
        'delete',
        'decide',
        'export',
        'reveal',
        'supervise',
      ] as const
    ).forEach((action) => {
      expect(can('provider', 'finance', action)).toBe(false);
      expect(can('support', 'zarit_individual', action)).toBe(false);
    });
  });

  it('áreas internas e escritas extras (RT valida psicólogos da rede; atendimento registra solicitações)', () => {
    expect(canUseSubArea('technical_lead', 'settings', 'arbe')).toBe(true);
    expect(canUseSubArea('technical_lead', 'settings', 'guidance_content')).toBe(true);
    expect(canUseSubArea('technical_lead', 'settings', 'finance')).toBe(false);
    expect(canUseSubArea('partner', 'settings', 'qualquer')).toBe(true);
    expect(canUseSubArea('psychologist', 'settings', 'arbe')).toBe(false);
    expect(canWriteSubArea('technical_lead', 'network', 'psychologist_registry_validation')).toBe(
      true,
    );
    expect(canWriteSubArea('support', 'network', 'service_requests')).toBe(true);
    expect(canWriteSubArea('support', 'network', 'accreditation')).toBe(false);
    expect(can('support', 'network', 'update')).toBe(false);
  });
});

describe('Rotas e módulos (AC-M01-06, AC-M01-08)', () => {
  it('o plano do cuidador dentro do perfil não dá acesso à tela de assinaturas ao psicólogo (AC-M04-10)', () => {
    expect(accessLevel('psychologist', 'plans_subscriptions')).toBe('L');
    expect(canOpenRoute('psychologist', 'plans_subscriptions')).toBe(false);
    expect(canAccessModule('psychologist', moduleByKey('subscriptions'))).toBe(false);
  });

  it('o credenciado só entra no portal, nunca em /app (AC-M14-01)', () => {
    expect(menuFor('provider')).toEqual([]);
    expect(homePathFor('provider')).toBe('/portal');
    expect(canOpenRoute('provider', 'provider_portal')).toBe(true);
    MODULES.filter((m) => m.key !== 'provider-portal').forEach((m) =>
      expect(canAccessModule('provider', m), m.key).toBe(false),
    );
    expect(canAccessModule('provider', moduleByKey('provider-portal'))).toBe(true);
    expect(canOpenAnyRoute('provider', ['dashboard', 'finance'])).toBe(false);
  });

  it('o menu lateral de cada perfil mostra só o permitido', () => {
    const keys = (role: Role): ModuleKey[] => menuFor(role).map((m) => m.key);
    expect(keys('partner')).toContain('finance');
    expect(keys('partner')).toContain('settings');
    expect(keys('technical_lead')).not.toContain('finance');
    expect(keys('technical_lead')).toContain('settings');
    expect(keys('psychologist')).toEqual([
      'dashboard',
      'caregivers',
      'care-sessions',
      'zarit',
      'groups',
      'indicators',
      'messages',
      'governance',
    ]);
    expect(keys('support')).toEqual([
      'dashboard',
      'caregivers',
      'subscriptions',
      'care-sessions',
      'groups',
      'network',
      'partners',
      'companies',
      'indicators',
      'messages',
      'complaints',
      'privacy',
      'governance',
    ]);
    expect(keys('support')).not.toContain('zarit');
    expect(keys('support')).not.toContain('settings');
    expect(keys('partner')).not.toContain('provider-portal');
    expect(homePathFor('partner')).toBe('/app/painel');
  });

  it('cada módulo do mapa aponta para uma pasta de funcionalidade e para recursos da matriz', () => {
    expect(MODULES).toHaveLength(18);
    expect(new Set(MODULES.map((m) => m.key)).size).toBe(18);
    MODULES.forEach((m) => {
      m.resources.forEach((r) => expect(Object.keys(PERMISSION_MATRIX)).toContain(r));
      expect(m.path.endsWith(m.segment)).toBe(true);
    });
  });
});

describe('Propriedade de registros (P e C)', () => {
  const psy: Actor = { userId: 'u3', role: 'psychologist', psychologistId: 'psy_0001' };
  const provider: Actor = { userId: 'u9', role: 'provider', providerId: 'prv_11' };
  const lead: Actor = { userId: 'u2', role: 'technical_lead' };

  it('psicólogo: seus cuidadores, suas sessões e suas anotações', () => {
    expect(isOwnRecord(psy, { assignedPsychologistId: 'psy_0001' })).toBe(true);
    expect(isOwnRecord(psy, { psychologistId: 'psy_0001' })).toBe(true);
    expect(isOwnRecord(psy, { authorPsychologistId: 'psy_0001' })).toBe(true);
    expect(isOwnRecord(psy, { assignedPsychologistId: 'psy_0002' })).toBe(false);
    expect(isOwnRecord(psy, {})).toBe(false);
    expect(
      canOnRecord(psy, 'caregiver_registry', 'view', { assignedPsychologistId: 'psy_0001' }),
    ).toBe(true);
    expect(
      canOnRecord(psy, 'caregiver_registry', 'view', { assignedPsychologistId: 'psy_0002' }),
    ).toBe(false);
    expect(canOnRecord(psy, 'session_notes', 'view', { authorPsychologistId: 'psy_0002' })).toBe(
      false,
    );
    expect(ownershipOfCaregiver({ assignedPsychologistId: 'psy_0003' })).toEqual({
      assignedPsychologistId: 'psy_0003',
    });
    expect(ownershipOfCaregiver({})).toEqual({});
  });

  it('ocorrências: só o RT e o psicólogo do caso (RN-ENC-11)', () => {
    const occurrence = { restrictedToUserIds: ['u2', 'u3'] };
    expect(isOwnRecord(lead, occurrence)).toBe(true);
    expect(isOwnRecord(psy, occurrence)).toBe(true);
    expect(isOwnRecord({ userId: 'u7', role: 'support' }, occurrence)).toBe(false);
    expect(canOnRecord({ userId: 'u7', role: 'support' }, 'occurrences', 'view', occurrence)).toBe(
      false,
    );
    expect(canOnRecord({ userId: 'u1', role: 'partner' }, 'occurrences', 'view', occurrence)).toBe(
      false,
    );
    expect(
      canOnRecord({ userId: 'u1', role: 'partner' }, 'occurrences', 'view_aggregate', occurrence),
    ).toBe(true);
  });

  it('credenciado: só o próprio registro', () => {
    expect(isOwnProviderRecord(provider, 'prv_11')).toBe(true);
    expect(isOwnProviderRecord(provider, 'prv_01')).toBe(false);
    expect(isOwnProviderRecord(provider, undefined)).toBe(false);
    expect(isOwnProviderRecord(psy, 'prv_11')).toBe(false);
    expect(isOwnRecord(provider, { providerId: 'prv_11' })).toBe(true);
    expect(isOwnRecord(provider, { target: { providerId: 'prv_11' } })).toBe(true);
    expect(isOwnRecord(provider, { providerId: 'prv_01' })).toBe(false);
  });
});

describe('Perfil provider: mínimo, só com solicitação aceita e cláusula assinada (RN-LGPD-13; AC-M14-03, 04)', () => {
  const signed = { dataProtectionClauseSignedAt: '2026-10-01' };
  const unsigned = {};

  it('visibilidade por solicitação e cláusula', () => {
    expect(providerRequestVisibility(signed, { status: 'requested' })).toBe('minimal_only');
    expect(providerRequestVisibility(signed, { status: 'accepted' })).toBe('caregiver_data');
    expect(providerRequestVisibility(unsigned, { status: 'accepted' })).toBe('clause_required');
    (
      [
        'completed',
        'refused_by_provider',
        'cancelled_by_user',
        'cancelled_by_provider',
        'evaluated',
      ] as const
    ).forEach((status) =>
      expect(providerRequestVisibility(signed, { status })).toBe('minimal_only'),
    );
  });

  it('só devolve nome, contato, necessidade e (se domiciliar) endereço: nunca dado clínico', () => {
    const caregiver = {
      fullName: 'Ana Paula Ferraz',
      phone: '(34) 90000-0001',
      email: 'ana@exemplo.com.br',
    };
    expect(
      providerCaregiverView('minimal_only', caregiver, {
        need: 'Prótese',
        modality: 'at_provider',
      }),
    ).toBeNull();
    expect(
      providerCaregiverView('clause_required', caregiver, {
        need: 'Prótese',
        modality: 'at_provider',
      }),
    ).toBeNull();
    const view = providerCaregiverView(
      'caregiver_data',
      caregiver,
      { need: 'Prótese', modality: 'at_provider' },
      'Rua Exemplo, 10',
    );
    expect(view).toEqual({
      name: 'Ana Paula Ferraz',
      contact: { phone: '(34) 90000-0001', email: 'ana@exemplo.com.br' },
      need: 'Prótese',
    });
    const home = providerCaregiverView(
      'caregiver_data',
      caregiver,
      { need: 'Fisioterapia', modality: 'home' },
      'Rua Exemplo, 10',
    );
    expect(home?.address).toBe('Rua Exemplo, 10');
    expect(Object.keys(home ?? {}).sort()).toEqual(['address', 'contact', 'name', 'need']);
  });

  it('reclamações só as que o citam, sem identificar o cuidador; avaliações sem identificação', () => {
    const provider = { role: 'provider' as const, providerId: 'prv_14' };
    expect(
      providerSeesComplaint(provider, { target: { type: 'provider', providerId: 'prv_14' } }),
    ).toBe(true);
    expect(
      providerSeesComplaint(provider, { target: { type: 'provider', providerId: 'prv_04' } }),
    ).toBe(false);
    expect(providerSeesComplaint(provider, { target: { type: 'platform' } })).toBe(false);
    expect(
      providerSeesComplaint(
        { role: 'support' },
        { target: { type: 'provider', providerId: 'prv_14' } },
      ),
    ).toBe(false);
    const complaint = redactComplaintForProvider({
      protocol: 'REC-0001',
      openedAt: 'x',
      description: 'texto',
      status: 'open',
      ...{ caregiverId: 'cg_0027', channel: 'phone' },
    });
    expect(Object.keys(complaint).sort()).toEqual([
      'description',
      'openedAt',
      'protocol',
      'status',
    ]);
    const evaluation = redactEvaluationForProvider({
      id: 'evl_1',
      score: 4.5,
      comment: 'Bom',
      createdAt: 'x',
      ...{ caregiverId: 'cg_0001' },
    });
    expect(evaluation).toEqual({ id: 'evl_1', score: 4.5, comment: 'Bom', createdAt: 'x' });
    expect(redactEvaluationForProvider({ id: 'e', score: 3, createdAt: 'x' })).not.toHaveProperty(
      'comment',
    );
  });
});

describe('Regras de bloqueio (seção 1.3)', () => {
  it('descreve o que cada perfil não pode ver', () => {
    ORDER.forEach((role) => expect(BLOCKED_DATA[role].length).toBeGreaterThan(0));
    expect(BLOCKED_DATA.support.join(' ')).toContain('Escore de Zarit');
    expect(BLOCKED_DATA.partner.join(' ')).toContain('Escore de Zarit individual');
  });

  it('visibilidade da Zarit por perfil', () => {
    expect(zaritVisibility('support')).toBe('status_only');
    expect(zaritVisibility('partner')).toBe('aggregate');
    expect(zaritVisibility('technical_lead')).toBe('supervision');
    expect(zaritVisibility('psychologist')).toBe('own_case');
    expect(zaritVisibility('provider')).toBe('none');
  });

  it('accessCell expõe o qualificador do escopo', () => {
    expect(accessCell('psychologist', 'caregiver_registry').note).toBe('seus cuidadores');
    expect(accessCell('provider', 'message_inbox')).toMatchObject({ level: 'P', canEdit: true });
  });
});
