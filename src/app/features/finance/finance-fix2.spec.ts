import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { pick, pickAll, text } from '../../shared/ui/testing/dom';

async function open(userId: string, url: string): Promise<BootedApp> {
  TestBed.resetTestingModule();
  const app = await bootApp({ userId, url });
  await settle(app.fixture);
  return app;
}

describe('Financeiro: ajustes do Fix-2', () => {
  it('QA-012: cada um dos 24 campos da série de gratuitos tem nome acessível com o mês', async () => {
    const app = await open('u1', '/app/financeiro/parametros');
    const fields = pickAll<HTMLInputElement>(app.root, '[data-role="series-details"] input');
    expect(fields).toHaveLength(24);
    fields.forEach((input, index) => {
      expect(input.getAttribute('aria-label')).toBe(`Usuários gratuitos acumulados, mês ${index + 1}`);
      // O rótulo visível ("Mês N") continua ligado ao campo e faz parte do nome acessível.
      expect(app.root.querySelector(`label[for="${input.id}"]`)?.textContent?.trim()).toBe(`Mês ${index + 1}`);
    });
  });

  it('CX-005: a projeção mostra os três cenários lado a lado, no topo da tela', async () => {
    const app = await open('u1', '/app/financeiro/projecao');
    const table = pick(app.root, '[data-role="scenario-compare"]');
    const rows = pickAll(table, 'tbody tr');
    expect(rows).toHaveLength(3);
    const content = rows.map((r) => text(r));
    expect(content[0]).toContain('mês 9');
    expect(content[0]).toContain('mês 18');
    expect(content[0]).toContain('R$ 2.755,91');
    expect(content[1]).toContain('mês 7');
    expect(content[1]).toContain('mês 14');
    expect(content[2]).toContain('mês 6');
    expect(content[2]).toContain('mês 12');
    // A tabela vem antes dos marcos e do gráfico, e marca o cenário que está em tela.
    const html = app.root.innerHTML;
    expect(html.indexOf('data-role="scenario-compare"')).toBeLessThan(html.indexOf('data-role="milestones"'));
    expect(table.querySelector('tr[data-selected="true"]')).toBeTruthy();
  });

  it('CX-006: o eixo dos meses não põe "M23" colado em "M24"', async () => {
    const app = await open('u1', '/app/financeiro/projecao');
    const labels = pickAll(app.root, 'svg text.ch-text--mid').map((t) => t.textContent?.trim() ?? '');
    expect(labels).toContain('M24');
    expect(labels).toContain('M1');
    expect(labels).not.toContain('M23');
    // Nenhum par de rótulos vizinhos: a distância entre os números mostrados é de 2 ou mais.
    const months = labels.filter((l) => /^M\d+$/.test(l)).map((l) => Number(l.slice(1)));
    for (let i = 1; i < months.length; i += 1) {
      expect((months[i] as number) - (months[i - 1] as number)).toBeGreaterThanOrEqual(2);
    }
  });

  it('CX-007: a visão geral explica os gastos em linguagem simples e leva à tela de Custos, sem "Quadro 5"', async () => {
    const app = await open('u1', '/app/financeiro');
    const how = text(pick(app.root, '[data-role="how"]'));
    expect(how).toContain('plano de negócios');
    expect(how).not.toContain('Quadro 5');
    expect(pick<HTMLAnchorElement>(app.root, '[data-role="how"] a').getAttribute('href')).toBe('/app/financeiro/custos');
    const costs = await open('u1', '/app/financeiro/custos');
    expect(text(costs.root)).not.toContain('Quadro 5');
    expect(text(costs.root)).toContain('Os gastos fixos do plano de negócios');
  });
});
