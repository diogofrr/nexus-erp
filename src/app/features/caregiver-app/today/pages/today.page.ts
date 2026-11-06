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
import { CgMoodComponent, MoodValue } from '../../ui/cg-mood.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { TODAY_DOSE_ROWS, TodayViewService } from '../state/today-view.service';

/**
 * Hoje (UX C4, `/cuidador/hoje`): o que importa hoje, sem painel. Ordem: saudação, nota de cuidado (só com contato
 * da equipe), próximo compromisso, remédios de hoje com "Dei" (o que falta primeiro), humor, "Para você" e "Falar com a
 * gente". Quem prefere telefone ou WhatsApp vê o cartão com o número logo depois da saudação (CXC-025).
 * Em 1024 px ou mais, duas colunas (compromisso e remédios; humor e convite). O plano nunca aparece aqui, e a tela
 * não lê pontuação nem faixa: o contato da equipe vem só de `staffContact` do contexto (P-03).
 */
@Component({
  selector: 'app-today-page',
  imports: [CgCardComponent, CgDoseComponent, CgMoodComponent, CgNoteComponent, CgPageHeaderComponent, RouterLink],
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
      }
    }
    .today-block > h2 {
      margin: 0;
    }
    .today-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.25rem 1rem;
    }
    .today-head > h2 {
      margin: 0;
    }
    .today-progress {
      color: var(--cg-text-soft);
      font-size: var(--cg-fs-small);
      font-weight: var(--fw-semibold);
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
      gap: 0.5rem 1rem;
    }
    .today-end {
      display: grid;
      gap: 0.25rem;
      justify-items: start;
      margin-top: 2rem;
    }
    .today-end p {
      margin: 0;
    }
  `,
  template: `
    <app-cg-page-header [title]="view.greeting()" [description]="view.dateLabel()" />

    <div class="cg-stack">
      @if (!online.online()) {
        <app-cg-note variant="soft" icon="info">Você está sem conexão. Seus dados continuam neste navegador.</app-cg-note>
      }

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
        <app-cg-card title="Prefere falar com a gente?" variant="soft" icon="phone">
          <p class="today-phone">{{ phone }}</p>
          <button cgCardFooter type="button" class="btn" (click)="contact.open()">Como falar com a gente</button>
        </app-cg-card>
      }

      <div class="today-cols">
        <div class="today-main">
          @if (view.empty()) {
            <app-cg-note variant="soft" icon="hourglass">
              Ainda não há nada para hoje. Comece pelos remédios ou por um compromisso.
              <span cgNoteActions class="today-actions">
                <a class="btn" routerLink="/cuidador/rotina/remedios" [queryParams]="{ novo: 1 }">Cadastrar um remédio</a>
                <a class="btn" routerLink="/cuidador/rotina/agenda" [queryParams]="{ novo: 1 }">Adicionar compromisso</a>
              </span>
            </app-cg-note>
          } @else {
            @if (view.next(); as next) {
              <app-cg-card title="Próximo compromisso" icon="calendar" link="/cuidador/rotina/agenda">
                <span>{{ next.text }}</span>
                @if (next.support; as support) {
                  <span class="today-support">{{ support }}</span>
                }
              </app-cg-card>
            } @else {
              <app-cg-card title="Próximo compromisso" icon="calendar">
                <span>Nenhum compromisso nos próximos dias.</span>
                <a cgCardFooter class="cg-link-btn" routerLink="/cuidador/rotina/agenda" [queryParams]="{ novo: 1 }">Adicionar compromisso</a>
              </app-cg-card>
            }

            <section class="today-block cg-stack cg-stack--tight" aria-labelledby="today-meds-title">
              <div class="today-head">
                <h2 class="cg-section__title" id="today-meds-title">Remédios de hoje</h2>
                @if (view.progress().total > 0) {
                  <span class="today-progress">{{ view.progress().given }} de {{ view.progress().total }} dados</span>
                }
              </div>
              @if (view.slots().length > 0) {
                <ul class="cg-plain-list">
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
            </section>
          }
        </div>

        <div class="today-side">
          @if (view.moodEnabled()) {
            <section class="today-block cg-stack cg-stack--tight" aria-labelledby="today-mood-title">
              <h2 class="cg-section__title" id="today-mood-title">Como você está hoje?</h2>
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
            </section>
          }

          @if (view.moodPaused()) {
            <app-cg-note variant="soft" icon="info" data-role="mood-paused">
              O humor do dia está pausado, porque você retirou a autorização de saúde.
              <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/cuidar-de-mim/como-estou">Ver em Como estou</a>
            </app-cg-note>
          }

          @if (view.rate(); as rate) {
            <section class="today-block cg-stack cg-stack--tight" aria-labelledby="today-foryou-title">
              <h2 class="cg-section__title" id="today-foryou-title">Para você</h2>
              <app-cg-card [headingLevel]="3" [title]="'Como foi o atendimento de ' + rate.providerName + '?'">
                <a cgCardFooter class="btn" routerLink="/cuidador/rede/pedidos" [queryParams]="{ avaliar: rate.requestId }">Avaliar</a>
              </app-cg-card>
            </section>
          } @else if (view.invite(); as invite) {
            <section class="today-block cg-stack cg-stack--tight" aria-labelledby="today-foryou-title">
              <h2 class="cg-section__title" id="today-foryou-title">Para você</h2>
              <app-cg-card [headingLevel]="3" [title]="invite.title">
                <span>{{ invite.text }}</span>
                @if (invite.query; as query) {
                  <a cgCardFooter class="btn" [routerLink]="invite.link" [queryParams]="query">{{ invite.actionLabel }}</a>
                } @else {
                  <a cgCardFooter class="btn" [routerLink]="invite.link">{{ invite.actionLabel }}</a>
                }
              </app-cg-card>
            </section>
          }
        </div>
      </div>
    </div>

    @if (!phoneFirst()) {
      @if (prefersPhone()) {
        <app-cg-card class="today-end" title="Prefere falar com a gente?" variant="soft" icon="phone">
          <p class="today-phone">{{ phone }}</p>
          <button cgCardFooter type="button" class="btn" (click)="contact.open()">Como falar com a gente</button>
        </app-cg-card>
      } @else {
        <div class="today-end">
          <p>Quer falar com a gente?</p>
          <button type="button" class="cg-link-btn" (click)="contact.open()">Como falar com a gente</button>
        </div>
      }
    }
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

  /** Canal preferido telefone ou pouca familiaridade digital: o fechamento é o cartão com o número em destaque (AC-CG-54). */
  protected prefersPhone(): boolean {
    return this.ctx.preferredChannel() === 'phone' || this.ctx.lowDigitalLiteracy();
  }

  /** Quem prefere telefone ou WhatsApp vê o cartão com o número no alto, logo depois da saudação (CXC-025). */
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
