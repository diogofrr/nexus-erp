import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ZARIT_BANDS } from '@core/rules/zarit';
import { IconComponent } from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';
import { Clock } from '@core/clock/clock.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { CARE_INVITE, CARE_TODAY_TEXT, careTodayHeading } from '../../state/care-note';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { CgChoiceGroupComponent } from '../../ui/cg-choice-group.component';
import { CgMoodComponent, MoodValue, moodLabel } from '../../ui/cg-mood.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import { CgTrendComponent } from '../../ui/cg-trend.component';
import {
  ARRANGE_PERIODS,
  BANDS_CLOSING,
  BAND_MEANING,
  EMPTY_TEXT,
  EMPTY_TITLE,
  PAUSED_TITLE,
  PRIVACY_LINE,
  REVIEW_SHEET_TEXT,
  TIMELINE_INTRO,
  WELLBEING_LEAD,
} from '../state/wellbeing-copy';
import { TIMELINE_VISIBLE, WellbeingViewService } from '../state/wellbeing-view.service';

type SheetView = 'bands' | 'week' | 'review' | 'arrange';

/**
 * Como estou (UX C9, B5; RN-ZRT-04, 05, 08, 18 a 20, 22 e 23, RN-LGPD-14 e 16, RN-PLN-19, RN-USR-05, RN-ETICA-15). A evolução do cansaço
 * da própria pessoa, lida com cuidado: a faixa por extenso, a pontuação só em legenda pequena, "Não é um diagnóstico"
 * sempre junto, sem número em destaque, sem vermelho nem âmbar, sem "alerta", "melhorou" ou "piorou". Quem tem contato da
 * equipe pendente ou vencido lê o que vai acontecer e tem uma saída imediata ("Falar com a gente agora").
 *
 * - A pessoa NUNCA preenche a escala (quem aplica é a equipe, RN-ZRT-04): nenhum campo, pergunta ou botão de resposta.
 * - Sem a autorização de saúde somem o humor e a linha do tempo e a tela explica a pausa, com "Autorizar de novo" e o
 *   caminho para pedir a cópia dos dados (S-28).
 * - NENHUM convite de grupo, plano, desconto ou upgrade aparece aqui, sejam quais forem a faixa e o contato (RN-PLN-19).
 */
