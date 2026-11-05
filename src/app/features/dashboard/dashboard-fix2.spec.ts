import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { pick, pickAll, text } from '../../shared/ui/testing/dom';

async function open(userId: string, url = '/app/painel'): Promise<BootedApp> {
  TestBed.resetTestingModule();
  const app = await bootApp({ userId, url });
  await settle(app.fixture);
  return app;
}

describe('Painel: ajustes do Fix-2', () => {
  it('CX-004: o painel da sócia diz quantos itens pedem decisão e tem "Ver todos" quando passam de 3', async () => {
    const app = await open('u1');
    const total = Number(/\((\d+) itens?\)/.exec(text(pick(app.root, '[data-role="decisions-count"]')))?.[1]);
    expect(total).toBeGreaterThan(3);
    expect(pickAll(app.root, '[data-role="decisions"] a')).toHaveLength(3);
    const toggle = pick<HTMLButtonElement>(app.root, '[data-role="decisions-toggle"]');
    expect(toggle.textContent).toContain(`Ver todos os ${total} itens`);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await settle(app.fixture);
    expect(pickAll(app.root, '[data-role="decisions"] a')).toHaveLength(total);
    expect(pick(app.root, '[data-role="decisions-toggle"]').getAttribute('aria-expanded')).toBe('true');
    // Nenhum item some: o que antes ficava escondido (credenciamentos) agora aparece.
    expect(text(pick(app.root, '[data-role="decisions"]'))).toContain('credenciamentos aguardam decisão');
  });

  it('CX-008: o ponto de equilíbrio aparece uma vez como resumo (cartão) e o bloco só explica a conta', async () => {
    const app = await open('u1');
    const panel = text(pick(app.root, '[data-role="partner-panel"]'));
    // O cartão resume ("Faltam 10"); a frase que repetia a mesma informação saiu do bloco.
    expect(panel).not.toContain('Faltam 10 para o ponto de equilíbrio');
    expect(panel).toContain('Como chegamos ao ponto de equilíbrio');
    expect(panel.match(/Ponto de equilíbrio/g)).toHaveLength(1);
    expect(text(pick(app.root, '[data-role="how"]'))).toContain('26,2');
  });

  it('CX-009: o painel explica o que é o risco de saída do prestador, e a ficha diz quem decide', async () => {
    const app = await open('u1');
    const kpi = pickAll(app.root, 'app-panel-kpi').map((k) => text(k)).find((k) => k.startsWith('Risco de saída'));
    expect(kpi).toContain('pode deixar a rede');
    const detail = await open('u1', '/app/rede/prestadores/prv_04');
    const note = text(pick(detail.root, '[data-role="exit-risk-note"]'));
    expect(note).toContain('Nenhuma ação é automática');
    expect(note).toContain('Quem decide é a gestão');
  });

  it('CX-014: a frase da decisão quebra em mais linhas no celular em vez de ser cortada', async () => {
    const app = await open('u1');
    const row = pick(app.root, '[data-role="decisions"] .decision-row__text');
    expect(row.textContent?.trim().length).toBeGreaterThan(20);
    expect(row.className).toContain('decision-row__text');
  });

  it('CX-028: a fila do psicólogo segue a ordem da fila completa e o clique abre o caso', async () => {
    const app = await open('u3');
    const rows = pickAll<HTMLAnchorElement>(app.root, '[data-role="queue"] a');
    expect(rows.length).toBeGreaterThan(3);
    // O vermelho do dia da Ana abre o alerta dela, não a lista filtrada.
    expect(rows[0]?.getAttribute('href')).toBe('/app/acompanhamento/alertas/zal_0001');
    expect(rows[0]?.getAttribute('data-kind')).toBe('red');
    // Cada pessoa aparece uma vez só.
    const names = rows.map((r) => text(r.querySelector('.list-row__title') as HTMLElement));
    expect(new Set(names).size).toBe(names.length);
    // Quem tem escala vencida abre a aplicação daquele cuidador.
    const overdue = rows.find((r) => r.getAttribute('data-kind') === 'overdue');
    expect(overdue?.getAttribute('href')).toMatch(/^\/app\/acompanhamento\/zarit\/cg_\d{4}\/nova$/);
    // A mesma ordem da fila completa.
    const queue = await open('u3', '/app/acompanhamento/fila');
    const full = pickAll(queue.root, '[data-role="reason"]').map((r) => text(r));
    expect(full[0]).toBe('Contato do mesmo dia pendente');
  });

  it('CX-022: o painel da RT mostra o número exato; a tela de indicadores explica por que o número fica escondido', async () => {
    const rt = await open('u2');
    const kpi = pickAll(rt.root, 'app-panel-kpi').map((k) => text(k)).find((k) => k.startsWith('Alertas vermelhos abertos'));
    expect(kpi).toContain('2');
    const ind = await open('u2', '/app/indicadores?aba=cuidadores');
    const note = text(pick(ind.root, '[data-role="hidden-count-note"]'));
    expect(note).toContain('menos de 5');
    expect(note).toContain('fila de acompanhamento');
    expect(note).toContain('seu painel');
  });
});
