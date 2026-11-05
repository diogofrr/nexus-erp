import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { typeInto } from '../../../shared/ui/testing/dom';
import { ContactDialogService } from '../state/contact-dialog.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';

const URL = '/cuidador/rede/buscar';
const norm = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();
const mainText = (app: BootedCaregiverApp): string => norm(app.root.querySelector('main')?.textContent);

async function click(app: BootedCaregiverApp, element: Element | null | undefined): Promise<void> {
  if (!element) {
    throw new Error('Elemento não encontrado para clicar');
  }
  (element as HTMLElement).click();
  await settleCaregiver(app.fixture);
}

const names = (app: BootedCaregiverApp): string[] =>
  Array.from(app.root.querySelectorAll('main [data-role="result"] .nx-result__link')).map((a) => norm(a.textContent));

const result = (app: BootedCaregiverApp, name: string): HTMLElement | undefined =>
  Array.from(app.root.querySelectorAll<HTMLElement>('main [data-role="result"]')).find((r) => norm(r.querySelector('.nx-result__link')?.textContent) === name);

const category = (app: BootedCaregiverApp, value: string): HTMLElement | null => app.root.querySelector(`main [data-category="${value}"]`);

const compareBoxes = (app: BootedCaregiverApp): HTMLInputElement[] =>
  Array.from(app.root.querySelectorAll<HTMLInputElement>('main [data-role="result"] input[type="checkbox"]'));

const openSheet = (app: BootedCaregiverApp): HTMLDialogElement | null => app.root.querySelector<HTMLDialogElement>('main dialog.cg-sheet[open]');