@Component({
  selector: 'app-my-wellbeing-page',
  imports: [
    RouterLink,
    CgPageHeaderComponent,
    CgNoteComponent,
    CgMoodComponent,
    CgTrendComponent,
    CgSheetComponent,
    CgChoiceGroupComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .well__line { margin: 0; }
      .well__answer { margin: 0.25rem 0 0; white-space: pre-line; overflow-wrap: anywhere; }
      .well__list { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
      .well__list li { padding: 0.5rem 0.75rem; border-left: 3px solid var(--cg-border-control); background: var(--cg-surface-sunken); border-radius: 0 var(--cg-radius-control) var(--cg-radius-control) 0; }
      .well__sheet p { margin: 0; }
      .well__tools { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; }
    `,
  ],
  template: `
    <app-cg-page-header title="Como estou" [description]="lead" backLink="/cuidador/cuidar-de-mim" backLabel="Cuidar de mim" />

    <div class="cg-stack">
      @if (paused()) {
        <app-cg-note variant="info" [heading]="pausedTitle" icon="info">
          <span data-role="paused-text">{{ pausedText() }}</span>
          <button cgNoteActions type="button" class="btn" data-role="authorize" (click)="authorizeAgain()">Autorizar de novo</button>
          <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/mais/privacidade">Ir para Privacidade</a>
        </app-cg-note>
      } @else {
        @if (contact() !== 'none') {
          <app-cg-note variant="care" icon="hand-heart">
            <span data-role="care-note">{{ careNote() }}</span>
            <button cgNoteActions type="button" class="cg-link-btn" data-role="talk-now" (click)="contactDialog.open()">
              {{ contact() === 'today' ? 'Prefere falar agora?' : 'Falar com a gente agora' }}
            </button>
            <button cgNoteActions type="button" class="cg-link-btn" data-role="arrange" (click)="open('arrange')">Combinar um horário</button>
          </app-cg-note>
        }
        @if (arranged(); as done) {
          <app-cg-note variant="ok" icon="circle-check"><span data-role="arranged">{{ done }}</span></app-cg-note>
        }

        <section class="cg-stack cg-stack--tight" aria-labelledby="well-mood">
          <h2 class="cg-section__title" id="well-mood">Como você está hoje?</h2>
          <div class="cg-stack cg-stack--tight" data-role="mood">
            @if (todayMood(); as mood) {
              @if (changing()) {
                <app-cg-mood [value]="mood.mood" (chosen)="chooseMood($event)" />
              } @else {
                <app-cg-note variant="ok" icon="circle-check"><span data-role="mood-noted">Anotado para hoje: {{ label(mood.mood) }}.</span></app-cg-note>
                <button type="button" class="cg-link-btn" data-role="mood-change" (click)="changing.set(true)">Mudar</button>
              }
            } @else {
              <app-cg-mood (chosen)="chooseMood($event)" />
            }
            @if (moodError()) {
              <app-cg-note variant="error"><span data-role="mood-error">{{ moodError() }}</span></app-cg-note>
            }
          </div>
          <div>
            <button type="button" class="cg-link-btn" data-role="week" (click)="open('week')">Ver os últimos 7 dias</button>
          </div>
        </section>

        <section aria-labelledby="well-timeline" data-role="timeline">
          <h2 class="cg-section__title" id="well-timeline">Suas conversas com a equipe</h2>
          @if (!hasConversations()) {
            <app-cg-note variant="soft" icon="info" [heading]="emptyTitle">
              <span data-role="timeline-empty">{{ emptyText }}</span>
            </app-cg-note>
          } @else {
            <div class="cg-stack cg-stack--tight">
              <p class="cg-muted" data-role="timeline-intro">{{ intro }}</p>
              <app-cg-trend [items]="visible()" />
              @if (lastText(); as last) {
                <p class="well__line" data-role="last-text">{{ last }}</p>
              }
              @if (nextText(); as next) {
                <p class="well__line" data-role="next-text">{{ next }}</p>
              }
              <div class="well__tools">
                @if (timeline().length > visibleCount) {
                  <button type="button" class="cg-link-btn" data-role="see-all" [attr.aria-expanded]="showAll()" (click)="showAll.set(!showAll())">
                    {{ showAll() ? 'Ver menos' : 'Ver todas' }}
                  </button>
                }
                <button type="button" class="cg-link-btn" data-role="bands" (click)="open('bands')">Entender as faixas</button>
              </div>
            </div>
          }
        </section>
      }

      @if (review(); as r) {
        @if (r.answered) {
          <app-cg-note variant="info" icon="circle-check">
            <span data-role="review-card">Resposta {{ r.whoOf }}, em {{ r.dateLabel }}:</span>
            <p class="well__answer" data-role="review-answer">{{ r.answer }}</p>
          </app-cg-note>
        } @else {
          <app-cg-note variant="soft" icon="hourglass">
            <span data-role="review-card">Seu pedido de revisão está com {{ r.who }}. Resposta até {{ r.dateLabel }}.</span>
          </app-cg-note>
        }
      }
      @if (reviewDone(); as done) {
        <app-cg-note variant="ok" icon="circle-check"><span data-role="review-done">{{ done }}</span></app-cg-note>
      }
      <div>
        <button type="button" class="cg-link-btn" data-role="review" (click)="openReview()">Pedir revisão de uma decisão</button>
      </div>

      <p class="cg-muted" data-role="privacy-line">{{ privacyLine }}</p>
    </div>

    <!-- Os últimos 7 dias do humor -->
    <app-cg-sheet heading="Os últimos 7 dias" [open]="is('week')" (openChange)="onOpenChange('week', $event)">
      @if (week().length > 0) {
        <ul class="well__list" data-role="week-list">
          @for (entry of week(); track entry.id) {
            <li>{{ entry.dateLabel }}: {{ entry.label }}</li>
          }
        </ul>
      } @else {
        <p data-role="week-empty">Você ainda não anotou nenhum dia nesta semana.</p>
      }
      <ng-container cgSheetActions>
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Entender as faixas -->
    <app-cg-sheet heading="Entender as faixas" [open]="is('bands')" (openChange)="onOpenChange('bands', $event)">
      <div class="well__sheet cg-stack cg-stack--tight" data-role="bands-sheet">
        <p>A escala ajuda a equipe a escutar você. Não é um diagnóstico.</p>
        <ul class="well__list">
          @for (band of bands; track band.band) {
            <li>{{ band.label }} ({{ band.min }} a {{ band.max }}): {{ meaning[band.band] }}</li>
          }
        </ul>
        <p data-role="bands-closing">{{ closing }}</p>
      </div>
      <ng-container cgSheetActions>
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Pedir revisão -->
    <app-cg-sheet heading="Pedir revisão" [open]="is('review')" (openChange)="onOpenChange('review', $event)">
      <div class="well__sheet cg-stack cg-stack--tight">
        <p>{{ reviewText }}</p>
        <div class="field" [class.field--error]="!!reviewError()">
          <label class="field__label" for="well-review">O que você quer que a equipe reveja?</label>
          <textarea
            id="well-review"
            class="textarea"
            rows="5"
            data-role="review-field"
            [value]="draft()"
            [attr.aria-invalid]="reviewError() ? 'true' : null"
            [attr.aria-describedby]="reviewError() ? 'well-review-error' : null"
            (input)="onDraft($event)"
          ></textarea>
          @if (reviewError()) {
            <span class="field__error" id="well-review-error" data-role="review-error">
              <svg appIcon="circle-alert" size="sm"></svg>
              <span><span class="sr-only">Erro: </span>{{ reviewError() }}</span>
            </span>
          }
        </div>
      </div>
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" data-role="send-review" (click)="sendReview()">Enviar pedido</button>
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Combinar um horário -->
    <app-cg-sheet heading="Combinar um horário" [open]="is('arrange')" (openChange)="onOpenChange('arrange', $event)">
      <div class="well__sheet cg-stack cg-stack--tight">
        <p>Em que período a equipe pode falar com você?</p>
        <app-cg-choice-group legend="Período" [options]="periods" [(value)]="period" />
        @if (arrangeError()) {
          <app-cg-note variant="error"><span data-role="arrange-error">{{ arrangeError() }}</span></app-cg-note>
        }
      </div>
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" data-role="send-arrange" (click)="sendArrange()">Enviar para a equipe</button>
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class MyWellbeingPage {
  private readonly view = inject(WellbeingViewService);
  private readonly ctx = inject(CaregiverContextService);
  private readonly toast = inject(ToastService);
  protected readonly contactDialog = inject(ContactDialogService);
  private readonly clock = inject(Clock);

  protected readonly lead = WELLBEING_LEAD;
  protected readonly intro = TIMELINE_INTRO;
  protected readonly privacyLine = PRIVACY_LINE;
  protected readonly emptyTitle = EMPTY_TITLE;
  protected readonly emptyText = EMPTY_TEXT;
  protected readonly pausedTitle = PAUSED_TITLE;
  protected readonly reviewText = REVIEW_SHEET_TEXT;
  protected readonly closing = BANDS_CLOSING;
  protected readonly meaning = BAND_MEANING;
  protected readonly bands = ZARIT_BANDS;
  protected readonly visibleCount = TIMELINE_VISIBLE;
  protected readonly periods = ARRANGE_PERIODS.map((p) => ({ value: p.value, label: p.label }));

  protected readonly paused = this.view.paused;
  /** O que a pessoa decidiu sobre a autorização de saúde, em uma frase (UX C9, S-28). */
  protected readonly pausedText = computed(() => {
    const state = this.view.paused();
    const copy = state?.status === 'revoked'
      ? `Você retirou a autorização de dados de saúde${state.since ? ` em ${state.since}` : ''}. A escala e o acompanhamento só voltam se você autorizar de novo. O que já foi registrado fica guardado, sem uso.`
      : 'A escala e o acompanhamento só acontecem com a sua autorização de dados de saúde. A agenda, os remédios e os conteúdos continuam.';
    return `${copy} Você pode pedir uma cópia dos seus dados em Privacidade.`;
  });
  protected readonly contact = this.ctx.staffContact;
  /** A nota de cuidado em uma frase: "hoje" só no horário comercial (CXC-003); contato que não aconteceu vira convite. */
  protected readonly careNote = computed(() =>
    this.contact() === 'today' ? `${careTodayHeading(this.clock.now())} ${CARE_TODAY_TEXT}` : CARE_INVITE,
  );
  protected readonly hasConversations = this.view.hasConversations;
  protected readonly timeline = this.view.timeline;
  protected readonly lastText = this.view.lastText;
  protected readonly nextText = this.view.nextText;
  protected readonly todayMood = this.view.todayMood;
  protected readonly week = this.view.week;
  protected readonly review = this.view.review;

  protected readonly showAll = signal(false);
  protected readonly visible = computed(() => (this.showAll() ? this.timeline() : this.timeline().slice(0, TIMELINE_VISIBLE)));

  private readonly sheet = signal<SheetView | null>(null);
  protected readonly changing = signal(false);
  protected readonly moodError = signal('');
  protected readonly draft = signal('');
  protected readonly reviewError = signal('');
  protected readonly reviewDone = signal('');
  protected readonly period = signal<(typeof ARRANGE_PERIODS)[number]['value'] | null>(null);
  protected readonly arrangeError = signal('');
  protected readonly arranged = signal('');

  protected label(mood: number): string {
    return moodLabel(mood);
  }

  protected is(view: SheetView): boolean {
    return this.sheet() === view;
  }

  protected open(view: SheetView): void {
    this.arrangeError.set('');
    this.sheet.set(view);
  }

  protected close(): void {
    this.sheet.set(null);
  }

  protected onOpenChange(view: SheetView, open: boolean): void {
    if (!open && this.sheet() === view) {
      this.sheet.set(null);
    }
  }

  // ===== Humor =====

  protected chooseMood(mood: MoodValue): void {
    const result = this.view.recordMood(mood);
    if (!result.ok) {
      this.moodError.set(result.error);
      return;
    }
    this.moodError.set('');
    this.changing.set(false);
  }

  // ===== Autorização =====

  protected authorizeAgain(): void {
    if (this.view.authorizeAgain().ok) {
      this.toast.show({ message: 'Autorização registrada. O acompanhamento volta.', durationMs: 8000 });
    } else {
      this.toast.show({ message: 'Não foi possível registrar. Tente de novo; se continuar, fale com a gente.', tone: 'danger', durationMs: 8000 });
    }
  }

  // ===== Revisão =====

  protected openReview(): void {
    this.reviewError.set('');
    this.reviewDone.set('');
    this.open('review');
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  protected sendReview(): void {
    const result = this.view.requestReview(this.draft());
    if (!result.ok) {
      // O texto digitado continua na folha.
      this.reviewError.set(result.error);
      return;
    }
    this.reviewError.set('');
    this.draft.set('');
    this.close();
    this.reviewDone.set(result.text);
  }

  // ===== Combinar um horário =====

  protected sendArrange(): void {
    const period = this.period();
    if (!period) {
      this.arrangeError.set('Escolha o período em que a equipe pode falar com você.');
      return;
    }
    const result = this.view.arrange(period);
    if (!result.ok) {
      this.arrangeError.set(result.error);
      return;
    }
    this.arrangeError.set('');
    this.period.set(null);
    this.close();
    this.arranged.set(result.text);
  }
}
