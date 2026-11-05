import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { bootApp, settle } from '../../layout/testing';
import { pick, pickAll, text } from '../../shared/ui/testing/dom';

/** Travessões (longo e médio) montados por código, para este arquivo também passar na conferência do núcleo. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const FORBIDDEN = /guerreira|\banjo\b|diagnóstico|eficácia|paciente|surto/i;

const SCREENS: [userId: string, url: string][] = [
  ['u1', '/app/painel'],
  ['u2', '/app/painel'],
  ['u3', '/app/painel'],
  ['u7', '/app/painel'],
  ['u1', '/app/financeiro'],
  ['u1', '/app/financeiro/projecao'],
  ['u1', '/app/financeiro/parametros'],
  ['u1', '/app/financeiro/investimento'],
  ['u1', '/app/financeiro/custos'],
  ['u1', '/app/indicadores?aba=cuidadores'],
  ['u1', '/app/indicadores?aba=rede'],
  ['u1', '/app/indicadores?aba=equipe'],
  ['u1', '/app/indicadores?aba=atendimento'],
  ['u1', '/app/piloto'],
  ['u1', '/app/governanca'],
  ['u1', '/app/governanca/pops'],
  ['u1', '/app/governanca/pops/POP-07'],
  ['u1', '/app/governanca/riscos'],
  ['u1', '/app/governanca/riscos/R4'],
  ['u1', '/app/governanca/encaminhamentos'],
  ['u1', '/app/governanca/ocorrencias'],
  ['u2', '/app/governanca/ocorrencias/occ_0003'],
  ['u1', '/app/governanca/formacao'],
  ['u1', '/app/governanca/conteudos'],
  ['u1', '/app/governanca/normas'],
];

describe('M10, M13 e M02: tom e marca em todas as telas (AC-GL-08)', () => {
  it.each(SCREENS)('%s em %s não tem travessão nem palavra proibida e tem um só h1', async (userId, url) => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId, url });
    await settle(app.fixture);
    const main = pick(app.root, 'main');
    expect(app.router.url, 'a tela abriu').toBe(url);
    expect(text(main)).not.toMatch(DASHES);
    expect(text(main)).not.toMatch(FORBIDDEN);
    expect(pickAll(app.root, 'h1')).toHaveLength(1);
    // Valores em reais só para a sócia.
    if (userId !== 'u1') {
      expect(text(main)).not.toContain('R$');
    }
    // Estado nunca só por cor: todo selo tem texto.
    for (const badge of pickAll(app.root, 'main .badge')) {
      expect(text(badge).length, badge.outerHTML.slice(0, 80)).toBeGreaterThan(0);
    }
    // Toda tabela tem legenda para leitor de tela.
    for (const table of pickAll(app.root, 'main table')) {
      expect(table.querySelector('caption'), 'tabela sem caption').not.toBeNull();
    }
    // Todo gráfico tem leitura em palavras e alternativa em tabela.
    for (const svg of pickAll(app.root, 'main svg.chart__svg')) {
      expect(svg.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(10);
    }
    for (const chart of pickAll(app.root, 'main figure.chart')) {
      expect(chart.querySelector('details, table, .heat')).not.toBeNull();
    }
  });
});
