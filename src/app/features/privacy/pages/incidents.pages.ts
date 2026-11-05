import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, CanDeactivateFn, Router, RouterLink } from '@angular/router';
import { debounceTime, map } from 'rxjs';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock, dateOf, timeOf, toIsoDateTime } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatDateTime, formatTime } from '@core/format';
import type { ID, Incident } from '@core/models';
import { addBusinessDays } from '@core/rules';
import {
  BadgeComponent,
  BadgeVariant,
  CardComponent,
  CellDirective,
  CheckboxComponent,
  DataTableComponent,
  DraftService,
  EmptyStateComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  IconName,
  NxInputDirective,
  NxMaskDirective,
  NxValidators,
  PageHeaderComponent,
  TableColumn,
  TimelineComponent,
  TimelineItem,
  createListState,
} from '@shared/ui';
import { BannerComponent, DialogService, PageContextService, ToastService } from '@shared/ui/overlay';
import { LgpdNavComponent } from '../components/lgpd-nav.component';
import { INCIDENT_DATA_KINDS, INCIDENT_POPS, INCIDENT_STATUS_BADGES, INCIDENT_STATUS_LABELS } from '../state/privacy-labels';

interface IncidentRow {
  id: ID;
  occurredAt: string;
  description: string;
  subjects: number;
  status: string;
  communications: number;
}

/** Prazo-alvo para comunicar: 3 dias úteis depois do incidente (RN-LGPD-22). */
export function communicationTarget(incident: Pick<Incident, 'occurredAt'>): string {
  return addBusinessDays(dateOf(incident.occurredAt), 3);
}

/**
 * SCR-M12-06 Incidentes (POP-06, F13): lista com o estado de cada um. O responsável técnico registra e
 * conduz; a gestão só lê. Abrir uma linha leva ao acompanhamento do incidente.
 */
