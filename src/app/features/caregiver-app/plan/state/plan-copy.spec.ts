import { describe, expect, it } from 'vitest';
import { ChangeQuote } from '../../../../core/commerce/subscription.service';
import { DEFAULT_PLANS } from '../../../../core/rules/plans';
import { actionLabelFor, changeCopy, ownBenefits, planPerks, priceLine, priceParts, scheduledNote } from './plan-copy';

const plans = DEFAULT_PLANS;
const price = (id: string): string => (id === 'cuida' ? 'R$ 119,90' : id === 'sustenta' ? 'R$ 149,90' : 'R$ 49,90');

function quote(partial: Partial<ChangeQuote> & Pick<ChangeQuote, 'from' | 'to' | 'kind'>): ChangeQuote {
  return {
    timing: partial.kind === 'upgrade' ? 'immediate' : 'end_of_cycle',
    effectiveAt: '2026-11-18',
    issuesCard: false,
    inactivatesCard: false,
    lostGroups: [],
    effect: '',
    actionLabel: '',
    ...partial,
  };
}

describe('textos de Meu plano (UX C18 e B9)', () => {
  it('os destaques de cada plano: 4 no herói, os 3 primeiros no quadro, sempre com ícone e só o que o plano inclui', () => {
    expect(planPerks('cuida', plans, 4).map((p) => p.label)).toEqual(['Grupos de apoio', 'Capacitações', 'Maior suporte à organização', 'Descontos exclusivos do Cartão Nexus']);
    expect(planPerks('cuida', plans, 3).map((p) => p.label)).toEqual(['Grupos de apoio', 'Capacitações', 'Maior suporte à organização']);
    expect(planPerks('livre', plans, 4).map((p) => p.icon)).toEqual(['calendar-days', 'clipboard-check', 'book-open', 'handshake']);
    // O catálogo é editável: sem o benefício, ele não aparece; completa com os outros do plano.
    const trimmed = plans.map((p) => (p.id === 'cuida' ? { ...p, benefits: p.benefits.filter((b) => b !== 'trainings') } : p));
    expect(planPerks('cuida', trimmed, 4).map((p) => p.label)).toEqual([
      'Grupos de apoio',
      'Maior suporte à organização',
      'Descontos exclusivos do Cartão Nexus',
      'Acesso ao aplicativo',
    ]);
  });

  it('o preço em duas partes e a faixa da mudança agendada', () => {
    expect(priceParts({ monthlyPriceCents: 11990 })).toEqual({ amount: 'R$ 119,90', unit: 'por mês' });
    expect(scheduledNote({ kind: 'change', to: 'essencial', at: '2026-11-18' })).toEqual({
      title: 'Mudança agendada',
      text: 'Seu plano muda para o Essencial em 18/11/2026.',
    });
    expect(scheduledNote({ kind: 'cancel', to: 'livre', at: '2026-11-18' })).toEqual({
      title: 'Cancelamento agendado',
      text: 'Seu plano volta a ser o Livre em 18/11/2026.',
    });
  });

  it('cada plano traz só o que é dele além do anterior (Figura 1)', () => {
    expect(ownBenefits('livre', plans)).toEqual(['Acesso ao aplicativo', 'Organização básica', 'Agenda e lembretes', 'Conteúdos', 'Acesso inicial à rede']);
    expect(ownBenefits('essencial', plans)).toEqual(['Organização ampliada', 'Descontos exclusivos do Cartão Nexus', 'Conteúdos exclusivos', 'Condições especiais na rede']);
    expect(ownBenefits('cuida', plans)).toEqual(['Maior suporte à organização', 'Grupos de apoio', 'Capacitações']);
    expect(ownBenefits('sustenta', plans)).toEqual(['Acompanhamento organizacional mais próximo', 'Maior nível de suporte', 'Benefícios diferenciados na rede']);
  });

  it('o preço sai em reais por mês', () => {
    expect(priceLine({ monthlyPriceCents: 4990 })).toBe('R$ 49,90 por mês');
    expect(priceLine({ monthlyPriceCents: 0 })).toBe('R$ 0,00 por mês');
  });

  it('o botão de cada troca diz o que acontece', () => {
    expect(actionLabelFor('upgrade', 'cuida')).toBe('Mudar para o Cuida');
    expect(actionLabelFor('downgrade', 'essencial')).toBe('Agendar mudança para o Essencial');
    expect(actionLabelFor('cancel', 'livre')).toBe('Agendar cancelamento');
    expect(actionLabelFor('same', 'cuida')).toBeNull();
  });

  it('subir vale hoje; o cartão só é dito quando é emitido; a cobrança começa no próximo ciclo e o aviso de mensalidade vem junto', () => {
    const first = changeCopy(quote({ from: 'livre', to: 'cuida', kind: 'upgrade', issuesCard: true, billingFrom: '2026-12-04' }), price);
    expect(first.heading).toBe('Mudar para o Cuida?');
    expect(first.lines).toEqual([
      'Vale hoje. O Cartão Nexus é emitido agora. A cobrança de R$ 119,90 começa no próximo ciclo, em 04/12/2026.',
      'Se mudar de ideia, é só mudar de plano de novo.',
    ]);
    expect(first.showNotice).toBe(true);
    const next = changeCopy(quote({ from: 'cuida', to: 'sustenta', kind: 'upgrade', billingFrom: '2026-11-18' }), price);
    expect(next.lines).toEqual([
      'Vale hoje. A cobrança de R$ 149,90 começa no próximo ciclo, em 18/11/2026.',
      'Se mudar de ideia, é só mudar de plano de novo.',
    ]);
  });

  it('descer vale no fim do ciclo e diz as turmas que a pessoa deixa', () => {
    const copy = changeCopy(
      quote({ from: 'cuida', to: 'essencial', kind: 'downgrade', lostGroups: [{ activityId: 'act_1', title: 'Sobrecarga e autocuidado', startDate: '2026-12-03' }] }),
      price,
    );
    expect(copy.heading).toBe('Mudar para o Essencial no fim do ciclo?');
    expect(copy.lines).toEqual([
      'Vale no fim do ciclo, em 18/11/2026. Até lá, o Cuida continua, inclusive os grupos.',
      'Você sai dos grupos que começam depois dessa data: Sobrecarga e autocuidado (03/12). Os grupos em andamento continuam até o fim do ciclo.',
      'Se mudar de ideia, é só mudar de plano de novo.',
    ]);
    expect(copy.showNotice).toBe(false);
    expect(changeCopy(quote({ from: 'essencial', to: 'livre', kind: 'cancel' }), price).lines[0]).toContain('O cancelamento fica agendado para 18/11/2026.');
  });

  it('de um plano sem grupos, a frase não fala de grupos', () => {
    const copy = changeCopy(quote({ from: 'essencial', to: 'livre', kind: 'cancel' }), price);
    expect(copy.lines.join(' ')).not.toContain('grupos');
    expect(copy.lines).toEqual(['O cancelamento fica agendado para 18/11/2026. Até lá tudo continua. Nessa data o cartão deixa de valer e o plano vira Livre.']);
  });

  it('nenhuma frase fala de pontuação, faixa, alerta ou ARBE (RN-PLN-19)', () => {
    const all = [
      changeCopy(quote({ from: 'livre', to: 'cuida', kind: 'upgrade', issuesCard: true, billingFrom: '2026-12-04' }), price),
      changeCopy(quote({ from: 'cuida', to: 'essencial', kind: 'downgrade' }), price),
      changeCopy(quote({ from: 'cuida', to: 'livre', kind: 'cancel' }), price),
    ]
      .flatMap((c) => [c.heading, c.actionLabel, ...c.lines])
      .join(' ')
      .toLowerCase();
    expect(all).not.toMatch(/zarit|pontua|faixa|alerta|arbe|risco/);
  });
});
