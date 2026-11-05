import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import type { Channel, Message } from '@core/models';
import { isMessageOverdue } from '@core/rules';
import { ShortcutService } from '@layout/shortcuts/shortcut.service';
import {
  DeadlineBadgeComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  FilterOption,
  IconComponent,
  PageHeaderComponent,
  SkeletonComponent,
  createListState,
  normalizeText,
  mediaQuery,
} from '@shared/ui';
import { filter } from 'rxjs';
import { ComplaintDrawerComponent, ComplaintPrefill } from '../components/complaint-drawer.component';
import { ContactDrawerComponent } from '../components/contact-drawer.component';
import { MessageDetailComponent } from '../components/message-detail.component';
import { MessagesService } from '../state/messages.service';
import {
  CHANNELS,
  CHANNEL_ICONS,
  CHANNEL_LABELS,
  HOURS_HELP,
  InboxSection,
  inboxSections,
  isHoliday,
  snippetOf,
} from '../state/message-view';
import { BannerComponent, DrawerComponent } from '@shared/ui/overlay';

const VIEWS = ['atrasadas', 'minhas', 'sem-resposta', 'sinalizadas'] as const;
type View = (typeof VIEWS)[number];

const PAGE_SIZE = 40;

/**
 * Caixa de entrada (SCR-M11-01, PD-02 e PD-05, F17): as quatro vias de contato com prazo em horas úteis.
 * Atrasadas SEMPRE primeiro, em seção própria e a mais atrasada no topo. Filtros e visões na URL
 * (`?filtro=atrasadas|minhas|sem-resposta|sinalizadas`, `?canal=whatsapp`); o texto da busca fica só na memória.
 * A mensagem abre numa gaveta acoplada (rota `:id`); abaixo de 1024 px ela ocupa a tela inteira.
 * Atalhos: `J` e `K` trocam de mensagem, `N` registra contato, `R` leva à resposta.
 */
