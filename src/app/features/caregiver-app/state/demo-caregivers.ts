import { ID } from '../../../core/models';

/**
 * As pessoas de demonstração da entrada do aplicativo do cuidador (docs/10-cuidador-contexto.md, "Entrada").
 * Este arquivo é a ÚNICA fonte das frases da entrada: o nome, a idade e o plano vêm do cadastro (seed), a frase vem
 * daqui, em linguagem comum. As frases são NEUTRAS (UX S-10, AC-CG-21): nada de pontuação, faixa, alerta nem dado de
 * saúde, porque a entrada nunca vira oferta (RN-PLN-19) e quem vê a lista é qualquer visitante.
 *
 * São 6 na lista principal e mais 5 em "Ver mais exemplos" (Raimunda, com pedido de exclusão aberto, é a 11ª). Os ids são os do seed (`docs/08`, seção 7.2); os
 * compromissos e remédios de cada uma vêm de `core/seed/build-caregiver-app.ts`.
 */
export interface DemoCaregiver {
  id: ID;
  /** Frase curta, em linguagem comum, do que a pessoa tem de interessante para demonstrar. */
  blurb: string;
  /** Aparece direto na lista (6) ou só em "Ver mais exemplos" (4). */
  featured: boolean;
}

export const DEMO_CAREGIVERS: readonly DemoCaregiver[] = [
  {
    id: 'cg_0001',
    blurb: 'Cuida da mãe e organiza consultas e remédios.',
    featured: true,
  },
  {
    id: 'cg_0002',
    blurb: 'Divide o trabalho e o cuidado da mãe.',
    featured: true,
  },
  {
    id: 'cg_0003',
    blurb: 'Cuida da esposa e prefere falar por telefone.',
    featured: true,
  },
  {
    id: 'cg_0008',
    blurb: 'Participa do piloto da Nexus.',
    featured: true,
  },
  {
    id: 'cg_0027',
    blurb: 'Usa bastante o Cartão Nexus.',
    featured: true,
  },
  {
    id: 'cg_0024',
    blurb: 'Está na lista de espera de um grupo.',
    featured: true,
  },
  {
    id: 'cg_0012',
    blurb: 'Concluiu o piloto da Nexus.',
    featured: false,
  },
  {
    id: 'cg_0026',
    blurb: 'Tem uma mudança de plano agendada.',
    featured: false,
  },
  {
    id: 'cg_0016',
    blurb: 'Retirou uma autorização de privacidade.',
    featured: false,
  },
  {
    id: 'cg_0004',
    blurb: 'Usa só a organização da rotina.',
    featured: false,
  },
  {
    id: 'cg_0018',
    blurb: 'Tem um pedido de privacidade aberto.',
    featured: false,
  },
];