@Component({
  selector: 'app-incidents-page',
  imports: [BadgeComponent, CellDirective, DataTableComponent, LgpdNavComponent, PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Incidentes de dados" [count]="rows().length + (rows().length === 1 ? ' incidente' : ' incidentes')" description="Registro e comunicações (POP-06). Prazo-alvo para comunicar: 3 dias úteis.">
        @if (canEdit()) { <a class="btn btn--primary" routerLink="novo">Registrar incidente</a> }
      </app-page-header>
      <app-lgpd-nav />
      <app-data-table
        caption="Incidentes de dados"
        noun="incidentes"
        [rows]="rows()"
        [columns]="columns"
        [sort]="list.sort()"
        (sortChange)="list.setSort($event)"
        [page]="list.page()"
        (pageChange)="list.setPage($event)"
        rowClickable
        emptyTitle="Nenhum incidente registrado"
        emptyText="Quando houver um incidente, ele aparece aqui com os prazos das comunicações."
        (rowClick)="open($event)"
      >
        <ng-template appCell="status" let-row>
          <app-badge [variant]="badge(row.status).variant" [icon]="badge(row.status).icon">{{ statusLabel(row.status) }}</app-badge>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <button type="button" class="btn btn--sm" [attr.aria-label]="'Abrir o incidente de ' + date(row.occurredAt)" (click)="open(row)">Abrir</button>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class IncidentsPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly list = createListState({ key: 'lgpd-incidents', filterKeys: [], defaultSort: { key: 'when', direction: 'desc' } });
  protected readonly canEdit = computed(() => this.auth.can('lgpd_audit_log', 'update'));
  protected readonly rows = computed<IncidentRow[]>(() =>
    this.db.incidents.all().map((i) => ({
      id: i.id,
      occurredAt: i.occurredAt,
      description: i.description,
      subjects: i.affectedSubjects,
      status: i.status,
      communications: i.communications.length,
    })),
  );
  protected readonly columns: TableColumn<IncidentRow>[] = [
    { key: 'when', header: 'Quando', sortable: true, primary: true, value: (r) => formatDateTime(r.occurredAt), sortValue: (r) => r.occurredAt },
    { key: 'description', header: 'O que aconteceu' },
    { key: 'subjects', header: 'Titulares', align: 'end', sortable: true },
    { key: 'status', header: 'Situação', sortable: true, noSearch: true },
    { key: 'communications', header: 'Comunicações', align: 'end' },
    { key: 'actions', header: 'Ações', actions: true },
  ];

  protected badge(status: string): { variant: BadgeVariant; icon: IconName } {
    return INCIDENT_STATUS_BADGES[status] ?? (INCIDENT_STATUS_BADGES['open'] as { variant: BadgeVariant; icon: IconName });
  }
  protected statusLabel(status: string): string {
    return INCIDENT_STATUS_LABELS[status] ?? status;
  }
  protected date(value: string): string {
    return formatDate(value);
  }
  protected open(row: IncidentRow): void {
    void this.router.navigate(['/app/lgpd/incidentes', row.id]);
  }
}

// ===== Registrar =====

interface IncidentDraft {
  value: Record<string, unknown>;
  kinds: string[];
}

const DRAFT_FORM = 'incident';

export const leaveIncidentFormGuard: CanDeactivateFn<IncidentFormPage> = (page) => page.canLeave();

/**
 * Registrar incidente (F13): formulário em seções na mesma página (não é assistente), com rascunho
 * automático. Ao salvar, o incidente entra em "Aberto" e a tela de acompanhamento mostra as etapas.
 */
@Component({
  selector: 'app-incident-form-page',
  imports: [CheckboxComponent, ErrorSummaryComponent, FormFieldComponent, LgpdNavComponent, NxInputDirective, NxMaskDirective, PageHeaderComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--form stack stack--6">
      <app-page-header title="Registrar incidente" description="Conte o que aconteceu em linguagem simples. Não escreva dado de saúde."><a class="btn" routerLink="/app/lgpd/incidentes">Voltar para os incidentes</a></app-page-header>
      <app-lgpd-nav />
      <form class="card card--pad stack stack--6" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-error-summary [items]="summary()" />
        <fieldset class="form-section">
          <legend class="form-section__head"><h2>O que aconteceu</h2></legend>
          <div class="form-grid">
            <app-form-field label="Data" hint="Digite dia, mês e ano." controlId="nx-inc-date" [forceErrors]="submitted()">
              <input appInput appMask="date" formControlName="date" />
            </app-form-field>
            <app-form-field label="Hora" controlId="nx-inc-time" [forceErrors]="submitted()">
              <input appInput type="time" formControlName="time" />
            </app-form-field>
            <app-form-field class="span-2" label="Descrição" hint="Exemplo: e-mail com agenda enviado a destinatário errado." controlId="nx-inc-description" [forceErrors]="submitted()">
              <textarea appInput rows="3" formControlName="description"></textarea>
            </app-form-field>
          </div>
        </fieldset>
        <fieldset class="form-section">
          <legend class="form-section__head"><h2>Quais dados</h2></legend>
          <div class="stack stack--2" role="group" aria-label="Tipos de dado afetado" id="nx-inc-kinds">
            @for (kind of kindsList; track kind) {
              <app-checkbox [checked]="kinds().includes(kind)" (checkedChange)="toggleKind(kind, $event)">{{ kind }}</app-checkbox>
            }
          </div>
          @if (submitted() && kinds().length === 0) {
            <span class="field__error" role="alert"><span class="sr-only">Erro: </span>Marque ao menos um tipo de dado.</span>
          }
        </fieldset>
        <fieldset class="form-section">
          <legend class="form-section__head"><h2>Quantas pessoas</h2></legend>
          <app-form-field label="Titulares afetados" hint="Um número inteiro, de 0 em diante." controlId="nx-inc-subjects" [forceErrors]="submitted()">
            <input appInput class="input--num" appMask="number" min="0" max="100000" rangeMessage="Informe um número de 0 a 100000." formControlName="subjects" />
          </app-form-field>
        </fieldset>
        <fieldset class="form-section">
          <legend class="form-section__head"><h2>O que já foi feito</h2></legend>
          <app-form-field label="Medidas tomadas" controlId="nx-inc-measures" [forceErrors]="submitted()">
            <textarea appInput rows="3" formControlName="measures"></textarea>
          </app-form-field>
        </fieldset>
        <div class="form-actions">
          <span class="form-actions__status" aria-live="polite">{{ savedAt() ? 'Rascunho salvo às ' + savedAt() : '' }}</span>
          <button type="submit" class="btn btn--primary" [disabled]="busy()">{{ busy() ? 'Salvando...' : 'Registrar incidente' }}</button>
        </div>
      </form>
    </div>
  `,
})
export class IncidentFormPage {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly drafts = inject(DraftService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private done = false;

  protected readonly kindsList = INCIDENT_DATA_KINDS;
  protected readonly kinds = signal<string[]>([]);
  protected readonly submitted = signal(false);
  protected readonly summary = signal<ErrorSummaryItem[]>([]);
  protected readonly busy = signal(false);
  protected readonly savedAt = signal<string | null>(null);
  protected readonly form = new FormGroup({
    date: new FormControl<string | null>(this.clock.today(), [NxValidators.required('a data do incidente')]),
    time: new FormControl(timeOf(this.clock.now()), { nonNullable: true, validators: [NxValidators.required('a hora do incidente')] }),
    description: new FormControl('', { nonNullable: true, validators: [NxValidators.required('a descrição do incidente')] }),
    subjects: new FormControl<number | null>(null, [NxValidators.required('quantos titulares foram afetados')]),
    measures: new FormControl('', { nonNullable: true, validators: [NxValidators.required('as medidas já tomadas')] }),
  });

  constructor() {
    const saved = this.drafts.load<IncidentDraft>(DRAFT_FORM, 'novo');
    if (saved) {
      this.form.patchValue(saved.data.value as never);
      this.kinds.set(saved.data.kinds ?? []);
      this.savedAt.set(formatTime(saved.savedAt));
    }
    this.form.valueChanges.pipe(debounceTime(2000), takeUntilDestroyed()).subscribe(() => this.saveDraft());
  }

  private saveDraft(): void {
    if (this.done || !this.form.dirty) {
      return;
    }
    const record = this.drafts.save<IncidentDraft>(DRAFT_FORM, 'novo', { value: this.form.getRawValue(), kinds: this.kinds() });
    this.savedAt.set(formatTime(record.savedAt));
  }

  async canLeave(): Promise<boolean> {
    if (this.done || !this.form.dirty) {
      return true;
    }
    this.saveDraft();
    const { confirmed } = await this.dialogs.confirm({
      title: 'Sair do registro do incidente?',
      message: 'Você tem um registro em andamento.',
      effects: { keep: ['o que você já preencheu, guardado como rascunho'] },
      confirmLabel: 'Guardar rascunho e sair',
      cancelLabel: 'Continuar editando',
    });
    return confirmed;
  }

  protected toggleKind(kind: string, on: boolean): void {
    this.form.markAsDirty();
    this.kinds.update((list) => (on ? [...new Set([...list, kind])] : list.filter((k) => k !== kind)));
    this.saveDraft();
  }

  protected save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const c = this.form.controls;
    const items: ErrorSummaryItem[] = [];
    ([
      ['nx-inc-date', 'a data do incidente', c.date],
      ['nx-inc-time', 'a hora do incidente', c.time],
      ['nx-inc-description', 'a descrição do incidente', c.description],
      ['nx-inc-subjects', 'quantos titulares foram afetados', c.subjects],
      ['nx-inc-measures', 'as medidas já tomadas', c.measures],
    ] as const).forEach(([id, what, control]) => {
      if (control.invalid) {
        items.push({ controlId: id, message: `Informe ${what}.` });
      }
    });
    if (this.kinds().length === 0) {
      items.push({ controlId: 'nx-inc-kinds', message: 'Marque ao menos um tipo de dado.' });
    }
    if (c.date.value && c.date.value > this.clock.today()) {
      items.push({ controlId: 'nx-inc-date', message: 'A data do incidente não pode ser no futuro.' });
    }
    this.summary.set(items);
    if (items.length > 0) {
      return;
    }
    this.busy.set(true);
    const v = this.form.getRawValue();
    const incident = this.db.incidents.create({
      occurredAt: toIsoDateTime(v.date as string, v.time),
      description: v.description.trim(),
      dataAffected: this.kinds(),
      affectedSubjects: v.subjects as number,
      measures: v.measures.trim(),
      status: 'open',
      communications: [],
    });
    this.audit.write('create', 'incident', incident.id, undefined, 'incidente registrado');
    this.done = true;
    this.drafts.clear(DRAFT_FORM, 'novo');
    this.busy.set(false);
    void this.router.navigate(['/app/lgpd/incidentes', incident.id]);
  }
}

// ===== Acompanhar =====

/**
 * Acompanhamento do incidente (F13): etapas Conter, Comunicar à ANPD, Comunicar os titulares e Encerrar,
 * com o prazo-alvo de 3 dias úteis, modelos de comunicação em bloco copiável e a checagem de lacuna
 * (leva o POP escolhido a "revisão disparada"). Encerrar só habilita com as duas comunicações registradas.
 * O responsável técnico conduz; a gestão lê. Incidente encerrado não tem botão de edição.
 */
@Component({
  selector: 'app-incident-detail-page',
  imports: [
    BadgeComponent,
    BannerComponent,
    CardComponent,
    EmptyStateComponent,
    FormFieldComponent,
    LgpdNavComponent,
    NxInputDirective,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    TimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (incident(); as inc) {
        <app-page-header [title]="'Incidente de ' + date(inc.occurredAt)" [description]="statusText()">
          <a class="btn" routerLink="/app/lgpd/incidentes">Voltar para os incidentes</a>
        </app-page-header>
        <app-lgpd-nav />
        <div class="layout-main-aside">
          <div class="stack stack--6">
            <app-card title="O que aconteceu">
              <dl class="dl">
                <dt>Quando</dt><dd>{{ dateTime(inc.occurredAt) }}</dd>
                <dt>Situação</dt><dd><app-badge [variant]="badge().variant" [icon]="badge().icon">{{ statusLabel() }}</app-badge></dd>
                <dt>Descrição</dt><dd>{{ inc.description }}</dd>
                <dt>Dados afetados</dt><dd>{{ inc.dataAffected.join(', ') }}</dd>
                <dt>Titulares afetados</dt><dd>{{ inc.affectedSubjects }}</dd>
                <dt>Medidas</dt><dd>{{ inc.measures }}</dd>
              </dl>
            </app-card>
            <app-card title="Etapas" subtitle="O que cada uma pede">
              <app-timeline label="Etapas do incidente" [items]="steps()" />
            </app-card>
            @if (canEdit() && inc.status !== 'closed') {
              <app-card title="Modelos de comunicação" subtitle="Simulados. Copie, ajuste e envie pelo canal da Nexus.">
                <div class="stack stack--6">
                  <p class="t-ui" role="note">Não inclua dado de saúde na comunicação.</p>
                  <div class="stack stack--2">
                    <label class="field__label" for="nx-tpl-anpd">Comunicação à ANPD</label>
                    <textarea class="textarea" id="nx-tpl-anpd" rows="5" readonly [value]="templateAnpd()"></textarea>
                    <div><button type="button" class="btn btn--sm" (click)="copy(templateAnpd())">Copiar modelo da ANPD</button></div>
                  </div>
                  <div class="stack stack--2">
                    <label class="field__label" for="nx-tpl-subjects">Comunicação aos titulares</label>
                    <textarea class="textarea" id="nx-tpl-subjects" rows="5" readonly [value]="templateSubjects()"></textarea>
                    <div><button type="button" class="btn btn--sm" (click)="copy(templateSubjects())">Copiar modelo dos titulares</button></div>
                  </div>
                </div>
              </app-card>
            }
          </div>

          <aside class="stack stack--6" aria-label="Ações do incidente">
            <app-card title="Prazo-alvo">
              <p data-role="deadline">Para comunicar: 3 dias úteis, até {{ date(target()) }}.</p>
            </app-card>
            @if (inc.status === 'closed') {
              <app-banner variant="success" heading="Incidente encerrado">As comunicações estão registradas. O registro não pode ser editado.</app-banner>
            } @else if (canEdit()) {
              <app-card title="Conduzir o incidente">
                <div class="stack stack--6">
                  @if (inc.status === 'open') {
                    <div><button type="button" class="btn" (click)="contain()">Marcar como contido</button></div>
                  }
                  <section class="stack stack--3" aria-label="Comunicar à ANPD">
                    <app-form-field label="Comunicação à ANPD" hint="O que foi comunicado e quando." controlId="nx-comm-anpd" [error]="anpdError()">
                      <textarea appInput rows="2" [formControl]="anpdText"></textarea>
                    </app-form-field>
                    <div><button type="button" class="btn btn--sm" (click)="communicate('ANPD')">Registrar comunicação à ANPD</button></div>
                  </section>
                  <section class="stack stack--3" aria-label="Comunicar os titulares">
                    <app-form-field label="Comunicação aos titulares" controlId="nx-comm-subjects" [error]="subjectsError()">
                      <textarea appInput rows="2" [formControl]="subjectsText"></textarea>
                    </app-form-field>
                    <div><button type="button" class="btn btn--sm" (click)="communicate('subjects')">Registrar comunicação aos titulares</button></div>
                  </section>
                  <section class="stack stack--3" aria-label="Checagem de lacuna">
                    <app-form-field label="Este incidente mostra uma falha em algum procedimento?" controlId="nx-gap-pop">
                      <select appInput [formControl]="gapPop">
                        <option [ngValue]="null">Nenhum</option>
                        @for (p of pops; track p.code) { <option [ngValue]="p.code">{{ p.label }}</option> }
                      </select>
                    </app-form-field>
                    <div><button type="button" class="btn btn--sm" [attr.aria-disabled]="!gapPop.value" (click)="markGap()">Marcar o procedimento para revisão</button></div>
                  </section>
                  <section class="stack stack--3" aria-label="Encerrar">
                    <div class="cluster">
                      <button type="button" class="btn btn--primary" [attr.aria-disabled]="!!missing()" (click)="close()">Encerrar incidente</button>
                      @if (missing()) { <span class="t-ui" data-role="close-missing">Falta: {{ missing() }}.</span> }
                    </div>
                  </section>
                </div>
              </app-card>
            }
          </aside>
        </div>
      } @else {
        <app-empty-state kind="error" title="Incidente não encontrado" text="Confira o endereço ou volte à lista de incidentes.">
          <a class="btn" routerLink="/app/lgpd/incidentes">Voltar para os incidentes</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class IncidentDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly page = inject(PageContextService);
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });

  protected readonly pops = INCIDENT_POPS;
  protected readonly anpdText = new FormControl('', { nonNullable: true });
  protected readonly subjectsText = new FormControl('', { nonNullable: true });
  protected readonly gapPop = new FormControl<string | null>(null);
  protected readonly anpdError = signal<string | null>(null);
  protected readonly subjectsError = signal<string | null>(null);

  protected readonly canEdit = computed(() => this.auth.can('lgpd_audit_log', 'update'));
  protected readonly incident = computed(() => {
    this.db.incidents.all();
    return this.db.incidents.get(this.id());
  });
  protected readonly target = computed(() => communicationTarget(this.incident() ?? { occurredAt: this.clock.now() }));
  protected readonly badge = computed(() => (INCIDENT_STATUS_BADGES[this.incident()?.status ?? 'open'] ?? INCIDENT_STATUS_BADGES['open']) as { variant: BadgeVariant; icon: IconName });
  protected readonly statusLabel = computed(() => INCIDENT_STATUS_LABELS[this.incident()?.status ?? 'open'] ?? '');
  protected readonly statusText = computed(() => `Situação: ${this.statusLabel()}`);
  private readonly hasAnpd = computed(() => !!this.incident()?.communications.some((c) => c.to === 'ANPD'));
  private readonly hasSubjects = computed(() => !!this.incident()?.communications.some((c) => c.to === 'subjects'));
  protected readonly missing = computed(() => {
    const out: string[] = [];
    if (!this.hasAnpd()) {
      out.push('comunicação à ANPD');
    }
    if (!this.hasSubjects()) {
      out.push('comunicação aos titulares');
    }
    return out.join(' e ');
  });

  protected readonly steps = computed<TimelineItem[]>(() => {
    const inc = this.incident();
    if (!inc) {
      return [];
    }
    const anpd = inc.communications.find((c) => c.to === 'ANPD');
    const subjects = inc.communications.find((c) => c.to === 'subjects');
    return [
      { id: 'registered', title: 'Incidente registrado', at: inc.createdAt, tone: 'done' },
      { id: 'contain', title: 'Conter', text: inc.status === 'open' ? 'Pendente: marque como contido quando a causa estiver controlada.' : 'Contido.', tone: inc.status === 'open' ? 'attention' : 'done' },
      { id: 'anpd', title: 'Comunicar à ANPD', ...(anpd ? { at: anpd.at, text: anpd.text } : { text: 'Pendente.' }), tone: anpd ? 'done' : 'attention' },
      { id: 'subjects', title: 'Comunicar os titulares', ...(subjects ? { at: subjects.at, text: subjects.text } : { text: 'Pendente.' }), tone: subjects ? 'done' : 'attention' },
      { id: 'close', title: 'Encerrar', text: inc.status === 'closed' ? 'Encerrado.' : 'Só habilita com as duas comunicações registradas.', tone: inc.status === 'closed' ? 'done' : 'default' },
    ];
  });

  protected readonly templateAnpd = computed(() => {
    const inc = this.incident();
    return inc
      ? `Assunto: comunicação de incidente de segurança com dados pessoais\n\nA Nexus comunica um incidente ocorrido em ${formatDateTime(inc.occurredAt)}: ${inc.description} Titulares afetados: ${inc.affectedSubjects}. Medidas adotadas: ${inc.measures} A encarregada pelos dados está à disposição.`
      : '';
  });
  protected readonly templateSubjects = computed(() => {
    const inc = this.incident();
    return inc
      ? `Olá. Em ${formatDate(inc.occurredAt)} houve um incidente que pode ter envolvido dados seus: ${inc.description} Já tomamos medidas: ${inc.measures} Se tiver dúvidas, fale com a encarregada pelos dados pelo canal do titular.`
      : '';
  });

  constructor() {
    effect(() => {
      const inc = this.incident();
      if (!inc) {
        return;
      }
      untracked(() =>
        this.page.setCrumbs([
          { label: 'Privacidade (LGPD)', link: '/app/lgpd/consentimentos' },
          { label: 'Incidentes', link: '/app/lgpd/incidentes' },
          { label: formatDate(inc.occurredAt) },
        ]),
      );
    });
  }

  protected date(value: string): string {
    return formatDate(value);
  }
  protected dateTime(value: string): string {
    return formatDateTime(value);
  }

  protected contain(): void {
    const inc = this.incident();
    if (!inc || inc.status !== 'open') {
      return;
    }
    this.db.incidents.update(inc.id, { status: 'contained' });
    this.audit.write('update', 'incident', inc.id, undefined, 'incidente contido');
    this.toasts.success('Incidente marcado como contido.');
  }

  protected communicate(to: 'ANPD' | 'subjects'): void {
    const inc = this.incident();
    const control = to === 'ANPD' ? this.anpdText : this.subjectsText;
    const error = to === 'ANPD' ? this.anpdError : this.subjectsError;
    error.set(null);
    const text = control.value.trim();
    if (!inc || text.length < 3) {
      error.set(to === 'ANPD' ? 'Escreva o que foi comunicado à ANPD.' : 'Escreva o que foi comunicado aos titulares.');
      return;
    }
    const communications = [...inc.communications, { to, at: this.clock.now(), text }];
    const both = communications.some((c) => c.to === 'ANPD') && communications.some((c) => c.to === 'subjects');
    this.db.incidents.update(inc.id, { communications, status: both ? 'communicated' : inc.status });
    this.audit.write('update', 'incident', inc.id, undefined, `comunicação registrada (${to === 'ANPD' ? 'ANPD' : 'titulares'})`);
    control.setValue('');
    this.toasts.success(to === 'ANPD' ? 'Comunicação à ANPD registrada.' : 'Comunicação aos titulares registrada.');
  }

  protected markGap(): void {
    const code = this.gapPop.value;
    const inc = this.incident();
    if (!code || !inc) {
      return;
    }
    const changed = this.db.pops.updateWhere((p) => p.code === code, { reviewState: 'revision_triggered' });
    this.audit.write('update', 'pop', inc.id, undefined, `${code} levado a revisão`);
    this.toasts.success(changed > 0 ? `${code} marcado para revisão.` : `${code} não está cadastrado nos procedimentos.`);
    this.gapPop.setValue(null);
  }

  protected async close(): Promise<void> {
    const inc = this.incident();
    if (!inc) {
      return;
    }
    if (this.missing()) {
      this.toasts.attention(`Falta registrar: ${this.missing()}.`);
      return;
    }
    await this.dialogs.confirm({
      title: 'Encerrar o incidente?',
      message: 'As comunicações à ANPD e aos titulares estão registradas.',
      effects: { block: ['a edição do incidente: depois de encerrado, ele só pode ser lido'], keep: ['as comunicações e as medidas, no histórico'] },
      confirmLabel: 'Encerrar incidente',
      busyLabel: 'Encerrando...',
      run: () => {
        this.db.incidents.update(inc.id, { status: 'closed' });
        this.audit.write('update', 'incident', inc.id, undefined, 'incidente encerrado');
        this.toasts.success('Incidente encerrado.');
      },
    });
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toasts.success('Texto copiado.');
    } catch {
      this.toasts.attention('O navegador não deixou copiar. Selecione o texto e copie.');
    }
  }
}
