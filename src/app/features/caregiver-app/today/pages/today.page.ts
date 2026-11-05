import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DoseCheckError, DoseCheckService } from '../../../../core/care/dose-check.service';
import { timeOf } from '../../../../core/clock/date-utils';
import { DoseSlot } from '../../../../core/rules/medication-doses';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { NEXUS_PHONE, PROTOTYPE_CALL_NOTICE } from '../../state/nexus-contact';
import { OnlineStatusService } from '../../state/online-status.service';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgDoseComponent } from '../../ui/cg-dose.component';
import { CgMoodComponent, MoodValue } from '../../ui/cg-mood.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { TODAY_DOSE_ROWS, TodayViewService } from '../state/today-view.service';

/**
 * Hoje (UX C4, `/cuidador/hoje`): o que importa hoje, sem painel. Ordem: saudação, nota de cuidado (só com contato
 * da equipe), próximo compromisso, remédios de hoje com "Dei", humor, "Para você" e "Falar com a gente".
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
    .today-block {
      display: grid;
      gap: 0.75rem;
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
    .today-doses {
      display: grid;
      gap: var(--cg-gap-stack);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .today-support {
      color: var(--cg-text-soft);
      font-size: var(--cg-fs-small);
    }
    .today-tag {
      padding: 0 0.5rem;
      border-radius: var(--cg-radius-pill);
      background: var(--brand-soft);
      color: var(--cg-heading);
      font-size: var(--cg-fs-caption);
      font-weight: var(--fw-semibold);
    }
    .today-phone {
      margin: 0;
      font-size: 1.75rem;
      font-weight: var(--fw-semibold);
      font-variant-numeric: tabular-nums;
      color: var(--cg-heading);
    }
    .today-small {
      margin: 0;
      color: var(--cg-text-soft);
      font-size: var(--cg-fs-small);
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
        <app-cg-note variant="care" heading="A equipe de psicologia vai falar com você hoje.">
          Quer saber como você está e entra em contato pelo seu canal preferido. Você não precisa fazer nada.
          <button cgNoteActions type="button" class="cg-link-btn" (click)="contact.open()">Prefere falar agora?</button>
        </app-cg-note>
      } @else if (ctx.staffContact() === 'not_yet') {
        <app-cg-note variant="care" heading="A equipe ainda não conseguiu falar com você.">
          A responsável técnica foi avisada e vai procurar você. Se preferir não esperar, fale com a gente agora.
          <button cgNoteActions type="button" class="btn" (click)="contact.open()">Falar com a gente agora</button>
        </app-cg-note>
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
                @if (next.forYou) {
                  <span class="today-tag">Para você</span>
                }
              </app-cg-card>
            } @else {
              <app-cg-card title="Próximo compromisso" icon="calendar">
                <span>Nenhum compromisso nos próximos dias.</span>
                <a cgCardFooter class="cg-link-btn" routerLink="/cuidador/rotina/agenda" [queryParams]="{ novo: 1 }">Adicionar compromisso</a>
              </app-cg-card>
            }

            <section class="today-block" aria-labelledby="today-meds-title">
              <div class="today-head">
                <h2 class="cg-section__title" id="today-meds-title">Remédios de hoje</h2>
                @if (view.progress().total > 0) {
                  <span class="today-progress">{{ view.progress().given }} de {{ view.progress().total }} dados</span>
                }
              </div>
              @if (view.slots().length > 0) {
                <ul class="today-doses">
                  @for (slot of view.visibleSlots(); track slot.key) {
                    <li><app-cg-dose [slot]="slot" (dei)="dei($event)" (undo)="undo($event)" /></li>
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
            <section class="today-block" aria-labelledby="today-mood-title">
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

          @if (view.rate(); as rate) {
            <section class="today-block" aria-labelledby="today-foryou-title">
              <h2 class="cg-section__title" id="today-foryou-title">Para você</h2>
              <app-cg-card [title]="'Como foi o atendimento de ' + rate.providerName + '?'">
                <a cgCardFooter class="btn" routerLink="/cuidador/rede/pedidos" [queryParams]="{ avaliar: rate.requestId }">Avaliar</a>
              </app-cg-card>
            </section>
          } @else if (view.invite(); as invite) {
            <section class="today-block" aria-labelledby="today-foryou-title">
              <h2 class="cg-section__title" id="today-foryou-title">Para você</h2>
              <app-cg-card [title]="invite.title">
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

    @if (prefersPhone()) {
      <app-cg-card class="today-end" title="Prefere falar com a gente?" variant="soft" icon="phone">
        <p class="today-phone">{{ phone }}</p>
        <p class="today-small">{{ prototypeCall }}</p>
        <button cgCardFooter type="button" class="btn" (click)="contact.open()">Como falar com a gente</button>
      </app-cg-card>
    } @else {
      <div class="today-end">
        <p>Precisa de ajuda com o app ou com a sua conta?</p>
        <button type="button" class="cg-link-btn" (click)="contact.open()">Falar com a gente</button>
      </div>
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

  protected readonly doseRows = TODAY_DOSE_ROWS;
  protected readonly phone = NEXUS_PHONE;
  protected readonly prototypeCall = PROTOTYPE_CALL_NOTICE;
  /** "Mudar" abre de novo o seletor de humor. */
  protected readonly editingMood = signal(false);
  protected readonly moodError = signal<string | null>(null);

  /** Canal preferido telefone ou pouca familiaridade digital: o fechamento é o cartão com o número em destaque (AC-CG-54). */
  protected prefersPhone(): boolean {
    return this.ctx.preferredChannel() === 'phone' || this.ctx.caregiver()?.digitalLiteracy === 'low';
  }

  /** "Muito mal" ou "Mal": a nota acolhedora (UX C4, Humor). */
  protected hardDay(): boolean {
    const mood = this.view.todayMood()?.mood;
    return mood === 1 || mood === 2;
  }

  protected dei(slot: DoseSlot): void {
    try {
      const check = this.doses.mark(slot.medicationId, slot.date, slot.time);
      this.toasts.show({
        message: `Anotado às ${timeOf(check.givenAt)}.`,
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
