import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Clock } from '../../../../core/clock/clock.service';
import { timeOf } from '../../../../core/clock/date-utils';
import { Database } from '../../../../core/data/database';
import { formatDate } from '../../../../core/format/format';
import { CaregiverActivitiesService, ActivityStanding } from '../../../../core/groups/caregiver-activities.service';
import { Activity, ActivityKind, ISODateTime } from '../../../../core/models';
import { PageChromeService } from '../../../../layout/state/page-chrome.service';
import { IconComponent, IconName } from '../../../../shared/ui/display/icon.component';
import { CheckboxComponent } from '../../../../shared/ui/forms/checkbox.component';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { relativeDateTime } from '../../state/day-format';
import { activityFormatLabel } from '../../state/format-labels';
import { CgEmptyComponent } from '../../ui/cg-empty.component';
import { CgEventBadgeComponent } from '../../ui/cg-event-badge.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CgIllustrationName } from '../../ui/cg-illustration.component';
import { CgNoteComponent, CgNoteVariant } from '../../ui/cg-note.component';
import { CgRowComponent } from '../../ui/cg-row.component';
import { CgSealComponent } from '../../ui/cg-seal.component';
import { CgSectionComponent } from '../../ui/cg-section.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import {
  CHARACTER_LABELS,
  CHARACTER_TEXT,
  KIND_LABELS,
  KIND_ORDER,
  KIND_SECTION_TITLES,
  KIND_TEXT,
  THEME_LABELS,
  leaderLine,
  offerLine,
  paidDetail,
  placeOf,
  roomAccessibility,
  seatsText,
} from '../state/group-copy';

/** O desenho e o ícone de cada tipo de encontro (a cor vem do selo do kit, `app-cg-event-badge`). */
const KIND_LOOK: Readonly<Record<ActivityKind, { icon: IconName; art: CgIllustrationName; rowIcon: IconName }>> = {
  open_circle: { icon: 'messages-square', art: 'chat', rowIcon: 'messages-square' },
  training: { icon: 'book-open', art: 'book', rowIcon: 'book-open' },
  group_therapy: { icon: 'heart-handshake', art: 'heart', rowIcon: 'heart-handshake' },
};

interface ActivityCard {
  id: string;
  kind: ActivityKind;
  title: string;
  look: (typeof KIND_LOOK)[ActivityKind];
  formatIcon: IconName;
  character: string;
  next: string;
  format: string;
  seats: string;
  /** "Incluída no seu plano", "R$ 40,00 por encontro" ou nada (roda aberta). */
  offer: string | null;
}

interface KindSection {
  kind: ActivityKind;
  title: string;
  cards: ActivityCard[];
}

interface MineRow {
  id: string;
  kind: ActivityKind;
  title: string;
  line: string;
}

interface ActivityDetail {
  activity: Activity;
  kind: string;
  look: (typeof KIND_LOOK)[ActivityKind];
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
  offer: string | null;
  paid: string | null;
}

interface Banner {
  variant: CgNoteVariant;
  text: string;
}

/**
 * Encontros (docs/20-regras-planos-v2.md; UX C10, `/cuidador/cuidar-de-mim/grupos`). A programação organizada por tipo, cada um
 * em uma seção com título, ícone e cor próprios, nesta ordem: Minhas inscrições, Rodas de conversa abertas, Capacitações e
 * Terapia de grupo. Filtro por tipo quando há mais de um. Cada cartão: o tipo (selo), data e hora, local (on-line ou coworking),
 * vagas ou "Lista de espera" e, na capacitação, "Incluída no seu plano" ou o valor avulso. O detalhe abre em folha de tela cheia
 * com `?atividade=` (S-21).
 *
 * - **Regra de exibição 2 do dono**: o que o plano não dá acesso NÃO aparece (nem como vitrine, nem com cadeado). Livre e
 *   Essencial veem rodas abertas e capacitações; Cuida e Sustenta veem tudo. A seção "Terapia de grupo" só existe para eles.
 * - A ação principal é **Quero participar**; ela abre a folha do contrato de sigilo (aceite com data e hora, RN-GRP-09). Lotado,
 *   vira **Entrar na lista de espera** (S-20: a posição é visível). A capacitação incluída e a terapia de grupo consomem a cota
 *   do mês; a avulsa diz o valor por encontro antes de entrar (pagamento simulado, sem campo de cartão).
 * - Nada aqui nasce de pontuação, faixa ou alerta, e nenhum texto promete resultado (RN-PLN-19).
 */
