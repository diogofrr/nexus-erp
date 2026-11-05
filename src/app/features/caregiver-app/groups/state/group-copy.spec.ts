import { describe, expect, it } from 'vitest';
import { leaderLine, placeOf, roomAccessibility, seatsText } from './group-copy';

describe('textos de Grupos e capacitações (UX C10)', () => {
  it('quem conduz: o psicólogo vem com o registro e o rótulo de fictício; os outros, só o nome', () => {
    expect(leaderLine({ type: 'psychologist', name: 'Dra. Letícia Amaral', professionalRegistration: 'CRP-04/00104 (fictício)' })).toBe(
      'Conduzido por Dra. Letícia Amaral, psicóloga (CRP-04/00104, fictício).',
    );
    expect(leaderLine({ type: 'psychologist', name: 'Dr. Rafael Moreira', professionalRegistration: 'CRP-04/00102 (fictício)' })).toBe(
      'Conduzido por Dr. Rafael Moreira, psicólogo (CRP-04/00102, fictício).',
    );
    expect(leaderLine({ type: 'psychologist', name: 'Beatriz Nogueira', professionalRegistration: 'CRP-04/00103' })).toBe(
      'Conduzido por Beatriz Nogueira, psicólogo(a) (CRP-04/00103).',
    );
    expect(leaderLine({ type: 'psychologist', name: 'Dra. Sem Registro' })).toBe('Conduzido por Dra. Sem Registro, psicóloga.');
    expect(leaderLine({ type: 'guest', name: 'Dr. Augusto Pedrosa (convidado)' })).toBe('Conduzido por Dr. Augusto Pedrosa (convidado).');
    expect(leaderLine({ type: 'provider', name: 'Enf. Priscila Gouveia' })).toBe('Conduzido por Enf. Priscila Gouveia.');
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

  it('vagas: "4 vagas", "1 vaga" ou "Lotado"', () => {
    expect(seatsText(4)).toBe('4 vagas');
    expect(seatsText(1)).toBe('1 vaga');
    expect(seatsText(0)).toBe('Lotado');
  });

  it('o nome da atividade nas frases muda com o tipo', () => {
    expect(placeOf('support_group')).toMatchObject({ enter: 'Entrar no grupo', leave: 'Sair do grupo', inside: 'no grupo' });
    expect(placeOf('group_therapy').enter).toBe('Entrar no grupo');
    expect(placeOf('training')).toMatchObject({ enter: 'Entrar na capacitação', leave: 'Sair da capacitação', left: 'saiu da capacitação' });
    expect(placeOf('open_conversation_circle')).toMatchObject({ enter: 'Entrar na roda', inside: 'na roda' });
  });
});
