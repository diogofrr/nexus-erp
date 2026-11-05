import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { ActivityKind } from '@core/models';
import { isRoomBookable, roomBlockReason } from '@core/rules/rooms';
import {
  BadgeComponent,
  DraftRecord,
  DraftService,
  EmptyStateComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
  RadioGroupComponent,
  RadioOption,
} from '@shared/ui';
import { PageContextService, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import {
  CHARACTER_LABELS,
  KIND_LABELS,
  MODE_LABELS,
  NO_PROMISE_TEXT,
  THEME_LABELS,
  isThemeAllowed,
  themesFor,
} from '../state/groups-labels';
import { ActivityForm, FieldError, GroupsService } from '../state/groups.service';

const KIND_OPTIONS: RadioOption<ActivityKind>[] = (Object.keys(KIND_LABELS) as ActivityKind[]).map((value) => ({
  value,
  label: KIND_LABELS[value],
}));
const MODE_OPTIONS: RadioOption<'online' | 'in_person'>[] = (['online', 'in_person'] as const).map((value) => ({
  value,
  label: MODE_LABELS[value],
}));
const FIELD_IDS: Record<string, string> = {
  kind: 'na-kind',
  title: 'na-title',
  theme: 'na-theme',
  leader: 'na-leader',
  mode: 'na-mode',
  room: 'na-room',
  capacity: 'na-capacity',
  meetings: 'na-meetings',
  confidentiality: 'na-confidentiality',
};
const DRAFT_FORM = 'activity';

/**
 * SCR-M07-02, Nova atividade (PD-04): tipo, tema (só os conjuntos de RN-GRP-05 e 06), responsáveis, modalidade,
 * sala (presencial exige os 4 itens de acessibilidade), encontros, vagas (padrão 12, editável), contrato de sigilo
 * e a divulgação com o número de inscrição profissional e o aviso de que não promete resultado terapêutico. Salva
 * rascunho sozinho (UX 5.12). "Publicar" abre as inscrições. A mesma tela edita rascunho e atividade aberta.
 */
@Component({
  selector: 'app-new-activity-page',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
    RadioGroupComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--form stack stack--6">
      <app-page-header [title]="editing() ? 'Editar atividade' : 'Nova atividade'" description="Preencha o que a regra pede. O rascunho é salvo sozinho.">
        <a class="btn" routerLink="/app/grupos">Voltar à programação</a>
      </app-page-header>

      @if (notFound()) {
        <app-empty-state title="Atividade não encontrada" text="Volte à programação e escolha a atividade de novo.">
          <a class="btn btn--primary" routerLink="/app/grupos">Voltar à programação</a>
        </app-empty-state>
      } @else {
        @if (pendingDraft(); as draft) {
          <div class="banner banner--consent" role="group" aria-label="Rascunho encontrado" data-role="draft-banner">
            <svg appIcon="save"></svg>
            <div class="banner__body">
              <span class="banner__title">Retomar rascunho?</span>
              <span class="banner__text">Há um rascunho de {{ draftWhen() }}. Quer continuar de onde parou ou começar de novo?</span>
              <div class="banner__actions">
                <button type="button" class="btn" (click)="resumeDraft(draft)" data-role="resume-draft">Retomar rascunho</button>
                <button type="button" class="btn" (click)="discardDraft()">Começar de novo</button>
              </div>
            </div>
          </div>
        }

        <app-error-summary [items]="summary()" />

        <form class="stack stack--6" novalidate (submit)="$event.preventDefault()" data-role="activity-form">
          <app-form-field label="Tipo de atividade" group controlId="na-kind" [error]="err('kind')">
            <app-radio-group [options]="kindOptions" [value]="form().kind" (valueChange)="setKind($event)" />
          </app-form-field>

          <div class="form-grid">
            <app-form-field label="Tema" controlId="na-theme" [error]="err('theme')" hint="Só os temas definidos para este tipo de atividade.">
              <select appInput [value]="form().theme" [disabled]="!form().kind" (change)="set('theme', valueOf($event))" data-role="theme">
                <option value="">Escolha o tema</option>
                @for (t of themeOptions(); track t) {
                  <option [value]="t" [selected]="form().theme === t">{{ themeLabel(t) }}</option>
                }
              </select>
            </app-form-field>
            <app-form-field label="Título" controlId="na-title" [error]="err('title')" hint="Sem promessa de resultado terapêutico.">
              <input appInput [value]="form().title" (input)="set('title', valueOf($event))" data-role="title" />
            </app-form-field>
          </div>

          <app-form-field label="Quem conduz" group controlId="na-leader" [error]="err('leader')">
            <app-radio-group [options]="leaderTypeOptions()" [value]="form().leaderType" (valueChange)="set('leaderType', $event ?? 'psychologist')" />
          </app-form-field>
          @if (form().leaderType === 'psychologist') {
            <app-form-field label="Psicólogo da Nexus" controlId="na-leader-psy" hint="Só psicólogos com CRP ativo.">
              <select appInput [value]="form().leaderId" [disabled]="isPsychologist()" (change)="set('leaderId', valueOf($event))" data-role="leader-psychologist">
                <option value="">Escolha o psicólogo</option>
                @for (p of psychologists(); track p.id) {
                  <option [value]="p.id" [selected]="form().leaderId === p.id">{{ p.displayName }}</option>
                }
              </select>
            </app-form-field>
          } @else if (form().leaderType === 'provider') {
            <app-form-field label="Profissional credenciado" controlId="na-leader-provider">
              <select appInput [value]="form().leaderId" (change)="set('leaderId', valueOf($event))" data-role="leader-provider">
                <option value="">Escolha o profissional</option>
                @for (p of providers(); track p.id) {
                  <option [value]="p.id" [selected]="form().leaderId === p.id">{{ p.name }}</option>
                }
              </select>
            </app-form-field>
          } @else {
            <div class="form-grid">
              <app-form-field label="Nome do convidado" controlId="na-guest-name">
                <input appInput [value]="form().guestName" (input)="set('guestName', valueOf($event))" data-role="guest-name" />
              </app-form-field>
              <app-form-field label="Registro profissional" controlId="na-guest-reg" [optional]="true" hint="Obrigatório na divulgação de serviço de Psicologia.">
                <input appInput [value]="form().guestRegistration" (input)="set('guestRegistration', valueOf($event))" />
              </app-form-field>
            </div>
          }

          <app-form-field label="Modalidade" group controlId="na-mode" [error]="err('mode')">
            <app-radio-group [options]="modeOptions" [value]="form().mode" (valueChange)="set('mode', $event)" />
          </app-form-field>
          @if (form().mode === 'in_person') {
            <app-form-field label="Sala do coworking" group controlId="na-room" [error]="err('room')" hint="A atividade presencial só pode usar sala com os 4 itens de acessibilidade.">
              <app-radio-group [options]="roomOptions()" [value]="form().roomId || null" (valueChange)="set('roomId', $event ?? '')" />
            </app-form-field>
          }
          @if (form().kind === 'open_conversation_circle') {
            <app-form-field label="Em parceria com" controlId="na-partner" [optional]="true" hint="CRAS, unidade básica de saúde ou associação de bairro.">
              <input appInput [value]="form().partnerOrg" (input)="set('partnerOrg', valueOf($event))" />
            </app-form-field>
          }

          <app-form-field label="Vagas" controlId="na-capacity" [error]="err('capacity')" hint="Padrão 12. Lotada, abre lista de espera.">
            <input appInput type="number" min="1" max="60" [value]="form().capacity ?? ''" (input)="setCapacity(valueOf($event))" data-role="capacity" />
          </app-form-field>

          <fieldset class="stack stack--3" id="na-meetings" aria-describedby="na-meetings-hint">
            <legend class="field__label">Encontros</legend>
            <p id="na-meetings-hint" class="t-caption">Informe a data e o horário de cada encontro.</p>
            @for (m of form().meetings; track $index; let i = $index) {
              <div class="form-grid" [attr.data-meeting]="i">
                <app-form-field [label]="'Data do encontro ' + (i + 1)" [controlId]="'na-meeting-date-' + i">
                  <input appInput type="date" [value]="m.date" (input)="setMeeting(i, 'date', valueOf($event))" data-role="meeting-date" />
                </app-form-field>
                <app-form-field [label]="'Início do encontro ' + (i + 1)" [controlId]="'na-meeting-start-' + i">
                  <input appInput type="time" [value]="m.start" (input)="setMeeting(i, 'start', valueOf($event))" data-role="meeting-start" />
                </app-form-field>
                <app-form-field [label]="'Fim do encontro ' + (i + 1)" [controlId]="'na-meeting-end-' + i">
                  <input appInput type="time" [value]="m.end" (input)="setMeeting(i, 'end', valueOf($event))" data-role="meeting-end" />
                </app-form-field>
                <div class="field">
                  <button type="button" class="btn btn--sm" (click)="removeMeeting(i)" [attr.aria-label]="'Remover o encontro ' + (i + 1)">Remover</button>
                </div>
              </div>
            }
            @if (err('meetings'); as msg) {
              <p class="field__error" role="alert">{{ msg }}</p>
            }
            <div>
              <button type="button" class="btn" (click)="addMeeting()" data-role="add-meeting"><svg appIcon="plus" size="sm"></svg>Adicionar encontro</button>
            </div>
          </fieldset>

          <app-form-field label="Contrato de sigilo" controlId="na-confidentiality" [error]="err('confidentiality')" hint="O participante só entra depois de aceitar. A data e a hora do aceite ficam registradas.">
            <textarea appInput rows="4" [value]="form().confidentialityText" (input)="set('confidentialityText', valueOf($event))" data-role="confidentiality"></textarea>
          </app-form-field>

          <section class="card card--sunken card--pad stack stack--2" aria-labelledby="na-preview" data-role="preview">
            <h2 id="na-preview" class="card__title">Como a divulgação aparece</h2>
            <div class="cluster">
              @if (form().kind) {
                <app-badge variant="info">{{ kindText() }}</app-badge>
                <app-badge [variant]="form().kind === 'group_therapy' ? 'gold' : 'info'">{{ character() }}</app-badge>
              }
            </div>
            <p class="t-ui">{{ noPromise }}</p>
            @if (registration(); as reg) {
              <p class="t-caption" data-role="registration">Inscrição profissional de quem conduz: {{ reg }}.</p>
            }
          </section>

          <div class="action-bar">
            <span class="t-caption" aria-live="polite" data-role="saved-at">{{ savedAt() ? 'Rascunho salvo às ' + savedAt() : '' }}</span>
            <button type="button" class="btn" (click)="save(false)" data-role="save-draft">{{ editing() && status() !== 'draft' ? 'Salvar alterações' : 'Salvar rascunho' }}</button>
            @if (!editing() || status() === 'draft') {
              <button type="button" class="btn btn--primary" (click)="save(true)" data-role="publish">Publicar atividade</button>
            }
          </div>
        </form>
      }
    </div>
  `,
})
export class NewActivityPageComponent {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(GroupsService);
  private readonly drafts = inject(DraftService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly page = inject(PageContextService);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly valueOf = valueOf;
  protected readonly noPromise = NO_PROMISE_TEXT;
  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly modeOptions = MODE_OPTIONS;

  protected readonly editId = computed(() => this.params().get('id'));
  protected readonly editing = computed(() => this.editId() !== null);
  protected readonly notFound = computed(() => this.editing() && !this.db.activities.get(this.editId() ?? ''));
  protected readonly status = computed(() => this.db.activities.get(this.editId() ?? '')?.status);
  protected readonly isPsychologist = computed(() => this.auth.role() === 'psychologist');

  protected readonly form = signal<ActivityForm>(this.svc.emptyForm());
  protected readonly errors = signal<FieldError[]>([]);
  protected readonly savedAt = signal<string | null>(null);
  protected readonly pendingDraft = signal<DraftRecord<ActivityForm> | null>(null);
  protected readonly draftWhen = computed(() => {
    const d = this.pendingDraft();
    return d ? this.drafts.describe(d) : '';
  });

  protected readonly psychologists = computed(() => this.db.psychologists.all().filter((p) => p.crpStatus === 'active'));
  protected readonly providers = computed(() =>
    this.db.providers.all().filter((p) => p.status === 'active' || p.status === 'monitoring'),
  );
  protected readonly themeOptions = computed(() => {
    const kind = this.form().kind;
    return kind ? themesFor(kind) : [];
  });
  protected readonly leaderTypeOptions = computed<RadioOption<'psychologist' | 'provider' | 'guest'>[]>(() => {
    const therapy = this.form().kind === 'group_therapy';
    const mine = this.isPsychologist();
    return [
      { value: 'psychologist', label: 'Psicólogo da Nexus' },
      { value: 'provider', label: 'Profissional credenciado', disabled: therapy || mine },
      { value: 'guest', label: 'Convidado', disabled: therapy || mine },
    ];
  });
  protected readonly roomOptions = computed<RadioOption<string>[]>(() =>
    this.db.rooms.all().map((room) => {
      const reason = roomBlockReason(room);
      return { value: room.id, label: room.name, disabled: !isRoomBookable(room), ...(reason ? { hint: reason } : {}) };
    }),
  );
  protected readonly kindText = computed(() => (this.form().kind ? KIND_LABELS[this.form().kind as ActivityKind] : ''));
  protected readonly character = computed(() =>
    CHARACTER_LABELS[this.form().kind === 'group_therapy' ? 'psychotherapy' : 'guidance'],
  );
  protected readonly registration = computed(() => {
    const f = this.form();
    if (f.leaderType === 'psychologist') {
      const psy = this.db.psychologists.get(f.leaderId);
      return psy ? `${psy.crp} (fictício)` : null;
    }
    return f.leaderType === 'guest' && f.guestRegistration.trim() ? f.guestRegistration.trim() : null;
  });
  protected readonly summary = computed<ErrorSummaryItem[]>(() =>
    this.errors().map((e) => ({ controlId: FIELD_IDS[e.field] ?? 'na-title', message: e.message })),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer !== null) {
        clearTimeout(this.timer);
      }
    });
    effect(() => {
      const id = this.editId();
      const activity = id ? this.db.activities.get(id) : undefined;
      untracked(() => {
        if (activity) {
          this.form.set(this.svc.formOf(activity));
        } else if (!id) {
          const draft = this.drafts.load<ActivityForm>(DRAFT_FORM, 'novo');
          if (draft) {
            this.pendingDraft.set(draft);
          }
        }
      });
    });
    effect(() => {
      this.page.setCrumbs([
        { label: 'Grupos', link: '/app/grupos' },
        { label: this.editing() ? 'Editar atividade' : 'Nova atividade' },
      ]);
    });
  }

  protected err(field: string): string | null {
    return this.errors().find((e) => e.field === field)?.message ?? null;
  }

  protected themeLabel(theme: string): string {
    return THEME_LABELS[theme as keyof typeof THEME_LABELS] ?? theme;
  }

  protected set<K extends keyof ActivityForm>(key: K, value: ActivityForm[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
    this.scheduleDraft();
  }

  protected setKind(kind: ActivityKind | null): void {
    this.form.update((f) => ({
      ...f,
      kind,
      theme: kind && isThemeAllowed(kind, f.theme) ? f.theme : '',
      leaderType: kind === 'group_therapy' ? 'psychologist' : f.leaderType,
    }));
    this.scheduleDraft();
  }

  protected setCapacity(raw: string): void {
    this.set('capacity', raw === '' ? null : Number(raw));
  }

  protected addMeeting(): void {
    this.form.update((f) => ({ ...f, meetings: [...f.meetings, { date: '', start: '', end: '' }] }));
    this.scheduleDraft();
  }

  protected removeMeeting(index: number): void {
    this.form.update((f) => ({ ...f, meetings: f.meetings.filter((_, i) => i !== index) }));
    this.scheduleDraft();
  }

  protected setMeeting(index: number, field: 'date' | 'start' | 'end', value: string): void {
    this.form.update((f) => ({
      ...f,
      meetings: f.meetings.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    }));
    this.scheduleDraft();
  }

  /** Rascunho automático 2 segundos depois da última mudança (UX 5.12), só em atividade nova. */
  private scheduleDraft(): void {
    if (this.editing()) {
      return;
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      const record = this.drafts.save(DRAFT_FORM, 'novo', this.form());
      this.savedAt.set(record.savedAt.slice(11, 16));
      this.timer = null;
    }, 2000);
  }

  protected resumeDraft(draft: DraftRecord<ActivityForm>): void {
    this.form.set({ ...this.svc.emptyForm(), ...draft.data });
    this.pendingDraft.set(null);
  }

  protected discardDraft(): void {
    this.drafts.clear(DRAFT_FORM, 'novo');
    this.pendingDraft.set(null);
  }

  protected save(publish: boolean): void {
    const result = this.svc.save(this.form(), publish);
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    this.errors.set([]);
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.drafts.clear(DRAFT_FORM, 'novo');
    const activity = result.value;
    this.toasts.success(
      publish ? 'Atividade publicada. As inscrições estão abertas.' : this.editing() ? 'Alterações salvas.' : 'Rascunho salvo na programação.',
    );
    void this.router.navigate(['/app/grupos', activity.id]);
  }
}
