import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './groups.routes';

const URL = '/cuidador/cuidar-de-mim/grupos';
const detail = (id: string): string => `${URL}?atividade=${id}`;

const norm = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();
const mainText = (app: BootedCaregiverApp): string => norm(app.root.querySelector('main')?.textContent);

async function click(app: BootedCaregiverApp, element: Element | null | undefined): Promise<void> {
  if (!element) {
    throw new Error('Elemento não encontrado para clicar');
  }
  (element as HTMLElement).click();
  await settleCaregiver(app.fixture);
}

const byText = (app: BootedCaregiverApp, selector: string, label: string): HTMLElement | undefined =>
  Array.from(app.root.querySelectorAll<HTMLElement>(selector)).find((e) => norm(e.textContent) === label);

const openSheet = (app: BootedCaregiverApp): HTMLDialogElement | null => app.root.querySelector<HTMLDialogElement>('main dialog.cg-sheet[open]');
const sheetText = (app: BootedCaregiverApp): string => norm(openSheet(app)?.textContent);

const card = (app: BootedCaregiverApp, title: string): HTMLElement | undefined =>
  Array.from(app.root.querySelectorAll<HTMLElement>('[data-role="activity"]')).find((c) => norm(c.querySelector('.cg-card__title')?.textContent) === title);

/** Os títulos das seções por tipo, sem a contagem. */
const sections = (app: BootedCaregiverApp): string[] =>
  Array.from(app.root.querySelectorAll('main app-cg-section[data-kind] .cg-section__title')).map((h) => norm(h.textContent).replace(/ \(\d+\)$/, ''));

/** Os cartões de uma seção por tipo. */
const sectionCards = (app: BootedCaregiverApp, kind: string): string[] =>
  Array.from(app.root.querySelectorAll(`main app-cg-section[data-kind="${kind}"] [data-role="activity"] .cg-card__title`)).map((t) => norm(t.textContent));

