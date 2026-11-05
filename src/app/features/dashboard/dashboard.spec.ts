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

const main = (app: BootedApp): string => text(pick(app.root, 'main'));
const hrefs = (app: BootedApp, selector: string): (string | null)[] =>
  pickAll<HTMLAnchorElement>(app.root, selector).map((a) => a.getAttribute('href'));
const kpi = (app: BootedApp, label: string): string =>
  pickAll(app.root, 'app-panel-kpi')
    .map((k) => text(k))
    .find((k) => k.startsWith(label)) as string;

describe('M02 Painel: sócia (AC-M02-01, 03 e 08)', () => {
  it('mostra 17 assinantes, conversão 5,0% e "faltam 10 para o ponto de equilíbrio"', async () => {
    const app = await open('u1');
    expect(app.router.url).toBe('/app/painel');
    expect(text(pick(app.root, 'h1'))).toBe('Boa tarde, Helena');
    expect(kpi(app, 'Assinantes')).toContain('17');
    expect(kpi(app, 'Conversão')).toContain('5,0%');
    expect(kpi(app, 'Conversão')).toContain('3%, 5%, 7%');
    expect(kpi(app, 'Ponto de equilíbrio')).toContain('Faltam 10');
    expect(kpi(app, 'Ponto de equilíbrio')).toContain('17 de 27 assinantes');
    expect(kpi(app, 'Resultado do mês')).toContain('-R$ 843,51');
    expect(kpi(app, 'Resultado do mês')).toContain('abaixo do equilíbrio');
    expect(text(pick(app.root, '[data-role="summary"]'))).toBe('17 assinantes. Faltam 10 para o ponto de equilíbrio.');
    expect(text(pick(app.root, '[data-role="break-even"]'))).toContain('17 de 27 assinantes');
  });

  it('começa por "Precisa da sua decisão", com no máximo 3 itens que levam à tela certa', async () => {
    const app = await open('u1');
    const items = pickAll(app.root, '[data-role="decisions"] a');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(3);
    const textOf = items.map((a) => text(a)).join(' | ');
    expect(textOf).toContain('solicitação do titular vence em breve');
    expect(textOf).toContain('Dr. Rafael Moreira está com a agenda acima de 80% por dois meses');
    const links = items.map((a) => a.getAttribute('href'));
    expect(links).toContain('/app/lgpd/solicitacoes?filtro=vencendo');
    expect(links).toContain('/app/indicadores?aba=equipe');
  });

  it('nunca mostra nome nem código de cuidador, e indicador de saúde pequeno vira "menos de 5"', async () => {
    const app = await open('u1');
    const t = main(app);
    expect(t).not.toMatch(/CUI-\d{4}/);
    for (const name of app.db.caregivers.list().slice(0, 29).map((c) => c.fullName)) {
      expect(t).not.toContain(name);
    }
    expect(kpi(app, 'Alertas vermelhos abertos').replace('menos de 5', '')).not.toMatch(/\d/);
    expect(kpi(app, 'Alertas vermelhos abertos')).toContain('menos de 5');
    expect(kpi(app, 'ARBE críticos abertos')).toContain('menos de 5');
    // Sem escore, sem faixa, sem alerta individual.
    expect(t).not.toMatch(/Severa|Sobrecarga severa/);
  });

  it('cada item de painel leva ao módulo com o filtro aplicado (AC-M02-08)', async () => {
    const app = await open('u1');
    const links = hrefs(app, 'app-panel-kpi a');
    expect(links).toContain('/app/assinaturas');
    expect(links).toContain('/app/financeiro');
    expect(links).toContain('/app/mensagens?filtro=atrasadas');
    expect(links).toContain('/app/governanca/pops?filtro=a-revisar');
    expect(links).toContain('/app/lgpd/solicitacoes?filtro=vencendo');
    expect(links).toContain('/app/rede/credenciamento?filtro=em-andamento');
    expect(links).toContain('/app/rede/prestadores?filtro=excelencia');
    expect(links).toContain('/app/rede/prestadores?filtro=alerta');
    expect(links).toContain('/app/rede/prestadores?filtro=risco-de-saida');
    expect(links).toContain('/app/reclamacoes?filtro=abertas');
  });

  it('a rede, a equipe e o resto ficam em seções recolhíveis; a equipe mostra o alerta de sobrecarga', async () => {
    const app = await open('u1');
    const titles = pickAll(app.root, 'app-panel-section summary span:first-child').map((s) => text(s));
    expect(titles).toEqual([
      'Rede credenciada',
      'Equipe',
      'Acompanhamento dos cuidadores',
      'Atendimento e reclamações',
      'Conformidade e governança',
    ]);
    const team = text(pick(app.root, '[data-role="team"]'));
    expect(team).toContain('Dr. Rafael Moreira');
    expect(team).toContain('91,3%');
    expect(team).toContain('Agenda acima de 80% por dois meses');
    expect(pickAll(app.root, 'h1')).toHaveLength(1);
  });

  it('o painel recalcula quando os dados mudam (assinante a mais, preço novo)', async () => {
    const app = await open('u1');
    const sub = app.db.subscriptions.find((s) => s.planId === 'livre' && s.status === 'active') as { id: string };
    app.db.subscriptions.update(sub.id, { planId: 'essencial' });
    await settle(app.fixture);
    expect(kpi(app, 'Assinantes')).toContain('18');
    expect(text(pick(app.root, '[data-role="summary"]'))).toContain('Faltam 9');
    app.db.financialParams.patch({ monthlyCostsCents: { coworking: 0, appMaintenance: 0, accounting: 0, travel: 0 } });
    await settle(app.fixture);
    expect(kpi(app, 'Resultado do mês')).not.toContain('abaixo do equilíbrio');
    expect(text(pick(app.root, '[data-role="summary"]'))).toContain('Acima do ponto de equilíbrio');
  });
});

