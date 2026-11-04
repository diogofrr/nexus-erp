import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { IconComponent } from './icon.component';

/** Iniciais de um nome: `Ana Paula Ferraz` vira `AF`. */
export function initialsOf(name: string): string {
  const parts = name
    .replace(/^(Dra?\.|Enf\.|Cuidadora?)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter((p) => p !== '');
  if (parts.length === 0) {
    return '';
  }
  const first = parts[0] as string;
  const last = parts.length > 1 ? (parts[parts.length - 1] as string) : '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/**
 * Avatar de iniciais (sem foto: dado pessoal mínimo). Decorativo: o nome costuma vir ao lado.
 * `pseudonymized` mostra um ícone neutro, sem iniciais (visão da gestão, LP-08).
 *
 * ```html
 * <app-avatar name="Ana Paula Ferraz" size="lg" />
 * ```
 */
@Component({
  selector: 'app-avatar',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()', 'aria-hidden': 'true' },
  template: `
    @if (pseudonymized()) {
      <svg appIcon="user-round"></svg>
    } @else {
      {{ initials() }}
    }
  `,
})
export class AvatarComponent {
  readonly name = input('');
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  /** Profissional credenciado (fundo dourado suave). */
  readonly gold = input(false, { transform: booleanAttribute });
  /** Sobre o menu escuro. */
  readonly nav = input(false, { transform: booleanAttribute });
  readonly pseudonymized = input(false, { transform: booleanAttribute });

  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly classes = computed(() => {
    const parts = ['avatar'];
    if (this.size() !== 'md') {
      parts.push(`avatar--${this.size()}`);
    }
    if (this.gold()) {
      parts.push('avatar--gold');
    }
    if (this.nav()) {
      parts.push('avatar--nav');
    }
    return parts.join(' ');
  });
}
