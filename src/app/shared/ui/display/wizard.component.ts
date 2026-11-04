import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { formatTime } from '@core/format';
import { SwitchComponent } from '../forms/switch.component';
import { DraftRecord, DraftService } from '../forms/draft.service';
import { MOBILE_QUERY, mediaQuery } from '../util/media';
import { uniqueId } from '../util/ids';
import { IconComponent } from './icon.component';
import { ProgressComponent } from './meter.component';

export interface WizardOption {
  value: number | string;
  label: string;
  /** Tecla de atalho. Sem ela: o próprio valor, quando é de 0 a 4. */
  key?: string;
}

export interface WizardItem {
  id: string;
  /** A pergunta (serifa grande). */
  question: string;
  hint?: string;
  /** Até 5 opções (a grade foi desenhada para a escala de 0 a 4). */
  options: readonly WizardOption[];
}

export type WizardAnswers = Record<string, number | string>;

interface WizardDraft {
  answers: WizardAnswers;
  index: number;
}

/**
 * Assistente de um item por tela (aplicação da escala de Zarit, PD-04 e PD-09). Cabeçalho com "Item 7 de 22",
 * barra de progresso e "Rascunho salvo às 14:32"; a pergunta em serifa e as opções em botões grandes (rádio
 * nativo, 56 px no celular); mapa dos itens com o que ficou sem resposta (recolhido no celular); rodapé fixo
 * com Voltar, Salvar e sair e Próximo. No último item vira "Concluir", desabilitado com a lista do que falta.
 *
 * - Teclas `0` a `4` respondem (desligável com `hotkeys`), `←` e `→` mudam de item. Não disparam dentro de campo.
 * - "Avançar automaticamente ao responder" é opcional (interruptor, WCAG 3.2.2).
 * - Com `draftForm`, o rascunho é salvo a cada resposta e oferecido ao voltar (UX 5.12). Sem consentimento de
 *   saúde NÃO passe `draftForm` na Zarit (RN-ZRT-07).
 *
 * ```html
 * <app-wizard [items]="items" [(answers)]="answers" draftForm="zarit" [draftId]="caregiverId"
 *            (completed)="finish($event)" (exited)="leave()" />
 * ```
 */
