import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { RelativeTimePipe } from '../../core/format/pipes';
import {
  NotificationItem,
  NotificationService,
} from '../../core/notifications/notification.service';
import { IconComponent } from '../../shared/ui/display/icon.component';

/**
 * Sino de notificações com contador e painel (SCR-M02-03, UX 3.6).
 *
 * - O sino mostra o número de pendências não vistas, com texto para leitor de tela ("3 notificações não
 *   vistas"). Nunca pisca nem toca.
 * - O painel (popover de 22,5 rem; página inteira no celular) tem os grupos "Precisa de ação hoje",
 *   "Para acompanhar" e "Vistas" (recolhido). O foco entra no painel ao abrir e volta ao sino ao fechar.
 * - Cada item: ícone de estado, título que descreve a TAREFA, contexto curto e quando. Clicar abre a tela com
 *   o filtro aplicado e marca como vista; "Marcar como vista" e "Marcar todas como vistas" também existem.
 * - O texto nunca traz escore, faixa nem condição (U-03).
 */
@Component({
  selector: 'app-notification-bell',
  imports: [IconComponent, NgTemplateOutlet, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'menu-anchor',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    <button
      #trigger
      type="button"
      class="btn btn--ghost btn--icon topbar__bell"
      aria-haspopup="dialog"
      aria-controls="nx-notification-panel"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="bellLabel()"
      (click)="toggle()"
    >
      <svg appIcon="bell"></svg>
      @if (unread() > 0) {
        <span class="nav-item__badge topbar__badge" aria-hidden="true">{{ unread() }}</span>
      }
    </button>
    <p class="sr-only" role="status" aria-live="polite">{{ notifications.announcement() }}</p>

    @if (open()) {
      <div
        class="popover popover--panel"
        id="nx-notification-panel"
        role="dialog"
        aria-labelledby="nx-notification-title"
      >
        <div class="popover__header">
          <h3 id="nx-notification-title" tabindex="-1" #heading>Notificações</h3>
          @if (unread() > 0) {
            <button type="button" class="btn btn--sm btn--ghost" (click)="markAll()">
              Marcar todas como vistas
            </button>
          }
        </div>
        <div class="popover__body popover__body--flush">
          @if (notifications.items().length === 0) {
            <div class="empty empty--compact">
              <svg
                class="empty__art"
                viewBox="-18 3 156 98"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <use href="icons/sprite.svg#nx-hands" />
              </svg>
              <h4 class="empty__title">Nenhuma pendência</h4>
              <p class="empty__text">Quando algo precisar de você, aparece aqui com o prazo.</p>
            </div>
          }
          @if (todayItems().length > 0) {
            <section aria-labelledby="nx-notif-today">
              <h4 class="popover__group" id="nx-notif-today">Precisa de ação hoje</h4>
              <div role="list">
                @for (item of todayItems(); track item.key) {
                  <ng-container
                    [ngTemplateOutlet]="row"
                    [ngTemplateOutletContext]="{ $implicit: item }"
                  />
                }
              </div>
            </section>
          }
          @if (followItems().length > 0) {
            <section aria-labelledby="nx-notif-follow">
              <h4 class="popover__group" id="nx-notif-follow">Para acompanhar</h4>
              <div role="list">
                @for (item of followItems(); track item.key) {
                  <ng-container
                    [ngTemplateOutlet]="row"
                    [ngTemplateOutletContext]="{ $implicit: item }"
                  />
                }
              </div>
            </section>
          }
          @if (seenItems().length > 0) {
            <details class="popover__seen">
              <summary>Vistas ({{ seenItems().length }})</summary>
              <div role="list">
                @for (item of seenItems(); track item.key) {
                  <ng-container
                    [ngTemplateOutlet]="row"
                    [ngTemplateOutletContext]="{ $implicit: item }"
                  />
                }
              </div>
            </details>
          }
        </div>
      </div>
    }

    <ng-template #row let-item>
      <div class="list-row" [class.list-row--unread]="!item.seen" role="listitem">
        <span
          class="avatar avatar--sm"
          [class.avatar--danger]="item.severity === 'danger'"
          [class.avatar--attention]="item.severity === 'attention'"
        >
          <svg [appIcon]="item.icon" size="sm"></svg>
        </span>
        <button type="button" class="list-row__main" (click)="openItem(item)">
          <span class="list-row__title">{{ item.title }}</span>
          <span class="list-row__meta">{{ item.context }} · {{ item.at | relativeTime }}</span>
        </button>
        @if (!item.seen) {
          <button
            type="button"
            class="btn btn--ghost btn--icon btn--sm"
            [attr.aria-label]="'Marcar como vista: ' + item.title"
            (click)="markSeen(item)"
          >
            <svg appIcon="check" size="sm"></svg>
          </button>
        } @else {
          <span></span>
        }
      </div>
    </ng-template>
  `,
})
export class NotificationBellComponent {
  protected readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly open = signal(false);
  protected readonly unread = this.notifications.unreadCount;
  protected readonly todayItems = computed(() =>
    this.notifications.actionToday().filter((i) => !i.seen),
  );
  protected readonly followItems = computed(() =>
    this.notifications.toFollow().filter((i) => !i.seen),
  );
  protected readonly seenItems = this.notifications.seenItems;

  protected readonly bellLabel = computed(() => {
    const n = this.unread();
    return n === 0
      ? 'Notificações: nenhuma não vista'
      : `Notificações: ${n} ${n === 1 ? 'não vista' : 'não vistas'}`;
  });

  protected toggle(): void {
    if (this.open()) {
      this.close(true);
      return;
    }
    this.notifications.reconcile();
    this.open.set(true);
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }

  protected markSeen(item: NotificationItem): void {
    this.notifications.markSeen(item.key);
  }

  protected markAll(): void {
    this.notifications.markAllSeen();
  }

  /** Abre a tela da pendência, já filtrada (AC-M02-08), e marca como vista. */
  protected openItem(item: NotificationItem): void {
    this.notifications.markSeen(item.key);
    this.close(false);
    void this.router.navigate([item.link], {
      ...(item.queryParams ? { queryParams: item.queryParams } : {}),
    });
  }

  protected onEscape(): void {
    if (this.open()) {
      this.close(true);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  private close(returnFocus: boolean): void {
    this.open.set(false);
    if (returnFocus) {
      this.trigger().nativeElement.focus();
    }
  }
}
