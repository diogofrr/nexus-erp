import { describe, expect, it } from 'vitest';
import { leaderLine, leadersShort, placeOf, roomAccessibility, seatsText } from './group-copy';

describe('textos de Grupos e capacitações (UX C10)', () => {
  it('quem conduz: a equipe de psicologia vem pelo nome, sem supor gênero; o registro só aparece quando existe', () => {
    expect(leaderLine({ type: 'psychologist', name: 'Marina Gomes' })).toBe('Conduzido por Marina Gomes, da equipe de psicologia.');
    expect(leaderLine({ type: 'psychologist', name: 'Gustavo Medeiros', professionalRegistration: '' })).toBe(
      'Conduzido por Gustavo Medeiros, da equipe de psicologia.',
    );
    // A equipe de hoje não tem CRP; se um registro for cadastrado, ele vem entre parênteses.
    expect(leaderLine({ type: 'psychologist', name: 'Pessoa Exemplo', professionalRegistration: 'CRP-04/00104 (fictício)' })).toBe(
      'Conduzido por Pessoa Exemplo, da equipe de psicologia (CRP-04/00104, fictício).',
    );
    expect(leaderLine({ type: 'psychologist', name: 'Pessoa Exemplo', professionalRegistration: 'CRP-04/00103' })).toBe(
      'Conduzido por Pessoa Exemplo, da equipe de psicologia (CRP-04/00103).',
    );
    // O papel não concorda com o tratamento: é sempre "da equipe de psicologia".
    expect(leaderLine({ type: 'psychologist', name: 'Dra. Sem Registro' })).toBe('Conduzido por Dra. Sem Registro, da equipe de psicologia.');
    expect(leaderLine({ type: 'guest', name: 'Dr. Augusto Pedrosa (convidado)' })).toBe('Conduzido por Dr. Augusto Pedrosa (convidado).');
    expect(leaderLine({ type: 'provider', name: 'Enf. Priscila Gouveia' })).toBe('Conduzido por Enf. Priscila Gouveia.');
  });

  it('quem conduz, curto, para o cartão: "Com" e os nomes, sem o que vem entre parênteses', () => {
    expect(leadersShort([{ type: 'psychologist', name: 'Marina Gomes' }])).toBe('Com Marina Gomes');
    expect(leadersShort([{ type: 'guest', name: 'Dr. Augusto Pedrosa (convidado)' }])).toBe('Com Dr. Augusto Pedrosa');
    expect(
      leadersShort([
        { type: 'psychologist', name: 'Jessica Rosa' },
        { type: 'psychologist', name: 'João Eduardo' },
        { type: 'provider', name: 'Enf. Priscila Gouveia' },
      ]),
    ).toBe('Com Jessica Rosa, João Eduardo e Enf. Priscila Gouveia');
    expect(leadersShort([])).toBeNull();
  });

  it('a acessibilidade da sala diz só o que a sala tem', () => {
    const all = { accessibility: { stepFreeAccess: true, adaptedRestroom: true, goodLighting: true, armrestSeating: true } };
    expect(roomAccessibility(all)).toBe('Sala com acesso sem degraus, sanitário adaptado, boa iluminação e assentos com apoio de braços.');
    expect(roomAccessibility({ accessibility: { ...all.accessibility, adaptedRestroom: false } })).toBe(
      'Sala com acesso sem degraus, boa iluminação e assentos com apoio de braços.',
    );
    expect(roomAccessibility({ accessibility: { stepFreeAccess: true, adaptedRestroom: false, goodLighting: false, armrestSeating: false } })).toBe('Sala com acesso sem degraus.');
    expect(roomAccessibility({ accessibility: { stepFreeAccess: false, adaptedRestroom: false, goodLighting: false, armrestSeating: false } })).toBe('');
  });

  it('vagas: "4 vagas", "1 vaga" ou "Lista de espera" (docs/20)', () => {
    expect(seatsText(4)).toBe('4 vagas');
    expect(seatsText(1)).toBe('1 vaga');
    expect(seatsText(0)).toBe('Lista de espera');
  });

  it('o nome da atividade nas frases muda com o tipo', () => {
    expect(placeOf('group_therapy')).toMatchObject({ enter: 'Entrar no grupo', leave: 'Sair do grupo', inside: 'no grupo' });
    expect(placeOf('group_therapy').enter).toBe('Entrar no grupo');
    expect(placeOf('training')).toMatchObject({ enter: 'Entrar na capacitação', leave: 'Sair da capacitação', left: 'saiu da capacitação' });
  });
});

describe('valor do encontro (docs/20)', () => {
  const base = { meetings: 2, month: '2026-11' } as const;
  it('bloqueado não diz valor; capacitação incluída diz a cota; avulsa diz o valor, e no Livre o convite neutro', async () => {
    const { offerLine, paidDetail } = await import('./group-copy');
    expect(offerLine('group_therapy', { ...base, kind: 'blocked', priceCents: 0, usage: null }, 'livre')).toBeNull();
    expect(offerLine('training', { ...base, kind: 'included', priceCents: 0, usage: { limit: 'all', used: 0, left: 'all' } }, 'cuida')).toBe('Incluída no seu plano');
    expect(offerLine('training', { ...base, kind: 'included', priceCents: 0, usage: { limit: 2, used: 0, left: 2 } }, 'essencial')).toBe(
      'Incluída no seu plano (2 de 2 neste mês)',
    );
    const paid = { ...base, kind: 'paid' as const, priceCents: 8000, usage: { limit: 0, used: 0, left: 0 } };
    expect(offerLine('training', paid, 'livre')).toBe('Você pode participar pagando por encontro');
    expect(offerLine('training', paid, 'essencial')).toBe('R$ 40,00 por encontro');
    expect(paidDetail('training', paid)).toContain('R$ 40,00 por encontro: R$ 80,00 por 2 encontros neste mês.');
  });
});
