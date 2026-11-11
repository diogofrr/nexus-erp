import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DoseCheckError, DoseCheckService } from '../../../../core/care/dose-check.service';
import { Clock } from '../../../../core/clock/clock.service';
import { timeOf } from '../../../../core/clock/date-utils';
import { DoseSlot } from '../../../../core/rules/medication-doses';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import {
  CARE_INVITE_HEADING,
  CARE_INVITE_TEXT,
  CARE_TODAY_TEXT,
  careTodayHeading,
} from '../../state/care-note';
import { firstLateKey, freezeDoseOrder } from '../../state/dose-order';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { NEXUS_PHONE } from '../../state/nexus-contact';
import { OnlineStatusService } from '../../state/online-status.service';
import { StorageStatusService, doseNotSavedText } from '../../state/storage-status.service';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgDoseComponent } from '../../ui/cg-dose.component';
import { CgEmptyComponent } from '../../ui/cg-empty.component';
import { CgEventBadgeComponent } from '../../ui/cg-event-badge.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CgMoodComponent, MoodValue } from '../../ui/cg-mood.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgProgressRingComponent } from '../../ui/cg-progress-ring.component';
import { CgSectionComponent } from '../../ui/cg-section.component';
import { TODAY_DOSE_ROWS, TodayViewService } from '../state/today-view.service';

/**
 * Hoje (UX C4, `/cuidador/hoje`): o que importa hoje, sem painel. Um herói (a saudação e a data) e duas colunas bem
 * definidas em tela larga (uma coluna no celular, na mesma ordem): à esquerda O DIA (o contato da equipe quando houver, o
 * cartão do telefone para quem prefere ligar, o próximo compromisso com a hora grande em serifa, os remédios de hoje com
 * "Dei" e o anel "2 de 4"); à direita VOCÊ (o humor do dia, "Para você" e o jeito de falar com a gente). Tudo é seção com
 * título e cartão: nenhuma frase solta.
 *
 * O plano nunca aparece aqui, e a tela não lê pontuação nem faixa: o contato da equipe vem só de `staffContact` do
 * contexto (P-03). "Para você" só convida para o que a pessoa pode usar de verdade (docs/20, regras de exibição 1 e 2),
 * e todo encontro leva o selo do tipo (`app-cg-event-badge`).
 */
