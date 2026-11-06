import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionModality } from '@core/models';
import { FormFieldComponent, IconComponent, IconName, NxInputDirective } from '@shared/ui';
import { PageChromeService } from '@layout/state/page-chrome.service';
import { ToastService } from '@shared/ui/overlay';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { HistoryLayersService } from '../../state/history-layers.service';
import { FORMAT_LABEL } from '../../state/format-labels';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgChoiceGroupComponent } from '../../ui/cg-choice-group.component';
import { CgEmergencyNoteComponent } from '../../ui/cg-emergency-note.component';
import { CgEmptyComponent } from '../../ui/cg-empty.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CgIllustrationComponent } from '../../ui/cg-illustration.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgRowComponent } from '../../ui/cg-row.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import {
  BOOKING_SENT,
  CANCEL_FREE,
  CANCEL_LATE,
  FORMAT_NOTICE,
  FORMAT_OPTIONS,
  KIND_OPTIONS,
  KindChoice,
  NO_SLOTS_TEXT,
  PAYMENT_NOTE,
  RESCHEDULE_FREE,
  RESCHEDULE_LATE,
} from '../state/care-labels';
import { Conversation, ConversationsService, SlotOption } from '../state/conversations.service';

type Mode = 'home' | 'format' | 'slots';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Conversar com um psicólogo (UX C8, B4; RN-ATD-02 a 05, 07, 09 a 12, 15, 16, 19, 20, RN-PLN-12 e 19). Marcar, ver, remarcar e
 * cancelar as conversas com os psicólogos da Nexus, em 2 passos mais a folha de resumo: o formato e o horário.
 *
 * - A confirmação (a folha de resumo, com o valor do plano) vem SEMPRE antes de gravar; "O que você procura?" vem sem nada
 *   marcado e não deixa gravar sem uma das 3 opções (RN-ATD-19, S-07).
 * - Os horários de prioridade de agenda aparecem como os outros, sem etiqueta e sem motivo (RN-ATD-12); quem não tem
 *   direito a eles nem os vê. No plano Livre o resumo mostra só o total, sem linha de desconto e sem convite de plano.
 * - Cancelar com 24 horas ou mais não tem custo; com menos, a folha diz ANTES que o horário fica registrado como falta
 *   (RN-ATD-16). Remarcar só libera o horário antigo depois de marcar o novo.
 * - O que a regra faz vem do núcleo (`SessionBookingService`); a tela só lê e confirma.
 */
