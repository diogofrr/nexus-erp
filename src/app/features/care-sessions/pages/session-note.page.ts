import { ChangeDetectionStrategy, DestroyRef, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { SupervisionWindowService } from '@core/audit/supervision-window.service';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDateTime, formatTime } from '@core/format';
import {
  BadgeComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
  TimelineComponent,
  TimelineItem,
} from '@shared/ui';
import { SupervisionGateComponent } from '@shared/ui/access/supervision-gate.component';
import { DialogService, PageContextService, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { dayAndTime } from '../state/care-helpers';
import { KIND_LABELS } from '../state/care-labels';
import { CareSessionsService } from '../state/care-sessions.service';

const AUTOSAVE_MS = 1500;

/**
 * SCR-M05-05, Anotação sigilosa da sessão (F18): escrever, assinar e adendar. Tela de foco. Rascunho
 * automático ("Salvo às 10:58"); "Salvar rascunho" e "Assinar anotação" ficam separados para não assinar sem
 * querer. Assinada, a anotação é imutável: não existe botão de editar, só adendo com data e hora. Só o psicólogo
 * autor escreve; o responsável técnico lê pelo portão de supervisão, com motivo e log.
 */
@Component({
  selector: 'app-session-note-page',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
    RouterLink,
    SupervisionGateComponent,
    TimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow stack stack--6">
      <app-page-header title="Anotação da sessão" [description]="subtitle()">
        <a class="btn" [routerLink]="['/app/atendimento/sessoes', sessionId()]">Voltar à sessão</a>
      </app-page-header>

      @if (!session()) {
        <app-empty-state title="Sessão não encontrada" text="Confira o endereço ou volte à agenda.">
          <a class="btn btn--primary" routerLink="/app/atendimento/agenda">Voltar à agenda</a>
        </app-empty-state>
      } @else if (session()?.status !== 'done') {
        <app-empty-state
          title="A anotação fica disponível depois da sessão"
          text="Marque a sessão como realizada no detalhe para escrever e assinar a anotação."
        >
          <a class="btn btn--primary" [routerLink]="['/app/atendimento/sessoes', sessionId()]">Ver a sessão</a>
        </app-empty-state>
      } @else if (isSupervision() && !note()) {
        <app-empty-state title="Sem anotação ainda" text="O psicólogo autor ainda não registrou a anotação desta sessão." />
      } @else if (isSupervision() && !unlocked()) {
        <app-supervision-gate
          entity="session_note"
          [entityId]="note()?.id ?? sessionId()"
          [caregiverId]="session()?.caregiverId ?? ''"
          [ownerName]="ownerName()"
          (granted)="unlocked.set(true)"
        />
      } @else {
        <div class="cluster">
          <app-badge variant="info" icon="lock">Dado sensível · cifrado em repouso (simulado)</app-badge>
          <app-badge variant="neutral" data-role="kind">{{ kind() }}</app-badge>
          @if (note()?.status === 'signed') {
            <app-badge variant="success" icon="circle-check" data-role="note-status">Assinada em {{ signedAt() }}</app-badge>
          } @else {
            <app-badge variant="attention" icon="pencil" data-role="note-status">Rascunho</app-badge>
          }
        </div>

        @if (supervisionInfo(); as info) {
          <p class="t-caption" data-role="supervision-info">{{ info }}</p>
        }

        @if (canEdit() && note()?.status !== 'signed') {
          <form class="stack stack--6" novalidate (submit)="$event.preventDefault()">
            <app-form-field label="Anotação" controlId="note-content" [error]="error()" hint="O texto é do psicólogo autor. O rascunho é salvo sozinho.">
              <textarea
                appInput
                rows="12"
                [value]="content()"
                (input)="onInput(valueOf($event))"
                (blur)="persist()"
                data-role="note-text"
              ></textarea>
            </app-form-field>
            <p class="t-caption" aria-live="polite" data-role="saved-at">
              @if (savedAt()) {
                <svg appIcon="circle-check" size="sm"></svg>Rascunho salvo às {{ savedAt() }}
              } @else {
                O rascunho é salvo sozinho, 2 segundos depois da última digitação.
              }
            </p>
            <div class="stack stack--3">
              <div>
                <button type="button" class="btn" (click)="saveDraftNow()" data-role="save-draft">Salvar rascunho</button>
              </div>
              <div class="divider"></div>
              <p class="t-caption">Depois de assinada, a anotação não pode ser editada. Correções entram como adendo.</p>
              <div>
                <button type="button" class="btn btn--primary" (click)="sign()" data-role="sign">
                  <svg appIcon="pencil" size="sm"></svg>Assinar anotação
                </button>
              </div>
            </div>
          </form>
        } @else {
          <section class="card card--pad stack stack--3" aria-labelledby="note-read">
            <h2 id="note-read" class="card__title">Anotação</h2>
            <p class="discreet" data-role="note-body" style="white-space: pre-wrap">{{ note()?.content }}</p>
          </section>
        }

        @if (note()?.status === 'signed') {
          <section class="card card--pad stack stack--3" aria-labelledby="note-addenda">
            <h2 id="note-addenda" class="card__title">Adendos</h2>
            @if (addenda().length > 0) {
              <app-timeline label="Adendos da anotação" [items]="addenda()" />
            } @else {
              <p class="t-muted t-ui">Nenhum adendo. Correções e complementos entram aqui, com data e hora.</p>
            }
            @if (canEdit()) {
              <app-form-field label="Novo adendo" controlId="note-addendum" [error]="addendumError()">
                <textarea appInput rows="3" [value]="addendum()" (input)="addendum.set(valueOf($event))" data-role="addendum-text"></textarea>
              </app-form-field>
              <div>
                <button type="button" class="btn" (click)="addAddendum()" data-role="add-addendum">Adicionar adendo</button>
              </div>
            }
          </section>
        }
      }
    </div>
  `,
})
export class SessionNotePageComponent {
  private readonly db = inject(Database);
  private readonly svc = inject(CareSessionsService);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly supervision = inject(SupervisionWindowService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly page = inject(PageContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly valueOf = valueOf;
  protected readonly sessionId = computed(() => this.params().get('id') ?? '');
  protected readonly session = computed(() => this.db.careSessions.get(this.sessionId()));
  protected readonly note = computed(() => this.db.sessionNotes.find((n) => n.sessionId === this.sessionId()));
  protected readonly kind = computed(() => KIND_LABELS[this.session()?.kind ?? 'psychotherapy']);
  protected readonly isSupervision = computed(() => this.auth.role() === 'technical_lead');
  protected readonly canEdit = computed(() => {
    const s = this.session();
    const actor = this.auth.actor();
    return !!s && actor?.role === 'psychologist' && actor.psychologistId === s.psychologistId;
  });
  protected readonly subtitle = computed(() => {
    const s = this.session();
    return s ? dayAndTime(s.startAt.slice(0, 10), s.startAt.slice(11, 16)) : '';
  });
  protected readonly ownerName = computed(() => {
    const psy = this.db.psychologists.get(this.session()?.psychologistId ?? '');
    return psy ? `${psy.displayName.startsWith('Dra.') ? 'a' : 'o'} ${psy.displayName}` : 'outro psicólogo da equipe';
  });
  protected readonly signedAt = computed(() => formatDateTime(this.note()?.signedAt));
  protected readonly addenda = computed<TimelineItem[]>(() =>
    [...(this.note()?.addenda ?? [])]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((a) => ({ title: 'Adendo', text: a.content, at: a.at })),
  );

  protected readonly content = signal('');
  protected readonly savedAt = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly addendum = signal('');
  protected readonly addendumError = signal<string | null>(null);
  protected readonly unlocked = signal(false);
  protected readonly supervisionInfo = computed(() => {
    this.unlocked();
    const s = this.session();
    const found = s ? this.supervision.current(s.caregiverId) : null;
    return this.isSupervision() && found
      ? `Supervisão registrada às ${formatTime(found.at)} (motivo: ${found.reason})`
      : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer !== null) {
        clearTimeout(this.timer);
        this.persist();
      }
    });
    // Conteúdo inicial do rascunho e abertura registrada no log.
    effect(() => {
      const note = this.note();
      const s = this.session();
      untracked(() => {
        if (note && this.content() === '') {
          this.content.set(note.content);
        }
        if (s && note && this.canEdit() && !this.viewLogged) {
          this.viewLogged = true;
          this.audit.view('session_note', note.id, s.caregiverId);
        }
      });
    });
    // Supervisão: com a janela de 30 minutos aberta, cada abertura segue no log com o mesmo motivo.
    effect(() => {
      const s = this.session();
      const note = this.note();
      untracked(() => {
        if (this.isSupervision() && s && note && !this.unlocked()) {
          if (this.supervision.access('session_note', note.id, s.caregiverId) === 'open') {
            this.unlocked.set(true);
          }
        }
      });
    });
    effect(() => {
      this.page.setCrumbs([
        { label: 'Atendimento', link: '/app/atendimento/agenda' },
        { label: 'Sessões', link: '/app/atendimento/sessoes' },
        { label: 'Sessão', link: `/app/atendimento/sessoes/${this.sessionId()}` },
        { label: 'Anotação' },
      ]);
    });
  }

  private viewLogged = false;

  protected onInput(value: string): void {
    this.content.set(value);
    this.error.set(null);
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.persist(), AUTOSAVE_MS);
  }

  /** Salva o rascunho em silêncio (sem criar anotação vazia). */
  protected persist(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const text = this.content();
    if (!this.canEdit() || this.note()?.status === 'signed' || (text.trim() === '' && !this.note())) {
      return;
    }
    const result = this.svc.saveDraft(this.sessionId(), text);
    if (result.ok) {
      this.savedAt.set(formatTime(this.clock.now()));
    }
  }

  protected saveDraftNow(): void {
    this.persist();
    if (this.savedAt()) {
      this.toasts.success('Rascunho salvo.');
    } else {
      this.error.set('Escreva a anotação antes de salvar o rascunho.');
    }
  }

  protected async sign(): Promise<void> {
    if (this.content().trim().length < 10) {
      this.error.set('Escreva a anotação antes de assinar.');
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: 'Assinar esta anotação?',
      message: 'Depois de assinada, ela não pode ser editada. Correções entram como adendo, com data e hora.',
      confirmLabel: 'Assinar anotação',
      irreversibleNote: 'A assinatura não pode ser desfeita.',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.sign(this.sessionId(), this.content());
    if (!result.ok) {
      this.error.set(result.errors[0]?.message ?? null);
      return;
    }
    this.error.set(null);
    this.toasts.success('Anotação assinada. Correções entram como adendo.');
  }

  protected addAddendum(): void {
    const result = this.svc.addAddendum(this.sessionId(), this.addendum());
    if (!result.ok) {
      this.addendumError.set(result.errors[0]?.message ?? null);
      return;
    }
    this.addendumError.set(null);
    this.addendum.set('');
    this.toasts.success('Adendo adicionado, com data e hora.');
  }
}