@Component({
  selector: 'app-today-page',
  imports: [
    CgCardComponent,
    CgDoseComponent,
    CgEmptyComponent,
    CgEventBadgeComponent,
    CgHeroComponent,
    CgMoodComponent,
    CgNoteComponent,
    CgProgressRingComponent,
    CgSectionComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .today-cols,
    .today-main,
    .today-side {
      display: grid;
      gap: var(--cg-gap-block);
      grid-template-columns: minmax(0, 1fr);
      align-content: start;
    }
    @media (min-width: 64rem) {
      .today-cols {
        grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
        align-items: start;
        gap: 2rem;
      }
    }
    .today-support {
      color: var(--cg-text-soft);
      font-size: var(--cg-fs-small);
    }
    .today-phone {
      margin: 0;
      font-size: 1.75rem;
      font-weight: var(--fw-semibold);
      font-variant-numeric: tabular-nums;
      color: var(--cg-heading);
    }
    .today-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem 1rem;
    }
    .today-when {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }
    .today-when__time {
      display: grid;
      justify-items: start;
      gap: 0.25rem;
      padding-inline-end: 1rem;
      border-inline-end: 2px solid var(--cg-acc-strong);
    }
    .today-when__day {
      color: var(--cg-acc-ink);
      font-size: var(--cg-fs-small);
      font-weight: var(--fw-semibold);
    }
    .today-when__what {
      display: grid;
      flex: 1 1 9rem;
      gap: 0.375rem;
      justify-items: start;
      min-width: 0;
      overflow-wrap: break-word;
      font-weight: var(--fw-semibold);
    }
    .today-panel {
      padding: 1rem 0.75rem;
      border: 1px solid var(--cg-acc-strong);
      border-radius: var(--cg-radius-card);
      background: linear-gradient(160deg, var(--cg-surface) 40%, var(--cg-acc-tint) 135%);
      box-shadow: inset 0 3px 0 var(--cg-acc-strong), var(--cg-shadow-1);
    }
    @media (min-width: 48rem) {
      .today-panel {
        padding: var(--cg-pad-card);
      }
    }
    .today-invite {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
    }
  `,
  template: `
    <app-cg-hero [title]="view.greeting()" [description]="view.dateLabel()" illustration="day" />

    <div class="cg-stack">
      @if (!online.online()) {
        <app-cg-note variant="soft" icon="info">Você está sem conexão. Seus dados continuam neste navegador.</app-cg-note>
      }

      <div class="today-cols">
        <div class="today-main" data-role="today-day">
          @if (ctx.staffContact() === 'today') {
            <app-cg-note variant="care" [heading]="careHeading()">
              {{ careToday }}
              <button cgNoteActions type="button" class="cg-link-btn" (click)="contact.open()">Prefere falar agora?</button>
            </app-cg-note>
          } @else if (ctx.staffContact() === 'not_yet') {
            <app-cg-note variant="care" [heading]="inviteHeading">
              {{ inviteText }}
              <button cgNoteActions type="button" class="btn" (click)="contact.open()">Falar com a gente agora</button>
            </app-cg-note>
          }

          @if (phoneFirst()) {
            <app-cg-card title="Prefere falar com a gente?" variant="soft" icon="phone" data-role="phone-card">
              <p class="today-phone">{{ phone }}</p>
              <button cgCardFooter type="button" class="btn" (click)="contact.open()">Como falar com a gente</button>
            </app-cg-card>
          }

          @if (view.empty()) {
            <app-cg-empty illustration="day" title="Ainda não há nada para hoje" text="Comece pelos remédios ou por um compromisso.">
              <span class="today-actions">
                <a class="btn btn--primary" routerLink="/cuidador/rotina/remedios" [queryParams]="{ novo: 1 }">Cadastrar um remédio</a>
                <a class="btn" routerLink="/cuidador/rotina/agenda" [queryParams]="{ novo: 1 }">Adicionar compromisso</a>
              </span>
            </app-cg-empty>
          } @else {
            @if (view.next(); as next) {
              <app-cg-card title="Próximo compromisso" icon="calendar" [link]="next.link" [linkQuery]="next.query" data-role="next">
                <span class="today-when">
                  <span class="today-when__time">
                    <span class="today-when__day">{{ next.day }}&ngsp;</span>
                    <span class="cg-bignum">{{ next.time }}&ngsp;</span>
                  </span>
                  <span class="today-when__what">
                    <span>{{ next.title }}</span>
                    @if (next.eventType; as type) {
                      <app-cg-event-badge [type]="type" size="sm" />
                    }
                    @if (next.support; as support) {
                      <span class="today-support">{{ support }}</span>
                    }
                  </span>
                </span>
              </app-cg-card>
            } @else {
              <app-cg-card title="Próximo compromisso" icon="calendar" data-role="next">
                <span>Nenhum compromisso nos próximos dias.</span>
                <a cgCardFooter class="cg-link-btn" routerLink="/cuidador/rotina/agenda" [queryParams]="{ novo: 1 }">Adicionar compromisso</a>
              </app-cg-card>
            }

            <app-cg-section title="Remédios de hoje" accent="rotina" data-role="meds">
              @if (view.progress().total > 0) {
                <app-cg-progress-ring cgSectionEnd [value]="view.progress().given" [max]="view.progress().total" size="md" label="dados" />
              }
              @if (view.slots().length > 0) {
                <ul class="cg-plain-list cg-enter">
                  @for (slot of visibleSlots(); track slot.key) {
                    <li>
                      <app-cg-dose
                        [slot]="slot"
                        [size]="ctx.doseSize()"
                        [quietLate]="slot.key !== lateKey()"
                        (dei)="dei($event)"
                        (undo)="undo($event)"
                      />
                    </li>
                  }
                </ul>
                @if (view.slots().length > doseRows) {
                  <a class="cg-link-btn" routerLink="/cuidador/rotina/remedios">Ver todos ({{ view.slots().length }})</a>
                }
              } @else if (!view.hasMedications()) {
                <app-cg-note variant="soft" icon="pill">
                  Nenhum remédio cadastrado.
                  <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/rotina/remedios" [queryParams]="{ novo: 1 }">Cadastrar um remédio</a>
                </app-cg-note>
              } @else {
                <app-cg-note variant="soft" icon="pill">Hoje não há remédios para dar.</app-cg-note>
              }
            </app-cg-section>
          }
        </div>

        <div class="today-side" data-role="today-you">
          @if (view.moodEnabled()) {
            <app-cg-section class="today-panel" title="Como você está hoje?" accent="cuidar" data-role="mood">
              @if (view.todayMood() && !editingMood()) {
                <app-cg-note variant="ok">
                  Anotado para hoje: {{ view.todayMoodLabel() }}.
                  <button cgNoteActions type="button" class="cg-link-btn" (click)="editingMood.set(true)">Mudar</button>
                </app-cg-note>
                @if (hardDay()) {
                  <app-cg-note variant="care">
                    Dias difíceis acontecem. Se quiser conversar, fale com a gente.
                    <button cgNoteActions type="button" class="cg-link-btn" (click)="contact.open()">Falar com a gente</button>
                    @if (view.todayMood()?.mood === 1) {
                      <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/ajuda-agora">Ajuda agora</a>
                    }
                  </app-cg-note>
                }
              } @else {
                <app-cg-mood [value]="view.todayMood()?.mood ?? null" (chosen)="chooseMood($event)" />
                @if (view.todayMood()) {
                  <button type="button" class="cg-link-btn" (click)="editingMood.set(false)">Manter como está</button>
                }
              }
              @if (moodError(); as problem) {
                <app-cg-note variant="error">{{ problem }}</app-cg-note>
              }
            </app-cg-section>
          }

          @if (view.moodPaused()) {
            <app-cg-note variant="soft" icon="info" data-role="mood-paused">
              O humor do dia está pausado, porque você retirou a autorização de saúde.
              <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/cuidar-de-mim/como-estou">Ver em Como estou</a>
            </app-cg-note>
          }

          @if (view.rate(); as rate) {
            <app-cg-section title="Para você" accent="rede" data-role="for-you">
              <app-cg-card [headingLevel]="3" icon="star" [title]="'Como foi o atendimento de ' + rate.providerName + '?'">
                <a cgCardFooter class="btn" routerLink="/cuidador/rede/pedidos" [queryParams]="{ avaliar: rate.requestId }">Avaliar</a>
              </app-cg-card>
            </app-cg-section>
          } @else if (view.invite(); as invite) {
            <app-cg-section title="Para você" accent="cuidar" data-role="for-you">
              <app-cg-card [headingLevel]="3" icon="sparkles" [title]="invite.title">
                <span class="today-invite">
                  @if (invite.eventType; as type) {
                    <app-cg-event-badge [type]="type" />
                  }
                  <span>{{ invite.text }}</span>
                </span>
                @if (invite.query; as query) {
                  <a cgCardFooter class="btn" [routerLink]="invite.link" [queryParams]="query">{{ invite.actionLabel }}</a>
                } @else {
                  <a cgCardFooter class="btn" [routerLink]="invite.link">{{ invite.actionLabel }}</a>
                }
              </app-cg-card>
            </app-cg-section>
          }

          @if (!phoneFirst()) {
            <app-cg-card title="Quer falar com a gente?" variant="soft" icon="phone" data-role="contact-card">
              @if (prefersPhone()) {
                <p class="today-phone">{{ phone }}</p>
              } @else {
                <span>Aplicativo, WhatsApp ou telefone, como for mais fácil.</span>
              }
              <button cgCardFooter type="button" class="btn" (click)="contact.open()">Como falar com a gente</button>
            </app-cg-card>
          }
        </div>
      </div>
    </div>
  `,
})
export class TodayPage {
  protected readonly view = inject(TodayViewService);
  protected readonly ctx = inject(CaregiverContextService);
  protected readonly contact = inject(ContactDialogService);
  protected readonly online = inject(OnlineStatusService);
  private readonly doses = inject(DoseCheckService);
  private readonly toasts = inject(ToastService);
  private readonly storage = inject(StorageStatusService);
  private readonly clock = inject(Clock);

  protected readonly doseRows = TODAY_DOSE_ROWS;
  protected readonly phone = NEXUS_PHONE;
  protected readonly careToday = CARE_TODAY_TEXT;
  protected readonly inviteHeading = CARE_INVITE_HEADING;
  protected readonly inviteText = CARE_INVITE_TEXT;
  /** "A equipe vai falar com você hoje" só no horário comercial; fora dele, "amanhã de manhã" (CXC-003). */
  protected readonly careHeading = computed(() => careTodayHeading(this.clock.now()));

  /** O que falta vem primeiro; a ordem fica fixa enquanto a tela está aberta (CXC-005). */
  private readonly order = freezeDoseOrder(this.view.slots());
  private readonly ordered = computed(() => this.order(this.view.slots()));
  protected readonly visibleSlots = computed(() => this.ordered().slice(0, TODAY_DOSE_ROWS));
  /** A primeira linha em atraso leva o âmbar; as outras ficam neutras (CXC-005). */
  protected readonly lateKey = computed(() => firstLateKey(this.ordered(), this.clock.now()));
  /** "Mudar" abre de novo o seletor de humor. */
  protected readonly editingMood = signal(false);
  protected readonly moodError = signal<string | null>(null);

  /** Canal preferido telefone ou pouca familiaridade digital: o cartão de contato traz o número em destaque (AC-CG-54). */
  protected prefersPhone(): boolean {
    return this.ctx.preferredChannel() === 'phone' || this.ctx.lowDigitalLiteracy();
  }

  /** Quem prefere telefone ou WhatsApp vê o cartão com o número no alto do dia, logo depois da saudação (CXC-025). */
  protected readonly phoneFirst = computed(
    () => this.ctx.preferredChannel() === 'phone' || this.ctx.preferredChannel() === 'whatsapp',
  );

  /** "Muito mal" ou "Mal": a nota acolhedora (UX C4, Humor). */
  protected hardDay(): boolean {
    const mood = this.view.todayMood()?.mood;
    return mood === 1 || mood === 2;
  }

  protected dei(slot: DoseSlot): void {
    try {
      const check = this.doses.mark(slot.medicationId, slot.date, slot.time);
      // QAC-010: se o navegador não guardou, o aviso não diz só "anotado".
      const notSaved = this.storage.failing();
      this.toasts.show({
        message: notSaved ? doseNotSavedText(timeOf(check.givenAt)) : `Anotado às ${timeOf(check.givenAt)}.`,
        ...(notSaved ? { tone: 'attention' as const } : {}),
        durationMs: 8000,
        action: { label: 'Desfazer', run: () => this.undo(slot) },
      });
    } catch (error) {
      this.toasts.show({
        message: error instanceof DoseCheckError ? error.message : 'Não foi possível salvar. Tente de novo; se continuar, fale com a gente.',
        tone: 'attention',
        durationMs: 8000,
      });
    }
  }

  /** "Desfazer" é reversível: sem confirmação (AC-CG-47). */
  protected undo(slot: DoseSlot): void {
    this.doses.unmark(slot.medicationId, slot.date, slot.time);
  }

  protected chooseMood(mood: MoodValue): void {
    const problem = this.view.saveMood(mood);
    this.moodError.set(problem);
    if (!problem) {
      this.editingMood.set(false);
    }
  }
}
