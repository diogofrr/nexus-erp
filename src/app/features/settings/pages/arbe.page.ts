import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AuditLogService } from '../../../core/audit/audit-log.service';
import { Database } from '../../../core/data/database';
import { ArbeSettings } from '../../../core/models/zarit';
import { DEFAULT_ARBE_SETTINGS } from '../../../core/rules/arbe';
import { ArbePreviewComponent } from '../../../shared/ui/display/arbe-preview.component';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { DialogService } from '../../../shared/ui/overlay/dialog.service';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { NumberFieldComponent, integerValidator } from '../components/number-field.component';

interface ArbeField {
  key: keyof ArbeSettings;
  label: string;
  noun: string;
  hint: string;
  unit: string;
  min: number;
  max: number;
}

const FIELDS: readonly ArbeField[] = [
  {
    key: 'hoursThreshold',
    label: 'Horas por dia de cuidado',
    noun: 'o limite de horas por dia',
    hint: 'O critério vale quando o cuidador cuida por este número de horas ou mais.',
    unit: 'horas por dia',
    min: 1,
    max: 24,
  },
  {
    key: 'supportRequestsThreshold',
    label: 'Pedidos de apoio na janela',
    noun: 'o número de pedidos de apoio',
    hint: 'O critério vale com este número de pedidos ou mais.',
    unit: 'pedidos',
    min: 1,
    max: 20,
  },
  {
    key: 'windowDays',
    label: 'Janela dos pedidos de apoio',
    noun: 'a janela de dias',
    hint: 'Os pedidos contam só dentro desta janela.',
    unit: 'dias',
    min: 1,
    max: 90,
  },
  {
    key: 'zaritThreshold',
    label: 'Pontuação da escala para o critério',
    noun: 'a pontuação do critério',
    hint: 'O critério da escala vale a partir desta pontuação.',
    unit: 'pontos',
    min: 0,
    max: 88,
  },
  {
    key: 'criticalZarit',
    label: 'Pontuação que torna o alerta crítico',
    noun: 'a pontuação do alerta crítico',
    hint: 'Com esta pontuação ou mais, o alerta é crítico por si só.',
    unit: 'pontos',
    min: 0,
    max: 88,
  },
];

/** A pontuação do alerta crítico não pode ser menor que a do critério (erro no campo e no resumo). */
function criticalNotBelow(control: AbstractControl): ValidationErrors | null {
  const group = control.parent;
  const threshold = group?.get('zaritThreshold')?.value;
  const critical = control.value;
  return typeof threshold === 'number' && typeof critical === 'number' && critical < threshold
    ? { criticalBelowThreshold: true }
    : null;
}

export const ARBE_CRITICAL_TEXT =
  'A pontuação do alerta crítico deve ser igual ou maior que a do critério.';

/**
 * Parâmetros da ARBE (SCR-M15-04, o mesmo conteúdo de SCR-M06-08): os cinco limites do alerta de risco de
 * esgotamento. Edita quem a matriz libera: o responsável técnico e a sócia (AC-M15-08). Os padrões são
 * suposições do protótipo (S-11): 8 horas por dia, 3 pedidos em 30 dias, escala a partir de 41 e crítico a
 * partir de 61. O alerta é um sinal para a escuta clínica, não um diagnóstico.
 */
