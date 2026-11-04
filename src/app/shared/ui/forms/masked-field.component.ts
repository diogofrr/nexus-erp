import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AuditLogService, JustificationRequiredError } from '@core/audit';
import { AuthService, isAggregateOnly } from '@core/auth';
import type { Resource } from '@core/models';
import { MaskKind, maskValue, pseudonymFromId } from '@core/privacy';
import { IconComponent } from '../display/icon.component';
import { uniqueId } from '../util/ids';

/** Motivos prontos (UX 6.5): evitam justificativas inúteis como "a" ou "ok". */
export const REVEAL_REASONS: readonly string[] = [
  'Confirmar o cadastro do titular',
  'Atender um pedido do titular',
  'Registrar ou retornar um contato',
  'Conferir o dado com o titular',
];
export const OTHER_REASON = 'Outro (descreva)';
/** Mínimo de caracteres do motivo em "Outro". */
export const OTHER_REASON_MIN_LENGTH = 10;

export interface RevealEvent {
  field: string;
  reason: string;
}

/**
 * Campo mascarado (PD-13, LP-07): CPF, telefone, e-mail ou nome aparecem mascarados. Quem pode revelar
 * (atendimento, psicólogo do caso, RT) vê o botão "Mostrar" (ícone E texto), escolhe um motivo pronto, e o
 * valor fica visível por 30 segundos e volta a ser mascarado sozinho. Cada revelação grava `reveal` no log
 * (`AuditLogService`). NÃO há botão de copiar. A gestão (`partner`) só recebe o código `CUI-0000`: o valor
 * real nem entra no DOM. Na impressão sai sempre mascarado.
 *
 * ```html
 * <app-masked-field kind="cpf" label="CPF" [value]="cg.cpf" entity="caregiver" [entityId]="cg.id"
 *                  field="cpf" [subjectId]="cg.id" />
 * ```
 */
@Component({
  selector: 'app-masked-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.masked-field]': 'true',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closePopover()',
  },
  template: `
    @switch (mode()) {
      @case ('pseudonym') {
        <span class="code-chip">
          <svg appIcon="shield-check" size="sm"></svg>
          {{ shownCode() }}
          <span class="sr-only"> (código pseudonimizado)</span>
        </span>
      }
      @default {
        @if (!hasValue()) {
          <span class="t-muted">Não informado</span>
        } @else if (state() === 'revealed') {
          <span class="masked" data-state="revealed">
            <span class="masked__value masked__real">{{ value() }}</span>
            <span class="masked__value masked__print" aria-hidden="true">{{ masked() }}</span>
            <button type="button" class="masked__toggle" [attr.aria-label]="'Ocultar ' + label()" (click)="hide()">
              <svg appIcon="eye-off"></svg><span>Ocultar</span>
            </button>
          </span>
          <span class="masked__note t-caption" aria-hidden="true">
            registrado no log, volta a ocultar em {{ remaining() }} s
          </span>
        } @else {
          <span class="masked" data-state="hidden">
            <span class="masked__value"><span class="sr-only">{{ label() }} oculto. </span><span aria-hidden="true">{{ masked() }}</span></span>
            @if (mode() === 'revealable') {
              <button
                #toggle
                type="button"
                class="masked__toggle"
                aria-haspopup="dialog"
                [attr.aria-expanded]="popoverOpen()"
                [attr.aria-label]="'Mostrar ' + label() + ' (pede motivo)'"
                (click)="openPopover()"
              >
                <svg appIcon="eye"></svg><span>Mostrar</span>
              </button>
            }
          </span>
        }
        <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
        @if (popoverOpen()) {
          <div
            #popover
            class="popover reason-popover"
            role="dialog"
            [attr.aria-labelledby]="titleId"
            [style.top.px]="position().top"
            [style.left.px]="position().left"
            (keydown.escape)="closePopover(true)"
          >
            <div class="popover__header"><h3 [id]="titleId">Por que mostrar {{ label() }}?</h3></div>
            <div class="popover__body">
              <p class="t-caption">O acesso fica registrado no log, com o motivo que você informar.</p>
              <div role="radiogroup" aria-label="Motivo">
                @for (item of reasons; track item) {
                  <label class="radio">
                    <input type="radio" [name]="groupName" [checked]="reason() === item" (change)="reason.set(item)" />
                    <span>{{ item }}</span>
                  </label>
                }
              </div>
              @if (reason() === otherReason) {
                <div class="field">
                  <label class="field__label" [attr.for]="otherId">Descreva o motivo</label>
                  <span class="field__hint">Use ao menos {{ minOther }} caracteres.</span>
                  <textarea
                    class="textarea"
                    [id]="otherId"
                    rows="2"
                    [value]="otherText()"
                    (input)="onOtherInput($event)"
                  ></textarea>
                </div>
              }
              @if (errorText()) {
                <span class="field__error" role="alert">
                  <svg appIcon="circle-alert" size="sm"></svg>
                  <span><span class="sr-only">Erro: </span>{{ errorText() }}</span>
                </span>
              }
            </div>
            <div class="popover__footer">
              <button type="button" class="btn btn--sm" (click)="closePopover(true)">Cancelar</button>
              <button type="button" class="btn btn--sm btn--primary" (click)="confirm()">
                Mostrar por {{ seconds() }} segundos
              </button>
            </div>
          </div>
        }
      }
    }
  `,
})
export class MaskedFieldComponent {
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly kind = input.required<MaskKind>();
  readonly value = input<string | null | undefined>();
  /** Nome do dado para leitor de tela e títulos: "CPF", "Telefone". */
  readonly label = input.required<string>();
  /** Entidade e id gravados no log (`caregiver`, `cg_0042`). */
  readonly entity = input.required<string>();
  readonly entityId = input.required<string>();
  /** Nome do campo gravado no log (`cpf`). */
  readonly field = input.required<string>();
  /** Titular afetado (id do cuidador), gravado no log. */
  readonly subjectId = input<string>();
  /** Código pseudonimizado para a gestão. Sem ele, deriva de `entityId` (`cg_0042` vira `CUI-0042`). */
  readonly code = input<string>();
  /** Recurso da matriz de permissões usado para decidir quem pode revelar. */
  readonly resource = input<Resource>('caregiver_registry');
  /** Psicólogo só revela dos casos dele: informe `false` para registro de outro psicólogo. */
  readonly own = input<boolean>(true);
  /** Segundos de exibição (30). */
  readonly seconds = input(30);

