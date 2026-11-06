#!/usr/bin/env node
/**
 * Verificação de contraste e de alvos de toque do aplicativo do cuidador (docs/10-cuidador-ux.md, Parte A;
 * AC-CG-01 e AC-CG-06). Node puro, sem dependências. Falha (código 1) com a lista dos itens abaixo do mínimo.
 *
 * O que confere:
 *  1. CONTRASTE (WCAG 2.1, luminância relativa) dos tokens `--cg-*` de `src/styles/_caregiver.scss`, resolvendo as
 *     cores primitivas `--nx-*` (mapas SCSS de `src/styles/_tokens.scss`). Os pares são os da Parte A: texto normal em
 *     4,5:1 e texto grande, contorno de campo, ícone de estado e anel de foco em 3:1. Cada par é conferido em TODOS os
 *     temas do cuidador (hoje só o claro, S-01; um bloco `.cg-app` que redefina cores `--cg-*` entra sozinho).
 *  2. PARES DECLARADOS NO CSS: toda regra de `_caregiver.scss` e de estilos de componente do aplicativo que declara ao
 *     mesmo tempo `color` e `background` (com cores que dá para resolver) precisa de 4,5:1.
 *  2b. VIDA VISUAL (docs/17-vida-kit.md): as tintas por seção (`--cg-sec-*`: tinta, fundo claro, fundo do emblema e cor cheia), as
 *     cinco cores do humor (`--cg-mood-*`) e o selo dourado, todos em 4,5:1 (texto) ou 3:1 (ícone, anel). Os parciais de
 *     `src/styles/caregiver/` entram na conferência de pares do CSS e de alvos.
 *  3. ALVOS: `--cg-target` e companhia nos tokens (48 px ou mais), e a altura (e a largura, quando declarada) dos
 *     controles do kit no CSS (`.btn`, `.cg-link-btn`, `.cg-row`, `.cg-choice`, ...), sempre de 48 px ou mais.
 *
 * Uso: `node scripts/check-caregiver-a11y.mjs`  (ou `pnpm run check:a11y`). Com `--list`, imprime a razão de cada
 * par do UX (para conferir contra os números de docs/10-cuidador-ux.md, A.1.1).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TOKENS_FILE = join(root, 'src', 'styles', '_tokens.scss');
const CAREGIVER_FILE = join(root, 'src', 'styles', '_caregiver.scss');
const CAREGIVER_PARTIALS_DIR = join(root, 'src', 'styles', 'caregiver');
const APP_DIR = join(root, 'src', 'app', 'features', 'caregiver-app');
const REM = 16;
const MIN_TARGET_PX = 48;

const rel = (file) => relative(root, file).split(sep).join('/');

// ============================================================================
// Cores e contraste (WCAG 2.1)
// ============================================================================

/** `#rgb` ou `#rrggbb` para [r, g, b] de 0 a 255; `null` se não for hex. */
function parseHex(value) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) {
    return null;
  }
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa (WCAG). */
function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razão de contraste entre duas cores (de 1 a 21). */
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ============================================================================
// Leitura do SCSS (um interpretador pequeno: blocos, `&`, at-regras, declarações)
// ============================================================================