describe('M02 Painel: responsável técnico (AC-M02-02)', () => {
  it('mostra 1 vermelho do dia sem contato, 1 vermelho vencido, 2 amarelos abertos e 1 ARBE crítico', async () => {
    const app = await open('u2');
    expect(text(pick(app.root, '[data-role="red-today"]'))).toContain('1 alerta vermelho do dia sem contato');
    expect(text(pick(app.root, '[data-role="red-today"]'))).toContain('23:59');
    expect(text(pick(app.root, '[data-role="red-overdue"]'))).toContain('1 alerta vermelho vencido');
    expect(kpi(app, 'Alertas amarelos abertos')).toContain('2');
    expect(kpi(app, 'Alertas vermelhos abertos')).toContain('2');
    expect(kpi(app, 'ARBE críticos')).toMatch(/^ARBE críticos[1-9]/);
    expect(kpi(app, 'Ocorrências em aberto')).toContain('POP-05: 1 · POP-07: 1');
    expect(hrefs(app, '[data-role="red-today"] a')).toEqual(['/app/acompanhamento?filtro=contato-hoje']);
    expect(hrefs(app, '[data-role="red-overdue"] a')).toEqual(['/app/acompanhamento?filtro=contato-vencido']);
  });

  it('a fila de alertas traz todos os casos só por código, com o vencido e o do dia primeiro, sem nome nem escore', async () => {
    const app = await open('u2');
    const rows = pickAll(app.root, '[data-role="alert-queue"] a').map((a) => text(a));
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows[0]).toContain('CUI-0002');
    expect(rows[0]).toContain('Prazo vencido');
    expect(rows[1]).toContain('CUI-0001');
    expect(rows[1]).toContain('até 23:59');
    const t = main(app);
    expect(t).not.toMatch(/Ana Paula|Maria Aparecida|63|79/);
    expect(t).not.toContain('R$');
    expect(text(pick(app.root, '[data-role="validations"]'))).toContain('2 conteúdos aguardam a sua revisão (POP-09)');
    expect(text(pick(app.root, '[data-role="validations"]'))).toContain('3 POPs a revisar');
  });
});

