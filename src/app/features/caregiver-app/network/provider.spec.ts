import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { typeInto } from '../../../shared/ui/testing/dom';
import { ContactDialogService } from '../state/contact-dialog.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';

const url = (id: string): string => `/cuidador/rede/profissional/${id}`;
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
const requestButton = (app: BootedCaregiverApp): HTMLElement | null => app.root.querySelector('[data-role="request"]');

/** Escreve a necessidade, escolhe o local e toca em Enviar pedido. */
async function fillAndSend(app: BootedCaregiverApp, need: string, where: 'Em casa' | 'No local do profissional' | null): Promise<void> {
  const sheet = openSheet(app) as HTMLDialogElement;
  if (need) {
    typeInto(sheet.querySelector('textarea') as HTMLTextAreaElement, need);
  }
  if (where) {
    const label = Array.from(sheet.querySelectorAll('label.cg-choice')).find((l) => norm(l.textContent) === where);
    await click(app, label?.querySelector('input'));
  }
  await click(app, sheet.querySelector('[data-role="send"]'));
}

function stubClipboard(writeText: (t: string) => Promise<void>): () => void {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
  return () => {
    if (original) {
      Object.defineProperty(window.navigator, 'clipboard', original);
    } else {
      Reflect.deleteProperty(window.navigator, 'clipboard');
    }
  };
}

