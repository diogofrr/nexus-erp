import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ConsentKey } from '@core/models';
import { PROTOTYPE_NOTICE } from '@core/privacy';
import { SelfRequestType } from '@core/privacy/subject-rights.service';
import { CheckboxComponent, IconComponent, IconName } from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgRowComponent } from '../../ui/cg-row.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import {
  COPY_SHEET_TEXT,
  ERASURE_CONTINUE_TEXT,
  ERASURE_DEADLINE,
  ERASURE_ERASED_TEXT,
  ERASURE_KEPT_TEXT,
  PILOT_COME_BACK,
  REQUEST_ERROR,
  REVOKE_EFFECTS,
  SHARING_NOTE,
  consentCopy,
} from '../state/privacy-copy';
import { ConsentItem, PrivacyActionResult, PrivacyService, RequestItem } from '../state/privacy.service';

type SheetView = 'consent' | 'revoke' | 'copy' | 'erasure' | 'sharing' | 'policy';

const CONSENT_ICONS: Readonly<Record<ConsentKey, IconName>> = {
  health_data: 'heart-pulse',
  people_analytics: 'chart-column',
  family_sharing: 'users',
  image_testimony: 'eye',
  whatsapp_contact: 'message-circle',
  pilot_tcle: 'clipboard-list',
};

/**
 * Privacidade e meus dados (UX C21, B11, B12; RN-USR-15 a 17, RN-LGPD-04, 05, 14, 18 a 21, 23 a 25). A pessoa vê e muda o que
 * autorizou (cada autorização é independente e nada vem marcado), pede uma cópia dos dados, pede a eliminação e
 * acompanha os prazos em dias corridos, sem relógio e sem vermelho. Toda gravação é um evento do núcleo.
 *
 * - Retirar a autorização de saúde pausa o acompanhamento (Livre, agenda e remédios continuam): a folha de efeito diz
 *   isso ANTES de gravar, com o foco em "Voltar".
 * - A eliminação nunca apaga na hora: a folha mostra o que será eliminado e o que fica guardado, com o motivo e o prazo,
 *   exige a caixa de entendimento (S-26) e só o botão de ato irreversível é vermelho, só ali.
 * - Uma folha por vez (nunca empilhadas).
 */