@Component({
  selector: 'app-wizard',
  imports: [IconComponent, ProgressComponent, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wizard', '(document:keydown)': 'onKey($event)' },
  template: `
    @if (pendingDraft(); as draft) {
      <div class="banner banner--consent" data-static role="group" aria-label="Rascunho encontrado">
        <svg appIcon="save"></svg>
        <div class="banner__body">
          <span class="banner__title">Retomar rascunho?</span>
          <span class="banner__text">Há um rascunho de {{ draftWhen() }}. Quer continuar de onde parou ou começar de novo?</span>
          <div class="banner__actions">
            <button type="button" class="btn" (click)="resumeDraft(draft)">Retomar rascunho</button>
            <button type="button" class="btn" (click)="discardDraft()">Começar de novo</button>
          </div>
        </div>
      </div>
    }
    <div class="wizard__head">
      <div class="wizard__count">
        <span aria-live="polite">{{ itemLabel() }} <strong>{{ index() + 1 }}</strong> de {{ items().length }}</span>
        @if (savedAt()) {
          <span class="wizard__status" aria-live="polite"><svg appIcon="circle-check" size="sm"></svg>Rascunho salvo às {{ savedAt() }}</span>
        }
      </div>
      <app-progress large [label]="answeredCount() + ' de ' + items().length + ' itens respondidos'" [value]="answeredCount()" [max]="items().length" />
    </div>

    @if (current(); as item) {
      <fieldset class="wizard__body">
        <legend class="sr-only">{{ itemLabel() }} {{ index() + 1 }}</legend>
        <div>
          <p class="wizard__question">{{ item.question }}</p>
          @if (item.hint) {
            <p class="wizard__hint">{{ item.hint }}</p>
          }
        </div>
        <div class="likert">
          @for (option of item.options; track option.value) {
            <label class="likert__option">
              <input
                type="radio"
                [name]="groupName"
                [checked]="answers()[item.id] === option.value"
                [attr.aria-label]="option.value + ', ' + option.label.toLowerCase()"
                (change)="answer(item, option)"
              />
              <span class="likert__num">{{ option.value }}</span>
              <span class="likert__label">{{ option.label }}</span>
            </label>
          }
        </div>
        @if (autoAdvanceToggle()) {
          <app-switch [(checked)]="autoAdvance">Avançar automaticamente ao responder</app-switch>
        }
      </fieldset>
    }

    <details class="chart-alt" [open]="!mobile()">
      <summary>Mapa dos itens ({{ missingCount() === 0 ? 'todos respondidos' : missingCount() + ' sem resposta' }})</summary>
      <p class="t-caption mt-2 mb-2">Respondido, atual e sem resposta (tracejado).</p>
      <div class="item-map">
        @for (item of items(); track item.id; let i = $index) {
          <button
            type="button"
            class="item-map__btn"
            [class.is-done]="isAnswered(item) && i !== index()"
            [class.is-missing]="!isAnswered(item) && i < furthest() && i !== index()"
            [attr.aria-current]="i === index() ? 'step' : null"
            [attr.aria-label]="'Item ' + (i + 1) + (isAnswered(item) ? ', respondido' : ', sem resposta')"
            (click)="goTo(i)"
          >{{ i + 1 }}</button>
        }
      </div>
    </details>

    <div class="wizard__foot">
      <button type="button" class="btn btn--ghost" [disabled]="index() === 0" (click)="goTo(index() - 1)">
        <svg appIcon="arrow-left" size="sm"></svg>Voltar
      </button>
      <span class="wizard__status">
        @if (isLast() && missing().length > 0) {
          {{ missingText() }}
        } @else {
          Resultado e faixa só aparecem ao concluir.
        }
      </span>
      <button type="button" class="btn" (click)="saveAndExit()">Salvar e sair</button>
      @if (isLast()) {
        <button type="button" class="btn btn--primary" [attr.aria-disabled]="missing().length > 0 ? 'true' : null" (click)="finish()">
          {{ finishLabel() }}
        </button>
      } @else {
        <button type="button" class="btn btn--primary" (click)="goTo(index() + 1)">
          Próximo<svg appIcon="arrow-right" size="sm"></svg>
        </button>
      }
    </div>
  `,
})
export class WizardComponent implements OnInit {
  private readonly drafts = inject(DraftService);

  readonly items = input.required<readonly WizardItem[]>();
  /** Respostas por id do item (`{ q1: 3 }`). Use `[(answers)]`. */
  readonly answers = model<WizardAnswers>({});
  /** Índice do item atual (começa em 0). */
  readonly index = model(0);
  /** Nome do formulário para o rascunho (`zarit`). Sem ele, não salva rascunho. */
  readonly draftForm = input<string>();
  readonly draftId = input('novo');
  /** Teclas `0` a `4`, `←` e `→`. */
  readonly hotkeys = input(true, { transform: booleanAttribute });
  readonly autoAdvance = model(false);
  /** Mostra o interruptor "Avançar automaticamente ao responder". */
  readonly autoAdvanceToggle = input(true, { transform: booleanAttribute });
  readonly finishLabel = input('Concluir');
  /** "Item", "Pergunta"... */
  readonly itemLabel = input('Item');

  /** Todos os itens respondidos e a pessoa pediu para concluir. */
  readonly completed = output<WizardAnswers>();
  /** "Salvar e sair": o rascunho já foi guardado (se `draftForm`). */
  readonly exited = output<WizardAnswers>();

  protected readonly groupName = uniqueId('app-wizard');
  protected readonly mobile = mediaQuery(MOBILE_QUERY);
  protected readonly savedAt = signal<string | null>(null);
  protected readonly pendingDraft = signal<DraftRecord<WizardDraft> | null>(null);
  protected readonly draftWhen = computed(() => {
    const draft = this.pendingDraft();
    return draft ? this.drafts.describe(draft) : '';
  });
  /** Maior item já visitado: só o que ficou para trás sem resposta aparece como "sem resposta". */
  protected readonly furthest = signal(0);

  protected readonly current = computed(() => this.items()[this.index()]);
  protected readonly isLast = computed(() => this.index() === this.items().length - 1);
  protected readonly answeredCount = computed(() => this.items().filter((i) => this.isAnswered(i)).length);
  /** Índices (base 0) dos itens sem resposta. */
  protected readonly missing = computed(() =>
    this.items()
      .map((item, i) => (this.isAnswered(item) ? -1 : i))
      .filter((i) => i >= 0),
  );
  protected readonly missingCount = computed(() => this.missing().length);
  protected readonly missingText = computed(() => {
    const numbers = this.missing().map((i) => i + 1);
    const last = numbers[numbers.length - 1];
    const text = numbers.length === 1 ? String(last) : `${numbers.slice(0, -1).join(', ')} e ${last}`;
    return `${numbers.length === 1 ? 'Falta o item' : 'Faltam os itens'} ${text}.`;
  });

  ngOnInit(): void {
    const form = this.draftForm();
    this.furthest.set(this.index());
    if (form) {
      const draft = this.drafts.load<WizardDraft>(form, this.draftId());
      if (draft) {
        this.pendingDraft.set(draft);
      }
    }
  }

  protected isAnswered(item: WizardItem): boolean {
    const value = this.answers()[item.id];
    return value !== undefined && value !== null;
  }

  protected answer(item: WizardItem, option: WizardOption): void {
    this.answers.update((current) => ({ ...current, [item.id]: option.value }));
    this.saveDraft();
    if (this.autoAdvance() && !this.isLast()) {
      this.goTo(this.index() + 1);
    }
  }

  protected goTo(target: number): void {
    const clamped = Math.min(Math.max(target, 0), this.items().length - 1);
    this.index.set(clamped);
    this.furthest.update((value) => Math.max(value, clamped));
    this.saveDraft();
  }

  protected saveAndExit(): void {
    this.saveDraft();
    this.exited.emit(this.answers());
  }

  protected finish(): void {
    if (this.missing().length > 0) {
      // O botão fica `aria-disabled` com o motivo ao lado: vai ao primeiro item que falta.
      this.goTo(this.missing()[0] as number);
      return;
    }
    const form = this.draftForm();
    if (form) {
      this.drafts.clear(form, this.draftId());
    }
    this.completed.emit(this.answers());
  }

  protected resumeDraft(draft: DraftRecord<WizardDraft>): void {
    this.answers.set(draft.data.answers);
    this.index.set(Math.min(Math.max(draft.data.index, 0), this.items().length - 1));
    this.furthest.set(this.index());
    this.savedAt.set(formatTime(draft.savedAt));
    this.pendingDraft.set(null);
  }

  protected discardDraft(): void {
    const form = this.draftForm();
    if (form) {
      this.drafts.clear(form, this.draftId());
    }
    this.pendingDraft.set(null);
  }

  private saveDraft(): void {
    const form = this.draftForm();
    if (!form || this.pendingDraft()) {
      return;
    }
    const record = this.drafts.save<WizardDraft>(form, this.draftId(), {
      answers: this.answers(),
      index: this.index(),
    });
    this.savedAt.set(formatTime(record.savedAt));
  }

  protected onKey(event: KeyboardEvent): void {
    if (!this.hotkeys() || event.ctrlKey || event.metaKey || event.altKey || this.pendingDraft()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && (target.closest('textarea, select, [contenteditable="true"]') || (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'radio' && (target as HTMLInputElement).type !== 'checkbox'))) {
      return;
    }
    const item = this.current();
    if (!item) {
      return;
    }
    const onRadio = target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'radio';
    if (event.key === 'ArrowRight' && !onRadio) {
      this.goTo(this.index() + 1);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' && !onRadio) {
      this.goTo(this.index() - 1);
      event.preventDefault();
    } else if (/^\d$/.test(event.key)) {
      const option = item.options.find((o, i) => (o.key ?? (typeof o.value === 'number' && o.value >= 0 && o.value <= 4 ? String(o.value) : String(i))) === event.key);
      if (option) {
        this.answer(item, option);
        event.preventDefault();
      }
    }
  }
}