/** Profissional (UX C14): AC-CG-124 a 130. */
describe('Profissional: a ficha e o pedido de serviço', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('a ficha (AC-CG-124)', () => {
    it('mostra nome, especialidade, cidade, registro, "Em destaque", "Atende em casa", a nota, o aviso e as condições', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: url('prv_01') });
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Dra. Renata Sampaio');
      expect(norm(app.root.querySelector('[data-role="specialty"]')?.textContent)).toBe('Fisioterapia geriátrica · Uberlândia');
      expect(mainText(app)).toContain('Em destaque');
      expect(mainText(app)).toContain('Atende em casa');
      expect(norm(app.root.querySelector('[data-role="council"]')?.textContent)).toBe('Registro: CREFITO-MG 00001-F (fictício)');
      const count = app.db.providerEvaluations.count((e) => e.providerId === 'prv_01');
      expect(norm(app.root.querySelector('[data-role="rating"]')?.textContent)).toMatch(new RegExp(`^Nota \\d,\\d \\(${count} avaliações\\)$`));
      expect(norm(app.root.querySelector('[data-role="notice"]')?.textContent)).toBe(
        'A Nexus organiza a rede. O serviço é feito e pago direto com o profissional.',
      );
      expect(mainText(app)).toContain('Condições para quem é da Nexus');
      expect(norm(app.root.querySelector('[data-role="conditions"]')?.textContent)).toBe(app.db.providers.require('prv_01').conditionsForNexusUsers);
      expect(norm(requestButton(app)?.textContent)).toBe('Pedir serviço');
    });

    it('sem 5 avaliações, "Ainda sem nota (menos de 5 avaliações)"; sem conselho, não há linha de registro', async () => {
      const psy = await bootCaregiverApp('cg_0002', { url: url('prv_13') });
      expect(norm(psy.root.querySelector('[data-role="rating"]')?.textContent)).toBe('Ainda sem nota (menos de 5 avaliações)');
      TestBed.resetTestingModule();
      const pharmacy = await bootCaregiverApp('cg_0002', { url: url('prv_08') });
      expect(pharmacy.root.querySelector('[data-role="council"]')).toBeNull();
    });

    it('NÃO mostra faixa de monitoramento, taxa de recusa, comissão, disponibilidade nem comentários de outras pessoas (S-18 e S-30)', async () => {
      for (const id of ['prv_01', 'prv_03', 'prv_04', 'prv_06', 'prv_12']) {
        const app = await bootCaregiverApp('cg_0002', { url: url(id) });
        const text = mainText(app).toLowerCase();
        expect(text).not.toMatch(/monitoramento|acompanhamento|risco de sa[ií]da|recusa|comiss|disponibilidade|vagas na semana|excel[eê]ncia|faixa/);
        const comments = app.db.providerEvaluations.query((e) => e.providerId === id && !!e.comment).map((e) => e.comment ?? '');
        comments.forEach((comment) => expect(mainText(app)).not.toContain(comment));
        TestBed.resetTestingModule();
      }
      const probe = await bootCaregiverApp('cg_0002', { url: url('prv_01') });
      expect(probe.db.providerEvaluations.count((e) => e.providerId === 'prv_01' && !!e.comment)).toBeGreaterThan(0);
    });

    it('o profissional em monitoramento tem a mesma ficha dos outros', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: url('prv_03') });
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Fisio em Casa Uberlândia');
      expect(requestButton(app)).not.toBeNull();
      expect(app.root.querySelector('[data-role="notice"]')).not.toBeNull();
    });

    it('o telefone do profissional aparece com Copiar número para todos os planos (AC-CG-126)', async () => {
      for (const id of ['cg_0002', 'cg_0003']) {
        const app = await bootCaregiverApp(id, { url: url('prv_01') });
        expect(norm(app.root.querySelector('[data-role="phone-line"]')?.textContent)).toBe('Prefere falar direto com Dra. Renata Sampaio? (34) 90000-0501.');
        expect(byText(app, 'main button', 'Copiar número')).toBeDefined();
        TestBed.resetTestingModule();
      }
    });

    it('Copiar número mostra "Número copiado." ou, se o navegador nega, o plano B de seleção', async () => {
      const copied: string[] = [];
      const restore = stubClipboard(async (t) => void copied.push(t));
      try {
        const app = await bootCaregiverApp('cg_0002', { url: url('prv_01') });
        await click(app, byText(app, 'main button', 'Copiar número'));
        expect(copied).toEqual(['(34) 90000-0501']);
        expect(TestBed.inject(ToastService).toasts().find((t) => t.message === 'Número copiado.')?.durationMs).toBe(8000);
      } finally {
        restore();
      }
      const denied = stubClipboard(async () => Promise.reject(new Error('negado')));
      try {
        TestBed.resetTestingModule();
        const app = await bootCaregiverApp('cg_0002', { url: url('prv_01') });
        await click(app, byText(app, 'main button', 'Copiar número'));
        expect(norm(app.root.querySelector('[data-role="copy-fallback"]')?.textContent)).toBe(
          'Não foi possível copiar. Segure sobre o número e escolha Copiar.',
        );
        expect(app.root.querySelector('[data-role="phone"]')).not.toBeNull();
      } finally {
        denied();
      }
    });

    it('nunca há link tel: nem wa.me', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: url('prv_01') });
      const hrefs = Array.from(app.root.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
      expect(hrefs.some((h) => h.startsWith('tel:') || h.includes('wa.me'))).toBe(false);
    });
  });

  describe('condições por plano (AC-CG-126)', () => {
    it('Essencial em diante vê as condições do profissional; o Livre vê "Condições especiais: a partir do plano Essencial."', async () => {
      const livre = await bootCaregiverApp('cg_0003', { url: url('prv_01') });
      expect(norm(livre.root.querySelector('[data-role="conditions"]')?.textContent)).toBe('Condições especiais: a partir do plano Essencial.');
      TestBed.resetTestingModule();
      const essencial = await bootCaregiverApp('cg_0002', { url: url('prv_01') });
      expect(norm(essencial.root.querySelector('[data-role="conditions"]')?.textContent)).toContain('Horário prioritário');
    });

    it('o plano Livre também tem o botão Pedir serviço, igual aos outros planos', async () => {
      for (const id of ['cg_0003', 'cg_0004', 'cg_0002', 'cg_0001', 'cg_0027']) {
        const app = await bootCaregiverApp(id, { url: url('prv_02') });
        expect(norm(requestButton(app)?.textContent)).toBe('Pedir serviço');
        TestBed.resetTestingModule();
      }
    });
  });

  describe('pedir serviço (AC-CG-125 e 130)', () => {
    it('Pedir serviço abre a folha com o que precisa, onde, o resumo do que vai ao profissional e Enviar pedido', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: url('prv_01') });
      await click(app, requestButton(app));
      const sheet = openSheet(app) as HTMLDialogElement;
      expect(norm(sheet.querySelector('.cg-sheet__title')?.textContent)).toBe('Pedir serviço');
      expect(norm(sheet.querySelector('.field__label')?.textContent)).toBe('O que você precisa?');
      expect(norm(sheet.querySelector('.cg-choices__legend')?.textContent)).toBe('Onde?');
      expect(Array.from(sheet.querySelectorAll('label.cg-choice')).map((l) => norm(l.textContent))).toEqual(['Em casa', 'No local do profissional']);
      // Nada vem marcado.
      expect(Array.from(sheet.querySelectorAll<HTMLInputElement>('input[type="radio"]')).some((r) => r.checked)).toBe(false);
      expect(norm(sheet.querySelector('[data-role="summary"]')?.textContent)).toBe(
        'Enviamos ao profissional só o seu nome, o seu contato e o que você precisa.',
      );
      expect(norm(sheet.querySelector('[data-role="send"]')?.textContent)).toBe('Enviar pedido');
    });

    it('qualquer plano pede: o pedido nasce "enviado", aparece em Meus pedidos e leva a faixa com Ver meus pedidos', async () => {
      for (const id of ['cg_0004', 'cg_0002']) {
        const app = await bootCaregiverApp(id, { url: url('prv_01') });
        await click(app, requestButton(app));
        await fillAndSend(app, 'Fisioterapia duas vezes por semana', 'Em casa');
        expect(openSheet(app)).toBeNull();
        const created = app.db.serviceRequests.find((r) => r.caregiverId === id && r.providerId === 'prv_01' && r.status === 'requested');
        expect(created).toMatchObject({ need: 'Fisioterapia duas vezes por semana', modality: 'home', specialty: 'physiotherapy' });
        const sent = app.root.querySelector('[data-role="sent"]') as HTMLElement;
        expect(norm(sent.textContent)).toContain('Pedido enviado. A equipe avisa você quando o profissional responder.');
        expect(norm(sent.querySelector('a')?.textContent)).toBe('Ver meus pedidos');
        expect(sent.querySelector('a')?.getAttribute('href')).toBe('/cuidador/rede/pedidos');
        expect(requestButton(app)).toBeNull();
        // CXC-017: um aviso só (a faixa); o aviso rápido não repete.
        expect(TestBed.inject(ToastService).toasts().find((t) => t.message.startsWith('Pedido enviado.'))).toBeUndefined();
        await app.router.navigateByUrl('/cuidador/rede/pedidos');
        await settleCaregiver(app.fixture);
        expect(mainText(app)).toContain('Dra. Renata Sampaio');
        expect(mainText(app)).toContain('Enviado, aguardando resposta');
        TestBed.resetTestingModule();
      }
    });

    it('AC-CG-126: no Livre o pedido é igual ao dos outros planos e não leva condição especial nem nada além do essencial', async () => {
      const app = await bootCaregiverApp('cg_0004', { url: url('prv_01') });
      await click(app, requestButton(app));
      await fillAndSend(app, 'Fisioterapia', 'No local do profissional');
      const created = app.db.serviceRequests.find((r) => r.caregiverId === 'cg_0004' && r.providerId === 'prv_01' && r.status === 'requested');
      expect(Object.keys(created ?? {}).sort()).toEqual(
        ['caregiverId', 'createdAt', 'id', 'modality', 'need', 'providerId', 'requestedAt', 'specialty', 'status', 'updatedAt'].sort(),
      );
    });

    it('AC-CG-130: a folha e o pedido não carregam dado de saúde, pontuação, atendimento ou grupo', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: url('prv_01') });
      await click(app, requestButton(app));
      const sheetText = norm(openSheet(app)?.textContent).toLowerCase();
      expect(sheetText).not.toMatch(/zarit|pontua|sa[uú]de|atendimento psicol|grupo|faixa|alerta|diagn/);
      await fillAndSend(app, 'Fisioterapia', 'No local do profissional');
      const created = app.db.serviceRequests.find((r) => r.caregiverId === 'cg_0001' && r.providerId === 'prv_01' && r.status === 'requested');
      expect(JSON.stringify(created).toLowerCase()).not.toMatch(/zarit|score|elder|health|saude|medic|group|alert/);
    });

    it('sem a necessidade, o erro fica junto do campo e nada é enviado; sem o local, o erro fica junto da escolha', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: url('prv_01') });
      await click(app, requestButton(app));
      await fillAndSend(app, '', null);
      expect(norm(openSheet(app)?.querySelector('.field__error')?.textContent)).toBe('Erro: Conte em uma frase o que você precisa.');
      expect(app.db.serviceRequests.count((r) => r.caregiverId === 'cg_0002')).toBe(0);
      await fillAndSend(app, 'Fisioterapia', null);
      expect(norm(openSheet(app)?.querySelector('[data-role="modality-error"]')?.textContent)).toBe('Erro: Escolha onde você quer ser atendido.');
      expect(app.db.serviceRequests.count((r) => r.caregiverId === 'cg_0002')).toBe(0);
      // O que a pessoa digitou não se perde.
      expect((openSheet(app)?.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Fisioterapia');
    });

    it('quem não atende em casa só oferece o local do profissional, já marcado', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: url('prv_02') });
      await click(app, requestButton(app));
      const sheet = openSheet(app) as HTMLDialogElement;
      expect(Array.from(sheet.querySelectorAll('label.cg-choice')).map((l) => norm(l.textContent))).toEqual(['No local do profissional']);
      await fillAndSend(app, 'Fisioterapia', null);
      expect(app.db.serviceRequests.find((r) => r.caregiverId === 'cg_0002' && r.providerId === 'prv_02')?.modality).toBe('at_provider');
    });

    it('Voltar fecha a folha sem enviar', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: url('prv_01') });
      await click(app, requestButton(app));
      await click(app, byText(app, 'main dialog.cg-sheet[open] button', 'Voltar'));
      expect(openSheet(app)).toBeNull();
      expect(app.db.serviceRequests.count((r) => r.caregiverId === 'cg_0002')).toBe(0);
    });
  });

  describe('sem a cláusula de proteção de dados (AC-CG-127, S-19)', () => {
    it('não há Pedir serviço; a nota é neutra e leva a Falar com a gente', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: url('prv_20') });
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Cuidadora Rosimeire Tavares');
      expect(requestButton(app)).toBeNull();
      expect(norm(app.root.querySelector('[data-role="no-request"]')?.textContent)).toContain(
        'No momento não é possível pedir este profissional pelo app. A equipe pode ajudar.',
      );
      await click(app, byText(app, 'main button', 'Falar com a gente'));
      expect(TestBed.inject(ContactDialogService).isOpen()).toBe(true);
    });

    it('assinada a cláusula, o botão volta', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: url('prv_20') });
      app.db.providers.update('prv_20', { dataProtectionClauseSignedAt: '2026-11-01' });
      await settleCaregiver(app.fixture);
      expect(requestButton(app)).not.toBeNull();
      expect(app.root.querySelector('[data-role="no-request"]')).toBeNull();
    });
  });

  describe('quem não aparece (AC-CG-128)', () => {
    it('suspenso, descredenciado, candidato, reprovado e inexistente: a mesma frase, sem dizer se existe', async () => {
      const seen: string[] = [];
      for (const id of ['prv_14', 'prv_10', 'prv_19', 'prv_16', 'prv_18', 'prv_99']) {
        const app = await bootCaregiverApp('cg_0027', { url: url(id) });
        expect(app.root.querySelector('main .empty__title')?.textContent?.trim()).toBe('Não encontramos este profissional.');
        const back = byText(app, 'main a', 'Voltar para a busca');
        expect(back?.getAttribute('href')).toBe('/cuidador/rede/buscar');
        const html = norm(app.root.querySelector('main')?.textContent);
        ['Nutri Camila Rezende', 'Clínica Saúde Integral', 'Dr. Otávio Lima', 'Dra. Isadora Leal', 'Cuidadores Express'].forEach((n) =>
          expect(html).not.toContain(n),
        );
        expect(requestButton(app)).toBeNull();
        seen.push(html);
        TestBed.resetTestingModule();
      }
      // A tela é idêntica nos 6 casos (nada revela qual deles é).
      expect(new Set(seen).size).toBe(1);
    });
  });

  describe('pedido em andamento (AC-CG-129)', () => {
    it('mostra "Você já tem um pedido em andamento com este profissional." e Ver pedido, no lugar de Pedir serviço', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: url('prv_11') });
      expect(norm(app.root.querySelector('[data-role="already"]')?.textContent)).toContain('Você já tem um pedido em andamento com este profissional.');
      const link = byText(app, 'main a', 'Ver pedido');
      expect(link?.getAttribute('href')).toBe('/cuidador/rede/pedidos?pedido=srq_0196');
      expect(requestButton(app)).toBeNull();
    });

    it('depois de cancelar o pedido, o botão Pedir serviço volta', async () => {
      const app = await bootCaregiverApp('cg_0003', { url: url('prv_11') });
      app.db.serviceRequests.update('srq_0196', { status: 'cancelled_by_user', reason: 'teste' });
      await settleCaregiver(app.fixture);
      expect(requestButton(app)).not.toBeNull();
      expect(app.root.querySelector('[data-role="already"]')).toBeNull();
    });
  });

  it('nada na ficha depende de pontuação, faixa, alerta ou ARBE', async () => {
    for (const id of ['cg_0001', 'cg_0002']) {
      const app = await bootCaregiverApp(id, { url: url('prv_01') });
      expect(mainText(app).toLowerCase()).not.toMatch(/zarit|pontua|alerta|arbe|sobrecarga|risco/);
      TestBed.resetTestingModule();
    }
  });
});