@Component({
  selector: 'app-psychologist-page',
  imports: [
    RouterLink,
    CgHeroComponent,
    CgPageHeaderComponent,
    CgCardComponent,
    CgRowComponent,
    CgNoteComponent,
    CgSheetComponent,
    CgChoiceGroupComponent,
    CgEmergencyNoteComponent,
    CgEmptyComponent,
    CgIllustrationComponent,
    FormFieldComponent,
    NxInputDirective,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .conv__stephead { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
      .conv__step { margin: 0; font-family: var(--font-serif); font-weight: 400; font-size: var(--cg-fs-h2); outline: none; }
      .conv__progress { display: grid; gap: 0.375rem; margin: 0; }
      .conv__bar { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; }
      .conv__bar span { block-size: 0.375rem; border-radius: var(--cg-radius-pill); background: var(--cg-acc-strong); }
      .conv__bar span.is-on { background: var(--cg-acc-solid); }
      .conv__count { margin: 0; color: var(--cg-text-soft); font-size: var(--cg-fs-small); font-weight: var(--fw-semibold); }
      .conv__next { display: flex; align-items: flex-start; gap: 1rem; }
      .conv__next > div:last-child { min-inline-size: 0; display: grid; gap: 0.25rem; }
      .conv__date { display: grid; grid-template-rows: auto 1fr; flex: none; inline-size: 4rem; border-radius: 1rem; overflow: hidden; text-align: center; background: var(--cg-surface); box-shadow: inset 0 0 0 1px var(--cg-acc-strong), var(--cg-shadow-1); }
      .conv__mon { padding: 0.125rem 0; background: var(--cg-acc-solid); color: #ffffff; font-size: var(--cg-fs-caption); font-weight: var(--fw-semibold); text-transform: uppercase; letter-spacing: 0.08em; }
      .conv__dom { padding: 0.25rem 0 0.375rem; color: var(--cg-acc-ink); font-family: var(--font-serif); font-size: calc(1.875rem * min(var(--cg-zoom), 1.15)); line-height: 1.1; font-variant-numeric: tabular-nums; }
      .conv__fact { display: flex; align-items: flex-start; gap: 0.75rem; }
      .conv__fact .conv__ficon { display: grid; place-items: center; flex: none; inline-size: 2rem; block-size: 2rem; border-radius: 50%; background: var(--cg-acc-strong); color: var(--cg-acc-ink); }
      .conv__fact span:last-child { padding-top: 0.25rem; }
      .conv__dayhead { display: flex; align-items: center; gap: 0.5rem; }
      .conv__dayhead .conv__ficon { display: grid; place-items: center; flex: none; inline-size: 2rem; block-size: 2rem; border-radius: 50%; background: var(--cg-acc-strong); color: var(--cg-acc-ink); }
      .conv__when { margin: 0; font-size: var(--cg-fs-lead); font-weight: 600; color: var(--cg-heading); }
      .conv__line { margin: 0; overflow-wrap: anywhere; }
      .conv__status { margin: 0; font-weight: 600; color: var(--cg-heading); }
      .conv__days { display: grid; gap: 1.5rem; }
      .conv__day { display: grid; gap: 0.5rem; }
      .conv__day h3 { margin: 0; font-size: var(--cg-fs-lead); }
      .conv__slots { display: grid; gap: 0.75rem; grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 30rem) { .conv__slots { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .conv__slots .btn { width: 100%; }
      .conv__sheet p { margin: 0; overflow-wrap: anywhere; }
      .conv__prices { display: grid; gap: 0.25rem; padding: 0.75rem 1rem; border-radius: var(--cg-radius-control); background: var(--cg-surface-sunken); }
      .conv__total { font-weight: 600; font-size: var(--cg-fs-lead); }
      .conv__more { border: 1px solid var(--cg-border); border-radius: var(--cg-radius-card); background: var(--cg-surface); }
      .conv__more > summary { min-height: var(--cg-target); display: flex; align-items: center; padding: 0.75rem 1rem; font-weight: 600; cursor: pointer; }
      .conv__more .cg-list { border: 0; border-top: 1px solid var(--cg-border-subtle); border-radius: 0; }
    `,
  ],
  template: `
    @if (mode() === 'home') {
      <app-cg-hero
        title="Conversar com um psicólogo"
        description="As conversas são com psicólogos da Nexus, com registro no conselho de Psicologia."
        illustration="chat"
        backLink="/cuidador/cuidar-de-mim"
        backLabel="Cuidar de mim"
      />
    } @else {
      <!-- Nos passos o título fica pequeno: o desenho e o texto de apoio já foram vistos, e o "Voltar" é o do passo. -->
      <app-cg-page-header title="Conversar com um psicólogo" />
    }

    <div class="cg-stack">
      @switch (mode()) {
        @case ('home') {
          @if (confirmation(); as note) {
            <app-cg-note variant="ok" icon="circle-check">
              <span data-role="confirmation">{{ note.text }}</span>&ngsp;
              <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/rotina/agenda">Ver na agenda</a>
            </app-cg-note>
          }

          @if (conversations.all().length === 0) {
            <app-cg-empty
              illustration="chat"
              [headingLevel]="2"
              title="Você ainda não marcou nenhuma conversa"
              text="Escolha o formato e o horário. Leva poucos minutos."
            >
              <button type="button" class="btn btn--primary" data-role="start-booking" (click)="start()">Marcar uma conversa</button>
            </app-cg-empty>
          } @else {
            @if (conversations.next(); as next) {
              <app-cg-card title="Sua próxima conversa">
                <div class="conv__next" data-role="next-conversation">
                  <span class="conv__date" aria-hidden="true">
                    <span class="conv__mon">{{ tile(next.startAt).month }}</span>
                    <span class="conv__dom">{{ tile(next.startAt).day }}</span>
                  </span>
                  <div>
                    <p class="conv__when">{{ next.whenText }}</p>
                    <p class="conv__line">Com {{ next.psychologistName }}</p>
                    <p class="conv__line">{{ next.formatLabel }} · {{ next.kindLabel }}</p>
                    <p class="conv__status" data-role="next-status">{{ next.statusText }}</p>
                  </div>
                </div>
                <button cgCardFooter type="button" class="cg-link-btn" (click)="openDetail(next)">Ver ou mudar esta conversa</button>
              </app-cg-card>
            }
            @if (others().length > 0) {
              <section aria-labelledby="conv-others">
                <h2 class="cg-section__title" id="conv-others">Outras conversas marcadas</h2>
                <ul class="cg-list" data-role="other-conversations">
                  @for (item of others(); track item.id) {
                    <li>
                      <app-cg-row
                        [title]="item.whenText"
                        [description]="item.kindLabel + ' · ' + item.statusText"
                        icon="calendar-days"
                        (activated)="openDetail(item)"
                      />
                    </li>
                  }
                </ul>
              </section>
            }
            <div class="cg-actions">
              <button type="button" class="btn btn--primary" data-role="start-booking" (click)="start()">Marcar uma conversa</button>
            </div>
            @if (conversations.previous().length > 0) {
              <details class="conv__more" data-role="previous">
                <summary>Conversas anteriores</summary>
                <ul class="cg-list">
                  @for (item of conversations.previous(); track item.id) {
                    <li>
                      <app-cg-row
                        [title]="item.dayText + ', às ' + item.time"
                        [description]="item.kindLabel + ' · ' + item.statusText"
                        (activated)="openDetail(item)"
                      />
                    </li>
                  }
                </ul>
              </details>
            }
          }
          <app-cg-emergency-note />
        }

        @case ('format') {
          <div>
            <button type="button" class="cg-link-btn" (click)="goBack()">
              <svg appIcon="arrow-left" size="sm"></svg>Voltar
            </button>
          </div>
          <div class="conv__progress">
            <div class="conv__bar" aria-hidden="true"><span class="is-on"></span><span></span></div>
            <p class="conv__count">Passo 1 de 2</p>
          </div>
          <div class="conv__stephead">
            <h2 class="conv__step" tabindex="-1" data-step-heading>Como você prefere?</h2>
            <app-cg-illustration name="chat" size="sm" tone="accent" />
          </div>
          <ul class="cg-list" data-role="formats">
            @for (option of formats; track option.value) {
              <li>
                <app-cg-row [title]="option.label" [description]="option.hint" [icon]="option.icon" (activated)="chooseFormat(option.value)" />
              </li>
            }
          </ul>
          <app-cg-emergency-note />
        }

        @case ('slots') {
          <div>
            <button type="button" class="cg-link-btn" (click)="goBack()">
              <svg appIcon="arrow-left" size="sm"></svg>Voltar
            </button>
          </div>
          <div class="conv__progress">
            <div class="conv__bar" aria-hidden="true"><span class="is-on"></span><span class="is-on"></span></div>
            <p class="conv__count">{{ rescheduling() ? 'Escolha o novo horário' : 'Passo 2 de 2' }}</p>
          </div>
          <div class="conv__stephead">
            <h2 class="conv__step" tabindex="-1" data-step-heading>Qual horário?</h2>
            <app-cg-illustration name="calendar" size="sm" tone="accent" />
          </div>
          @if (format() === 'in_person_coworking' && conversations.room(); as room) {
            <app-cg-note variant="soft" icon="building-2"><span data-role="room">{{ room.name }}, {{ room.address }}</span></app-cg-note>
          }
          @if (format() === 'in_person_home') {
            <app-form-field label="Endereço da conversa" controlId="conv-address" [error]="addressError()" [forceErrors]="true">
              <input appInput autocomplete="street-address" [value]="address()" (input)="onAddress($event)" />
            </app-form-field>
          }
          @if (days().length === 0) {
            <app-cg-empty illustration="calendar" title="Sem horários nesse formato" [text]="noSlots">
              @if (!rescheduling()) {
                <button type="button" class="btn btn--primary" (click)="mode.set('format')">Escolher outro formato</button>
              }
              <button type="button" class="btn" (click)="contact.open()">Falar com a gente</button>
            </app-cg-empty>
          } @else {
            <div class="conv__days" data-role="days">
              @for (day of days(); track day.date) {
                <section class="conv__day" [attr.aria-labelledby]="'conv-day-' + day.date">
                  <h3 class="conv__dayhead" [id]="'conv-day-' + day.date">
                    <span class="conv__ficon" aria-hidden="true"><svg appIcon="calendar-days" size="sm"></svg></span>{{ day.label }}
                  </h3>
                  <div class="conv__slots">
                    @for (slot of day.slots; track slot.slotId) {
                      <button type="button" class="btn" data-role="slot" (click)="pick(slot)">{{ slot.label }}</button>
                    }
                  </div>
                </section>
              }
            </div>
          }
        }
      }
    </div>

    <!-- Resumo antes de gravar -->
    <app-cg-sheet [heading]="rescheduling() ? 'Confirme o novo horário' : 'Confirme a conversa'" [(open)]="summaryOpen">
      @if (picked(); as slot) {
        <div class="conv__sheet cg-stack cg-stack--tight" data-role="summary">
          <p class="conv__fact" data-role="summary-when">
            <span class="conv__ficon" aria-hidden="true"><svg appIcon="calendar-days" size="sm"></svg></span>
            <span>Quando: {{ pickedDay() }}, às {{ slot.time }} (1 hora).</span>
          </p>
          <p class="conv__fact" data-role="summary-who">
            <span class="conv__ficon" aria-hidden="true"><svg appIcon="user-round" size="sm"></svg></span>
            <span>Com quem: {{ psychologistLine() }}.</span>
          </p>
          <p class="conv__fact" data-role="summary-how">
            <span class="conv__ficon" aria-hidden="true"><svg [appIcon]="formatIcon()" size="sm"></svg></span>
            <span>Como: {{ formatLabel() }}.</span>
          </p>
          @if (placeText(); as place) {
            <p class="conv__fact" data-role="summary-place">
              <span class="conv__ficon" aria-hidden="true"><svg appIcon="map-pin" size="sm"></svg></span>
              <span>{{ place }}</span>
            </p>
          }
          <div class="conv__prices" data-role="summary-price">
            @if (price().discountText; as discount) {
              <p>Conversa de 1 hora: {{ price().baseText }}.</p>
              <p data-role="summary-discount">Desconto do plano {{ planName() }} ({{ price().discountPercent }}%): menos {{ discount }}.</p>
            }
            <p class="conv__total" data-role="summary-total">Total: {{ price().totalText }}.</p>
          </div>
          <p>{{ paymentNote }}</p>
          @if (formatNotice(); as notice) {
            <app-cg-note variant="info" icon="info"><span data-role="summary-notice">{{ notice }}</span></app-cg-note>
          }
          @if (rescheduling()) {
            <app-cg-note variant="soft" icon="clock"><span data-role="summary-effect">{{ rescheduleEffect() }}</span></app-cg-note>
          } @else {
            <app-cg-choice-group legend="O que você procura?" [options]="kinds" [(value)]="kind" />
          }
          @if (sheetError()) {
            <app-cg-note variant="error"><span data-role="summary-error">{{ sheetError() }}</span></app-cg-note>
          }
        </div>
      }
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" data-role="confirm-booking" (click)="confirm()">
          {{ rescheduling() ? 'Salvar novo horário' : 'Marcar conversa' }}
        </button>
        <button type="button" class="cg-link-btn" (click)="summaryOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Detalhe da conversa -->
    <app-cg-sheet heading="Sua conversa" [(open)]="detailOpen">
      @if (detail(); as c) {
        <div class="conv__sheet cg-stack cg-stack--tight" data-role="detail">
          <p class="conv__when">{{ c.whenText }}</p>
          <p>Com {{ c.psychologistName }}, {{ c.psychologistRole }} ({{ c.crp }}, fictício).</p>
          <p>{{ c.formatLabel }} · {{ c.kindLabel }}</p>
          @if (c.place) {
            <p data-role="detail-place">{{ c.place }}</p>
          }
          <p class="conv__status" data-role="detail-status">{{ c.statusText }}</p>
        </div>
      }
      <ng-container cgSheetActions>
        @if (detail()?.upcoming) {
          <button type="button" class="btn" data-role="reschedule" (click)="startReschedule()">Remarcar</button>
          <button type="button" class="btn btn--danger-quiet" data-role="cancel" (click)="askCancel()">Cancelar conversa</button>
        }
        <button type="button" class="cg-link-btn" (click)="detailOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Cancelar, com o efeito dito antes -->
    <app-cg-sheet heading="Cancelar a conversa?" initialFocus="safe-action" [(open)]="cancelOpen">
      @if (detail(); as c) {
        <div class="conv__sheet cg-stack cg-stack--tight">
          <p><strong>{{ c.whenText }}</strong>, com {{ c.psychologistShort }}.</p>
          <p data-role="cancel-effect">{{ c.late ? cancelLate : cancelFree }}</p>
          @if (sheetError()) {
            <app-cg-note variant="error"><span data-role="cancel-error">{{ sheetError() }}</span></app-cg-note>
          }
        </div>
      }
      <ng-container cgSheetActions>
        @if (!detail()?.late) {
          <button type="button" class="btn" data-role="reschedule-instead" (click)="startReschedule()">Remarcar em vez de cancelar</button>
        }
        <button type="button" class="btn btn--danger-quiet" data-role="confirm-cancel" (click)="confirmCancel()">Cancelar a conversa</button>
        <button type="button" class="cg-link-btn" (click)="cancelOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class PsychologistPage {
  protected readonly conversations = inject(ConversationsService);
  private readonly ctx = inject(CaregiverContextService);
  protected readonly contact = inject(ContactDialogService);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly chrome = inject(PageChromeService);
  private readonly layers = inject(HistoryLayersService);

  protected readonly formats = FORMAT_OPTIONS;
  protected readonly kinds = KIND_OPTIONS;
  protected readonly noSlots = NO_SLOTS_TEXT;
  protected readonly paymentNote = PAYMENT_NOTE;
  protected readonly cancelFree = CANCEL_FREE;
  protected readonly cancelLate = CANCEL_LATE;

  protected readonly mode = signal<Mode>('home');
  protected readonly format = signal<SessionModality | null>(null);
  protected readonly address = signal('');
  protected readonly addressError = signal<string | null>(null);

  protected readonly picked = signal<SlotOption | null>(null);
  protected readonly kind = signal<KindChoice | null>(null);
  protected readonly summaryOpen = signal(false);
  protected readonly sheetError = signal('');

  protected readonly detailId = signal<string | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly cancelOpen = signal(false);

  /** A conversa que está sendo remarcada (o formato e o tipo ficam como estavam). */
  protected readonly reschedulingId = signal<string | null>(null);
  protected readonly confirmation = signal<{ text: string } | null>(null);

  protected readonly price = this.conversations.price;
  protected readonly planName = this.ctx.planName;
  protected readonly days = computed(() => this.conversations.slotsFor(this.format()));
  protected readonly others = computed(() => this.conversations.upcoming().slice(1));
  protected readonly detail = computed<Conversation | null>(
    () => this.conversations.all().find((c) => c.id === this.detailId()) ?? null,
  );
  protected readonly rescheduling = computed<Conversation | null>(
    () => this.conversations.all().find((c) => c.id === this.reschedulingId()) ?? null,
  );
  protected readonly formatLabel = computed(() => (this.format() ? FORMAT_LABEL[this.format() as SessionModality] : ''));
  protected readonly formatIcon = computed<IconName>(() => FORMAT_OPTIONS.find((o) => o.value === this.format())?.icon ?? 'video');

  /** O dia e o mês curto do bloco de data ("nov", "06"), tirados do próprio horário (sem fuso: o texto já vem no horário local). */
  protected tile(startAt: string): { day: string; month: string } {
    const month = Number(startAt.slice(5, 7));
    return { day: startAt.slice(8, 10), month: MONTHS[month - 1] ?? '' };
  }
  protected readonly formatNotice = computed(() => (this.format() ? FORMAT_NOTICE[this.format() as SessionModality] : null));
  protected readonly pickedDay = computed(() => {
    const slot = this.picked();
    return slot ? (this.conversations.slotsFor(this.format()).find((d) => d.date === slot.date)?.label ?? slot.date) : '';
  });
  protected readonly psychologistLine = computed(() => {
    const slot = this.picked();
    return slot
      ? this.conversations.psychologistLine(slot.psychologistName, this.conversations.crpOf(slot.psychologistId))
      : '';
  });
  protected readonly placeText = computed(() => {
    if (this.format() === 'in_person_coworking') {
      // A sala é a que está livre no horário escolhido (duas conversas nunca caem na mesma sala).
      const room = this.conversations.roomForSlot(this.picked()?.slotId) ?? this.conversations.room();
      return room ? `Local: ${room.name}, ${room.address}.` : null;
    }
    if (this.format() === 'in_person_home') {
      return `Endereço: ${this.address().trim()}.`;
    }
    return null;
  });
  protected readonly rescheduleEffect = computed(() => (this.rescheduling()?.late ? RESCHEDULE_LATE : RESCHEDULE_FREE));

  protected onAddress(event: Event): void {
    this.address.set((event.target as HTMLInputElement).value);
  }

  // ===== Passos =====

  protected start(): void {
    this.confirmation.set(null);
    this.reschedulingId.set(null);
    this.format.set(null);
    this.mode.set('format');
    // O voltar do aparelho desfaz cada passo, um por vez (CXC-013).
    this.layers.open('conv-format', () => this.backToHome());
    this.focusStep();
  }

  protected chooseFormat(format: SessionModality): void {
    this.format.set(format);
    this.addressError.set(null);
    this.mode.set('slots');
    this.layers.open('conv-slots', () => this.backFromSlots());
    this.focusStep();
  }

  /** O botão "Voltar" dos passos e o voltar do aparelho seguem o mesmo caminho. */
  protected goBack(): void {
    this.layers.goBack(() => (this.mode() === 'slots' ? this.backFromSlots() : this.backToHome()));
  }

  protected backToHome(): void {
    this.reschedulingId.set(null);
    this.mode.set('home');
    this.layers.forget('conv-slots');
    this.layers.forget('conv-format');
    this.focusTitle();
  }

  protected backFromSlots(): void {
    this.layers.forget('conv-slots');
    if (this.reschedulingId()) {
      this.backToHome();
      return;
    }
    this.mode.set('format');
    this.focusStep();
  }

  protected pick(slot: SlotOption): void {
    if (this.format() === 'in_person_home' && !this.address().trim()) {
      this.addressError.set('Informe o endereço da conversa.');
      this.host.nativeElement.querySelector<HTMLInputElement>('#conv-address')?.focus();
      return;
    }
    this.addressError.set(null);
    this.sheetError.set('');
    this.picked.set(slot);
    this.kind.set(null);
    this.summaryOpen.set(true);
  }

  protected confirm(): void {
    const slot = this.picked();
    const format = this.format();
    const current = this.rescheduling();
    if (!slot || !format) {
      return;
    }
    const kind: KindChoice | null = current ? current.session.kind : this.kind();
    if (!kind) {
      this.sheetError.set('Escolha uma das opções para continuar.');
      return;
    }
    const request = {
      slotId: slot.slotId,
      psychologistId: slot.psychologistId,
      format,
      kind,
      address: this.address().trim(),
    };
    const result = current ? this.conversations.reschedule(current, request) : this.conversations.book(request);
    if (!result.ok) {
      // O formato e o resumo continuam; a frase diz o que fazer (ex.: "Esse horário acabou de ser reservado").
      this.sheetError.set(result.error);
      return;
    }
    this.sheetError.set('');
    this.summaryOpen.set(false);
    // Um aviso só, a faixa da tela (CXC-007 e CXC-017): o cartão "Sua próxima conversa" mostra o dia e a situação.
    this.confirmation.set({ text: BOOKING_SENT });
    this.reschedulingId.set(null);
    this.picked.set(null);
    this.mode.set('home');
    // O fluxo acabou: as entradas de histórico dos passos saem juntas.
    this.layers.clear();
    this.focusTitle();
  }

  // ===== Ver, remarcar e cancelar =====

  protected openDetail(conversation: Conversation): void {
    this.sheetError.set('');
    this.detailId.set(conversation.id);
    this.detailOpen.set(true);
  }

  protected startReschedule(): void {
    const current = this.detail();
    if (!current) {
      return;
    }
    this.detailOpen.set(false);
    this.cancelOpen.set(false);
    this.confirmation.set(null);
    this.reschedulingId.set(current.id);
    this.format.set(current.format);
    this.address.set(current.session.homeAddress ?? '');
    this.addressError.set(null);
    this.mode.set('slots');
    this.layers.open('conv-slots', () => this.backFromSlots());
    this.focusStep();
  }

  protected askCancel(): void {
    this.sheetError.set('');
    this.detailOpen.set(false);
    this.cancelOpen.set(true);
  }

  protected confirmCancel(): void {
    const current = this.detail();
    if (!current) {
      return;
    }
    const result = this.conversations.cancel(current);
    if (!result.ok) {
      this.sheetError.set(result.error);
      return;
    }
    this.cancelOpen.set(false);
    this.confirmation.set(null);
    this.toast.show({
      message: current.late
        ? 'Conversa cancelada. Ela conta como perdida. Não há cobrança.'
        : 'Conversa cancelada. O horário foi liberado.',
      durationMs: 8000,
    });
    this.focusTitle();
  }

  /** O foco vai ao título do passo novo (o shell só leva o foco ao `h1` quando a rota muda). */
  /** Depois de marcar, remarcar ou cancelar o botão que abriu a folha some da tela: o foco volta ao título da página. */
  private focusTitle(): void {
    this.chrome.focusHeading();
  }

  private focusStep(): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[data-step-heading]')?.focus(), {
      injector: this.injector,
    });
  }
}
