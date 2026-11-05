import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Clock } from '@core/clock';
import { formatDate } from '@core/format';
import { ProviderDocument } from '@core/models';
import { DocumentView, documentView } from '@core/network';
import {
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  FormFieldComponent,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  TableColumn,
  fieldErrorMessage,
} from '@shared/ui';
import { BannerComponent, DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import { DOCUMENT_GRACE, NetworkAdminService } from '../state/network-admin.service';
import { DOCUMENT_KIND_LABEL } from '../state/network-labels';
import { Database } from '@core/data';

interface DocAlert {
  id: string;
  variant: 'danger' | 'attention';
  title: string;
  text: string;
}

interface DocRow {
  id: string;
  kindText: string;
  fileName: string;
  issuedText: string;
  validText: string;
  view: DocumentView;
  state: string;
}

const KINDS = Object.entries(DOCUMENT_KIND_LABEL) as [ProviderDocument['kind'], string][];

/**
 * Documentos do prestador com validade (RN-REDE-21 e 22): situação em texto (válido, vence em N dias, vencido,
 * em conferência), alerta de documento vencido com o prazo de 30 dias e o anexo simulado (só o nome do arquivo).
 * Usado na ficha do prestador e no processo de credenciamento.
 */
@Component({
  selector: 'app-provider-documents',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    BannerComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    FormFieldComponent,
    NxInputDirective,
    NxMaskDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack stack--3">
      @for (alert of alerts(); track alert.id) {
        <app-banner [variant]="alert.variant" [heading]="alert.title">{{ alert.text }}</app-banner>
      }
      <div class="cluster cluster--between">
        <p class="t-caption">No protótipo, só o nome do arquivo é registrado.</p>
        @if (canEdit()) {
          <button type="button" class="btn" data-role="attach-document" (click)="openAttach()">
            Anexar documento (simulado)
          </button>
        }
      </div>
      <app-data-table
        caption="Documentos do prestador"
        noun="documentos"
        [rows]="rows()"
        [columns]="columns"
        emptyTitle="Nenhum documento anexado"
        emptyText="Anexe o registro no conselho, a comprovação de formação, o contrato e o termo de proteção de dados."
      >
        <ng-template appCell="state" let-row>
          <app-badge [variant]="stateVariant(row.view)" [icon]="stateIcon(row.view)">{{ row.state }}</app-badge>
        </ng-template>
      </app-data-table>
    </div>

    <app-drawer [(open)]="attachOpen" heading="Anexar documento" subtitle="Simulado: só o nome do arquivo fica registrado">
      <form id="nx-doc-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="submit()">
        <app-form-field label="Tipo de documento" controlId="doc-kind">
          <select appInput formControlName="kind">
            @for (kind of kinds; track kind[0]) {
              <option [value]="kind[0]">{{ kind[1] }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="Nome do arquivo" controlId="doc-file" [forceErrors]="tried()">
          <input appInput formControlName="fileName" maxlength="120" placeholder="registro-conselho.pdf" />
        </app-form-field>
        <app-form-field
          label="Válido até"
          hint="Obrigatório para o registro no conselho. Digite a data no formato 31/12/2027."
          controlId="doc-valid"
          [optional]="!needsValidity()"
          [forceErrors]="tried()"
        >
          <input appInput appMask="date" inputmode="numeric" formControlName="validUntil" />
        </app-form-field>
        @if (serverError()) {
          <p class="field__error" role="alert" data-role="server-error">{{ serverError() }}</p>
        }
        @if (prefs.fillWithExample()) {
          <div>
            <button type="button" class="btn btn--ghost btn--sm" data-role="fill-example" (click)="fillExample()">
              Preencher com exemplo
            </button>
          </div>
        }
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="attachOpen.set(false)">Voltar</button>
        <button type="submit" form="nx-doc-form" class="btn btn--primary" data-role="submit-document">
          Anexar documento
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class ProviderDocumentsComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly admin = inject(NetworkAdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly prefs = inject(UiPrefsService);

  readonly providerId = input.required<string>();
  readonly editable = input(true);

  protected readonly kinds = KINDS;
  protected readonly attachOpen = signal(false);
  protected readonly tried = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    kind: this.fb.control<ProviderDocument['kind']>('council_registry'),
    fileName: this.fb.control('', NxValidators.required('o nome do arquivo')),
    validUntil: new FormControl<string | null>(null),
  });

  protected readonly canEdit = computed(() => this.editable() && this.admin.isManager());
  protected readonly provider = computed(() => this.db.providers.get(this.providerId()));
  protected readonly needsValidity = signal(true);

  protected readonly columns: TableColumn<DocRow>[] = [
    { key: 'kindText', header: 'Documento', primary: true },
    { key: 'fileName', header: 'Arquivo', muted: true },
    { key: 'issuedText', header: 'Emitido em' },
    { key: 'validText', header: 'Validade' },
    { key: 'state', header: 'Situação', noSearch: true },
  ];

  private readonly documents = computed(() =>
    this.db.providerDocuments.all().filter((d) => d.providerId === this.providerId()),
  );

  protected readonly rows = computed<DocRow[]>(() => {
    const today = this.clock.today();
    return this.documents().map((d) => {
      const view = documentView(d, today);
      return {
        id: d.id,
        kindText: DOCUMENT_KIND_LABEL[d.kind],
        fileName: d.fileName,
        issuedText: formatDate(d.issuedAt),
        validText: d.validUntil ? formatDate(d.validUntil) : 'Sem validade',
        view,
        state: this.stateText(view),
      };
    });
  });

  protected readonly alerts = computed<DocAlert[]>(() => {
    const today = this.clock.today();
    const provider = this.provider();
    const inOperation = provider?.status === 'active' || provider?.status === 'monitoring';
    const left = this.admin.documentGraceLeft(this.providerId());
    return this.documents().flatMap((d): DocAlert[] => {
      const view = documentView(d, today);
      const kind = DOCUMENT_KIND_LABEL[d.kind];
      if (view.state === 'expired' && d.validUntil) {
        const days = Math.abs(view.daysLeft ?? 0);
        return [
          {
            id: d.id,
            variant: 'danger' as const,
            title: `${kind} vencido`,
            text: inOperation
              ? `Venceu em ${formatDate(d.validUntil)} (há ${days} ${days === 1 ? 'dia' : 'dias'}). Faltam ${Math.max(0, left ?? DOCUMENT_GRACE)} dias para regularizar; depois o prestador sai da busca com o motivo "documento vencido".`
              : `Venceu em ${formatDate(d.validUntil)} (há ${days} ${days === 1 ? 'dia' : 'dias'}). É preciso um documento válido para aprovar.`,
          },
        ];
      }
      if (view.state === 'expiring' && d.validUntil) {
        return [
          {
            id: d.id,
            variant: 'attention' as const,
            title: `${kind} vence em ${view.daysLeft} ${view.daysLeft === 1 ? 'dia' : 'dias'}`,
            text: `A validade termina em ${formatDate(d.validUntil)}. Peça o novo documento ao prestador.`,
          },
        ];
      }
      return [];
    });
  });

  constructor() {
    this.form.controls.kind.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.syncValidity());
    effect(() => {
      if (this.attachOpen()) {
        untracked(() => this.resetForm());
      }
    });
  }

  private stateText(view: DocumentView): string {
    switch (view.state) {
      case 'expired':
        return `Vencido há ${Math.abs(view.daysLeft ?? 0)} dias`;
      case 'expiring':
        return `Vence em ${view.daysLeft} ${view.daysLeft === 1 ? 'dia' : 'dias'}`;
      case 'in_review':
        return 'Enviado, em conferência';
      default:
        return 'Válido';
    }
  }

  protected stateVariant(view: DocumentView): 'success' | 'attention' | 'danger' | 'info' {
    return view.state === 'expired' ? 'danger' : view.state === 'expiring' ? 'attention' : view.state === 'in_review' ? 'info' : 'success';
  }

  protected stateIcon(view: DocumentView): 'circle-check' | 'triangle-alert' | 'circle-alert' | 'clock' {
    return view.state === 'expired' ? 'circle-alert' : view.state === 'expiring' ? 'triangle-alert' : view.state === 'in_review' ? 'clock' : 'circle-check';
  }

  private syncValidity(): void {
    const provider = this.provider();
    this.needsValidity.set(this.form.controls.kind.value === 'council_registry' && provider?.council.body !== 'NONE');
  }

  private resetForm(): void {
    const expired = this.documents().find((d) => documentView(d, this.clock.today()).state === 'expired');
    this.form.reset({ kind: expired?.kind ?? 'council_registry', fileName: '', validUntil: null });
    this.tried.set(false);
    this.serverError.set(null);
    this.syncValidity();
  }

  protected openAttach(): void {
    this.attachOpen.set(true);
  }

  protected fillExample(): void {
    const kind = this.form.controls.kind.value;
    this.form.patchValue({
      fileName: `${kind.replace(/_/g, '-')}-novo.pdf`,
      validUntil: this.clock.addDays(365),
    });
  }

  protected submit(): void {
    this.tried.set(true);
    this.form.markAllAsTouched();
    const fileError = fieldErrorMessage(this.form.controls.fileName.errors, 'o nome do arquivo');
    if (fileError) {
      return;
    }
    const value = this.form.getRawValue();
    const result = this.admin.attachDocument(this.providerId(), {
      kind: value.kind,
      fileName: value.fileName,
      ...(value.validUntil ? { validUntil: value.validUntil } : {}),
    });
    if (!result.ok) {
      this.serverError.set(result.error);
      return;
    }
    this.attachOpen.set(false);
    this.toasts.success(`${DOCUMENT_KIND_LABEL[value.kind]} anexado. A situação já foi atualizada.`);
  }
}