  /** Revelou: o motivo já foi gravado no log. */
  readonly revealed = output<RevealEvent>();
  /** Voltou a ficar mascarado (por tempo, por "Ocultar" ou ao sair da tela). */
  readonly remasked = output<void>();

  protected readonly reasons = [...REVEAL_REASONS, OTHER_REASON];
  protected readonly otherReason = OTHER_REASON;
  protected readonly minOther = OTHER_REASON_MIN_LENGTH;
  protected readonly titleId = uniqueId('app-reveal-title');
  protected readonly otherId = uniqueId('app-reveal-other');
  protected readonly groupName = uniqueId('app-reveal-reason');

  protected readonly state = signal<'hidden' | 'revealed'>('hidden');
  protected readonly remaining = signal(0);
  protected readonly popoverOpen = signal(false);
  protected readonly reason = signal<string | null>(null);
  protected readonly otherText = signal('');
  protected readonly errorText = signal<string | null>(null);
  protected readonly announcement = signal('');
  protected readonly position = signal({ top: 0, left: 0 });

  private readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');
  private readonly popover = viewChild<ElementRef<HTMLElement>>('popover');
  private timer: ReturnType<typeof setInterval> | null = null;

  /** `pseudonym` (gestão), `revealable` (pode pedir para mostrar) ou `masked` (só mascarado, sem botão). */
  protected readonly mode = computed<'pseudonym' | 'revealable' | 'masked'>(() => {
    const role = this.auth.role();
    if (role === null) {
      return 'masked';
    }
    const resource = this.resource();
    if (isAggregateOnly(role, resource)) {
      return 'pseudonym';
    }
    const context = { own: this.own() };
    return this.auth.can(resource, 'reveal', context) || this.auth.can(resource, 'supervise', context)
      ? 'revealable'
      : 'masked';
  });

  protected readonly hasValue = computed(() => (this.value() ?? '') !== '');
  protected readonly masked = computed(() => maskValue(this.kind(), this.value()));
  protected readonly shownCode = computed(() => this.code() ?? pseudonymFromId(this.entityId()));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  protected openPopover(): void {
    this.reason.set(null);
    this.otherText.set('');
    this.errorText.set(null);
    const button = this.toggle()?.nativeElement;
    const rect = button?.getBoundingClientRect();
    const width = Math.min(360, (this.doc.defaultView?.innerWidth ?? 360) - 32);
    const viewport = this.doc.defaultView?.innerWidth ?? 1024;
    this.position.set({
      top: (rect?.bottom ?? 0) + 8,
      left: Math.max(16, Math.min(rect?.left ?? 16, viewport - width - 16)),
    });
    this.popoverOpen.set(true);
    afterNextRender(
      () => this.popover()?.nativeElement.querySelector<HTMLInputElement>('input[type="radio"]')?.focus(),
      { injector: this.injector },
    );
  }

  protected closePopover(restoreFocus = false): void {
    if (!this.popoverOpen()) {
      return;
    }
    this.popoverOpen.set(false);
    if (restoreFocus) {
      afterNextRender(() => this.toggle()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  protected onDocumentClick(event: Event): void {
    if (this.popoverOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.closePopover();
    }
  }

  protected onOtherInput(event: Event): void {
    this.otherText.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirm(): void {
    const chosen = this.reason();
    if (chosen === null) {
      this.errorText.set('Escolha o motivo para mostrar o dado.');
      return;
    }
    let justification = chosen;
    if (chosen === OTHER_REASON) {
      justification = this.otherText().trim();
      if (justification.length < OTHER_REASON_MIN_LENGTH) {
        this.errorText.set(`Descreva o motivo com ao menos ${OTHER_REASON_MIN_LENGTH} caracteres.`);
        return;
      }
    }
    try {
      this.audit.reveal(this.entity(), this.entityId(), this.field(), this.subjectId(), justification);
    } catch (error) {
      if (error instanceof JustificationRequiredError) {
        this.errorText.set('Escolha o motivo para mostrar o dado.');
        return;
      }
      throw error;
    }
    this.closePopover();
    this.state.set('revealed');
    this.remaining.set(this.seconds());
    this.announcement.set(`${this.label()}: ${this.value() ?? ''}. Dados visíveis por ${this.seconds()} segundos. O acesso foi registrado.`);
    this.startTimer();
    this.revealed.emit({ field: this.field(), reason: justification });
  }

  protected hide(): void {
    if (this.state() !== 'revealed') {
      return;
    }
    this.stopTimer();
    const hadFocus = this.host.nativeElement.contains(this.doc.activeElement);
    this.state.set('hidden');
    this.announcement.set(`${this.label()} oculto.`);
    this.remasked.emit();
    if (hadFocus) {
      afterNextRender(() => this.toggle()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      const left = this.remaining() - 1;
      this.remaining.set(left);
      if (left <= 0) {
        this.hide();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
