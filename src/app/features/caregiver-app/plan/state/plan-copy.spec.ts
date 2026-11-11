import { describe, expect, it } from 'vitest';
import { ChangeQuote } from '../../../../core/commerce/subscription.service';
import { DEFAULT_PLANS } from '../../../../core/rules/plans';
import { actionLabelFor, allBenefits, changeCopy, planLines, planPerks, priceLine, priceParts, quotaLines, scheduledNote } from './plan-copy';

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

describe('textos de Meu plano (docs/20; UX C18 e B9)', () => {
  it('os destaques: 4 no herói, 3 no quadro; Cuida e Sustenta começam pelo atendimento e pela terapia de grupo', () => {
    expect(planPerks('cuida', plans, 4).map((p) => p.label)).toEqual([
      'Atendimento psicológico individual: 2 sessões por mês',
      'Terapia de grupo: 2 encontros por mês',
      'Todas as capacitações do mês',
      'Maior suporte à organização da rotina',
    ]);
    expect(planPerks('sustenta', plans, 3).map((p) => p.label)).toEqual([
      'Atendimento psicológico individual: 4 sessões por mês',
      'Terapia de grupo: 2 encontros por mês',
      'Rede credenciada, com benefícios diferenciados',
    ]);
    expect(planPerks('essencial', plans, 3).map((p) => p.label)).toEqual([
      'Organização ampliada da rotina',
      'Cartão Nexus, com descontos nos parceiros',
      'Conteúdos abertos e exclusivos',
    ]);
  });

  it('o Livre não tem o Cartão como destaque nem em lugar nenhum; nenhum plano cita Zarit', () => {
    const livre = planLines('livre').map((p) => p.label).join(' ');
    expect(livre).not.toMatch(/cart[ãa]o/i);
    expect(livre).toContain('Capacitações avulsas (R$ 40,00 por encontro)');
    (['livre', 'essencial', 'cuida', 'sustenta'] as const).forEach((id) =>
      expect(allBenefits(id, plans).join(' ')).not.toMatch(/zarit|pontua|alerta|arbe/i),
    );
  });

  it('as linhas de cota do quadro (docs/20)', () => {
    expect(quotaLines('livre').map((l) => l.value)).toEqual(['Não inclui', 'Não inclui', 'Avulsas, R$ 40,00 por encontro']);
    expect(quotaLines('essencial').map((l) => l.value)).toEqual(['Não inclui', 'Não inclui', '2 capacitações por mês']);
    expect(quotaLines('cuida').map((l) => l.value)).toEqual(['2 sessões por mês', '2 encontros por mês', 'Todas as do mês']);
    expect(quotaLines('sustenta').map((l) => l.value)).toEqual(['4 sessões por mês', '2 encontros por mês', 'Todas as do mês']);
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
      'Vale no fim do ciclo, em 18/11/2026. Até lá, o Cuida continua, inclusive a terapia de grupo.',
      'Você sai das turmas de terapia de grupo que começam depois dessa data: Sobrecarga e autocuidado (03/12). As turmas em andamento continuam até o fim do ciclo.',
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
