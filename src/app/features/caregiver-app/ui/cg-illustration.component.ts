import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** As ilustrações do sistema (docs/17-vida-kit.md). Cada nome é um desenho de traço único, em azul e dourado. */
export const CG_ILLUSTRATION_NAMES = [
  'day',
  'medicine',
  'calendar',
  'chat',
  'group',
  'network',
  'card',
  'help',
  'privacy',
  'empty',
  'welcome',
  'book',
  'heart',
] as const;

export type CgIllustrationName = (typeof CG_ILLUSTRATION_NAMES)[number];
export type CgIllustrationSize = 'sm' | 'md' | 'lg' | 'xl' | 'fill';
/**
 * `brand`: linha azul e dourado da marca (fundo claro). `accent`: linha e tintas da seção corrente (`--cg-acc-*`).
 * `light`: linha branca e dourado claro, para o painel azul da Entrada.
 */
export type CgIllustrationTone = 'brand' | 'accent' | 'light';

/**
 * Ilustração decorativa em SVG inline (sem requisição externa, `aria-hidden`): traço único e arredondado, no
 * mesmo desenho do símbolo da marca (as duas mãos que sustentam as três figuras). Nunca carrega informação: o texto
 * ao lado diz tudo. Cores por variáveis CSS (`--ill-line`, `--ill-gold`, `--ill-tint`, `--ill-tint-2`), então a
 * `tone` e a seção corrente mudam o desenho sem mudar o código. Tamanho por `size`; `fill` ocupa a largura do pai.
 *
 * ```html
 * <app-cg-illustration name="day" size="lg" />
 * <app-cg-illustration name="chat" size="md" tone="accent" />
 * ```
 */