@Component({
  selector: 'app-settings-arbe-page',
  imports: [ReactiveFormsModule, NumberFieldComponent, IconComponent, ArbePreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Parâmetros da ARBE</h1>
            <p class="page-header__desc">
              Limites que geram o alerta de risco de esgotamento do cuidador. O alerta apoia a
              escuta clínica: a decisão é sempre do psicólogo.
            </p>
          </div>
          <div class="page-header__actions">
            <button type="button" class="btn" data-role="restore" (click)="restoreDefaults()">
              <svg appIcon="undo-2"></svg>Restaurar padrões
            </button>
            <button type="submit" form="nx-arbe-form" class="btn btn--primary" data-role="save">
              Salvar parâmetros
            </button>
          </div>
        </div>
      </header>

      <form
        id="nx-arbe-form"
        class="stack stack--6"
        novalidate
        [formGroup]="form"
        (ngSubmit)="save()"
      >
        @if (errors().length > 0) {
          <div class="error-summary" role="alert" tabindex="-1">
            <h2>
              <svg appIcon="circle-alert"></svg>Há {{ errors().length }}
              {{ errors().length === 1 ? 'ponto' : 'pontos' }} para corrigir
            </h2>
            <ul>
              @for (text of errors(); track text) {
                <li>{{ text }}</li>
              }
            </ul>
          </div>
        }

        <section class="card card--pad stack stack--3">
          <h2 class="card__title">Quando o alerta é gerado</h2>
          <p class="t-muted t-ui">
            O alerta de atenção aparece quando 2 de 3 critérios valem: horas por dia, pedidos de
            apoio e pontuação da escala. Pontuação igual ou acima do limite crítico gera alerta
            crítico sozinha.
          </p>
          <div class="form-grid">
            @for (field of fields; track field.key) {
              <app-number-field
                [control]="control(field.key)"
                [label]="field.label"
                [noun]="field.noun"
                [hint]="field.hint"
                [unit]="field.unit"
                [min]="field.min"
                [max]="field.max"
                [errorTexts]="criticalTexts"
              />
            }
          </div>
        </section>
      </form>

      <app-arbe-preview [settings]="draft()" />
    </div>
  `,
})
export class ArbePageComponent {
  private readonly db = inject(Database);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly audit = inject(AuditLogService);
  private readonly dialogs = inject(DialogService);
  private readonly preview = viewChild(ArbePreviewComponent);

  protected readonly fields = FIELDS;
  protected readonly criticalTexts = { criticalBelowThreshold: ARBE_CRITICAL_TEXT };
  private readonly tick = signal(0);

  protected readonly form = this.buildForm();
  /** Faz a prévia acompanhar o que se digita, antes de salvar (CX-021). */
  private readonly watchForm = this.form.valueChanges.subscribe(() => this.tick.update((n) => n + 1));
  /** Limites do formulário quando válidos; `null` enquanto houver erro. */
  protected readonly draft = computed<ArbeSettings | null>(() => {
    this.tick();
    return this.form.valid ? this.form.getRawValue() : null;
  });
  protected readonly errors = computed(() => {
    this.tick();
    return this.errorList();
  });

  protected control(key: string): FormControl<number> {
    return this.form.get(key) as FormControl<number>;
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.tick.update((n) => n + 1);
    if (this.form.invalid) {
      return;
    }
    if (this.form.pristine) {
      this.toasts.success('Nada mudou.');
      return;
    }
    // Quando algum cuidador muda de nível, a pessoa confirma sabendo o efeito (CX-021).
    const preview = this.preview();
    if (preview && preview.changedCount() > 0) {
      const { confirmed } = await this.dialogs.confirm({
        title: 'Salvar os novos limites da ARBE?',
        message: preview.changeText(),
        effects: { keep: ['os alertas já tratados e o histórico'] },
        confirmLabel: 'Salvar os limites',
        cancelLabel: 'Voltar',
      });
      if (!confirmed) {
        return;
      }
    }
    const previous = this.db.settings.get().arbe;
    const next: ArbeSettings = this.form.getRawValue();
    this.db.settings.patch({ arbe: next });
    this.audit.write(
      'update',
      'arbe_settings',
      undefined,
      undefined,
      'parâmetros da ARBE alterados',
    );
    this.form.markAsPristine();
    this.toasts.success('Parâmetros da ARBE salvos.', {
      label: 'Desfazer',
      run: () => {
        this.db.settings.patch({ arbe: previous });
        this.form.reset(previous);
        this.tick.update((n) => n + 1);
      },
    });
  }

  protected restoreDefaults(): void {
    this.form.patchValue({ ...DEFAULT_ARBE_SETTINGS });
    this.form.markAsDirty();
    this.tick.update((n) => n + 1);
  }

  private num(value: number, min: number, max: number): FormControl<number> {
    return this.fb.control(value, [
      Validators.required,
      Validators.min(min),
      Validators.max(max),
      integerValidator,
    ]);
  }

  private buildForm() {
    const current = this.db.settings.get().arbe;
    const group = this.fb.group({
      hoursThreshold: this.num(current.hoursThreshold, 1, 24),
      supportRequestsThreshold: this.num(current.supportRequestsThreshold, 1, 20),
      windowDays: this.num(current.windowDays, 1, 90),
      zaritThreshold: this.num(current.zaritThreshold, 0, 88),
      criticalZarit: this.num(current.criticalZarit, 0, 88),
    });
    group.controls.criticalZarit.addValidators(criticalNotBelow);
    group.controls.zaritThreshold.valueChanges.subscribe(() =>
      group.controls.criticalZarit.updateValueAndValidity(),
    );
    return group;
  }

  private errorList(): string[] {
    const list: string[] = [];
    FIELDS.forEach((f) => {
      const c = this.control(f.key);
      if (!c.invalid || !c.touched) {
        return;
      }
      if (c.errors?.['criticalBelowThreshold']) {
        list.push(ARBE_CRITICAL_TEXT);
      } else if (c.errors?.['required']) {
        list.push(`Informe ${f.noun}.`);
      } else {
        list.push(
          `${f.noun.charAt(0).toUpperCase()}${f.noun.slice(1)} deve ser um número inteiro de ${f.min} a ${f.max}.`,
        );
      }
    });
    return list;
  }
}