/** Buscar profissionais e serviços (UX C13): AC-CG-116 a 123. */
describe('Buscar profissionais e serviços', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('a necessidade (AC-CG-116)', () => {
    it('mostra o h1, o campo "Buscar pelo nome" e as 10 necessidades; nada de lista antes de escolher', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Buscar');
      expect(norm(app.root.querySelector('main label[for]')?.textContent)).toContain('Buscar pelo nome');
      expect(norm(app.root.querySelector('main h2')?.textContent)).toBe('O que você procura?');
      expect(Array.from(app.root.querySelectorAll('main .nx-cat')).map((b) => norm(b.textContent))).toEqual([
        'Fisioterapia',
        'Cuidador(a)',
        'Home care',
        'Enfermagem',
        'Farmácia',
        'Clínica',
        'Psicologia',
        'Nutrição',
        'Advocacia',
        'Serviço especializado',
      ]);
      expect(app.root.querySelector('main [data-role="result"]')).toBeNull();
    });

    it('ao escolher uma, a URL ganha ?categoria= e a lista mostra a contagem ("5 opções em Fisioterapia.")', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      await click(app, category(app, 'physiotherapy'));
      expect(app.router.url).toBe(`${URL}?categoria=physiotherapy`);
      expect(norm(app.root.querySelector('[data-role="count"]')?.textContent)).toBe('5 opções em Fisioterapia.');
      expect(category(app, 'physiotherapy')?.getAttribute('aria-pressed')).toBe('true');
      expect(category(app, 'pharmacy')?.getAttribute('aria-pressed')).toBe('false');
      expect(names(app).length).toBe(5);
    });

    it('as contagens seguem o seed (Cuidador(a) 3, Farmácia 2)', async () => {
      const count = async (c: string): Promise<string> => {
        const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=${c}` });
        const text = norm(app.root.querySelector('[data-role="count"]')?.textContent);
        TestBed.resetTestingModule();
        return text;
      };
      expect(await count('professional_caregiver')).toBe('3 opções em Cuidador(a).');
      expect(await count('pharmacy')).toBe('2 opções em Farmácia.');
    });

    it('uma categoria que não existe na URL é ignorada', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=qualquer-coisa` });
      expect(app.root.querySelector('main [data-role="count"]')).toBeNull();
    });
  });

  describe('sempre mais de uma opção (AC-CG-117)', () => {
    it('com uma só (home care, enfermagem, psicologia, advocacia): "Única opção disponível no momento." e ela aparece', async () => {
      for (const [c, name] of [['home_care', 'Cuidar Bem Home Care'], ['nursing', 'Enf. Priscila Gouveia'], ['psychology', 'Dra. Valéria Costa'], ['legal', 'Dr. Heitor Magalhães']] as const) {
        const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=${c}` });
        expect(norm(app.root.querySelector('[data-role="single"]')?.textContent)).toBe('Única opção disponível no momento.');
        expect(names(app)).toEqual([name]);
        expect(norm(app.root.querySelector('[data-role="count"]')?.textContent)).toMatch(/^1 opção em /);
        TestBed.resetTestingModule();
      }
    });

    it('sem nenhuma (clínica, nutrição, serviço especializado): vazio acolhedor com Falar com a gente', async () => {
      for (const [c, label] of [['clinic', 'Clínica'], ['nutrition', 'Nutrição'], ['specialized_service', 'Serviço especializado']] as const) {
        const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=${c}` });
        const empty = app.root.querySelector('[data-role="empty"]') as HTMLElement;
        expect(norm(empty.querySelector('.empty__title')?.textContent)).toBe(`Nenhuma opção em ${label} por enquanto`);
        expect(norm(empty.textContent)).toContain('Estamos ampliando a rede. A equipe pode ajudar a procurar.');
        expect(app.root.querySelector('main [data-role="single"]')).toBeNull();
        TestBed.resetTestingModule();
      }
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=clinic` });
      const talk = Array.from(app.root.querySelectorAll<HTMLElement>('main [data-role="empty"] button')).find((b) => norm(b.textContent) === 'Falar com a gente');
      await click(app, talk);
      expect(TestBed.inject(ContactDialogService).isOpen()).toBe(true);
    });
  });

  describe('quem nunca aparece (AC-CG-118)', () => {
    const hidden = [
      'Clínica Saúde Integral',
      'Nutri Camila Rezende',
      'Dra. Isadora Leal',
      'Equipamentos Cuidar+',
      'Cuidadores Express',
      'Dr. Otávio Lima',
    ];
    const categories = ['physiotherapy', 'professional_caregiver', 'home_care', 'nursing', 'pharmacy', 'clinic', 'psychology', 'nutrition', 'legal', 'specialized_service'];

    it('suspenso, descredenciado, reprovado e candidato não aparecem em nenhuma lista, e nada de faixa, risco de saída, recusa ou comissão', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      for (const c of categories) {
        await app.router.navigateByUrl(`${URL}?categoria=${c}`);
        await settleCaregiver(app.fixture);
        const text = mainText(app);
        hidden.forEach((name) => expect(text).not.toContain(name));
        expect(text.toLowerCase()).not.toMatch(/monitoramento|risco de sa[ií]da|recusa|comiss|acompanhamento|faixa|excel[eê]ncia|descredenci/);
      }
    });

    it('o profissional em monitoramento aparece como qualquer outro, com o mesmo formato de cartão', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      const monitored = result(app, 'Fisio em Casa Uberlândia');
      const normal = result(app, 'Dra. Sônia Peixoto');
      expect(monitored).toBeDefined();
      const shape = (el: HTMLElement | undefined): string[] => Array.from(el?.querySelectorAll('[data-role], .nx-meta') ?? []).map((e) => e.getAttribute('data-role') ?? e.className);
      expect(shape(monitored)).toEqual(['nx-meta', 'rating']);
      expect(shape(normal)).toEqual(['nx-meta', 'rating']);
      expect(norm(monitored?.textContent)).not.toMatch(/monitor|acompanh/i);
    });

    it('o texto da busca por nome também não traz quem saiu da rede', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      const input = app.root.querySelector<HTMLInputElement>('main input[type="search"]') as HTMLInputElement;
      typeInto(input, 'camila');
      await settleCaregiver(app.fixture);
      expect(norm(app.root.querySelector('[data-role="empty"] .empty__title')?.textContent)).toBe('Nada encontrado para camila');
    });
  });

  describe('a ordem (AC-CG-119)', () => {
    it('em destaque primeiro e os demais em ordem alfabética, sem tirar ninguém e sem dizer "recomendado"', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      expect(names(app)).toEqual([
        'Clínica Movimento Vital',
        'Dr. Eduardo Falcão',
        'Dra. Renata Sampaio',
        'Dra. Sônia Peixoto',
        'Fisio em Casa Uberlândia',
      ]);
      const highlighted = Array.from(app.root.querySelectorAll('main [data-role="result"]')).map((r) => norm(r.textContent).includes('Em destaque'));
      expect(highlighted).toEqual([true, true, true, false, false]);
      expect(mainText(app).toLowerCase()).not.toMatch(/recomend|indicad|melhor|escolha da nexus/);
    });
  });

  describe('a nota (AC-CG-120)', () => {
    it('com 5 avaliações ou mais mostra "Nota 4,5 (N avaliações)"; com menos, "Ainda sem nota (menos de 5 avaliações)"', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=pharmacy` });
      const rating = (name: string): string => norm(result(app, name)?.querySelector('[data-role="rating"]')?.textContent);
      const count = (id: string): number => app.db.providerEvaluations.count((e) => e.providerId === id);
      expect(rating('Farmácia Vida Plena')).toBe(`Nota 4,5 (${count('prv_08')} avaliações)`);
      expect(rating('Drogaria Santa Clara')).toBe(`Nota 4,0 (${count('prv_09')} avaliações)`);
      TestBed.resetTestingModule();
      const psy = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=psychology` });
      expect(norm(psy.root.querySelector('[data-role="rating"]')?.textContent)).toBe('Ainda sem nota (menos de 5 avaliações)');
    });
  });

  describe('o cartão de resultado', () => {
    it('mostra nome, especialidade e cidade, "Atende em casa" e "Em destaque"; o cartão inteiro abre a ficha', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      const card = result(app, 'Dra. Renata Sampaio') as HTMLElement;
      expect(norm(card.querySelector('.nx-meta')?.textContent)).toBe('Fisioterapia geriátrica · Uberlândia');
      expect(norm(card.textContent)).toContain('Atende em casa');
      expect(norm(card.textContent)).toContain('Em destaque');
      expect(card.querySelector('a.nx-result__link')?.getAttribute('href')).toBe('/cuidador/rede/profissional/prv_01');
      // Um só link por cartão: a caixa "Comparar" não fica dentro dele.
      expect(card.querySelectorAll('a').length).toBe(1);
      expect(card.querySelector('label.check input')?.getAttribute('aria-label')).toBe('Comparar Dra. Renata Sampaio');
    });

    it('tocar no nome abre a ficha', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      await click(app, result(app, 'Dr. Eduardo Falcão')?.querySelector('a.nx-result__link'));
      expect(app.router.url).toBe('/cuidador/rede/profissional/prv_11');
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Dr. Eduardo Falcão');
    });
  });

  describe('comparar (AC-CG-121 e 123)', () => {
    it('com 1 caixa não há barra; com 2 aparece "Comparar escolhidos (2)" e a folha lado a lado', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      await click(app, compareBoxes(app)[0]);
      expect(app.root.querySelector('[data-role="compare"]')).toBeNull();
      await click(app, compareBoxes(app)[1]);
      const bar = app.root.querySelector('[data-role="compare"]') as HTMLElement;
      expect(norm(bar.textContent)).toBe('Comparar escolhidos (2)');
      await click(app, bar);
      const sheet = openSheet(app) as HTMLDialogElement;
      expect(norm(sheet.querySelector('.cg-sheet__title')?.textContent)).toBe('Lado a lado');
      const columns = Array.from(sheet.querySelectorAll('[data-role="compare-col"]'));
      expect(columns.length).toBe(2);
      columns.forEach((col) => {
        expect(Array.from(col.querySelectorAll('dt')).map((d) => norm(d.textContent))).toEqual(['Nota', 'Atende em casa', 'Condições']);
        expect(norm(col.querySelector('a')?.textContent)).toBe('Ver ficha');
      });
      expect(norm(columns[0]?.querySelector('h3')?.textContent)).toBe('Clínica Movimento Vital');
      expect(norm(columns[0]?.querySelectorAll('dd')[1]?.textContent)).toBe('Não');
      expect(norm(columns[1]?.querySelectorAll('dd')[1]?.textContent)).toBe('Não');
      expect(norm(columns[1]?.querySelector('h3')?.textContent)).toBe('Dr. Eduardo Falcão');
    });

    it('com 3 marcadas, as outras caixas ficam sem uso com o motivo escrito', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      for (const box of compareBoxes(app).slice(0, 3)) {
        await click(app, box);
      }
      expect(norm(app.root.querySelector('[data-role="compare"]')?.textContent)).toBe('Comparar escolhidos (3)');
      expect(compareBoxes(app).map((b) => b.disabled)).toEqual([false, false, false, true, true]);
      expect(norm(app.root.querySelector('[data-role="compare-limit"]')?.textContent)).toBe('Você já escolheu 3. Desmarque um para comparar outro.');
      await click(app, compareBoxes(app)[0]);
      expect(compareBoxes(app).every((b) => !b.disabled)).toBe(true);
      expect(app.root.querySelector('[data-role="compare-limit"]')).toBeNull();
    });

    it('AC-CG-123: no Livre compara, mas a linha de condições diz "a partir do plano Essencial"; do Essencial em diante mostra as condições', async () => {
      const joao = await bootCaregiverApp('cg_0003', { url: `${URL}?categoria=physiotherapy` });
      await click(joao, compareBoxes(joao)[0]);
      await click(joao, compareBoxes(joao)[1]);
      await click(joao, joao.root.querySelector('[data-role="compare"]'));
      const joaoText = norm(openSheet(joao)?.textContent);
      expect(joaoText).toContain('Condições especiais: a partir do plano Essencial.');
      expect(joaoText).not.toContain('Horário prioritário');
      TestBed.resetTestingModule();
      const maria = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      await click(maria, compareBoxes(maria)[0]);
      await click(maria, compareBoxes(maria)[1]);
      await click(maria, maria.root.querySelector('[data-role="compare"]'));
      expect(norm(openSheet(maria)?.textContent)).toContain('Horário prioritário');
      expect(norm(openSheet(maria)?.textContent)).not.toContain('a partir do plano Essencial');
    });

    it('trocar a necessidade limpa o que estava marcado', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      await click(app, compareBoxes(app)[0]);
      await click(app, compareBoxes(app)[1]);
      expect(app.root.querySelector('[data-role="compare"]')).not.toBeNull();
      await click(app, category(app, 'pharmacy'));
      expect(app.root.querySelector('[data-role="compare"]')).toBeNull();
    });
  });

  describe('os filtros (AC-CG-122)', () => {
    it('"Só quem atende em casa" filtra a lista, marca aria-pressed, a contagem acompanha e vai à URL', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      const toggle = app.root.querySelector('[data-role="home-filter"]') as HTMLElement;
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      await click(app, toggle);
      expect(app.router.url).toBe(`${URL}?categoria=physiotherapy&casa=1`);
      expect((app.root.querySelector('[data-role="home-filter"]') as HTMLElement).getAttribute('aria-pressed')).toBe('true');
      expect(names(app)).toEqual(['Dra. Renata Sampaio', 'Fisio em Casa Uberlândia']);
      expect(norm(app.root.querySelector('[data-role="count"]')?.textContent)).toBe('2 opções que atendem em casa em Fisioterapia.');
      await click(app, app.root.querySelector('[data-role="home-filter"]'));
      expect(names(app).length).toBe(5);
      expect(app.router.url).toBe(`${URL}?categoria=physiotherapy`);
    });

    it('o texto digitado em "Buscar pelo nome" filtra, mas NUNCA vai para a URL', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=physiotherapy` });
      const input = app.root.querySelector<HTMLInputElement>('main input[type="search"]') as HTMLInputElement;
      typeInto(input, 'Renata');
      await settleCaregiver(app.fixture);
      expect(names(app)).toEqual(['Dra. Renata Sampaio']);
      expect(app.router.url).toBe(`${URL}?categoria=physiotherapy`);
      expect(app.router.url).not.toContain('Renata');
    });

    it('buscar só pelo nome, sem acento, acha em qualquer necessidade', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      typeInto(app.root.querySelector<HTMLInputElement>('main input[type="search"]') as HTMLInputElement, 'sonia');
      await settleCaregiver(app.fixture);
      expect(names(app)).toEqual(['Dra. Sônia Peixoto']);
      expect(norm(app.root.querySelector('[data-role="count"]')?.textContent)).toBe('1 resultado.');
    });

    it('nada encontrado: "Nada encontrado para Márcia" com a dica; filtro sem resultado oferece ver todas as opções', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      typeInto(app.root.querySelector<HTMLInputElement>('main input[type="search"]') as HTMLInputElement, 'Márcia');
      await settleCaregiver(app.fixture);
      expect(norm(app.root.querySelector('[data-role="empty"] .empty__title')?.textContent)).toBe('Nada encontrado para Márcia');
      expect(norm(app.root.querySelector('[data-role="empty"]')?.textContent)).toContain('Confira o nome ou escolha uma necessidade.');
      TestBed.resetTestingModule();
      const farm = await bootCaregiverApp('cg_0002', { url: `${URL}?categoria=pharmacy&casa=1` });
      expect(norm(farm.root.querySelector('[data-role="empty"] .empty__title')?.textContent)).toBe('Ninguém atende em casa em Farmácia');
      await click(farm, Array.from(farm.root.querySelectorAll<HTMLElement>('main [data-role="empty"] button')).find((b) => norm(b.textContent) === 'Ver todas as opções'));
      expect(names(farm).length).toBe(2);
    });
  });

  it('nada na busca depende de pontuação, faixa, alerta ou ARBE', async () => {
    for (const id of ['cg_0001', 'cg_0002']) {
      const app = await bootCaregiverApp(id, { url: `${URL}?categoria=physiotherapy` });
      expect(mainText(app).toLowerCase()).not.toMatch(/zarit|pontua|alerta|arbe|sobrecarga|risco/);
      TestBed.resetTestingModule();
    }
  });
});
