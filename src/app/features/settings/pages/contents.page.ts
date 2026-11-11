import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuditLogService } from '../../../core/audit/audit-log.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Clock } from '../../../core/clock/clock.service';
import { Database } from '../../../core/data/database';
import { DateBrPipe } from '../../../core/format/pipes';
import { GuidanceCategory, GuidanceContent } from '../../../core/models/governance';
import { GUIDANCE_CATEGORIES, GUIDANCE_CATEGORY_LABELS } from '../../../core/rules/guidance-content';
import { DialogService } from '../../../shared/ui/overlay/dialog.service';
import { DrawerComponent } from '../../../shared/ui/overlay/drawer.component';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { ToastService } from '../../../shared/ui/overlay/toast.service';

const STATUS_TEXT: Record<GuidanceContent['status'], string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  published: 'Publicado',
};

/**
 * Conteúdos de orientação (M15 para o RT, POP-09): rascunho, revisão e publicação dos textos que a equipe
 * oferece aos cuidadores. Quem edita é a sócia ou o responsável técnico; **só o responsável técnico aprova a
 * publicação** (RN-POP-09). Conteúdo publicado fica somente leitura até voltar a rascunho.
 */
@Component({
  selector: 'app-settings-contents-page',
  imports: [ReactiveFormsModule, DrawerComponent, IconComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Conteúdos de orientação</h1>
            <p class="page-header__desc">
              {{ contents().length }} {{ contents().length === 1 ? 'conteúdo' : 'conteúdos' }}. Só a
              responsável técnica aprova a publicação.
            </p>
          </div>
          <div class="page-header__actions">
            <button type="button" class="btn btn--primary" data-role="new" (click)="openNew()">
              <svg appIcon="plus"></svg>Novo conteúdo
            </button>
          </div>
        </div>
      </header>

      @if (contents().length === 0) {
        <div class="empty">
          <svg
            class="empty__art"
            viewBox="-18 3 156 98"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <use href="icons/sprite.svg#nx-hands" />
          </svg>
          <h2 class="empty__title">Nenhum conteúdo ainda</h2>
          <p class="empty__text">
            Escreva o primeiro conteúdo de orientação. Ele fica em rascunho até a aprovação.
          </p>
          <div class="empty__actions">
            <button type="button" class="btn btn--primary" (click)="openNew()">
              Novo conteúdo
            </button>
          </div>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="table table--stack" data-density="comfortable">
            <caption class="sr-only">
              Conteúdos de orientação
            </caption>
            <thead>
              <tr>
                <th scope="col">Título</th>
                <th scope="col">Estado</th>
                <th scope="col">Para quem</th>
                <th scope="col">Atualizado</th>
                <th scope="col" class="col-actions"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (item of contents(); track item.id) {
                <tr>
                  <td data-label="Título" class="col-primary">{{ item.title }}</td>
                  <td data-label="Estado">
                    <span
                      class="badge badge--dot"
                      [class.badge--attention]="item.status === 'in_review'"
                      [class.badge--success]="item.status === 'published'"
                      >{{ statusText(item.status) }}</span
                    >
                  </td>
                  <td data-label="Para quem">
                    {{ item.exclusive ? 'Planos pagos' : 'Todos os planos' }}
                  </td>
                  <td data-label="Atualizado" class="t-num">{{ item.updatedAt | dateBr }}</td>
                  <td data-label="Ações" class="col-actions">
                    <button type="button" class="btn btn--sm" data-role="open" (click)="edit(item)">
                      Abrir
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <app-drawer
        [(open)]="drawerOpen"
        [heading]="creating() ? 'Novo conteúdo' : 'Conteúdo de orientação'"
        [subtitle]="subtitle()"
      >
        <form
          id="nx-content-form"
          class="stack stack--3"
          novalidate
          [formGroup]="form"
          (ngSubmit)="saveDraft()"
        >
          @if (readOnly()) {
            <p class="t-muted t-ui" data-role="readonly">
              Este conteúdo está publicado. Para editar, a responsável técnica o devolve a rascunho.
            </p>
          }
          <div class="field" [class.field--error]="titleError()">
            <label class="field__label" for="nx-content-title">Título</label>
            <input
              class="input"
              id="nx-content-title"
              formControlName="title"
              maxlength="120"
              [attr.aria-invalid]="titleError() ? 'true' : null"
            />
            @if (titleError()) {
              <span class="field__error"
                ><svg appIcon="circle-alert"></svg
                ><span><span class="sr-only">Erro: </span>Informe o título do conteúdo.</span></span
              >
            }
          </div>
          <div class="field" [class.field--error]="bodyError()">
            <label class="field__label" for="nx-content-body">Texto</label>
            <textarea
              class="textarea"
              id="nx-content-body"
              formControlName="body"
              rows="8"
              [attr.aria-invalid]="bodyError() ? 'true' : null"
            ></textarea>
            @if (bodyError()) {
              <span class="field__error"
                ><svg appIcon="circle-alert"></svg
                ><span
                  ><span class="sr-only">Erro: </span>Escreva o texto do conteúdo, com ao menos 10
                  caracteres.</span
                ></span
              >
            }
          </div>
          <div class="field">
            <label class="field__label" for="nx-content-category">Categoria</label>
            <select id="nx-content-category" class="input" formControlName="category" data-role="category">
              @for (category of categories; track category) {
                <option [value]="category">{{ categoryLabels[category] }}</option>
              }
            </select>
          </div>
          <label class="switch">
            <input type="checkbox" formControlName="exclusive" />
            <span>Só para planos pagos</span>
          </label>
        </form>
        <ng-container drawerFooter>
          <button type="button" class="btn" (click)="drawerOpen.set(false)">Fechar</button>
          @if (!readOnly()) {
            <button type="submit" form="nx-content-form" class="btn" data-role="save-draft">
              Salvar rascunho
            </button>
            @if (current()?.status !== 'in_review') {
              <button
                type="button"
                class="btn btn--primary"
                data-role="send-review"
                (click)="sendToReview()"
              >
                Enviar para revisão
              </button>
            }
          }
          @if (isTechnicalLead() && current()?.status === 'in_review') {
            <button type="button" class="btn btn--primary" data-role="approve" (click)="approve()">
              Aprovar e publicar
            </button>
          }
          @if (isTechnicalLead() && current() && current()?.status !== 'draft') {
            <button
              type="button"
              class="btn btn--ghost"
              data-role="to-draft"
              (click)="backToDraft()"
            >
              Voltar a rascunho
            </button>
          }
        </ng-container>
      </app-drawer>
    </div>
  `,
})
export class ContentsPageComponent {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly drawerOpen = signal(false);
  protected readonly creating = signal(false);
  private readonly selectedId = signal<string | null>(null);
  private readonly tick = signal(0);

  protected readonly contents = computed(() =>
    [...this.db.guidanceContents.all()].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
  );
  protected readonly current = computed(() => {
    const id = this.selectedId();
    return id ? this.db.guidanceContents.get(id) : undefined;
  });
  protected readonly readOnly = computed(() => this.current()?.status === 'published');
  protected readonly isTechnicalLead = computed(() => this.auth.hasRole('technical_lead'));
  protected readonly subtitle = computed(() => {
    const status = this.current()?.status;
    return status ? STATUS_TEXT[status] : 'Novo rascunho';
  });

  protected readonly categories = GUIDANCE_CATEGORIES;
  protected readonly categoryLabels = GUIDANCE_CATEGORY_LABELS;

  protected readonly form = this.fb.group({
    title: this.fb.control('', [Validators.required, Validators.maxLength(120)]),
    body: this.fb.control('', [Validators.required, Validators.minLength(10)]),
    category: this.fb.control<GuidanceCategory>('routine_organization'),
    exclusive: this.fb.control(false),
  });

  constructor() {
    // Os estados do formulário não são signals: cada evento dele reavalia as mensagens de erro.
    this.form.events
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.tick.update((n) => n + 1));
  }

  protected titleError(): boolean {
    this.tick();
    return this.invalid(this.form.controls.title);
  }

  protected bodyError(): boolean {
    this.tick();
    return this.invalid(this.form.controls.body);
  }

  protected statusText(status: GuidanceContent['status']): string {
    return STATUS_TEXT[status];
  }

  protected openNew(): void {
    this.creating.set(true);
    this.selectedId.set(null);
    this.form.reset({ title: '', body: '', category: 'routine_organization', exclusive: false });
    this.form.enable();
    this.drawerOpen.set(true);
  }

  protected edit(item: GuidanceContent): void {
    this.creating.set(false);
    this.selectedId.set(item.id);
    this.form.reset({ title: item.title, body: item.body, category: item.category, exclusive: item.exclusive });
    if (item.status === 'published') {
      this.form.disable();
    } else {
      this.form.enable();
    }
    this.drawerOpen.set(true);
  }

  protected saveDraft(): GuidanceContent | null {
    this.form.markAllAsTouched();
    this.tick.update((n) => n + 1);
    if (this.form.invalid) {
      return null;
    }
    const value = this.form.getRawValue();
    const existing = this.current();
    let saved: GuidanceContent;
    if (existing) {
      saved = this.db.guidanceContents.update(existing.id, { ...value });
      this.audit.write('update', 'guidance_content', saved.id);
    } else {
      saved = this.db.guidanceContents.create({ ...value, status: 'draft' });
      this.audit.write('create', 'guidance_content', saved.id);
      this.selectedId.set(saved.id);
      this.creating.set(false);
    }
    this.toasts.success('Rascunho salvo.');
    return saved;
  }

  protected sendToReview(): void {
    const saved = this.saveDraft();
    if (!saved) {
      return;
    }
    this.db.guidanceContents.update(saved.id, { status: 'in_review' });
    this.audit.write('update', 'guidance_content', saved.id, undefined, 'enviado para revisão');
    this.toasts.success('Conteúdo enviado para revisão da responsável técnica.');
    this.drawerOpen.set(false);
  }

  /** Só a responsável técnica aprova (RN-POP-09): nível 2 do guia, com o efeito descrito. */
  protected async approve(): Promise<void> {
    const item = this.current();
    if (!item || !this.isTechnicalLead()) {
      return;
    }
    const result = await this.dialogs.confirm({
      title: `Aprovar e publicar "${item.title}"?`,
      message: 'O conteúdo passa a aparecer para os cuidadores, conforme o plano de cada um.',
      irreversibleNote: 'A aprovação fica registrada com o seu nome e a data.',
      confirmLabel: 'Aprovar e publicar',
    });
    if (!result.confirmed) {
      return;
    }
    this.db.guidanceContents.update(item.id, {
      status: 'published',
      approvedByUserId: this.auth.user()?.id as string,
      approvedAt: this.clock.today(),
    });
    this.audit.write(
      'update',
      'guidance_content',
      item.id,
      undefined,
      'conteúdo aprovado e publicado',
    );
    this.toasts.success('Conteúdo publicado.');
    this.drawerOpen.set(false);
  }

  protected async backToDraft(): Promise<void> {
    const item = this.current();
    if (!item) {
      return;
    }
    const result = await this.dialogs.confirm({
      title: `Voltar "${item.title}" a rascunho?`,
      message:
        item.status === 'published'
          ? 'O conteúdo deixa de aparecer para os cuidadores até ser aprovado de novo.'
          : 'O conteúdo sai da fila de revisão.',
      confirmLabel: 'Voltar a rascunho',
    });
    if (!result.confirmed) {
      return;
    }
    this.db.guidanceContents.update(item.id, {
      status: 'draft',
      approvedByUserId: undefined,
      approvedAt: undefined,
    });
    this.audit.write('update', 'guidance_content', item.id, undefined, 'devolvido a rascunho');
    this.form.enable();
    this.toasts.success('Conteúdo voltou a rascunho.');
    this.drawerOpen.set(false);
  }

  private invalid(control: FormControl<string>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }
}