@Component({
  selector: 'app-cg-illustration',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'cg-ill cg-ill--' + size() + ' cg-ill--' + tone()",
    'aria-hidden': 'true',
    '[attr.data-illustration]': 'name()',
  },
  template: `
    <ng-template #hands>
      <svg aria-hidden="true" class="cg-ill__hands" x="12" y="34" width="96" height="60.3" viewBox="-18 3 156 98">
        <use href="icons/sprite.svg#nx-hands" />
      </svg>
    </ng-template>

    <svg aria-hidden="true" viewBox="0 0 120 96" focusable="false">
      @switch (name()) {
        @case ('day') {
          <ellipse class="t2" cx="60" cy="46" rx="26" ry="20" />
          <circle class="t2 gd" cx="60" cy="46" r="10" />
          <path class="gd" d="M45 46H40M47 38.5 42.7 36M52.5 33 50 28.7M60 31V26M67.5 33 70 28.7M73 38.5 77.3 36M75 46H80" />
          <path class="gd thin" d="M20 24v6M17 27h6M100 20v6M97 23h6" />
          <ng-container [ngTemplateOutlet]="hands" />
        }
        @case ('medicine') {
          <path class="t1" d="M69.6 48H94.4L92.5 74Q92.2 78 88 78H76Q71.8 78 71.5 74Z" />
          <path d="M68 28H96L92.5 74Q92.2 78 88 78H76Q71.8 78 71.5 74Z" />
          <path class="thin" d="M69.8 48Q75 44 81 48T94 48" />
          <circle class="thin" cx="80" cy="62" r="1.8" />
          <circle class="thin" cx="86" cy="68" r="1.4" />
          <g transform="rotate(-35 38 58)">
            <path class="t2" d="M27 49H38V67H27A9 9 0 0 1 27 49Z" />
            <path class="pp" d="M38 49H49A9 9 0 0 1 49 67H38Z" />
            <rect x="18" y="49" width="40" height="18" rx="9" />
            <path d="M38 49V67" />
            <path class="gd thin" d="M24 55H29" />
          </g>
          <circle class="t2" cx="54" cy="78" r="7" />
          <path class="thin" d="M49.5 78H58.5" />
          <path class="gd thin" d="M96 14v6M93 17h6M20 30v5M17.5 32.5h5" />
          <path d="M12 88H108" />
        }
        @case ('calendar') {
          <rect class="pp" x="22" y="18" width="76" height="64" rx="10" />
          <path class="t1" d="M22 36V28A10 10 0 0 1 32 18H88A10 10 0 0 1 98 28V36Z" />
          <rect x="22" y="18" width="76" height="64" rx="10" />
          <path class="gd" d="M42 11V23M78 11V23" />
          <path d="M22 36H98" />
          <g class="dots">
            <circle cx="38" cy="49" r="2.4" /><circle cx="54" cy="49" r="2.4" /><circle cx="70" cy="49" r="2.4" /><circle cx="86" cy="49" r="2.4" />
            <circle cx="38" cy="71" r="2.4" /><circle cx="54" cy="71" r="2.4" /><circle cx="86" cy="71" r="2.4" />
          </g>
          <circle class="t2 gd" cx="70" cy="71" r="8" />
          <path class="gd" d="M66 71l3 3 5.5-6" />
          <path class="gd thin" d="M106 30v5M103.5 32.5h5" />
        }
        @case ('chat') {
          <path class="t1" d="M28 12H62A14 14 0 0 1 76 26V36A14 14 0 0 1 62 50H42L24 63L28 50A14 14 0 0 1 14 36V26A14 14 0 0 1 28 12Z" />
          <path d="M28 12H62A14 14 0 0 1 76 26V36A14 14 0 0 1 62 50H42L24 63L28 50A14 14 0 0 1 14 36V26A14 14 0 0 1 28 12Z" />
          <path d="M28 25H62M28 35H50" />
          <path class="t2" d="M72 52H96A12 12 0 0 1 108 64V68A12 12 0 0 1 96 80H94L100 90L84 80H72A12 12 0 0 1 60 68V64A12 12 0 0 1 72 52Z" />
          <path class="gd" d="M72 52H96A12 12 0 0 1 108 64V68A12 12 0 0 1 96 80H94L100 90L84 80H72A12 12 0 0 1 60 68V64A12 12 0 0 1 72 52Z" />
          <g class="gf"><circle cx="74" cy="66" r="2.4" /><circle cx="84" cy="66" r="2.4" /><circle cx="94" cy="66" r="2.4" /></g>
        }
        @case ('group') {
          <path class="gd thin dotted" d="M16 40Q60 -8 104 40" />
          <path class="t1" d="M42 82V70A18 18 0 0 1 78 70V82Z" />
          <path class="t2" d="M12 82V74A14 14 0 0 1 40 74V82Z" />
          <path class="t2" d="M80 82V74A14 14 0 0 1 108 74V82Z" />
          <path d="M42 82V70A18 18 0 0 1 78 70V82M12 82V74A14 14 0 0 1 40 74V82M80 82V74A14 14 0 0 1 108 74V82" />
          <circle class="pp" cx="60" cy="42" r="10" />
          <circle class="pp" cx="26" cy="54" r="8" />
          <circle class="pp" cx="94" cy="54" r="8" />
          <path d="M8 82H112" />
        }
        @case ('network') {
          <path class="gd thin dotted" d="M26 34Q60 6 94 34" />
          <circle class="t1" cx="24" cy="46" r="9" />
          <path class="t1" d="M8 78V72A16 16 0 0 1 40 72V78Z" />
          <circle cx="24" cy="46" r="9" />
          <path d="M8 78V72A16 16 0 0 1 40 72V78" />
          <circle class="t2" cx="96" cy="46" r="9" />
          <path class="t2" d="M80 78V72A16 16 0 0 1 112 72V78Z" />
          <circle cx="96" cy="46" r="9" />
          <path d="M80 78V72A16 16 0 0 1 112 72V78" />
          <svg aria-hidden="true" class="cg-ill__shake" x="38" y="30" width="44" height="44" viewBox="0 0 24 24">
            <use href="icons/sprite.svg#i-handshake" />
          </svg>
          <path d="M6 84H114" />
        }
        @case ('card') {
          <g transform="rotate(-9 60 48)">
            <rect class="t1" x="28" y="14" width="68" height="44" rx="8" />
            <rect x="28" y="14" width="68" height="44" rx="8" />
          </g>
          <g transform="rotate(5 60 54)">
            <rect class="pp" x="20" y="30" width="76" height="48" rx="9" />
            <rect x="20" y="30" width="76" height="48" rx="9" />
            <rect class="t2 gd" x="30" y="40" width="13" height="10" rx="2.5" />
            <path class="gd thin" d="M30 45H43M36.5 40V50" />
            <path d="M30 62H54M30 69H46" />
            <svg aria-hidden="true" class="cg-ill__hands mini gd" x="66" y="56" width="22" height="14" viewBox="-18 3 156 98"><use href="icons/sprite.svg#nx-hands" /></svg>
          </g>
        }
        @case ('help') {
          <path class="stripe" d="M72.7 58.7 79.8 65.8M47.3 58.7 40.2 65.8M47.3 33.3 40.2 26.2M72.7 33.3 79.8 26.2" />
          <circle cx="60" cy="46" r="32" />
          <circle cx="60" cy="46" r="14" />
          <path class="thin" d="M12 86Q18 80 24 86T36 86T48 86T60 86T72 86T84 86T96 86T108 86" />
          <path class="gd thin" d="M100 12v6M97 15h6M16 22v5M13.5 24.5h5" />
        }
        @case ('privacy') {
          <path class="t1" d="M52 44V37A8 8 0 0 1 68 37V44Z" />
          <path d="M52 44V37A8 8 0 0 1 68 37V44" />
          <rect class="t2 gd" x="47" y="44" width="26" height="20" rx="5" />
          <circle class="lf" cx="60" cy="53" r="2.6" />
          <path d="M60 55V59" />
          <ng-container [ngTemplateOutlet]="hands" />
        }
        @case ('empty') {
          <circle class="gd thin dashed" cx="60" cy="42" r="12" />
          <path class="gd thin" d="M24 30v6M21 33h6M98 26v6M95 29h6" />
          <ng-container [ngTemplateOutlet]="hands" />
        }
        @case ('welcome') {
          <path class="gd thin dotted g1" d="M30 62A30 30 0 0 1 90 62" />
          <path class="gd thin dotted g2" d="M18 62A42 42 0 0 1 102 62" />
          <path class="gd thin dotted g3" d="M6 62A54 54 0 0 1 114 62" />
          <svg aria-hidden="true" class="cg-ill__hands" x="9" y="30" width="102" height="64.1" viewBox="-18 3 156 98"><use href="icons/sprite.svg#nx-symbol" /></svg>
        }
        @case ('book') {
          <path class="t1" d="M60 26Q46 16 22 18V68Q46 66 60 76Z" />
          <path class="t2" d="M60 26Q74 16 98 18V68Q74 66 60 76Z" />
          <path d="M60 26Q46 16 22 18V68Q46 66 60 76Q74 66 98 68V18Q74 16 60 26ZM60 26V76" />
          <path class="thin" d="M30 30Q44 30 52 35M30 40Q44 40 52 45M68 35Q76 30 90 30M68 45Q76 40 90 40" />
          <path class="gd" d="M82 18V38L87 34L92 38V18" />
          <path d="M14 84H106" />
        }
        @case ('heart') {
          <path class="t2 gd" d="M60 54C60 54 44 44 44 34A9.5 9.5 0 0 1 60 29A9.5 9.5 0 0 1 76 34C76 44 60 54 60 54Z" />
          <path class="gd thin" d="M26 30v6M23 33h6M96 24v6M93 27h6" />
          <ng-container [ngTemplateOutlet]="hands" />
        }
      }
    </svg>
  `,
})
export class CgIllustrationComponent {
  readonly name = input.required<CgIllustrationName>();
  readonly size = input<CgIllustrationSize>('md');
  readonly tone = input<CgIllustrationTone>('brand');
}
