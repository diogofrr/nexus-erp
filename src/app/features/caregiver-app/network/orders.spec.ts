import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { typeInto } from '../../../shared/ui/testing/dom';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';

const URL = '/cuidador/rede/pedidos';
const norm = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();
const mainText = (app: BootedCaregiverApp): string => norm(app.root.querySelector('main')?.textContent);

async function click(app: BootedCaregiverApp, element: Element | null | undefined): Promise<void> {
  if (!element) {
    throw new Error('Elemento não encontrado para clicar');
  }
  (element as HTMLElement).click();
  await settleCaregiver(app.fixture);
}

const openSheet = (app: BootedCaregiverApp): HTMLDialogElement | null => app.root.querySelector<HTMLDialogElement>('main dialog.cg-sheet[open]');
const sheetText = (app: BootedCaregiverApp): string => norm(openSheet(app)?.textContent);
const order = (app: BootedCaregiverApp, id: string): HTMLElement | null => app.root.querySelector(`main [data-order="${id}"]`);
const group = (app: BootedCaregiverApp, name: 'evaluate' | 'open' | 'previous'): HTMLElement | null => app.root.querySelector(`main [data-role="group-${name}"]`);
const orderIds = (el: HTMLElement | null): string[] => Array.from(el?.querySelectorAll('[data-order]') ?? []).map((b) => b.getAttribute('data-order') ?? '');
const statusOf = (app: BootedCaregiverApp, id: string): string => norm(order(app, id)?.querySelector('[data-role="status"]')?.textContent);
/** O texto de uma parte da folha aberta, pelo data-role. */
const sheetPart = (app: BootedCaregiverApp, role: string): string => norm(openSheet(app)?.querySelector(`[data-role="${role}"]`)?.textContent);
const sheetButton = (app: BootedCaregiverApp, role: string): HTMLElement | null => openSheet(app)?.querySelector(`[data-role="${role}"]`) ?? null;

/** Escolhe a nota `score` na pergunta cujo texto é `legend`. */
async function rate(app: BootedCaregiverApp, legend: string, score: number): Promise<void> {
  const fieldset = Array.from(openSheet(app)?.querySelectorAll('fieldset.cg-rating') ?? []).find((f) => norm(f.querySelector('legend')?.textContent) === legend);
  await click(app, fieldset?.querySelector(`input[aria-label="${score} de 5"]`));
}

const QUALITY = 'Como foi o serviço?';
const PUNCTUALITY = 'Como foi a pontualidade e o atendimento?';

