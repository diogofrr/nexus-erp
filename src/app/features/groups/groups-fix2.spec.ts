import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};
const q = (app: BootedApp, selector: string) => app.root.querySelector<HTMLElement>(selector);

async function openEnroll(userId: string, caregiverId: string): Promise<{ app: BootedApp; drawer: HTMLDialogElement }> {
  TestBed.resetTestingModule();
  const app = await bootApp({ userId, url: '/app/grupos/act_0008' });
  click(q(app, '[data-role="enroll"]'));
  await settle(app.fixture);
  // A lista começa com as primeiras 30 pessoas: busca pelo código antes de escolher.
  const search = app.root.querySelector('app-enroll-drawer input[type="search"]') as HTMLInputElement;
  search.value = app.db.caregivers.require(caregiverId).code;
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(app.fixture);
  const select = app.root.querySelector('app-enroll-drawer [data-role="enroll-select"]') as HTMLSelectElement;
  select.value = caregiverId;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await settle(app.fixture);
  return { app, drawer: app.root.querySelector('app-enroll-drawer dialog') as HTMLDialogElement };
}

describe('Inscrever em grupo: ajustes do Fix-2 (CX-042)', () => {
  it('plano que não dá acesso ganha o atalho "Trocar o plano", que abre a assinatura do cuidador', async () => {
    const { app, drawer } = await openEnroll('u7', 'cg_0006');
    const link = drawer.querySelector<HTMLAnchorElement>('[data-role="change-plan"]');
    expect(link?.textContent).toContain('Trocar o plano');
    const subscription = app.db.subscriptions.find((s) => s.caregiverId === 'cg_0006');
    expect(subscription).toBeDefined();
    expect(link?.getAttribute('href')).toBe(`/app/assinaturas/${subscription?.id}`);
  });

  it('com plano que dá acesso o atalho não aparece', async () => {
    const { drawer } = await openEnroll('u7', 'cg_0001');
    expect(drawer.querySelector('[data-role="change-plan"]')).toBeNull();
  });

  it('a gestão, que busca só pelo código, também tem o atalho', async () => {
    const partner = await openEnroll('u1', 'cg_0006');
    expect(partner.drawer.querySelector('[data-role="change-plan"]')).toBeTruthy();
    expect(partner.drawer.textContent).not.toContain(partner.app.db.caregivers.require('cg_0006').fullName);
  });

  it('a lista diz que mostra só as primeiras pessoas até digitar, e a mensagem de sucesso não tem gênero', async () => {
    TestBed.resetTestingModule();
    const fresh = await bootApp({ userId: 'u7', url: '/app/grupos/act_0008' });
    click(q(fresh, '[data-role="enroll"]'));
    await settle(fresh.fixture);
    expect(fresh.root.querySelector('app-enroll-drawer [data-role="more-options"]')?.textContent).toMatch(/A lista mostra 30 de \d+ pessoas\./);
    const { app, drawer } = await openEnroll('u7', 'cg_0001');
    // Aceita o contrato e inscreve: o aviso diz "Inscrição registrada", sem "inscrito" no masculino.
    click(drawer.querySelector('[data-role="contract-accept"] input'));
    await settle(app.fixture);
    click(drawer.querySelector('[data-role="enroll-submit"]'));
    await settle(app.fixture);
    const toast = app.root.querySelector('.toast')?.textContent ?? '';
    expect(toast).toContain('Inscrição registrada para');
    expect(toast).not.toContain('inscrito');
  });
});
