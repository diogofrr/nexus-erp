import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '@core/data';
import { countSubscribers } from '@core/rules';
import { configureCoreTest } from '@core/testing/test-helpers';
import { loginAs } from '@shared/ui/testing/dom';
import { CompaniesService, CompanyInput } from './companies.service';
import { PartnerInput, PartnersService } from './partners.service';

const input = (overrides: Partial<PartnerInput> = {}): PartnerInput => ({
  name: 'Ótica Exemplo Nova',
  category: 'optical',
  city: 'Uberlândia',
  contactName: 'Carlos Souza',
  contactEmail: 'carlos@exemplo.com.br',
  discountPercent: 12.5,
  model: 'none',
  notes: '',
  ...overrides,
});

describe('parceiros: gravação pelo banco (M09)', () => {
  let db: Database;
  let service: PartnersService;

  beforeEach(() => {
    ({ db } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' }));
    loginAs('u1');
    service = TestBed.inject(PartnersService);
  });

  it('o seed tem 5 ativos, 1 em validação, 1 em prospecção, 1 suspenso e 1 encerrado (AC-M09-03)', () => {
    const count = (s: string): number => db.partners.count((p) => p.status === s);
    expect([
      count('active'),
      count('legal_ethics_review'),
      count('prospect'),
      count('suspended'),
      count('ended'),
    ]).toEqual([5, 1, 1, 1, 1]);
    expect(service.activeCount()).toBe(5);
  });

  it('a Clínica de Imagem Delta só ativa com as duas validações (AC-M09-01)', () => {
    const delta = db.partners.require('par_0006');
    expect(delta.status).toBe('legal_ethics_review');
    const blocked = service.moveTo('par_0006', 'active');
    expect(blocked).toEqual({
      ok: false,
      message: 'Para ativar falta: validação jurídica e validação ética.',
    });
    expect(service.setValidation('par_0006', 'legal', true).ok).toBe(true);
    expect(service.moveTo('par_0006', 'active').ok).toBe(false);
    expect(service.setValidation('par_0006', 'ethics', true).ok).toBe(true);
    const done = db.partners.require('par_0006');
    expect(done.remuneration.legalValidatedAt).toBe('2026-11-04');
    expect(done.remuneration.ethicsValidatedAt).toBe('2026-11-04');
    expect(service.moveTo('par_0006', 'active').ok).toBe(true);
    expect(db.partners.require('par_0006').status).toBe('active');
    expect(service.activeCount()).toBe(6);
    // Cada passo ficou no log e no histórico da ficha.
    const log = db.accessLog.list().filter((e) => e.entity === 'partner' && e.entityId === 'par_0006');
    expect(log.length).toBe(3);
    expect(service.historyOf('par_0006').some((h) => h.text?.includes('Ativo'))).toBe(true);
  });

  it('desfazer uma validação tira a data; sem remuneração não há o que validar', () => {
    service.setValidation('par_0006', 'legal', true);
    service.setValidation('par_0006', 'legal', false);
    expect(db.partners.require('par_0006').remuneration.legalValidatedAt).toBeUndefined();
    const none = service.setValidation('par_0001', 'legal', true);
    expect(none).toEqual({ ok: false, message: 'Sem remuneração não precisa de validação.' });
  });

  it('cria em Prospecção, valida desconto de 0 a 100 com uma casa e recusa nome repetido', () => {
    const created = service.create(input());
    expect(created.ok).toBe(true);
    expect(created.ok && created.value.status).toBe('prospect');
    expect(db.partners.count()).toBe(10);
    expect(service.create(input()).ok).toBe(false);
    const tooHigh = service.create(input({ name: 'Outro A', discountPercent: 100.5 }));
    expect(tooHigh.ok).toBe(false);
    const decimals = service.create(input({ name: 'Outro B', discountPercent: 12.34 }));
    expect(!decimals.ok && decimals.message).toBe('Use no máximo uma casa decimal.');
    expect(service.create(input({ name: 'Outro C', discountPercent: 0 })).ok).toBe(true);
    expect(service.create(input({ name: 'Outro D', discountPercent: 100 })).ok).toBe(true);
    const badMail = service.create(input({ name: 'Outro E', contactEmail: 'x@gmail.com' }));
    expect(badMail.ok).toBe(false);
  });

  it('trocar o modelo de um parceiro ativo para um com remuneração o devolve à validação (RN-CRT-06)', () => {
    const before = db.partners.require('par_0001');
    const result = service.update(
      'par_0001',
      input({
        name: before.name,
        category: before.category,
        contactName: before.contactName,
        contactEmail: before.contactEmail,
        discountPercent: before.discountPercent,
        model: 'fixed_fee',
        notes: 'Valor fixo mensal combinado.',
      }),
    );
    expect(result.ok && result.value.movedBack).toBe(true);
    const after = db.partners.require('par_0001');
    expect(after.status).toBe('legal_ethics_review');
    expect(after.remuneration.model).toBe('fixed_fee');
    expect(after.remuneration.legalValidatedAt).toBeUndefined();
    // Quem tinha as duas validações as perde ao trocar de modelo.
    const drogaria = db.partners.require('par_0002');
    expect(drogaria.remuneration.legalValidatedAt).toBeDefined();
    service.update(
      'par_0002',
      input({ name: drogaria.name, contactName: drogaria.contactName, contactEmail: drogaria.contactEmail, discountPercent: 12, model: 'fixed_fee' }),
    );
    expect(db.partners.require('par_0002').remuneration.legalValidatedAt).toBeUndefined();
  });

  it('suspende, reativa e encerra; encerrado não anda mais', () => {
    expect(service.moveTo('par_0001', 'suspended').ok).toBe(true);
    expect(service.moveTo('par_0001', 'active').ok).toBe(true);
    expect(service.moveTo('par_0001', 'ended').ok).toBe(true);
    expect(service.moveTo('par_0001', 'active').ok).toBe(false);
    expect(service.update('par_0001', input({ name: 'Farmácia Bem-Estar' })).ok).toBe(false);
  });

  it('o uso do cartão do parceiro mostra só o código do cuidador', () => {
    const usages = service.usagesOf('par_0001');
    const total = db.cardUsages.count();
    expect(total).toBe(25);
    expect(db.cardUsages.count((u) => u.partnerId === 'par_0001')).toBe(usages.length);
    usages.forEach((u) => expect(service.codeOfCard(u.cardId)).toMatch(/^CUI-\d{4}$/));
    const totals = service.totalsOf('par_0001');
    expect(totals.uses).toBe(usages.length);
    expect(totals.discountCents).toBe(usages.reduce((s, u) => s + u.discountCents, 0));
  });

  it('o atendimento só consulta: nenhuma gravação passa', () => {
    TestBed.inject(PartnersService);
    loginAs('u7');
    expect(service.canWrite()).toBe(false);
    expect(service.create(input()).ok).toBe(false);
    expect(service.moveTo('par_0001', 'suspended').ok).toBe(false);
    expect(service.setValidation('par_0006', 'legal', true).ok).toBe(false);
    expect(db.partners.require('par_0001').status).toBe('active');
  });
});

const company = (overrides: Partial<CompanyInput> = {}): CompanyInput => ({
  companyName: 'Transportes Exemplo Ltda.',
  cnpj: '00.000.900/0001-00',
  hrContactName: 'Patrícia Lima',
  hrContactEmail: 'rh@exemplo.com.br',
  planId: 'cuida',
  seats: 3,
  seatPriceCents: 9900,
  ...overrides,
});

describe('canal corporativo: vagas e colaboradores (M09)', () => {
  let db: Database;
  let service: CompaniesService;

  beforeEach(() => {
    ({ db } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' }));
    loginAs('u1');
    service = TestBed.inject(CompaniesService);
  });

  it('Exemplo Logística tem 5 vagas, 3 ativas e 2 convites; convidar a 6ª é bloqueado (AC-M09-04)', () => {
    const counts = service.countsOf('corp_0001');
    expect(counts).toEqual({ contracted: 5, active: 3, invited: 2, occupied: 5, free: 0 });
    const blocked = service.invite('corp_0001', 'novo.colaborador@exemplo.com.br');
    expect(blocked.ok).toBe(false);
    expect(!blocked.ok && blocked.message).toContain('As 5 vagas contratadas já estão ocupadas');
    // Cancela um convite e a vaga volta; ao convidar de novo, a próxima é bloqueada.
    const invited = service.seatsOf('corp_0001').find((s) => s.status === 'invited');
    expect(service.removeSeat(invited?.id as string).ok).toBe(true);
    expect(service.countsOf('corp_0001').free).toBe(1);
    expect(service.invite('corp_0001', 'novo.colaborador@exemplo.com.br').ok).toBe(true);
    expect(service.invite('corp_0001', 'outro.colaborador@exemplo.com.br').ok).toBe(false);
    expect(db.corporateSeats.count((s) => s.corporateAccountId === 'corp_0001' && s.status !== 'removed')).toBe(5);
  });

  it('convite exige e-mail fictício e não repete o e-mail na mesma empresa', () => {
    const invited = service.seatsOf('corp_0001').find((s) => s.status === 'invited');
    service.removeSeat(invited?.id as string);
    expect(service.invite('corp_0001', 'pessoa@gmail.com').ok).toBe(false);
    const other = service.seatsOf('corp_0001').find((s) => s.status === 'invited');
    expect(service.invite('corp_0001', (other?.invitedEmail as string).toUpperCase()).ok).toBe(false);
  });

  it('os 3 colaboradores são assinantes Cuida pagos pela empresa e contam como assinantes (AC-M09-05)', () => {
    const subs = db.subscriptions.query((s) => s.payer === 'corporate');
    expect(subs).toHaveLength(3);
    subs.forEach((s) => {
      expect(s.planId).toBe('cuida');
      expect(s.corporateAccountId).toBe('corp_0001');
    });
    expect(countSubscribers(db.subscriptions.all()).corporate).toBe(3);
  });

  it('a adesão agregada fica oculta com menos de 5 colaboradores ativos (RN-CORP-08)', () => {
    const adhesion = service.adhesionOf('corp_0001');
    expect(adhesion.counts.active).toBe(3);
    expect(adhesion.participation).toEqual({ kind: 'private' });
  });

  it('com 5 colaboradores ativos a adesão agregada aparece, e a participação com menos de 5 diz "menos de 5"', () => {
    db.activityEnrollments.removeWhere((e) => e.caregiverId === 'cg_0004' || e.caregiverId === 'cg_0005');
    const invited = service.seatsOf('corp_0001').filter((s) => s.status === 'invited');
    expect(service.registerAdhesion(invited[0]?.id as string, 'CUI-0004').ok).toBe(true);
    expect(service.registerAdhesion(invited[1]?.id as string, 'CUI-0005').ok).toBe(true);
    const adhesion = service.adhesionOf('corp_0001');
    expect(adhesion.counts.active).toBe(5);
    // Os 3 colaboradores do seed participam de um grupo: 3 pessoas são menos de 5.
    expect(adhesion.participation.kind).toBe('aggregate');
    if (adhesion.participation.kind === 'aggregate') {
      expect(adhesion.participation.value.sufficient).toBe(false);
    }
    ['cg_0004', 'cg_0005'].forEach((caregiverId) =>
      db.activityEnrollments.create({
        activityId: 'act_0002',
        caregiverId,
        status: 'enrolled',
        attendance: [],
      }),
    );
    const next = service.adhesionOf('corp_0001').participation;
    expect(next.kind === 'aggregate' && next.value.sufficient && next.value.value).toBe(5);
  });

  it('registrar a adesão liga a vaga ao cuidador pelo código, passa ao plano da empresa e emite o cartão', () => {
    const invited = service.seatsOf('corp_0001').find((s) => s.status === 'invited');
    const seatId = invited?.id as string;
    expect(service.registerAdhesion(seatId, 'CUI-9999').ok).toBe(false);
    // Já está em uma vaga de empresa.
    expect(service.adhesionCodeError('CUI-0021')).toBe('Este colaborador já está em uma vaga de empresa.');
    const caregiver = db.caregivers.require('cg_0004');
    expect(db.subscriptions.find((s) => s.caregiverId === caregiver.id)?.planId).toBe('livre');
    expect(db.benefitCards.find((c) => c.caregiverId === caregiver.id)).toBeUndefined();
    const before = db.planChanges.count();
    const result = service.registerAdhesion(seatId, 'cui-0004');
    expect(result.ok).toBe(true);
    const seat = db.corporateSeats.require(seatId);
    expect(seat.status).toBe('active');
    expect(seat.caregiverId).toBe('cg_0004');
    const sub = db.subscriptions.find((s) => s.caregiverId === 'cg_0004');
    expect(sub?.planId).toBe('cuida');
    expect(sub?.payer).toBe('corporate');
    expect(sub?.corporateAccountId).toBe('corp_0001');
    expect(db.benefitCards.find((c) => c.caregiverId === 'cg_0004')?.status).toBe('active');
    expect(db.caregivers.require('cg_0004').corporateAccountId).toBe('corp_0001');
    expect(db.planChanges.count()).toBe(before + 1);
    expect(countSubscribers(db.subscriptions.all()).corporate).toBe(4);
  });

  it('remover um colaborador ativo o leva ao Livre e inativa o cartão (RN-CRT-03)', () => {
    const seat = service.seatsOf('corp_0001').find((s) => s.caregiverId === 'cg_0021');
    expect(db.benefitCards.find((c) => c.caregiverId === 'cg_0021')?.status).toBe('active');
    expect(service.removeSeat(seat?.id as string).ok).toBe(true);
    const sub = db.subscriptions.find((s) => s.caregiverId === 'cg_0021');
    expect(sub?.planId).toBe('livre');
    expect(sub?.payer).toBe('self');
    expect(sub?.corporateAccountId).toBeUndefined();
    const card = db.benefitCards.find((c) => c.caregiverId === 'cg_0021');
    expect(card?.status).toBe('inactive');
    expect(card?.inactivatedAt).toBe('2026-11-04');
    expect(db.caregivers.require('cg_0021').corporateAccountId).toBeUndefined();
    expect(service.countsOf('corp_0001').active).toBe(2);
  });

  it('encerrar o contrato passa os 3 colaboradores ao Livre e inativa os cartões (AC-M09-07)', () => {
    const preview = service.endPreview('corp_0001');
    expect(preview).toEqual({ activeSeats: 3, invitedSeats: 2, cardsToInactivate: 3 });
    const result = service.endContract('corp_0001');
    expect(result.ok && result.value.moved).toBe(3);
    ['cg_0021', 'cg_0022', 'cg_0023'].forEach((id) => {
      const sub = db.subscriptions.find((s) => s.caregiverId === id);
      expect(sub?.planId, id).toBe('livre');
      expect(sub?.payer, id).toBe('self');
      expect(db.benefitCards.find((c) => c.caregiverId === id)?.status, id).toBe('inactive');
    });
    const account = db.corporateAccounts.require('corp_0001');
    expect(account.status).toBe('ended');
    expect(account.endDate).toBe('2026-11-04');
    expect(service.seatsOf('corp_0001')).toHaveLength(0);
    expect(countSubscribers(db.subscriptions.all()).corporate).toBe(0);
    expect(service.invite('corp_0001', 'x@exemplo.com.br').ok).toBe(false);
    expect(service.endContract('corp_0001').ok).toBe(false);
  });

  it('cria empresa em Prospecção, segue o funil e só ativa com vagas e preço', () => {
    const created = service.create(company());
    expect(created.ok).toBe(true);
    const id = created.ok ? created.value.id : '';
    expect(db.corporateAccounts.require(id).status).toBe('prospect');
    expect(service.moveTo(id, 'active').ok).toBe(false);
    expect(service.moveTo(id, 'negotiation').ok).toBe(true);
    expect(service.moveTo(id, 'active').ok).toBe(true);
    expect(db.corporateAccounts.require(id).startDate).toBe('2026-11-04');
    expect(service.create(company()).ok).toBe(false);
    expect(service.create(company({ cnpj: '11.222.333/0001-81' })).ok).toBe(false);
  });

  it('as vagas não ficam abaixo das ocupadas e trocar o plano troca o dos colaboradores', () => {
    const account = db.corporateAccounts.require('corp_0001');
    const base: CompanyInput = {
      companyName: account.companyName,
      cnpj: account.cnpj,
      hrContactName: account.hrContactName,
      hrContactEmail: account.hrContactEmail,
      planId: account.planId,
      seats: 4,
      seatPriceCents: account.seatPriceCents,
    };
    const low = service.update('corp_0001', base);
    expect(!low.ok && low.message).toContain('ocupadas');
    expect(service.update('corp_0001', { ...base, seats: 8, planId: 'sustenta' }).ok).toBe(true);
    expect(db.corporateAccounts.require('corp_0001').seats).toBe(8);
    expect(db.subscriptions.find((s) => s.caregiverId === 'cg_0022')?.planId).toBe('sustenta');
  });

  it('o atendimento só consulta', () => {
    loginAs('u7');
    expect(service.canWrite()).toBe(false);
    expect(service.create(company()).ok).toBe(false);
    expect(service.endContract('corp_0001').ok).toBe(false);
    expect(service.removeSeat('seat_0001').ok).toBe(false);
  });
});
