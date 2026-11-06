import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DoseCheckError, DoseCheckService } from '../../../../core/care/dose-check.service';
import { Clock } from '../../../../core/clock/clock.service';
import { timeOf } from '../../../../core/clock/date-utils';
import { ID, Medication } from '../../../../core/models';
import { isTimeOfDay } from '../../../../core/rules/care-agenda';
import { NAME_MAX_CHARS, tooLongText } from '../../../../core/rules/text-limits';
import { DoseSlot, doseProgress } from '../../../../core/rules/medication-doses';
import { EmptyStateComponent } from '../../../../shared/ui/display/empty-state.component';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { ErrorSummaryComponent, ErrorSummaryItem } from '../../../../shared/ui/forms/error-summary.component';
import { FormFieldComponent } from '../../../../shared/ui/forms/form-field.component';
import { NxInputDirective } from '../../../../shared/ui/forms/input.directive';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { firstLateKey, freezeDoseOrder } from '../../state/dose-order';
import { OnlineStatusService } from '../../state/online-status.service';
import { StorageStatusService, doseNotSavedText } from '../../state/storage-status.service';
import { CgDoseComponent } from '../../ui/cg-dose.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgRowComponent } from '../../ui/cg-row.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import { CgSwitchComponent } from '../../ui/cg-switch.component';
import { RoutineTabsComponent } from '../components/routine-tabs.component';
import {
  MEDICATION_PRESET_TIMES,
  MedicationError,
  MedicationInput,
  MedicationService,
  medicationProblems,
  normalizeTimes,
} from '../state/medication.service';

const SAVE_FAILED = 'Não foi possível salvar. Tente de novo; se continuar, fale com a gente.';
const PRESET_SET: ReadonlySet<string> = new Set(MEDICATION_PRESET_TIMES.map((p) => p.time));

/**
 * Rotina, aba Remédios (UX C6, `/cuidador/rotina/remedios`): **Hoje** com todas as doses do dia e **Dei** em cada
 * uma, o aviso fixo de que o app só ajuda a lembrar, **Todos os remédios** (tocar abre a edição), **Adicionar
 * remédio** e "Em pausa" (recolhido). O remédio NUNCA é apagado: a chave "Este remédio está em uso" o põe em pausa e
 * o histórico fica. O app não orienta dose, não troca remédio e não pede motivo nem condição de saúde (RN-ATD-11,
 * RN-USR-09). Tocar numa dose dada abre "Dei em outro horário" (S-06).
 */