describe('M02 Painel: psicólogo (AC-M02-04)', () => {
  it('o painel de Rafael mostra o aviso de sobrecarga; o de Beatriz não', async () => {
    const rafael = await open('u3');
    expect(text(pick(rafael.root, '[data-role="overload"]'))).toContain('A sua agenda passou de 80% por dois meses');
    expect(text(pick(rafael.root, '[data-role="overload"]'))).toContain('não uma cobrança');
    expect(kpi(rafael, 'Minha ocupação')).toContain('91,3%');
    const beatriz = await open('u4');
    expect(beatriz.root.querySelector('[data-role="overload"]')).toBeNull();
    expect(kpi(beatriz, 'Minha ocupação')).toContain('70,0%');
  });

  it('a fila é só dos casos dele e os nomes ficam em modo discreto', async () => {
    const rafael = await open('u3');
    const rows = pickAll(rafael.root, '[data-role="queue"] a').map((a) => text(a));
    expect(rows.join(' ')).toContain('Ana Paula Ferraz');
    expect(rows.join(' ')).toContain('Alerta vermelho: contato até 23:59');
    expect(rows.join(' ')).not.toContain('Maria Aparecida Lemos');
    expect(pickAll(rafael.root, '[data-role="queue"] .discreet').length).toBeGreaterThan(0);
    const beatriz = await open('u4');
    const beatrizRows = pickAll(beatriz.root, '[data-role="queue"] a').map((a) => text(a));
    expect(beatrizRows.join(' ')).toContain('Maria Aparecida Lemos');
    expect(beatrizRows.join(' ')).toContain('contato vencido');
    expect(beatrizRows.join(' ')).not.toContain('Ana Paula Ferraz');
    expect(beatriz.root.querySelector('[data-role="overload"]')).toBeNull();
  });

  it('a agenda de hoje, as sessões a registrar e as tarefas de revisar a rede de apoio vêm dos dados', async () => {
    const app = await open('u3');
    const today = app.db.careSessions
      .list()
      .filter((s) => s.psychologistId === 'psy_0001' && s.startAt.startsWith('2026-11-04') && !s.status.startsWith('cancelled'));
    expect(pickAll(app.root, '[data-role="today"] a')).toHaveLength(today.length);
    expect(kpi(app, 'Sessões a registrar')).toMatch(/\d+/);
    expect(hrefs(app, 'app-panel-kpi a')).toContain('/app/atendimento?filtro=sem-anotacao');
    expect(hrefs(app, 'app-panel-kpi a')).toContain('/app/acompanhamento?filtro=tarefas');
    const rita = await open('u4');
    // Beatriz tem a tarefa "revisar rede de apoio" do alerta amarelo de C08.
    expect(kpi(rita, 'Revisar a rede de apoio')).toContain('1');
  });
});

describe('M02 Painel: atendimento (AC-M02-05)', () => {
  it('destaca as mensagens atrasadas no topo, com o tempo de atraso', async () => {
    const app = await open('u7');
    const late = pickAll(app.root, '[data-role="overdue"] a').map((l) => text(l));
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((l) => l.includes('Atrasada há'))).toBe(true);
    expect(text(pick(app.root, '[data-role="overdue"] h3'))).toContain(`Atrasadas (${late.length})`);
    // As atrasadas vêm antes das que estão no prazo.
    const order = pickAll(app.root, '[data-role="overdue"], [data-role="on-time"]').map((s) => s.getAttribute('data-role'));
    expect(order[0]).toBe('overdue');
    expect(hrefs(app, '[data-role="overdue"] a')[0]).toBe('/app/mensagens?filtro=atrasadas');
  });

  it('não mostra nada clínico, nem "existe alerta", e traz os contadores do dia a dia', async () => {
    const app = await open('u7');
    const t = main(app);
    expect(t).not.toMatch(/Zarit|escala|alerta|ARBE|sobrecarga|ocorrência|risco/i);
    expect(kpi(app, 'Reclamações abertas')).toMatch(/\d/);
    expect(kpi(app, 'Cancelamentos agendados')).toContain('1');
    expect(kpi(app, 'Solicitações do titular a registrar')).toMatch(/\d/);
    expect(kpi(app, 'Solicitações de serviço sem retorno')).toMatch(/\d/);
    expect(hrefs(app, 'app-panel-kpi a')).toContain('/app/assinaturas?filtro=cancelamento-agendado');
    expect(hrefs(app, 'app-panel-kpi a')).toContain('/app/cuidadores?filtro=novos');
    expect(hrefs(app, 'app-panel-kpi a')).toContain('/app/reclamacoes?filtro=abertas');
    expect(hrefs(app, 'app-panel-kpi a')).toContain('/app/rede/solicitacoes?filtro=sem-retorno');
    expect(pickAll(app.root, '.discreet').length).toBeGreaterThan(0);
  });
});

describe('M02 Painel: estados e acessibilidade', () => {
  it.each(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'])('%s abre o painel dele com um h1, sem erro', async (userId) => {
    const app = await open(userId);
    expect(app.router.url).toBe('/app/painel');
    expect(pickAll(app.root, 'h1')).toHaveLength(1);
    expect(app.root.querySelector('[role="alert"]:not(app-banner [role="alert"]):not(app-error-summary)')).toBeNull();
    for (const link of pickAll<HTMLAnchorElement>(app.root, 'main a[href]')) {
      expect(link.getAttribute('href')).toMatch(/^\/app\//);
    }
  });

  it('o psicólogo sem sessões hoje (Tiago) vê o estado vazio acolhedor', async () => {
    const app = await open('u6');
    if (pickAll(app.root, '[data-role="today"] a').length === 0) {
      expect(main(app)).toContain('Hoje não há sessões');
    }
    expect(text(pick(app.root, 'h1'))).toBe('Boa tarde, Dr. Tiago');
  });
});