@Component({
  selector: 'app-inbox-page',
  imports: [
    RouterLink,
    BannerComponent,
    DeadlineBadgeComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonComponent,
    ContactDrawerComponent,
    ComplaintDrawerComponent,
    MessageDetailComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Mensagens" [count]="countText()" description="Os quatro canais, com o prazo de cada um.">
        <a class="btn" routerLink="/app/mensagens/modelos" data-role="templates-link">Modelos de resposta</a>
        @if (canWrite()) {
          <button type="button" class="btn btn--primary" data-role="register-contact" (click)="openContact()">
            <svg appIcon="phone" size="sm"></svg>Registrar contato
          </button>
        }
      </app-page-header>

      @if (holiday()) {
        <app-banner variant="info" heading="Feriado nacional">O prazo só corre em dia útil.</app-banner>
      }

      @if (!ready()) {
        <div class="card card--pad stack stack--3" aria-busy="true" aria-label="Carregando as mensagens" data-role="loading">
          <app-skeleton variant="title" />
          <app-skeleton [lines]="5" />
        </div>
      } @else if (missing()) {
        <div class="card">
          <app-empty-state
            kind="error"
            title="Não encontramos esta mensagem"
            text="Ela pode ter sido movida ou não estar na sua caixa. Volte à lista para continuar."
          >
            <button type="button" class="btn" data-role="back-to-list" (click)="closeDetail()">Voltar à caixa</button>
          </app-empty-state>
        </div>
      } @else {
        <div [class.layout-list-detail]="detailOpen()" data-role="inbox-layout">
          <div class="stack stack--3" [hidden]="narrow() && detailOpen()" data-role="inbox-list">
            <div class="cluster">
              <div class="input-wrap flex-1">
                <svg appIcon="search"></svg>
                <input
                  class="input"
                  type="search"
                  autocomplete="off"
                  data-search-field
                  aria-label="Buscar na caixa"
                  placeholder="Buscar na caixa"
                  [value]="list.search()"
                  (input)="onSearch($event)"
                />
              </div>
            </div>
            <app-filter-chips label="Visão" [options]="viewOptions()" [value]="view()" allLabel="Todas" [allCount]="visible().length" (valueChange)="setView($event)" />
            <app-filter-chips label="Canal" [options]="channelOptions()" [value]="channel()" allLabel="Todos os canais" (valueChange)="list.setFilter('canal', $event)" />
            <details class="t-caption" data-role="hours-help">
              <summary>O que são horas úteis?</summary>
              {{ hoursHelp }}
            </details>

            @if (total() === 0) {
              <div class="card">
                @if (list.hasActive()) {
                  <app-empty-state
                    compact
                    title="Nenhuma mensagem encontrada"
                    text="Tire um filtro ou busque por outro nome."
                  >
                    <button type="button" class="btn" data-role="clear-filters" (click)="list.clear()">Limpar filtros</button>
                  </app-empty-state>
                } @else {
                  <app-empty-state
                    compact
                    title="Caixa em dia"
                    text="Nenhuma mensagem esperando resposta. Quando chegar uma, ela aparece aqui com o prazo."
                  >
                    @if (canWrite()) {
                      <button type="button" class="btn" (click)="openContact()">Registrar contato</button>
                    }
                  </app-empty-state>
                }
              </div>
            } @else {
              @for (section of shownSections(); track section.id) {
                @if (section.items.length > 0) {
                  <section [attr.aria-labelledby]="'inbox-' + section.id" [attr.data-section]="section.id">
                    <h2 class="t-h4 mb-2" [id]="'inbox-' + section.id">
                      {{ section.title }} ({{ sectionTotal(section.id) }})
                    </h2>
                    <div class="list-card">
                      @for (m of section.items; track m.id) {
                        <a
                          class="list-row"
                          data-role="row"
                          [class.list-row--unread]="m.status === 'new'"
                          [attr.data-id]="m.id"
                          [attr.aria-current]="m.id === selectedId() ? 'true' : null"
                          [routerLink]="['/app/mensagens', m.id]"
                          queryParamsHandling="preserve"
                          (click)="remember($event)"
                        >
                          <span class="avatar avatar--sm" aria-hidden="true">
                            <svg [appIcon]="channelIcon(m.channel)" size="sm"></svg>
                          </span>
                          <span class="list-row__main">
                            <span class="list-row__title">
                              <span class="discreet">{{ contactLabel(m) }}</span>
                              @if (m.riskFlag) {
                                <span class="sr-only"> (risco sinalizado)</span>
                              }
                            </span>
                            <span class="list-row__meta">
                              {{ channelLabel(m.channel) }} · {{ snippet(m) }}
                            </span>
                          </span>
                          <app-deadline-badge tabindex="-1" [due]="m.dueAt" [done]="m.status === 'answered'" />
                        </a>
                      }
                    </div>
                  </section>
                }
              }
              @if (hasMore()) {
                <button type="button" class="btn" data-role="load-more" (click)="limit.set(limit() + 25)">
                  Carregar mais 25
                </button>
              }
            }
          </div>

          <app-drawer
            [docked]="true"
            [open]="detailOpen()"
            [heading]="detailHeading()"
            [subtitle]="detailSubtitle()"
            [returnFocusTo]="opener()"
            (closed)="closeDetail()"
          >
            @if (selected(); as message) {
              <app-message-detail
                [message]="message"
                [position]="position()"
                (closed)="closeDetail()"
                (previous)="move(-1)"
                (next)="move(1)"
                (complaintRequested)="startComplaint($event)"
              />
            }
          </app-drawer>
        </div>
      }
    </div>

    <app-contact-drawer [(open)]="contactOpen" />
    <app-complaint-drawer [(open)]="complaintOpen" [prefill]="complaintPrefill()" />
  `,
})
export class InboxPage {
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly service = inject(MessagesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly shortcuts = inject(ShortcutService);
  private readonly doc = inject(DOCUMENT);

  readonly list = createListState({ key: 'messages', filterKeys: ['filtro', 'canal'] });

  protected readonly detail = viewChild(MessageDetailComponent);
  protected readonly hoursHelp = HOURS_HELP;
  protected readonly narrow = mediaQuery('(max-width: 1023.98px)');
  protected readonly ready = signal(false);
  protected readonly limit = signal(PAGE_SIZE);
  protected readonly contactOpen = signal(false);
  protected readonly complaintOpen = signal(false);
  protected readonly complaintPrefill = signal<ComplaintPrefill | null>(null);
  protected readonly opener = signal<HTMLElement | null>(null);
  protected readonly selectedId = signal<string | null>(
    this.route.snapshot.firstChild?.paramMap.get('id') ?? null,
  );

  protected readonly canWrite = computed(() => this.auth.can('message_inbox', 'update'));
  protected readonly holiday = computed(() => isHoliday(this.clock.today()));

  /** Tudo o que o perfil pode ver na caixa (psicólogo só dos seus; RT só os casos de risco). */
  protected readonly visible = computed(() => {
    const role = this.auth.role();
    return role ? this.service.visibleTo(role, this.auth.user()?.psychologistId) : [];
  });

  protected readonly view = computed<View | null>(() => {
    const raw = this.list.filters()['filtro'];
    return VIEWS.find((v) => v === raw) ?? null;
  });
  protected readonly channel = computed<string | null>(() => {
    const raw = this.list.filters()['canal'];
    return CHANNELS.find((c) => c === raw) ?? null;
  });

  private matchesView(m: Message, view: View | null): boolean {
    const now = this.clock.now();
    switch (view) {
      case 'atrasadas':
        return isMessageOverdue(m, now);
      case 'minhas':
        return m.assignedToUserId === this.auth.user()?.id;
      case 'sem-resposta':
        return m.status !== 'answered';
      case 'sinalizadas':
        return m.riskFlag === true;
      default:
        return true;
    }
  }

  protected readonly viewOptions = computed<FilterOption[]>(() => {
    const all = this.visible();
    const count = (v: View): number => all.filter((m) => this.matchesView(m, v)).length;
    return [
      { value: 'atrasadas', label: 'Atrasadas', count: count('atrasadas') },
      { value: 'minhas', label: 'Minhas', count: count('minhas') },
      { value: 'sem-resposta', label: 'Sem resposta', count: count('sem-resposta') },
      { value: 'sinalizadas', label: 'Sinalizadas', count: count('sinalizadas') },
    ];
  });

  protected readonly channelOptions = computed<FilterOption[]>(() =>
    CHANNELS.map((c) => ({
      value: c,
      label: CHANNEL_LABELS[c],
      count: this.visible().filter((m) => m.channel === c).length,
    })),
  );

  protected readonly filtered = computed(() => {
    const view = this.view();
    const channel = this.channel();
    const term = normalizeText(this.list.search());
    const hideBody = this.auth.role() === 'partner';
    return this.visible().filter((m) => {
      if (!this.matchesView(m, view) || (channel && m.channel !== channel)) {
        return false;
      }
      if (!term) {
        return true;
      }
      const text = `${this.contactLabel(m)} ${m.subject ?? ''} ${hideBody && m.caregiverId ? '' : m.body}`;
      return normalizeText(text).includes(term);
    });
  });

  protected readonly sections = computed<InboxSection[]>(() => inboxSections(this.filtered(), this.clock.now()));
  protected readonly ordered = computed(() => this.sections().flatMap((s) => s.items));
  protected readonly total = computed(() => this.ordered().length);
  protected readonly hasMore = computed(() => this.total() > this.limit());

  /** As seções cortadas no limite "Carregar mais", mantendo a ordem. */
  protected readonly shownSections = computed<InboxSection[]>(() => {
    let left = this.limit();
    return this.sections().map((s) => {
      const items = s.items.slice(0, Math.max(0, left));
      left -= items.length;
      return { ...s, items };
    });
  });

  protected readonly countText = computed(() => {
    const total = this.visible().length;
    const overdue = this.visible().filter((m) => isMessageOverdue(m, this.clock.now())).length;
    return `${total} ${total === 1 ? 'mensagem' : 'mensagens'}${overdue > 0 ? `, ${overdue} ${overdue === 1 ? 'atrasada' : 'atrasadas'}` : ''}`;
  });

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? this.visible().find((m) => m.id === id) : undefined;
  });
  protected readonly missing = computed(() => this.selectedId() !== null && this.selected() === undefined);
  protected readonly detailOpen = computed(() => this.selected() !== undefined);
  protected readonly detailHeading = computed(() => {
    const m = this.selected();
    return m ? this.contactLabel(m) : 'Mensagem';
  });
  protected readonly detailSubtitle = computed(() => {
    const m = this.selected();
    return m ? CHANNEL_LABELS[m.channel] : '';
  });
  protected readonly position = computed(() => {
    const id = this.selectedId();
    return { index: this.ordered().findIndex((m) => m.id === id), total: this.ordered().length };
  });

  constructor() {
    afterNextRender(() => this.ready.set(true), { injector: this.injector });

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.selectedId.set(this.route.snapshot.firstChild?.paramMap.get('id') ?? null));

    // `?acao=registrar-contato` vem da paleta de comandos: abre o formulário e limpa o parâmetro.
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      if (params.get('acao') === 'registrar-contato') {
        if (this.canWrite()) {
          this.contactOpen.set(true);
        }
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { acao: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });

    this.shortcuts.page$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(({ id, event }) => {
      if (id === 'list-next' || id === 'list-previous') {
        event.preventDefault();
        this.move(id === 'list-next' ? 1 : -1);
      } else if (id === 'list-new' && this.canWrite()) {
        event.preventDefault();
        this.openContact();
      } else if (id === 'message-reply') {
        const box = this.detail();
        if (box) {
          event.preventDefault();
          box.focusReply();
        }
      }
    });
  }

  protected contactLabel(m: Message): string {
    return this.service.contactOf(m, this.auth.role()).label;
  }

  protected channelLabel(c: Channel): string {
    return CHANNEL_LABELS[c];
  }

  protected channelIcon(c: Channel) {
    return CHANNEL_ICONS[c];
  }

  protected snippet(m: Message): string {
    const hidden = this.auth.role() === 'partner' && m.caregiverId !== undefined;
    if (hidden) {
      return m.subject ?? 'Texto oculto: pode identificar o titular.';
    }
    return m.subject ? `${m.subject}: ${snippetOf(m.body, 70)}` : snippetOf(m.body);
  }

  protected sectionTotal(id: InboxSection['id']): number {
    return this.sections().find((s) => s.id === id)?.items.length ?? 0;
  }

  protected onSearch(event: Event): void {
    this.list.search.set((event.target as HTMLInputElement).value);
    this.limit.set(PAGE_SIZE);
  }

  protected setView(value: string | null): void {
    this.list.setFilter('filtro', value);
  }

  protected remember(event: Event): void {
    this.opener.set(event.currentTarget instanceof HTMLElement ? event.currentTarget : null);
  }

  protected openContact(): void {
    this.contactOpen.set(true);
  }

  protected startComplaint(message: Message): void {
    this.complaintPrefill.set({
      channel: message.channel,
      ...(message.caregiverId ? { caregiverId: message.caregiverId } : {}),
      description: this.auth.role() === 'partner' ? '' : message.body,
    });
    this.complaintOpen.set(true);
  }

  protected closeDetail(): void {
    void this.router.navigate(['/app/mensagens'], { queryParamsHandling: 'preserve' }).then(() => {
      afterNextRender(() => this.opener()?.focus(), { injector: this.injector });
    });
  }

  /** `J` e `K` e as setas da gaveta: troca de mensagem sem voltar à lista. */
  protected move(delta: 1 | -1): void {
    const items = this.ordered();
    if (items.length === 0) {
      return;
    }
    const current = items.findIndex((m) => m.id === this.selectedId());
    const target = items[current === -1 ? (delta === 1 ? 0 : items.length - 1) : current + delta];
    if (!target) {
      return;
    }
    void this.router.navigate(['/app/mensagens', target.id], { queryParamsHandling: 'preserve' }).then(() => {
      afterNextRender(
        () => this.doc.querySelector<HTMLElement>(`[data-id="${target.id}"]`)?.focus(),
        { injector: this.injector },
      );
    });
  }
}
