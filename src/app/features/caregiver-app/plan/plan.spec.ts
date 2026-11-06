import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionError, SubscriptionService } from '../../../core/commerce/subscription.service';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './plan.routes';

const URL = '/cuidador/mais/plano';
const BOARD = `${URL}?ver=planos`;

const norm = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();
/** Os parágrafos de um bloco, separados por espaço (os `<p>` ficam sem espaço entre eles no `textContent`). */
const paragraphs = (element: Element | null | undefined): string =>
  Array.from(element?.querySelectorAll('p') ?? []).map((p) => norm(p.textContent)).join(' ');
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
const confirmButton = (app: BootedCaregiverApp): Element | null | undefined => openSheet(app)?.querySelector('[data-role="confirm"]');

const subOf = (app: BootedCaregiverApp, id: string) => app.db.subscriptions.find((s) => s.caregiverId === id && s.status !== 'cancelled')!;

/** Abre o quadro, escolhe o plano e devolve a folha do efeito. */
async function choose(app: BootedCaregiverApp, plan: string): Promise<void> {
  await app.router.navigateByUrl(BOARD);
  await settleCaregiver(app.fixture);
  await click(app, app.root.querySelector(`main [data-plan="${plan}"]`));
}

/** Meu plano (UX C18 e B9): AC-CG-149 a 158. */
describe('Área plan (Meu plano)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  [URL, BOARD].forEach((url) => {
    it(`abre ${url} com o título "Meu plano" e um h1`, async () => {
      const app = await bootCaregiverApp('cg_0001', { url });
      expect(app.router.url).toBe(url);
      expect(document.title).toContain('Meu plano');
      expect(app.root.querySelectorAll('main h1').length).toBe(1);
    });
  });

  describe('o herói: o plano atual (AC-CG-149)', () => {
    it('Ana (Cuida): a cor do plano, o nome, o preço, a situação e 4 destaques; Ver outros planos é a ação principal e Cancelar plano um link calmo', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Meu plano');
      const card = app.root.querySelector('[data-role="current-plan"]') as HTMLElement;
      expect(card.classList.contains('cg-tone--cuida')).toBe(true);
      expect(norm(card.querySelector('h2')?.textContent)).toBe('Plano Cuida');
      expect(norm(card.querySelector('[data-role="price"]')?.textContent)).toBe('R$ 119,90 por mês');
      expect(norm(card.querySelector('[data-role="situation"]')?.textContent)).toBe('Próxima cobrança em 06/11/2026');
      // Só 4 destaques de cara: a lista longa fica atrás de "Ver tudo que inclui".
      expect(Array.from(card.querySelectorAll('[data-role="perks"] li')).map((li) => norm(li.textContent))).toEqual([
        'Grupos de apoio',
        'Capacitações',
        'Maior suporte à organização',
        'Descontos exclusivos do Cartão Nexus',
      ]);
      expect(openSheet(app)).toBeNull();
      const primary = byText(app, 'main button', 'Ver outros planos');
      expect(primary?.classList.contains('btn--primary')).toBe(true);
      // Cancelar plano é calmo: link de texto, no fim da tela, sem competir com a ação principal.
      const cancel = byText(app, 'main button', 'Cancelar plano');
      expect(cancel?.classList.contains('cg-link-btn')).toBe(true);
      expect(cancel?.classList.contains('btn')).toBe(false);
      const buttons = Array.from(app.root.querySelectorAll('main button'));
      expect(buttons.indexOf(cancel as HTMLButtonElement)).toBeGreaterThan(buttons.indexOf(primary as HTMLButtonElement));
    });

    it('Ver tudo que inclui abre a folha com a lista completa, também o que vem dos planos anteriores (CXC-010)', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await click(app, app.root.querySelector('[data-role="see-all"]'));
      expect(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent?.trim()).toBe('O que o plano Cuida inclui');
      expect(Array.from(openSheet(app)?.querySelectorAll('[data-role="all-benefits"] li') ?? []).map((li) => norm(li.textContent))).toEqual([
        'Acesso ao aplicativo',
        'Organização básica',
        'Agenda e lembretes',
        'Conteúdos',
        'Acesso inicial à rede',
        'Organização ampliada',
        'Descontos exclusivos do Cartão Nexus',
        'Conteúdos exclusivos',
        'Condições especiais na rede',
        'Maior suporte à organização',
        'Grupos de apoio',
        'Capacitações',
      ]);
      await click(app, openSheet(app)?.querySelector('[data-role="close-all"]'));
      expect(openSheet(app)).toBeNull();
    });

    it('cada plano tem a sua cor, o seu nome e os seus 4 destaques', async () => {
      const expected = [
        ['cg_0003', 'livre', 'Plano Livre', ['Agenda e lembretes', 'Organização básica', 'Conteúdos', 'Acesso inicial à rede']],
        ['cg_0002', 'essencial', 'Plano Essencial', ['Organização ampliada', 'Descontos exclusivos do Cartão Nexus', 'Conteúdos exclusivos', 'Condições especiais na rede']],
        ['cg_0027', 'sustenta', 'Plano Sustenta', ['Acompanhamento organizacional mais próximo', 'Maior nível de suporte', 'Benefícios diferenciados na rede', 'Grupos de apoio']],
      ] as const;
      for (const [id, tone, name, perks] of expected) {
        const app = await bootCaregiverApp(id, { url: URL });
        const card = app.root.querySelector('[data-role="current-plan"]') as HTMLElement;
        expect(card.classList.contains(`cg-tone--${tone}`)).toBe(true);
        expect(norm(card.querySelector('h2')?.textContent)).toBe(name);
        expect(Array.from(card.querySelectorAll('[data-role="perks"] li')).map((li) => norm(li.textContent))).toEqual(perks);
        TestBed.resetTestingModule();
      }
    });

    it('cada plano pago mostra o seu preço, e o Livre mostra "Sem custo, sem prazo" com Ver os planos e sem cancelar', async () => {
      for (const [id, price] of [['cg_0002', 'R$ 49,90 por mês'], ['cg_0027', 'R$ 149,90 por mês'], ['cg_0024', 'R$ 149,90 por mês']] as const) {
        const app = await bootCaregiverApp(id, { url: URL });
        expect(norm(app.root.querySelector('[data-role="price"]')?.textContent)).toBe(price);
        TestBed.resetTestingModule();
      }
      const joao = await bootCaregiverApp('cg_0003', { url: URL });
      expect(norm(joao.root.querySelector('[data-role="price"]')?.textContent)).toBe('Sem custo, sem prazo');
      expect(joao.root.querySelector('[data-role="situation"]')).toBeNull();
      expect(byText(joao, 'main button', 'Ver os planos')).toBeDefined();
      expect(byText(joao, 'main button', 'Ver outros planos')).toBeUndefined();
      expect(byText(joao, 'main button', 'Cancelar plano')).toBeUndefined();
      await click(joao, joao.root.querySelector('[data-role="see-all"]'));
      expect(Array.from(openSheet(joao)?.querySelectorAll('[data-role="all-benefits"] li') ?? []).map((li) => norm(li.textContent))).toEqual([
        'Acesso ao aplicativo',
        'Organização básica',
        'Agenda e lembretes',
        'Conteúdos',
        'Acesso inicial à rede',
      ]);
    });
  });

  describe('comparar planos (AC-CG-150)', () => {
    it('mostra os 4 preços, os 3 destaques de cada plano, o plano atual marcado "Seu plano" e os avisos sem letra miúda', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await click(app, byText(app, 'main button', 'Ver outros planos'));
      expect(app.router.url).toBe(BOARD);
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Planos');
      expect(document.activeElement?.tagName).toBe('H1');
      const plans = Array.from(app.root.querySelectorAll('[data-role="board-plan"]')).map((p) => ({
        title: norm(p.querySelector('h2')?.textContent),
        price: norm(p.querySelector('.nx-price')?.textContent),
        more: norm(p.querySelector('.nx-plan__more')?.textContent),
        items: Array.from(p.querySelectorAll('.nx-items li')).map((li) => norm(li.textContent)),
        current: norm(p.querySelector('[data-role="here"]')?.textContent),
      }));
      expect(plans.map((p) => [p.title, p.price])).toEqual([
        ['Plano Livre', 'R$ 0,00 por mês'],
        ['Plano Essencial', 'R$ 49,90 por mês'],
        ['Plano Cuida', 'R$ 119,90 por mês'],
        ['Plano Sustenta', 'R$ 149,90 por mês'],
      ]);
      // Os 3 destaques PRÓPRIOS de cada plano, nunca a lista inteira.
      expect(plans[0]?.items).toEqual(['Agenda e lembretes', 'Organização básica', 'Conteúdos']);
      expect(plans[0]?.more).toBe('');
      expect(plans[1]?.more).toBe('Tudo do plano anterior, mais:');
      expect(plans[1]?.items).toEqual(['Organização ampliada', 'Descontos exclusivos do Cartão Nexus', 'Conteúdos exclusivos']);
      expect(plans[2]?.items).toEqual(['Grupos de apoio', 'Capacitações', 'Maior suporte à organização']);
      expect(plans[3]?.items).toEqual(['Acompanhamento organizacional mais próximo', 'Maior nível de suporte', 'Benefícios diferenciados na rede']);
      expect(plans.map((p) => p.current)).toEqual(['', '', 'Seu plano', '']);
      // Cada cartão tem a sua cor.
      expect(Array.from(app.root.querySelectorAll('[data-role="board-plan"]')).map((p) => /cg-tone--(\w+)/.exec(p.className)?.[1])).toEqual(['livre', 'essencial', 'cuida', 'sustenta']);
      expect(norm(app.root.querySelector('[data-role="not-included"]')?.textContent)).toBe(
        'A mensalidade não inclui serviços da rede nem atendimento psicológico.',
      );
      expect(norm(app.root.querySelector('[data-role="cancel-any-month"]')?.textContent)).toBe('Você pode cancelar em qualquer mês, sem multa.');
      // Nada de letra miúda: nenhum elemento <small> na tela.
      expect(app.root.querySelector('main small')).toBeNull();
    });

    it('sem "recomendado", sem selo de oferta, sem urgência (RN-PLN-19 e 22)', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: BOARD });
      expect(mainText(app).toLowerCase()).not.toMatch(/recomend|oferta|promo|melhor|mais vendido|últim|só hoje|aproveite|garanta|corra/);
      expect(app.root.querySelector('main [data-role="board-plan"] app-badge')).toBeNull();
    });

    it('cada plano diferente do atual tem o botão calmo "Escolher" (o efeito vem na folha), e o atual só leva a marca "Seu plano"', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: BOARD });
      const actions = Array.from(app.root.querySelectorAll('main [data-plan]')).map((b) => [b.getAttribute('data-plan'), norm(b.textContent)]);
      expect(actions).toEqual([
        ['livre', 'Escolher o plano Livre'],
        ['essencial', 'Escolher o plano Essencial'],
        ['sustenta', 'Escolher o plano Sustenta'],
      ]);
      expect(Array.from(app.root.querySelectorAll('main [data-plan]')).every((b) => !b.classList.contains('btn--primary'))).toBe(true);
      expect(app.root.querySelectorAll('main [data-role="here"]').length).toBe(1);
    });

    it('Voltar leva a Meu plano', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: BOARD });
      await click(app, app.root.querySelector('main a.cg-page-header__back'));
      expect(app.router.url).toBe(URL);
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Meu plano');
    });
  });

  describe('subir de plano (AC-CG-151 e 155)', () => {
    it('a folha diz que vale hoje, quando a cobrança começa e o aviso de que a mensalidade não inclui serviços', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: URL });
      await choose(app, 'cuida');
      expect(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent?.trim()).toBe('Mudar para o Cuida?');
      expect(paragraphs(openSheet(app)?.querySelector('[data-role="effect"]'))).toBe(
        'Vale hoje. O Cartão Nexus é emitido agora. A cobrança de R$ 119,90 começa no próximo ciclo, em 04/12/2026. Se mudar de ideia, é só mudar de plano de novo. A mensalidade não inclui serviços da rede nem atendimento psicológico.',
      );
      expect(norm(confirmButton(app)?.textContent)).toBe('Mudar para o Cuida');
      expect(subOf(app, 'cg_0003').planId).toBe('livre');
    });

    it('na primeira contratação paga o aviso de emergência é UMA linha com a caixa "Li e entendi" na mesma folha (um passo só); sem o aceite, não muda (AC-CG-155, CXC-010)', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: URL });
      await choose(app, 'cuida');
      // Um passo só: o efeito, a linha do aviso e a caixa aparecem juntos, sem segunda folha "Antes de confirmar".
      expect(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent?.trim()).toBe('Mudar para o Cuida?');
      expect(sheetText(app)).toContain('Em emergência, ligue 192 (SAMU). Os canais da Nexus não substituem atendimento de saúde nem orientação sobre remédios.');
      expect(sheetText(app)).toContain('Li e entendi');
      expect(sheetText(app)).not.toContain('Antes de confirmar');
      expect(openSheet(app)?.querySelector('.cg-emergency')).toBeNull();
      expect(norm(confirmButton(app)?.textContent)).toBe('Mudar para o Cuida');
      await click(app, confirmButton(app));
      expect(sheetText(app)).toContain('Marque que você leu o aviso para continuar.');
      expect(subOf(app, 'cg_0003').planId).toBe('livre');
      expect(app.db.caregivers.require('cg_0003').emergencyNoticeAcceptedAt).toBeUndefined();
    });

    it('com o aceite, o plano muda na hora, o cartão é emitido, o aceite fica com data e hora e a troca vai em nome do cuidador (AC-CG-151)', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: URL });
      await choose(app, 'cuida');
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      await click(app, confirmButton(app));
      expect(openSheet(app)).toBeNull();
      const sub = subOf(app, 'cg_0003');
      expect(sub.planId).toBe('cuida');
      expect(sub.status).toBe('active');
      const card = app.db.benefitCards.find((c) => c.caregiverId === 'cg_0003' && c.status === 'active');
      expect(card?.number).toMatch(/^NX-\d{4}-\d{4}$/);
      expect(app.db.caregivers.require('cg_0003').emergencyNoticeAcceptedAt).toBe('2026-11-04T12:00:00-03:00');
      const change = app.db.planChanges.query((p) => p.subscriptionId === sub.id).sort((a, b) => b.id.localeCompare(a.id))[0];
      expect(change).toMatchObject({ kind: 'upgrade', from: 'livre', to: 'cuida', byUserId: 'cg_0003' });
      const message = `Plano alterado para o Cuida. Cartão ${card?.number} emitido.`;
      expect(norm(app.root.querySelector('[data-role="result"]')?.textContent)).toBe(message);
      // CXC-017: um aviso só (a faixa da tela); o aviso rápido não repete.
      expect(TestBed.inject(ToastService).toasts().find((t) => t.message === message)).toBeUndefined();
      expect(app.context.planId()).toBe('cuida');
      expect(app.router.url).toBe(URL);
      expect(norm(app.root.querySelector('[data-role="current-plan"] h2')?.textContent)).toBe('Plano Cuida');
    });

    it('quem já aceitou o aviso não precisa aceitar de novo: confirma direto e o cartão segue ativo', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      app.db.caregivers.update('cg_0001', { emergencyNoticeAcceptedAt: '2026-10-01T09:00:00-03:00' });
      await choose(app, 'sustenta');
      expect(paragraphs(openSheet(app)?.querySelector('[data-role="effect"]'))).toContain(
        'Vale hoje. A cobrança de R$ 149,90 começa no próximo ciclo, em 06/11/2026.',
      );
      expect(sheetText(app)).not.toContain('O Cartão Nexus é emitido agora');
      await click(app, confirmButton(app));
      expect(openSheet(app)).toBeNull();
      expect(subOf(app, 'cg_0001').planId).toBe('sustenta');
      expect(norm(app.root.querySelector('[data-role="result"]')?.textContent)).toBe('Plano alterado para o Sustenta. Cartão NX-0000-1007 segue ativo.');
      // O aceite anterior não foi trocado.
      expect(app.db.caregivers.require('cg_0001').emergencyNoticeAcceptedAt).toBe('2026-10-01T09:00:00-03:00');
    });

    it('Voltar fecha a folha sem mudar nada', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      await choose(app, 'cuida');
      await click(app, openSheet(app)?.querySelector('[data-role="back"]'));
      expect(openSheet(app)).toBeNull();
      expect(subOf(app, 'cg_0002').planId).toBe('essencial');
    });
  });

  describe('descer e cancelar valem no fim do ciclo (AC-CG-152 e 153)', () => {
    it('descer: a folha diz quando vale e que turmas a pessoa deixa; ao confirmar, agenda e o plano atual continua', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await choose(app, 'essencial');
      expect(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent?.trim()).toBe('Mudar para o Essencial no fim do ciclo?');
      expect(paragraphs(openSheet(app)?.querySelector('[data-role="effect"]'))).toBe(
        'Vale no fim do ciclo, em 06/11/2026. Até lá, o Cuida continua, inclusive os grupos. Você sai dos grupos que começam depois dessa data: Sobrecarga e autocuidado (07/11), Prevenção de quedas (14/11). Os grupos em andamento continuam até o fim do ciclo. Se mudar de ideia, é só mudar de plano de novo.',
      );
      expect(norm(confirmButton(app)?.textContent)).toBe('Agendar mudança para o Essencial');
      await click(app, confirmButton(app));
      expect(openSheet(app)).toBeNull();
      const sub = app.db.subscriptions.require(subOf(app, 'cg_0001').id);
      expect(sub).toMatchObject({ status: 'cancel_scheduled', scheduledPlanId: 'essencial', scheduledChangeAt: '2026-11-06', planId: 'cuida' });
      expect(app.context.planId()).toBe('cuida');
      const band = norm(app.root.querySelector('[data-role="scheduled"]')?.textContent);
      expect(band).toContain('Mudança agendada');
      expect(band).toContain('Seu plano muda para o Essencial em 06/11/2026.');
      expect(band).toContain('Manter meu plano');
      expect(norm(app.root.querySelector('[data-role="result"]')?.textContent)).toBe('Mudança para o Essencial agendada para 06/11/2026.');
      const change = app.db.planChanges.query((p) => p.subscriptionId === sub.id && p.kind === 'downgrade')[0];
      expect(change?.byUserId).toBe('cg_0001');
    });

    it('cancelar: a folha diz que o cartão deixa de valer e o plano vira Livre; agenda e mostra Manter meu plano', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await click(app, byText(app, 'main button', 'Cancelar plano'));
      expect(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent?.trim()).toBe('Cancelar o plano?');
      expect(paragraphs(openSheet(app)?.querySelector('[data-role="effect"]'))).toContain(
        'O cancelamento fica agendado para 06/11/2026. Até lá tudo continua. Nessa data o cartão deixa de valer e o plano vira Livre.',
      );
      expect(norm(confirmButton(app)?.textContent)).toBe('Agendar cancelamento');
      // Perigo suave (UX A.2.7): nunca o vermelho cheio do ato irreversível, e o "Voltar" fica por último.
      expect(confirmButton(app)?.classList.contains('btn--danger-quiet')).toBe(true);
      expect(confirmButton(app)?.classList.contains('btn--primary')).toBe(false);
      expect(Array.from(openSheet(app)?.querySelectorAll('.cg-sheet__actions button') ?? []).map((b) => norm(b.textContent))).toEqual(['Agendar cancelamento', 'Voltar']);
      await click(app, confirmButton(app));
      const sub = app.db.subscriptions.require(subOf(app, 'cg_0001').id);
      expect(sub).toMatchObject({ status: 'cancel_scheduled', scheduledPlanId: 'livre', scheduledChangeAt: '2026-11-06' });
      expect(norm(app.root.querySelector('[data-role="scheduled"]')?.textContent)).toContain('Cancelamento agendado Seu plano volta a ser o Livre em 06/11/2026.');
      expect(byText(app, 'main button', 'Manter meu plano')).toBeDefined();
      expect(byText(app, 'main button', 'Cancelar plano')).toBeUndefined();
      expect(norm(app.root.querySelector('[data-role="situation"]')?.textContent)).toBe('Seu plano atual vale até 06/11/2026.');
      expect(app.db.planChanges.query((p) => p.subscriptionId === sub.id && p.kind === 'cancel')[0]?.byUserId).toBe('cg_0001');
    });

    it('sem turmas futuras, a folha não fala de grupos', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      await click(app, byText(app, 'main button', 'Cancelar plano'));
      expect(sheetText(app)).not.toContain('grupos');
      expect(sheetText(app)).toContain('O cancelamento fica agendado para 07/11/2026.');
    });
  });

  describe('Manter meu plano (AC-CG-154)', () => {
    it('Marcos tem cancelamento agendado: um toque desfaz, sem folha, com a faixa "Plano mantido."', async () => {
      const app = await bootCaregiverApp('cg_0026', { url: URL });
      expect(norm(app.root.querySelector('[data-role="scheduled"]')?.textContent)).toContain('Seu plano volta a ser o Livre em 13/11/2026.');
      await click(app, byText(app, 'main button', 'Manter meu plano'));
      expect(openSheet(app)).toBeNull();
      const sub = app.db.subscriptions.require(subOf(app, 'cg_0026').id);
      expect(sub.status).toBe('active');
      expect(sub.scheduledPlanId).toBeUndefined();
      expect(sub.scheduledChangeAt).toBeUndefined();
      expect(app.root.querySelector('[data-role="scheduled"]')).toBeNull();
      expect(norm(app.root.querySelector('[data-role="result"]')?.textContent)).toBe('Plano mantido.');
      expect(TestBed.inject(ToastService).toasts().find((t) => t.message === 'Plano mantido.')).toBeUndefined();
      expect(app.db.planChanges.query((p) => p.subscriptionId === sub.id && p.kind === 'reactivate')[0]?.byUserId).toBe('cg_0026');
      expect(byText(app, 'main button', 'Cancelar plano')).toBeDefined();
    });

    it('depois de agendar a descida, Manter meu plano desfaz o agendamento', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await choose(app, 'essencial');
      await click(app, confirmButton(app));
      expect(app.context.scheduledChange()?.kind).toBe('change');
      await click(app, byText(app, 'main button', 'Manter meu plano'));
      expect(app.context.scheduledChange()).toBeNull();
      expect(app.context.planId()).toBe('cuida');
    });
  });

  it('AC-CG-156: nenhum campo de número de cartão, validade ou código de segurança em todo o fluxo', async () => {
    const app = await bootCaregiverApp('cg_0003', { url: URL });
    const noCardFields = (): void => {
      const fields = Array.from(app.root.querySelectorAll<HTMLInputElement>('main input, main select, main textarea'));
      expect(fields.every((f) => f.type === 'checkbox')).toBe(true);
      expect(fields.some((f) => /cc-|card/i.test(f.getAttribute('autocomplete') ?? ''))).toBe(false);
      expect(mainText(app).toLowerCase()).not.toMatch(/número do cart[ãa]o|validade|c[óo]digo de seguran[çc]a|cvv|cart[ãa]o de cr[ée]dito/);
    };
    noCardFields();
    await choose(app, 'cuida');
    noCardFields();
    await click(app, confirmButton(app));
    noCardFields();
  });

  describe('plano pago pela empresa (AC-CG-157)', () => {
    it('sem botões de troca nem de cancelamento, com a nota do contrato da empresa', async () => {
      const probe = await bootCaregiverApp('cg_0001', { url: URL });
      const sub = probe.db.subscriptions.find((s) => s.payer === 'corporate' && s.status !== 'cancelled' && probe.db.caregivers.get(s.caregiverId)?.status === 'active');
      expect(sub).toBeDefined();
      const caregiverId = sub?.caregiverId ?? '';
      const company = probe.db.corporateAccounts.get(sub?.corporateAccountId ?? '')?.companyName.replace(/\.$/, '') ?? '';
      TestBed.resetTestingModule();
      const app = await bootCaregiverApp(caregiverId, { url: URL });
      expect(norm(app.root.querySelector('[data-role="corporate"]')?.textContent)).toBe(
        `Este plano é pago pela empresa ${company}. A mudança é feita pelo contrato da empresa.`,
      );
      expect(byText(app, 'main button', 'Ver outros planos')).toBeUndefined();
      expect(byText(app, 'main button', 'Ver os planos')).toBeUndefined();
      expect(byText(app, 'main button', 'Cancelar plano')).toBeUndefined();
      await app.router.navigateByUrl(BOARD);
      await settleCaregiver(app.fixture);
      expect(app.root.querySelectorAll('main [data-plan]').length).toBe(0);
      expect(app.root.querySelector('[data-role="corporate"]')).not.toBeNull();
    });
  });

  describe('erros e casos de borda', () => {
    it('se a troca falhar, diz que nada foi alterado e não muda o plano', async () => {
      vi.spyOn(SubscriptionService.prototype, 'changePlan').mockImplementation(() => {
        throw new SubscriptionError('falhou');
      });
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      app.db.caregivers.update('cg_0001', { emergencyNoticeAcceptedAt: '2026-10-01T09:00:00-03:00' });
      await choose(app, 'sustenta');
      await click(app, confirmButton(app));
      expect(openSheet(app)).not.toBeNull();
      expect(sheetText(app)).toContain('Não foi possível mudar o plano. Nada foi alterado. Tente de novo; se continuar, fale com a gente.');
      expect(subOf(app, 'cg_0001').planId).toBe('cuida');
    });

    it('assinatura cancelada: tratada como Livre, e contratar cria uma assinatura nova em nome do cuidador', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      const old = subOf(app, 'cg_0002');
      app.db.subscriptions.update(old.id, { status: 'cancelled' });
      await settleCaregiver(app.fixture);
      expect(app.context.planId()).toBe('livre');
      expect(norm(app.root.querySelector('[data-role="price"]')?.textContent)).toBe('Sem custo, sem prazo');
      await choose(app, 'essencial');
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      await click(app, confirmButton(app));
      expect(app.context.planId()).toBe('essencial');
      const fresh = app.db.subscriptions.query((s) => s.caregiverId === 'cg_0002' && s.status === 'active');
      expect(fresh.length).toBe(1);
      expect(app.db.planChanges.query((p) => p.subscriptionId === fresh[0]?.id).every((p) => p.byUserId === 'cg_0002')).toBe(true);
    });

    it('a mudança agendada que venceu vale ao abrir a tela', async () => {
      const app = await bootCaregiverApp('cg_0026', { url: '/cuidador/hoje' });
      app.clock.setSimulated('2026-11-13', '12:00');
      await app.router.navigateByUrl(URL);
      await settleCaregiver(app.fixture);
      expect(app.context.planId()).toBe('livre');
      expect(app.root.querySelector('[data-role="scheduled"]')).toBeNull();
      expect(norm(app.root.querySelector('[data-role="price"]')?.textContent)).toBe('Sem custo, sem prazo');
    });
  });

  describe('nunca vende por causa de pontuação, alerta ou ARBE (AC-CG-158, RN-PLN-19)', () => {
    it('os textos de Meu plano, do quadro e das folhas não citam pontuação, faixa, alerta nem ARBE', async () => {
      for (const id of ['cg_0001', 'cg_0002', 'cg_0003']) {
        const app = await bootCaregiverApp(id, { url: BOARD });
        const plan = app.context.planId();
        const first = app.root.querySelector<HTMLElement>('main [data-plan]');
        await click(app, first);
        expect(openSheet(app)).not.toBeNull();
        const all = `${mainText(app)} ${sheetText(app)}`.toLowerCase();
        expect(all).not.toMatch(/zarit|pontua|faixa|alerta|arbe|risco|urgente|oferta|desconto especial/);
        expect(plan).toBeTruthy();
        TestBed.resetTestingModule();
      }
    });

    it('Hoje, Como estou e Ajuda agora não oferecem plano nem upgrade', async () => {
      for (const url of ['/cuidador/hoje', '/cuidador/cuidar-de-mim/como-estou', '/cuidador/ajuda-agora']) {
        for (const id of ['cg_0001', 'cg_0002']) {
          const app = await bootCaregiverApp(id, { url });
          const text = mainText(app);
          ['Ver os planos', 'Ver outros planos', 'Mudar para o', 'upgrade', 'Assine'].forEach((offer) => expect(text).not.toContain(offer));
          TestBed.resetTestingModule();
        }
      }
    });
  });
});
