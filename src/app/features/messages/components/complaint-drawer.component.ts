import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Database } from '@core/data';
import { formatDate, formatTime } from '@core/format';
import type { Channel, Complaint } from '@core/models';
import {
  DraftService,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  NxInputDirective,
  NxValidators,
  fieldErrorMessage,
} from '@shared/ui';
import { DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import { debounceTime } from 'rxjs';
import { ComplaintsService } from '../state/complaints.service';
import {
  CHANNELS,
  CHANNEL_LABELS,
  COMPLAINT_TARGET_LABELS,
} from '../state/message-view';
import { CaregiverPickerComponent } from './caregiver-picker.component';

export interface ComplaintPrefill {
  channel?: Channel;
  caregiverId?: string;
  description?: string;
}

interface DraftData {
  channel: Channel;
  caregiverId: string | null;
  targetType: Complaint['target']['type'];
  providerId: string;
  description: string;
}

const DRAFT_FORM = 'complaint';

/**
 * Abrir reclamação (M11, POP-08): canal, cuidador, alvo, descrição. O prazo de resposta é de 5 dias úteis e
 * começa agora. Rascunho automático (UX 5.12) e "Preencher com exemplo". Gaveta modal, folha no celular.
 */
@Component({
  selector: 'app-complaint-drawer',
  imports: [
    ReactiveFormsModule,
    DrawerComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    NxInputDirective,
    CaregiverPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer
      [(open)]="open"
      heading="Nova reclamação"
      subtitle="O prazo de resposta é de 5 dias úteis, a partir de agora"
    >
      <form id="nx-complaint-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
        @if (pendingDraft(); as draft) {
          <div class="banner banner--attention" role="status" data-role="draft-offer">
            <div class="banner__body">
              <p class="banner__title">Você tem um rascunho de {{ draftWhen() }}</p>
              <div class="banner__actions">
                <button type="button" class="btn btn--sm" data-role="resume-draft" (click)="resume(draft)">
                  Retomar rascunho
                </button>
                <button type="button" class="btn btn--sm" data-role="discard-draft" (click)="discard()">
                  Começar de novo
                </button>
              </div>
            </div>
          </div>
        }
        <app-error-summary [items]="errors()" />
        <app-form-field label="Canal por onde chegou" controlId="complaint-channel">
          <select appInput formControlName="channel">
            @for (c of channels; track c) {
              <option [value]="c">{{ channelLabels[c] }}</option>
            }
          </select>
        </app-form-field>
        <app-caregiver-picker
          id="complaint-caregiver"
          label="Cuidador que reclamou (opcional)"
          [value]="form.controls.caregiverId.value"
          (valueChange)="form.controls.caregiverId.setValue($event)"
        />
        <app-form-field label="Sobre quem ou o quê" controlId="complaint-target">
          <select appInput formControlName="targetType">
            @for (t of targetTypes; track t) {
              <option [value]="t">{{ targetLabels[t] }}</option>
            }
          </select>
        </app-form-field>
        @if (form.controls.targetType.value === 'provider') {
          <app-form-field label="Prestador" controlId="complaint-provider" [forceErrors]="submitted()">
            <select appInput formControlName="providerId">
              <option value="">Escolha o prestador</option>
              @for (p of providers(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </app-form-field>
        }
        <app-form-field
          label="O que aconteceu"
          hint="Descreva o fato, sem juízo. O texto fica restrito a quem trata a reclamação."
          controlId="complaint-description"
          [forceErrors]="submitted()"
        >
          <textarea appInput rows="5" formControlName="description"></textarea>
        </app-form-field>
        <p class="t-caption t-muted" aria-live="polite" data-role="draft-status">
          @if (savedAt(); as at) {
            Rascunho salvo às {{ at }}
          }
        </p>
        @if (prefs.fillWithExample()) {
          <div>
            <button type="button" class="btn btn--ghost btn--sm" data-role="fill-example" (click)="fillExample()">
              Preencher com exemplo
            </button>
          </div>
        }
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button type="submit" form="nx-complaint-form" class="btn btn--primary" data-role="open-complaint">
          Abrir reclamação
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class ComplaintDrawerComponent {
  private readonly db = inject(Database);
  private readonly service = inject(ComplaintsService);
  private readonly drafts = inject(DraftService);
  private readonly toasts = inject(ToastService);
  protected readonly prefs = inject(UiPrefsService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = model(false);
  /** Dados que já se sabem (a partir de uma mensagem). */
  readonly prefill = input<ComplaintPrefill | null>(null);
  readonly created = output<Complaint>();

  protected readonly channels = CHANNELS;
  protected readonly channelLabels = CHANNEL_LABELS;
  protected readonly targetLabels = COMPLAINT_TARGET_LABELS;
  protected readonly targetTypes = Object.keys(COMPLAINT_TARGET_LABELS) as Complaint['target']['type'][];
  protected readonly submitted = signal(false);
  protected readonly errors = signal<ErrorSummaryItem[]>([]);
  protected readonly savedAt = signal<string | null>(null);
  protected readonly pendingDraft = signal<DraftData | null>(null);
  protected readonly draftWhen = signal('hoje');

  protected readonly providers = computed(() =>
    [...this.db.providers.all()]
      .filter((p) => p.status !== 'candidate' && p.status !== 'rejected')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  );

  protected readonly form = this.fb.group({
    channel: this.fb.control<Channel>('phone'),
    caregiverId: new FormControl<string | null>(null),
    targetType: this.fb.control<Complaint['target']['type']>('provider'),
    providerId: this.fb.control(''),
    description: this.fb.control('', [
      NxValidators.required('o que aconteceu'),
      Validators.minLength(10),
    ]),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.start());
      }
    });
    this.form.valueChanges
      .pipe(debounceTime(1500), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.saveDraft());
  }

  private start(): void {
    this.submitted.set(false);
    this.errors.set([]);
    this.savedAt.set(null);
    const prefill = this.prefill();
    this.form.reset({
      channel: prefill?.channel ?? 'phone',
      caregiverId: prefill?.caregiverId ?? null,
      targetType: 'provider',
      providerId: '',
      description: prefill?.description ?? '',
    });
    const draft = prefill ? null : this.drafts.load<DraftData>(DRAFT_FORM);
    this.pendingDraft.set(draft ? draft.data : null);
    this.draftWhen.set(draft ? this.drafts.describe(draft) : 'hoje');
  }

  private saveDraft(): void {
    if (!this.open() || this.pendingDraft()) {
      return;
    }
    const value = this.form.getRawValue();
    if (!value.description.trim() && !value.caregiverId) {
      return;
    }
    const record = this.drafts.save<DraftData>(DRAFT_FORM, 'novo', {
      channel: value.channel,
      caregiverId: value.caregiverId,
      targetType: value.targetType,
      providerId: value.providerId,
      description: value.description,
    });
    this.savedAt.set(formatTime(record.savedAt));
  }

  protected resume(draft: DraftData): void {
    this.form.reset({ ...draft });
    this.pendingDraft.set(null);
  }

  protected discard(): void {
    this.drafts.clear(DRAFT_FORM);
    this.pendingDraft.set(null);
  }

  protected fillExample(): void {
    this.form.patchValue({
      channel: 'phone',
      caregiverId: 'cg_0005',
      targetType: 'provider',
      providerId: this.providers()[0]?.id ?? '',
      description: 'A família conta que o atendimento combinado não aconteceu no horário marcado e ninguém avisou.',
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const f = this.form.controls;
    const list: ErrorSummaryItem[] = [];
    if (f.targetType.value === 'provider' && !f.providerId.value) {
      list.push({ controlId: 'complaint-provider', message: 'Escolha o prestador citado na reclamação.' });
    }
    const description = fieldErrorMessage(f.description.errors, 'o que aconteceu');
    if (description) {
      list.push({ controlId: 'complaint-description', message: description });
    }
    this.errors.set(list);
    if (list.length > 0) {
      return;
    }
    const value = this.form.getRawValue();
    const complaint = this.service.open({
      channel: value.channel,
      ...(value.caregiverId ? { caregiverId: value.caregiverId } : {}),
      targetType: value.targetType,
      ...(value.targetType === 'provider' ? { providerId: value.providerId } : {}),
      description: value.description,
    });
    this.drafts.clear(DRAFT_FORM);
    this.toasts.success(
      `Reclamação ${complaint.protocol} aberta. Responder até ${formatDate(complaint.dueAt)}, ${formatTime(complaint.dueAt)}.`,
    );
    this.open.set(false);
    this.created.emit(complaint);
  }
}
