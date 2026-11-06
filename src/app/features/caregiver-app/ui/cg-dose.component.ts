import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Clock } from '../../../core/clock/clock.service';
import { minutesBetween, timeOf, toIsoDateTime } from '../../../core/clock/date-utils';
import { ISODateTime } from '../../../core/models';
import { DoseSlot } from '../../../core/rules/medication-doses';
import { IconComponent } from '../../../shared/ui/display/icon.component';

/** Estado visual da dose (UX A.2.12). */
export type CgDoseState = 'later' | 'due' | 'late' | 'given';

/**
 * Tamanho da linha: `large` é a variante "por pessoa" de quem tem pouca familiaridade digital (UX C6, o João): a hora
 * em 22 px e o botão **Dei** com 96 px de largura. Quem decide é a tela, pelo `CaregiverContextService.doseSize()`.
 */
export type CgDoseSize = 'default' | 'large';

/** Até quantos minutos antes do horário o botão "Dei" já fica em destaque (UX A.2.12). */
export const DOSE_DUE_WINDOW_MIN = 30;

/**
 * Por quanto tempo (ms) um toque em "Desfazer" é ignorado depois do "Dei" (CXC-008): quem dá dois toques por hábito
 * não desfaz o que acabou de marcar.
 */
export const UNDO_GUARD_MS = 1000;

/** O estado da dose no instante `now`. Só passa do horário depois de 1 minuto cheio (o segundo da hora marcada ainda é o horário). */
export function doseStateOf(slot: DoseSlot, now: ISODateTime): CgDoseState {
  if (slot.given) {
    return 'given';
  }
  const minutesToDose = minutesBetween(now, toIsoDateTime(slot.date, slot.time));
  if (Math.ceil(minutesToDose) < 0) {
    return 'late';
  }
  return minutesToDose <= DOSE_DUE_WINDOW_MIN ? 'due' : 'later';
}

/**
 * Marcação "dei o remédio" (UX A.2.12): uma linha por dose do dia, com o botão **Dei** (uma marcação por toque,
 * "dado agora" pelo relógio do sistema). Estados: a dar (botão secundário); no horário ou até 30 minutos antes
 * (primário); horário que passou sem marca (nota "Ainda não anotado", sem a palavra "passou", só da pessoa idosa,
 * nunca da saúde emocional; âmbar suave só na primeira linha, as outras ficam neutras, `quietLate`); dado (fundo
 * verde, "Dado às 08:12" e, **longe do lugar do Dei**, o link pequeno "Desfazer"). Um toque em "Desfazer" até 1 s
 * depois do "Dei" é ignorado (CXC-008). A ordem das linhas é da tela (o que falta primeiro). O componente só
 * desenha e avisa: quem grava é a tela, com `DoseCheckService`. `size="large"` é a variante de quem tem pouca
 * familiaridade digital (hora em 22 px, **Dei** de 96 px).
 *
 * ```html
 * @for (slot of slots(); track slot.key) {
 *   <app-cg-dose [slot]="slot" [size]="ctx.doseSize()" [quietLate]="slot.key !== firstLateKey()"
 *                (dei)="doses.mark($event.medicationId, $event.date, $event.time)"
 *                (undo)="doses.unmark($event.medicationId, $event.date, $event.time)" />
 * }
 * ```
 */
