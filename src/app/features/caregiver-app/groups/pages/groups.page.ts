import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Clock } from '../../../../core/clock/clock.service';
import { timeOf } from '../../../../core/clock/date-utils';
import { Database } from '../../../../core/data/database';
import { formatDate } from '../../../../core/format/format';
import { CaregiverActivitiesService, ActivityStanding } from '../../../../core/groups/caregiver-activities.service';
import { Activity, ISODateTime } from '../../../../core/models';
import { PageChromeService } from '../../../../layout/state/page-chrome.service';
import { EmptyStateComponent } from '../../../../shared/ui/display/empty-state.component';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { CheckboxComponent } from '../../../../shared/ui/forms/checkbox.component';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { relativeDateTime } from '../../state/day-format';
import { activityFormatLabel } from '../../state/format-labels';
import { CgNoteComponent, CgNoteVariant } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgPlanLockComponent } from '../../ui/cg-plan-lock.component';
import { CgRowComponent } from '../../ui/cg-row.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import {
  CHARACTER_LABELS,
  CHARACTER_TEXT,
  KIND_LABELS,
  KIND_TEXT,
  THEME_LABELS,
  leaderLine,
  placeOf,
  roomAccessibility,
  seatsText,
} from '../state/group-copy';

interface ActivityCard {
  id: string;
  title: string;
  kind: string;
  character: string;
  next: string;
  format: string;
  seats: string;
}

interface MineRow {
  id: string;
  title: string;
  line: string;
}

interface ActivityDetail {
  activity: Activity;
  kind: string;
  character: string;
  characterText: string;
  about: string;
  theme: string;
  meetings: string[];
  format: string;
  room: { name: string; address: string; access: string } | null;
  partnerOrg: string | null;
  leaders: string[];
  seats: string;
  standing: ActivityStanding;
  place: ReturnType<typeof placeOf>;
}

interface Banner {
  variant: CgNoteVariant;
  text: string;
}

/**
 * Grupos e capacitações (UX C10, `/cuidador/cuidar-de-mim/grupos`). A programação do mês em cartões (tipo, caráter,
 * próximo encontro, formato e vagas), "Minhas inscrições" quando houver, e o detalhe em folha de tela cheia com
 * `?atividade=` (S-21). A ação principal é **Quero participar**; ela abre a folha do contrato de sigilo (aceite com
 * data e hora, RN-GRP-09). Lotada, vira **Entrar na lista de espera** (S-20: a posição é visível). Grupo de apoio e
 * capacitação são do plano Cuida em diante e aparecem com o bloqueio calmo, IGUAL para todo o mesmo plano, no lugar da
 * ação; as rodas abertas valem para todos. Terapia de grupo só com a indicação do psicólogo, sem dizer o motivo
 * clínico (RN-GRP-14). Nada aqui nasce de pontuação, faixa ou alerta, e nenhum texto promete resultado (RN-PLN-19).
 */
