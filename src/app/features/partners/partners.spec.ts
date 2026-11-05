import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { typeInto } from '../../shared/ui/testing/dom';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};

const submit = (form: Element | null): void => {
  if (!form) {
    throw new Error('formulário não encontrado');
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

/** O controle tem nome acessível: rótulo ligado por `for`, rótulo que envolve ou `aria-label`. */
function hasAccessibleName(control: Element): boolean {
  const id = control.getAttribute('id');
  return (
    control.hasAttribute('aria-label') ||
    control.hasAttribute('aria-labelledby') ||
    control.closest('label') !== null ||
    (id !== null && control.ownerDocument.querySelector(`label[for="${id}"]`) !== null)
  );
}

describe('parceiros do Cartão: telas (M09)', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));
  const dialog = (): HTMLDialogElement =>
    app.root.querySelector('app-dialog-host dialog') as HTMLDialogElement;
  const go = async (url: string): Promise<void> => {
    await app.router.navigateByUrl(url);
    await settle(app.fixture);
  };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('a lista mostra os 9 parceiros, conta 5 ativos e tem um h1 (SCR-M09-01, AC-M09-03)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/parceiros' });
    expect(all('h1')).toHaveLength(1);
    expect(q('h1')?.textContent).toContain('Parceiros do Cartão');
    expect(q('.page-header__desc')?.textContent).toContain('5 parceiros ativos');
    expect(all('app-data-table tbody tr[data-row]')).toHaveLength(9);
    const text = q('app-data-table')?.textContent ?? '';
    ['Farmácia Bem-Estar', 'Clínica de Imagem Delta', 'Loja de Ortopedia Passo Firme', 'Academia Mexa-se'].forEach(
      (name) => expect(text).toContain(name),
    );
    expect(q('[data-role="new-partner"]')).not.toBeNull();
    expect(q('[data-role="read-only-note"]')).toBeNull();
    // O uso do cartão de todos os parceiros: 25 usos, 8 deles do código CUI-0027, sem nome.
    const usage = q('[data-role="usage-summary"]')?.textContent ?? '';
    expect(usage).toContain('25 usos do cartão');
    expect(usage).toContain('CUI-0027');
    expect(usage).toContain('8 usos');
  });

  it('o filtro de estado vai para a URL e o funil mostra os 5 estados sem arrastar (PD-06)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/parceiros?estado=active' });
    expect(all('app-data-table tbody tr[data-row]')).toHaveLength(5);
    expect(q('app-active-filters')?.textContent).toContain('Estado: Ativo');
    await go('/app/parceiros?visao=funil');
    expect(all('.kanban__col')).toHaveLength(5);
    expect(q('.kanban')?.textContent).toContain('Clínica de Imagem Delta');
    expect(q('.kanban')?.textContent).toContain('Faltam 2 validações');
    expect(all('[draggable="true"]')).toHaveLength(0);
  });

  it('a lista de busca sem resultado e o estado vazio acolhem e oferecem saída', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/parceiros?estado=ended&categoria=pharmacy' });
    expect(q('app-data-table')?.textContent).toContain('Nenhum resultado com esses filtros');
    expect(q('app-data-table [class*="btn"]')?.textContent).toContain('Limpar filtros');
    app.db.partners.removeWhere(() => true);
    await go('/app/parceiros');
    expect(q('app-empty-state')?.textContent).toContain('Nenhum parceiro cadastrado');
    expect(q('app-empty-state button')?.textContent).toContain('Cadastrar parceiro');
  });

  it('cadastrar um parceiro pela gaveta: rótulos, 3 modelos de remuneração e validação em linha (AC-M09-02)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/parceiros' });
    click(q('[data-role="new-partner"]'));
    await settle(app.fixture);
    const controls = all('#pf-form input:not([type="hidden"]), #pf-form select, #pf-form textarea');
    expect(controls.length).toBeGreaterThan(6);
    controls.forEach((c) => expect(hasAccessibleName(c), c.outerHTML.slice(0, 80)).toBe(true));
    const radios = all('#pf-form input[type="radio"]');
    expect(radios).toHaveLength(3);
    const labels = radios.map((r) => r.closest('label')?.textContent ?? '');
    expect(labels.join(' ')).not.toMatch(/psic/i);
    expect(labels.join(' ')).toContain('Sem remuneração');
    // Enviar vazio mostra o resumo e os erros com a mesma frase, sem fechar a gaveta.
    submit(q('#pf-form'));
    await settle(app.fixture);
    expect(q('app-error-summary')?.hasAttribute('hidden')).toBe(false);
    expect(q('app-error-summary')?.textContent).toContain('Informe o nome do parceiro.');
    expect(q('#pf-name')?.getAttribute('aria-invalid')).toBe('true');
    // Preenche com exemplo e cadastra.
    click(q('[data-role="fill-example"]'));
    await settle(app.fixture);
    expect((q('#pf-name') as HTMLInputElement).value).toBe('Farmácia Exemplo Saúde');
    typeInto(q('#pf-discount') as HTMLInputElement, '100,5');
    await settle(app.fixture);
    submit(q('#pf-form'));
    await settle(app.fixture);
    expect(q('app-error-summary')?.textContent).toContain('O desconto deve ficar entre 0 e 100.');
    typeInto(q('#pf-discount') as HTMLInputElement, '8,5');
    await settle(app.fixture);
    submit(q('#pf-form'));
    await settle(app.fixture);
    const created = app.db.partners.find((p) => p.name === 'Farmácia Exemplo Saúde');
    expect(created?.status).toBe('prospect');
    expect(created?.discountPercent).toBe(8.5);
    expect(app.router.url).toBe(`/app/parceiros/${created?.id}`);
    expect(q('h1')?.textContent).toContain('Farmácia Exemplo Saúde');
    expect(app.db.accessLog.list().some((e) => e.entity === 'partner' && e.entityId === created?.id)).toBe(true);
  });

  it('a ficha da Delta bloqueia "Ativar" com o motivo ao lado e libera com as duas validações (AC-M09-01)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/parceiros/par_0006' });
    expect(q('h1')?.textContent).toContain('Clínica de Imagem Delta');
    const activate = q<HTMLButtonElement>('[data-role="move-active"]');
    expect(activate?.getAttribute('aria-disabled')).toBe('true');
    expect(q('[data-role="move-reason"]')?.textContent).toContain(
      'Para ativar falta: validação jurídica e validação ética.',
    );
    expect(q('[data-role="validation-state-legal"]')?.textContent).toContain('Pendente');
    click(activate);
    await settle(app.fixture);
    expect(app.db.partners.require('par_0006').status).toBe('legal_ethics_review');
    click(q('[data-role="validation-legal"]'));
    await settle(app.fixture);
    expect(q('[data-role="validation-state-legal"]')?.textContent).toContain('Registrada em 04/11/2026');
    click(q('[data-role="validation-ethics"]'));
    await settle(app.fixture);
    expect(q('[data-role="move-active"]')?.getAttribute('aria-disabled')).toBeNull();
    expect(q('[data-role="move-reason"]')).toBeNull();
    click(q('[data-role="move-active"]'));
    await settle(app.fixture);
    expect(dialog().querySelector('h2')?.textContent).toContain('Ativar Clínica de Imagem Delta?');
    click(dialog().querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    expect(app.db.partners.require('par_0006').status).toBe('active');
    expect(q('[data-role="status"]')?.textContent).toContain('Ativo');
    // O painel de parceiros ativos reflete na hora.
    await go('/app/parceiros');
    expect(q('.page-header__desc')?.textContent).toContain('6 parceiros ativos');
  });

  it('suspender pede o efeito em diálogo e a ficha mostra o novo estado e o histórico', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/parceiros/par_0001' });
    click(q('[data-role="move-suspended"]'));
    await settle(app.fixture);
    const body = dialog().textContent ?? '';
    expect(body).toContain('Suspender Farmácia Bem-Estar?');
    expect(body).toContain('Ficará bloqueado');
    expect(dialog().querySelector('[data-role="confirm"]')?.textContent).toContain('Suspender parceiro');
    click(dialog().querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    expect(app.db.partners.require('par_0001').status).toBe('suspended');
    await go('/app/parceiros/par_0001?aba=historico');
    expect(q('app-timeline')?.textContent).toContain('de Ativo para Suspenso');
    expect(q('[data-role="move-active"]')).toBeNull();
  });

  it('o uso do cartão mostra só o código do cuidador e os totais (RN-CRT-11)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/parceiros/par_0001?aba=uso' });
    const rows = all('app-data-table tbody tr[data-row]');
    expect(rows.length).toBe(app.db.cardUsages.count((u) => u.partnerId === 'par_0001'));
    expect(all('.code-chip').every((c) => /CUI-\d{4}/.test(c.textContent ?? ''))).toBe(true);
    const names = app.db.caregivers.list().slice(0, 40).map((c) => c.fullName);
    const dom = app.root.querySelector('main')?.textContent ?? '';
    names.forEach((n) => expect(dom).not.toContain(n));
    expect(q('app-kpi-strip')?.textContent).toContain('Descontos concedidos');
  });

  it('o atendimento só lê: sem botões de escrita, sem caixas e com as validações em texto (AC-M09-08)', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/parceiros' });
    expect(all('app-data-table tbody tr[data-row]')).toHaveLength(9);
    expect(q('[data-role="new-partner"]')).toBeNull();
    expect(q('[data-role="read-only-note"]')).not.toBeNull();
    expect(q('app-partner-form-drawer')).toBeNull();
    await go('/app/parceiros/par_0006');
    expect(q('h1')?.textContent).toContain('Clínica de Imagem Delta');
    expect(q('[data-role="edit-partner"]')).toBeNull();
    expect(all('[data-role^="validation-"][type="checkbox"]')).toHaveLength(0);
    expect(q('[data-role="next-steps"]')).toBeNull();
    expect(q('[data-role="validation-state-legal"]')?.textContent).toContain('Pendente');
  });

  it('perfis sem acesso vão a /403 e nada de parceiro vaza no DOM', async () => {
    for (const userId of ['u2', 'u3']) {
      TestBed.resetTestingModule();
      app = await bootApp({ userId, url: '/app/painel' });
      for (const url of ['/app/parceiros', '/app/parceiros/par_0001', '/app/empresas', '/app/empresas/corp_0001']) {
        await go(url);
        expect(app.router.url, `${userId} ${url}`).toBe('/403');
        const dom = app.root.textContent ?? '';
        expect(dom).not.toContain('Farmácia Bem-Estar');
        expect(dom).not.toContain('Exemplo Logística');
      }
    }
  });

  it('parceiro que não existe mostra o aviso acolhedor, sem erro vermelho', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/parceiros/par_9999' });
    expect(q('app-empty-state')?.textContent).toContain('Não encontramos este parceiro');
    expect(q('app-empty-state a')?.getAttribute('href')).toBe('/app/parceiros');
  });

  it('editar os dados troca o desconto e vai ao log; trocar a remuneração de um ativo volta à validação', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/parceiros/par_0001' });
    click(q('[data-role="edit-partner"]'));
    await settle(app.fixture);
    expect((q('#pf-name') as HTMLInputElement).value).toBe('Farmácia Bem-Estar');
    typeInto(q('#pf-discount') as HTMLInputElement, '11,5');
    await settle(app.fixture);
    submit(q('#pf-form'));
    await settle(app.fixture);
    expect(app.db.partners.require('par_0001').discountPercent).toBe(11.5);
    // Troca a remuneração para valor fixo: o diálogo avisa e o parceiro volta à validação.
    click(q('[data-role="edit-partner"]'));
    await settle(app.fixture);
    const fixed = all<HTMLInputElement>('#pf-form input[type="radio"]')[1] as HTMLInputElement;
    click(fixed);
    await settle(app.fixture);
    submit(q('#pf-form'));
    await settle(app.fixture);
    expect(dialog().querySelector('h2')?.textContent).toContain('Mudar a remuneração de Farmácia Bem-Estar?');
    click(dialog().querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    const partner = app.db.partners.require('par_0001');
    expect(partner.remuneration.model).toBe('fixed_fee');
    expect(partner.status).toBe('legal_ethics_review');
  });
});