function stripComments(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (two === '//' && text[i - 1] !== ':') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

function splitSelectors(header) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of header) {
    if (ch === '(' || ch === '[') {
      depth += 1;
    } else if (ch === ')' || ch === ']') {
      depth -= 1;
    }
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

function combine(parents, child) {
  const own = splitSelectors(child);
  if (parents.length === 0) {
    return own;
  }
  const out = [];
  for (const p of parents) {
    for (const c of own) {
      out.push(c.includes('&') ? c.replaceAll('&', p) : `${p} ${c}`);
    }
  }
  return out;
}

/**
 * Devolve as regras planas: `{ selectors: string[], decls: [{ prop, value, conditional }] }`. `conditional` marca o que
 * está dentro de `@media`, `@container` ou `@include` (valores que só valem em certas larguras ou estados).
 */
function parseRules(scss) {
  const text = stripComments(scss);
  const rules = [];
  /** Pilha de nós: `{ selectors, conditional, decls }`. */
  const stack = [{ selectors: [], conditional: false, decls: [] }];
  let buffer = '';

  const flushDeclaration = () => {
    const statement = buffer.trim();
    buffer = '';
    const m = /^(--[\w-]+|[a-z-]+)\s*:\s*([\s\S]+)$/.exec(statement);
    if (m && !statement.startsWith('@') && stack.length > 1) {
      stack[stack.length - 1].decls.push({ prop: m[1], value: m[2].trim() });
    }
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') {
      // `#{...}` é interpolação de Sass: não abre bloco.
      if (text[i - 1] === '#') {
        buffer += ch;
        continue;
      }
      const header = buffer.trim();
      buffer = '';
      const parent = stack[stack.length - 1];
      if (header.startsWith('@')) {
        const conditional = !header.startsWith('@at-root');
        stack.push({ selectors: parent.selectors, conditional: parent.conditional || conditional, decls: [], alias: parent });
      } else {
        stack.push({ selectors: combine(parent.selectors, header), conditional: parent.conditional, decls: [] });
      }
    } else if (ch === '}') {
      if (text[i - 1] !== '#' && buffer.trim().length > 0 && !/^[^:]*$/.test(buffer.trim())) {
        flushDeclaration();
      } else {
        buffer = '';
      }
      const node = stack.pop();
      if (node.decls.length > 0) {
        rules.push({
          selectors: node.selectors,
          decls: node.decls.map((d) => ({ ...d, conditional: node.conditional })),
        });
      }
    } else if (ch === ';') {
      flushDeclaration();
    } else {
      buffer += ch;
    }
  }
  return rules;
}

/** Os blocos `css` de `styles: \`...\`` dos componentes do aplicativo (CSS de componente). */
function componentStyles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (full.endsWith('.ts') && !full.endsWith('.spec.ts')) {
        const source = readFileSync(full, 'utf8');
        for (const m of source.matchAll(/styles:\s*(?:\[\s*)?`([\s\S]*?)`/g)) {
          out.push({ file: rel(full), css: m[1] });
        }
      }
    }
  };
  walk(dir);
  return out;
}

// ============================================================================
// Tokens: primitivos --nx-*, semânticos de :root e --cg-* de `.cg-app`
// ============================================================================

