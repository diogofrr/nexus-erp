import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ConsentService } from '@core/privacy';
import { configureCoreTest } from '@core/testing/test-helpers';
import { loginAs } from '../../../shared/ui/testing/dom';
import { CaregiverError, CaregiverFields, CaregiverService } from './caregiver.service';

const ANA = 'cg_0001';

function setup() {
  const env = configureCoreTest({ seed: true, time: '10:00' });
  loginAs('u7');
  const service = TestBed.inject(CaregiverService);
  const fieldsOf = (id: string): CaregiverFields => {
    const c = env.db.caregivers.require(id);
    return {
      fullName: c.fullName,
      birthDate: c.birthDate,
      email: c.email,
      phone: c.phone,
      ...(c.whatsapp ? { whatsapp: c.whatsapp } : {}),
      relationship: c.relationship,
      sex: c.sex,
      city: c.city,
      dailyCareHours: c.dailyCareHours,
      preferredChannel: c.preferredChannel,
      digitalLiteracy: c.digitalLiteracy,
    };
  };
  return { ...env, service, fieldsOf, consents: TestBed.inject(ConsentService) };
}

describe('CaregiverService.update: as mesmas regras do Meu perfil na edição pela equipe (QAC-005, 006, 015)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('escolher o WhatsApp sem a autorização de contato por WhatsApp é recusado, com a frase pronta para a tela', () => {
    const { service, fieldsOf, consents, db } = setup();
    consents.revoke(ANA, 'whatsapp_contact', { channel: 'in_person', registeredByUserId: 'u7' });
    const before = db.caregivers.require(ANA).preferredChannel;
    expect(before).not.toBe('whatsapp');
    const attempt = () => service.update(ANA, { ...fieldsOf(ANA), whatsapp: '(34) 90000-0000', preferredChannel: 'whatsapp' });
    expect(attempt).toThrow(CaregiverError);
    expect(attempt).toThrow('Para usar o WhatsApp como canal preferido, o cuidador precisa autorizar o contato por WhatsApp.');
    expect(db.caregivers.require(ANA).preferredChannel).toBe(before);
  });

  it('com a autorização o WhatsApp é aceito; cadastro antigo que já estava com o WhatsApp segue editável', () => {
    const { service, fieldsOf, consents, db } = setup();
    consents.revoke(ANA, 'whatsapp_contact', { channel: 'in_person', registeredByUserId: 'u7' });
    consents.grant(ANA, 'whatsapp_contact', { channel: 'in_person', registeredByUserId: 'u7' });
    service.update(ANA, { ...fieldsOf(ANA), whatsapp: '(34) 90000-0000', preferredChannel: 'whatsapp' });
    expect(db.caregivers.require(ANA).preferredChannel).toBe('whatsapp');
    // Dado de antes da regra: WhatsApp preferido sem autorização. Corrigir o telefone não pode travar.
    db.consents.updateWhere((c) => c.caregiverId === ANA && c.key === 'whatsapp_contact', { status: 'pending' });
    expect(() => service.update(ANA, { ...fieldsOf(ANA), city: 'Uberaba' })).not.toThrow();
  });

  it('mudar as horas por dia gera a nova avaliação da ARBE, sem duplicar o alerta aberto do mesmo nível', () => {
    const { service, fieldsOf, db } = setup();
    db.arbeAlerts.removeWhere((a) => a.caregiverId === ANA);
    service.update(ANA, { ...fieldsOf(ANA), dailyCareHours: 20 });
    expect(db.arbeAlerts.count((a) => a.caregiverId === ANA)).toBe(1);
    service.update(ANA, { ...fieldsOf(ANA), dailyCareHours: 22 });
    expect(db.arbeAlerts.count((a) => a.caregiverId === ANA && a.status !== 'discarded')).toBe(1);
  });

  it('sem mudar as horas não há nova avaliação, e sem a autorização de saúde também não (RN-ARBE-09)', () => {
    const { service, fieldsOf, consents, db } = setup();
    db.arbeAlerts.removeWhere((a) => a.caregiverId === ANA);
    service.update(ANA, { ...fieldsOf(ANA), city: 'Uberaba' });
    expect(db.arbeAlerts.count((a) => a.caregiverId === ANA)).toBe(0);
    consents.revoke(ANA, 'health_data', { channel: 'in_person', registeredByUserId: 'u7' });
    service.update(ANA, { ...fieldsOf(ANA), dailyCareHours: 24 });
    expect(db.arbeAlerts.count((a) => a.caregiverId === ANA)).toBe(0);
  });

  it('data de nascimento que não existe e nome longo demais são recusados; o mesmo na pessoa idosa', () => {
    const { service, fieldsOf } = setup();
    expect(() => service.update(ANA, { ...fieldsOf(ANA), birthDate: '1981-02-30' })).toThrow('Escolha uma data que exista.');
    expect(() => service.update(ANA, { ...fieldsOf(ANA), fullName: 'A'.repeat(121) })).toThrow('Escreva até 120 caracteres.');
    expect(() => service.updateElder(ANA, { fullName: 'Dona Alice', birthDate: '2026-02-30', dependency: 'partial' })).toThrow('Escolha uma data que exista.');
    expect(() => service.updateElder(ANA, { fullName: 'B'.repeat(121), birthDate: '1940-05-10', dependency: 'partial' })).toThrow('Escreva até 120 caracteres.');
  });
});