@Component({
  selector: 'app-privacy-page',
  imports: [CgPageHeaderComponent, CgRowComponent, CgSheetComponent, CgNoteComponent, CheckboxComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .priv__req { display: grid; gap: 0.5rem; padding: 1rem; }
      .priv__req p { margin: 0; overflow-wrap: anywhere; }
      .priv__req-name { font-weight: 600; font-size: var(--cg-fs-lead); }
      .priv__req-meta { color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
      .priv__req-status { font-weight: 600; color: var(--cg-heading); }
      .priv__state { margin: 0; font-weight: 600; color: var(--cg-heading); }
      .priv__sheet p { margin: 0; }
      .priv__more { border: 1px solid var(--cg-border); border-radius: var(--cg-radius-control); padding: 0.25rem 1rem; }
      .priv__more > summary { min-height: var(--cg-target); display: flex; align-items: center; font-weight: 600; cursor: pointer; }
      .priv__more-body { display: grid; gap: 0.75rem; padding-bottom: 0.75rem; }
      .priv__history { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
      .priv__history li { display: grid; gap: 0; padding: 0.5rem 0.75rem; border-left: 3px solid var(--cg-border-control); background: var(--cg-surface-sunken); border-radius: 0 var(--cg-radius-control) var(--cg-radius-control) 0; }
      .priv__history small { color: var(--cg-text-soft); font-size: var(--cg-fs-caption); }
      .priv__effects { display: grid; gap: 0.75rem; }
      .priv__effects section { display: grid; gap: 0.25rem; padding: 0.75rem 1rem; border: 1px solid var(--cg-border); border-radius: var(--cg-radius-control); background: var(--cg-surface-sunken); }
      .priv__effects h3 { margin: 0; font-size: var(--cg-fs-lead); }
      @media (min-width: 48rem) { .priv__effects { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .priv__hint { color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
      .priv__shared { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
      .priv__shared li { display: grid; gap: 0.125rem; padding: 0.75rem 1rem; border: 1px solid var(--cg-border); border-radius: var(--cg-radius-control); }
      .priv__shared small { color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
      .priv__dpo { padding: 0.75rem 1rem; border-radius: var(--cg-radius-control); background: var(--brand-soft); }
    `,
  ],
  template: `
    <app-cg-page-header
      title="Privacidade e meus dados"
      description="Você decide o que a Nexus pode fazer com os seus dados. Pode mudar quando quiser. O plano Livre continua em qualquer caso."
      backLink="/cuidador/mais"
      backLabel="Mais"
    />

    <div class="cg-stack">
      @if (requests().length > 0) {
        <section aria-labelledby="priv-requests" data-role="requests">
          <h2 class="cg-section__title" id="priv-requests">Meus pedidos</h2>
          <ul class="cg-list">
            @for (request of requests(); track request.id) {
              <li class="priv__req" data-role="request">
                <p class="priv__req-name">{{ request.name }}</p>
                <p class="priv__req-meta">{{ request.madeText }}</p>
                <p class="priv__req-status" data-role="request-status">{{ request.statusText }}</p>
                @if (request.keptText) {
                  <p class="priv__req-meta" data-role="request-kept">Ficou guardado e sem uso: {{ request.keptText }}</p>
                }
                @if (request.canDownload) {
                  <div class="cg-actions">
                    <button type="button" class="btn btn--primary" (click)="download()">
                      <svg appIcon="download" size="sm"></svg>Baixar o arquivo
                    </button>
                  </div>
                }
                @if (request.pending) {
                  <div>
                    <button type="button" class="cg-link-btn" (click)="withdraw(request)">Retirar o pedido</button>
                  </div>
                }
              </li>
            }
          </ul>
        </section>
      }

      <section aria-labelledby="priv-consents">
        <h2 class="cg-section__title" id="priv-consents">Minhas autorizações</h2>
        <ul class="cg-list" data-role="consents">
          @for (item of items(); track item.key) {
            <li>
              <app-cg-row
                [title]="item.name"
                [description]="item.stateText"
                [icon]="icons[item.key]"
                (activated)="openConsent(item.key)"
              />
            </li>
          }
        </ul>
      </section>

      <section aria-labelledby="priv-data">
        <h2 class="cg-section__title" id="priv-data">Meus dados</h2>
        <ul class="cg-list" data-role="data-actions">
          <li><app-cg-row title="Pedir uma cópia dos meus dados" icon="download" (activated)="open('copy')" /></li>
          <li><app-cg-row title="Corrigir meus dados" icon="pencil" link="/cuidador/mais/perfil" /></li>
          <li><app-cg-row title="Pedir eliminação dos meus dados" icon="trash-2" (activated)="openErasure()" /></li>
          <li><app-cg-row title="Com quem os meus dados foram compartilhados" icon="users-round" (activated)="open('sharing')" /></li>
          <li><app-cg-row title="Política de privacidade e contato do encarregado" icon="shield-check" (activated)="open('policy')" /></li>
        </ul>
      </section>
    </div>

    <!-- Detalhe de uma autorização -->
    <app-cg-sheet [heading]="selected()?.name ?? ''" [open]="is('consent')" (openChange)="onOpenChange('consent', $event)">
      @if (selected(); as item) {
        <div class="priv__sheet cg-stack cg-stack--tight">
          <p class="priv__state" data-role="consent-state">{{ item.stateText }}</p>
          <p><strong>{{ copy().question }}</strong></p>
          <p>{{ copy().what }}</p>
          <p>{{ copy().who }}</p>
          <details class="priv__more">
            <summary>Mais detalhes</summary>
            <div class="priv__more-body">
              <p>{{ copy().why }}</p>
              <p>{{ copy().ifNo }}</p>
              <p>{{ copy().change }}</p>
            </div>
          </details>
          @if (item.key === 'pilot_tcle' && !item.canRevoke) {
            <app-cg-note variant="info">{{ pilotComeBack }}</app-cg-note>
          }
          <div>
            <button type="button" class="cg-link-btn" [attr.aria-expanded]="historyOpen()" (click)="historyOpen.set(!historyOpen())">
              <svg appIcon="history" size="sm"></svg>Ver histórico
            </button>
          </div>
          @if (historyOpen()) {
            @if (history().length > 0) {
              <ol class="priv__history" data-role="history" aria-label="Histórico desta autorização">
                @for (entry of history(); track entry.id) {
                  <li>
                    <span>{{ entry.label }}</span>
                    <small>{{ entry.date }}, termo versão {{ entry.termVersion }}</small>
                  </li>
                }
              </ol>
            } @else {
              <p data-role="history">Ainda não há nada no histórico.</p>
            }
          }
          @if (error()) {
            <app-cg-note variant="error"><span data-role="sheet-error">{{ error() }}</span></app-cg-note>
          }
        </div>
      }
      <ng-container cgSheetActions>
        @if (selected(); as item) {
          @if (item.canGrant) {
            <button type="button" class="btn btn--primary" (click)="grant(item)">{{ item.grantLabel }}</button>
          }
          @if (item.canRefuse) {
            <button type="button" class="btn" (click)="refuse(item)">Não autorizar</button>
          }
          @if (item.canRevoke) {
            <button type="button" class="btn" (click)="askRevoke()">Retirar a autorização</button>
          }
        }
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Efeito de retirar uma autorização, antes de gravar -->
    <app-cg-sheet heading="Retirar a autorização?" initialFocus="safe-action" [open]="is('revoke')" (openChange)="onOpenChange('revoke', $event)">
      @if (selected(); as item) {
        <div class="priv__sheet cg-stack cg-stack--tight">
          <p><strong>{{ item.name }}</strong></p>
          <p data-role="revoke-effect">{{ revokeEffect() }}</p>
          @if (error()) {
            <app-cg-note variant="error"><span data-role="sheet-error">{{ error() }}</span></app-cg-note>
          }
        </div>
      }
      <ng-container cgSheetActions>
        <button type="button" class="btn" (click)="confirmRevoke()">Retirar a autorização</button>
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Pedir uma cópia -->
    <app-cg-sheet heading="Pedir uma cópia dos meus dados" [open]="is('copy')" (openChange)="onOpenChange('copy', $event)">
      <div class="priv__sheet cg-stack cg-stack--tight">
        @if (pendingCopy(); as pending) {
          <app-cg-note variant="info"><span data-role="duplicate">Você já tem um pedido de cópia em andamento.</span></app-cg-note>
        } @else {
          <p data-role="copy-text">{{ copyText }}</p>
        }
        @if (error()) {
          <app-cg-note variant="error"><span data-role="sheet-error">{{ error() }}</span></app-cg-note>
        }
      </div>
      <ng-container cgSheetActions>
        @if (!pendingCopy()) {
          <button type="button" class="btn btn--primary" (click)="requestCopy()">Pedir a cópia</button>
        }
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Pedir a eliminação (ato irreversível: o único botão vermelho da tela) -->
    <app-cg-sheet heading="Pedir eliminação dos meus dados" initialFocus="safe-action" [open]="is('erasure')" (openChange)="onOpenChange('erasure', $event)">
      <div class="priv__sheet cg-stack cg-stack--tight">
        @if (pendingErasure(); as pending) {
          <app-cg-note variant="info"><span data-role="duplicate">Você já tem um pedido de eliminação em andamento.</span></app-cg-note>
        } @else {
          <div class="priv__effects" data-role="erasure-effects">
            <section aria-labelledby="priv-erase">
              <h3 id="priv-erase">Será eliminado</h3>
              <p>{{ erasedText }}</p>
            </section>
            <section aria-labelledby="priv-keep">
              <h3 id="priv-keep">Ficará guardado e sem uso</h3>
              <p>{{ keptText }}</p>
            </section>
          </div>
          <p data-role="erasure-deadline">{{ deadlineText }}</p>
          <p data-role="erasure-continue">{{ continueText }}</p>
          <app-checkbox [(checked)]="understood">Entendi o que será eliminado e o que ficará guardado</app-checkbox>
          @if (!understood()) {
            <p class="priv__hint" data-role="erasure-hint">Marque a caixa para ligar o botão.</p>
          }
        }
        @if (error()) {
          <app-cg-note variant="error"><span data-role="sheet-error">{{ error() }}</span></app-cg-note>
        }
      </div>
      <ng-container cgSheetActions>
        @if (!pendingErasure()) {
          <button type="button" class="btn btn--danger" [disabled]="!understood()" (click)="requestErasure()">Pedir eliminação</button>
        }
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Com quem compartilhamos -->
    <app-cg-sheet heading="Com quem os meus dados foram compartilhados" [open]="is('sharing')" (openChange)="onOpenChange('sharing', $event)">
      <div class="priv__sheet cg-stack cg-stack--tight">
        @if (shared().length > 0) {
          <ul class="priv__shared" data-role="shared-with">
            @for (item of shared(); track item.id) {
              <li>
                <strong>{{ item.name }}</strong>
                <small>{{ item.dateLabel }}. Enviamos: nome, contato e o que você pediu.</small>
              </li>
            }
          </ul>
        } @else {
          <p data-role="shared-empty">Nenhum profissional recebeu os seus dados.</p>
        }
        <p data-role="shared-note">{{ sharingNote }}</p>
      </div>
      <ng-container cgSheetActions>
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>

    <!-- Política de privacidade -->
    <app-cg-sheet heading="Política de privacidade" [open]="is('policy')" (openChange)="onOpenChange('policy', $event)">
      @if (policy(); as doc) {
        <div class="priv__policy cg-stack cg-stack--tight" data-role="policy">
          @for (paragraph of doc.paragraphs; track $index) {
            <p>{{ paragraph }}</p>
          }
          <div class="priv__dpo">
            <p><strong>Contato do encarregado</strong></p>
            <p data-role="dpo">{{ doc.dpoName }} (fictício), {{ doc.dpoEmail }}</p>
          </div>
        </div>
      }
      <p data-role="policy-proto">{{ protoNotice }}</p>
      <ng-container cgSheetActions>
        <button type="button" class="cg-link-btn" (click)="close()">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
export class PrivacyPage {
  private readonly privacy = inject(PrivacyService);
  private readonly toast = inject(ToastService);

  protected readonly icons = CONSENT_ICONS;
  protected readonly items = this.privacy.items;
  protected readonly requests = this.privacy.requests;
  protected readonly shared = this.privacy.sharedWith;
  protected readonly policy = this.privacy.policy;

  protected readonly pilotComeBack = PILOT_COME_BACK;
  protected readonly copyText = COPY_SHEET_TEXT;
  protected readonly erasedText = ERASURE_ERASED_TEXT;
  protected readonly keptText = ERASURE_KEPT_TEXT;
  protected readonly continueText = ERASURE_CONTINUE_TEXT;
  protected readonly deadlineText = ERASURE_DEADLINE;
  protected readonly sharingNote = SHARING_NOTE;
  protected readonly protoNotice = PROTOTYPE_NOTICE;

  private readonly view = signal<SheetView | null>(null);
  private readonly selectedKey = signal<ConsentKey | null>(null);
  protected readonly historyOpen = signal(false);
  protected readonly understood = signal(false);
  protected readonly error = signal('');

  protected readonly selected = computed<ConsentItem | null>(
    () => this.items().find((i) => i.key === this.selectedKey()) ?? null,
  );
  protected readonly copy = computed(() => consentCopy(this.selectedKey() ?? 'health_data'));
  protected readonly history = computed(() => {
    const key = this.selectedKey();
    this.items();
    return key ? this.privacy.historyOf(key) : [];
  });
  protected readonly revokeEffect = computed(() => REVOKE_EFFECTS[this.selectedKey() ?? 'health_data']);
  protected readonly pendingCopy = computed(() => this.pending('access'));
  protected readonly pendingErasure = computed(() => this.pending('erasure'));

  protected is(view: SheetView): boolean {
    return this.view() === view;
  }

  protected open(view: SheetView): void {
    this.error.set('');
    this.view.set(view);
  }

  protected openConsent(key: ConsentKey): void {
    this.selectedKey.set(key);
    this.historyOpen.set(false);
    this.open('consent');
  }

  protected openErasure(): void {
    this.understood.set(false);
    this.open('erasure');
  }

  protected close(): void {
    this.view.set(null);
  }

  /** Esc, toque no fundo e "Voltar" fecham: só desliga se a folha que fechou é a que está aberta. */
  protected onOpenChange(view: SheetView, open: boolean): void {
    if (!open && this.view() === view) {
      this.view.set(null);
    }
  }

  // ===== Autorizações =====

  protected grant(item: ConsentItem): void {
    this.finish(this.privacy.grant(item.key), 'Autorização registrada. Você pode mudar quando quiser.');
  }

  protected refuse(item: ConsentItem): void {
    this.finish(this.privacy.refuse(item.key), 'Anotado: você não autorizou. Você pode mudar quando quiser.');
  }

  protected askRevoke(): void {
    this.open('revoke');
  }

  protected confirmRevoke(): void {
    const key = this.selectedKey();
    if (!key) {
      return;
    }
    this.finish(this.privacy.revoke(key), 'Você retirou a autorização. Pode autorizar de novo quando quiser.');
  }

  // ===== Pedidos =====

  protected requestCopy(): void {
    this.finishRequest(this.privacy.requestCopy(), 'Pedido feito. A equipe avisa você em até 15 dias.');
  }

  protected requestErasure(): void {
    this.finishRequest(this.privacy.requestErasure(), 'Pedido feito. Você continua usando o app até a equipe concluir.');
  }

  protected withdraw(request: RequestItem): void {
    const result = this.privacy.withdraw(request.id);
    if (result.ok) {
      this.toast.show({ message: 'Pedido retirado. Nada foi eliminado.', durationMs: 8000 });
    } else {
      this.toast.show({ message: result.error, tone: 'danger', durationMs: 8000 });
    }
  }

  protected download(): void {
    if (this.privacy.download()) {
      this.toast.show({ message: 'Arquivo baixado.', durationMs: 8000 });
    } else {
      this.toast.show({ message: 'Não foi possível baixar o arquivo. Tente de novo.', tone: 'danger', durationMs: 8000 });
    }
  }

  // ===== Internos =====

  private pending(type: SelfRequestType): RequestItem | null {
    return this.privacy.pendingOf(type);
  }

  private finish(result: PrivacyActionResult, message: string): void {
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.error.set('');
    this.close();
    this.toast.show({ message, durationMs: 8000 });
  }

  private finishRequest(result: PrivacyActionResult, message: string): void {
    if (!result.ok && result.error === 'duplicate') {
      // O pedido já existia: a folha passa a dizer isso (o serviço não cria outro).
      this.error.set('');
      return;
    }
    if (!result.ok) {
      this.error.set(result.error || REQUEST_ERROR);
      return;
    }
    this.error.set('');
    this.close();
    this.toast.show({ message, durationMs: 8000 });
  }
}