@Component({
  selector: 'app-cg-groups-page',
  imports: [RouterLink, IconComponent, CheckboxComponent, CgEmptyComponent, CgEventBadgeComponent, CgHeroComponent, CgNoteComponent, CgRowComponent, CgSealComponent, CgSectionComponent, CgSheetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .nx-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
      .nx-chip { min-block-size: var(--cg-target); padding: 0.375rem 1rem; border: 1px solid var(--cg-border); border-radius: var(--cg-radius-pill); background: var(--cg-surface); color: var(--cg-text); font: inherit; font-weight: var(--fw-semibold); cursor: pointer; }
      .nx-chip[aria-pressed='true'] { background: var(--cg-acc-solid); border-color: var(--cg-acc-solid); color: #ffffff; }
      .nx-cards { display: grid; gap: var(--cg-gap-stack); margin: 0; padding: 0; list-style: none; grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 64rem) { .nx-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .nx-cards .cg-card { height: 100%; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; column-gap: 0.75rem; row-gap: 0.5rem; align-items: center; align-content: start; }
      .nx-cards .cg-card__main { display: contents; }
      .nx-cards .cg-card__title { grid-column: 2; grid-row: 1; margin: 0; }
      .nx-cards .cg-card__text { grid-column: 1 / -1; }
      .nx-cards .cg-card__chevron { grid-column: 3; grid-row: 1; }
      .nx-cards .nx-kind { grid-column: 1; grid-row: 1; }
      .nx-kind { display: grid; place-items: center; flex: none; inline-size: 3rem; block-size: 3rem; border-radius: 50%; background: var(--cg-acc-strong); color: var(--cg-acc-ink); }
      [data-kind='open_circle'] .nx-kind { background: var(--cg-sec-rotina-strong); color: var(--cg-sec-rotina-ink); }
      [data-kind='training'] .nx-kind { background: var(--cg-sec-hoje-strong); color: var(--cg-sec-hoje-ink); }
      [data-kind='group_therapy'] .nx-kind { background: var(--cg-sec-cuidar-strong); color: var(--cg-sec-cuidar-ink); }
      .nx-meta { display: flex; align-items: center; gap: 0.5rem; margin: 0; color: var(--cg-text-soft); font-size: var(--cg-fs-small); line-height: 1.4; }
      .nx-meta .icon { flex: none; color: var(--cg-acc-ink); }
      .nx-offer { margin: 0; font-weight: var(--fw-semibold); color: var(--cg-heading); }
      .nx-facts { display: grid; gap: 1.25rem; margin: 0; }
      @media (min-width: 64rem) { .nx-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem 2rem; } }
      .nx-fact dt { display: flex; align-items: center; gap: 0.75rem; font-weight: var(--fw-semibold); color: var(--cg-heading); }
      .nx-fact dd { margin: 0.375rem 0 0; padding-inline-start: 2.75rem; }
      .nx-fact ul { margin: 0; padding-inline-start: 1.25rem; }
      .nx-fact__icon { display: grid; place-items: center; flex: none; inline-size: 2rem; block-size: 2rem; border-radius: 50%; background: var(--cg-acc-strong); color: var(--cg-acc-ink); }
      .nx-block { display: block; }
      .nx-stamp { margin: 0; color: var(--cg-ok-fg); font-weight: var(--fw-semibold); }
    `,
  ],
  template: `
    @if (detail(); as d) {
      <app-cg-hero [title]="d.activity.title" [illustration]="d.look.art" backLink="/cuidador/cuidar-de-mim/grupos" backLabel="Encontros" />
      <div class="cg-stack">
        @if (banner(); as b) {
          <app-cg-note [variant]="b.variant" data-role="result">{{ b.text }}</app-cg-note>
        }

        <div class="cg-stack cg-stack--tight">
          <p class="cg-tags">
            <app-cg-event-badge [type]="d.activity.kind" data-role="kind" />
            <app-cg-seal tone="neutral" data-role="character">{{ d.character }}</app-cg-seal>
          </p>
          <p>{{ d.about }}</p>
          <p data-role="character-text">{{ d.characterText }}</p>
          @if (d.offer; as offer) {
            <p class="nx-offer" data-role="offer">{{ offer }}</p>
          }
        </div>

        <dl class="nx-facts">
          <div class="nx-fact">
            <dt><span class="nx-fact__icon" aria-hidden="true"><svg appIcon="calendar-days" size="sm"></svg></span>Encontros</dt>
            <dd>
              <ul>
                @for (m of d.meetings; track m) {
                  <li>{{ m }}</li>
                }
              </ul>
            </dd>
          </div>
          <div class="nx-fact">
            <dt><span class="nx-fact__icon" aria-hidden="true"><svg [appIcon]="d.activity.mode === 'in_person' ? 'map-pin' : 'video'" size="sm"></svg></span>Onde</dt>
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
          <div class="nx-fact">
            <dt><span class="nx-fact__icon" aria-hidden="true"><svg appIcon="user-round" size="sm"></svg></span>Quem conduz</dt>
            <dd>
              @for (line of d.leaders; track line) {
                <span data-role="leader" class="nx-block">{{ line }}</span>
              }
            </dd>
          </div>
          <div class="nx-fact">
            <dt><span class="nx-fact__icon" aria-hidden="true"><svg appIcon="users" size="sm"></svg></span>Vagas</dt>
            <dd data-role="seats">{{ d.seats }}</dd>
          </div>
        </dl>

        @switch (d.standing.kind) {
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
        @if (d.paid; as paid) {
          <app-cg-note variant="soft" icon="info" data-role="paid">{{ paid }}</app-cg-note>
        } @else if (d.offer; as offer) {
          <p class="nx-offer" data-role="sheet-offer">{{ offer }}.</p>
        }
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
      <app-cg-hero title="Encontros" description="Rodas de conversa, capacitações e terapia de grupo." illustration="group" backLink="/cuidador/cuidar-de-mim" backLabel="Cuidar de mim" />

      @if (missing()) {
        <app-cg-note variant="soft" icon="info">
          Não encontramos este encontro.
          <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/cuidar-de-mim/grupos">Voltar</a>
        </app-cg-note>
      }

      @if (sections().length === 0 && mine().length === 0) {
        <app-cg-empty illustration="group" [headingLevel]="2" title="Ainda não há encontros neste mês" text="A programação é montada todo mês. Volte em breve." />
      } @else {
        @if (filterKinds().length > 1) {
          <ul class="nx-chips" data-role="filter" aria-label="Filtrar por tipo">
            <li><button type="button" class="nx-chip" [attr.aria-pressed]="filter() === null" (click)="filter.set(null)">Todos</button></li>
            @for (kind of filterKinds(); track kind) {
              <li><button type="button" class="nx-chip" [attr.aria-pressed]="filter() === kind" [attr.data-kind]="kind" (click)="filter.set(kind)">{{ kindLabel(kind) }}</button></li>
            }
          </ul>
        }

        @if (mine().length > 0 && filter() === null) {
          <app-cg-section class="cg-section" title="Minhas inscrições" [count]="mine().length" data-role="mine">
            <ul class="cg-list">
              @for (row of mine(); track row.id) {
                <li>
                  <app-cg-row [icon]="look(row.kind).rowIcon" [title]="row.title" [description]="row.line" (activated)="open(row.id)" />
                </li>
              }
            </ul>
          </app-cg-section>
        }

        @for (section of sections(); track section.kind) {
          <app-cg-section class="cg-section" [title]="section.title" [count]="section.cards.length" [attr.data-kind]="section.kind">
            <app-cg-event-badge cgSectionEnd [type]="section.kind" size="sm" />
            <ul class="nx-cards">
              @for (card of section.cards; track card.id) {
                <li>
                  <a class="cg-card cg-card--link" [routerLink]="[]" [queryParams]="{ atividade: card.id }" data-role="activity" [attr.data-kind]="card.kind">
                    <span class="nx-kind" aria-hidden="true"><svg [appIcon]="card.look.icon" size="lg"></svg></span>
                    <div class="cg-card__main">
                      <h3 class="cg-card__title">{{ card.title }}</h3>
                      <div class="cg-card__text">
                        <p class="cg-tags">
                          <app-cg-event-badge [type]="card.kind" size="sm" />
                          <app-cg-seal tone="neutral">{{ card.character }}</app-cg-seal>
                        </p>
                        <p class="nx-meta"><svg appIcon="calendar-days" size="sm"></svg>{{ card.next }}</p>
                        <p class="nx-meta"><svg [appIcon]="card.formatIcon" size="sm"></svg>{{ card.format }} · {{ card.seats }}</p>
                        @if (card.offer; as offer) {
                          <p class="nx-offer" data-role="card-offer">{{ offer }}</p>
                        }
                      </div>
                    </div>
                    <svg class="cg-card__chevron" appIcon="chevron-right"></svg>
                  </a>
                </li>
              }
            </ul>
          </app-cg-section>
        }
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
  private readonly activities = inject(CaregiverActivitiesService);
  protected readonly ctx = inject(CaregiverContextService);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly requestedId = computed(() => this.params().get('atividade'));

  /** O filtro por tipo (`null` = todos). */
  protected readonly filter = signal<ActivityKind | null>(null);

  protected look(kind: ActivityKind): (typeof KIND_LOOK)[ActivityKind] {
    return KIND_LOOK[kind];
  }

  protected kindLabel(kind: ActivityKind): string {
    return KIND_LABELS[kind];
  }

  // ===== Lista =====

  /** Os tipos que a pessoa pode ver (docs/20, regra 2), na ordem das seções. */
  private readonly visibleKinds = computed<ActivityKind[]>(() => {
    const id = this.ctx.caregiverId();
    return id ? KIND_ORDER.filter((kind) => this.activities.visibleKinds(id).includes(kind)) : [];
  });

  /** Os tipos com algum encontro na programação visível (o filtro só aparece com mais de um). */
  protected readonly filterKinds = computed<ActivityKind[]>(() => {
    const present = new Set(this.allCards().map((c) => c.kind));
    return KIND_ORDER.filter((kind) => present.has(kind));
  });

  private readonly allCards = computed<ActivityCard[]>(() => {
    const id = this.ctx.caregiverId();
    if (!id) {
      return [];
    }
    const today = this.clock.today();
    const planId = this.ctx.planId();
    const mineIds = new Set(this.mine().map((row) => row.id));
    return this.activities
      .visibleProgramme(id)
      .filter((a) => !mineIds.has(a.id))
      .map((a) => {
        const next = this.activities.nextMeeting(a);
        return {
          id: a.id,
          kind: a.kind,
          title: a.title,
          look: KIND_LOOK[a.kind],
          formatIcon: a.mode === 'in_person' ? 'map-pin' : 'video',
          character: CHARACTER_LABELS[a.character],
          next: next ? `Próximo encontro: ${relativeDateTime(next.startAt, today)}` : 'Sem encontros marcados',
          format: activityFormatLabel(a.mode),
          seats: a.status === 'in_progress' ? 'Em andamento' : seatsText(this.activities.seatsFree(a)),
          offer: offerLine(a.kind, this.activities.offerFor(id, a), planId),
        };
      });
  });

  /** As seções por tipo, na ordem do docs/20, só as que têm encontro e passam no filtro. */
  protected readonly sections = computed<KindSection[]>(() => {
    const cards = this.allCards();
    const filter = this.filter();
    return this.visibleKinds()
      .filter((kind) => filter === null || kind === filter)
      .map((kind) => ({ kind, title: KIND_SECTION_TITLES[kind], cards: cards.filter((c) => c.kind === kind) }))
      .filter((section) => section.cards.length > 0);
  });

  protected readonly mine = computed<MineRow[]>(() => {
    const id = this.ctx.caregiverId();
    const today = this.clock.today();
    return id
      ? this.activities.myEnrollments(id).map(({ activity, enrollment }) => {
          const next = this.activities.nextMeeting(activity);
          return {
            id: activity.id,
            kind: activity.kind,
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
    // O que o plano não dá acesso não existe para a pessoa, nem por endereço direto (docs/20, regra 2).
    const activity = requested && id ? this.activities.visibleTo(id, requested) : undefined;
    if (!activity || !id) {
      return null;
    }
    const today = this.clock.today();
    const room = activity.roomId ? this.db.rooms.get(activity.roomId) : undefined;
    const standing = this.activities.standingOf(id, activity);
    const offer = standing.kind === 'can_join' ? standing.offer : null;
    return {
      activity,
      kind: KIND_LABELS[activity.kind],
      look: KIND_LOOK[activity.kind],
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
      standing,
      place: placeOf(activity.kind),
      offer: offer ? offerLine(activity.kind, offer, this.ctx.planId()) : null,
      paid: offer ? paidDetail(activity.kind, offer) : null,
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
    // O foco vai ao título ao abrir e ao fechar o detalhe, e o aviso do resultado some ao trocar de encontro.
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
    this.chrome.focusHeading();
  }
}