/** Meus pedidos (UX C15): AC-CG-131 a 138. */
describe('Meus pedidos', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('os grupos (AC-CG-131)', () => {
    it('Rita: o serviço concluído sem avaliação fica em "Precisa da sua avaliação", com a situação em texto e ícone', async () => {
      const app = await bootCaregiverApp('cg_0008', { url: URL });
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Meus pedidos');
      const evaluate = group(app, 'evaluate') as HTMLElement;
      expect(norm(evaluate.querySelector('h2')?.textContent)).toBe('Precisa da sua avaliação');
      expect(orderIds(evaluate)).toEqual(['srq_0126']);
      expect(statusOf(app, 'srq_0126')).toBe('Concluído: avalie');
      // Ícone e texto: o selo tem um svg além do texto (nunca só cor).
      expect(order(app, 'srq_0126')?.querySelector('[data-role="status"] svg')).not.toBeNull();
      expect(norm(order(app, 'srq_0126')?.querySelector('.cg-row__title')?.textContent)).toBe('Dra. Renata Sampaio');
      expect(norm(order(app, 'srq_0126')?.querySelector('.cg-meta')?.textContent)).toBe('Pedido em qua, 28/10 · Fisioterapia');
    });

    it('João: um pedido em andamento e os anteriores recolhidos', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: URL });
      expect(group(app, 'evaluate')).toBeNull();
      expect(norm(group(app, 'open')?.querySelector('h2')?.textContent)).toBe('Em andamento');
      expect(orderIds(group(app, 'open'))).toEqual(['srq_0196']);
      expect(statusOf(app, 'srq_0196')).toBe('Enviado, aguardando resposta');
      const previous = group(app, 'previous') as HTMLDetailsElement;
      expect(previous.tagName).toBe('DETAILS');
      expect(previous.open).toBe(false);
      expect(norm(previous.querySelector('summary')?.textContent)).toBe('Anteriores (2)');
      expect(orderIds(previous).sort()).toEqual(['srq_0024', 'srq_0100']);
      expect(statusOf(app, 'srq_0100')).toBe('Avaliado');
    });

    it('nunca só cor: todo pedido tem ícone e texto na situação', async () => {
      const app = await bootCaregiverApp('cg_0024', { url: URL });
      const statuses = Array.from(app.root.querySelectorAll('main [data-role="status"]'));
      expect(statuses.length).toBeGreaterThan(1);
      statuses.forEach((s) => {
        expect(norm(s.textContent).length).toBeGreaterThan(3);
        expect(s.querySelector('svg')).not.toBeNull();
      });
    });
  });

  describe('sem pedidos (AC-CG-137)', () => {
    it('mostra "Você ainda não fez pedidos" com Buscar profissionais', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      expect(norm(app.root.querySelector('main .empty__title')?.textContent)).toBe('Você ainda não fez pedidos');
      expect(mainText(app)).toContain('Quando você pedir um serviço a um profissional da rede, ele aparece aqui.');
      const action = Array.from(app.root.querySelectorAll('main a')).find((a) => norm(a.textContent) === 'Buscar profissionais');
      expect(action?.getAttribute('href')).toBe('/cuidador/rede/buscar');
      expect(group(app, 'evaluate')).toBeNull();
      expect(group(app, 'open')).toBeNull();
      expect(group(app, 'previous')).toBeNull();
    });
  });

  describe('cancelar o pedido (AC-CG-132)', () => {
    it('a folha diz o efeito antes; ao confirmar, o pedido vai a "Cancelado por você"', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: URL });
      await click(app, order(app, 'srq_0196'));
      expect(norm(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent)).toBe('Dr. Eduardo Falcão');
      await click(app, sheetButton(app, 'cancel'));
      expect(norm(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent)).toBe('Cancelar este pedido?');
      expect(sheetPart(app, 'cancel-effect')).toBe('O profissional deixa de receber o seu pedido. Você pode pedir de novo quando quiser.');
      expect(app.db.serviceRequests.require('srq_0196').status).toBe('requested');
      // O botão seguro (Voltar) recebe o foco.
      expect(norm(document.activeElement?.textContent)).toBe('Voltar');
      await click(app, sheetButton(app, 'confirm-cancel'));
      expect(openSheet(app)).toBeNull();
      expect(app.db.serviceRequests.require('srq_0196').status).toBe('cancelled_by_user');
      expect(statusOf(app, 'srq_0196')).toBe('Cancelado por você');
      expect(group(app, 'open')).toBeNull();
      const message = 'Pedido cancelado. Você pode pedir de novo quando quiser.';
      expect(norm(app.root.querySelector('[data-role="result"]')?.textContent)).toBe(message);
      expect(TestBed.inject(ToastService).toasts().find((t) => t.message === message)).toBeUndefined();
    });

    it('também cancela o pedido aceito; Voltar não cancela nada', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: URL });
      app.db.serviceRequests.update('srq_0196', { status: 'accepted', respondedAt: '2026-11-03T09:00:00-03:00' });
      await settleCaregiver(app.fixture);
      expect(statusOf(app, 'srq_0196')).toBe('Aceito');
      await click(app, order(app, 'srq_0196'));
      await click(app, sheetButton(app, 'cancel'));
      await click(app, sheetButton(app, 'back'));
      expect(openSheet(app)).toBeNull();
      expect(app.db.serviceRequests.require('srq_0196').status).toBe('accepted');
      await click(app, order(app, 'srq_0196'));
      await click(app, sheetButton(app, 'cancel'));
      await click(app, sheetButton(app, 'confirm-cancel'));
      expect(app.db.serviceRequests.require('srq_0196').status).toBe('cancelled_by_user');
    });

    it('pedido concluído ou avaliado não tem Cancelar pedido', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: URL });
      await click(app, app.root.querySelector('main details summary'));
      await click(app, order(app, 'srq_0100'));
      expect(sheetButton(app, 'cancel')).toBeNull();
    });
  });

  describe('avaliar (AC-CG-133)', () => {
    it('tocar no serviço concluído abre a avaliação com as duas notas; sem elas, o texto fica escrito acima do botão', async () => {
      const app = await bootCaregiverApp('cg_0008', { url: URL });
      await click(app, order(app, 'srq_0126'));
      expect(norm(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent)).toBe('Avaliar o serviço');
      expect(sheetText(app)).toContain('Como foi o serviço?');
      expect(sheetText(app)).toContain('Como foi a pontualidade e o atendimento?');
      expect(sheetText(app)).toContain('Quer contar mais? (opcional)');
      expect(sheetText(app)).toContain('Sua avaliação ajuda outras famílias. O profissional não vê o seu nome.');
      expect(sheetPart(app, 'missing')).toBe('Falta escolher as duas notas');
      expect((sheetButton(app, 'send-evaluation') as HTMLButtonElement).disabled).toBe(true);
      await rate(app, PUNCTUALITY, 4);
      expect(sheetPart(app, 'missing')).toBe('Falta escolher a nota do serviço');
      await rate(app, QUALITY, 5);
      expect(sheetButton(app, 'missing')).toBeNull();
      expect((sheetButton(app, 'send-evaluation') as HTMLButtonElement).disabled).toBe(false);
      expect(sheetPart(app, 'send-evaluation')).toBe('Enviar avaliação');
    });

    it('quem escolhe só a nota do serviço vê que falta a da pontualidade e do atendimento', async () => {
      const app = await bootCaregiverApp('cg_0008', { url: URL });
      await click(app, order(app, 'srq_0126'));
      await rate(app, QUALITY, 3);
      expect(sheetPart(app, 'missing')).toBe('Falta escolher a nota da pontualidade e do atendimento');
    });

    it('com as duas notas, grava a avaliação (nota = média), o pedido vira "Avaliado" e mostra até quando corrigir', async () => {
      const app = await bootCaregiverApp('cg_0008', { url: URL });
      await click(app, order(app, 'srq_0126'));
      await rate(app, QUALITY, 5);
      await rate(app, PUNCTUALITY, 4);
      typeInto(openSheet(app)?.querySelector('textarea') as HTMLTextAreaElement, 'Foi pontual e cuidadosa.');
      await click(app, sheetButton(app, 'send-evaluation'));
      expect(openSheet(app)).toBeNull();
      const request = app.db.serviceRequests.require('srq_0126');
      expect(request.status).toBe('evaluated');
      const evaluation = app.db.providerEvaluations.require(request.evaluationId ?? '');
      expect(evaluation).toMatchObject({ technicalQuality: 5, punctualityCourtesy: 4, score: 4.5, comment: 'Foi pontual e cuidadosa.', editableUntil: '2026-11-11', caregiverId: 'cg_0008' });
      expect(group(app, 'evaluate')).toBeNull();
      expect(statusOf(app, 'srq_0126')).toBe('Avaliado');
      const message = 'Avaliação enviada. Você pode corrigir até 11/11.';
      expect(norm(app.root.querySelector('[data-role="result"]')?.textContent)).toBe(message);
      expect(TestBed.inject(ToastService).toasts().find((t) => t.message === message)).toBeUndefined();
    });

    it('só existe uma avaliação por serviço concluído: depois de avaliar, não há mais Avaliar', async () => {
      const app = await bootCaregiverApp('cg_0008', { url: URL });
      await click(app, order(app, 'srq_0126'));
      await rate(app, QUALITY, 4);
      await rate(app, PUNCTUALITY, 4);
      await click(app, sheetButton(app, 'send-evaluation'));
      await click(app, app.root.querySelector('main details summary'));
      await click(app, order(app, 'srq_0126'));
      expect(sheetButton(app, 'evaluate')).toBeNull();
      expect(app.db.providerEvaluations.count((e) => e.serviceRequestId === 'srq_0126')).toBe(1);
    });
  });

  describe('corrigir em até 7 dias (AC-CG-134)', () => {
    async function evaluated(): Promise<BootedCaregiverApp> {
      const app = await bootCaregiverApp('cg_0008', { url: URL });
      await click(app, order(app, 'srq_0126'));
      await rate(app, QUALITY, 5);
      await rate(app, PUNCTUALITY, 4);
      await click(app, sheetButton(app, 'send-evaluation'));
      await click(app, app.root.querySelector('main details summary'));
      return app;
    }

    it('dentro do prazo mostra o prazo e Corrigir minha avaliação; a correção troca as notas', async () => {
      const app = await evaluated();
      await click(app, order(app, 'srq_0126'));
      expect(sheetPart(app, 'evaluation')).toBe('Você avaliou este serviço: 5 de 5 no serviço e 4 de 5 na pontualidade e no atendimento.');
      expect(sheetPart(app, 'editable')).toBe('Você pode corrigir até 11/11.');
      await click(app, sheetButton(app, 'correct'));
      expect(norm(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent)).toBe('Corrigir minha avaliação');
      // As notas atuais já vêm marcadas.
      expect(openSheet(app)?.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked').length).toBe(2);
      await rate(app, QUALITY, 2);
      expect(sheetPart(app, 'send-evaluation')).toBe('Salvar correção');
      await click(app, sheetButton(app, 'send-evaluation'));
      const request = app.db.serviceRequests.require('srq_0126');
      expect(app.db.providerEvaluations.require(request.evaluationId ?? '')).toMatchObject({ technicalQuality: 2, punctualityCourtesy: 4, score: 3 });
      expect(norm(app.root.querySelector('[data-role="result"]')?.textContent)).toBe('Avaliação corrigida. Você pode corrigir até 11/11.');
    });

    it('com 7 dias ou mais, diz "Prazo de correção encerrado." e não oferece a correção', async () => {
      const app = await evaluated();
      app.clock.setSimulated('2026-11-12', '12:00');
      await settleCaregiver(app.fixture);
      await click(app, order(app, 'srq_0126'));
      expect(sheetPart(app, 'editable')).toBe('Prazo de correção encerrado.');
      expect(sheetButton(app, 'correct')).toBeNull();
    });

    it('a avaliação antiga do seed (maio) já está fora do prazo', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await click(app, app.root.querySelector('main details summary'));
      await click(app, order(app, 'srq_0092'));
      expect(sheetPart(app, 'editable')).toBe('Prazo de correção encerrado.');
      expect(sheetButton(app, 'correct')).toBeNull();
    });
  });

  describe('recusado pelo profissional (AC-CG-135)', () => {
    it('diz "O profissional não pôde atender." sem culpa e oferece "Ver outras opções de Nutrição"', async () => {
      const app = await bootCaregiverApp('cg_0024', { url: URL });
      expect(statusOf(app, 'srq_0206')).toBe('O profissional não pôde atender');
      await click(app, app.root.querySelector('main details summary'));
      await click(app, order(app, 'srq_0206'));
      expect(sheetPart(app, 'refused')).toBe('O profissional não pôde atender.');
      const link = sheetButton(app, 'other-options') as HTMLAnchorElement;
      expect(norm(link.textContent)).toBe('Ver outras opções de Nutrição');
      expect(link.getAttribute('href')).toBe('/cuidador/rede/buscar?categoria=nutrition');
      await click(app, link);
      expect(app.router.url).toBe('/cuidador/rede/buscar?categoria=nutrition');
      expect(openSheet(app)).toBeNull();
    });

    it('o histórico mantém o nome do profissional que saiu da busca, sem levar à ficha e sem culpa', async () => {
      const app = await bootCaregiverApp('cg_0024', { url: URL });
      const row = order(app, 'srq_0206') as HTMLElement;
      expect(norm(row.querySelector('.cg-row__title')?.textContent)).toBe('Nutri Camila Rezende');
      expect(row.tagName).toBe('BUTTON');
      expect(row.closest('a')).toBeNull();
      expect(mainText(app).toLowerCase()).not.toMatch(/culpa|recusou|rejeit|suspens|descredenci/);
    });
  });

  describe('os links de Hoje e da ficha', () => {
    it('?avaliar=<pedido> abre a avaliação direto, e fechar a folha limpa o endereço', async () => {
      const app = await bootCaregiverApp('cg_0008', { url: `${URL}?avaliar=srq_0126` });
      expect(norm(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent)).toBe('Avaliar o serviço');
      expect(sheetText(app)).toContain('Como foi o serviço?');
      await click(app, sheetButton(app, 'back'));
      expect(openSheet(app)).toBeNull();
      expect(app.router.url).toBe(URL);
    });

    it('?avaliar= de um serviço que já foi avaliado, de outra pessoa ou inexistente não abre a avaliação', async () => {
      const done = await bootCaregiverApp('cg_0003', { url: `${URL}?avaliar=srq_0100` });
      expect(norm(openSheet(done)?.querySelector('.cg-sheet__title')?.textContent)).not.toBe('Avaliar o serviço');
      TestBed.resetTestingModule();
      for (const id of ['srq_0126', 'nao-existe']) {
        const app = await bootCaregiverApp('cg_0002', { url: `${URL}?avaliar=${id}` });
        expect(openSheet(app)).toBeNull();
        TestBed.resetTestingModule();
      }
    });

    it('?pedido=<pedido> abre o pedido (a ficha leva "Ver pedido" até aqui)', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: `${URL}?pedido=srq_0196` });
      expect(norm(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent)).toBe('Dr. Eduardo Falcão');
      expect(sheetText(app)).toContain('O que você pediu:');
      expect(sheetText(app)).toContain('Onde:');
      expect(sheetText(app)).toContain('Pedido enviado');
    });
  });

  describe('o que não aparece (AC-CG-136 e 138)', () => {
    it('nenhuma avaliação, nome ou comentário de outras pessoas e nenhum dado interno do profissional', async () => {
      for (const id of ['cg_0001', 'cg_0003', 'cg_0008', 'cg_0024']) {
        const app = await bootCaregiverApp(id, { url: URL });
        for (const summary of Array.from(app.root.querySelectorAll('main details summary'))) {
          (summary as HTMLElement).click();
        }
        await settleCaregiver(app.fixture);
        const text = mainText(app);
        expect(text.toLowerCase()).not.toMatch(/monitoramento|acompanhamento|risco de sa[ií]da|recusa|taxa|comiss|disponibilidade|faixa|excel[eê]ncia|zarit|pontua/);
        const others = app.db.providerEvaluations.query((e) => e.caregiverId !== id && !!e.comment).map((e) => e.comment ?? '');
        others.forEach((comment) => expect(text).not.toContain(comment));
        const names = app.db.caregivers.query((c) => c.id !== id).map((c) => c.fullName);
        names.forEach((name) => expect(text).not.toContain(name));
        TestBed.resetTestingModule();
      }
    });

    it('a folha de um pedido avaliado mostra só a avaliação da própria pessoa', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: URL });
      await click(app, app.root.querySelector('main details summary'));
      await click(app, order(app, 'srq_0100'));
      const evaluation = app.db.providerEvaluations.find((e) => e.serviceRequestId === 'srq_0100');
      expect(sheetPart(app, 'evaluation')).toBe(
        `Você avaliou este serviço: ${evaluation?.technicalQuality} de 5 no serviço e ${evaluation?.punctualityCourtesy} de 5 na pontualidade e no atendimento.`,
      );
    });
  });
});
