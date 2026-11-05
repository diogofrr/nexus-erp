import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock, ageInYears } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatDateTime } from '@core/format';
import type { Caregiver, Dependency } from '@core/models';
import { ConsentService } from '@core/privacy';
import {
  BadgeComponent,
  CardComponent,
  DescriptionListComponent,
  DescriptionItem,
  EmptyStateComponent,
  FormFieldComponent,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  RadioGroupComponent,
  RadioOption,
} from '@shared/ui';
import { DrawerComponent, ToastService } from '@shared/ui/overlay';
import { DEPENDENCY_HINTS, DEPENDENCY_LABELS } from '../state/caregiver-labels';
import { CaregiverService } from '../state/caregiver.service';
import { SupervisionService } from '../state/supervision.service';
import { SupervisionGateComponent } from './supervision-gate.component';

const APPOINTMENT_KINDS: Record<string, string> = {
  medical: 'Consulta médica',
  physio: 'Fisioterapia',
  psychological: 'Atendimento psicológico',
  other: 'Outro compromisso',
};

/**
 * Pessoa idosa e cuidados (SCR-M03-04): dados cadastrais, grau de dependência, condições de saúde,
 * medicamentos e compromissos. Condições e medicamentos só aparecem depois do consentimento de saúde
 * (U-08) e cada leitura grava `view` no log (dado sensível). O atendimento consulta sem editar (matriz);
 * o responsável técnico passa pelo portão de supervisão.
 */
