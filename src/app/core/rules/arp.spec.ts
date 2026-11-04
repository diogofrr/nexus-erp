import { describe, expect, it } from 'vitest';
import { addDays } from '../clock/date-utils';
import { Accreditation, ChecklistKey, Provider, ProviderDocument } from '../models/network';
import {
  ACCREDITATION_CHECKLIST_KEYS,
  arpBand,
  availabilityDropSignal,
  canActivateProvider,
  checkAccreditationApproval,
  documentSuspensionDate,
  evaluationEditableUntil,
  evaluationScore,
  isAuditDue,
  isDocumentExpired,
  isSearchable,
  neutralBandLabel,
  networkAverage,
  nextAuditDate,
  providerAverage,
  providerAverageFromSum,
  providerMaySeeCaregiverData,
  refusalStats,
  searchProviders,
  shouldSuspendForExpiredDocument,
  shouldSuspendNow,
  summarizeProvider,
} from './arp';

describe('ARP: notas e média (RN-ARP-02 a 04, 15)', () => {
  it('nota da avaliação é a média das duas notas (5 e 4 resultam 4,5)', () => {
    expect(evaluationScore(5, 4)).toBe(4.5);
    expect(evaluationScore(3, 3)).toBe(3);
  });

  it('a média só existe com 5 ou mais avaliações', () => {
    expect(providerAverageFromSum(40, 4)).toBeNull();
    expect(providerAverageFromSum(40, 5)).toBe(4);
    expect(providerAverageFromSum(0, 0)).toBeNull();
  });

  it('arredonda a 2 casas, meio para cima, ANTES de classificar (4,495 vira 4,50 e 3,995 vira 4,00)', () => {
    expect(providerAverageFromSum(899, 100)).toBe(4.5); // 899 / 200 = 4,495
    expect(providerAverageFromSum(799, 100)).toBe(4); // 799 / 200 = 3,995
    expect(providerAverageFromSum(898, 100)).toBe(4.49); // 898 / 200 = 4,49
    expect(arpBand(providerAverageFromSum(899, 100), 0)).toBe('excellence');
    expect(arpBand(providerAverageFromSum(799, 100), 0)).toBe('alert');
  });

  it('os valores da tabela de prestadores batem (5.8)', () => {
    const table: [number, number, number][] = [
      [12, 116, 4.83],
      [9, 83, 4.61],
      [8, 68, 4.25],
      [7, 58, 4.14],
      [10, 94, 4.7],
      [6, 53, 4.42],
      [14, 137, 4.89],
      [6, 54, 4.5],
      [5, 40, 4],
      [7, 50, 3.57],
      [6, 52, 4.33],
      [8, 69, 4.31],
      [5, 46, 4.6],
      [6, 36, 3],
    ];
    table.forEach(([count, sum, average]) =>
      expect(providerAverageFromSum(sum, count), `${count} avaliações`).toBe(average),
    );
  });

  it('média a partir da lista de avaliações', () => {
    const evals = [5, 5, 4, 4, 5].map((n) => ({
      technicalQuality: n as 5,
      punctualityCourtesy: 5 as const,
    }));
    expect(providerAverage(evals)).toBe(4.8);
    expect(providerAverage(evals.slice(0, 4))).toBeNull();
  });
});

