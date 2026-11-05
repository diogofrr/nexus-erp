#!/usr/bin/env node
/**
 * Verificações de qualidade do código do Nexus ERP (docs/08-arquitetura.md).
 * Falha (código 1) se encontrar:
 *  - `any` explícito;
 *  - `console.*` esquecido;
 *  - `Date.now()` ou `new Date()` sem argumentos fora de `core/clock/clock.service.ts` (AC: regras de prazo usam o Clock);
 *  - `localStorage` ou `sessionStorage` fora de `core/storage/storage-tokens.ts` (AC-GL-03);
 *  - travessão (— ou –) em qualquer arquivo de código ou documentação do projeto (AC-GL-08);
 *  - no aplicativo do cuidador (`features/caregiver-app` e a entrada), texto de interface com ponto de exclamação, emoji
 *    ou as palavras proibidas (docs/10-cuidador-ux.md, AC-CG-12): guerreira, anjo, heroína, paciente, idoso, eficácia,
 *    alerta e "diagnóstico" (esta só na frase "não é um diagnóstico").
 *
 * Uso: `node scripts/check-core.mjs`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const srcApp = join(root, 'src', 'app');

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

const rel = (file) => relative(root, file).split(sep).join('/');
const isSpec = (file) => file.endsWith('.spec.ts') || rel(file).startsWith('src/app/core/testing/');
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

const codeFiles = walk(srcApp).filter((f) => /\.(ts|html)$/.test(f));
const textFiles = [
  ...codeFiles,
  ...['docs/08-arquitetura.md', 'docs/11-cuidador-arquitetura.md', 'src/app/core/README.md']
    .map((f) => join(root, f))
    .filter((f) => {
      try {
        return statSync(f).isFile();
      } catch {
        return false;
      }
    }),
];

const problems = [];
const report = (file, index, rule, text) =>
  problems.push(`${rel(file)}:${index + 1}  [${rule}]  ${text.trim().slice(0, 120)}`);

for (const file of codeFiles.filter((f) => !isSpec(f))) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (isComment(line)) {
      return;
    }
    if (/(:\s*any\b|<any>|\bas any\b|\bany\[\]|Array<any>)/.test(line)) {
      report(file, i, 'any', line);
    }
    if (/\bconsole\.(log|warn|error|info|debug)\b/.test(line)) {
      report(file, i, 'console', line);
    }
    if (
      rel(file) !== 'src/app/core/clock/clock.service.ts' &&
      /(Date\.now\(\)|new Date\(\s*\))/.test(line)
    ) {
      report(file, i, 'relogio', line);
    }
    if (
      rel(file) !== 'src/app/core/storage/storage-tokens.ts' &&
      /\b(localStorage|sessionStorage)\b/.test(line)
    ) {
      report(file, i, 'armazenamento', line);
    }
  });
}

for (const file of textFiles) {
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (/[–—]/.test(line)) {
        report(file, i, 'travessao', line);
      }
    });
}

// Aplicativo do cuidador (AC-CG-12): texto de interface calmo e sem as palavras proibidas.
const caregiverRoot = join(srcApp, 'features', 'caregiver-app');
const caregiverFiles = codeFiles.filter(
  (f) =>
    !isSpec(f) &&
    (f.startsWith(caregiverRoot) || rel(f) === 'src/app/features/auth/pages/login.page.ts'),
);
const FORBIDDEN_WORDS = /\b(guerreira|anjo|heroína|pacientes?|idosos?|eficácia|alertas?)\b/i;
const EXCLAMATION_IN_TEXT = /[A-Za-zÀ-ÿ0-9]!(?=\s|['"`<]|$)/;
const EMOJI = /\p{Extended_Pictographic}/u;
for (const file of caregiverFiles) {
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((rawLine, i) => {
      if (isComment(rawLine)) {
        return;
      }
      // Comentário no fim da linha não é texto de interface.
      const line = rawLine.replace(/\s\/\/\s.*$/, '');
      if (EXCLAMATION_IN_TEXT.test(line)) {
        report(file, i, 'cuidador: exclamação', rawLine);
      }
      if (EMOJI.test(line)) {
        report(file, i, 'cuidador: emoji', rawLine);
      }
      const word = FORBIDDEN_WORDS.exec(line);
      if (word) {
        report(file, i, `cuidador: palavra proibida "${word[0]}"`, rawLine);
      }
      if (/diagn[óo]stic/i.test(line) && !/não é um diagnóstico/i.test(line)) {
        report(file, i, 'cuidador: "diagnóstico" só em "não é um diagnóstico"', rawLine);
      }
    });
}

if (problems.length > 0) {
  console.error(`check-core: ${problems.length} problema(s)\n`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log(
  `check-core: ok (${codeFiles.length} arquivos de código, ${textFiles.length} verificados para travessão, ${caregiverFiles.length} do aplicativo do cuidador)`,
);
