import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { formatDate } from '@core/format';
import { GuidanceContent } from '@core/models';
import { DialogService, DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import {
  BadgeComponent,
  CellDirective,
  DataTableComponent,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
  TableColumn,
} from '@shared/ui';
import { startWith } from 'rxjs';
import { GovernanceTabsComponent } from '../components/governance-tabs.component';
import { GovernanceService } from '../state/governance.service';

const STATUS_LABEL: Record<GuidanceContent['status'], string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  published: 'Publicado',
};

interface ContentRow {
  id: string;
  content: GuidanceContent;
}

/**
 * SCR-M13-10 Conteúdos de orientação (`/app/governanca/conteudos`, POP-09). Rascunho, revisão e publicação dos
 * textos que a equipe oferece aos cuidadores. Gestão e RT escrevem e enviam para revisão; **só o responsável
 * técnico aprova e publica**, com a data (RN-POP-09, AC-M13-11). Conteúdo publicado só muda depois de voltar a
 * rascunho. Psicólogo e atendimento só leem.
 */
@Component({
  selector: 'app-governance-contents-page',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    CellDirective,
    DataTableComponent,
    DrawerComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
    GovernanceTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header
        title="Conteúdos de orientação"
        [count]="count()"
        description="Só o responsável técnico aprova a publicação, com a data da revisão."
      >
        @if (svc.canEditContents()) {
          <button type="button" class="btn btn--primary" data-role="new" (click)="openNew()">Novo conteúdo</button>
        }
      </app-page-header>
      <app-governance-tabs />

      <app-data-table
        caption="Conteúdos de orientação"
        noun="conteúdos"
        [rows]="rows()"
        [columns]="columns"
        [rowKey]="rowKey"
        rowClickable
        searchable
        searchLabel="Buscar conteúdo"
        searchPlaceholder="Buscar pelo título"
        (rowClick)="openRow($event)"
        emptyTitle="Nenhum conteúdo ainda"
        emptyText="Escreva o primeiro conteúdo de orientação. Ele fica em rascunho até a aprovação."
      >
        <ng-template appCell="status" let-row>
          <app-badge
            [variant]="row.content.status === 'published' ? 'success' : row.content.status === 'in_review' ? 'attention' : 'neutral'"
            dot
            >{{ statusLabel(row.content.status) }}</app-badge
          >
        </ng-template>
      </app-data-table>

      <app-drawer [(open)]="drawerOpen" [heading]="creating() ? 'Novo conteúdo' : 'Conteúdo de orientação'" [subtitle]="subtitle()">
        <form id="content-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="saveDraft()">
          @if (readOnly()) {
            <p class="t-ui t-muted" data-role="readonly">
              <svg appIcon="lock" size="sm"></svg> {{ readOnlyReason() }}
            </p>
          }
          <app-form-field label="Título" controlId="gc-title" [error]="err('title')">
            <input appInput formControlName="title" maxlength="120" autocomplete="off" />
          </app-form-field>
          <app-form-field label="Texto" hint="Sem promessa de resultado e sem jargão clínico." controlId="gc-body" [error]="err('body')">
            <textarea appInput formControlName="body" rows="8"></textarea>
          </app-form-field>
          <label class="switch">
            <input type="checkbox" formControlName="exclusive" />
            <span>Só para planos pagos</span>
          </label>
          @if (creating() && prefs.fillWithExample()) {
            <div>
              <button type="button" class="btn btn--ghost btn--sm" data-role="fill-example" (click)="fillExample()">Preencher com exemplo</button>
            </div>
          }
          @if (current(); as c) {
            @if (c.status === 'published' && c.approvedAt) {
              <p class="t-caption" data-role="approval">
                Aprovado em {{ date(c.approvedAt) }} por {{ approver(c) }}.
              </p>
            }
          }
        </form>
        <ng-container drawerFooter>
          <button type="button" class="btn" (click)="drawerOpen.set(false)">Fechar</button>
          @if (canEdit()) {
            <button type="submit" form="content-form" class="btn" data-role="save-draft">Salvar rascunho</button>
            @if (current()?.status === 'draft') {
              <button type="button" class="btn" data-role="send-review" (click)="sendToReview()">Enviar para revisão</button>
            }
          }
          @if (current()?.status === 'in_review') {
            @if (svc.canPublishContents()) {
              <button type="button" class="btn btn--primary" data-role="approve" (click)="approve()">Aprovar e publicar</button>
            } @else {
              <button type="button" class="btn btn--primary" data-role="approve" disabled aria-disabled="true">Aprovar e publicar</button>
              <span class="t-caption" data-role="approve-reason">Só o responsável técnico aprova e publica.</span>
            }
          }
          @if (svc.canPublishContents() && current() && current()?.status !== 'draft') {
            <button type="button" class="btn btn--ghost" data-role="to-draft" (click)="backToDraft()">Voltar a rascunho</button>
          }
        </ng-container>
      </app-drawer>
    </div>
  `,
})
export class ContentsPageComponent {
  protected readonly svc = inject(GovernanceService);
  protected readonly prefs = inject(UiPrefsService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly rows = computed<ContentRow[]>(() =>
    this.svc.contents().map((content) => ({ id: content.id, content })),
  );
  protected readonly count = computed(() => {
    const n = this.rows().length;
    return `${n} ${n === 1 ? 'conteúdo' : 'conteúdos'}`;
  });

  protected readonly columns: TableColumn<ContentRow>[] = [
    { key: 'title', header: 'Título', primary: true, value: (r) => r.content.title, sortable: true },
    { key: 'status', header: 'Estado', value: (r) => STATUS_LABEL[r.content.status] },
    { key: 'audience', header: 'Para quem', value: (r) => (r.content.exclusive ? 'Planos pagos' : 'Todos os planos') },
    {
      key: 'approved',
      header: 'Aprovado em',
      value: (r) => (r.content.approvedAt ? formatDate(r.content.approvedAt) : ''),
      sortValue: (r) => r.content.approvedAt ?? '',
      sortable: true,
    },
  ];
  protected readonly rowKey = (row: ContentRow): string => row.id;

  protected readonly drawerOpen = signal(false);
  protected readonly creating = signal(false);
  private readonly selectedId = signal<string | null>(null);
  private readonly submitted = signal(false);

  protected readonly current = computed(() => {
    const id = this.selectedId();
    return id ? this.svc.contents().find((c) => c.id === id) : undefined;
  });
  protected readonly canEdit = computed(
    () => this.svc.canEditContents() && this.current()?.status !== 'published',
  );
  protected readonly readOnly = computed(() => !this.canEdit());
  protected readonly readOnlyReason = computed(() =>
    !this.svc.canEditContents()
      ? 'Você pode ler este conteúdo. Só a gestão e o responsável técnico editam.'
      : 'Este conteúdo está publicado. Para editar, o responsável técnico o devolve a rascunho.',
  );
  protected readonly subtitle = computed(() => {
    const c = this.current();
    return c ? STATUS_LABEL[c.status] : 'Novo rascunho';
  });

  protected readonly form = this.fb.group({
    title: this.fb.control(''),
    body: this.fb.control(''),
    exclusive: this.fb.control(false),
  });
  private readonly titleText = toSignal(this.form.controls.title.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly bodyText = toSignal(this.form.controls.body.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected err(field: 'title' | 'body'): string | null {
    if (!this.submitted()) {
      return null;
    }
    if (field === 'title') {
      return this.titleText().trim().length < 3 ? 'Informe o título do conteúdo.' : null;
    }
    return this.bodyText().trim().length < 10 ? 'Escreva o texto do conteúdo, com ao menos 10 caracteres.' : null;
  }

  protected statusLabel(status: GuidanceContent['status']): string {
    return STATUS_LABEL[status];
  }
  protected date(value: string): string {
    return formatDate(value);
  }
  protected approver(c: GuidanceContent): string {
    return c.approvedByUserId ? this.svc.userName(c.approvedByUserId) : 'responsável técnico';
  }

  private fill(content: GuidanceContent | null): void {
    this.form.reset({
      title: content?.title ?? '',
      body: content?.body ?? '',
      exclusive: content?.exclusive ?? false,
    });
    if (this.readOnlyFor(content)) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
    this.submitted.set(false);
  }

  private readOnlyFor(content: GuidanceContent | null): boolean {
    return !this.svc.canEditContents() || content?.status === 'published';
  }

  protected fillExample(): void {
    this.form.patchValue({
      title: 'Pausas curtas ao longo da semana',
      body: 'Reserve alguns minutos de descanso a cada dia, mesmo que sejam poucos. Peça a alguém da família para cobrir uma tarefa por semana.',
      exclusive: false,
    });
    this.submitted.set(false);
  }

  protected openNew(): void {
    this.selectedId.set(null);
    this.creating.set(true);
    this.fill(null);
    this.drawerOpen.set(true);
  }

  protected openRow(row: ContentRow): void {
    this.selectedId.set(row.id);
    this.creating.set(false);
    this.fill(row.content);
    this.drawerOpen.set(true);
  }

  private values(): { title: string; body: string; exclusive: boolean } {
    return this.form.getRawValue();
  }

  protected saveDraft(): void {
    this.submitted.set(true);
    if (this.err('title') || this.err('body')) {
      return;
    }
    const result = this.svc.saveContent(this.selectedId(), this.values());
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível salvar.');
      return;
    }
    if (result.id) {
      this.selectedId.set(result.id);
      this.creating.set(false);
    }
    this.toasts.success('Rascunho salvo.');
  }

  protected sendToReview(): void {
    this.submitted.set(true);
    if (this.err('title') || this.err('body')) {
      return;
    }
    const saved = this.svc.saveContent(this.selectedId(), this.values());
    if (!saved.ok || !saved.id) {
      this.toasts.attention(saved.message ?? 'Não foi possível salvar.');
      return;
    }
    const result = this.svc.sendToReview(saved.id);
    if (!result.ok) {
      this.toasts.attention(result.message ?? 'Não foi possível enviar.');
      return;
    }
    this.selectedId.set(saved.id);
    this.toasts.success('Conteúdo enviado para revisão do responsável técnico.');
    this.drawerOpen.set(false);
  }

  protected async approve(): Promise<void> {
    const c = this.current();
    if (!c) {
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Aprovar e publicar "${c.title}"?`,
      message: 'O conteúdo passa a aparecer para os cuidadores, com a data da sua aprovação.',
      effects: { keep: ['o texto como está agora', 'o seu nome e a data da aprovação'] },
      confirmLabel: 'Aprovar e publicar',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.approve(c.id);
    if (result.ok) {
      this.drawerOpen.set(false);
      this.toasts.success('Conteúdo aprovado e publicado.');
    } else {
      this.toasts.attention(result.message ?? 'Não foi possível publicar.');
    }
  }

  protected backToDraft(): void {
    const c = this.current();
    if (!c) {
      return;
    }
    const result = this.svc.backToDraft(c.id);
    if (result.ok) {
      this.fill(this.svc.contents().find((x) => x.id === c.id) ?? null);
      this.toasts.success('Conteúdo devolvido a rascunho.');
    } else {
      this.toasts.attention(result.message ?? 'Não foi possível devolver.');
    }
  }
}