describe('ARP: faixas (RN-ARP-06 a 08; AC-M08-03, 04)', () => {
  it('excelência a partir de 4,5; alerta de 4,0 a menos de 4,5; abaixo de 4,0 descredencia', () => {
    expect(arpBand(4.5, 0)).toBe('excellence');
    expect(arpBand(4.49, 0)).toBe('alert');
    expect(arpBand(4.0, 0)).toBe('alert');
    expect(arpBand(3.99, 0)).toBe('deaccreditation');
    expect(arpBand(null, 0)).toBe('no_average');
  });

  it('3 ou mais reclamações graves descredenciam mesmo com média alta ou sem média; 2 não', () => {
    expect(arpBand(4.3, 3)).toBe('deaccreditation');
    expect(arpBand(4.3, 2)).toBe('alert');
    expect(arpBand(null, 3)).toBe('deaccreditation');
    expect(arpBand(null, 2)).toBe('no_average');
  });

  it('entrar em descredenciamento suspende na hora e informa o gatilho', () => {
    expect(shouldSuspendNow('deaccreditation')).toBe(true);
    expect(shouldSuspendNow('alert')).toBe(false);
    const evals = new Array(5).fill({ technicalQuality: 3, punctualityCourtesy: 3 });
    expect(summarizeProvider(evals, 0)).toMatchObject({
      average: 3,
      band: 'deaccreditation',
      trigger: 'average_below_4',
    });
    expect(summarizeProvider(evals, 3)).toMatchObject({ trigger: 'grave_complaints' });
    expect(summarizeProvider([], 0)).toMatchObject({ band: 'no_average', trigger: null });
  });

  it('nome da faixa em linguagem neutra para o portal (RN-ARP-18)', () => {
    expect(neutralBandLabel('excellence')).toBe('Em destaque');
    expect(neutralBandLabel('alert')).toBe('Em acompanhamento');
    expect(neutralBandLabel('deaccreditation')).toBe('Em acompanhamento');
  });
});

describe('ARP: auditoria, rede e prazos', () => {
  it('auditoria quinzenal: a próxima vence 15 dias depois (AC-M15-05)', () => {
    expect(nextAuditDate('2026-10-21')).toBe('2026-11-05');
    expect(isAuditDue('2026-10-21', '2026-11-04')).toBe(false);
    expect(isAuditDue('2026-10-21', '2026-11-05')).toBe(true);
    expect(isAuditDue(undefined, '2026-11-04')).toBe(true);
  });

  it('a avaliação pode ser corrigida em até 7 dias', () => {
    expect(evaluationEditableUntil('2026-11-04')).toBe('2026-11-11');
  });

  it('média da rede ponderada pelo número de avaliações, só dos prestadores avaliáveis (K22)', () => {
    expect(
      networkAverage([
        { scoreSum: 116, evaluationCount: 12 },
        { scoreSum: 40, evaluationCount: 5 },
        { scoreSum: 27, evaluationCount: 3 }, // sem média: fora
      ]),
    ).toBe(4.59);
    expect(networkAverage([{ scoreSum: 10, evaluationCount: 2 }])).toBeNull();
  });
});