@Component({
  selector: 'app-medications-page',
  imports: [
    CgDoseComponent,
    CgNoteComponent,
    CgPageHeaderComponent,
    CgRowComponent,
    CgSheetComponent,
    CgSwitchComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    ReactiveFormsModule,
    RoutineTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .routine-panel {
      display: grid;
      gap: var(--cg-gap-block);
      grid-template-columns: minmax(0, 1fr);
    }
    .routine-panel .cg-actions,
    .routine-block .cg-actions {
      margin-top: 0;
    }
    .routine-block > h2 {
      margin: 0;
    }
    .routine-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.25rem 1rem;
    }
    .routine-head > h2 {
      margin: 0;
    }
    .routine-progress {
      color: var(--cg-text-soft);
      font-size: var(--cg-fs-small);
      font-weight: var(--fw-semibold);
    }
    .routine-dose {
      display: grid;
      gap: 0.25rem;
      justify-items: start;
    }
    .routine-dose > app-cg-dose {
      justify-self: stretch;
    }
    .routine-form {
      display: grid;
      gap: 1.25rem;
    }
    .routine-times {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;
    }
    .routine-times > legend {
      padding: 0;
      margin-bottom: 0.5rem;
      font-weight: var(--fw-semibold);
    }
    .routine-time {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: var(--cg-target-lg);
      padding: 0.5rem 1rem;
      border: 2px solid var(--cg-border-control);
      border-radius: var(--cg-radius-control);
      background: var(--cg-surface);
      font-weight: var(--fw-semibold);
      cursor: pointer;
    }
    .routine-time.is-selected {
      border-color: var(--cg-action);
      background: var(--brand-soft);
    }
    .routine-time:focus-within {
      outline: 3px solid var(--cg-focus);
      outline-offset: 3px;
    }
    .routine-time__input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .routine-time__box {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 1.75rem;
      height: 1.75rem;
      border: 2px solid var(--cg-border-control);
      border-radius: 0.375rem;
      background: var(--cg-surface);
    }
    .routine-time.is-selected .routine-time__box {
      border-color: var(--cg-action);
      background: var(--cg-action);
      color: #fff;
    }
    .routine-other {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
    }
    .routine-other app-form-field {
      flex: 1 1 10rem;
    }
  `,
  template: `
    <app-cg-page-header title="Rotina" />
    <app-routine-tabs current="remedios" panelId="routine-panel" />

    <div class="routine-panel" id="routine-panel" role="tabpanel" aria-labelledby="routine-tab-remedios">
      @if (!online.online()) {
        <app-cg-note variant="soft" icon="info">Você está sem conexão. Seus dados continuam neste navegador.</app-cg-note>
      }

      @if (!hasAny()) {
        <app-empty-state
          title="Você ainda não cadastrou remédios"
          text="Cadastre os remédios e o app mostra, a cada dia, os horários de cada um."
        >
          <button type="button" class="btn btn--primary" (click)="openNew()">Cadastrar um remédio</button>
        </app-empty-state>
      } @else {
        <section class="routine-block cg-stack cg-stack--tight" aria-labelledby="routine-today-title">
          <div class="routine-head">
            <h2 class="cg-section__title" id="routine-today-title">Hoje</h2>
            @if (progress().total > 0) {
              <span class="routine-progress">{{ progress().given }} de {{ progress().total }} dados</span>
            }
          </div>
          @if (slots().length > 0) {
            <ul class="cg-plain-list">
              @for (slot of slots(); track slot.key) {
                <li class="routine-dose">
                  <app-cg-dose
                    [slot]="slot"
                    [size]="ctx.doseSize()"
                    [quietLate]="slot.key !== lateKey()"
                    (dei)="dei($event)"
                    (undo)="undo($event)"
                  />
                  @if (slot.given) {
                    <button type="button" class="cg-link-btn" (click)="openTime(slot)">
                      Dei em outro horário<span class="sr-only">: {{ slot.medicationName }} das {{ slot.time }}</span>
                    </button>
                  }
                </li>
              }
            </ul>
          } @else {
            <app-cg-note variant="soft" icon="pill">Hoje não há remédios para dar.</app-cg-note>
          }
        </section>
      }

      <app-cg-note variant="soft" icon="info">
        O app só ajuda você a lembrar. Dúvida sobre dose ou troca de remédio: fale com o médico ou a farmácia.
      </app-cg-note>

      @if (hasAny()) {
        <section class="routine-block cg-stack cg-stack--tight" aria-labelledby="routine-all-title">
          <h2 class="cg-section__title" id="routine-all-title">Todos os remédios</h2>
          @if (repeatsToday()) {
            <div>
              <button
                type="button"
                class="cg-link-btn"
                data-role="edit-toggle"
                [attr.aria-expanded]="showAll()"
                (click)="showAll.set(!showAll())"
              >
                {{ showAll() ? 'Esconder a lista' : 'Mudar ou pausar um remédio (' + inUse().length + ')' }}
              </button>
            </div>
          }
          @if (inUse().length > 0 && (showAll() || !repeatsToday())) {
            <ul class="cg-list" data-role="all-meds">
              @for (med of inUse(); track med.id) {
                <li>
                  <app-cg-row
                    [title]="med.name"
                    [description]="describe(med)"
                    icon="pill"
                    (activated)="openEdit(med.id)"
                  />
                </li>
              }
            </ul>
          } @else if (inUse().length === 0) {
            <app-cg-note variant="soft" icon="pill">Nenhum remédio em uso agora.</app-cg-note>
          }
          <div class="cg-actions">
            <button type="button" class="btn" (click)="openNew()">
              <svg appIcon="plus" size="sm"></svg>
              Adicionar remédio
            </button>
          </div>
        </section>

        @if (paused().length > 0) {
          <section class="routine-block cg-stack cg-stack--tight" aria-labelledby="routine-paused-title">
            <h2 class="cg-section__title" id="routine-paused-title">Em pausa</h2>
            <div>
              <button type="button" class="cg-link-btn" [attr.aria-expanded]="showPaused()" (click)="showPaused.set(!showPaused())">
                {{ showPaused() ? 'Esconder os remédios em pausa' : 'Ver os remédios em pausa (' + paused().length + ')' }}
              </button>
            </div>
            @if (showPaused()) {
              <ul class="cg-list">
                @for (med of paused(); track med.id) {
                  <li>
                    <app-cg-row
                      [title]="med.name"
                      [description]="describe(med)"
                      icon="pill"
                      (activated)="openEdit(med.id)"
                    >
                      <span cgRowEnd class="cg-tag">Em pausa</span>
                    </app-cg-row>
                  </li>
                }
              </ul>
            }
          </section>
        }
      }
    </div>

    <app-cg-sheet [heading]="editingId() ? 'Editar remédio' : 'Novo remédio'" [(open)]="formOpen">
      <form class="routine-form" [formGroup]="form" novalidate (ngSubmit)="save()">
        <app-error-summary short [items]="errorItems()" />

        <app-form-field label="Nome do remédio" controlId="med-name" [error]="messageOf('name')">
          <input appInput formControlName="name" autocomplete="off" />
        </app-form-field>

        <app-form-field
          label="Dose"
          [optional]="true"
          hint="Como está na receita. Exemplo: 50 mg, 1 comprimido"
          controlId="med-dosage"
          [error]="messageOf('dosage')"
        >
          <input appInput formControlName="dosage" autocomplete="off" />
        </app-form-field>

        <fieldset class="routine-times" id="med-times">
          <legend>Em que horários?</legend>
          @for (option of timeOptions(); track option.time) {
            <label class="routine-time" [class.is-selected]="option.chosen">
              <input
                class="routine-time__input"
                type="checkbox"
                [checked]="option.chosen"
                (change)="toggleTime(option.time)"
              />
              <span class="routine-time__box" aria-hidden="true">
                @if (option.chosen) {
                  <svg appIcon="check" size="sm"></svg>
                }
              </span>
              <span>{{ option.label }}</span>
            </label>
          }
          @if (messageOf('times'); as problem) {
            <span class="field__error"><svg appIcon="circle-alert" size="sm"></svg><span><span class="sr-only">Erro: </span>{{ problem }}</span></span>
          }
        </fieldset>

        <div class="routine-other">
          <app-form-field label="Outro horário" controlId="med-other" [error]="otherError()">
            <input appInput type="time" [formControl]="otherTime" />
          </app-form-field>
          <button type="button" class="btn" (click)="addOtherTime()">Incluir horário</button>
        </div>

        <app-cg-switch
          label="Este remédio está em uso"
          onText="Em uso"
          offText="Em pausa. Ele não aparece em Hoje nem gera lembrete. O histórico fica guardado."
          [checked]="form.controls.active.value"
          (checkedChange)="form.controls.active.setValue($event)"
        />
        @if (failure(); as text) {
          <app-cg-note variant="error">{{ text }}</app-cg-note>
        }
      </form>
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" (click)="save()">
          {{ editingId() ? 'Salvar alterações' : 'Salvar remédio' }}
        </button>
        <button type="button" class="cg-link-btn" (click)="formOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <app-cg-sheet heading="Dei em outro horário" [(open)]="timeOpen">
      @if (timeSlot(); as slot) {
        <p class="cg-muted">{{ slot.medicationName }}, previsto para as {{ slot.time }}.</p>
      }
      <app-form-field label="Hora" controlId="dose-time" [error]="timeError()">
        <input appInput type="time" [formControl]="givenTime" />
      </app-form-field>
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" (click)="saveTime()">Salvar horário</button>
        <button type="button" class="cg-link-btn" (click)="timeOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class MedicationsPage {
  protected readonly ctx = inject(CaregiverContextService);
  private readonly doses = inject(DoseCheckService);
  private readonly meds = inject(MedicationService);
  private readonly toasts = inject(ToastService);
  private readonly storage = inject(StorageStatusService);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  protected readonly online = inject(OnlineStatusService);

  // ===== O dia e a lista =====

  private readonly clock = inject(Clock);
  private readonly today = computed(() => {
    const elderId = this.ctx.elderId();
    return elderId ? this.doses.forElder(elderId, this.ctx.today()) : [];
  });
  /** O que falta vem primeiro; a ordem fica fixa enquanto a tela está aberta (CXC-005). */
  private readonly order = freezeDoseOrder(this.today());
  protected readonly slots = computed(() => this.order(this.today()));
  /** A primeira linha em atraso leva o âmbar; as outras ficam neutras (CXC-005). */
  protected readonly lateKey = computed(() => firstLateKey(this.slots(), this.clock.now()));
  protected readonly progress = computed(() => doseProgress(this.slots()));
  private readonly all = computed(() => {
    const elderId = this.ctx.elderId();
    return elderId ? this.meds.medicationsOf(elderId) : [];
  });
  protected readonly hasAny = computed(() => this.all().length > 0);
  protected readonly inUse = computed(() => this.all().filter((m) => m.active));
  protected readonly paused = computed(() => this.all().filter((m) => !m.active));
  protected readonly showPaused = signal(false);
  protected readonly showAll = signal(false);
  /** "Todos os remédios" repete a lista de hoje quando cada remédio em uso já aparece lá: então ela fica recolhida. */
  protected readonly repeatsToday = computed(() => {
    const inToday = new Set(this.slots().map((slot) => slot.medicationId));
    return this.inUse().length > 0 && this.inUse().every((med) => inToday.has(med.id));
  });

  protected describe(med: Medication): string {
    return [med.dosage, med.times.join(', ')].filter((part) => part !== '').join(' · ');
  }

  // ===== Dei e desfazer =====

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
        message: error instanceof DoseCheckError ? error.message : SAVE_FAILED,
        tone: 'attention',
        durationMs: 8000,
      });
    }
  }

  /** Reversível: sem confirmação, a qualquer hora do dia (AC-CG-66). */
  protected undo(slot: DoseSlot): void {
    this.doses.unmark(slot.medicationId, slot.date, slot.time);
  }

  // ===== "Dei em outro horário" (S-06) =====

  protected readonly timeOpen = signal(false);
  protected readonly timeSlot = signal<DoseSlot | null>(null);
  protected readonly timeError = signal<string | null>(null);
  protected readonly givenTime = new FormControl('', { nonNullable: true });

  protected openTime(slot: DoseSlot): void {
    this.timeSlot.set(slot);
    this.timeError.set(null);
    this.givenTime.setValue(slot.givenAt ? timeOf(slot.givenAt) : slot.time);
    this.timeOpen.set(true);
  }

  protected saveTime(): void {
    const slot = this.timeSlot();
    if (!slot?.checkId) {
      return;
    }
    const time = this.givenTime.value;
    if (time === '') {
      this.timeError.set('Informe a hora em que você deu.');
      return;
    }
    try {
      this.meds.changeGivenTime(slot.checkId, time);
      this.timeOpen.set(false);
      this.toasts.show({ message: `Horário salvo: ${time}.`, durationMs: 8000 });
    } catch (error) {
      this.timeError.set(error instanceof MedicationError ? error.message : SAVE_FAILED);
    }
  }

  // ===== Novo e editar =====

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<ID | null>(null);
  protected readonly failure = signal<string | null>(null);
  private readonly submitted = signal(false);
  protected readonly times = signal<readonly string[]>([]);
  protected readonly otherError = signal<string | null>(null);
  protected readonly otherTime = new FormControl('', { nonNullable: true });
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    dosage: new FormControl('', { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });
  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Os três horários prontos e, depois deles, os outros que o remédio já tem ou que a pessoa incluiu. */
  protected readonly timeOptions = computed(() => {
    const chosen = new Set(this.times());
    const presets = MEDICATION_PRESET_TIMES.map((p) => ({ time: p.time, label: p.label, chosen: chosen.has(p.time) }));
    const extras = normalizeTimes(this.times().filter((t) => !PRESET_SET.has(t))).map((t) => ({
      time: t,
      label: t,
      chosen: true,
    }));
    return [...presets, ...extras];
  });

  private readonly problems = computed(() => {
    this.values();
    if (!this.submitted()) {
      return [] as { field: string; controlId: string; message: string }[];
    }
    const raw = this.form.getRawValue();
    return medicationProblems({ name: raw.name, dosage: raw.dosage, times: this.times() }).map((p) =>
      p === 'name_required'
        ? { field: 'name', controlId: 'med-name', message: 'Informe o nome do remédio.' }
        : p === 'name_too_long'
          ? { field: 'name', controlId: 'med-name', message: tooLongText(NAME_MAX_CHARS) }
          : p === 'dosage_too_long'
            ? { field: 'dosage', controlId: 'med-dosage', message: tooLongText(NAME_MAX_CHARS) }
            : p === 'times_required'
              ? { field: 'times', controlId: 'med-times', message: 'Escolha pelo menos um horário.' }
              : { field: 'times', controlId: 'med-other', message: 'Informe uma hora no formato 08:00.' },
    );
  });
  protected readonly errorItems = computed<ErrorSummaryItem[]>(() =>
    this.problems().map((p) => ({ controlId: p.controlId, message: p.message })),
  );

  constructor() {
    if (inject(ActivatedRoute).snapshot.queryParamMap.has('novo')) {
      afterNextRender(
        () => {
          this.openNew();
          this.location.replaceState('/cuidador/rotina/remedios');
        },
        { injector: this.injector },
      );
    }
  }

  protected messageOf(field: string): string | null {
    return this.problems().find((p) => p.field === field)?.message ?? null;
  }

  protected openNew(): void {
    this.editingId.set(null);
    this.resetForm({ name: '', dosage: '', active: true }, []);
    this.formOpen.set(true);
  }

  protected openEdit(id: ID): void {
    const med = this.all().find((m) => m.id === id);
    if (!med) {
      return;
    }
    this.editingId.set(id);
    this.resetForm({ name: med.name, dosage: med.dosage, active: med.active }, med.times);
    this.formOpen.set(true);
  }

  private resetForm(value: { name: string; dosage: string; active: boolean }, times: readonly string[]): void {
    this.submitted.set(false);
    this.failure.set(null);
    this.otherError.set(null);
    this.otherTime.setValue('');
    this.times.set(normalizeTimes(times));
    this.form.reset(value);
  }

  protected toggleTime(time: string): void {
    this.times.update((list) => (list.includes(time) ? list.filter((t) => t !== time) : normalizeTimes([...list, time])));
  }

  protected addOtherTime(): void {
    const time = this.otherTime.value;
    if (!isTimeOfDay(time)) {
      this.otherError.set('Informe uma hora no formato 08:00.');
      return;
    }
    this.otherError.set(null);
    this.times.update((list) => normalizeTimes([...list, time]));
    this.otherTime.setValue('');
  }

  protected save(): void {
    this.submitted.set(true);
    this.failure.set(null);
    const raw = this.form.getRawValue();
    if (medicationProblems({ name: raw.name, dosage: raw.dosage, times: this.times() }).length > 0) {
      return;
    }
    const input: MedicationInput = { name: raw.name, dosage: raw.dosage, times: this.times(), active: raw.active };
    try {
      const editing = this.editingId();
      if (editing) {
        this.meds.update(editing, input);
      } else {
        this.meds.add(this.ctx.elderId() ?? '', input);
      }
      this.formOpen.set(false);
      this.toasts.show({
        message: editing ? (input.active ? 'Alterações salvas.' : 'Remédio em pausa. O histórico fica guardado.') : 'Remédio salvo.',
        durationMs: 8000,
      });
    } catch (error) {
      this.failure.set(error instanceof MedicationError && error.problems.length === 0 ? error.message : SAVE_FAILED);
    }
  }
}
