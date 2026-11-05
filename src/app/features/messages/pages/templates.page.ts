import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormGroup, NonNullableFormBuilder, ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import type { MessageTemplate } from '@core/models';
import {
  EmptyStateComponent,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
} from '@shared/ui';
import { DialogService, DrawerComponent, ToastService, UiPrefsService } from '@shared/ui/overlay';
import { MessagesService } from '../state/messages.service';
import { templateProblems } from '../state/message-view';

/**
 * Modelos de resposta (SCR-M11-06, RN-CAN-07): textos padrão no tom da marca. O atendimento e a gestão criam,
 * editam e excluem; os demais perfis só leem. O texto não pode prometer resultado, ter travessão nem jargão
 * (AC-M11-10): o formulário explica o que trocar.
 */
@Component({
  selector: 'app-templates-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DrawerComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <app-page-header
        title="Modelos de resposta"
        [count]="countText()"
        description="Textos padrão no tom da marca. Ao usar, o texto fica editável."
        [breadcrumbs]="[{ label: 'Mensagens', link: '/app/mensagens' }, { label: 'Modelos de resposta' }]"
      >
        @if (canEdit()) {
          <button type="button" class="btn btn--primary" data-role="new-template" (click)="openNew()">
            <svg appIcon="plus" size="sm"></svg>Novo modelo
          </button>
        }
      </app-page-header>

      @if (templates().length === 0) {
        <div class="card">
          <app-empty-state
            title="Nenhum modelo ainda"
            text="Escreva o primeiro modelo para responder mais rápido, sempre no tom da Nexus."
          >
            @if (canEdit()) {
              <button type="button" class="btn btn--primary" (click)="openNew()">Novo modelo</button>
            }
          </app-empty-state>
        </div>
      } @else {
        <ul class="stack stack--3" aria-label="Modelos de resposta" data-role="template-list">
          @for (tpl of templates(); track tpl.id) {
            <li class="card card--pad stack stack--2" data-role="template-card">
              <div class="cluster cluster--between">
                <h2 class="t-h4">{{ tpl.title }}</h2>
                @if (canEdit()) {
                  <span class="cluster">
                    <button type="button" class="btn btn--sm" data-role="edit-template" (click)="openEdit(tpl)">
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--sm btn--danger-quiet"
                      data-role="delete-template"
                      (click)="remove(tpl)"
                    >
                      Excluir
                    </button>
                  </span>
                }
              </div>
              <p class="t-ui">{{ tpl.body }}</p>
            </li>
          }
        </ul>
      }
      <p class="mt-4"><a routerLink="/app/mensagens">Voltar à caixa de entrada</a></p>
    </div>

    <app-drawer [(open)]="drawerOpen" [heading]="editing() ? 'Editar modelo' : 'Novo modelo'">
      <form id="nx-template-form" class="stack stack--3" novalidate [formGroup]="form" (ngSubmit)="save()">
        <app-error-summary [items]="errors()" />
        <app-form-field label="Título" controlId="template-title" [error]="titleError()">
          <input appInput formControlName="title" maxlength="80" />
        </app-form-field>
        <app-form-field
          label="Texto"
          hint="Acolhedor e direto. Diga o que a equipe vai fazer, sem prometer resultado."
          controlId="template-body"
          [error]="bodyError()"
        >
          <textarea appInput rows="6" formControlName="body"></textarea>
        </app-form-field>
        @if (prefs.fillWithExample()) {
          <div>
            <button type="button" class="btn btn--ghost btn--sm" data-role="fill-example" (click)="fillExample()">
              Preencher com exemplo
            </button>
          </div>
        }
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="drawerOpen.set(false)">Voltar</button>
        <button type="submit" form="nx-template-form" class="btn btn--primary" data-role="save-template">
          Salvar modelo
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class TemplatesPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly service = inject(MessagesService);
  private readonly audit = inject(AuditLogService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  protected readonly prefs = inject(UiPrefsService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<MessageTemplate | null>(null);
  protected readonly submitted = signal(false);
  protected readonly errors = signal<ErrorSummaryItem[]>([]);
  protected readonly titleError = signal<string | null>(null);
  protected readonly bodyError = signal<string | null>(null);

  protected readonly canEdit = computed(() => this.auth.can('message_inbox', 'update'));
  protected readonly templates = computed(() =>
    [...this.db.messageTemplates.all()].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
  );
  protected readonly countText = computed(() => {
    const n = this.templates().length;
    return `${n} ${n === 1 ? 'modelo' : 'modelos'}`;
  });

  protected readonly form: FormGroup<{ title: FormControl<string>; body: FormControl<string> }> =
    this.fb.group({
      title: this.fb.control(''),
      body: this.fb.control(''),
    });

  constructor() {
    effect(() => {
      if (!this.drawerOpen()) {
        untracked(() => this.editing.set(null));
      }
    });
  }

  protected openNew(): void {
    this.editing.set(null);
    this.form.reset({ title: '', body: '' });
    this.submitted.set(false);
    this.errors.set([]);
    this.titleError.set(null);
    this.bodyError.set(null);
    this.drawerOpen.set(true);
  }

  protected openEdit(tpl: MessageTemplate): void {
    this.editing.set(tpl);
    this.form.reset({ title: tpl.title, body: tpl.body });
    this.submitted.set(false);
    this.errors.set([]);
    this.titleError.set(null);
    this.bodyError.set(null);
    this.drawerOpen.set(true);
  }

  protected fillExample(): void {
    this.form.patchValue({
      title: 'Retorno combinado',
      body: 'Recebemos o seu pedido. A equipe vai retornar até amanhã no horário combinado. Se precisar de nós antes, é só escrever.',
    });
  }

  protected save(): void {
    this.submitted.set(true);
    const { title, body } = this.form.getRawValue();
    const problems = templateProblems(title, body);
    const items = problems.map((message) => ({
      controlId: /título/i.test(message) ? 'template-title' : 'template-body',
      message,
    }));
    this.errors.set(items);
    this.titleError.set(items.find((i) => i.controlId === 'template-title')?.message ?? null);
    this.bodyError.set(items.find((i) => i.controlId === 'template-body')?.message ?? null);
    if (problems.length > 0) {
      return;
    }
    const current = this.editing();
    this.service.saveTemplate({ ...(current ? { id: current.id } : {}), title, body });
    this.audit.write(current ? 'update' : 'create', 'message_template', current?.id);
    this.toasts.success(current ? 'Modelo atualizado.' : 'Modelo criado.');
    this.drawerOpen.set(false);
  }

  protected async remove(tpl: MessageTemplate): Promise<void> {
    const result = await this.dialogs.confirm({
      title: `Excluir o modelo "${tpl.title}"?`,
      message: 'As respostas já enviadas com este texto não mudam.',
      effects: { erase: ['o modelo da lista de respostas'], keep: ['as respostas já enviadas'] },
      confirmLabel: 'Excluir modelo',
      tone: 'danger',
      run: () => {
        this.service.deleteTemplate(tpl.id);
      },
    });
    if (result.confirmed) {
      this.toasts.success('Modelo excluído.');
    }
  }
}
