import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryLabel, modalityLabel, orderGroupOf, parseCategory, ratingText, requestStatusView } from './network-copy';

describe('textos da Rede (UX C12 a C15)', () => {
  it('as 10 necessidades, na ordem do UX', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      'Fisioterapia',
      'Cuidador(a)',
      'Home care',
      'Enfermagem',
      'Farmácia',
      'Clínica',
      'Psicologia',
      'Nutrição',
      'Advocacia',
      'Serviço especializado',
    ]);
    expect(categoryLabel('legal')).toBe('Advocacia');
  });

  it('a categoria da URL só vale se for uma das 10', () => {
    expect(parseCategory('pharmacy')).toBe('pharmacy');
    expect(parseCategory('qualquer')).toBeNull();
    expect(parseCategory(null)).toBeNull();
  });

  it('a nota só aparece com média (5 avaliações ou mais)', () => {
    expect(ratingText({ average: 4.83, evaluationCount: 12 })).toBe('Nota 4,8 (12 avaliações)');
    expect(ratingText({ average: 4, evaluationCount: 6 })).toBe('Nota 4,0 (6 avaliações)');
    expect(ratingText({ average: null, evaluationCount: 3 })).toBe('Ainda sem nota (menos de 5 avaliações)');
  });

  it('a situação do pedido tem sempre texto e ícone, e o recusado não carrega culpa', () => {
    const labels = (['requested', 'accepted', 'refused_by_provider', 'cancelled_by_provider', 'cancelled_by_user', 'completed', 'evaluated'] as const).map(
      (status) => {
        const view = requestStatusView({ status });
        expect(view.icon).toBeTruthy();
        return view.label;
      },
    );
    expect(labels).toEqual([
      'Enviado, aguardando resposta',
      'Aceito',
      'O profissional não pôde atender',
      'Cancelado pelo profissional',
      'Cancelado por você',
      'Concluído: avalie',
      'Avaliado',
    ]);
  });

  it('em qual grupo o pedido fica', () => {
    expect(orderGroupOf({ status: 'completed' })).toBe('evaluate');
    expect(orderGroupOf({ status: 'completed', evaluationId: 'evl_1' })).toBe('previous');
    expect(orderGroupOf({ status: 'requested' })).toBe('open');
    expect(orderGroupOf({ status: 'accepted' })).toBe('open');
    (['evaluated', 'refused_by_provider', 'cancelled_by_provider', 'cancelled_by_user'] as const).forEach((status) =>
      expect(orderGroupOf({ status })).toBe('previous'),
    );
  });

  it('o local do pedido', () => {
    expect(modalityLabel('home')).toBe('Em casa');
    expect(modalityLabel('at_provider')).toBe('No local do profissional');
  });
});
