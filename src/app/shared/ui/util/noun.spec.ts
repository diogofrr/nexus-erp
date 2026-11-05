import { describe, expect, it } from 'vitest';
import { nounFor, singularNoun } from './noun';

describe('concordância de contadores (CX-001)', () => {
  it.each([
    ['solicitações', 'solicitação'],
    ['sessões', 'sessão'],
    ['reclamações', 'reclamação'],
    ['avaliações', 'avaliação'],
    ['cuidadores', 'cuidador'],
    ['prestadores', 'prestador'],
    ['mensagens', 'mensagem'],
    ['itens', 'item'],
    ['famílias', 'família'],
    ['meses', 'mês'],
    ['atividades', 'atividade'],
    ['ocorrências', 'ocorrência'],
    ['titulares', 'titular'],
    ['POPs', 'POP'],
  ])('%s vira %s no singular', (plural, singular) => {
    expect(singularNoun(plural)).toBe(singular);
  });

  it('só 1 usa o singular; 0 e 2 ou mais ficam no plural', () => {
    expect(nounFor(1, 'solicitações')).toBe('solicitação');
    expect(nounFor(0, 'solicitações')).toBe('solicitações');
    expect(nounFor(2, 'solicitações')).toBe('solicitações');
  });
});
