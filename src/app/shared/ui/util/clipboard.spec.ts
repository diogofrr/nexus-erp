import { describe, expect, it } from 'vitest';
import { copyToClipboard } from './clipboard';

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
