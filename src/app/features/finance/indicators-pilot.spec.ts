import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { pick, pickAll, text } from '../../shared/ui/testing/dom';
import { PilotStore } from './state/pilot.store';

async function open(userId: string, url: string): Promise<BootedApp> {
  TestBed.resetTestingModule();
  const app = await bootApp({ userId, url });
  await settle(app.fixture);
  return app;
}

const main = (app: BootedApp): string => text(pick(app.root, 'main'));
const tabLabels = (app: BootedApp): string[] =>
  pickAll(app.root, '[role="tablist"] [role="tab"]').map((t) => text(t));

describe('M10 Indicadores (SCR-M10-06, AC-M10-10 e 11)', () => {
  it('a sócia abre as quatro frentes e vê a distribuição por faixa sem nome de ninguém', async () => {
    const app = await open('u1', '/app/indicadores');
    expect(tabLabels(app)).toEqual(['Cuidadores', 'Rede', 'Equipe', 'Atendimento']);
    const t = main(app);
    expect(t).toContain('Sobrecarga por faixa');
    // Distribuição do seed (última aplicação de cada cuidador elegível).
    const table = text(pick(app.root, 'app-bar-chart table'));
    expect(table).toContain('0 a 20 28');
    expect(table).toContain('61 a 88 15');
    // Nunca nome de cuidador nem pontuação individual.
    for (const name of app.db.caregivers.list().slice(0, 29).map((c) => c.fullName)) {
      expect(t).not.toContain(name);
    }
    expect(t).not.toMatch(/CUI-\d{4}/);
  });

  it('conversão do seed: 5,0% (17 de 340) ao lado das referências de 3%, 5% e 7%', async () => {
    const app = await open('u1', '/app/indicadores?aba=cuidadores');
    const box = text(pick(app.root, '[data-role="conversion-card"]'));
    expect(box).toContain('5,0%');
    expect(box).toContain('17 de 340 usuários gratuitos');
    expect(pickAll(app.root, '[data-role="conversion-refs"] li').map((li) => text(li))).toEqual([
      'Referência 3%',
      'Referência 5%',
      'Referência 7%',
    ]);
  });

  it('recorte com menos de 5 aparece como "menos de 5", sem número', async () => {
    const app = await open('u1', '/app/indicadores?aba=cuidadores');
    const kpis = pickAll(app.root, 'app-kpi').map((k) => text(k));
    const red = kpis.find((k) => k.startsWith('Alertas vermelhos abertos')) as string;
    expect(red).toContain('menos de 5');
    expect(red.replace('menos de 5', '')).not.toMatch(/\d/);
  });

  it('as frentes seguem a URL em português e uma aba que o perfil não tem volta à primeira', async () => {
    const app = await open('u1', '/app/indicadores?aba=equipe');
    expect(main(app)).toContain('Ocupação da agenda');
    expect(main(app)).toContain('Dr. Rafael Moreira');
    expect(main(app)).toContain('91,3%');
    expect(text(pick(app.root, '[data-psychologist="psy_0001"] [data-role="overload"]'))).toContain(
      'acima de 80%',
    );
    const tab = await open('u7', '/app/indicadores?aba=equipe');
    expect(tabLabels(tab)).toEqual(['Atendimento']);
    expect(main(tab)).toContain('Prazo de resposta por canal');
  });

  it('rede: avaliação, faixas, taxa de recusa com risco de saída e entradas e saídas', async () => {
    const app = await open('u1', '/app/indicadores?aba=rede');
    const t = main(app);
    expect(t).toContain('Avaliação da rede');
    expect(t).toContain('Aline Cristina Pires');
    expect(text(pick(app.root, '[data-role="refusal"]'))).toContain('62,5%');
    expect(text(pick(app.root, '[data-role="refusal"]'))).toContain('Risco de saída');
    expect(text(pick(app.root, '[data-role="flow"]'))).toContain('Descredenciamentos');
  });

  it('o RT vê só cuidadores e equipe, sem valores em reais (AC-M10-15)', async () => {
    const app = await open('u2', '/app/indicadores');
    expect(tabLabels(app)).toEqual(['Cuidadores', 'Equipe']);
    expect(main(app)).not.toContain('R$');
    expect(main(app)).not.toContain('Conversão');
    expect(main(app)).not.toContain('Aline Cristina Pires');
  });

  it('o atendimento vê SLA e reclamações e nada de saúde nem de finanças (AC-M10-15)', async () => {
    const app = await open('u7', '/app/indicadores');
    expect(tabLabels(app)).toEqual(['Atendimento']);
    const t = main(app);
    expect(t).toContain('Prazo de resposta por canal');
    expect(t).toContain('Reclamações recebidas');
    expect(t).not.toContain('Sobrecarga');
    expect(t).not.toContain('Zarit');
    expect(t).not.toContain('R$');
    expect(pickAll(app.root, '[data-role="sla"] tbody tr')).toHaveLength(4);
  });

  it('o psicólogo vê só os agregados dos seus casos e a sua ocupação', async () => {
    const own = await open('u3', '/app/indicadores');
    const ownTable = text(pick(own.root, 'app-bar-chart table'));
    const all = await open('u1', '/app/indicadores');
    expect(ownTable).not.toBe(text(pick(all.root, 'app-bar-chart table')));
    const team = await open('u3', '/app/indicadores?aba=equipe');
    expect(main(team)).toContain('Dr. Rafael Moreira');
    expect(main(team)).not.toContain('Dra. Beatriz Nogueira');
  });
});