@Component({
  selector: 'app-cg-groups-page',
  imports: [
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    CheckboxComponent,
    CgPageHeaderComponent,
    CgNoteComponent,
    CgPlanLockComponent,
    CgRowComponent,
    CgSheetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .nx-tag { display: inline-flex; align-items: center; min-height: 1.75rem; padding: 0 0.625rem; border-radius: var(--cg-radius-pill); background: var(--brand-soft); color: var(--cg-heading); font-size: var(--cg-fs-caption); font-weight: var(--fw-semibold); }
      .nx-tag--soft { background: var(--cg-surface-sunken); color: var(--cg-text); }
      .nx-cards { display: grid; gap: var(--cg-gap-stack); margin: 0; padding: 0; list-style: none; grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 64rem) { .nx-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .nx-cards .cg-card { height: 100%; }
      .nx-dl { display: grid; gap: 1rem; margin: 0; }
      .nx-dl dt { font-weight: var(--fw-semibold); color: var(--cg-heading); }
      .nx-dl dd { margin: 0.25rem 0 0; }
      .nx-dl ul { margin: 0; padding-inline-start: 1.25rem; }
      .nx-block { display: block; }
      .nx-stamp { margin: 0; color: var(--cg-ok-fg); font-weight: var(--fw-semibold); }
    `,
  ],
  template: `
    @if (detail(); as d) {
      <app-cg-page-header [title]="d.activity.title" backLink="/cuidador/cuidar-de-mim/grupos" backLabel="Grupos e capacitações" />
      <div class="cg-stack">
        @if (banner(); as b) {
          <app-cg-note [variant]="b.variant" data-role="result">{{ b.text }}</app-cg-note>
        }

        <div class="cg-stack cg-stack--tight">
          <p class="cg-tags">
            <span class="nx-tag" data-role="kind">{{ d.kind }}</span>
            <span class="nx-tag nx-tag--soft" data-role="character">{{ d.character }}</span>
          </p>
          <p>{{ d.about }}</p>
          <p data-role="character-text">{{ d.characterText }}</p>
        </div>

        <dl class="nx-dl">
          <div>
            <dt>Encontros</dt>
            <dd>
              <ul>
                @for (m of d.meetings; track m) {
                  <li>{{ m }}</li>
                }
              </ul>
            </dd>
          </div>
          <div>
            <dt>Onde</dt>
            <dd data-role="where">
              {{ d.format }}
              @if (d.room; as room) {
                <br />{{ room.name }}, {{ room.address }}.
                @if (room.access) {
                  <br /><span data-role="room-access">{{ room.access }}</span>
                }
              }
              @if (d.partnerOrg) {
                <br />Em parceria com {{ d.partnerOrg }}.
              }
            </dd>
          </div>
          <div>
            <dt>Quem conduz</dt>
            <dd>
              @for (line of d.leaders; track line) {
                <span data-role="leader" class="nx-block">{{ line }}</span>
              }
            </dd>
          </div>
          <div>
            <dt>Vagas</dt>
            <dd data-role="seats">{{ d.seats }}</dd>
          </div>
        </dl>

        @switch (d.standing.kind) {
          @case ('plan_locked') {
            <app-cg-plan-lock feature="groups" description="Grupos de apoio e capacitações fazem parte do plano Cuida.">
              As rodas de conversa abertas são para todos.
            </app-cg-plan-lock>
          }
          @case ('enrolled') {
            <app-cg-note variant="ok" data-role="standing">
              Você está {{ d.place.inside }}.
              <button cgNoteActions type="button" class="cg-link-btn" (click)="leaveOpen.set(true)">{{ d.place.leave }}</button>
            </app-cg-note>
          }
          @case ('waitlist') {
            <app-cg-note variant="soft" icon="hourglass" data-role="standing">
              Você está na lista de espera, posição {{ waitlistPosition() }}. Avisamos quando abrir uma vaga.
              <button cgNoteActions type="button" class="cg-link-btn" (click)="leaveOpen.set(true)">Sair da lista</button>
            </app-cg-note>
          }
          @case ('in_progress') {
            <app-cg-note variant="soft" data-role="standing">Em andamento. As inscrições estão encerradas.</app-cg-note>
          }
          @case ('needs_indication') {
            <app-cg-note variant="soft" icon="info" data-role="standing">
              Esta atividade começa com a indicação do seu psicólogo. Fale com a gente.
              <button cgNoteActions type="button" class="cg-link-btn" (click)="talk()">Falar com a gente</button>
            </app-cg-note>
          }
          @case ('can_join') {
            <div class="cg-action-bar">
              <button type="button" class="btn btn--primary" data-role="join" (click)="openJoin()">
                {{ canJoinFull() ? 'Entrar na lista de espera' : 'Quero participar' }}
              </button>
            </div>
          }
        }
      </div>

      <app-cg-sheet heading="Contrato de sigilo do grupo" [(open)]="joinOpen">
        <p data-role="confidentiality">{{ d.activity.confidentialityText }}</p>
        @if (canJoinFull()) {
          <app-cg-note variant="soft" icon="hourglass" data-role="queue">
            Você entra na posição {{ joinPosition() }}. Se abrir uma vaga, você entra automaticamente e a gente avisa.
          </app-cg-note>
        }
        <app-checkbox [checked]="accepted()" (checkedChange)="onAccept($event)">
          Li e aceito o contrato de sigilo do grupo
        </app-checkbox>
        @if (acceptedAt(); as stamp) {
          <p class="nx-stamp" data-role="stamp">{{ stampText(stamp) }}</p>
        }
        @if (joinError(); as error) {
          <app-cg-note variant="error" data-role="join-error">{{ error }}</app-cg-note>
        }
        <ng-container cgSheetActions>
          <button type="button" class="btn btn--primary" data-role="confirm-join" (click)="confirmJoin(d.activity)">
            {{ canJoinFull() ? 'Entrar na lista de espera' : d.place.enter }}
          </button>
          <button type="button" class="cg-link-btn" (click)="closeJoin()">Voltar</button>
        </ng-container>
      </app-cg-sheet>

      <app-cg-sheet [heading]="d.standing.kind === 'waitlist' ? 'Sair da lista de espera?' : d.place.leave + '?'" [(open)]="leaveOpen" initialFocus="safe-action">
        @if (d.standing.kind === 'waitlist') {
          <p>Você sai da lista de espera. Você pode entrar de novo quando quiser.</p>
        } @else {
          <p>Você deixa de participar. A sua vaga volta para outra pessoa.</p>
        }
        <ng-container cgSheetActions>
          <button type="button" class="btn btn--danger-quiet" data-role="confirm-leave" (click)="confirmLeave(d.activity)">
            {{ d.standing.kind === 'waitlist' ? 'Sair da lista' : d.place.leave }}
          </button>
          <button type="button" class="cg-link-btn" (click)="leaveOpen.set(false)">Voltar</button>
        </ng-container>
      </app-cg-sheet>
    } @else {
      <app-cg-page-header title="Grupos e capacitações" description="A programação do mês." backLink="/cuidador/cuidar-de-mim" backLabel="Cuidar de mim" />

      @if (missing()) {
        <app-cg-note variant="soft" icon="info">
          Não encontramos esta atividade.
          <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/cuidar-de-mim/grupos">Voltar</a>
        </app-cg-note>
      }

      @if (cards().length === 0) {
        <app-empty-state title="Ainda não há grupos neste mês" text="A programação é montada todo mês. Volte em breve." />
      } @else {
        @if (mine().length > 0) {
          <section class="cg-section" aria-labelledby="groups-mine">
            <h2 class="cg-section__title" id="groups-mine">Minhas inscrições</h2>
            <ul class="cg-list">
              @for (row of mine(); track row.id) {
                <li>
                  <app-cg-row icon="users-round" [title]="row.title" [description]="row.line" (activated)="open(row.id)" />
                </li>
              }
            </ul>
          </section>
        }

        <section class="cg-section" aria-labelledby="groups-all">
          <h2 class="cg-section__title" id="groups-all">Programação</h2>
          <ul class="nx-cards">
            @for (card of cards(); track card.id) {
              <li>
                <a class="cg-card cg-card--link" [routerLink]="[]" [queryParams]="{ atividade: card.id }" data-role="activity">
                  <div class="cg-card__main">
                    <h3 class="cg-card__title">{{ card.title }}</h3>
                    <div class="cg-card__text">
                      <p class="cg-tags">
                        <span class="nx-tag">{{ card.kind }}</span>
                        <span class="nx-tag nx-tag--soft">{{ card.character }}</span>
                      </p>
                      <p class="cg-meta">{{ card.next }}</p>
                      <p class="cg-meta">{{ card.format }} · {{ card.seats }}</p>
                    </div>
                  </div>
                  <svg class="cg-card__chevron" appIcon="chevron-right"></svg>
                </a>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
})
export class GroupsPage {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly chrome = inject(PageChromeService);
  private readonly toast = inject(ToastService);
  private readonly contact = inject(ContactDialogService);
  private readonly activities = inject(CaregiverActivitiesService);
  protected readonly ctx = inject(CaregiverContextService);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly requestedId = computed(() => this.params().get('atividade'));

  // ===== Lista =====

  protected readonly cards = computed<ActivityCard[]>(() => {
    const today = this.clock.today();
    return this.activities.programme().map((a) => {
      const next = this.activities.nextMeeting(a);
      return {
        id: a.id,
        title: a.title,
        kind: KIND_LABELS[a.kind],
        character: CHARACTER_LABELS[a.character],
        next: next ? `Próximo encontro: ${relativeDateTime(next.startAt, today)}` : 'Sem encontros marcados',
        format: activityFormatLabel(a.mode),
        seats: a.status === 'in_progress' ? 'Em andamento' : seatsText(this.activities.seatsFree(a)),
      };
    });
  });

  protected readonly mine = computed<MineRow[]>(() => {
    const id = this.ctx.caregiverId();
    const today = this.clock.today();
    return id
      ? this.activities.myEnrollments(id).map(({ activity, enrollment }) => {
          const next = this.activities.nextMeeting(activity);
          return {
            id: activity.id,
            title: activity.title,
            line:
              enrollment.status === 'waitlist'
                ? `Você está na lista de espera, posição ${enrollment.waitlistPosition ?? 1}.`
                : next
                  ? `Próximo encontro: ${relativeDateTime(next.startAt, today)}`
                  : 'Sem encontros marcados',
          };
        })
      : [];
  });

  // ===== Detalhe =====

  protected readonly detail = computed<ActivityDetail | null>(() => {
    const requested = this.requestedId();
    const id = this.ctx.caregiverId();
    const activity = requested ? this.activities.visible(requested) : undefined;
    if (!activity || !id) {
      return null;
    }
    const today = this.clock.today();
    const room = activity.roomId ? this.db.rooms.get(activity.roomId) : undefined;
    return {
      activity,
      kind: KIND_LABELS[activity.kind],
      character: CHARACTER_LABELS[activity.character],
      characterText: CHARACTER_TEXT[activity.character],
      about: KIND_TEXT[activity.kind],
      theme: THEME_LABELS[activity.theme],
      meetings: [...activity.meetings]
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .map((m) => relativeDateTime(m.startAt, today)),
      format: activityFormatLabel(activity.mode),
      room:
        activity.mode === 'in_person' && room
          ? { name: room.name, address: room.address, access: roomAccessibility(room) }
          : null,
      partnerOrg: activity.partnerOrg ?? null,
      leaders: activity.leaders.map(leaderLine),
      seats: activity.status === 'in_progress' ? 'Em andamento' : seatsText(this.activities.seatsFree(activity)),
      standing: this.activities.standingOf(id, activity),
      place: placeOf(activity.kind),
    };
  });
  protected readonly missing = computed(() => !!this.requestedId() && this.detail() === null);

  protected readonly canJoinFull = computed(() => {
    const standing = this.detail()?.standing;
    return standing?.kind === 'can_join' && standing.full;
  });
  protected readonly joinPosition = computed(() => {
    const standing = this.detail()?.standing;
    return standing?.kind === 'can_join' ? standing.position : null;
  });
  protected readonly waitlistPosition = computed(() => {
    const standing = this.detail()?.standing;
    return standing?.kind === 'waitlist' ? standing.position : null;
  });

  // ===== Estado das folhas =====

  protected readonly joinOpen = signal(false);
  protected readonly leaveOpen = signal(false);
  protected readonly accepted = signal(false);
  protected readonly acceptedAt = signal<ISODateTime | null>(null);
  protected readonly joinError = signal<string | null>(null);
  protected readonly banner = signal<Banner | null>(null);

  private lastShown: string | null = null;

  constructor() {
    // O foco vai ao título ao abrir e ao fechar o detalhe, e o aviso do resultado some ao trocar de atividade.
    effect(() => {
      const current = this.detail()?.activity.id ?? (this.missing() ? 'missing' : null);
      untracked(() => {
        if (current !== this.lastShown) {
          if (this.lastShown !== null || current !== null) {
            this.chrome.focusHeading();
          }
          this.banner.set(null);
          this.resetJoin();
          this.joinOpen.set(false);
          this.leaveOpen.set(false);
        }
        this.lastShown = current;
      });
    });
  }

  protected open(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { atividade: id }, queryParamsHandling: 'merge' });
  }

  protected talk(): void {
    this.contact.open();
  }

  // ===== Entrar =====

  protected openJoin(): void {
    this.resetJoin();
    this.joinOpen.set(true);
  }

  protected closeJoin(): void {
    this.joinOpen.set(false);
    this.resetJoin();
  }

  private resetJoin(): void {
    this.accepted.set(false);
    this.acceptedAt.set(null);
    this.joinError.set(null);
  }

  protected onAccept(checked: boolean): void {
    this.accepted.set(checked);
    this.acceptedAt.set(checked ? this.clock.now() : null);
    if (checked) {
      this.joinError.set(null);
    }
  }

  /** "Aceito em 04/11/2026, às 09:42". */
  protected stampText(at: ISODateTime): string {
    return `Aceito em ${formatDate(at)}, às ${timeOf(at)}`;
  }

  protected confirmJoin(activity: Activity): void {
    const caregiverId = this.ctx.requireCaregiverId();
    const outcome = this.activities.enroll(caregiverId, activity.id, {
      contractAccepted: this.accepted(),
      ...(this.acceptedAt() ? { acceptedAt: this.acceptedAt() as ISODateTime } : {}),
    });
    if (!outcome.ok) {
      this.joinError.set(outcome.error);
      return;
    }
    const place = placeOf(activity.kind);
    const next = this.activities.nextMeeting(activity);
    const message = outcome.waitlisted
      ? `Você entrou na lista de espera, posição ${outcome.position ?? 1}.`
      : `Você está ${place.inside} ${activity.title}.${next ? ` Primeiro encontro: ${relativeDateTime(next.startAt, this.clock.today())}.` : ''}`;
    this.joinOpen.set(false);
    this.resetJoin();
    this.banner.set({ variant: 'ok', text: message });
    this.toast.show({ message, durationMs: 8000 });
    this.chrome.focusHeading();
  }

  // ===== Sair =====

  protected confirmLeave(activity: Activity): void {
    const caregiverId = this.ctx.requireCaregiverId();
    const standing = this.activities.standingOf(caregiverId, activity);
    if (standing.kind !== 'enrolled' && standing.kind !== 'waitlist') {
      this.leaveOpen.set(false);
      return;
    }
    const wasWaiting = standing.kind === 'waitlist';
    const outcome = this.activities.leave(caregiverId, standing.enrollment.id);
    this.leaveOpen.set(false);
    if (!outcome.ok) {
      this.banner.set({ variant: 'error', text: 'Não foi possível sair agora. Nada foi alterado. Tente de novo.' });
      return;
    }
    const message = wasWaiting
      ? 'Você saiu da lista de espera.'
      : `Você ${placeOf(activity.kind).left}. A sua vaga voltou para outra pessoa.`;
    this.banner.set({ variant: 'soft', text: message });
    this.toast.show({ message, durationMs: 8000 });
    this.chrome.focusHeading();
  }
}
