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

  it('AC-CG-109: "Para todos" lista só os publicados não exclusivos, do mais novo ao mais antigo, com o tempo de leitura', async () => {
    const app = await bootCaregiverApp('cg_0002', { url: URL });
    expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Conteúdos');
    expect(app.root.textContent).toContain('Leituras curtas. Escolha uma.');
    expect(titles(app, 'Para todos')).toEqual([
      'Prevenção de quedas em casa',
      'Conversar com a pessoa idosa sobre as decisões do dia a dia',
      'Pausas curtas para quem cuida',
      'Como organizar os medicamentos da semana',
    ]);
    const descriptions = Array.from(app.root.querySelectorAll('.nx-read__time')).map((d) => d.textContent?.trim());
    expect(descriptions.every((d) => /^Leitura de \d+ minutos?$/.test(d ?? ''))).toBe(true);
    // Em revisão e rascunho nunca aparecem.
    const text = app.root.textContent ?? '';
    ['Rotina de sono e descanso de quem cuida', 'Direitos da pessoa idosa', 'Alimentação e prevenção de engasgo'].forEach((t) =>
      expect(text).not.toContain(t),
    );
  });

  it('AC-CG-110: do Essencial em diante aparece "Do seu plano" desbloqueada, sem cadeado', async () => {
    for (const id of ['cg_0001', 'cg_0002', 'cg_0027', 'cg_0024']) {
      const app = await bootCaregiverApp(id, { url: URL });
      expect(titles(app, 'Do seu plano')).toEqual(['Planilha de rotina semanal ampliada']);
      expect(app.root.querySelector('.cg-plan-lock')).toBeNull();
      TestBed.resetTestingModule();
    }
  });

  it('AC-CG-110: o plano Livre vê UM cartão "Disponível no plano Essencial" e nenhum título exclusivo como isca', async () => {
    for (const id of ['cg_0003', 'cg_0004']) {
      const app = await bootCaregiverApp(id, { url: URL });
      const locks = app.root.querySelectorAll('.cg-plan-lock');
      expect(locks.length).toBe(1);
      const lock = locks[0] as HTMLElement;
      expect(lock.textContent).toContain('Disponível no plano Essencial');
      expect(lock.textContent).toContain('Os conteúdos exclusivos fazem parte do plano Essencial. Seu plano agora é o Livre.');
      expect(lock.textContent).toContain('Todas as leituras acima são para você.');
      expect(lock.querySelector('a')?.textContent?.trim()).toBe('Ver os planos');
      expect(lock.querySelector('a')?.getAttribute('href')).toBe('/cuidador/mais/plano');
      expect(app.root.textContent).not.toContain('Planilha de rotina semanal ampliada');
      expect(app.root.textContent).not.toContain('Do seu plano');
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
      lists.push(titles(app, 'Para todos'));
      const text = (app.root.textContent ?? '').toLowerCase();
      expect(text).not.toMatch(/zarit|pontua|faixa|arbe|sobrecarga|risco/);
      TestBed.resetTestingModule();
    }
    lists.forEach((l) => expect(l).toEqual(lists[0]));
  });
});