describe('M10 Piloto (SCR-M10-07, AC-M10-12 a 14)', () => {
  it('lista os 15 cuidadores com TCLE ativo, só por código; quem é de Uberaba não aparece', async () => {
    const app = await open('u1', '/app/piloto');
    const rows = pickAll(app.root, 'app-data-table tbody tr');
    expect(rows).toHaveLength(15);
    const codes = rows.map((r) => text(r).match(/CUI-\d{4}/)?.[0]);
    expect(codes).toContain('CUI-0003');
    expect(codes).toContain('CUI-0012');
    expect(codes).not.toContain('CUI-0025');
    for (const name of ['João Batista Carneiro', 'Terezinha Alves']) {
      expect(main(app)).not.toContain(name);
    }
    // TCLE revogado tira da coorte.
    const consent = app.db.consents.find((c) => c.caregiverId === 'cg_0003' && c.key === 'pilot_tcle');
    app.db.consents.update((consent as { id: string }).id, { status: 'revoked' });
    await settle(app.fixture);
    expect(pickAll(app.root, 'app-data-table tbody tr')).toHaveLength(14);
  });

  it('mostra as janelas, os 7 indicadores com instrumento e momento e fala em indício', async () => {
    const app = await open('u1', '/app/piloto');
    const t = main(app);
    expect(text(pick(app.root, '[data-role="window-counts"]'))).toContain('Adesão: 15 concluídas');
    const cards = pickAll(app.root, '[data-indicator]');
    expect(cards).toHaveLength(7);
    expect(text(cards[0] as Element)).toContain('Escala de Sobrecarga do Cuidador de Zarit');
    expect(text(cards[0] as Element)).toContain('Na adesão, aos 3 e aos 6 meses');
    expect(text(cards[0] as Element)).toContain('Aos 6 meses: menos de 5');
    expect(t).toContain('indício');
    expect(t.toLowerCase()).not.toContain('eficácia');
    expect(t.toLowerCase()).not.toContain('diagnóstico');
  });

  it('metas travadas: mudar exige justificativa e fica registrado; antes do início edita direto', async () => {
    const app = await open('u1', '/app/piloto');
    const store = TestBed.inject(PilotStore);
    expect(store.config().goalsLocked).toBe(true);
    expect(app.root.querySelector('[data-role="locked"]')).not.toBeNull();
    const goals = { zaritReductionPercent: 15, satisfactionMin: 4.2, conversionPercent: 4 };
    expect(store.saveGoals(goals, '').ok).toBe(false);
    expect(store.saveGoals(goals, 'curto').ok).toBe(false);
    expect(store.config().goals.zaritReductionPercent).toBe(10);
    expect(store.saveGoals(goals, 'Reunião dos sócios pediu metas mais ambiciosas.').ok).toBe(true);
    await settle(app.fixture);
    expect(store.config().goals.zaritReductionPercent).toBe(15);
    expect(store.config().goalChangeLog).toHaveLength(1);
    expect(text(pick(app.root, '[data-role="goal-log"]'))).toContain('Reunião dos sócios');
    expect(app.db.accessLog.list().some((e) => e.entity === 'pilot_goals')).toBe(true);

    // Antes do início: edição direta, sem justificativa e sem registro de mudança.
    app.db.pilotConfig.patch({ startedAt: undefined, goalsLocked: false, goalChangeLog: [] });
    await settle(app.fixture);
    expect(store.editableDirectly()).toBe(true);
    expect(store.saveGoals({ ...goals, conversionPercent: 5 }, '').ok).toBe(true);
    expect(store.config().goalChangeLog).toHaveLength(0);
    expect(store.config().goals.conversionPercent).toBe(5);
  });

  it('abrir a gaveta de metas travadas pede a justificativa em linha', async () => {
    const app = await open('u1', '/app/piloto');
    pick<HTMLButtonElement>(app.root, '[data-role="edit-goals"]').click();
    await settle(app.fixture);
    expect(text(pick(app.root, 'app-drawer'))).toContain('Piloto iniciado: a mudança exige justificativa');
    expect(app.root.querySelector('#pg-justification')).not.toBeNull();
    pick<HTMLFormElement>(app.root, '#pilot-goals-form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    expect(text(pick(app.root, 'app-drawer'))).toContain('Escreva a justificativa da mudança');
  });

  it('o RT vê o piloto agregado, sem editar metas e sem conversão nem valores', async () => {
    const app = await open('u2', '/app/piloto');
    expect(app.router.url).toBe('/app/piloto');
    expect(app.root.querySelector('[data-role="edit-goals"]')).toBeNull();
    expect(app.root.querySelector('[data-role="start"]')).toBeNull();
    const t = main(app);
    expect(t).toContain('Disponível só para a gestão');
    expect(t).not.toContain('R$');
    expect(pickAll(app.root, 'app-data-table tbody tr')).toHaveLength(15);
  });

  it.each(['u3', 'u7'])('%s não abre o piloto', async (userId) => {
    const app = await open(userId, '/app/piloto');
    expect(app.router.url).toBe('/403');
  });
});
