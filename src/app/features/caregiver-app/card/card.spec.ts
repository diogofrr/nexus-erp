import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './card.routes';

const URL = '/cuidador/rede/cartao';

const text = (app: BootedCaregiverApp): string => (app.root.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ');

/** Título e apoio de uma linha de lista, separados por " | " (os dois spans ficam sem espaço entre eles no DOM). */
function parts(row: Element): string {
  const title = row.querySelector('.cg-row__title')?.textContent?.trim() ?? '';
  const desc = row.querySelector('.cg-row__desc')?.textContent?.trim() ?? '';
  return `${title} | ${desc}`;
}

async function click(app: BootedCaregiverApp, element: Element | null | undefined): Promise<void> {
  (element as HTMLElement).click();
  await settleCaregiver(app.fixture);
}

function button(app: BootedCaregiverApp, label: string): HTMLButtonElement | undefined {
  return Array.from(app.root.querySelectorAll<HTMLButtonElement>('main button')).find((b) => b.textContent?.trim() === label);
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

/** Cartão Nexus (UX C16): AC-CG-139 a 144. */
describe('Área card (Cartão Nexus)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  it('abre /cuidador/rede/cartao com o título "Cartão Nexus", um h1 e "Voltar" para a Rede', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: URL });
    expect(app.router.url).toBe(URL);
    expect(document.title).toContain('Cartão Nexus');
    expect(app.root.querySelectorAll('main h1').length).toBe(1);
    expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Cartão Nexus');
    expect(app.root.querySelector('main a.cg-page-header__back')?.getAttribute('href')).toBe('/cuidador/rede');
  });

  it('AC-CG-139: o assinante vê o cartão com o número, o plano e "Mostre o número no balcão do parceiro."', async () => {
    for (const [id, plan] of [['cg_0001', 'Cuida'], ['cg_0002', 'Essencial'], ['cg_0027', 'Sustenta']] as const) {
      const app = await bootCaregiverApp(id, { url: URL });
      const number = app.root.querySelector('[data-role="card-number"]')?.textContent?.trim() ?? '';
      expect(number).toMatch(/^NX-\d{4}-\d{4}$/);
      expect(number).toBe(app.db.benefitCards.find((c) => c.caregiverId === id && c.status === 'active')?.number);
      expect(text(app)).toContain(`Plano ${plan}`);
      expect(text(app)).toContain('Mostre o número no balcão do parceiro.');
      expect(text(app)).toContain('Vale enquanto o seu plano estiver ativo.');
      expect(button(app, 'Copiar número')).toBeDefined();
      TestBed.resetTestingModule();
    }
  });

  it('AC-CG-139: Copiar número mostra "Número copiado." quando o navegador deixa', async () => {
    const copied: string[] = [];
    const restore = stubClipboard(async (t) => void copied.push(t));
    try {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await click(app, button(app, 'Copiar número'));
      expect(copied).toEqual(['NX-0000-1007']);
      const toast = TestBed.inject(ToastService).toasts();
      expect(toast.map((t) => t.message)).toContain('Número copiado.');
      expect(toast.find((t) => t.message === 'Número copiado.')?.durationMs).toBe(8000);
      expect(text(app)).not.toContain('Não foi possível copiar');
    } finally {
      restore();
    }
  });

  it('AC-CG-139: se o navegador nega a área de transferência, o plano B manda segurar sobre o número e copiar', async () => {
    const restore = stubClipboard(async () => Promise.reject(new Error('negado')));
    try {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await click(app, button(app, 'Copiar número'));
      expect(text(app)).toContain('Não foi possível copiar. Segure sobre o número e escolha Copiar.');
      expect(app.root.querySelector('[data-role="card-number"]')?.textContent?.trim()).toBe('NX-0000-1007');
    } finally {
      restore();
    }
  });

  it('AC-CG-140: "Onde usar" lista só parceiros ativos, cada um com o seu percentual', async () => {
    const app = await bootCaregiverApp('cg_0002', { url: URL });
    const rows = Array.from(app.root.querySelectorAll('main section[aria-labelledby="card-where"] button.cg-row')).map(parts);
    expect(rows).toEqual([
      'Drogaria Cuidar | Farmácia · 12% de desconto',
      'Farmácia Bem-Estar | Farmácia · 10% de desconto',
      'Laboratório Análise Exemplo | Laboratório · 8% de desconto',
      'Mercado Vida Saudável | Mercado · 5% de desconto',
      'Ótica Visão Clara | Ótica · 15% de desconto',
    ]);
    ['Drogaria Popular Central', 'Academia Mexa-se', 'Clínica de Imagem Delta', 'Loja de Ortopedia Passo Firme'].forEach((n) =>
      expect(text(app)).not.toContain(n),
    );
  });

  it('AC-CG-140: tocar no parceiro mostra onde fica e a frase do balcão; tocar de novo recolhe', async () => {
    const app = await bootCaregiverApp('cg_0002', { url: URL });
    const first = app.root.querySelector<HTMLButtonElement>('section[aria-labelledby="card-where"] button.cg-row');
    expect(first?.getAttribute('aria-expanded')).toBe('false');
    await click(app, first);
    expect(first?.getAttribute('aria-expanded')).toBe('true');
    expect(text(app)).toContain('Uberlândia. Mostre o número do cartão no balcão.');
    await click(app, first);
    expect(first?.getAttribute('aria-expanded')).toBe('false');
    expect(text(app)).not.toContain('Uberlândia. Mostre o número do cartão no balcão.');
  });

  it('C3: o histórico de compras é leitura: nenhuma linha dele é botão nem link (só o que clica parece clicável)', async () => {
    const app = await bootCaregiverApp('cg_0027', { url: URL });
    const rows = Array.from(app.root.querySelectorAll<HTMLElement>('[data-role="usage"]'));
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.tagName).toBe('DIV');
      expect(row.querySelector('button, a, input')).toBeNull();
      expect(row.closest('button, a')).toBeNull();
    });
    // Já os parceiros (onde usar) abrem e fecham: esses sim são botões, com aria-expanded.
    const partners = Array.from(app.root.querySelectorAll<HTMLElement>('button.cg-row'));
    expect(partners.length).toBeGreaterThan(0);
    partners.forEach((p) => expect(p.getAttribute('aria-expanded')).not.toBeNull());
  });

  it('um parceiro suspenso que fica ativo depois entra na lista, e um que é suspenso sai', async () => {
    const app = await bootCaregiverApp('cg_0002', { url: URL });
    app.db.partners.update('par_0001', { status: 'suspended' });
    await settleCaregiver(app.fixture);
    expect(text(app)).not.toContain('Farmácia Bem-Estar');
    app.db.partners.update('par_0008', { status: 'active' });
    await settleCaregiver(app.fixture);
    expect(text(app)).toContain('Drogaria Popular Central');
  });

  it('AC-CG-141 e CXC-026: Elza vê as 3 últimas compras e a economia; "Ver todas" abre os 8 usos (parceiro, data, desconto)', async () => {
    const app = await bootCaregiverApp('cg_0027', { url: URL });
    expect(app.root.querySelectorAll('[data-role="usage"]').length).toBe(3);
    const toggle = app.root.querySelector<HTMLElement>('[data-role="all-usages"]');
    expect(toggle?.textContent?.trim()).toBe('Ver todas (8)');
    toggle?.click();
    await settleCaregiver(app.fixture);
    const usages = Array.from(app.root.querySelectorAll('[data-role="usage"]')).map(parts);
    expect(usages.length).toBe(8);
    expect(app.root.querySelector('[data-role="all-usages"]')?.textContent?.trim()).toBe('Ver menos');
    expect(usages[0]).toBe('Drogaria Cuidar | sáb, 31/10 · desconto de R$ 9,36');
    // Hoje é 04/11 e o último uso foi em 31/10: o mês ainda não tem compras, e o total aparece.
    expect(app.root.querySelector('[data-role="month-total"]')?.textContent?.trim()).toBe('Neste mês: ainda sem compras com o cartão.');
    expect(app.root.querySelector('[data-role="grand-total"]')?.textContent?.trim()).toBe('Ao todo: R$ 169,99 em 8 compras.');
  });

  it('AC-CG-141: o total do mês soma o desconto dos usos do mês de hoje', async () => {
    // O seed é gerado em relação a "hoje": o relógio muda DEPOIS de subir, para os usos continuarem nas mesmas datas.
    const app = await bootCaregiverApp('cg_0027', { url: '/cuidador/hoje' });
    app.clock.setSimulated('2026-10-31', '12:00');
    await app.router.navigateByUrl(URL);
    await settleCaregiver(app.fixture);
    expect(app.root.querySelector('[data-role="month-total"]')?.textContent?.trim()).toBe('Neste mês: R$ 76,83 em 4 compras.');
    expect(app.root.querySelector('[data-role="grand-total"]')?.textContent?.trim()).toBe('Ao todo: R$ 169,99 em 8 compras.');
  });

  it('sem nenhum uso: "Você ainda não usou o cartão."', async () => {
    const app = await bootCaregiverApp('cg_0002', { url: URL });
    const card = app.db.benefitCards.find((c) => c.caregiverId === 'cg_0002');
    app.db.cardUsages.removeWhere((u) => u.cardId === card?.id);
    await settleCaregiver(app.fixture);
    expect(text(app)).toContain('Você ainda não usou o cartão.');
    expect(app.root.querySelector('[data-role="usage"]')).toBeNull();
  });

  it('sem parceiro ativo: "Ainda não há parceiros por aqui."', async () => {
    const app = await bootCaregiverApp('cg_0002', { url: URL });
    app.db.partners.updateWhere(() => true, { status: 'ended' });
    await settleCaregiver(app.fixture);
    expect(text(app)).toContain('Ainda não há parceiros por aqui');
  });

  it('AC-CG-142: o plano Livre vê só o convite calmo, sem percentual, parceiro, preço nem número', async () => {
    for (const id of ['cg_0003', 'cg_0004']) {
      const app = await bootCaregiverApp(id, { url: URL });
      const body = text(app);
      expect(body).toContain('O Cartão Nexus dá descontos em farmácias, clínicas e outros parceiros. Ele vem com os planos pagos.');
      expect(body).not.toMatch(/NX-\d{4}/);
      expect(body).not.toContain('%');
      expect(body).not.toContain('R$');
      ['Farmácia Bem-Estar', 'Drogaria Cuidar', 'Ótica Visão Clara', 'Onde usar', 'Copiar número'].forEach((t) => expect(body).not.toContain(t));
      const link = Array.from(app.root.querySelectorAll('main a')).find((a) => a.textContent?.trim() === 'Ver os planos');
      expect(link?.getAttribute('href')).toBe('/cuidador/mais/plano');
      expect(app.root.querySelector('main .cg-note--soft')).not.toBeNull();
      expect(app.root.querySelector('main [data-role="card-number"]')).toBeNull();
      TestBed.resetTestingModule();
    }
  });

  it('AC-CG-143: com cancelamento agendado (Marcos), o cartão diz até quando vale', async () => {
    const app = await bootCaregiverApp('cg_0026', { url: URL });
    expect(app.root.querySelector('[data-role="validity"]')?.textContent?.trim()).toBe(
      'Seu cartão vale até 13/11, quando o plano muda para o Livre.',
    );
    expect(app.root.querySelector('[data-role="card-number"]')).not.toBeNull();
  });

  it('AC-CG-143: no dia em que a assinatura deixa de valer, o cartão some e vira o convite do Livre', async () => {
    const app = await bootCaregiverApp('cg_0026', { url: '/cuidador/hoje' });
    app.clock.setSimulated('2026-11-13', '12:00');
    await app.router.navigateByUrl(URL);
    await settleCaregiver(app.fixture);
    expect(app.context.planId()).toBe('livre');
    expect(app.root.querySelector('[data-role="card-number"]')).toBeNull();
    expect(text(app)).toContain('Ele vem com os planos pagos.');
    expect(app.db.benefitCards.find((c) => c.caregiverId === 'cg_0026')?.status).toBe('inactive');
  });

  it('uma mudança entre planos pagos não mexe na validade do cartão', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: URL });
    const sub = app.context.subscription();
    app.db.subscriptions.update(sub?.id ?? '', { status: 'cancel_scheduled', scheduledPlanId: 'essencial', scheduledChangeAt: '2026-11-20' });
    await settleCaregiver(app.fixture);
    expect(app.root.querySelector('[data-role="validity"]')?.textContent?.trim()).toBe('Vale enquanto o seu plano estiver ativo.');
  });

  it('plano pago sem cartão ativo: avisa com calma e não promete nada', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: URL });
    app.db.benefitCards.updateWhere((c) => c.caregiverId === 'cg_0001', { status: 'inactive' });
    await settleCaregiver(app.fixture);
    expect(text(app)).toContain('Não encontramos um cartão ativo para você. A equipe pode ajudar.');
    expect(text(app)).not.toContain('Ele vem com os planos pagos.');
  });

  it('AC-CG-144: nada de pontuação, faixa, alerta ou ARBE na tela, para quem tem alertas diferentes', async () => {
    for (const id of ['cg_0001', 'cg_0002', 'cg_0027']) {
      const app = await bootCaregiverApp(id, { url: URL });
      expect(text(app).toLowerCase()).not.toMatch(/zarit|pontua|faixa|alerta|arbe|sobrecarga/);
      TestBed.resetTestingModule();
    }
  });
});
