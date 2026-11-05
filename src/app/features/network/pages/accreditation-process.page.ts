import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { ChecklistKey, ChecklistStatus, ProviderDocument } from '@core/models';
import { ACCREDITATION_CHECKLIST_KEYS, CHECKLIST_LABELS } from '@core/rules';
import {
  BadgeComponent,
  EmptyStateComponent,
  IconComponent,
  PageHeaderComponent,
  RadioOption,
} from '@shared/ui';
import { BannerComponent, DialogService, DrawerComponent, ToastService } from '@shared/ui/overlay';
import { IntegrationStepsComponent } from '../components/integration-steps.component';
import { ProviderDocumentsComponent } from '../components/provider-documents.component';
import { ReasonDrawerComponent, ReasonSubmit } from '../components/reason-drawer.component';
import { NetworkAdminService } from '../state/network-admin.service';
import {
  ACCREDITATION_STATUS_LABEL,
  ACCREDITATION_STATUS_VARIANT,
  DOCUMENT_KIND_LABEL,
  categoryLabel,
  councilText,
  subtitleOf,
} from '../state/network-labels';
import { ProviderStatusComponent } from '../components/badges.component';

const STATE_VIEW = {
  ok: { icon: 'circle-check', variant: 'success', label: 'Cumprido' },
  pending: { icon: 'clock', variant: 'attention', label: 'Pendente' },
  failed: { icon: 'circle-alert', variant: 'danger', label: 'Não cumprido' },
  not_applicable: { icon: 'circle-dashed', variant: 'neutral', label: 'Não se aplica' },
} as const;

const DOCUMENT_KINDS = Object.keys(DOCUMENT_KIND_LABEL) as ProviderDocument['kind'][];

/**
 * Processo de credenciamento (SCR-M08-04, PD-09): os 5 critérios com quem conferiu e quando, os documentos com
 * validade e a barra de decisão (aprovar, pedir documentos, reprovar). "Aprovar" só habilita com os 5 critérios
 * cumpridos e todos os documentos na validade, e o motivo do bloqueio aparece ao lado (A-33, AC-M08-01). Depois
 * de aprovado, "Ativar" exige integração, ciência dos POPs e aceite de não captar usuários por fora (AC-M08-13).
 */