function readNxPrimitives(tokensScss) {
  const text = stripComments(tokensScss);
  const env = new Map();
  for (const m of text.matchAll(/\$([a-z]+):\s*\(([\s\S]*?)\);/g)) {
    for (const entry of m[2].matchAll(/(\d+):\s*(#[0-9a-fA-F]{3,6})/g)) {
      env.set(`--nx-${m[1]}-${entry[1]}`, entry[2]);
    }
  }
  return env;
}

function readRootTokens(tokensScss, env) {
  // O primeiro bloco `:root { ... }` tem os semânticos do tema claro.
  const text = stripComments(tokensScss);
  const start = text.indexOf(':root {');
  if (start === -1) {
    return;
  }
  let depth = 0;
  let end = start;
  for (let i = text.indexOf('{', start); i < text.length; i += 1) {
    if (text[i] === '{' && text[i - 1] !== '#') {
      depth += 1;
    } else if (text[i] === '}' && text[i - 1] !== '#') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = text.slice(start, end);
  for (const m of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    if (!m[1].startsWith('--nx-')) {
      env.set(m[1], m[2].trim());
    }
  }
}

/** Resolve um valor de cor (hex, `var(--x)` e `var(--x, fallback)`) até um hex; `null` se não der. */
function resolveColor(value, env, depth = 0) {
  if (depth > 12 || value == null) {
    return null;
  }
  const v = value.trim();
  const hex = parseHex(v);
  if (hex) {
    return hex;
  }
  const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v);
  if (!m) {
    return null;
  }
  return resolveColor(env.get(m[1]) ?? m[2], env, depth + 1);
}

/** Resolve um comprimento para px (rem e px; `var()` recursivo); `null` se não for simples (calc, %, etc.). */
function resolveLengthPx(value, env, depth = 0) {
  if (depth > 12 || value == null) {
    return null;
  }
  const v = value.trim();
  let m = /^(-?\d*\.?\d+)rem$/.exec(v);
  if (m) {
    return Number(m[1]) * REM;
  }
  m = /^(-?\d*\.?\d+)px$/.exec(v);
  if (m) {
    return Number(m[1]);
  }
  m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v);
  if (m) {
    return resolveLengthPx(env.get(m[1]) ?? m[2], env, depth + 1);
  }
  return null;
}

function isColorToken(name) {
  return /^--cg-(bg|surface|surface-sunken|text|text-soft|heading|action|action-hover|action-press|link|border|border-subtle|border-control|focus|focus-on-dark|gold-line|(care|soft|ok|late|error)-(bg|border|fg|icon)|danger-solid|emergency-bg|band-\d)$/.test(
    name,
  );
}

// ============================================================================
// Execução
// ============================================================================

const failures = [];
const notes = [];
let checked = 0;

const tokensScss = readFileSync(TOKENS_FILE, 'utf8');
const caregiverScss = readFileSync(CAREGIVER_FILE, 'utf8');

const baseEnv = readNxPrimitives(tokensScss);
readRootTokens(tokensScss, baseEnv);

const caregiverRules = parseRules(caregiverScss);
/** Os parciais (`src/styles/caregiver/_*.scss`): estilos novos do kit, conferidos como o resto. */
const partialSources = readdirSync(CAREGIVER_PARTIALS_DIR)
  .filter((name) => name.endsWith('.scss'))
  .map((name) => {
    const file = join(CAREGIVER_PARTIALS_DIR, name);
    return { file: rel(file), rules: parseRules(readFileSync(file, 'utf8')) };
  });
const allCaregiverRules = [...caregiverRules, ...partialSources.flatMap((p) => p.rules)];

/** Temas do cuidador: o claro (S-01) mais qualquer bloco de `.cg-app` que redefina cores `--cg-*`. */
const themes = [{ name: 'claro', env: new Map(baseEnv) }];
for (const rule of caregiverRules) {
  const isRoot = rule.selectors.length === 1 && rule.selectors[0] === '.cg-app';
  const colorDecls = rule.decls.filter((d) => d.prop.startsWith('--cg-') && isColorToken(d.prop));
  const mentionsApp = rule.selectors.some((s) => s.includes('.cg-app'));
  if (!mentionsApp || colorDecls.length === 0) {
    continue;
  }
  if (isRoot && !rule.decls.some((d) => d.conditional)) {
    themes[0].env = new Map([...themes[0].env, ...colorDecls.map((d) => [d.prop, d.value])]);
  } else {
    const name = rule.selectors.join(', ');
    const env = new Map(themes[0].env);
    colorDecls.forEach((d) => env.set(d.prop, d.value));
    themes.push({ name, env });
  }
}
// Os demais tokens (--cg-target etc.) valem para todos os temas.
for (const rule of caregiverRules) {
  if (rule.selectors.length === 1 && rule.selectors[0] === '.cg-app') {
    rule.decls
      .filter((d) => d.prop.startsWith('--') && !d.conditional && !isColorToken(d.prop))
      .forEach((d) => themes.forEach((t) => t.env.set(d.prop, d.value)));
  }
}

// As tintas por seção e o humor vivem em `:root` (a Entrada também as usa): valem para todos os temas.
for (const rule of caregiverRules) {
  if (rule.selectors.length === 1 && rule.selectors[0] === ':root') {
    rule.decls
      .filter((d) => /^--cg-(sec|mood|acc)-/.test(d.prop))
      .forEach((d) => themes.forEach((t) => t.env.set(d.prop, d.value)));
  }
}

// ---- 0. Premissa: o aplicativo do cuidador é só tema claro (S-01) ----------
if (!/\.cg-app\s*\{[^}]*color-scheme:\s*light/.test(stripComments(caregiverScss))) {
  failures.push('Tema: `.cg-app` precisa declarar `color-scheme: light` (S-01: o aplicativo do cuidador é só tema claro).');
}
const shellSource = readFileSync(join(APP_DIR, 'shell', 'caregiver-shell.component.ts'), 'utf8');
if (!/data-theme['"]?,?\s*['"]light/.test(shellSource) && !shellSource.includes("'light'")) {
  failures.push('Tema: o shell do cuidador precisa forçar `data-theme="light"` no <html> (S-01).');
}

// ---- 1. Pares do UX, Parte A (A.1.1, A.1.4, A.2) ---------------------------
const TEXT = 4.5; // texto normal
const LARGE = 3; // texto grande, contorno de campo, ícone de estado, anel de foco

/** [rótulo, primeiro plano, fundo, mínimo, de onde vem]. */
const SURFACES = ['--cg-bg', '--cg-surface', '--cg-surface-sunken'];
const PAIRS = [];
const pair = (label, fg, bg, min, source) => PAIRS.push({ label, fg, bg, min, source });

for (const bg of SURFACES) {
  pair('texto', '--cg-text', bg, TEXT, 'A.1.1');
  pair('texto de apoio', '--cg-text-soft', bg, TEXT, 'A.1.1');
  pair('título', '--cg-heading', bg, TEXT, 'A.1.1');
  pair('link', '--cg-link', bg, TEXT, 'A.1.1');
  pair('contorno de campo e botão', '--cg-border-control', bg, LARGE, 'A.1.1, AC-CG-06');
  pair('anel de foco', '--cg-focus', bg, LARGE, 'A.1.1, AC-CG-06');
  pair('item e borda selecionados', '--cg-action', bg, LARGE, 'A.2.9');
}
pair('texto do título sobre fundo de marca (etiqueta, ícone de linha)', '--cg-heading', '--brand-soft', TEXT, 'A.2');
pair('texto sobre fundo de marca (escolha marcada)', '--cg-text', '--brand-soft', TEXT, 'A.2.9');
pair('texto no botão principal', '--cg-surface', '--cg-action', TEXT, 'A.2.7');
pair('texto no botão principal (hover)', '--cg-surface', '--cg-action-hover', TEXT, 'A.2.7');
pair('texto no botão principal (pressionado)', '--cg-surface', '--cg-action-press', TEXT, 'A.2.7');
pair('texto no botão de ato irreversível', '--cg-surface', '--cg-danger-solid', TEXT, 'A.2.7');
pair('texto do aviso de emergência', '--cg-focus-on-dark', '--cg-emergency-bg', TEXT, 'A.2.19');
pair('anel de foco sobre o aviso de emergência', '--cg-focus-on-dark', '--cg-emergency-bg', LARGE, 'A.2.19');
for (const state of ['care', 'soft', 'ok', 'late', 'error']) {
  pair(`texto do estado ${state}`, `--cg-${state}-fg`, `--cg-${state}-bg`, TEXT, 'A.1.4');
  pair(`ícone do estado ${state}`, `--cg-${state}-icon`, `--cg-${state}-bg`, LARGE, 'A.1.4');
  // O mesmo texto e ícone aparecem sobre cartão branco (linha de remédio, "Dado às", estado do contato).
  pair(`texto do estado ${state} sobre cartão`, `--cg-${state}-fg`, '--cg-surface', TEXT, 'A.1.4');
  pair(`ícone do estado ${state} sobre cartão`, `--cg-${state}-icon`, '--cg-surface', LARGE, 'A.1.4');
}
// A rampa da escala: o ponto tem contorno de 2 px em `--cg-border-control`, então a faixa nunca depende só da cor
// do preenchimento; o preenchimento mais escuro (faixa 3 e 4) também passa 3:1 sozinho.
pair('faixa 3 da escala sobre cartão', '--cg-band-3', '--cg-surface', LARGE, 'A.2.21');
pair('faixa 4 da escala sobre cartão', '--cg-band-4', '--cg-surface', LARGE, 'A.2.21');
// Calendário da Agenda (`app-cg-calendar`): cada tipo de compromisso tem cor e forma, e o nome vai escrito na legenda e no
// rótulo; a marca passa 3:1 sobre o cartão e sobre o dia escolhido. O número de um dia de outro mês é texto (4,5:1).
for (const mark of ['--cg-action', '--cg-ok-icon', '--cg-soft-icon', '--nx-gold-700', '--cg-border-control']) {
  pair(`marca do calendário (${mark})`, mark, '--cg-surface', LARGE, 'calendário da Agenda');
  pair(`marca do calendário (${mark}) no dia escolhido`, mark, '--brand-soft', LARGE, 'calendário da Agenda');
  pair(`marca do calendário (${mark}) no dia escolhido (tinta da Rotina)`, mark, '--cg-sec-rotina-tint', LARGE, 'calendário da Agenda');
}
pair('número do dia de outro mês no calendário', '--cg-border-control', '--cg-surface', TEXT, 'calendário da Agenda');
pair('número do dia de hoje no calendário', '--cg-surface', '--cg-action', TEXT, 'calendário da Agenda');
pair('número do dia escolhido no calendário', '--cg-heading', '--brand-soft', TEXT, 'calendário da Agenda');
pair('número do dia escolhido no calendário (tinta da Rotina)', '--cg-sec-rotina-ink', '--cg-sec-rotina-tint', TEXT, 'calendário da Agenda');
pair('número do dia de hoje no calendário (cor cheia da Rotina)', '--cg-surface', '--cg-sec-rotina-solid', TEXT, 'calendário da Agenda');
// Meu plano (docs/17-vida-v2.md): cada plano tem a cor da Figura 1 (`--plan-*`) e o texto sobre ela. Texto claro só no Cuida; no
// Livre, no Essencial e no Sustenta (cores mais claras) o texto é escuro, para o nome e o preço passarem 4,5:1 sobre a cor pura.
// O texto escuro do mesmo plano (`--plan-*-text`) precisa passar sobre o branco (preço no cartão) e sobre o fundo claro do plano (ícone).
// A borda do plano atual no quadro (`--tone-line`) é a cor pura, menos no Sustenta, cujo dourado puro dá 2,98:1: ali é o dourado 600.
for (const [plan, on, line] of [
  ['livre', '--nx-slate-950', '--plan-livre'],
  ['essencial', '--nx-blue-950', '--plan-essencial'],
  ['cuida', '--nx-slate-0', '--plan-cuida'],
  ['sustenta', '--nx-slate-950', '--nx-gold-600'],
]) {
  pair(`texto sobre a cor do plano ${plan}`, on, `--plan-${plan}`, TEXT, 'Meu plano');
  pair(`preço do plano ${plan} sobre o cartão`, `--plan-${plan}-text`, '--cg-surface', TEXT, 'Meu plano');
  pair(`ícone do plano ${plan} sobre o fundo claro do plano`, `--plan-${plan}-text`, `--plan-${plan}-bg`, TEXT, 'Meu plano');
  pair(`borda do plano ${plan} sobre o cartão`, line, '--cg-surface', LARGE, 'Meu plano');
}

// Vida visual: cada seção (texto na tinta sobre o fundo claro e o do emblema, cor cheia do anel), o humor e os selos.
const SECTIONS = ['base', 'hoje', 'rotina', 'cuidar', 'rede', 'mais'];
for (const sec of SECTIONS) {
  const t = (name) => `--cg-sec-${sec}-${name}`;
  pair(`seção ${sec}: tinta sobre fundo claro`, t('ink'), t('tint'), TEXT, 'vida');
  pair(`seção ${sec}: tinta sobre o fundo do emblema`, t('ink'), t('strong'), TEXT, 'vida');
  pair(`seção ${sec}: tinta sobre cartão`, t('ink'), '--cg-surface', TEXT, 'vida');
  pair(`seção ${sec}: tinta sobre a página`, t('ink'), '--cg-bg', TEXT, 'vida');
  pair(`seção ${sec}: texto sobre fundo claro`, '--cg-text', t('tint'), TEXT, 'vida');
  pair(`seção ${sec}: texto sobre o fundo do emblema`, '--cg-text', t('strong'), TEXT, 'vida');
  pair(`seção ${sec}: texto de apoio sobre o fundo do emblema`, '--cg-text-soft', t('strong'), TEXT, 'vida');
  pair(`seção ${sec}: cor cheia (anel) sobre cartão`, t('solid'), '--cg-surface', LARGE, 'vida');
  pair(`seção ${sec}: cor cheia (anel) sobre o fundo claro`, t('solid'), t('tint'), LARGE, 'vida');
  pair(`seção ${sec}: ícone branco sobre a cor cheia`, '--cg-surface', t('solid'), TEXT, 'vida');
}
for (const level of [1, 2, 3, 4, 5]) {
  pair(`humor ${level}: carinha sobre o fundo`, `--cg-mood-${level}-ink`, `--cg-mood-${level}-tint`, LARGE, 'vida');
  pair(`humor ${level}: carinha sobre o cartão`, `--cg-mood-${level}-ink`, '--cg-surface', LARGE, 'vida');
  pair(`humor ${level}: rótulo sobre o fundo escolhido`, '--cg-text', `--cg-mood-${level}-tint`, TEXT, 'vida');
}
pair('selo dourado', '--nx-gold-800', '--nx-gold-100', TEXT, 'vida');
pair('check de dose dada (ícone branco)', '--cg-surface', '--cg-ok-icon', LARGE, 'vida');
pair('ícone do botão Ajuda agora (branco no azul)', '--cg-surface', '--nx-blue-800', TEXT, 'vida');

const LIST = process.argv.includes('--list');
for (const theme of themes) {
  for (const p of PAIRS) {
    const fg = resolveColor(`var(${p.fg})`, theme.env);
    const bg = resolveColor(`var(${p.bg})`, theme.env);
    if (!fg || !bg) {
      failures.push(`Contraste [${theme.name}] ${p.label}: não deu para resolver ${p.fg} ou ${p.bg} (${p.source}).`);
      continue;
    }
    checked += 1;
    const ratio = contrast(fg, bg);
    if (LIST) {
      console.log(`  [${theme.name}] ${ratio.toFixed(2).padStart(5)}:1 (mín. ${p.min})  ${p.label}: ${p.fg} sobre ${p.bg}`);
    }
    if (ratio < p.min) {
      failures.push(
        `Contraste [${theme.name}] ${p.label}: ${p.fg} sobre ${p.bg} dá ${ratio.toFixed(2)}:1, mínimo ${p.min}:1 (${p.source}).`,
      );
    }
  }
}

// Os pontos da rampa levam contorno de controle (a cor sozinha das faixas 1 e 2 não chega a 3:1).
const trendDots = caregiverRules.filter((r) => r.selectors.some((s) => s.endsWith('.cg-trend__dot')));
if (!trendDots.some((r) => r.decls.some((d) => d.prop === 'border' && d.value.includes('--cg-border-control')))) {
  failures.push('Contraste: `.cg-trend__dot` precisa ter contorno `--cg-border-control` (faixas 1 e 2 não chegam a 3:1 sozinhas).');
}

// Dourado: só decoração (UX A.1.4). Informativo, não reprova.
{
  const gold = resolveColor('var(--cg-gold-line)', themes[0].env);
  const surface = resolveColor('var(--cg-surface)', themes[0].env);
  if (gold && surface) {
    notes.push(`Dourado (--cg-gold-line) sobre cartão: ${contrast(gold, surface).toFixed(2)}:1 (só decoração, não é conferido).`);
  }
}

// ---- 2. Pares color + background declarados no CSS -------------------------
const cssSources = [
  { file: rel(CAREGIVER_FILE), rules: caregiverRules },
  ...partialSources,
  ...componentStyles(APP_DIR).map((s) => ({ file: s.file, rules: parseRules(s.css) })),
];
const SKIP_SELECTOR = /sr-only|visually-hidden/;
const colorOf = (rule, props) => {
  const found = rule.decls.filter((d) => props.includes(d.prop) && !d.conditional).at(-1);
  if (!found) {
    return null;
  }
  const value = props.includes('background') ? found.value.split(/\s+/).find((t) => t.startsWith('var(') || t.startsWith('#')) : found.value;
  return value ?? null;
};
const seenPairs = new Set();
let ruleChecked = 0;
for (const source of cssSources) {
  for (const rule of source.rules) {
    if (rule.selectors.every((s) => SKIP_SELECTOR.test(s))) {
      continue;
    }
    const fgValue = colorOf(rule, ['color']);
    const bgValue = colorOf(rule, ['background', 'background-color']);
    if (!fgValue || !bgValue) {
      continue;
    }
    for (const theme of themes) {
      const fg = resolveColor(fgValue, theme.env);
      const bg = resolveColor(bgValue, theme.env);
      if (!fg || !bg) {
        continue;
      }
      ruleChecked += 1;
      const ratio = contrast(fg, bg);
      const key = `${source.file}|${rule.selectors.join(',')}|${theme.name}`;
      if (ratio < TEXT && !seenPairs.has(key)) {
        seenPairs.add(key);
        failures.push(
          `Contraste [${theme.name}] CSS ${source.file}: ${rule.selectors[0]} usa ${fgValue} sobre ${bgValue} = ${ratio.toFixed(2)}:1, mínimo ${TEXT}:1.`,
        );
      }
    }
  }
}
checked += ruleChecked;

// ---- 3. Alvos de toque de 48 px --------------------------------------------
const env = themes[0].env;
const TOKEN_MINIMUMS = [
  ['--cg-target', MIN_TARGET_PX, 'alvo mínimo de toque (A.1.3)'],
  ['--cg-target-lg', 56, 'botão principal e linha de escolha (A.1.3)'],
  ['--cg-row-h', 64, 'item de lista (A.1.3)'],
  ['--cg-nav-h', 64, 'barra inferior (A.2.2)'],
  ['--control-h', MIN_TARGET_PX, 'altura dos campos e botões do design system dentro do aplicativo'],
  ['--control-h-sm', MIN_TARGET_PX, 'o aplicativo não tem controle compacto'],
];
for (const [name, min, why] of TOKEN_MINIMUMS) {
  const px = resolveLengthPx(`var(${name})`, env);
  checked += 1;
  if (px === null) {
    failures.push(`Alvo: não deu para resolver ${name} (${why}).`);
  } else if (px < min) {
    failures.push(`Alvo: ${name} vale ${px} px, mínimo ${min} px (${why}).`);
  }
}

/**
 * Os controles do kit (UX A.2): seletor que precisa declarar a altura mínima (e a largura, se declarada) de 48 px ou
 * mais. `needsHeight` exige que exista pelo menos uma declaração de altura.
 */
const CONTROLS = [
  { selector: /\.cg-header__brand$/, name: 'marca do cabeçalho' },
  { selector: /\.cg-help-now$/, name: 'Ajuda agora' },
  { selector: /\.cg-header__login$/, name: 'Entrar do cabeçalho' },
  { selector: /\.cg-proto-note__link$/, name: 'link do aviso de protótipo' },
  { selector: /\.cg-nav__link$/, name: 'item da barra de navegação' },
  { selector: /\.cg-link-btn$/, name: 'botão de texto' },
  { selector: /\.btn$/, name: 'botão', allowOnly: /^\.cg-app \.btn$/ },
  { selector: /\.btn--primary$/, name: 'botão principal' },
  { selector: /\.cg-row$/, name: 'item de lista' },
  { selector: /\.cg-choice$/, name: 'linha de escolha' },
  { selector: /\.cg-switch$/, name: 'chave liga e desliga' },
  { selector: /\.cg-mood__option$/, name: 'opção de humor' },
  { selector: /\.cg-rating__score$/, name: 'nota de 1 a 5' },
  { selector: /\.cg-text-size__option$/, name: 'opção de tamanho da letra' },
  { selector: /\.cg-dose__action$/, name: 'botão Dei' },
  { selector: /\.cg-card--link$|\.cg-card__link$/, name: 'cartão que é link' },
];
const HEIGHT_PROPS = ['min-height', 'height', 'min-block-size', 'block-size'];
const WIDTH_PROPS = ['min-width', 'width', 'min-inline-size', 'inline-size'];

for (const control of CONTROLS) {
  const matching = allCaregiverRules.filter((r) =>
    r.selectors.some((s) => control.selector.test(s) && !/__icon|__input|__text|__label/.test(s)),
  );
  if (matching.length === 0) {
    // O seletor não existe mais ou ainda não foi escrito: avisa, não reprova.
    notes.push(`Alvo: nenhuma regra encontrada para ${control.name}; conferir se o seletor mudou.`);
    continue;
  }
  const heights = matching.flatMap((r) => r.decls.filter((d) => HEIGHT_PROPS.includes(d.prop)).map((d) => ({ ...d, selector: r.selectors[0] })));
  const widths = matching.flatMap((r) => r.decls.filter((d) => WIDTH_PROPS.includes(d.prop)).map((d) => ({ ...d, selector: r.selectors[0] })));
  checked += 1;
  if (heights.length === 0) {
    failures.push(`Alvo: ${control.name} não declara altura mínima (precisa de ${MIN_TARGET_PX} px ou mais).`);
  }
  for (const d of [...heights, ...widths]) {
    const px = resolveLengthPx(d.value, env);
    if (px !== null && px < MIN_TARGET_PX) {
      failures.push(`Alvo: ${control.name} (${d.selector}) declara ${d.prop}: ${d.value} = ${px} px, mínimo ${MIN_TARGET_PX} px.`);
    }
  }
  const strongest = heights
    .filter((d) => /^min-/.test(d.prop) || d.prop === 'height')
    .map((d) => resolveLengthPx(d.value, env))
    .filter((px) => px !== null);
  if (heights.length > 0 && strongest.length === 0 && !heights.some((d) => resolveLengthPx(d.value, env) !== null)) {
    notes.push(`Alvo: a altura de ${control.name} usa uma conta (calc) que o script não resolve; conferir à mão.`);
  }
}

// Controles de CSS de componente: seletor que parece controle (botão, chip, aba, hora) com altura abaixo de 48 px.
const INTERACTIVE_HINT = /(btn|button|chip|tab|time|link|toggle|action|row|choice)\b|__(chip|time|tab|btn|action|link)/;
const NOT_A_TARGET = /icon|dot|bar|progress|dl|dt|dd|tag|badge|handle|line|number|text$|name|desc|label$|muted|meta|small/;
for (const source of cssSources.slice(1 + partialSources.length)) {
  for (const rule of source.rules) {
    const selector = rule.selectors[0] ?? '';
    // Pseudo-elementos (a linha de 3 px da aba atual, por exemplo) não são o alvo de toque.
    if (selector.includes('::') || !INTERACTIVE_HINT.test(selector) || NOT_A_TARGET.test(selector)) {
      continue;
    }
    for (const d of rule.decls.filter((x) => [...HEIGHT_PROPS, ...WIDTH_PROPS].includes(x.prop))) {
      const px = resolveLengthPx(d.value, env);
      if (px !== null && px < MIN_TARGET_PX) {
        failures.push(`Alvo: ${source.file} ${selector} declara ${d.prop}: ${d.value} = ${px} px, mínimo ${MIN_TARGET_PX} px.`);
      }
    }
  }
}

// ============================================================================
// Resultado
// ============================================================================
notes.forEach((n) => console.log(`  nota: ${n}`));
if (failures.length > 0) {
  console.error(`check:a11y: ${failures.length} item(ns) abaixo do mínimo\n`);
  failures.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log(
  `check:a11y: ok (${checked} conferências: contraste de ${PAIRS.length} pares em ${themes.length} tema(s), ${ruleChecked} pares color/background do CSS e alvos de ${MIN_TARGET_PX} px)`,
);
