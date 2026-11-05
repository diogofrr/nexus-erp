import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { formatDate } from '@core/format';
import { POP05_TRIGGERS, POP07_AUTHORITIES, POP07_REMINDER } from '@core/rules/pop05';
import {
  POP_RESPONSIBLE_LABELS,
  POP_STATE_LABELS,
  popActionBlockedReason,
} from '@core/rules/governance-access';
import { PageContextService, ToastService } from '@shared/ui/overlay';
import { DrawerComponent } from '@shared/ui/overlay';
import {
  BadgeComponent,
  CardComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
  TimelineComponent,
  TimelineItem,
} from '@shared/ui';
import { map } from 'rxjs';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService } from '../state/governance.service';

type DrawerKind = 'review' | 'trigger';

/**
 * SCR-M13-02 POP (`/app/governanca/pops/:code`). Os 7 campos fixos de cada POP (RN-POP-11), o estado de revisão,
 * o histórico de revisões e a ciência da equipe. "Registrar revisão" e "Acionar revisão" só aparecem para quem
 * fecha as ações deste POP (RN-POP-14); o desfazer volta a data e o estado de antes.
 */
@Component({
  selector: 'app-governance-pop-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BadgeComponent,
    CardComponent,
    DrawerComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
    TimelineComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (pop(); as p) {
        <app-page-header [title]="p.code + ' · ' + p.title" [description]="'Responsável: ' + responsible()">
          @if (canAct()) {
            <button type="button" class="btn btn--primary" data-role="review" (click)="openDrawer('review')">
              Registrar revisão
            </button>
          }
        </app-page-header>
        <app-governance-tabs />

        <div class="cluster" data-role="pop-state">
          <app-badge [variant]="stateVariant()" [icon]="stateIcon()" large>{{ stateLabel() }}</app-badge>
          <span class="t-ui t-muted">Última revisão em {{ date(p.lastReviewedAt) }}</span>
        </div>

        @if (blockedReason(); as reason) {
          <p class="t-ui t-muted" data-role="blocked-reason">
            <svg appIcon="lock" size="sm"></svg> {{ reason }}
          </p>
        }

        <div class="layout-main-aside">
          <div class="stack stack--6" data-role="pop-fields">
            <app-card title="Objetivo"><p>{{ p.objective }}</p></app-card>
            <app-card title="Responsável"><p>{{ p.responsible }}</p></app-card>
            <app-card title="Materiais"><p>{{ p.materials }}</p></app-card>
            <app-card title="Passo a passo">
              <ol class="stack stack--2">
                @for (step of p.steps; track $index) {
                  <li>{{ step }}</li>
                }
              </ol>
            </app-card>
            <app-card title="Registro exigido"><p>{{ p.requiredRecord }}</p></app-card>
            <app-card title="Indicadores"><p>{{ p.indicators }}</p></app-card>
            <app-card title="Data da última revisão"><p>{{ date(p.lastReviewedAt) }}</p></app-card>

            @if (p.code === 'POP-05') {
              <app-card title="Quando acionar" subtitle="Gatilhos do POP-05">
                <ul class="stack stack--2" data-role="triggers">
                  @for (t of triggers; track t) {
                    <li>{{ t }}</li>
                  }
                </ul>
                <p class="t-caption">Em emergência, acione o SAMU (192) ou a unidade de urgência mais próxima.</p>
              </app-card>
            }
            @if (p.code === 'POP-07') {
              <app-card title="Órgãos que recebem a comunicação" subtitle="Notificação compulsória">
                <ul class="stack stack--2" data-role="authorities">
                  @for (a of authorities; track a) {
                    <li>{{ a }}</li>
                  }
                </ul>
                <p class="t-strong" data-role="reminder">{{ reminder }}</p>
              </app-card>
            }
          </div>

          <aside class="stack stack--6" aria-label="Revisões e ciência">
            <app-card title="Histórico de revisões" subtitle="Só cresce: nada é apagado" variant="sunken">
              @if (reviewItems().length === 0) {
                <app-empty-state compact title="Nenhuma revisão registrada" text="Quando o POP for revisado, a revisão aparece aqui." />
              } @else {
                <app-timeline label="Revisões do POP" [items]="reviewItems()" />
              }
            </app-card>

            <app-card title="Ciência" subtitle="Quem leu e entendeu o POP" variant="sunken">
              <div class="stack stack--3">
                <p class="t-ui" data-role="ack-counts">
                  {{ acks().providers }} {{ acks().providers === 1 ? 'prestador' : 'prestadores' }} e
                  {{ acks().users }} {{ acks().users === 1 ? 'pessoa da equipe' : 'pessoas da equipe' }}
                  registraram a ciência.
                </p>
                @if (ownAck()) {
                  <span class="badge badge--success" data-role="own-ack"><svg appIcon="circle-check"></svg>Você registrou a sua ciência</span>
                } @else {
                  <button type="button" class="btn" data-role="acknowledge" (click)="acknowledge()">
                    Registrar a minha ciência
                  </button>
                }
              </div>
            </app-card>

            @if (canAct()) {
              <app-card title="Um incidente mostrou uma lacuna?" variant="sunken">
                <div class="stack stack--3">
                  <p class="t-ui">
                    Os POPs são revistos todo ano ou quando um incidente aponta uma lacuna. Acionar a
                    revisão deixa o estado em "Revisão acionada" até a próxima revisão registrada.
                  </p>
                  <button type="button" class="btn" data-role="trigger" (click)="openDrawer('trigger')">
                    Acionar revisão
                  </button>
                </div>
              </app-card>
            }
          </aside>
        </div>

        @if (canAct()) {
        <app-drawer
          [(open)]="drawerOpen"
          [heading]="drawerKind() === 'review' ? 'Registrar revisão do ' + p.code : 'Acionar revisão do ' + p.code"
          [subtitle]="drawerKind() === 'review' ? 'A data da última revisão passa a ser hoje' : 'O estado passa a Revisão acionada'"
        >
          <form id="pop-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
            <app-form-field
              [label]="drawerKind() === 'review' ? 'O que foi revisado' : 'Qual lacuna o incidente mostrou'"
              [hint]="drawerKind() === 'review' ? 'Uma frase basta. Não escreva dado de cuidador.' : 'Descreva o procedimento, sem identificar ninguém.'"
              controlId="pop-note"
              [error]="noteError()"
            >
              <textarea appInput formControlName="note" rows="4"></textarea>
            </app-form-field>
          </form>
          <ng-container drawerFooter>
            <button type="button" class="btn" (click)="drawerOpen.set(false)">Cancelar</button>
            <button type="submit" form="pop-form" class="btn btn--primary" data-role="submit">
              {{ drawerKind() === 'review' ? 'Registrar revisão' : 'Acionar revisão' }}
            </button>
          </ng-container>
        </app-drawer>
        }
      } @else {
        <app-page-header title="POP não encontrado" />
        <app-empty-state
          kind="error"
          title="Não encontramos este POP"
          text="Confira o código ou volte à lista de procedimentos."
        >
          <a class="btn" routerLink="/app/governanca/pops">Ver os POPs</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class PopPageComponent {
  protected readonly svc = inject(GovernanceService);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly pageContext = inject(PageContextService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly triggers = POP05_TRIGGERS;
  protected readonly authorities = POP07_AUTHORITIES;
  protected readonly reminder = POP07_REMINDER;

  private readonly code = toSignal(this.route.paramMap.pipe(map((p) => p.get('code') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('code') ?? '',
  });

  protected readonly pop = computed(() => this.svc.popByCode(this.code()));
  private readonly stateRow = computed(() => this.svc.pops().find((p) => p.pop.code === this.code()));
  protected readonly stateLabel = computed(() => POP_STATE_LABELS[this.stateRow()?.state ?? 'up_to_date']);
  protected readonly stateVariant = computed(() => {
    const s = this.stateRow()?.state;
    return s === 'due' ? 'attention' : s === 'revision_triggered' ? 'danger' : 'success';
  });
  protected readonly stateIcon = computed(() => {
    const s = this.stateRow()?.state;
    return s === 'due' ? 'clock' : s === 'revision_triggered' ? 'triangle-alert' : 'circle-check';
  });
  protected readonly responsible = computed(() => {
    const p = this.pop();
    return p ? POP_RESPONSIBLE_LABELS[p.responsibleRole] : '';
  });
  protected readonly canAct = computed(() => {
    const p = this.pop();
    return p ? this.svc.canActOn(p) : false;
  });
  protected readonly blockedReason = computed(() => {
    const p = this.pop();
    const role = this.auth.role();
    return p && role && !this.canAct() ? popActionBlockedReason(role, p.responsibleRole) : null;
  });

  protected readonly reviewItems = computed<TimelineItem[]>(() =>
    this.svc.reviewsOf(this.code()).map((r) => ({
      id: r.id,
      title: `Revisão em ${formatDate(r.reviewedAt)}`,
      text: r.note,
      timeLabel: `por ${this.svc.userName(r.reviewedByUserId)}`,
      tone: 'done' as const,
    })),
  );
  protected readonly acks = computed(() => this.svc.acknowledgementsOf(this.code()));
  protected readonly ownAck = computed(() => this.svc.hasOwnAcknowledgement(this.code()));

  protected readonly drawerOpen = signal(false);
  protected readonly drawerKind = signal<DrawerKind>('review');
  private readonly submitted = signal(false);
  protected readonly form = this.fb.group({
    note: this.fb.control('', [Validators.required]) as FormControl<string>,
  });

  constructor() {
    effect(() => {
      const p = this.pop();
      this.pageContext.setCrumbs([
        { label: 'Governança', link: '/app/governanca' },
        { label: 'POPs', link: '/app/governanca/pops' },
        { label: p?.code ?? 'POP' },
      ]);
    });
  }

  protected date(value: string): string {
    return formatDate(value);
  }

  protected noteError(): string | null {
    return this.submitted() && this.form.controls.note.value.trim().length < 5
      ? this.drawerKind() === 'review'
        ? 'Escreva o que foi revisado, com ao menos 5 caracteres.'
        : 'Escreva qual lacuna o incidente mostrou, com ao menos 5 caracteres.'
      : null;
  }

  protected openDrawer(kind: DrawerKind): void {
    this.drawerKind.set(kind);
    this.form.reset({ note: '' });
    this.submitted.set(false);
    this.drawerOpen.set(true);
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.noteError()) {
      return;
    }
    const note = this.form.controls.note.value;
    const code = this.code();
    const result = this.drawerKind() === 'review' ? this.svc.reviewPop(code, note) : this.svc.triggerRevision(code, note);
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível registrar.');
      return;
    }
    this.drawerOpen.set(false);
    const undo = result.undo;
    this.toasts.success(
      this.drawerKind() === 'review'
        ? `Revisão do ${code} registrada em ${formatDate(this.clock.today())}.`
        : `Revisão do ${code} acionada.`,
      undo ? { label: 'Desfazer', run: undo } : undefined,
    );
  }

  protected acknowledge(): void {
    const result = this.svc.acknowledge(this.code());
    if (result.ok) {
      this.toasts.success(`Ciência do ${this.code()} registrada.`);
    } else {
      this.toasts.attention(result.message ?? 'Não foi possível registrar.');
    }
  }
}
