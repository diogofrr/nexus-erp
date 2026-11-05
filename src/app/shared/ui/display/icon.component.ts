import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Nomes dos ícones do sprite local (`public/icons/sprite.svg`, lucide). Para acrescentar um, inclua o nome em
 * `tools/build-icons.mjs`, rode `node tools/build-icons.mjs` e acrescente-o aqui.
 */
export const ICON_NAMES = [
  'layout-dashboard', 'users', 'user', 'user-round', 'users-round', 'heart-handshake',
  'hand-heart', 'calendar', 'calendar-days', 'clipboard-check', 'clipboard-list', 'activity',
  'heart-pulse', 'credit-card', 'wallet', 'banknote', 'trending-up', 'trending-down',
  'chart-column', 'messages-square', 'message-circle', 'mail', 'phone', 'inbox', 'flag', 'scale',
  'book-open', 'file-text', 'folder', 'file-check', 'stethoscope', 'building-2', 'store',
  'landmark', 'handshake', 'settings', 'database', 'layers', 'square-kanban', 'search', 'bell',
  'menu', 'x', 'plus', 'minus', 'check', 'pencil', 'trash-2', 'download', 'upload', 'funnel',
  'ellipsis', 'log-out', 'refresh-cw', 'external-link', 'copy', 'printer', 'save', 'send',
  'paperclip', 'link', 'undo-2', 'history', 'moon', 'sun', 'arrow-up', 'arrow-down', 'arrow-left',
  'arrow-right', 'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right', 'chevrons-up-down',
  'panel-left', 'list-checks', 'table', 'layout-list', 'circle-check', 'circle-alert',
  'triangle-alert', 'octagon-alert', 'info', 'circle-help', 'circle-dot', 'circle-dashed', 'ban',
  'pause', 'shield', 'shield-check', 'shield-alert', 'lock', 'key-round', 'fingerprint', 'eye',
  'eye-off', 'file-lock', 'id-card', 'user-check', 'user-x', 'star', 'award', 'badge-check',
  'clock', 'timer', 'hourglass', 'map-pin', 'gauge', 'thermometer', 'siren',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

const KNOWN_ICONS: ReadonlySet<string> = new Set(ICON_NAMES);

/**
 * Nome de ícone vindo de dados do núcleo (telas, ações, notificações), que não conhece a interface e guarda o
 * nome como texto. Devolve o próprio nome se ele existe no sprite; senão, o ícone neutro `fallback`.
 */
export function toIconName(name: string, fallback: IconName = 'circle-dot'): IconName {
  return KNOWN_ICONS.has(name) ? (name as IconName) : fallback;
}

/**
 * Ícone do sprite. É um atributo em `<svg>`, para que os seletores do design system (`.banner > .icon`,
 * `.input-wrap > .icon`) continuem valendo: `<svg appIcon="calendar" size="sm"></svg>`.
 * Decorativo por padrão (`aria-hidden`). Com `label` vira imagem com nome acessível.
 */
@Component({
  selector: 'svg[appIcon]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'icon',
    '[class.icon--sm]': "size() === 'sm'",
    '[class.icon--lg]': "size() === 'lg'",
    '[class.icon--xl]': "size() === 'xl'",
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    focusable: 'false',
  },
  template: '<svg:use [attr.href]="href()" />',
})
export class IconComponent {
  /** Nome do ícone (sem o prefixo `i-`). */
  readonly name = input.required<IconName>({ alias: 'appIcon' });
  readonly size = input<IconSize>('md');
  /** Nome acessível. Sem ele o ícone é decorativo. */
  readonly label = input<string>();

  protected readonly href = computed(() => `icons/sprite.svg#i-${this.name()}`);
}