describe('ARP: taxa de recusa e disponibilidade (RN-REDE-27 a 29)', () => {
  const now = '2026-11-04T12:00:00-03:00';
  const request = (
    status: 'requested' | 'refused_by_provider' | 'cancelled_by_provider' | 'completed',
    daysAgo: number,
    providerId = 'p1',
  ) => ({
    providerId,
    status,
    requestedAt: `${addDays('2026-11-04', -daysAgo)}T10:00:00-03:00`,
  });

  it('5 de 8 resulta 62,5% com selo de risco de saída', () => {
    const requests = [
      ...[
        'refused_by_provider',
        'cancelled_by_provider',
        'refused_by_provider',
        'cancelled_by_provider',
        'refused_by_provider',
      ].map((s, i) => request(s as 'refused_by_provider', i + 1)),
      request('completed', 1),
      request('requested', 2),
      request('completed', 3),
    ];
    expect(refusalStats(requests, 'p1', now)).toEqual({
      received: 8,
      refusedOrCancelledByProvider: 5,
      percent: 62.5,
      exitRisk: true,
    });
  });

  it('30% exatos com 10 solicitações tem selo (limiar); 28,6% não tem', () => {
    const ten = [
      ...new Array(3).fill(0).map((_, i) => request('refused_by_provider', i + 1)),
      ...new Array(7).fill(0).map((_, i) => request('completed', i + 1)),
    ];
    expect(refusalStats(ten, 'p1', now)).toMatchObject({ percent: 30, exitRisk: true });
    const seven = [
      ...new Array(2).fill(0).map((_, i) => request('refused_by_provider', i + 1)),
      ...new Array(5).fill(0).map((_, i) => request('completed', i + 1)),
    ];
    expect(refusalStats(seven, 'p1', now)).toMatchObject({ percent: 28.6, exitRisk: false });
  });

  it('exige no mínimo 5 solicitações para o selo e ignora solicitações de outros prestadores', () => {
    const few = [
      request('refused_by_provider', 1),
      request('refused_by_provider', 2),
      request('completed', 3),
    ];
    expect(refusalStats(few, 'p1', now)).toMatchObject({
      received: 3,
      percent: 66.7,
      exitRisk: false,
    });
    expect(refusalStats(few, 'p2', now)).toMatchObject({
      received: 0,
      percent: null,
      exitRisk: false,
    });
    expect(refusalStats(few, 'p1', now, { minRequests: 3 }).exitRisk).toBe(true);
  });

  it('só conta os últimos 30 dias', () => {
    const old = {
      providerId: 'p1',
      status: 'refused_by_provider' as const,
      requestedAt: '2026-09-20T10:00:00-03:00',
    };
    expect(refusalStats([old], 'p1', now).received).toBe(0);
  });

  it('queda de disponibilidade superior a 50% sobre a média das 4 semanas anteriores gera sinal', () => {
    const weeks = (slots: number[]) =>
      slots.map((s, i) => ({ weekStart: addDays('2026-10-05', i * 7), slots: s }));
    expect(availabilityDropSignal(weeks([10, 10, 10, 10, 4]))).toMatchObject({
      previousAverage: 10,
      current: 4,
      dropPercent: 60,
      signal: true,
    });
    expect(availabilityDropSignal(weeks([10, 10, 10, 10, 5]))).toMatchObject({
      dropPercent: 50,
      signal: false,
    });
    expect(availabilityDropSignal(weeks([10, 10, 10, 10, 10])).signal).toBe(false);
    expect(availabilityDropSignal(weeks([10])).signal).toBe(false);
    expect(availabilityDropSignal(weeks([0, 0, 0, 0, 0])).signal).toBe(false);
  });
});

describe('Rede: busca com mais de uma opção (RN-REDE-10, 18, 19)', () => {
  type P = Pick<Provider, 'status' | 'highlight' | 'name' | 'category'>;
  const p = (
    name: string,
    status: Provider['status'],
    highlight = false,
    category: Provider['category'] = 'dentistry',
  ): P => ({ name, status, highlight, category });

  it('mostra ativos e em monitoramento; suspensos e descredenciados não aparecem', () => {
    expect(isSearchable('active')).toBe(true);
    expect(isSearchable('monitoring')).toBe(true);
    ['suspended', 'deaccredited', 'candidate', 'rejected'].forEach((s) =>
      expect(isSearchable(s as never)).toBe(false),
    );
  });

  it('o destaque vem primeiro e nunca esconde os demais', () => {
    const result = searchProviders(
      [
        p('Dra. Sônia', 'monitoring'),
        p('Dr. Eduardo', 'active', true),
        p('Dr. Oculto', 'suspended'),
      ],
      'dentistry',
    );
    expect(result.options.map((o) => o.name)).toEqual(['Dr. Eduardo', 'Dra. Sônia']);
    expect(result.availability).toBe('multiple');
    expect(result.notice).toBeNull();
  });

  it('única opção e nenhuma opção têm aviso próprio', () => {
    expect(searchProviders([p('Único', 'active')], 'dentistry')).toMatchObject({
      availability: 'single_option',
      notice: 'Única opção disponível no momento.',
    });
    const none = searchProviders([p('Suspenso', 'suspended')], 'dentistry');
    expect(none.availability).toBe('none');
    expect(none.notice).toContain('Nenhuma opção disponível no momento');
  });
});

