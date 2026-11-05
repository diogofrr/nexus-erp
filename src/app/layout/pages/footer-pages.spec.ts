import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../testing';
import { formatBytes } from './browser-data.page';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};

describe('páginas do rodapé (LP-23 e SCR-M12-10)', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);

  it('formata o tamanho em B, KB e MB', () => {
    expect(formatBytes(812)).toBe('812 B');
    expect(formatBytes(34 * 1024 + 205)).toBe('34,2 KB');
    expect(formatBytes(1.7 * 1024 * 1024)).toBe('1,7 MB');
  });

  it('"Privacidade e canal do titular" abre para equipe e para o credenciado, com a encarregada fictícia e os direitos', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/canal-do-titular' });
    expect(q('h1')?.textContent).toBe('Privacidade e canal do titular');
    const policy = app.db.privacyDocuments.find((d) => d.kind === 'privacy_policy');
    expect(q('.dl')?.textContent).toContain(policy?.dpoName ?? '@@');
    expect(q('.dl')?.textContent).toContain(policy?.dpoEmail ?? '@@');
    expect(q('.dl')?.textContent).toContain('Até 15 dias corridos');
    expect(app.root.querySelectorAll('ul.list-reset li')).toHaveLength(8);
    expect(q('.prose')?.textContent).toContain('Base legal');
    // O link do rodapé e do menu do usuário leva até aqui.
    expect(q('.app-footer a[href="/app/canal-do-titular"]')).not.toBeNull();
  });

  it('não existe versão das páginas do rodapé para o antigo portal: /portal/canal-do-titular é 404', async () => {
    app = await bootApp({ userId: 'u7', url: '/portal/canal-do-titular' });
    expect(q('h1')?.textContent).toContain('Página não encontrada');
  });

  it('"Meus dados no navegador" mostra o que está guardado e o tamanho; "Apagar tudo" pede APAGAR e volta à entrada', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/meus-dados' });
    expect(q('h1')?.textContent).toBe('Meus dados no navegador');
    expect(q('.card__sub')?.textContent).toMatch(/\d+ itens, [\d,]+ (KB|MB) no total/);
    const rows = Array.from(app.root.querySelectorAll('tbody tr'));
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.length).toBeLessThanOrEqual(10);
    expect(rows[0]?.textContent).toContain('Neste navegador');

    click(q('[data-role="erase"]'));
    await settle(app.fixture);
    const dialog = app.root.querySelector('app-dialog-host dialog') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.querySelector('h2')?.textContent).toBe('Apagar todos os dados do navegador?');
    expect(dialog.textContent).toContain('Será eliminado');
    expect(dialog.textContent).toContain('Digite APAGAR para continuar');
    const confirm = dialog.querySelector<HTMLButtonElement>(
      '[data-role="confirm"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    // Errar o texto não habilita; Cancelar não apaga nada.
    const field = dialog.querySelector<HTMLInputElement>('input[type="text"]') as HTMLInputElement;
    field.value = 'apagar tud';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(app.fixture);
    expect(confirm.disabled).toBe(true);
    click(dialog.querySelector('[data-role="cancel"]'));
    await settle(app.fixture);
    expect(app.db.caregivers.size()).toBe(340);

    click(q('[data-role="erase"]'));
    await settle(app.fixture);
    const again = dialog.querySelector<HTMLInputElement>('input[type="text"]') as HTMLInputElement;
    again.value = 'APAGAR';
    again.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(app.fixture);
    click(dialog.querySelector('[data-role="confirm"]'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle(app.fixture);
    expect([...app.local.data.keys()].filter((k) => k.startsWith('nexus-erp:'))).toEqual([]);
    expect(app.hardNavigations).toEqual(['/login']);
  });
});
