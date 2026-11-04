// Geometria do símbolo da Nexus, redesenhada em SVG limpo a partir do logo
// (duas mãos abertas sustentando três figuras, em linha fina dourada) e gerador
// dos arquivos em public/brand/. Uso: node tools/brand.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GOLD = '#B8901F';

// Mão esquerda (a direita é o espelho em torno de x = 60).
const handLeft = `<path d="M33 99V81.7L0 45.2V13H5Q11.1 13.4 11.1 20V42.1L55 73V99"/><path d="M13.4 52.5L30.4 64.6"/>`;
// Mulher da esquerda (a da direita é o espelho).
const womanLeft = `<ellipse cx="36.5" cy="14.6" rx="5.3" ry="6.4"/><path d="M31.2 15.5C30.2 7.8 33.2 6.2 36.5 6.2C39.8 6.2 42.8 7.8 41.8 15.5L43.6 22.4M31.2 15.5L29.2 22.4"/><path d="M34.4 20.8V24M38.6 20.8V24"/><path d="M23.5 36V31.5Q23.5 27.4 28 26.2L34.2 24.4L36.5 29L38.8 24.4L45 26.2Q49.5 27.4 49.5 31.5V36"/>`;
const man = `<ellipse cx="60" cy="26" rx="6.2" ry="7"/><path d="M54 23.8Q60 20.4 66 23.8"/><path d="M57.4 32.8V37M62.6 32.8V37"/><path d="M44 53V47.5Q44 43.2 48.8 42L57 39.2L60 44.2L63 39.2L71.2 42Q76 43.2 76 47.5V53"/>`;
const mirror = (inner) => `<g transform="translate(120 0) scale(-1 1)">${inner}</g>`;

export const hands = `${handLeft}${mirror(handLeft)}<path d="M-16 99H136"/>`;
export const figures = `${womanLeft}${mirror(womanLeft)}${man}`;
export const symbolInner = `${hands}${figures}`;
export const SYMBOL_VIEWBOX = '-18 3 156 98';

// NEXUS em traço fino, espaçado, desenhado como caminhos (não depende de fonte).
const letters = {
  N: 'M0 22V0L15.6 22V0',
  E: 'M15.6 0H0V22H15.6M0 11H12.6',
  X: 'M0 0L15.6 22M15.6 0L0 22',
  U: 'M0 0V13.8A7.8 7.8 0 0 0 15.6 13.8V0',
  S: 'M14.6 4.4C13.4 1.9 10.9 0.2 7.8 0.2C4 0.2 1.2 2.4 1.2 5.5C1.2 12.8 14.6 9.4 14.6 16.6C14.6 19.7 11.6 21.8 7.8 21.8C4.4 21.8 1.9 20.2 0.6 17.6',
};
const ADV = 32;
export const wordmarkInner = Object.values(letters)
  .map((d, i) => `<path transform="translate(${i * ADV} 0)" d="${d}"/>`)
  .join('');
export const WORDMARK_VIEWBOX = '-2 -2 147 26';

const attrs = (w) => `fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const symbolSvg = (w = 1.6) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SYMBOL_VIEWBOX}" color="${GOLD}" role="img" aria-label="Nexus: duas mãos abertas sustentando três pessoas"><g ${attrs(w)}>${symbolInner}</g></svg>\n`;

const handsSvg = (w = 1.6) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SYMBOL_VIEWBOX}" color="${GOLD}" aria-hidden="true"><g ${attrs(w)}>${hands}</g></svg>\n`;

const wordmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORDMARK_VIEWBOX}" color="${GOLD}" role="img" aria-label="Nexus"><g ${attrs(1.6)}>${wordmarkInner}</g></svg>\n`;

export const logoInner = `<g transform="translate(0 -3)">${symbolInner}</g><g transform="translate(-11.5 112)">${wordmarkInner}</g><path d="M-48 109L-6 148M168 109L126 148" stroke-width="1"/>`;
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -2 220 152" color="${GOLD}" role="img" aria-label="Nexus"><g ${attrs(1.5)}>${logoInner}</g></svg>\n`;

// Favicon: versão simplificada e mais grossa (legível em 16 px).
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1B4669"/><g fill="none" stroke="#E3C15E" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 25V37L24 50V57M21 25V31L29 40V57"/><path d="M51 25V37L40 50V57M43 25V31L35 40V57"/><circle cx="32" cy="17" r="5.5"/><path d="M23.5 33Q23.5 26.5 32 26.5Q40.5 26.5 40.5 33"/></g></svg>\n`;

export function writeBrand() {
  const dir = join(root, 'public', 'brand');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'nexus-symbol.svg'), symbolSvg(1.6));
  writeFileSync(join(dir, 'nexus-symbol-bold.svg'), symbolSvg(3.2));
  writeFileSync(join(dir, 'nexus-hands.svg'), handsSvg(1.6));
  writeFileSync(join(dir, 'nexus-wordmark.svg'), wordmarkSvg);
  writeFileSync(join(dir, 'nexus-logo.svg'), logoSvg);
  writeFileSync(join(dir, 'favicon.svg'), faviconSvg);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  writeBrand();
  console.log('public/brand/*.svg gerados');
}