describe('Credenciamento (RN-REDE-03, 21, 22, 24; AC-M08-01, 02, 13)', () => {
  const okItem = { status: 'ok' as const };
  const checklist = (
    overrides: Partial<Accreditation['checklist']> = {},
  ): Accreditation['checklist'] => ({
    council_registry: okItem,
    training_proof: okItem,
    accreditation_contract: okItem,
    data_protection_term: okItem,
    continuous_evaluation_accepted: okItem,
    ...overrides,
  });
  const doc = (validUntil?: string): ProviderDocument =>
    ({
      id: 'd',
      providerId: 'p',
      kind: 'council_registry',
      fileName: 'x.pdf',
      issuedAt: '2025-01-01',
      status: 'valid',
      createdAt: '',
      updatedAt: '',
      ...(validUntil ? { validUntil } : {}),
    }) as ProviderDocument;

  it('são cinco critérios', () => {
    expect(ACCREDITATION_CHECKLIST_KEYS).toHaveLength(5);
  });

  it('aprova com 5 critérios ok e documentos válidos', () => {
    expect(
      checkAccreditationApproval({ checklist: checklist() }, [doc('2027-01-01')], '2026-11-04'),
    ).toEqual({ canApprove: true, missingCriteria: [], expiredDocuments: [] });
  });

  it('um critério pendente bloqueia e é listado', () => {
    const result = checkAccreditationApproval(
      { checklist: checklist({ training_proof: { status: 'pending' } }) },
      [],
      '2026-11-04',
    );
    expect(result.canApprove).toBe(false);
    expect(result.missingCriteria).toEqual<ChecklistKey[]>(['training_proof']);
  });

  it('"não se aplica" vale só para o registro de conselho', () => {
    expect(
      checkAccreditationApproval(
        { checklist: checklist({ council_registry: { status: 'not_applicable' } }) },
        [],
        '2026-11-04',
      ).canApprove,
    ).toBe(true);
    expect(
      checkAccreditationApproval(
        { checklist: checklist({ training_proof: { status: 'not_applicable' } }) },
        [],
        '2026-11-04',
      ).canApprove,
    ).toBe(false);
  });

  it('documento vencido impede a aprovação (CREFITO vencido há 12 dias)', () => {
    const result = checkAccreditationApproval(
      { checklist: checklist() },
      [doc('2026-10-23')],
      '2026-11-04',
    );
    expect(result.canApprove).toBe(false);
    expect(result.expiredDocuments).toHaveLength(1);
    expect(isDocumentExpired(doc('2026-11-04'), '2026-11-04')).toBe(false);
    expect(isDocumentExpired(doc('2026-11-03'), '2026-11-04')).toBe(true);
    expect(isDocumentExpired(doc(), '2026-11-04')).toBe(false);
  });

  it('ativação exige aprovação, integração, ciência dos POPs e vedação de captação paralela', () => {
    expect(canActivateProvider({}, 'approved').missing).toEqual([
      'integration',
      'pops',
      'parallel_ban',
    ]);
    expect(
      canActivateProvider(
        {
          integrationDoneAt: '2026-10-01',
          popsAcknowledgedAt: '2026-10-01',
          parallelSolicitationBanAcceptedAt: '2026-10-01',
        },
        'approved',
      ).canActivate,
    ).toBe(true);
    expect(
      canActivateProvider(
        {
          integrationDoneAt: '2026-10-01',
          popsAcknowledgedAt: '2026-10-01',
          parallelSolicitationBanAcceptedAt: '2026-10-01',
        },
        'in_review',
      ).missing,
    ).toEqual(['approved']);
  });

  it('documento vencido em ativo: 30 dias para regularizar', () => {
    expect(documentSuspensionDate('2026-10-05')).toBe('2026-11-04');
    expect(shouldSuspendForExpiredDocument('2026-10-05', '2026-11-03')).toBe(false);
    expect(shouldSuspendForExpiredDocument('2026-10-05', '2026-11-04')).toBe(true);
  });

  it('o prestador só vê dados do usuário com solicitação aceita E cláusula assinada (RN-LGPD-13)', () => {
    const withClause = { dataProtectionClauseSignedAt: '2026-10-01' };
    expect(providerMaySeeCaregiverData(withClause, { status: 'accepted' })).toBe(true);
    expect(providerMaySeeCaregiverData(withClause, { status: 'requested' })).toBe(false);
    expect(providerMaySeeCaregiverData({}, { status: 'accepted' })).toBe(false);
  });
});
