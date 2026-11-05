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

function hasAccessibleName(control: Element): boolean {
  const id = control.getAttribute('id');
  return (
    control.hasAttribute('aria-label') ||
    control.hasAttribute('aria-labelledby') ||
    control.closest('label') !== null ||
    (id !== null && control.ownerDocument.querySelector(`label[for="${id}"]`) !== null)
  );
}

describe('canal corporativo: telas (M09)', () => {
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

  it('a lista mostra as 3 empresas, as vagas ativas e o preço rotulado como fora da projeção (SCR-M09-03)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/empresas' });
    expect(all('h1')).toHaveLength(1);
    expect(q('h1')?.textContent).toContain('Empresas');
    const rows = all('app-data-table tbody tr[data-row]');
    expect(rows).toHaveLength(3);
    const logistica = rows.find((r) => r.textContent?.includes('Exemplo Logística'));
    expect(logistica?.textContent).toContain('3 de 5');
    expect(logistica?.textContent).toContain('2 convites');
    expect(logistica?.textContent).toContain('Contrato ativo');
    expect(q('app-data-table')?.textContent).toContain('Indústria Modelo');
    expect(q('.page')?.textContent).toContain('não faz parte da projeção do plano');
    expect(q('app-kpi-strip')?.textContent).toContain('Colaboradores ativos');
  });

  it('o filtro de estado vai para a URL e o vazio do filtro acolhe', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/empresas?estado=negotiation' });
    expect(all('app-data-table tbody tr[data-row]')).toHaveLength(1);
    expect(q('app-active-filters')?.textContent).toContain('Estado: Em negociação');
    await go('/app/empresas?estado=suspended');
    expect(q('app-data-table')?.textContent).toContain('Nenhum resultado com esses filtros');
  });

  it('cadastrar uma empresa pela gaveta: CNPJ fictício, validação em linha e abre a ficha', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/empresas' });
    click(q('[data-role="new-company"]'));
    await settle(app.fixture);
    all('#cf-form input:not([type="hidden"]), #cf-form select, #cf-form textarea').forEach((c) =>
      expect(hasAccessibleName(c), c.outerHTML.slice(0, 80)).toBe(true),
    );
    expect(q('#cf-form')?.textContent).toContain('Não faz parte da projeção do plano.');
    submit(q('#cf-form'));
    await settle(app.fixture);
    expect(q('app-error-summary')?.textContent).toContain('Informe o nome da empresa.');
    // CNPJ que parece real é recusado.
    typeInto(q('#cf-cnpj') as HTMLInputElement, '11222333000181');
    await settle(app.fixture);
    expect((q('#cf-cnpj') as HTMLInputElement).value).toBe('11.222.333/0001-81');
    submit(q('#cf-form'));
    await settle(app.fixture);
    expect(q('app-error-summary')?.textContent).toContain('Parece um CNPJ real. Use um CNPJ fictício.');
    click(q('[data-role="fill-example"]'));
    await settle(app.fixture);
    submit(q('#cf-form'));
    await settle(app.fixture);
    const created = app.db.corporateAccounts.find((a) => a.companyName === 'Transportes Exemplo Ltda.');
    expect(created?.status).toBe('prospect');
    expect(created?.seats).toBe(10);
    expect(created?.seatPriceCents).toBe(9900);
    expect(app.router.url).toBe(`/app/empresas/${created?.id}`);
    expect(q('h1')?.textContent).toContain('Transportes Exemplo Ltda.');
  });

  it('a ficha da Exemplo Logística mostra só vagas e adesão agregada, sem nome nem saúde (AC-M09-06)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/empresas/corp_0001' });
    expect(q('h1')?.textContent).toContain('Exemplo Logística Ltda.');
    expect(q('[data-role="adhesion"]')?.textContent).toContain('Menos de 5 colaboradores ativos');
    expect(q('[data-role="price-note"]')?.textContent).toContain('não faz parte da projeção do plano');
    await go('/app/empresas/corp_0001?aba=colaboradores');
    const chips = all('.code-chip').map((c) => c.textContent?.trim());
    expect(chips.join(' ')).toMatch(/CUI-0021/);
    expect(chips.join(' ')).toMatch(/CUI-0022/);
    expect(chips.join(' ')).toMatch(/CUI-0023/);
    expect(all('app-data-table tbody tr[data-row]')).toHaveLength(5);
    const dom = app.root.querySelector('main')?.textContent ?? '';
    ['cg_0021', 'cg_0022', 'cg_0023'].forEach((id) => {
      const caregiver = app.db.caregivers.require(id);
      expect(dom).not.toContain(caregiver.fullName);
      expect(dom).not.toContain(caregiver.email);
      expect(dom).not.toContain(caregiver.phone);
    });
    expect(dom.toLowerCase()).not.toContain('zarit');
    expect(dom.toLowerCase()).not.toContain('alerta');
    // Convites aparecem com o e-mail oculto.
    expect(dom).toContain('c***@exemplo.com.br');
    expect(dom).not.toContain('colaborador.convidado1@exemplo.com.br');
  });

  it('a 6ª vaga é bloqueada com o motivo ao lado; cancelar um convite libera e convidar de novo funciona (AC-M09-04)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/empresas/corp_0001?aba=colaboradores' });
    expect(q('[data-role="invite"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(q('[data-role="invite-reason"]')?.textContent).toContain('As 5 vagas contratadas já estão ocupadas');
    click(q('[data-role="invite"]'));
    await settle(app.fixture);
    expect(app.root.querySelector('app-invite-seat-drawer dialog')?.hasAttribute('open')).toBe(false);
    // Cancela o primeiro convite pelo diálogo de efeito.
    const cancel = all('[data-role="remove-seat"]').find((b) => b.textContent?.includes('Cancelar convite'));
    click(cancel);
    await settle(app.fixture);
    expect(dialog().querySelector('h2')?.textContent).toContain('Cancelar o convite desta vaga?');
    click(dialog().querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    expect(app.db.corporateSeats.count((s) => s.corporateAccountId === 'corp_0001' && s.status === 'invited')).toBe(1);
    expect(q('[data-role="invite"]')?.getAttribute('aria-disabled')).toBeNull();
    click(q('[data-role="invite"]'));
    await settle(app.fixture);
    expect(app.root.querySelector('app-invite-seat-drawer dialog')?.hasAttribute('open')).toBe(true);
    expect(q('app-invite-seat-drawer')?.textContent).toContain('Vagas livres');
    typeInto(q('#is-email') as HTMLInputElement, 'pessoa@gmail.com');
    submit(q('#is-form'));
    await settle(app.fixture);
    expect(q('app-invite-seat-drawer app-error-summary')?.textContent).toContain('@exemplo.com.br');
    typeInto(q('#is-email') as HTMLInputElement, 'nova.pessoa@exemplo.com.br');
    submit(q('#is-form'));
    await settle(app.fixture);
    expect(app.db.corporateSeats.find((s) => s.invitedEmail === 'nova.pessoa@exemplo.com.br')?.status).toBe('invited');
    expect(q('[data-role="invite"]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('registrar a adesão pelo código passa o colaborador ao plano da empresa e ele aparece com o código', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/empresas/corp_0001?aba=colaboradores' });
    click(all('[data-role="adhesion"]').find((b) => b.tagName === 'BUTTON' && b.textContent?.includes('Registrar adesão')));
    await settle(app.fixture);
    typeInto(q('#ad-code') as HTMLInputElement, 'CUI-0021');
    submit(q('#ad-form'));
    await settle(app.fixture);
    expect(q('app-adhesion-drawer app-error-summary')?.textContent).toContain('já está em uma vaga de empresa');
    typeInto(q('#ad-code') as HTMLInputElement, 'CUI-0004');
    submit(q('#ad-form'));
    await settle(app.fixture);
    expect(app.db.subscriptions.find((s) => s.caregiverId === 'cg_0004')?.payer).toBe('corporate');
    expect(all('.code-chip').map((c) => c.textContent).join(' ')).toContain('CUI-0004');
  });

  it('encerrar o contrato descreve o efeito, passa os 3 colaboradores ao Livre e inativa os cartões (AC-M09-07)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/empresas/corp_0001' });
    click(q('[data-role="move-ended"]'));
    await settle(app.fixture);
    const body = dialog().textContent ?? '';
    expect(dialog().querySelector('h2')?.textContent).toContain('Encerrar o contrato de Exemplo Logística Ltda.?');
    expect(body).toContain('3 colaboradores');
    expect(body).toContain('3 cartões');
    expect(body).toContain('2 convites');
    expect(dialog().querySelector('[data-role="confirm"]')?.textContent).toContain('Encerrar contrato');
    click(dialog().querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    expect(app.db.corporateAccounts.require('corp_0001').status).toBe('ended');
    ['cg_0021', 'cg_0022', 'cg_0023'].forEach((id) => {
      expect(app.db.subscriptions.find((s) => s.caregiverId === id)?.planId).toBe('livre');
      expect(app.db.benefitCards.find((c) => c.caregiverId === id)?.status).toBe('inactive');
    });
    expect(q('[data-role="status"]')?.textContent).toContain('Encerrado');
    expect(q('[data-role="edit-company"]')).toBeNull();
    expect(q('[data-role="next-steps"]')?.textContent).toContain('Contrato encerrado');
  });

  it('o funil leva a negociação ao contrato ativo e o botão diz o que falta', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/empresas/corp_0003' });
    click(q('[data-role="move-negotiation"]'));
    await settle(app.fixture);
    expect(app.db.corporateAccounts.require('corp_0003').status).toBe('negotiation');
    app.db.corporateAccounts.update('corp_0003', { seatPriceCents: 0 });
    await settle(app.fixture);
    expect(q('[data-role="move-active"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(q('[data-role="move-reason"]')?.textContent).toContain('vagas contratadas e preço por vaga');
  });

  it('o atendimento só lê: sem botões de escrita nas telas de empresas', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/empresas' });
    expect(all('app-data-table tbody tr[data-row]')).toHaveLength(3);
    expect(q('[data-role="new-company"]')).toBeNull();
    expect(q('[data-role="read-only-note"]')).not.toBeNull();
    await go('/app/empresas/corp_0001?aba=colaboradores');
    expect(q('[data-role="invite"]')).toBeNull();
    expect(q('[data-role="remove-seat"]')).toBeNull();
    expect(q('app-company-form-drawer')).toBeNull();
    await go('/app/empresas/corp_0001');
    expect(q('[data-role="next-steps"]')).toBeNull();
    expect(q('[data-role="edit-company"]')).toBeNull();
  });

  it('empresa que não existe mostra o aviso acolhedor', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/empresas/corp_9999' });
    expect(q('app-empty-state')?.textContent).toContain('Não encontramos esta empresa');
  });
});
