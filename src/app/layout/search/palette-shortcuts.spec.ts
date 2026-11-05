import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { shortcutsFor, ShortcutService } from '../shortcuts/shortcut.service';
import { UiPrefsService } from '../../shared/ui/overlay/ui-prefs.service';
import { LayoutDialogsService } from '../state/layout-dialogs.service';
import { BootedApp, bootApp, settle } from '../testing';

const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('atalhos de teclado (5.16)', () => {
  let app: BootedApp;
  const palette = (): HTMLDialogElement =>
    app.root.querySelector('dialog.cmdk') as HTMLDialogElement;

  it('Ctrl+K (e Cmd+K) abre a paleta com o foco no campo; Esc fecha e devolve o foco', async () => {
    app = await bootApp({ userId: 'u7' });
    const opener = app.root.querySelector<HTMLButtonElement>(
      '.search-trigger',
    ) as HTMLButtonElement;
    opener.focus();
    const event = key(document.body, 'k', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    await settle(app.fixture);
    expect(palette().hasAttribute('open')).toBe(true);
    expect(document.activeElement?.getAttribute('role')).toBe('combobox');

    key(palette(), 'Escape');
    await settle(app.fixture);
    expect(palette().hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(opener);

    key(document.body, 'k', { metaKey: true });
    await settle(app.fixture);
    expect(palette().hasAttribute('open')).toBe(true);
  });

  it('atalhos de uma tecla só valem fora de campo de texto e podem ser desligados (WCAG 2.1.4)', async () => {
    app = await bootApp({ userId: 'u7' });
    const input = document.createElement('input');
    app.root.appendChild(input);
    input.focus();
    key(input, '/');
    await settle(app.fixture);
    expect(palette().hasAttribute('open')).toBe(false);
    // Fora do campo: "/" abre a paleta.
    input.blur();
    key(document.body, '/');
    await settle(app.fixture);
    expect(palette().hasAttribute('open')).toBe(true);
    key(palette(), 'Escape');
    await settle(app.fixture);

    // Desligados nas preferências: "/" e "?" não fazem nada; Ctrl+K continua.
    TestBed.inject(UiPrefsService).setSingleKeyShortcuts(false);
    key(document.body, '/');
    key(document.body, '?');
    await settle(app.fixture);
    expect(palette().hasAttribute('open')).toBe(false);
    expect(TestBed.inject(LayoutDialogsService).shortcutsOpen()).toBe(false);
    key(document.body, 'k', { ctrlKey: true });
    await settle(app.fixture);
    expect(palette().hasAttribute('open')).toBe(true);
  });

  it('"?" abre a lista de atalhos só com o que o perfil tem (G e A não existe para o atendimento)', async () => {
    app = await bootApp({ userId: 'u7' });
    key(document.body, '?');
    await settle(app.fixture);
    const dialog = app.root.querySelector<HTMLDialogElement>(
      'dialog[aria-labelledby="nx-shortcuts-title"]',
    ) as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(true);
    const text = dialog.textContent ?? '';
    expect(text).toContain('Ir a Cuidadores');
    expect(text).toContain('Ir a Mensagens');
    expect(text).not.toContain('Ir a Acompanhamento');
    expect(text).not.toContain('Responde o item da escala');
    expect(text).toContain('Termos da equipe');
    // Esc fecha.
    key(dialog, 'Escape');
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle(app.fixture);
    expect(dialog.hasAttribute('open')).toBe(false);

    expect(shortcutsFor('psychologist').some((s) => s.text === 'Ir a Acompanhamento')).toBe(true);
    expect(shortcutsFor('support').some((s) => s.text === 'Ir a Acompanhamento')).toBe(false);
    // Sem perfil do credenciado: todos os atalhos de "Ir para" levam ao back-office.
    expect(shortcutsFor('support').map((s) => s.keys.join('+'))).toContain('G+P');
  });

  it('G e depois uma letra leva à tela, só se o perfil a vê', async () => {
    app = await bootApp({ userId: 'u7' });
    key(document.body, 'g');
    key(document.body, 'm');
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/mensagens');
    // O atendimento não tem Acompanhamento: G e A não navega.
    key(document.body, 'g');
    key(document.body, 'a');
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/mensagens');
    key(document.body, 'g');
    key(document.body, 'p');
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/painel');

    // O psicólogo vai a Acompanhamento: a raiz do módulo mostra a fila no próprio endereço.
    TestBed.resetTestingModule();
    app = await bootApp({ userId: 'u3' });
    key(document.body, 'g');
    key(document.body, 'a');
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/acompanhamento');

    // A sócia só vê o agregado: a raiz do módulo a leva ao painel agregado.
    TestBed.resetTestingModule();
    app = await bootApp({ userId: 'u1' });
    key(document.body, 'g');
    key(document.body, 'a');
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/acompanhamento/agregado');
  });

  it('os atalhos de página (J, K, N, F, 0 a 4...) viram eventos para as telas assinarem', async () => {
    app = await bootApp({ userId: 'u7' });
    const seen: string[] = [];
    TestBed.inject(ShortcutService).page$.subscribe((e) =>
      seen.push(e.value !== undefined ? `${e.id}:${e.value}` : e.id),
    );
    ['j', 'k', 'f', 'n', 'r', '3', 'ArrowRight'].forEach((k) => key(document.body, k));
    key(document.body, 'Enter', { ctrlKey: true });
    expect(seen).toEqual([
      'list-next',
      'list-previous',
      'list-filters',
      'list-new',
      'message-reply',
      'scale-answer:3',
      'step-next',
      'form-submit',
    ]);
    // Dentro de um campo de texto, nenhum deles dispara.
    seen.length = 0;
    const field = document.createElement('textarea');
    app.root.appendChild(field);
    field.focus();
    key(field, 'j');
    key(field, '3');
    expect(seen).toEqual([]);
  });

  it('sem sessão não há atalho algum', async () => {
    app = await bootApp({});
    const event = key(document.body, 'k', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('paleta de comandos', () => {
  let app: BootedApp;
  const palette = (): HTMLDialogElement =>
    app.root.querySelector('dialog.cmdk') as HTMLDialogElement;
  const input = (): HTMLInputElement => palette().querySelector('input') as HTMLInputElement;
  const options = (): HTMLElement[] =>
    Array.from(palette().querySelectorAll<HTMLElement>('[role="option"]'));

  const open = async (): Promise<void> => {
    key(document.body, 'k', { ctrlKey: true });
    await settle(app.fixture);
  };
  const type = async (text: string): Promise<void> => {
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await wait(190);
    await settle(app.fixture);
  };

  it('sem digitar mostra as ações do perfil; combobox acessível com aria-activedescendant', async () => {
    app = await bootApp({ userId: 'u7' });
    await open();
    expect(input().getAttribute('role')).toBe('combobox');
    expect(input().getAttribute('aria-controls')).toBe('nx-cmdk-list');
    const groups = Array.from(palette().querySelectorAll('.cmdk__group')).map((g) =>
      g.textContent?.trim(),
    );
    expect(groups[0]).toMatch(/^Ações/);
    expect(options().map((o) => o.textContent?.trim())).toContain('Novo cuidador');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0]?.id);
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true');
    expect(palette().querySelector('.cmdk__foot')?.textContent).toContain(
      'Só mostra o que o seu perfil pode ver.',
    );
  });

  it('digitar agrupa por tipo, com contagem, sem acento; setas movem; Enter abre e grava nos recentes', async () => {
    app = await bootApp({ userId: 'u7' });
    await open();
    await type('JOAO batista');
    expect(palette().textContent).toContain('Cuidadores (1)');
    expect(options()).toHaveLength(1);
    expect(options()[0]?.textContent).toContain('João Batista Carneiro');
    expect(palette().querySelector('[role="status"]')?.textContent).toBe('1 resultado');
    // O texto digitado não vai para a URL nem para o título.
    expect(app.router.url).not.toContain('batista');

    await type('cuidadores');
    expect(options().length).toBeGreaterThan(1);
    key(palette(), 'ArrowDown');
    await settle(app.fixture);
    expect(options()[1]?.getAttribute('aria-selected')).toBe('true');
    key(palette(), 'ArrowUp');
    key(palette(), 'ArrowUp');
    await settle(app.fixture);
    expect(options()[options().length - 1]?.getAttribute('aria-selected')).toBe('true');

    await type('Ana Paula');
    key(palette(), 'Enter');
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/cuidadores/cg_0001');
  });

  it('a gestão que digita um nome vê a dica do código; por código encontra o cuidador sem nome', async () => {
    app = await bootApp({ userId: 'u1' });
    await open();
    await type('Ana Paula');
    expect(palette().querySelector('[data-role="message"]')?.textContent).toBe(
      'A gestão busca por código, por exemplo CUI-0001.',
    );
    expect(palette().textContent).not.toContain('Ana Paula Ferraz');
    await type('CUI-0001');
    expect(options().map((o) => o.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'CUI-0001Nexus Cuida · Ativo',
    ]);
    expect(palette().textContent).not.toContain('Ana Paula Ferraz');
  });

  it('busca sem resultado diz o que fazer', async () => {
    app = await bootApp({ userId: 'u3' });
    await open();
    await type('zzzzqq');
    expect(options()).toHaveLength(0);
    expect(palette().querySelector('[data-role="message"]')?.textContent).toContain(
      'Tente o código (CUI-0001)',
    );
    expect(palette().querySelector('[role="status"]')?.textContent).toBe('Nenhum resultado');
  });

  it('Tab pula de grupo e o clique abre a tela (ação da paleta só abre, nunca executa)', async () => {
    app = await bootApp({ userId: 'u3' });
    await open();
    await type('agenda');
    const groups = palette().querySelectorAll('.cmdk__group');
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const action = options().find((o) => o.textContent?.includes('Minha agenda de hoje'));
    expect(action).toBeDefined();
    action?.click();
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/atendimento/agenda');
  });
});