@Component({
  selector: 'app-cg-dose',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cg-dose-host' },
  template: `
    <div
      class="cg-dose"
      [class.is-given]="state() === 'given'"
      [class.is-late]="state() === 'late' && !quietLate()"
      [class.cg-dose--large]="size() === 'large'"
    >
      <span class="cg-dose__icon" [class.is-popping]="popped()">
        @if (state() === 'given') {
          <!-- O check desenha o traço (pathLength 1) e o emblema "pula" só quando a pessoa acaba de marcar; ao abrir a tela ele já vem pronto. -->
          <svg class="cg-dose__check" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5.5 12.8l4.2 4.2L18.5 7.8" pathLength="1" />
          </svg>
        } @else {
          <svg appIcon="pill" size="lg"></svg>
        }
      </span>
      <span class="cg-dose__text">
        <span class="cg-dose__name">{{ slot().medicationName }}</span>
        <span class="cg-dose__dosage">{{ slot().dosage }}</span>
        @if (state() === 'given') {
          <span class="cg-dose__state cg-dose__state--ok">
            <svg appIcon="circle-check" size="sm"></svg>Dado às {{ givenTime() }}
          </span>
          <button
            type="button"
            class="cg-link-btn cg-dose__undo"
            [attr.aria-label]="'Desfazer: ' + slot().medicationName + ' das ' + slot().time + ' dado às ' + givenTime()"
            (click)="onUndo()"
          >
            Desfazer
          </button>
        } @else if (state() === 'late') {
          <span class="cg-dose__state" [class.cg-dose__state--late]="!quietLate()">
            <svg appIcon="clock" size="sm"></svg>Ainda não anotado
          </span>
        }
      </span>
      <span class="cg-dose__time">{{ slot().time }}</span>
      @if (state() !== 'given') {
        <button
          type="button"
          class="btn cg-dose__action"
          [class.btn--primary]="state() !== 'later'"
          [attr.aria-label]="'Dei o ' + slot().medicationName + ' das ' + slot().time"
          (click)="onDei()"
        >
          Dei
        </button>
      }
    </div>
  `,
})
export class CgDoseComponent {
  private readonly clock = inject(Clock);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  /** Instante (tempo real, não o simulado) do último toque em "Dei" nesta linha. */
  private lastDeiAt = Number.NEGATIVE_INFINITY;

  readonly slot = input.required<DoseSlot>();
  /** `large` para quem tem pouca familiaridade digital (UX C6, "por pessoa"). */
  readonly size = input<CgDoseSize>('default');
  /** `true`: o horário que passou aparece neutro, sem o âmbar (a tela usa o âmbar uma vez só, na primeira linha). */
  readonly quietLate = input(false);
  /** A pessoa tocou em "Dei". */
  readonly dei = output<DoseSlot>();
  /** A pessoa tocou em "Desfazer". */
  readonly undo = output<DoseSlot>();

  protected readonly givenTime = computed(() => {
    const at = this.slot().givenAt;
    return at ? timeOf(at) : '';
  });

  protected readonly state = computed<CgDoseState>(() => doseStateOf(this.slot(), this.clock.now()));
  /** A pessoa acabou de tocar em "Dei" nesta linha: o check anima (só então). */
  protected readonly popped = signal(false);

  protected onDei(): void {
    this.popped.set(true);
    this.lastDeiAt = this.clock.realNowMs();
    const hadFocus = this.hasFocus();
    this.dei.emit(this.slot());
    // O botão Dei some quando a dose é marcada: o foco de quem usa o teclado vai para o Desfazer da mesma linha, e não para o fim da página.
    if (hadFocus) {
      this.focusAfterRender('.cg-dose__undo');
    }
  }

  /** Ignora o toque que chega até 1 s depois do "Dei": o segundo toque do hábito não desfaz o que acabou de ser marcado. */
  protected onUndo(): void {
    if (this.clock.realNowMs() - this.lastDeiAt < UNDO_GUARD_MS) {
      return;
    }
    const hadFocus = this.hasFocus();
    this.popped.set(false);
    this.undo.emit(this.slot());
    // O Desfazer some quando a marca sai: o foco volta ao Dei da mesma linha.
    if (hadFocus) {
      this.focusAfterRender('.cg-dose__action');
    }
  }

  /** O foco está num controle desta linha (teclado ou leitor de tela)? Só então o foco precisa acompanhar. */
  private hasFocus(): boolean {
    const active = this.host.nativeElement.ownerDocument.activeElement;
    return active !== null && this.host.nativeElement.contains(active);
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }
}
