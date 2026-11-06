import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CaregiverSessionService } from '../auth/caregiver-session.service';
import { ConsentService } from '../privacy/consent.service';
import { configureCoreTest } from '../testing/test-helpers';
import {
  CaregiverError,
  CaregiverRegistration,
  CaregiverRegistrationService,
} from './caregiver-registration.service';

const base = (overrides: Partial<CaregiverRegistration> = {}): CaregiverRegistration => ({
  fullName: '  Cuidadora Exemplo Quatro  ',
  birthDate: '1982-03-15',
  cpf: '000.123.456-00',
  email: 'quatro@exemplo.com.br',
  phone: '(34) 90000-0444',
  relationship: 'daughter',
  sex: 'undisclosed',
  city: 'Uberlândia',
  dailyCareHours: 6,
  preferredChannel: 'app',
  digitalLiteracy: 'medium',
  elder: { fullName: 'Helena Exemplo', birthDate: '1945-06-01', dependency: 'partial' },
  consents: { health_data: 'granted', family_sharing: 'refused' },
  consentChannel: 'app',
  planId: 'livre',
  registeredByUserId: 'self',
  emergencyNoticeAcceptedAt: '2026-11-04T12:00:00-03:00',
  ...overrides,
});

function setup() {
  const env = configureCoreTest({ seed: true });
  return { ...env, registration: TestBed.inject(CaregiverRegistrationService), consent: TestBed.inject(ConsentService) };
}

describe('Cadastro de cuidador, miolo do núcleo (RN-USR-02 a 04, 10, 14, 18)', () => {
  it('atribui o próximo código CUI e o id, e cria o cuidador, a pessoa idosa vinculada e a assinatura Livre', () => {
    const { db, registration } = setup();
    const before = db.caregivers.size();
    const next = registration.nextIdentity();
    expect(next).toEqual({ id: 'cg_0341', code: 'CUI-0341', elderId: 'el_0341' });

    const { caregiver, elder } = registration.register(base());
    expect(db.caregivers.size()).toBe(before + 1);
    expect(caregiver.id).toBe('cg_0341');
    expect(caregiver.code).toBe('CUI-0341');
    expect(caregiver.fullName).toBe('Cuidadora Exemplo Quatro');
    expect(caregiver.status).toBe('active');
    expect(caregiver.cpfIsFictitious).toBe(true);
    expect(caregiver.isPilot).toBe(false);
    expect(caregiver.emergencyNoticeAcceptedAt).toBe('2026-11-04T12:00:00-03:00');
    expect(elder.caregiverId).toBe(caregiver.id);
    expect(db.elders.get(elder.id)?.fullName).toBe('Helena Exemplo');
    const subscription = db.subscriptions.find((s) => s.caregiverId === caregiver.id);
    expect(subscription?.planId).toBe('livre');
    expect(subscription?.status).toBe('active');
  });

  it('cria os seis consentimentos: o escolhido vira evento, o resto fica pendente, nada vem marcado', () => {
    const { db, registration, consent } = setup();
    const { caregiver } = registration.register(base());
    const list = consent.list(caregiver.id);
    expect(list).toHaveLength(6);
    expect(consent.status(caregiver.id, 'health_data')).toBe('granted');
    expect(consent.status(caregiver.id, 'family_sharing')).toBe('refused');
    expect(consent.status(caregiver.id, 'people_analytics')).toBe('pending');
    expect(consent.status(caregiver.id, 'pilot_tcle')).toBe('pending');
    const events = db.consentEvents.query((e) => e.caregiverId === caregiver.id);
    expect(events).toHaveLength(2);
    events.forEach((e) => {
      expect(e.channel).toBe('app');
      // Quem se cadastra pelo aplicativo registra o próprio consentimento.
      expect(e.registeredByUserId).toBe(caregiver.id);
    });
  });

  it('recusa um CPF fictício que já existe', () => {
    const { registration } = setup();
    registration.register(base());
    expect(() => registration.register(base({ fullName: 'Outra Pessoa' }))).toThrow(CaregiverError);
    expect(registration.findByCpf('000.123.456-00')?.code).toBe('CUI-0341');
    expect(registration.findByCpf('000.123.456-00', 'cg_0341')).toBeUndefined();
    expect(registration.findByCpf('000.000.000-00')).toBeUndefined();
  });

  it('sem quem registrou e sem sessão da equipe, o consentimento falha com a frase pronta', () => {
    const { registration } = setup();
    const draft = base();
    delete draft.registeredByUserId;
    expect(() => registration.register(draft)).toThrow('Informe quem está registrando o consentimento.');
  });

  it('datas que existem, nascimento fora do futuro e textos de até 120 caracteres: nada é gravado se falhar (QAC-015)', () => {
    const { db, registration } = setup();
    const before = db.caregivers.size();
    expect(() => registration.register(base({ birthDate: '1982-02-30' }))).toThrow('Escolha uma data que exista.');
    expect(() => registration.register(base({ elder: { fullName: 'Helena Exemplo', birthDate: '2026-02-30', dependency: 'partial' } }))).toThrow('Escolha uma data que exista.');
    expect(() => registration.register(base({ birthDate: '2030-01-01' }))).toThrow('A data de nascimento não pode ser no futuro.');
    expect(() => registration.register(base({ elder: { fullName: 'Helena Exemplo', birthDate: '2030-01-01', dependency: 'partial' } }))).toThrow('A data de nascimento não pode ser no futuro.');
    expect(() => registration.register(base({ fullName: 'N'.repeat(121) }))).toThrow('Escreva até 120 caracteres.');
    expect(() => registration.register(base({ city: 'C'.repeat(121) }))).toThrow('Escreva até 120 caracteres.');
    expect(db.caregivers.size()).toBe(before);
    expect(registration.register(base({ fullName: 'N'.repeat(120) })).caregiver.fullName).toHaveLength(120);
  });

  it('quem está dentro da conta de outro cuidador não cria um cadastro por baixo (QAC-001): o erro vem antes de gravar qualquer coisa', () => {
    const { db, registration } = setup();
    TestBed.inject(CaregiverSessionService).signIn('cg_0001');
    const before = db.caregivers.size();
    expect(() => registration.register(base())).toThrow('Saia da sua conta para criar outro cadastro.');
    expect(db.caregivers.size()).toBe(before);
  });

  it('o plano Livre não cria Cartão Nexus', () => {
    const { db, registration } = setup();
    const { caregiver } = registration.register(base());
    expect(db.benefitCards.find((c) => c.caregiverId === caregiver.id)).toBeUndefined();
  });
});
