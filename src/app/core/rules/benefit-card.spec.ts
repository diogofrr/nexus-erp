import { describe, expect, it } from 'vitest';
import { cardSavings, partnersForCard } from './benefit-card';

describe('Cartão Nexus: o que o cuidador vê (RN-CRT-10 e 11)', () => {
  const usages = [
    { date: '2026-11-02', discountCents: 1000 },
    { date: '2026-11-03', discountCents: 2840 },
    { date: '2026-10-31', discountCents: 936 },
    { date: '2026-09-25', discountCents: 3204 },
  ];

  it('soma a economia do mês de hoje e a total', () => {
    expect(cardSavings(usages, '2026-11-04')).toEqual({ monthCents: 3840, monthCount: 2, totalCents: 7980, totalCount: 4 });
  });

  it('mês sem uso soma zero e o total continua', () => {
    expect(cardSavings(usages, '2026-12-01')).toEqual({ monthCents: 0, monthCount: 0, totalCents: 7980, totalCount: 4 });
    expect(cardSavings([], '2026-11-04')).toEqual({ monthCents: 0, monthCount: 0, totalCents: 0, totalCount: 0 });
  });

  it('só parceiro ativo aparece, em ordem alfabética', () => {
    const partners = [
      { name: 'Ótica Visão Clara', status: 'active' as const },
      { name: 'Drogaria Popular Central', status: 'suspended' as const },
      { name: 'Academia Mexa-se', status: 'ended' as const },
      { name: 'Farmácia Bem-Estar', status: 'active' as const },
      { name: 'Clínica de Imagem Delta', status: 'legal_ethics_review' as const },
      { name: 'Loja Passo Firme', status: 'prospect' as const },
    ];
    expect(partnersForCard(partners).map((p) => p.name)).toEqual(['Farmácia Bem-Estar', 'Ótica Visão Clara']);
  });
});
