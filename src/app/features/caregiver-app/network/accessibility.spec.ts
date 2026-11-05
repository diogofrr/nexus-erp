import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { bootCaregiverApp } from '../testing';

/**
 * Acessibilidade básica e tom das telas do Dev P3 (Rede, Cartão, Plano, Grupos e Conteúdos), com uma pessoa de plano pago e
 * uma do Livre: um `h1`, nome em todo botão e link, rótulo em todo campo, ícone decorativo escondido do leitor de tela,
 * folhas com título ligado, nenhum `tel:` nem `wa.me`, e o texto sem travessão, exclamação nem as palavras proibidas
 * (AC-CG-12, AC-CG-15 e AC-CG-16).
 */
const ROUTES = [
  '/cuidador/rede',
  '/cuidador/rede/buscar',
  '/cuidador/rede/buscar?categoria=physiotherapy',
  '/cuidador/rede/buscar?categoria=clinic',
  '/cuidador/rede/profissional/prv_01',
  '/cuidador/rede/profissional/prv_20',
  '/cuidador/rede/profissional/nao-existe',
  '/cuidador/rede/pedidos',
  '/cuidador/rede/pedidos?avaliar=srq_0126',
  '/cuidador/rede/cartao',
  '/cuidador/mais/plano',
  '/cuidador/mais/plano?ver=planos',
  '/cuidador/cuidar-de-mim/grupos',
  '/cuidador/cuidar-de-mim/grupos?atividade=act_0001',
  '/cuidador/cuidar-de-mim/grupos?atividade=act_0008',
  '/cuidador/cuidar-de-mim/grupos?atividade=act_0003',
  '/cuidador/cuidar-de-mim/conteudos',
  '/cuidador/cuidar-de-mim/conteudos?conteudo=gdc_0002',
];

const PEOPLE = ['cg_0001', 'cg_0003', 'cg_0008'];

/** Travessão longo e médio (códigos 8211 e 8212), montados por número para o próprio arquivo não ter nenhum. */
const DASHES = new RegExp(`[${String.fromCharCode(8211, 8212)}]`);

const FORBIDDEN = /\b(guerreira|anjo|heroína|pacientes?|idosos?|eficácia)\b/i;

function accessibleName(el: Element): string {
  const label = el.getAttribute('aria-label');
  if (label) {
    return label.trim();
  }
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    return labelledby
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
  }
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('Telas do Dev P3: acessibilidade básica e tom', () => {
  afterEach(() => TestBed.resetTestingModule());

  for (const url of ROUTES) {
    it(`${url}: um h1, nomes, rótulos, ícones e texto calmo`, async () => {
      for (const person of PEOPLE) {
        const app = await bootCaregiverApp(person, { url });
        const main = app.root.querySelector('main') as HTMLElement;
        const where = `${url} (${person})`;

        expect(main.querySelectorAll('h1').length, `${where}: h1`).toBe(1);

        main.querySelectorAll('button, a[href]').forEach((el) => {
          expect(accessibleName(el).length, `${where}: nome de <${el.tagName.toLowerCase()}> "${el.outerHTML.slice(0, 80)}"`).toBeGreaterThan(0);
        });

        main.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach((el) => {
          const labels = (el as HTMLInputElement).labels?.length ?? 0;
          const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
          expect(labels > 0 || !!named, `${where}: rótulo de ${el.outerHTML.slice(0, 80)}`).toBe(true);
        });

        // Ícone é apoio: decorativo escondido; com papel de imagem tem nome.
        main.querySelectorAll('svg').forEach((svg) => {
          const decorative = svg.getAttribute('aria-hidden') === 'true';
          const named = svg.getAttribute('role') === 'img' && !!svg.getAttribute('aria-label');
          expect(decorative || named, `${where}: svg sem aria-hidden nem nome`).toBe(true);
        });

        // Folha de baixo: título ligado ao diálogo.
        main.querySelectorAll('dialog.cg-sheet').forEach((dialog) => {
          const id = dialog.getAttribute('aria-labelledby');
          expect(id && dialog.querySelector(`#${id}`), `${where}: título da folha`).toBeTruthy();
        });

        const hrefs = Array.from(main.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
        expect(hrefs.some((h) => h.startsWith('tel:') || h.startsWith('mailto:') || h.includes('wa.me')), `${where}: tel/wa.me`).toBe(false);

        const text = main.textContent ?? '';
        expect(DASHES.test(text), `${where}: travessão`).toBe(false);
        expect(/[A-Za-zÀ-ÿ0-9]!(\s|$)/.test(text), `${where}: exclamação`).toBe(false);
        expect(FORBIDDEN.test(text), `${where}: palavra proibida`).toBe(false);
        expect(/diagn[óo]stic/i.test(text.replace(/não é um diagnóstico/gi, '')), `${where}: diagnóstico`).toBe(false);
        expect(/\balertas?\b/i.test(text), `${where}: alerta`).toBe(false);
        TestBed.resetTestingModule();
      }
    });
  }

  it('com a letra Bem grande, as telas seguem com o mesmo conteúdo e o marcador do tamanho no host', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais/plano?ver=planos' });
    const before = (app.root.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ');
    app.context.setFontScale('xlarge');
    await app.fixture.whenStable();
    expect(app.root.querySelector('.cg-app, [data-text]')?.getAttribute('data-text') ?? app.root.getAttribute('data-text')).toBe('xlarge');
    expect((app.root.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ')).toBe(before);
  });
});
