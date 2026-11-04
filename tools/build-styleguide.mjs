// Gera docs/styleguide.html: página única e autocontida (CSS compilado, fontes
// em base64 e sprite de ícones embutidos). Uso: node tools/build-styleguide.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSprite } from './build-icons.mjs';
import { logoInner } from './brand.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sass = createRequire(createRequire(import.meta.url).resolve('@angular/build/package.json'))('sass');

let css = sass.compile(join(root, 'src', 'styles.scss'), { style: 'compressed' }).css;
css = css.replace(/url\(["']?([^"')]*\.woff2)["']?\)/g, (_, p) => {
  const file = resolve(join(root, 'src', 'styles'), p);
  return `url(data:font/woff2;base64,${readFileSync(file).toString('base64')})`;
});

const iconMacro = (_, name, size) => `<svg class="icon${size ? ` icon--${size}` : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
let html = readFileSync(join(root, 'tools', 'styleguide.template.html'), 'utf8')
  .replace('{{CSS}}', () => css)
  .replace('{{SPRITE}}', () => buildSprite())
  .replace('{{LOGO_INNER}}', () => logoInner)
  .replace(/\{\{i:([a-z0-9-]+)(?::(sm|lg|xl))?\}\}/g, iconMacro);

// imagens da marca embutidas (a página precisa funcionar sozinha, de qualquer pasta)
html = html.replace(/(src|href)="\.\.\/public\/brand\/([a-z-]+\.svg)"/g, (_, attr, f) =>
  `${attr}="data:image/svg+xml;base64,${readFileSync(join(root, 'public', 'brand', f)).toString('base64')}"`);

writeFileSync(join(root, 'docs', 'styleguide.html'), html);
console.log(`docs/styleguide.html gerado (${(html.length / 1024).toFixed(0)} KB)`);