/** Encontros (docs/20-regras-planos-v2.md; UX C10): AC-CG-99 a 108 na versão das regras v2. */
describe('Área groups (Encontros)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  [URL, detail('act_0001'), detail('nao-existe')].forEach((url) => {
    it(`abre ${url} com o título "Encontros" e um h1`, async () => {
      const app = await bootCaregiverApp('cg_0001', { url });
      expect(app.router.url).toBe(url);
      expect(document.title).toContain('Encontros');
      expect(app.root.querySelectorAll('main h1').length).toBe(1);
    });
  });

  describe('a programação por tipo (docs/20, regras 2 e 3)', () => {
    it('Cuida: Minhas inscrições, Capacitações e Terapia em grupo, nesta ordem, com contagem e selo (sem roda de conversa)', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Encontros');
      expect(norm(app.root.querySelector('[data-role="mine"] .cg-section__title')?.textContent)).toBe('Minhas inscrições (2)');
      expect(sections(app)).toEqual(['Capacitações', 'Terapia em grupo']);
      expect(app.root.querySelector('main app-cg-section[data-kind="open_circle"]')).toBeNull();
      expect(mainText(app)).not.toMatch(/roda de conversa/i);
      expect(sectionCards(app, 'training')).toEqual(['Primeiros socorros em casa', 'Higiene e banho no leito']);
      expect(sectionCards(app, 'group_therapy')).toEqual(['Organização da rotina', 'Lidar com as perdas, em grupo']);
      // Cada seção leva o selo do tipo, com ícone e nome (nunca só a cor).
      expect(norm(app.root.querySelector('app-cg-section[data-kind="training"] app-cg-event-badge')?.textContent)).toBe('Capacitação');
      // Cada cartão: o tipo, a data e a hora, o local, as vagas ou "Lista de espera".
      const higiene = norm(card(app, 'Higiene e banho no leito')?.textContent);
      expect(higiene).toContain('Capacitação');
      expect(higiene).toContain('Próximo encontro: seg, 16/11, às 09:00');
      expect(higiene).toContain('No espaço de coworking · Lista de espera');
      expect(higiene).toContain('Incluída no seu plano');
      expect(norm(card(app, 'Organização da rotina')?.textContent)).toContain('On-line');
    });

    it('Livre e Essencial: a terapia em grupo não aparece em lugar nenhum, sem cadeado nem "Disponível no plano"', async () => {
      // Sem roda de conversa, Livre e Essencial só têm a seção de capacitações; com um tipo só, o filtro não aparece.
      for (const id of ['cg_0002', 'cg_0003']) {
        const app = await bootCaregiverApp(id, { url: URL });
        expect(sections(app), id).toEqual(['Capacitações']);
        expect(app.root.querySelector('[data-role="filter"]'), id).toBeNull();
        const text = mainText(app);
        ['Terapia em grupo', 'Sobrecarga e autocuidado', 'Organização da rotina', 'Lidar com as perdas'].forEach((t) => expect(text, id).not.toContain(t));
        expect(text).not.toMatch(/Disponível no plano|a partir do plano|Plano Cuida|Ver os planos/);
        expect(app.root.querySelector('main svg[data-icon="lock"], .cg-plan-lock, [data-role="plan-tag"]')).toBeNull();
        TestBed.resetTestingModule();
      }
    });

    it('a capacitação diz se é incluída ou o valor: Maria (2 de 2 usadas) paga a próxima; o Livre tem 1 incluída e, além dela, lê "Você pode participar pagando por encontro"', async () => {
      const maria = await bootCaregiverApp('cg_0002', { url: URL });
      expect(norm(card(maria, 'Primeiros socorros em casa')?.querySelector('[data-role="card-offer"]')?.textContent)).toBe('R$ 40,00 por encontro');
      TestBed.resetTestingModule();
      const joao = await bootCaregiverApp('cg_0003', { url: URL });
      expect(norm(card(joao, 'Prevenção de quedas')?.querySelector('[data-role="card-offer"]')?.textContent)).toBe('Você pode participar pagando por encontro');
      // João não está em nenhum encontro: sem "Minhas inscrições", todas as capacitações ficam na seção, cada uma com o valor.
      // O Livre tem 1 capacitação por mês: a de 1 encontro em novembro cabe; as de 2 encontros não cabem e são avulsas.
      expect(joao.root.querySelector('[data-role="mine"]')).toBeNull();
      expect(sectionCards(joao, 'training')).toEqual(['Primeiros socorros em casa', 'Prevenção de quedas', 'Higiene e banho no leito']);
      const offers: Record<string, string> = {
        'Primeiros socorros em casa': 'Incluída no seu plano (1 de 1 neste mês)',
        'Prevenção de quedas': 'Você pode participar pagando por encontro',
        'Higiene e banho no leito': 'Você pode participar pagando por encontro',
      };
      sectionCards(joao, 'training').forEach((title) =>
        expect(norm(card(joao, title)?.querySelector('[data-role="card-offer"]')?.textContent), title).toBe(offers[title]),
      );
    });

    it('o filtro por tipo aparece com mais de um tipo e mostra só a seção escolhida', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      const chips = Array.from(app.root.querySelectorAll<HTMLButtonElement>('[data-role="filter"] button'));
      expect(chips.map((c) => norm(c.textContent))).toEqual(['Todos', 'Capacitação', 'Terapia em grupo']);
      await click(app, chips[2]);
      expect(sections(app)).toEqual(['Terapia em grupo']);
      expect(app.root.querySelector('[data-role="mine"]')).toBeNull();
      await click(app, chips[1]);
      expect(sections(app)).toEqual(['Capacitações']);
      await click(app, chips[0]);
      expect(sections(app)).toHaveLength(2);
    });

    it('"Minhas inscrições" mostra o próximo encontro e a posição na lista de espera', async () => {
      const ana = await bootCaregiverApp('cg_0001', { url: URL });
      const rows = Array.from(ana.root.querySelectorAll('[data-role="mine"] .cg-row')).map(
        (r) => `${norm(r.querySelector('.cg-row__title')?.textContent)} | ${norm(r.querySelector('.cg-row__desc')?.textContent)}`,
      );
      expect(rows).toEqual([
        'Sobrecarga e autocuidado | Próximo encontro: sáb, 07/11, às 14:00 · com Jessica Rosa',
        'Prevenção de quedas | Próximo encontro: sáb, 14/11, às 14:00 · com Dra. Renata Sampaio',
      ]);
      TestBed.resetTestingModule();
      const lourdes = await bootCaregiverApp('cg_0024', { url: URL });
      expect(norm(lourdes.root.querySelector('[data-role="mine"]')?.textContent)).toContain(
        'Você está na lista de espera, posição 1. Com Jessica Rosa.',
      );
    });

    it('rascunho, cancelado e encerrado não aparecem; sem encontros, o vazio acolhedor', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      ['Prevenção de conflitos familiares', 'Administração segura de medicamentos', 'Comunicação com pessoas com demência'].forEach((t) =>
        expect(mainText(app)).not.toContain(t),
      );
      app.db.activities.updateWhere(() => true, { status: 'draft' });
      await settleCaregiver(app.fixture);
      expect(mainText(app)).toContain('Ainda não há encontros neste mês');
    });

    it('tocar no cartão abre o detalhe com ?atividade= e o foco vai ao título; Voltar leva à lista', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await click(app, card(app, 'Organização da rotina'));
      expect(app.router.url).toBe(detail('act_0008'));
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Organização da rotina');
      expect(document.activeElement?.tagName).toBe('H1');
      await click(app, app.root.querySelector('main a.cg-page-header__back'));
      expect(app.router.url).toBe(URL);
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Encontros');
    });

    it('encontro em rascunho, cancelado, inexistente ou de terapia em grupo para o Essencial: "Não encontramos este encontro."', async () => {
      for (const [who, id] of [['cg_0001', 'act_0007'], ['cg_0001', 'act_0006'], ['cg_0001', 'nao-existe'], ['cg_0002', 'act_0008']] as const) {
        const app = await bootCaregiverApp(who, { url: detail(id) });
        expect(mainText(app)).toContain('Não encontramos este encontro.');
        expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Encontros');
        TestBed.resetTestingModule();
      }
    });
  });

  describe('o detalhe', () => {
    it('quem conduz mostra o CRP entre parênteses, sempre com a palavra "fictício"', async () => {
      const app = await bootCaregiverApp('cg_0008', { url: detail('act_0001') });
      expect(norm(app.root.querySelector('[data-role="leader"]')?.textContent)).toBe(
        'Conduzido por Jessica Rosa, da equipe de psicologia (CRP-04/00102, fictício).',
      );
    });

    it('cada cartão mostra quem conduz, pelo nome e sem "Dr." nem "Dra." para a equipe de psicologia', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      const leaders = Array.from(app.root.querySelectorAll('[data-role="card-leader"]')).map((l) => norm(l.textContent));
      expect(leaders.length).toBeGreaterThan(0);
      leaders.forEach((l) => expect(l).toMatch(/^Com \S/));
      const psychologists = new Set(app.db.psychologists.list().map((p) => p.displayName));
      // Pelo menos um cartão é conduzido por alguém da equipe de psicologia, com o nome como está no cadastro.
      expect(leaders.some((l) => psychologists.has(l.replace(/^Com /, '')))).toBe(true);
      app.db.activities
        .list()
        .flatMap((a) => a.leaders)
        .filter((l) => l.type === 'psychologist')
        .forEach((l) => expect(psychologists.has(l.name), l.name).toBe(true));
    });

    it('mostra o tipo, o caráter explicado, todos os encontros, quem conduz e as vagas', async () => {
      const app = await bootCaregiverApp('cg_0008', { url: detail('act_0001') });
      expect(norm(app.root.querySelector('[data-role="kind"]')?.textContent)).toBe('Terapia em grupo');
      expect(norm(app.root.querySelector('[data-role="character"]')?.textContent)).toBe('Psicoterapia em grupo');
      expect(Array.from(app.root.querySelectorAll('main dl li')).map((li) => norm(li.textContent))).toEqual([
        'sáb, 07/11, às 14:00',
        'sáb, 21/11, às 14:00',
        'sáb, 05/12, às 14:00',
      ]);
      // Quem conduz vem pelo nome, sem "Dr."/"Dra." e sem supor gênero, com o CRP marcado "fictício". A frase exata está no primeiro teste do detalhe.
      const leader = norm(app.root.querySelector('[data-role="leader"]')?.textContent);
      expect(leader.startsWith('Conduzido por Jessica Rosa, da equipe de psicologia')).toBe(true);
      expect(leader).not.toMatch(/Dra?\./);
      expect(leader).toContain('CRP-04/00102, fictício');
      expect(norm(app.root.querySelector('[data-role="seats"]')?.textContent)).toBe('Lista de espera');
      expect(app.root.querySelector('[data-role="room-access"]')?.textContent?.trim()).toBe(
        'Sala com acesso sem degraus, sanitário adaptado, boa iluminação e assentos com apoio de braços.',
      );
    });

    it('não fala de pontuação, faixa, alerta nem promete resultado (AC-CG-108)', async () => {
      for (const [id, url] of [['cg_0001', detail('act_0001')], ['cg_0002', URL], ['cg_0003', detail('act_0009')]] as const) {
        const app = await bootCaregiverApp(id, { url });
        expect(mainText(app).toLowerCase()).not.toMatch(/zarit|pontua|faixa|alerta|arbe|sobrecarga severa|vai melhorar|vai aliviar|cura\b/);
        TestBed.resetTestingModule();
      }
    });
  });

  describe('entrar: sigilo, cota e avulso (AC-CG-100 e 101)', () => {
    it('Quero participar abre a folha do sigilo; sem marcar, mostra o erro e não inscreve', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0009') });
      await click(app, app.root.querySelector('[data-role="join"]'));
      expect(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent?.trim()).toBe('Contrato de sigilo do grupo');
      expect(sheetText(app)).toContain('Incluída no seu plano.');
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(sheetText(app)).toContain('Marque que você leu o contrato de sigilo para entrar.');
      expect(app.db.activityEnrollments.count((e) => e.activityId === 'act_0009' && e.caregiverId === 'cg_0001')).toBe(0);
    });

    it('capacitação incluída: com o aceite grava data e hora e consome a cota; o encontro vai a "Minhas inscrições"', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0009') });
      await click(app, app.root.querySelector('[data-role="join"]'));
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      expect(app.root.querySelector('[data-role="stamp"]')?.textContent?.trim()).toBe('Aceito em 04/11/2026, às 12:00');
      expect(openSheet(app)?.querySelector('[data-role="confirm-join"]')?.textContent?.trim()).toBe('Entrar na capacitação');
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0009' && e.caregiverId === 'cg_0001')).toMatchObject({
        status: 'enrolled',
        confidentialityAcceptedAt: '2026-11-04T12:00:00-03:00',
        includedInPlan: true,
        paid: false,
      });
      const result = norm(app.root.querySelector('[data-role="result"]')?.textContent);
      expect(result).toBe('Você está na capacitação Primeiros socorros em casa. Primeiro encontro: qui, 12/11, às 19:00.');
      expect(TestBed.inject(ToastService).toasts().find((t) => t.message === result)).toBeUndefined();
      await click(app, app.root.querySelector('main a.cg-page-header__back'));
      expect(norm(app.root.querySelector('[data-role="mine"]')?.textContent)).toContain('Primeiros socorros em casa');
    });

    it('capacitação incluída no Livre (1 por mês): a de 1 encontro entra sem valor e consome a cota', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: detail('act_0009') });
      expect(norm(app.root.querySelector('[data-role="offer"]')?.textContent)).toBe('Incluída no seu plano (1 de 1 neste mês)');
      await click(app, app.root.querySelector('[data-role="join"]'));
      expect(openSheet(app)?.querySelector('[data-role="paid"]')).toBeNull();
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0009' && e.caregiverId === 'cg_0003')).toMatchObject({
        paid: false,
        priceCents: 0,
        includedInPlan: true,
      });
    });

    it('capacitação avulsa no Livre: além da cota, a folha diz o valor por encontro, sem campo de cartão, e grava paga (simulado)', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: detail('act_0002') });
      expect(norm(app.root.querySelector('[data-role="offer"]')?.textContent)).toBe('Você pode participar pagando por encontro');
      await click(app, app.root.querySelector('[data-role="join"]'));
      expect(norm(openSheet(app)?.querySelector('[data-role="paid"]')?.textContent)).toBe(
        'R$ 40,00 por encontro: R$ 80,00 por 2 encontros neste mês. O pagamento é combinado depois. No protótipo não há cobrança.',
      );
      expect(Array.from(openSheet(app)?.querySelectorAll('input') ?? []).every((i) => i.type === 'checkbox')).toBe(true);
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0002' && e.caregiverId === 'cg_0003')).toMatchObject({
        paid: true,
        priceCents: 8000,
        includedInPlan: false,
      });
    });

    it('terapia em grupo dentro da cota: "Incluída no seu plano (2 de 2 neste mês)"; entra no grupo sem valor e consome a cota', async () => {
      const app = await bootCaregiverApp('cg_0027', { url: URL });
      // Elza sai da G3: a cota de terapia em grupo de novembro fica livre para a G8.
      app.db.activityEnrollments.removeWhere((e) => e.caregiverId === 'cg_0027' && e.activityId === 'act_0003');
      await app.router.navigateByUrl(detail('act_0008'));
      await settleCaregiver(app.fixture);
      expect(norm(app.root.querySelector('[data-role="offer"]')?.textContent)).toBe('Incluída no seu plano (2 de 2 neste mês)');
      await click(app, app.root.querySelector('[data-role="join"]'));
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      expect(openSheet(app)?.querySelector('[data-role="confirm-join"]')?.textContent?.trim()).toBe('Entrar no grupo');
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0027')).toMatchObject({
        status: 'enrolled',
        includedInPlan: true,
        paid: false,
      });
    });

    it('terapia em grupo além da cota: avulsa a R$ 60,00 o encontro (Ana já usou os 2 da G1)', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0008') });
      expect(norm(app.root.querySelector('[data-role="offer"]')?.textContent)).toBe('R$ 60,00 por encontro');
      await click(app, app.root.querySelector('[data-role="join"]'));
      expect(norm(openSheet(app)?.querySelector('[data-role="paid"]')?.textContent)).toContain('R$ 60,00 por encontro: R$ 120,00 por 2 encontros neste mês.');
    });
  });

  describe('lista de espera (AC-CG-102)', () => {
    it('lotado, o botão é "Entrar na lista de espera" e a folha diz a posição; depois mostra a posição', async () => {
      const app = await bootCaregiverApp('cg_0017', { url: detail('act_0001') });
      const join = app.root.querySelector<HTMLElement>('[data-role="join"]');
      expect(join?.textContent?.trim()).toBe('Entrar na lista de espera');
      await click(app, join);
      expect(sheetText(app)).toContain('Você entra na posição 3.');
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(app.root.querySelector('[data-role="result"]')?.textContent?.trim()).toBe('Você entrou na lista de espera, posição 3.');
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0017')).toMatchObject({ status: 'waitlist', waitlistPosition: 3 });
    });

    it('Lourdes e Elza já estão na fila: veem a posição e "Sair da lista"', async () => {
      const lourdes = await bootCaregiverApp('cg_0024', { url: detail('act_0001') });
      expect(norm(lourdes.root.querySelector('[data-role="standing"]')?.textContent)).toContain('Você está na lista de espera, posição 1. Avisamos quando abrir uma vaga.');
      expect(byText(lourdes, 'main button', 'Sair da lista')).toBeDefined();
      TestBed.resetTestingModule();
      const elza = await bootCaregiverApp('cg_0027', { url: detail('act_0001') });
      expect(elza.root.querySelector('[data-role="standing"]')?.textContent).toContain('posição 2');
    });
  });

  describe('sair (AC-CG-106)', () => {
    it('a folha diz que a vaga volta para outra pessoa; ao confirmar, cancela e promove o primeiro da fila', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0001') });
      await click(app, byText(app, 'main button', 'Sair do grupo'));
      expect(sheetText(app)).toContain('Você deixa de participar. A sua vaga volta para outra pessoa.');
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-leave"]'));
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0001')?.status).toBe('cancelled');
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0024')?.status).toBe('enrolled');
      expect(app.root.querySelector('[data-role="result"]')?.textContent).toContain('Você saiu do grupo. A sua vaga voltou para outra pessoa.');
    });

    it('em andamento, as inscrições estão encerradas', async () => {
      const app = await bootCaregiverApp('cg_0009', { url: detail('act_0003') });
      expect(app.root.querySelector('[data-role="standing"]')?.textContent?.trim()).toBe('Em andamento. As inscrições estão encerradas.');
      expect(app.root.querySelector('[data-role="join"]')).toBeNull();
    });
  });
});
