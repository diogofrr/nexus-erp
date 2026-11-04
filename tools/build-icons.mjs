// Gera public/icons/sprite.svg a partir de lucide-static (ISC), só com os ícones
// usados no produto. Uso no HTML: <svg class="icon"><use href="icons/sprite.svg#i-calendar"/></svg>
// Traço, cor e tamanho vêm da classe .icon (src/styles/components/_actions.scss).
// Uso: node tools/build-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hands, figures } from './brand.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const ICONS = [
  // navegação e módulos
  'layout-dashboard', 'users', 'user', 'user-round', 'users-round', 'heart-handshake', 'hand-heart', 'calendar', 'calendar-days',
  'clipboard-check', 'clipboard-list', 'activity', 'heart-pulse', 'credit-card', 'wallet', 'banknote', 'trending-up', 'trending-down',
  'chart-column', 'messages-square', 'message-circle', 'mail', 'phone', 'inbox', 'flag', 'scale', 'book-open', 'file-text', 'folder',
  'file-check', 'stethoscope', 'building-2', 'store', 'landmark', 'handshake', 'settings', 'database', 'layers', 'square-kanban',
  // ações
  'search', 'bell', 'menu', 'x', 'plus', 'minus', 'check', 'pencil', 'trash-2', 'download', 'upload', 'funnel', 'ellipsis', 'log-out',
  'refresh-cw', 'external-link', 'copy', 'printer', 'save', 'send', 'paperclip', 'link', 'undo-2', 'history', 'moon', 'sun',
  'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right', 'chevrons-up-down',
  'panel-left', 'list-checks', 'table', 'layout-list',
  // estados e privacidade
  'circle-check', 'circle-alert', 'triangle-alert', 'octagon-alert', 'info', 'circle-help', 'circle-dot', 'circle-dashed', 'ban', 'pause',
  'shield', 'shield-check', 'shield-alert', 'lock', 'key-round', 'fingerprint', 'eye', 'eye-off', 'file-lock', 'id-card',
  'user-check', 'user-x', 'star', 'award', 'badge-check', 'clock', 'timer', 'hourglass', 'map-pin', 'gauge', 'thermometer', 'siren',
];

export function buildSprite() {
  const symbols = ICONS.map((name) => {
    const svg = readFileSync(join(root, 'node_modules', 'lucide-static', 'icons', `${name}.svg`), 'utf8');
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim().replace(/\s*\n\s*/g, '');
    return `<symbol id="i-${name}" viewBox="0 0 24 24">${inner}</symbol>`;
  });
  // símbolos da marca (traço próprio; o tamanho vem do CSS)
  symbols.push(`<symbol id="nx-symbol" viewBox="-18 3 156 98">${hands}${figures}</symbol>`);
  symbols.push(`<symbol id="nx-hands" viewBox="-18 3 156 98">${hands}</symbol>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">${symbols.join('')}</svg>\n`;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const dir = join(root, 'public', 'icons');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'sprite.svg'), buildSprite());
  console.log(`public/icons/sprite.svg gerado com ${ICONS.length} ícones + marca`);
}
