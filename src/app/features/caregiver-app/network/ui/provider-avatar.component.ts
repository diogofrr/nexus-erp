import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ProviderAvatarSize = 'md' | 'lg' | 'xl';

/** As quatro tintas calmas do avatar (cada par passa 4,5:1; conferido em `scripts/check-caregiver-a11y.mjs`). */
const TINTS = ['blue', 'green', 'gold', 'slate'] as const;

/** Palavras que não entram nas iniciais: títulos e ligações ("Dra. Renata Sampaio" é RS; "Fisio em Casa Uberlândia" é FU). */
const SKIP = /^(dr|dra|prof|profa|enf|dr\(a\)|em|de|da|do|das|dos|e|a|o|cuidador|cuidadora|nutri|fisio)\.?$/i;

/** As iniciais do profissional: a primeira letra da primeira e da última palavra que contam. */
export function providerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const real = words.filter((w) => !SKIP.test(w));
  const picked = real.length > 0 ? real : words;
  const first = picked[0]?.charAt(0) ?? '';
  const last = picked.length > 1 ? (picked[picked.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase('pt-BR');
}

/** A tinta do avatar, sempre a mesma para o mesmo nome (a pessoa reconhece o profissional pela cor). */
export function providerTint(name: string): (typeof TINTS)[number] {
  let sum = 0;
  for (const ch of name) {
    sum += ch.charCodeAt(0);
  }
  return TINTS[sum % TINTS.length] ?? 'blue';
}

/**
 * Avatar do profissional: as iniciais num círculo de uma tinta calma (azul, verde, dourado ou cinza-azulado, sempre a mesma
 * para o mesmo nome). Só desenho: o nome vem escrito ao lado (`aria-hidden`). Nunca é foto: o protótipo não guarda imagem de
 * ninguém.
 *
 * ```html
 * <app-cg-provider-avatar name="Dra. Renata Sampaio" size="lg" />
 * ```
 */
@Component({
  selector: 'app-cg-provider-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'is-' + size() + ' is-' + tint()", 'aria-hidden': 'true' },
  styles: [
    `
      :host { display: inline-grid; place-items: center; flex: none; inline-size: var(--s, 2.75rem); block-size: var(--s, 2.75rem); border-radius: 50%; font-weight: var(--fw-semibold); font-size: var(--fs, 1rem); letter-spacing: 0.02em; line-height: 1; }
      :host(.is-md) { --s: 2.75rem; --fs: 1rem; }
      :host(.is-lg) { --s: 3.5rem; --fs: 1.25rem; }
      :host(.is-xl) { --s: 5rem; --fs: 1.875rem; font-family: var(--font-serif); font-weight: 400; box-shadow: 0 0 0 4px var(--cg-surface), var(--cg-shadow-1); }
      :host(.is-blue) { background: var(--nx-blue-100); color: var(--nx-blue-800); }
      :host(.is-green) { background: var(--cg-ok-border); color: var(--cg-ok-fg); }
      :host(.is-gold) { background: var(--nx-gold-100); color: var(--nx-gold-800); }
      :host(.is-slate) { background: var(--nx-slate-100); color: var(--nx-slate-700); }
    `,
  ],
  template: `{{ initials() }}`,
})
export class ProviderAvatarComponent {
  readonly name = input.required<string>();
  readonly size = input<ProviderAvatarSize>('md');

  protected readonly initials = computed(() => providerInitials(this.name()));
  protected readonly tint = computed(() => providerTint(this.name()));
}