@Component({
  selector: 'app-network-accreditation-process-page',
  imports: [
    RouterLink,
    BadgeComponent,
    BannerComponent,
    DrawerComponent,
    EmptyStateComponent,
    IconComponent,
    IntegrationStepsComponent,
    PageHeaderComponent,
    ProviderDocumentsComponent,
    ProviderStatusComponent,
    ReasonDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (!accreditation() || !provider()) {
        <div class="card">
          <app-empty-state
            kind="error"
            title="Não encontramos este processo"
            text="Ele pode ter sido removido. Volte ao quadro de credenciamento para continuar."
          >
            <a class="btn" routerLink="/app/rede/credenciamento">Voltar ao credenciamento</a>
          </app-empty-state>
        </div>
      } @else {
        @let p = provider()!;
        @let acc = accreditation()!;
        <app-page-header
          [title]="p.name"
          [description]="subtitle()"
          [breadcrumbs]="[{ label: 'Credenciamento', link: '/app/rede/credenciamento' }, { label: p.name }]"
        >
          <a class="btn" [routerLink]="['/app/rede/prestadores', p.id]" data-role="open-provider">Ver ficha do prestador</a>
        </app-page-header>

        <div class="stack stack--6">
          <div class="cluster">
            <app-badge [variant]="statusVariant()" dot>{{ statusLabel() }}</app-badge>
            <app-provider-status [status]="p.status" />
          </div>

          @if (acc.status === 'rejected') {
            <app-banner variant="danger" heading="Credenciamento reprovado">
              {{ acc.rejectionReason }}
              Para voltar, será preciso abrir um novo processo.
            </app-banner>
          }
          @if (acc.status === 'active') {
            <app-banner variant="success" heading="Credenciamento ativo">
              {{ p.name }} aparece na busca da rede.
            </app-banner>
          }
          @if (acc.status === 'pending_documents') {
            <app-banner variant="attention" heading="Documentos pendentes">
              O processo volta para análise quando todos os documentos estiverem dentro da validade.
            </app-banner>
          }

          <section class="card card--pad stack stack--3" aria-labelledby="nx-criteria-title" data-role="criteria">
            <div class="cluster cluster--between">
              <h2 class="card__title" id="nx-criteria-title">Critérios de credenciamento</h2>
              <span class="t-caption">{{ progressText() }}</span>
            </div>
            <ul class="checklist" role="list" aria-label="Critérios de credenciamento">
              @for (item of criteria(); track item.key) {
                <li class="checklist__item" [attr.data-state]="item.dataState" [attr.data-key]="item.key">
                  <svg [appIcon]="item.icon"></svg>
                  <div>
                    <div class="checklist__title">{{ item.title }}</div>
                    <div class="checklist__text">{{ item.text }}</div>
                  </div>
                  <div class="cluster">
                    <app-badge [variant]="item.variant" [outline]="item.status === 'not_applicable'">{{ item.badge }}</app-badge>
                    @if (decidable() && manager()) {
                      <button type="button" class="btn btn--sm" data-role="check-criterion" (click)="startCheck(item.key)">
                        Conferir
                      </button>
                    }
                  </div>
                </li>
              }
            </ul>
          </section>

          <section class="card card--pad stack stack--3" aria-labelledby="nx-docs-title" data-role="documents">
            <h2 class="card__title" id="nx-docs-title">Documentos com validade</h2>
            <app-provider-documents [providerId]="p.id" />
          </section>

          @if (acc.status === 'approved' || acc.status === 'active') {
            <section class="card card--pad stack stack--3" aria-labelledby="nx-integration-title" data-role="integration">
              <h2 class="card__title" id="nx-integration-title">Integração</h2>
              <app-integration-steps [providerId]="p.id" />
              @if (acc.status === 'approved' && manager()) {
                <div class="cluster">
                  <button
                    type="button"
                    class="btn btn--primary"
                    data-role="activate"
                    [attr.aria-disabled]="activationBlockers().length > 0 ? 'true' : null"
                    aria-describedby="nx-activate-hint"
                    (click)="activate()"
                  >
                    Ativar prestador
                  </button>
                  @if (activationBlockers().length > 0) {
                    <p class="t-caption" id="nx-activate-hint" data-role="activate-hint">
                      Para ativar falta: {{ activationBlockers().join('; ') }}.
                    </p>
                  }
                </div>
              }
            </section>
          }

          @if (decidable() && manager()) {
            <div class="action-bar" data-role="decision-bar">
              <button
                type="button"
                class="btn btn--primary"
                data-role="approve"
                [attr.aria-disabled]="blocker() ? 'true' : null"
                aria-describedby="nx-approve-hint"
                (click)="approve()"
              >
                Aprovar
              </button>
              <button type="button" class="btn" data-role="request-documents" (click)="startRequest()">
                Pedir documentos
              </button>
              <button type="button" class="btn btn--danger-quiet" data-role="reject" (click)="rejectOpen.set(true)">
                Reprovar
              </button>
              <p class="t-caption" id="nx-approve-hint" data-role="approve-hint">
                @if (blocker(); as why) {
                  {{ why }}
                } @else {
                  Os 5 critérios estão cumpridos e os documentos estão na validade.
                }
              </p>
            </div>
          }
        </div>
      }
    </div>

    <app-reason-drawer
      [(open)]="checkOpen"
      [heading]="checkHeading()"
      [subtitle]="provider()?.name ?? ''"
      optionsLabel="Situação do critério"
      [options]="checkOptions()"
      [initialChoice]="checkInitial()"
      optionRequiredMessage="Escolha a situação do critério."
      label="Observação"
      [textRequired]="false"
      confirmLabel="Salvar conferência"
      [error]="actionError()"
      (submitted)="saveCheck($event)"
    />
    <app-reason-drawer
      [(open)]="rejectOpen"
      heading="Reprovar o credenciamento"
      [subtitle]="provider()?.name ?? ''"
      label="Motivo da reprovação"
      requiredMessage="Escreva o motivo da reprovação."
      confirmLabel="Reprovar credenciamento"
      [danger]="true"
      effect="O motivo fica registrado no histórico. O aviso ao candidato é feito por você, fora do ERP. Para voltar, será preciso um novo processo."
      [error]="actionError()"
      (submitted)="reject($event)"
    />
    <app-drawer [(open)]="requestOpen" heading="Pedir documentos" [subtitle]="provider()?.name ?? ''">
      <form id="nx-request-docs" class="stack stack--3" novalidate (submit)="sendRequest($event)">
        <p class="t-ui">
          O processo vai para Documentos pendentes e o texto do e-mail fica registrado no histórico. O envio é
          feito por você, fora do ERP.
        </p>
        <fieldset class="stack stack--2">
          <legend class="field__label">Documentos pedidos</legend>
          @for (kind of documentKinds; track kind) {
            <label class="check">
              <input type="checkbox" [checked]="requestKinds().includes(kind)" (change)="toggleKind(kind)" />
              <span>{{ kindLabel(kind) }}</span>
            </label>
          }
        </fieldset>
        <div class="field" [class.field--error]="!!requestError()">
          <label class="field__label" for="nx-request-email">Texto do e-mail</label>
          <textarea class="textarea" id="nx-request-email" rows="6" [value]="requestEmail()" (input)="onEmail($event)"></textarea>
          @if (requestError()) {
            <span class="field__error" role="alert" data-role="request-error">{{ requestError() }}</span>
          }
        </div>
      </form>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="requestOpen.set(false)">Voltar</button>
        <button type="submit" form="nx-request-docs" class="btn btn--primary" data-role="send-request">
          Pedir documentos
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class AccreditationProcessPage {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(Database);
  private readonly admin = inject(NetworkAdminService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly documentKinds = DOCUMENT_KINDS;
  protected readonly checkOpen = signal(false);
  protected readonly rejectOpen = signal(false);
  protected readonly requestOpen = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly requestError = signal<string | null>(null);
  protected readonly requestKinds = signal<readonly ProviderDocument['kind'][]>([]);
  protected readonly requestEmail = signal('');
  private readonly checkKey = signal<ChecklistKey>('council_registry');

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  protected readonly accreditation = computed(() => this.db.accreditations.get(this.id()));
  protected readonly provider = computed(() => {
    const acc = this.accreditation();
    return acc ? this.db.providers.get(acc.providerId) : undefined;
  });
  protected readonly manager = computed(() => this.admin.isManager());
  protected readonly decidable = computed(() => {
    const status = this.accreditation()?.status;
    return status === 'requested' || status === 'in_review' || status === 'pending_documents';
  });
  protected readonly subtitle = computed(() => {
    const p = this.provider();
    return p ? subtitleOf(categoryLabel(p.category), p.specialtyLabel, councilText(p.council)) : '';
  });
  protected readonly statusLabel = computed(() => {
    const status = this.accreditation()?.status;
    return status ? ACCREDITATION_STATUS_LABEL[status] : '';
  });
  protected readonly statusVariant = computed(() => {
    const status = this.accreditation()?.status;
    return status ? ACCREDITATION_STATUS_VARIANT[status] : 'neutral';
  });

  protected readonly criteria = computed(() => {
    const acc = this.accreditation();
    if (!acc) {
      return [];
    }
    return ACCREDITATION_CHECKLIST_KEYS.map((key) => {
      const item = acc.checklist[key];
      const view = STATE_VIEW[item.status];
      const when = item.checkedAt ? formatDate(item.checkedAt) : '';
      const note = item.note ? ` ${item.note}` : '';
      const text =
        item.status === 'ok'
          ? `Conferido em ${when}.${note}`
          : item.status === 'not_applicable'
            ? 'Esta categoria não tem conselho de classe.'
            : item.status === 'failed'
              ? `Não cumprido${when ? ` (conferido em ${when})` : ''}.${note}`
              : `Ainda não conferido.${note}`;
      return {
        key,
        status: item.status,
        title: CHECKLIST_LABELS[key],
        text,
        icon: view.icon,
        variant: view.variant,
        badge: view.label,
        dataState: item.status === 'not_applicable' ? 'na' : item.status === 'failed' ? 'fail' : item.status,
      };
    });
  });

  protected readonly progressText = computed(() => {
    const acc = this.accreditation();
    if (!acc) {
      return '';
    }
    const done = ACCREDITATION_CHECKLIST_KEYS.filter(
      (k) => acc.checklist[k].status === 'ok' || (k === 'council_registry' && acc.checklist[k].status === 'not_applicable'),
    ).length;
    return `${done} de 5 critérios cumpridos`;
  });

  protected readonly blocker = computed(() => {
    const acc = this.accreditation();
    return acc ? this.admin.approvalBlocker(acc) : null;
  });

  protected readonly activationBlockers = computed(() => {
    const p = this.provider();
    return p ? this.admin.activationBlockers(p) : [];
  });

  protected readonly checkHeading = computed(() => `Conferir: ${CHECKLIST_LABELS[this.checkKey()]}`);
  protected readonly checkInitial = computed(() => {
    const status = this.accreditation()?.checklist[this.checkKey()].status;
    return status ?? null;
  });
  protected readonly checkOptions = computed<RadioOption<string>[]>(() => {
    const base: RadioOption<string>[] = [
      { value: 'ok', label: 'Cumprido' },
      { value: 'failed', label: 'Não cumprido' },
      { value: 'pending', label: 'Pendente' },
    ];
    return this.checkKey() === 'council_registry'
      ? [...base, { value: 'not_applicable', label: 'Não se aplica', hint: 'Só para categorias sem conselho de classe.' }]
      : base;
  });

  protected kindLabel(kind: ProviderDocument['kind']): string {
    return DOCUMENT_KIND_LABEL[kind];
  }

  // ===== Conferir um critério =====

  protected startCheck(key: ChecklistKey): void {
    this.checkKey.set(key);
    this.actionError.set(null);
    this.checkOpen.set(true);
  }

  protected saveCheck(input: ReasonSubmit): void {
    const acc = this.accreditation();
    if (!acc || !input.choice) {
      return;
    }
    const result = this.admin.setChecklist(acc.id, this.checkKey(), input.choice as ChecklistStatus, input.text);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.actionError.set(null);
    this.checkOpen.set(false);
    this.toasts.success(`${CHECKLIST_LABELS[this.checkKey()]}: conferência registrada.`);
  }

  // ===== Decisão =====

  protected async approve(): Promise<void> {
    const acc = this.accreditation();
    const p = this.provider();
    if (!acc || !p) {
      return;
    }
    const blocker = this.admin.approvalBlocker(acc);
    if (blocker) {
      this.toasts.attention(blocker);
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Aprovar o credenciamento de ${p.name}?`,
      message:
        'O prestador só aparece na busca depois da integração, da ciência dos POPs e do aceite de não captar usuários por fora.',
      effects: { keep: ['os critérios conferidos e os documentos, como estão agora'] },
      confirmLabel: 'Aprovar credenciamento',
    });
    if (!confirmed) {
      return;
    }
    const result = this.admin.approve(acc.id);
    if (result.ok) {
      this.toasts.success(`Credenciamento de ${p.name} aprovado. Falta concluir a integração.`);
    } else {
      this.toasts.error(result.error);
    }
  }

  protected reject(input: ReasonSubmit): void {
    const acc = this.accreditation();
    if (!acc) {
      return;
    }
    const result = this.admin.reject(acc.id, input.text);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.actionError.set(null);
    this.rejectOpen.set(false);
    this.toasts.success('Credenciamento reprovado. O motivo ficou registrado.');
  }

  protected startRequest(): void {
    const acc = this.accreditation();
    const p = this.provider();
    if (!acc || !p) {
      return;
    }
    const docs = this.db.providerDocuments.all().filter((d) => d.providerId === p.id);
    const today = this.admin.today();
    const wanted = DOCUMENT_KINDS.filter((kind) => {
      const own = docs.find((d) => d.kind === kind);
      if (kind === 'council_registry' && p.council.body === 'NONE') {
        return false;
      }
      return !own || (own.validUntil !== undefined && own.validUntil < today);
    });
    this.requestKinds.set(wanted);
    this.requestError.set(null);
    this.requestEmail.set(this.defaultEmail(p.name, wanted));
    this.requestOpen.set(true);
  }

  private defaultEmail(name: string, kinds: readonly ProviderDocument['kind'][]): string {
    const list = kinds.length > 0 ? kinds.map((k) => DOCUMENT_KIND_LABEL[k].toLowerCase()).join(', ') : 'os documentos combinados';
    return `Olá, ${name}. Para continuar o seu credenciamento na rede Nexus, precisamos receber: ${list}. Assim que chegarem, retomamos a análise.`;
  }

  protected toggleKind(kind: ProviderDocument['kind']): void {
    const current = this.requestKinds();
    const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind];
    this.requestKinds.set(next);
    const p = this.provider();
    if (p) {
      this.requestEmail.set(this.defaultEmail(p.name, next));
    }
  }

  protected onEmail(event: Event): void {
    this.requestEmail.set((event.target as HTMLTextAreaElement).value);
  }

  protected sendRequest(event: Event): void {
    event.preventDefault();
    const acc = this.accreditation();
    if (!acc) {
      return;
    }
    const result = this.admin.requestDocuments(acc.id, this.requestKinds(), this.requestEmail());
    if (!result.ok) {
      this.requestError.set(result.error);
      return;
    }
    this.requestOpen.set(false);
    this.toasts.success('Pedido registrado. O processo foi para Documentos pendentes.');
  }

  protected async activate(): Promise<void> {
    const p = this.provider();
    if (!p) {
      return;
    }
    const blockers = this.admin.activationBlockers(p);
    if (blockers.length > 0) {
      this.toasts.attention(`Para ativar falta: ${blockers.join('; ')}.`);
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: `Ativar ${p.name}?`,
      message: 'O prestador passa a aparecer na busca da rede, junto com os demais da mesma especialidade.',
      effects: { keep: ['o histórico do credenciamento'] },
      confirmLabel: 'Ativar prestador',
    });
    if (!confirmed) {
      return;
    }
    const result = this.admin.activate(p.id);
    if (result.ok) {
      this.toasts.success(`${p.name} está ativo e aparece na busca.`);
    } else {
      this.toasts.error(result.error);
    }
  }
}