@Component({
  selector: 'app-elder-care',
  imports: [
    BadgeComponent,
    CardComponent,
    DescriptionListComponent,
    DrawerComponent,
    EmptyStateComponent,
    FormFieldComponent,
    NxInputDirective,
    NxMaskDirective,
    RadioGroupComponent,
    ReactiveFormsModule,
    SupervisionGateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack stack--6 sensitive">
      @if (!elder()) {
        <app-empty-state title="Sem pessoa idosa vinculada" text="Cada cuidador tem uma pessoa idosa. Peça ao atendimento para completar o cadastro." />
      } @else {
        <app-card title="Dados da pessoa idosa" subtitle="Só o necessário para organizar a rotina de cuidados">
          @if (canEdit()) {
            <button appCardActions type="button" class="btn btn--sm" (click)="openEdit()">Editar dados da pessoa idosa</button>
          }
          <app-description-list [items]="items()" />
        </app-card>

        @if (gated()) {
          <app-supervision-gate [caregiverId]="caregiver().id" what="os dados de saúde da pessoa idosa" />
        } @else if (!healthGranted()) {
          <app-card title="Condições de saúde, medicamentos e compromissos">
            <app-empty-state compact kind="forbidden" title="Disponível depois do consentimento de saúde" text="Para não coletar dado de saúde antes de o consentimento existir, estes campos ficam fechados até lá. O atendimento registra o consentimento na aba Consentimentos." />
          </app-card>
        } @else {
          <app-card title="Condições de saúde" subtitle="Dado sensível, cifrado em repouso (simulado)">
            @if (elder()?.conditionsSummary) {
              <p data-role="conditions">{{ elder()?.conditionsSummary }}</p>
            } @else {
              <p class="t-muted">Nenhuma condição registrada. Os dados vêm do aplicativo do cuidador.</p>
            }
          </app-card>
          <app-card title="Medicamentos">
            @if (medications().length === 0) {
              <p class="t-muted">Nenhum medicamento registrado.</p>
            } @else {
              <div class="table-wrap table-wrap--flush">
                <table class="table table--stack">
                  <caption class="sr-only">Medicamentos da pessoa idosa</caption>
                  <thead><tr><th scope="col">Medicamento</th><th scope="col">Dose</th><th scope="col">Horários</th><th scope="col">Situação</th></tr></thead>
                  <tbody>
                    @for (m of medications(); track m.id) {
                      <tr>
                        <td data-label="Medicamento" class="col-primary">{{ m.name }}</td>
                        <td data-label="Dose">{{ m.dosage }}</td>
                        <td data-label="Horários">{{ m.times.join(', ') }}</td>
                        <td data-label="Situação"><app-badge [variant]="m.active ? 'success' : 'neutral'" [icon]="m.active ? 'circle-check' : 'pause'">{{ m.active ? 'Em uso' : 'Suspenso' }}</app-badge></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </app-card>
          <app-card title="Compromissos de cuidado">
            @if (appointments().length === 0) {
              <p class="t-muted">Nenhum compromisso agendado.</p>
            } @else {
              <ul class="stack stack--3 list-reset">
                @for (a of appointments(); track a.id) {
                  <li>
                    <strong>{{ a.title }}</strong>
                    <span class="t-caption"> · {{ kindLabel(a.kind) }} · {{ formatAt(a.at) }}{{ a.reminder ? ' · com lembrete' : '' }}</span>
                  </li>
                }
              </ul>
            }
          </app-card>
        }
      }
    </div>

    <app-drawer [(open)]="editOpen" heading="Editar dados da pessoa idosa" [subtitle]="'Cuidador ' + caregiver().code">
      <form id="nx-elder-form" class="stack stack--3" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Nome completo" controlId="nx-elder-name" [forceErrors]="submitted()">
          <input appInput formControlName="fullName" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Data de nascimento" hint="Digite dia, mês e ano." controlId="nx-elder-birth" [forceErrors]="submitted()">
          <input appInput appMask="date" formControlName="birthDate" />
        </app-form-field>
        <app-form-field label="Grau de dependência" group controlId="nx-elder-dependency" [forceErrors]="submitted()">
          <app-radio-group [options]="dependencyOptions" formControlName="dependency" />
        </app-form-field>
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="editOpen.set(false)">Voltar</button>
        <button type="submit" form="nx-elder-form" class="btn btn--primary">Salvar dados</button>
      </ng-container>
    </app-drawer>
  `,
})
export class ElderCareComponent {
  private readonly auth = inject(AuthService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly consent = inject(ConsentService);
  private readonly service = inject(CaregiverService);
  private readonly supervision = inject(SupervisionService);
  private readonly toasts = inject(ToastService);

  readonly caregiver = input.required<Caregiver>();

  protected readonly editOpen = signal(false);
  protected readonly submitted = signal(false);
  protected readonly dependencyOptions: RadioOption<Dependency>[] = (['independent', 'partial', 'total'] as Dependency[]).map((value) => ({
    value,
    label: DEPENDENCY_LABELS[value],
    hint: DEPENDENCY_HINTS[value],
  }));
  protected readonly form = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [NxValidators.required('o nome completo da pessoa idosa')] }),
    birthDate: new FormControl<string | null>(null, [NxValidators.required('a data de nascimento da pessoa idosa')]),
    dependency: new FormControl<Dependency | null>(null, [NxValidators.required('o grau de dependência')]),
  });

  protected readonly elder = computed(() => {
    this.db.elders.all();
    return this.db.elders.find((e) => e.caregiverId === this.caregiver().id);
  });
  protected readonly canEdit = computed(() => this.auth.can('caregiver_registry', 'update'));
  protected readonly healthGranted = computed(() => {
    this.db.consents.all();
    return this.consent.isActive(this.caregiver().id, 'health_data');
  });
  /** O responsável técnico precisa da justificativa antes de ver dado de saúde (supervisão). */
  protected readonly gated = computed(
    () => this.auth.role() === 'technical_lead' && this.healthGranted() && !this.supervision.isGranted(this.caregiver().id),
  );
  protected readonly medications = computed(() => {
    const elder = this.elder();
    return elder ? this.db.medications.query((m) => m.elderId === elder.id) : [];
  });
  protected readonly appointments = computed(() => {
    const elder = this.elder();
    return elder
      ? this.db.careAppointments.query((a) => a.elderId === elder.id).sort((a, b) => a.at.localeCompare(b.at))
      : [];
  });

  protected readonly items = computed<DescriptionItem[]>(() => {
    const e = this.elder();
    if (!e) {
      return [];
    }
    return [
      { label: 'Nome', value: e.fullName },
      { label: 'Nascimento', value: `${formatDate(e.birthDate)} (${ageInYears(e.birthDate, this.clock.today())} anos)` },
      { label: 'Grau de dependência', value: DEPENDENCY_LABELS[e.dependency] },
      { label: 'Cuidador principal', value: this.caregiver().code },
    ];
  });

  constructor() {
    // Cada leitura de dado de saúde da pessoa idosa fica no log (LP-14); no portão, a supervisão também.
    effect(() => {
      const elder = this.elder();
      const shown = !!elder && this.healthGranted() && !this.gated();
      if (!shown) {
        return;
      }
      untracked(() => {
        if (this.auth.role() === 'technical_lead') {
          this.supervision.record(this.caregiver().id, 'elder_conditions');
        } else {
          this.audit.view('elder_conditions', elder.id, this.caregiver().id);
        }
      });
    });
  }

  protected kindLabel(kind: string): string {
    return APPOINTMENT_KINDS[kind] ?? 'Compromisso';
  }

  protected formatAt(at: string): string {
    return formatDateTime(at);
  }

  protected openEdit(): void {
    const e = this.elder();
    if (!e) {
      return;
    }
    this.submitted.set(false);
    this.form.reset({ fullName: e.fullName, birthDate: e.birthDate, dependency: e.dependency });
    this.editOpen.set(true);
  }

  protected save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    try {
      this.service.updateElder(this.caregiver().id, {
        fullName: value.fullName,
        birthDate: value.birthDate as string,
        dependency: value.dependency as Dependency,
      });
      this.toasts.success('Dados da pessoa idosa salvos.');
      this.editOpen.set(false);
    } catch {
      this.toasts.error('Não foi possível salvar. Tente de novo; se continuar, avise a equipe.');
    }
  }
}
