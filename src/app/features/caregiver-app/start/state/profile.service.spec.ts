import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { CaregiverOwnershipError } from '../../../../core/auth/caregiver-ownership';
import { CaregiverSessionService } from '../../../../core/auth/caregiver-session.service';
import { ConsentService } from '../../../../core/privacy/consent.service';
import { configureCoreTest } from '../../../../core/testing/test-helpers';
import { ProfileError, ProfileService, WHATSAPP_CONSENT_NEEDED } from './profile.service';

const ANA = 'cg_0001';
const MARIA = 'cg_0002';

function setup(caregiverId: string = ANA) {
  const env = configureCoreTest({ seed: true });
  expect(TestBed.inject(CaregiverSessionService).signIn(caregiverId).status).toBe('ok');
  return { ...env, profile: TestBed.inject(ProfileService), consents: TestBed.inject(ConsentService) };
}

const you = { fullName: 'Ana Paula Ferraz', birthDate: '1981-03-10', phone: '(34) 90000-0123', email: 'ana@exemplo.com.br', city: 'Uberlândia' };
const elderFields = { fullName: 'Dona Alice', birthDate: '1940-05-10', relationship: 'daughter' as const, dependency: 'partial' as const };

describe('ProfileService: regras do Meu perfil (QAC-001, 005, 006, 015)', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('WhatsApp só com a autorização de contato por WhatsApp (RN-LGPD-05 e)', () => {
    it('recusa quem escolhe o WhatsApp sem a autorização e diz o que falta, sem mexer no cadastro', () => {
      const { profile, consents, db } = setup();
      consents.revoke(ANA, 'whatsapp_contact', { channel: 'app', registeredByUserId: ANA });
      const before = db.caregivers.require(ANA);
      expect(before.preferredChannel).not.toBe('whatsapp');
      expect(() => profile.updateDaily(ANA, { hours: 5, channel: 'whatsapp', whatsapp: '(34) 90000-0000' })).toThrow(ProfileError);
      expect(() => profile.updateDaily(ANA, { hours: 5, channel: 'whatsapp', whatsapp: '(34) 90000-0000' })).toThrow(WHATSAPP_CONSENT_NEEDED);
      expect(db.caregivers.require(ANA)).toMatchObject({ preferredChannel: before.preferredChannel, dailyCareHours: before.dailyCareHours });
      expect(WHATSAPP_CONSENT_NEEDED).toBe('Para falar pelo WhatsApp, precisamos da sua autorização. Você pode dar em Privacidade.');
    });

    it('aceita o WhatsApp com a autorização, e religar a autorização libera de novo', () => {
      const { profile, consents, db } = setup();
      consents.revoke(ANA, 'whatsapp_contact', { channel: 'app', registeredByUserId: ANA });
      consents.grant(ANA, 'whatsapp_contact', { channel: 'app', registeredByUserId: ANA });
      expect(profile.updateDaily(ANA, { hours: 5, channel: 'whatsapp', whatsapp: '(34) 90000-0000' })).toBe(true);
      expect(db.caregivers.require(ANA).preferredChannel).toBe('whatsapp');
    });

    it('cadastro antigo que já estava com o WhatsApp sem autorização não trava a correção das horas', () => {
      const { profile, db } = setup();
      db.caregivers.update(ANA, { preferredChannel: 'whatsapp', whatsapp: '(34) 90000-0000' });
      db.consents.updateWhere((c) => c.caregiverId === ANA && c.key === 'whatsapp_contact', { status: 'pending' });
      expect(profile.updateDaily(ANA, { hours: 9, channel: 'whatsapp', whatsapp: '(34) 90000-0000' })).toBe(true);
      expect(db.caregivers.require(ANA).dailyCareHours).toBe(9);
    });

    it('outros canais não pedem a autorização de WhatsApp', () => {
      const { profile, consents, db } = setup();
      consents.revoke(ANA, 'whatsapp_contact', { channel: 'app', registeredByUserId: ANA });
      expect(profile.updateDaily(ANA, { hours: 5, channel: 'phone', whatsapp: '' })).toBe(true);
      expect(db.caregivers.require(ANA).preferredChannel).toBe('phone');
    });
  });

  describe('corrigir as horas por dia gera a nova avaliação da ARBE, sem avisar a pessoa (RN-ARBE-10, 08 e 09)', () => {
    it('gera o alerta, não duplica o do mesmo nível e devolve só "mudou", sem frase de risco', () => {
      const { profile, db } = setup();
      db.arbeAlerts.removeWhere((a) => a.caregiverId === ANA);
      expect(profile.updateDaily(ANA, { hours: 20, channel: 'app', whatsapp: '' })).toBe(true);
      const alerts = db.arbeAlerts.query((a) => a.caregiverId === ANA);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ status: 'generated' });
      // De novo: o mesmo nível aberto não gera outro (RN-ARBE-08).
      expect(profile.updateDaily(ANA, { hours: 22, channel: 'app', whatsapp: '' })).toBe(true);
      expect(db.arbeAlerts.count((a) => a.caregiverId === ANA && a.status !== 'discarded')).toBe(1);
    });

    it('só reavalia quando as horas mudam: mudar o canal não gera avaliação', () => {
      const { profile, db } = setup();
      db.arbeAlerts.removeWhere((a) => a.caregiverId === ANA);
      expect(profile.updateDaily(ANA, { hours: db.caregivers.require(ANA).dailyCareHours, channel: 'phone', whatsapp: '' })).toBe(true);
      expect(db.arbeAlerts.count((a) => a.caregiverId === ANA)).toBe(0);
    });

    it('sem a autorização de saúde a avaliação não acontece (RN-ARBE-09)', () => {
      const { profile, consents, db } = setup();
      consents.revoke(ANA, 'health_data', { channel: 'app', registeredByUserId: ANA });
      db.arbeAlerts.removeWhere((a) => a.caregiverId === ANA);
      expect(profile.updateDaily(ANA, { hours: 24, channel: 'app', whatsapp: '' })).toBe(true);
      expect(db.arbeAlerts.count((a) => a.caregiverId === ANA)).toBe(0);
    });
  });

  describe('datas que existem e textos de tamanho de nome (QAC-015)', () => {
    it('o nascimento de quem cuida precisa existir, não pode ser no futuro e vem com a frase certa', () => {
      const { profile } = setup();
      expect(() => profile.updateYou(ANA, { ...you, birthDate: '1981-02-30' })).toThrow('Escolha uma data que exista.');
      expect(() => profile.updateYou(ANA, { ...you, birthDate: '2030-01-01' })).toThrow('A data de nascimento não pode ser no futuro.');
    });

    it('o nascimento da pessoa idosa precisa existir, e 29/02 vale só em ano bissexto', () => {
      const { profile } = setup();
      expect(() => profile.updateElder(ANA, { ...elderFields, birthDate: '2026-02-30' })).toThrow('Escolha uma data que exista.');
      expect(() => profile.updateElder(ANA, { ...elderFields, birthDate: '2025-02-29' })).toThrow('Escolha uma data que exista.');
      expect(profile.updateElder(ANA, { ...elderFields, birthDate: '1940-02-29' })).toBe(true);
    });

    it('nome e cidade passam de 120 caracteres: recusa com a frase do limite', () => {
      const { profile, db } = setup();
      const before = db.caregivers.require(ANA).fullName;
      expect(() => profile.updateYou(ANA, { ...you, fullName: 'A'.repeat(121) })).toThrow('Escreva até 120 caracteres.');
      expect(() => profile.updateYou(ANA, { ...you, city: 'C'.repeat(121) })).toThrow('Escreva até 120 caracteres.');
      expect(() => profile.updateElder(ANA, { ...elderFields, fullName: 'B'.repeat(121) })).toThrow('Escreva até 120 caracteres.');
      expect(db.caregivers.require(ANA).fullName).toBe(before);
      expect(profile.updateYou(ANA, { ...you, fullName: 'A'.repeat(120) })).toBe(true);
    });
  });

  it('só grava o cadastro de quem está na sessão (QAC-001)', () => {
    const { profile, db } = setup(ANA);
    const maria = db.caregivers.require(MARIA);
    expect(() => profile.updateYou(MARIA, { ...you, fullName: 'Maria Trocada Por Outra' })).toThrow(CaregiverOwnershipError);
    expect(() => profile.updateDaily(MARIA, { hours: 1, channel: 'app', whatsapp: '' })).toThrow(CaregiverOwnershipError);
    expect(() => profile.updateElder(MARIA, elderFields)).toThrow(CaregiverOwnershipError);
    expect(db.caregivers.require(MARIA)).toMatchObject({ fullName: maria.fullName, dailyCareHours: maria.dailyCareHours });
  });
});
