import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './content.routes';

const URL = '/cuidador/cuidar-de-mim/conteudos';

function titles(app: BootedCaregiverApp, section: string): string[] {
  const heading = Array.from(app.root.querySelectorAll('main h2')).find((h) => h.textContent?.trim() === section);
  const list = heading?.parentElement?.querySelector('ul');
  return Array.from(list?.querySelectorAll('.nx-read__title') ?? []).map((t) => t.textContent?.trim() ?? '');
}

async function click(app: BootedCaregiverApp, element: Element | null | undefined): Promise<void> {
  (element as HTMLElement).click();
  await settleCaregiver(app.fixture);
}

/**
 * Conteúdos (UX C11): AC-CG-109 a 112. Seed: 4 publicados para todos, 1 publicado exclusivo, 2 em revisão e 1 rascunho.
 */
describe('Área content (Conteúdos)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  [
    { url: URL, title: 'Conteúdos' },
    { url: `${URL}?conteudo=gdc_0001`, title: 'Conteúdos' },
    { url: `${URL}?conteudo=nao-existe`, title: 'Conteúdos' },
  ].forEach((c) => {
    it(`abre ${c.url} com o título "${c.title}" e um h1`, async () => {
      const app = await bootCaregiverApp('cg_0001', { url: c.url });
      expect(app.router.url).toBe(c.url);
      expect(app.root.querySelectorAll('main h1').length).toBe(1);
      expect(document.title).toContain(c.title);
    });
  });

  const sectionTitles = (app: BootedCaregiverApp): string[] =>
    Array.from(app.root.querySelectorAll('main section[data-category] h2')).map((h) => h.textContent?.trim() ?? '');
  const allTitles = (app: BootedCaregiverApp): string[] =>
    Array.from(app.root.querySelectorAll('main .nx-read__title')).map((t) => t.textContent?.trim() ?? '');

  it('AC-CG-109 (docs/20): os publicados aparecem por categoria, em seções na ordem fixa, com o tempo de leitura', async () => {
    const app = await bootCaregiverApp('cg_0002', { url: URL });
    expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Conteúdos');
    expect(sectionTitles(app)).toEqual([
      'Rotina e organização',
      'Cuidar de você',
      'Remédios e saúde',
      'Comunicação com a pessoa idosa',
      'Direitos e rede pública',
    ]);
    expect(titles(app, 'Remédios e saúde')).toEqual(['Prevenção de quedas em casa', 'Como organizar os medicamentos da semana']);
    expect(titles(app, 'Direitos e rede pública')).toEqual(['Onde buscar apoio na rede pública']);
    const times = Array.from(app.root.querySelectorAll('.nx-read__time')).map((d) => d.textContent?.trim());
    expect(times.every((d) => /^Leitura de \d+ minutos?$/.test(d ?? ''))).toBe(true);
    const text = app.root.textContent ?? '';
    ['Rotina de sono e descanso de quem cuida', 'Direitos da pessoa idosa', 'Alimentação e prevenção de engasgo'].forEach((t) =>
      expect(text).not.toContain(t),
    );
  });

  it('o filtro por categoria mostra só a seção escolhida; "Todas" volta', async () => {
    const app = await bootCaregiverApp('cg_0002', { url: URL });
    const chips = Array.from(app.root.querySelectorAll<HTMLButtonElement>('[data-role="filter"] button'));
    expect(chips.map((c) => c.textContent?.trim())).toEqual([
      'Todas',
      'Rotina e organização',
      'Cuidar de você',
      'Remédios e saúde',
      'Comunicação com a pessoa idosa',
      'Direitos e rede pública',
    ]);
    await click(app, chips[3]);
    expect(sectionTitles(app)).toEqual(['Remédios e saúde']);
    expect(chips[3]?.getAttribute('aria-pressed')).toBe('true');
    await click(app, chips[0]);
    expect(sectionTitles(app)).toHaveLength(5);
  });

  it('AC-CG-110 (docs/20): do Essencial em diante o exclusivo aparece na categoria dele, com o selo "Do seu plano"', async () => {
    for (const id of ['cg_0001', 'cg_0002', 'cg_0027', 'cg_0024']) {
      const app = await bootCaregiverApp(id, { url: URL });
      expect(titles(app, 'Rotina e organização')).toContain('Planilha de rotina semanal ampliada');
      expect(app.root.querySelectorAll('[data-role="exclusive"]')).toHaveLength(1);
      TestBed.resetTestingModule();
    }
  });

  it('AC-CG-110 (docs/20, regra 1): no Livre o exclusivo NÃO aparece, sem cadeado, sem cartão de bloqueio e sem "Ver os planos"', async () => {
    for (const id of ['cg_0003', 'cg_0004']) {
      const app = await bootCaregiverApp(id, { url: URL });
      expect(allTitles(app)).not.toContain('Planilha de rotina semanal ampliada');
      expect(allTitles(app)).toHaveLength(6);
      const text = app.root.querySelector('main')?.textContent ?? '';
      expect(text).not.toMatch(/Disponível no plano|Do seu plano|Ver os planos|exclusiv/i);
      expect(app.root.querySelector('main svg[data-icon="lock"], .cg-plan-lock')).toBeNull();
      TestBed.resetTestingModule();
    }
  });

  it('abre a leitura em folha de tela cheia com ?conteudo=, com tempo, parágrafos, aviso e Voltar (AC-CG-111, S-21)', async () => {
    const app = await bootCaregiverApp('cg_0002', { url: URL });
    const row = Array.from(app.root.querySelectorAll('button.nx-read')).find((b) => b.textContent?.includes('Pausas curtas para quem cuida'));
    await click(app, row);
    expect(app.router.url).toBe(`${URL}?conteudo=gdc_0002`);
    expect(app.root.querySelectorAll('main h1').length).toBe(1);
    expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Pausas curtas para quem cuida');
    const reading = app.root.querySelector('[data-role="reading"]') as HTMLElement;
    expect(reading.querySelector('[data-role="reading-time"]')?.textContent).toMatch(/^Leitura de 1 minuto$/);
    expect(reading.textContent).toContain('Reserve momentos de descanso ao longo do dia');
    expect(app.root.textContent).toContain(
      'Este conteúdo orienta e não substitui o médico, o psicólogo ou outro profissional. Dúvida sobre remédio: fale com o médico ou a farmácia.',
    );
    // Nada de lista junto da leitura, o foco foi ao título e "Voltar" leva de volta à lista.
    expect(app.root.querySelector('.nx-reads')).toBeNull();
    expect(document.activeElement?.tagName).toBe('H1');
    const back = Array.from(app.root.querySelectorAll('.cg-action-bar a')).find((a) => a.textContent?.trim() === 'Voltar');
    await click(app, back);
    expect(app.router.url).toBe(URL);
    expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Conteúdos');
    expect(app.root.querySelectorAll('.nx-reads').length).toBeGreaterThan(0);
  });

  it('a leitura do conteúdo exclusivo abre para quem tem o plano e não existe para o Livre (sem revelar o título)', async () => {
    const essencial = await bootCaregiverApp('cg_0002', { url: `${URL}?conteudo=gdc_0005` });
    expect(essencial.root.querySelector('main h1')?.textContent?.trim()).toBe('Planilha de rotina semanal ampliada');
    TestBed.resetTestingModule();
    const livre = await bootCaregiverApp('cg_0003', { url: `${URL}?conteudo=gdc_0005` });
    expect(livre.root.textContent).toContain('Não encontramos esta leitura.');
    expect(livre.root.textContent).not.toContain('Planilha de rotina semanal ampliada');
    expect(livre.root.querySelector('main h1')?.textContent?.trim()).toBe('Conteúdos');
  });

  it('leitura inexistente, em revisão ou rascunho: "Não encontramos esta leitura." com Voltar', async () => {
    for (const id of ['nao-existe', 'gdc_0006', 'gdc_0007', 'gdc_0008']) {
      const app = await bootCaregiverApp('cg_0001', { url: `${URL}?conteudo=${id}` });
      expect(app.root.textContent).toContain('Não encontramos esta leitura.');
      const back = Array.from(app.root.querySelectorAll('main a')).find((a) => a.textContent?.trim() === 'Voltar');
      expect(back?.getAttribute('href')).toBe(URL);
      TestBed.resetTestingModule();
    }
  });

  it('sem leituras publicadas, mostra o vazio acolhedor', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: URL });
    app.db.guidanceContents.updateWhere(() => true, { status: 'draft' });
    await settleCaregiver(app.fixture);
    expect(app.root.textContent).toContain('Ainda não há leituras');
    expect(app.root.textContent).toContain('Quando a equipe publicar, elas aparecem aqui.');
  });

  it('AC-CG-112: a lista é a mesma para quem tem pontuações e alertas diferentes (nada é escolhido por Zarit, faixa, alerta ou ARBE)', async () => {
    const lists: string[][] = [];
    for (const id of ['cg_0001', 'cg_0002', 'cg_0027', 'cg_0024']) {
      const app = await bootCaregiverApp(id, { url: URL });
      lists.push(allTitles(app));
      const text = (app.root.textContent ?? '').toLowerCase();
      expect(text).not.toMatch(/zarit|pontua|faixa|arbe|sobrecarga|risco/);
      TestBed.resetTestingModule();
    }
    lists.forEach((l) => expect(l).toEqual(lists[0]));
  });
});
