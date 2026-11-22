import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { toIsoDateTime } from '@core/clock/date-utils';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './guide.routes';
import { FAQ_TOPICS, GUIDE_STEPS, normalizeSearch, visibleFaq } from './state/guide-content';
import { GUIDE_STORAGE_KEY } from './state/guide-progress.service';

/**
 * Guia do cuidador: "Começando a cuidar" (passos com progresso salvo por pessoa) e "Perguntas frequentes" (por assunto,
 * com busca e sem anunciar o que o plano não inclui). Também o cartão de Hoje para quem acabou de se cadastrar e as
 * entradas em Mais.
 */
const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Área guide (Começando a cuidar e Perguntas frequentes)', () => {
  let app: BootedCaregiverApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null => app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] => Array.from(app.root.querySelectorAll<T>(selector));
  const flush = (): Promise<void> => settleCaregiver(app.fixture);
  const click = async (el: Element | null | undefined): Promise<void> => {
    if (!el) {
      throw new Error('elemento não encontrado');
    }
    (el as HTMLElement).click();
    await flush();
  };
  const type = async (el: HTMLInputElement | null, value: string): Promise<void> => {
    if (!el) {
      throw new Error('campo não encontrado');
    }
    el.value = value;
    el.dispatchEvent(new Event('input'));
    await flush();
  };

  afterEach(() => TestBed.resetTestingModule());

  it('exporta as duas rotas, com título', () => {
    expect(ROUTES.map((r) => [r.path, r.data?.['title']])).toEqual([
      ['', 'Começando a cuidar'],
      ['perguntas', 'Perguntas frequentes'],
    ]);
  });

  describe('o conteúdo', () => {
    it('9 passos com id único, como fazer e sem palavra proibida; perguntas com id único e resposta', () => {
      expect(GUIDE_STEPS).toHaveLength(9);
      expect(new Set(GUIDE_STEPS.map((s) => s.id)).size).toBe(9);
      GUIDE_STEPS.forEach((s) => expect(s.todo.length).toBeGreaterThan(0));
      const ids = FAQ_TOPICS.flatMap((t) => t.items.map((i) => i.id));
      expect(new Set(ids).size).toBe(ids.length);
      const everything = normalizeSearch(
        JSON.stringify([GUIDE_STEPS, FAQ_TOPICS]),
      );
      ['roda de conversa', 'paciente', 'idoso ', 'guerreira', 'eficacia', '!'].forEach((word) =>
        expect(everything.includes(word), word).toBe(false),
      );
    });

    it('a busca ignora acento e caixa e exige todas as palavras; pergunta de plano só para quem tem o recurso', () => {
      const all = () => true;
      const none = () => false;
      const ids = (topics: ReturnType<typeof visibleFaq>) => topics.flatMap((t) => t.items.map((i) => i.id));
      expect(ids(visibleFaq(FAQ_TOPICS, all, 'REMEDIO'))).toContain('mark_given');
      expect(ids(visibleFaq(FAQ_TOPICS, all, 'samu 192'))).toContain('when_samu');
      expect(ids(visibleFaq(FAQ_TOPICS, all, 'xyz nada'))).toEqual([]);
      expect(ids(visibleFaq(FAQ_TOPICS, all))).toEqual(expect.arrayContaining(['group_therapy', 'psychologist']));
      expect(ids(visibleFaq(FAQ_TOPICS, none))).not.toContain('group_therapy');
      expect(ids(visibleFaq(FAQ_TOPICS, none))).not.toContain('psychologist');
    });
  });

  describe('Começando a cuidar', () => {
    it('abre com as duas fases, os passos fechados e o anel em 0 de 9', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais/guia' });
      expect(app.router.url).toBe('/cuidador/mais/guia');
      expect(text(q('main h1'))).toBe('Começando a cuidar');
      expect(all('.gd-phase__title').map(text)).toEqual(['Nos primeiros dias', 'Nas primeiras semanas']);
      expect(all('[data-step]')).toHaveLength(9);
      expect(all<HTMLDetailsElement>('details[data-step]').every((d) => !d.open)).toBe(true);
      expect(text(q('[data-role="guide-progress"] h2'))).toBe('0 de 9 passos feitos');
      expect(q('app-cg-progress-ring')?.getAttribute('aria-label')).toContain('0 de 9');
    });

    it('"Marcar como feito" salva por pessoa no navegador e volta ao entrar de novo; desmarcar também', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais/guia' });
      const step = q('[data-step="medicines"]');
      await click(step?.querySelector('[data-role="toggle-done"]'));
      expect(step?.classList.contains('is-done')).toBe(true);
      expect(step?.querySelector('[data-role="toggle-done"]')?.getAttribute('aria-pressed')).toBe('true');
      expect(text(q('[data-role="guide-progress"] h2'))).toBe('1 de 9 passos feitos');
      const saved = JSON.parse(app.local.getItem(`nexus-erp:${GUIDE_STORAGE_KEY}`) ?? '{}');
      expect(saved['cg_0003'].done).toEqual(['medicines']);
      expect(saved['cg_0001']).toBeUndefined();

      await click(step?.querySelector('[data-role="toggle-done"]'));
      expect(step?.classList.contains('is-done')).toBe(false);
      expect(text(q('[data-role="guide-progress"] h2'))).toBe('0 de 9 passos feitos');
    });

    it('cada passo com atalho leva à tela certa do aplicativo', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais/guia' });
      const link = q<HTMLAnchorElement>('[data-step="medicines"] a.cg-link-btn');
      expect(text(link)).toBe('Cadastrar os remédios');
      expect(link?.getAttribute('href')).toBe('/cuidador/rotina/remedios');
    });
  });

  describe('Perguntas frequentes', () => {
    it('Livre: os assuntos sem as perguntas de terapia e de psicólogo; com elas no Cuida', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais/guia/perguntas' });
      expect(text(q('main h1'))).toBe('Perguntas frequentes');
      expect(all('.faq-topic__title').map(text)).toEqual([
        'Sobre o aplicativo',
        'Remédios e rotina',
        'Cuidar de você',
        'Emergências',
        'A Nexus e a rede',
      ]);
      expect(q('[data-question="group_therapy"]')).toBeNull();
      expect(q('[data-question="psychologist"]')).toBeNull();
      TestBed.resetTestingModule();
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais/guia/perguntas' });
      expect(q('[data-question="group_therapy"]')).not.toBeNull();
      expect(q('[data-question="psychologist"]')).not.toBeNull();
    });

    it('a busca filtra e abre as respostas; sem resultado, o caminho é falar com a Nexus', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais/guia/perguntas' });
      const search = q<HTMLInputElement>('[data-role="faq-search"]');
      await type(search, 'samu');
      const found = all<HTMLDetailsElement>('details[data-question]');
      expect(found.map((d) => d.getAttribute('data-question'))).toEqual(expect.arrayContaining(['when_samu', 'distress']));
      expect(found.every((d) => d.open)).toBe(true);
      await type(search, 'palavra que nao existe');
      expect(all('details[data-question]')).toHaveLength(0);
      expect(text(q('main'))).toContain('Nenhuma pergunta encontrada');
      expect(q<HTMLAnchorElement>('a[href="/cuidador/mais/ajuda"]')).not.toBeNull();
    });
  });

  describe('as entradas', () => {
    it('Mais, em Ajuda: Começando a cuidar e Perguntas frequentes', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais' });
      const help = text(q('[data-role="group-help"]'));
      expect(help).toContain('Começando a cuidar');
      expect(help).toContain('O essencial para os primeiros dias');
      expect(help).toContain('Perguntas frequentes');
      expect(q('[data-role="group-help"] a[href="/cuidador/mais/guia"]')).not.toBeNull();
      expect(q('[data-role="group-help"] a[href="/cuidador/mais/guia/perguntas"]')).not.toBeNull();
    });

    it('Hoje mostra o cartão só para quem se cadastrou há até 30 dias; "Não mostrar mais aqui" esconde e fica salvo', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/hoje' });
      expect(q('[data-role="guide-card"]')).toBeNull();
      TestBed.resetTestingModule();

      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais' });
      // Como se a pessoa tivesse acabado de se cadastrar (createdAt é campo gerido: troca direto na coleção).
      const fresh = toIsoDateTime(app.clock.today(), '09:00');
      app.db.caregivers.replaceAll(app.db.caregivers.list().map((c) => (c.id === 'cg_0003' ? { ...c, createdAt: fresh } : c)));
      await app.router.navigateByUrl('/cuidador/hoje');
      await flush();
      const card = q('[data-role="guide-card"]');
      expect(text(card)).toContain('Começou a cuidar agora?');
      expect(text(card)).toContain('0 de 9 passos feitos');
      expect(q<HTMLAnchorElement>('[data-role="guide-card"] a')?.getAttribute('href')).toBe('/cuidador/mais/guia');
      await click(q('[data-role="guide-hide"]'));
      expect(q('[data-role="guide-card"]')).toBeNull();
      const saved = JSON.parse(app.local.getItem(`nexus-erp:${GUIDE_STORAGE_KEY}`) ?? '{}');
      expect(saved['cg_0003'].hidden).toBe(true);
    });
  });
});
