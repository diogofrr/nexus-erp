import { describe, expect, it } from 'vitest';
import { copyOrSelect, copyToClipboard, selectContents } from './clipboard';

function fakeDoc(clipboard: Partial<Clipboard> | undefined): Document {
  return { defaultView: { navigator: { clipboard } } } as unknown as Document;
}

describe('copyToClipboard', () => {
  it('copia e devolve verdadeiro', async () => {
    const copied: string[] = [];
    const ok = await copyToClipboard('NX-0000-1007', fakeDoc({ writeText: async (t: string) => void copied.push(t) }));
    expect(ok).toBe(true);
    expect(copied).toEqual(['NX-0000-1007']);
  });

  it('devolve falso, sem lançar, quando o navegador nega ou não tem a área de transferência', async () => {
    const denied = fakeDoc({ writeText: async () => Promise.reject(new Error('negado')) });
    expect(await copyToClipboard('texto', denied)).toBe(false);
    expect(await copyToClipboard('texto', fakeDoc(undefined))).toBe(false);
    expect(await copyToClipboard('texto', { defaultView: null } as unknown as Document)).toBe(false);
  });
});

describe('selectContents e copyOrSelect (plano B de quando o navegador nega a cópia)', () => {
  it('seleciona o conteúdo do elemento e não faz nada sem elemento', () => {
    document.body.innerHTML = '<p id="n">(34) 90000-0000</p>';
    selectContents(document.getElementById('n'), document);
    expect(window.getSelection()?.toString()).toBe('(34) 90000-0000');
    window.getSelection()?.removeAllRanges();
    selectContents(null, document);
    expect(window.getSelection()?.toString()).toBe('');
  });

  it('copia sem selecionar quando dá certo; quando o navegador nega, deixa o elemento selecionado e devolve falso', async () => {
    document.body.innerHTML = '<p id="n">188</p>';
    const element = document.getElementById('n');
    const copied: string[] = [];
    const real = document.defaultView?.navigator;
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: async (t: string) => void copied.push(t) },
      configurable: true,
    });
    window.getSelection()?.removeAllRanges();
    expect(await copyOrSelect('188', element, document)).toBe(true);
    expect(copied).toEqual(['188']);
    expect(window.getSelection()?.toString()).toBe('');

    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: async () => Promise.reject(new Error('negado')) },
      configurable: true,
    });
    expect(await copyOrSelect('188', element, document)).toBe(false);
    expect(window.getSelection()?.toString()).toBe('188');
    expect(real).toBeDefined();
  });
});
