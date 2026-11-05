import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { configureCoreTest } from '../testing/test-helpers';
import { CaregiverNetworkService } from './caregiver-network.service';

describe('rede vista pelo cuidador (RN-REDE-10, 18, 19, 30, RN-ARP-02, 04, 16, RN-LGPD-13)', () => {
  let db: Database;
  let clock: Clock;
  let network: CaregiverNetworkService;

  beforeEach(() => {
    const env = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
    db = env.db;
    clock = env.clock;
    network = TestBed.inject(CaregiverNetworkService);
  });

  it('só aparecem prestadores ativos ou em monitoramento (suspenso, candidato, reprovado e descredenciado não)', () => {
    const ids = network.searchable().map((p) => p.id);
    ['prv_10', 'prv_14', 'prv_16', 'prv_17', 'prv_18', 'prv_19'].forEach((id) => expect(ids).not.toContain(id));
    ['prv_03', 'prv_04', 'prv_06', 'prv_09', 'prv_12'].forEach((id) => expect(ids).toContain(id));
    expect(network.viewOf('prv_14')).toBeUndefined();
    expect(network.viewOf('prv_16')).toBeUndefined();
    expect(network.viewOf('prv_99')).toBeUndefined();
    expect(network.viewOf('prv_03')?.name).toBe('Fisio em Casa Uberlândia');
  });

  it('a contagem por necessidade segue o seed: Fisioterapia 5, Cuidador(a) 3, Farmácia 2, uma só em quatro, nenhuma em três', () => {
    expect(network.countIn('physiotherapy')).toBe(5);
    expect(network.countIn('professional_caregiver')).toBe(3);
    expect(network.countIn('pharmacy')).toBe(2);
    (['home_care', 'nursing', 'psychology', 'legal'] as const).forEach((c) => expect(network.countIn(c)).toBe(1));
    (['clinic', 'nutrition', 'specialized_service'] as const).forEach((c) => expect(network.countIn(c)).toBe(0));
  });

  it('em destaque vem primeiro e os demais seguem em ordem alfabética, sem tirar ninguém (S-08, RN-REDE-19)', () => {
    const list = network.search({ category: 'physiotherapy' });
    expect(list.map((p) => p.id)).toEqual(['prv_02', 'prv_11', 'prv_01', 'prv_12', 'prv_03']);
    expect(list.slice(0, 3).every((p) => p.highlight)).toBe(true);
    expect(list.slice(3).every((p) => !p.highlight)).toBe(true);
    const firstGroup = list.slice(0, 3).map((p) => p.name);
    expect(firstGroup).toEqual([...firstGroup].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('a ficha pública NÃO carrega faixa de monitoramento, taxa de recusa, comissão nem disponibilidade (RN-REDE-30)', () => {
    const view = network.viewOf('prv_04');
    expect(view).toBeDefined();
    const keys = Object.keys(view ?? {}).sort();
    expect(keys).toEqual(
      ['average', 'canRequest', 'category', 'city', 'conditions', 'councilLabel', 'evaluationCount', 'highlight', 'homeCare', 'id', 'name', 'phone', 'specialtyLabel'].sort(),
    );
    const text = JSON.stringify(view).toLowerCase();
    ['monitoring', 'refus', 'recusa', 'commission', 'comiss', 'availability', 'band', 'risco'].forEach((w) => expect(text).not.toContain(w));
  });

  it('a nota só aparece com 5 avaliações ou mais (RN-ARP-04)', () => {
    expect(network.viewOf('prv_13')?.average).toBeNull();
    expect(network.viewOf('prv_13')?.evaluationCount).toBeLessThan(5);
    expect(network.viewOf('prv_08')?.average).toBe(4.5);
    expect(network.viewOf('prv_15')?.evaluationCount).toBe(5);
    expect(network.viewOf('prv_15')?.average).not.toBeNull();
  });

  it('o registro aparece com o conselho e o rótulo de fictício', () => {
    expect(network.viewOf('prv_01')?.councilLabel).toBe('CREFITO-MG 00001-F (fictício)');
    expect(network.viewOf('prv_08')?.councilLabel).toBeNull();
  });

  it('filtra por atender em casa e por nome, sem acento e sem diferenciar maiúscula; sem filtro devolve vazio', () => {
    expect(network.search({ category: 'physiotherapy', homeOnly: true }).map((p) => p.id).sort()).toEqual(['prv_01', 'prv_03']);
    expect(network.search({ name: 'sonia' }).map((p) => p.id)).toEqual(['prv_12']);
    expect(network.search({ name: 'RENATA' }).map((p) => p.id)).toEqual(['prv_01']);
    expect(network.search({ name: 'zzzz' })).toEqual([]);
    expect(network.search({})).toEqual([]);
    expect(network.search({ category: null, name: '  ' })).toEqual([]);
  });

  it('só o profissional com a cláusula de proteção de dados recebe pedido pelo app (S-19)', () => {
    expect(network.viewOf('prv_01')?.canRequest).toBe(true);
    expect(network.viewOf('prv_20')?.canRequest).toBe(false);
  });

  describe('pedir um serviço (RN-REDE-25 e 26)', () => {
    it('qualquer plano pede, e o pedido nasce "enviado" sem dado de saúde nenhum', () => {
      const livre = network.createRequest('cg_0004', { providerId: 'prv_01', need: '  Sessões de fisioterapia  ', modality: 'home' });
      expect(livre.ok).toBe(true);
      const essencial = network.createRequest('cg_0002', { providerId: 'prv_01', need: 'Fisioterapia para a minha mãe', modality: 'at_provider' });
      expect(essencial.ok).toBe(true);
      const created = db.serviceRequests.find((r) => r.caregiverId === 'cg_0004' && r.providerId === 'prv_01' && r.status === 'requested');
      expect(created).toMatchObject({ need: 'Sessões de fisioterapia', modality: 'home', status: 'requested', specialty: 'physiotherapy' });
      expect(Object.keys(created ?? {}).sort()).toEqual(
        ['caregiverId', 'createdAt', 'id', 'modality', 'need', 'providerId', 'requestedAt', 'specialty', 'status', 'updatedAt'].sort(),
      );
    });

    it('recusa profissional suspenso, inexistente ou sem a cláusula, com a frase do cuidador', () => {
      const suspended = network.createRequest('cg_0002', { providerId: 'prv_14', need: 'Nutrição', modality: 'at_provider' });
      expect(suspended).toEqual({ ok: false, error: 'Não encontramos este profissional.' });
      const ghost = network.createRequest('cg_0002', { providerId: 'prv_99', need: 'Nutrição', modality: 'at_provider' });
      expect(ghost).toEqual({ ok: false, error: 'Não encontramos este profissional.' });
      const noClause = network.createRequest('cg_0002', { providerId: 'prv_20', need: 'Cuidadora', modality: 'home' });
      expect(noClause).toEqual({ ok: false, error: 'No momento não é possível pedir este profissional pelo app. A equipe pode ajudar.' });
    });

    it('confere a necessidade e o local junto do campo', () => {
      expect(network.createRequest('cg_0002', { providerId: 'prv_01', need: '   ', modality: 'home' })).toMatchObject({ ok: false, field: 'need' });
      expect(network.createRequest('cg_0002', { providerId: 'prv_01', need: 'Fisioterapia', modality: null })).toMatchObject({ ok: false, field: 'modality' });
      const home = network.createRequest('cg_0002', { providerId: 'prv_02', need: 'Fisioterapia', modality: 'home' });
      expect(home).toMatchObject({ ok: false, field: 'modality' });
    });

    it('não duplica um pedido em andamento com o mesmo profissional', () => {
      expect(network.createRequest('cg_0002', { providerId: 'prv_01', need: 'Fisioterapia', modality: 'home' }).ok).toBe(true);
      expect(network.createRequest('cg_0002', { providerId: 'prv_01', need: 'Outra', modality: 'home' })).toEqual({
        ok: false,
        error: 'Você já tem um pedido em andamento com este profissional.',
      });
      expect(network.openRequestWith('cg_0002', 'prv_01')?.status).toBe('requested');
      expect(network.awaitingCount('cg_0002')).toBe(1);
    });

    it('cancela só o pedido enviado ou aceito, e só o dono', () => {
      const created = network.createRequest('cg_0002', { providerId: 'prv_01', need: 'Fisioterapia', modality: 'home' });
      const id = created.ok ? created.value.id : '';
      expect(network.cancelRequest('cg_0004', id)).toEqual({ ok: false, error: 'Não encontramos este pedido.' });
      const cancelled = network.cancelRequest('cg_0002', id);
      expect(cancelled.ok && cancelled.value.status).toBe('cancelled_by_user');
      expect(network.cancelRequest('cg_0002', id)).toEqual({ ok: false, error: 'Este pedido não pode mais ser cancelado.' });
      expect(network.openRequestWith('cg_0002', 'prv_01')).toBeUndefined();
    });
  });

  describe('avaliar o serviço (RN-ARP-02 e 16)', () => {
    it('Rita tem um serviço concluído sem avaliação; sem as duas notas a avaliação não sai', () => {
      expect(network.toEvaluateCount('cg_0008')).toBe(1);
      expect(network.evaluate('cg_0008', 'srq_0126', { technical: null, punctuality: 4 })).toMatchObject({ ok: false, field: 'technical' });
      expect(network.evaluate('cg_0008', 'srq_0126', { technical: 5, punctuality: null })).toMatchObject({ ok: false, field: 'punctuality' });
      expect(network.evaluate('cg_0008', 'srq_0126', { technical: 6, punctuality: 4 })).toMatchObject({ ok: false, field: 'technical' });
    });

    it('grava a nota como a média das duas, marca "avaliado" e dá 7 dias para corrigir', () => {
      const result = network.evaluate('cg_0008', 'srq_0126', { technical: 5, punctuality: 4, comment: '  Foi pontual.  ' });
      expect(result.ok).toBe(true);
      const request = db.serviceRequests.require('srq_0126');
      expect(request.status).toBe('evaluated');
      const evaluation = db.providerEvaluations.require(request.evaluationId ?? '');
      expect(evaluation).toMatchObject({ technicalQuality: 5, punctualityCourtesy: 4, score: 4.5, comment: 'Foi pontual.', editableUntil: '2026-11-11', caregiverId: 'cg_0008' });
      expect(network.toEvaluateCount('cg_0008')).toBe(0);
    });

    it('uma avaliação por serviço e só do dono', () => {
      expect(network.evaluate('cg_0002', 'srq_0126', { technical: 5, punctuality: 5 })).toEqual({ ok: false, error: 'Não encontramos este serviço.' });
      expect(network.evaluate('cg_0008', 'srq_0126', { technical: 5, punctuality: 5 }).ok).toBe(true);
      const again = network.evaluate('cg_0008', 'srq_0126', { technical: 1, punctuality: 1 });
      expect(again.ok).toBe(false);
      expect(again.ok === false && again.error).toContain('já foi avaliado');
      expect(db.providerEvaluations.count((e) => e.serviceRequestId === 'srq_0126')).toBe(1);
    });

    it('só avalia serviço concluído', () => {
      const created = network.createRequest('cg_0002', { providerId: 'prv_01', need: 'Fisioterapia', modality: 'home' });
      const id = created.ok ? created.value.id : '';
      expect(network.evaluate('cg_0002', id, { technical: 5, punctuality: 5 })).toEqual({ ok: false, error: 'Só dá para avaliar um serviço concluído.' });
    });

    it('corrige em até 7 dias (inclusive) e depois diz que o prazo acabou', () => {
      network.evaluate('cg_0008', 'srq_0126', { technical: 5, punctuality: 4 });
      clock.setSimulated('2026-11-11', '12:00');
      const edited = network.correctEvaluation('cg_0008', 'srq_0126', { technical: 3, punctuality: 3, comment: '' });
      expect(edited.ok).toBe(true);
      const view = network.ordersOf('cg_0008').find((o) => o.request.id === 'srq_0126');
      expect(view?.evaluation).toMatchObject({ technical: 3, punctuality: 3, canEdit: true, editableUntil: '2026-11-11' });
      expect(view?.evaluation?.comment).toBeUndefined();
      expect(db.providerEvaluations.require(view?.evaluation?.id ?? '').score).toBe(3);
      clock.setSimulated('2026-11-12', '12:00');
      expect(network.ordersOf('cg_0008').find((o) => o.request.id === 'srq_0126')?.evaluation?.canEdit).toBe(false);
      expect(network.correctEvaluation('cg_0008', 'srq_0126', { technical: 1, punctuality: 1 })).toEqual({ ok: false, error: 'Prazo de correção encerrado.' });
    });

    it('não corrige avaliação de outra pessoa nem serviço sem avaliação', () => {
      network.evaluate('cg_0008', 'srq_0126', { technical: 5, punctuality: 4 });
      expect(network.correctEvaluation('cg_0002', 'srq_0126', { technical: 1, punctuality: 1 }).ok).toBe(false);
      expect(network.correctEvaluation('cg_0004', 'srq_0135', { technical: 1, punctuality: 1 }).ok).toBe(false);
    });
  });

  it('os pedidos vêm do mais recente ao mais antigo e mostram só a avaliação do próprio cuidador', () => {
    const orders = network.ordersOf('cg_0003');
    expect(orders.map((o) => o.request.id).sort()).toEqual(['srq_0024', 'srq_0100', 'srq_0196']);
    const dates = orders.map((o) => o.request.requestedAt);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
    orders.filter((o) => o.request.status === 'evaluated').forEach((o) => {
      const allowed = ['canEdit', 'comment', 'editableUntil', 'id', 'punctuality', 'technical'];
      expect(Object.keys(o.evaluation ?? {}).every((k) => allowed.includes(k))).toBe(true);
      expect(o.evaluation).toBeDefined();
    });
  });

  it('um pedido antigo a um prestador que saiu da busca mantém o nome, mas sem levar à ficha', () => {
    const order = network.ordersOf('cg_0024').find((o) => o.request.providerId === 'prv_14');
    expect(order?.providerName).toBe('Nutri Camila Rezende');
    expect(order?.providerSearchable).toBe(false);
  });
});
