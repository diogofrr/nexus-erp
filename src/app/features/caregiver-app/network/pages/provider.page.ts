import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ServiceRequest } from '../../../../core/models';
import { CaregiverNetworkService } from '../../../../core/network/caregiver-network.service';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { FormFieldComponent } from '../../../../shared/ui/forms/form-field.component';
import { NxInputDirective } from '../../../../shared/ui/forms/input.directive';
import { ToastService } from '../../../../shared/ui/overlay/toast.service';
import { copyOrSelect } from '../../../../shared/ui/util/clipboard';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { COPY_NUMBER_FAILED, NUMBER_COPIED } from '../../state/copy-feedback';
import { CgChoice, CgChoiceGroupComponent } from '../../ui/cg-choice-group.component';
import { CgEmptyComponent } from '../../ui/cg-empty.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CgIconBadgeComponent } from '../../ui/cg-icon-badge.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgSealComponent } from '../../ui/cg-seal.component';
import { CgSheetComponent } from '../../ui/cg-sheet.component';
import { hasNetworkConditions } from '../../state/plan-access';
import {
  NETWORK_NOTICE,
  REQUEST_SUMMARY,
  ratingText,
} from '../state/network-copy';
import { ProviderAvatarComponent } from '../ui/provider-avatar.component';
import { StarsComponent } from '../ui/stars.component';

type Modality = ServiceRequest['modality'];

const SENT_MESSAGE = 'Pedido enviado. A equipe avisa você quando o profissional responder.';

/**
 * Profissional (UX C14, `/cuidador/rede/profissional/:id`): a ficha e **Pedir serviço**, que vale para TODOS os planos (decisão
 * do líder sobre S-09; só as condições especiais são do Essencial em diante). Mostra nome, especialidade, cidade, registro,
 * "Atende em casa", "Em destaque", a nota (só com 5 avaliações ou mais), o aviso de que a Nexus organiza e o pagamento é direto,
 * as condições e o telefone do profissional com **Copiar número**. NÃO mostra faixa de monitoramento, taxa de recusa, comissão,
 * disponibilidade nem comentários de avaliação (S-18 e S-30). Profissional sem a cláusula de proteção de dados não recebe pedido
 * pelo app (S-19). Suspenso, descredenciado ou inexistente: "Não encontramos este profissional.", sem dizer se existe. O pedido
 * leva ao profissional só nome, contato e o que a pessoa precisa, nunca dado de saúde (RN-LGPD-13).
 */
@Component({
  selector: 'app-cg-provider-page',
  imports: [
    RouterLink,
    IconComponent,
    FormFieldComponent,
    NxInputDirective,
    CgChoiceGroupComponent,
    CgEmptyComponent,
    CgHeroComponent,
    CgIconBadgeComponent,
    CgNoteComponent,
    CgSealComponent,
    CgSheetComponent,
    ProviderAvatarComponent,
    StarsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .nx-phone { font-weight: var(--fw-semibold); font-variant-numeric: tabular-nums; user-select: all; }
      .nx-who { display: flex; align-items: center; gap: 1rem; margin-top: 0.75rem; }
      .nx-who__text { display: grid; gap: 0.375rem; min-inline-size: 0; }
      .nx-who__text p { margin: 0; }
      .nx-who__spec { font-size: var(--cg-fs-lead); font-weight: var(--fw-semibold); color: var(--cg-heading); overflow-wrap: anywhere; }
      .nx-rate { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem; }
      .nx-head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
      .nx-head .cg-section__title { margin: 0; }
      .nx-phonebox { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border: 0; border-radius: var(--cg-radius-card); background: var(--cg-surface-sunken); }
      .nx-phonebox p { margin: 0; }
    `,
  ],
  template: `
    @if (provider(); as p) {
      <app-cg-hero [title]="p.name" backLink="/cuidador/rede/buscar" backLabel="Buscar">
        <div class="nx-who">
          <app-cg-provider-avatar [name]="p.name" size="xl" />
          <div class="nx-who__text">
            <p class="nx-who__spec" data-role="specialty">{{ p.specialtyLabel }} · {{ p.city }}</p>
            @if (p.homeCare || p.highlight) {
              <p class="cg-tags">
                @if (p.highlight) {
                  <app-cg-seal tone="gold" icon="award">Em destaque</app-cg-seal>
                }
                @if (p.homeCare) {
                  <app-cg-seal tone="care" icon="house">Atende em casa</app-cg-seal>
                }
              </p>
            }
            <p class="nx-rate" data-role="rating">
              <app-cg-stars [value]="p.average" />
              <span>{{ rating(p) }}</span>
            </p>
            @if (p.councilLabel) {
              <p class="cg-muted" data-role="council">Registro: {{ p.councilLabel }}</p>
            }
          </div>
        </div>
      </app-cg-hero>
      <div class="cg-stack">
        @if (sent()) {
          <app-cg-note variant="ok" data-role="sent">
            {{ sentMessage }}
            <a cgNoteActions class="cg-link-btn" routerLink="/cuidador/rede/pedidos">Ver meus pedidos</a>
          </app-cg-note>
        }

        <app-cg-note variant="info" data-role="notice">{{ notice }}</app-cg-note>

        @if (conditions(); as text) {
          <section aria-labelledby="provider-conditions">
            <div class="nx-head">
              <app-cg-icon-badge icon="badge-check" />
              <h2 class="cg-section__title" id="provider-conditions">Condições para quem é da Nexus</h2>
            </div>
            <p data-role="conditions">{{ text }}</p>
          </section>
        }

        @if (!p.canRequest) {
          <app-cg-note variant="soft" icon="info" data-role="no-request">
            No momento não é possível pedir este profissional pelo app. A equipe pode ajudar.
            <button cgNoteActions type="button" class="cg-link-btn" (click)="talk()">Falar com a gente</button>
          </app-cg-note>
        } @else if (sent()) {
          <!-- A faixa de "pedido enviado" já está no alto da ficha. -->
        } @else if (openRequest(); as open) {
          <app-cg-note variant="soft" data-role="already">
            Você já tem um pedido em andamento com este profissional.
            <a cgNoteActions class="cg-link-btn" [routerLink]="'/cuidador/rede/pedidos'" [queryParams]="{ pedido: open.id }">Ver pedido</a>
          </app-cg-note>
        } @else {
          <div class="cg-action-bar">
            <button type="button" class="btn btn--primary" data-role="request" (click)="openSheet(p.homeCare)">Pedir serviço</button>
          </div>
        }

        <section class="cg-stack cg-stack--tight" aria-label="Falar direto com o profissional">
          <div class="nx-phonebox">
            <app-cg-icon-badge icon="phone" />
            <p data-role="phone-line">
              Prefere falar direto com {{ p.name }}?
              <span class="nx-phone" data-role="phone" #phoneEl>{{ p.phone }}</span>.
            </p>
          </div>
          <div>
            <button type="button" class="cg-link-btn" data-role="copy-phone" (click)="copyPhone(p.phone)">
              <svg appIcon="copy" size="sm"></svg>Copiar número
            </button>
          </div>
          @if (copyFailed()) {
            <app-cg-note variant="soft" icon="info" data-role="copy-fallback">{{ copyFallback }}</app-cg-note>
          }
        </section>
      </div>

      <app-cg-sheet heading="Pedir serviço" [(open)]="sheetOpen">
        <app-form-field label="O que você precisa?" [error]="needError()" controlId="request-need">
          <textarea appInput rows="3" maxlength="280" [value]="need()" (input)="onNeed($event)"></textarea>
        </app-form-field>
        <app-cg-choice-group legend="Onde?" [options]="modalityOptions()" [(value)]="modality" />
        @if (modalityError(); as error) {
          <span class="field__error" data-role="modality-error">
            <svg appIcon="circle-alert" size="sm"></svg>
            <span><span class="sr-only">Erro: </span>{{ error }}</span>
          </span>
        }
        <p data-role="summary">{{ summary }}</p>
        @if (sendError(); as error) {
          <app-cg-note variant="error" data-role="send-error">{{ error }}</app-cg-note>
        }
        <ng-container cgSheetActions>
          <button type="button" class="btn btn--primary" data-role="send" (click)="send(p.id)">Enviar pedido</button>
          <button type="button" class="cg-link-btn" (click)="sheetOpen.set(false)">Voltar</button>
        </ng-container>
      </app-cg-sheet>
    } @else {
      <app-cg-hero title="Profissional" backLink="/cuidador/rede/buscar" backLabel="Buscar" />
      <app-cg-empty illustration="network" [headingLevel]="2" title="Não encontramos este profissional.">
        <a class="btn" routerLink="/cuidador/rede/buscar">Voltar para a busca</a>
      </app-cg-empty>
    }
  `,
})
export class ProviderPage {
  private readonly route = inject(ActivatedRoute);
  private readonly network = inject(CaregiverNetworkService);
  private readonly contact = inject(ContactDialogService);
  private readonly toast = inject(ToastService);
  private readonly doc = inject(DOCUMENT);
  protected readonly ctx = inject(CaregiverContextService);

  protected readonly notice = NETWORK_NOTICE;
  protected readonly summary = REQUEST_SUMMARY;
  protected readonly sentMessage = SENT_MESSAGE;
  protected readonly copyFallback = COPY_NUMBER_FAILED;

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly providerId = computed(() => this.params().get('id') ?? '');

  /** A ficha pública; `undefined` se não existe ou não aparece na busca (RN-REDE-18). */
  protected readonly provider = computed(() => this.network.viewOf(this.providerId()));
  protected readonly openRequest = computed(() => {
    const caregiverId = this.ctx.caregiverId();
    return caregiverId ? this.network.openRequestWith(caregiverId, this.providerId()) : undefined;
  });

  /**
   * Condições para quem é da Nexus: só do Essencial em diante (RN-REDE-25). Para o Livre a seção não existe, sem
   * cadeado nem "a partir do plano" (docs/20, regra de exibição 1).
   */
  protected readonly conditions = computed(() =>
    hasNetworkConditions(this.ctx) ? (this.provider()?.conditions ?? '').trim() : '',
  );

  // ===== O pedido =====

  protected readonly sheetOpen = signal(false);
  protected readonly need = signal('');
  protected readonly modality = signal<Modality | null>(null);
  protected readonly needError = signal<string | null>(null);
  protected readonly modalityError = signal<string | null>(null);
  protected readonly sendError = signal<string | null>(null);
  /** Para qual profissional o pedido acabou de ser enviado (a mesma tela serve a várias fichas). */
  private readonly sentFor = signal<string | null>(null);
  protected readonly sent = computed(() => this.sentFor() === this.providerId());
  protected readonly copyFailed = signal(false);
  private readonly phoneEl = viewChild<ElementRef<HTMLElement>>('phoneEl');

  protected rating(p: { average: number | null; evaluationCount: number }): string {
    return ratingText(p);
  }

  /** As opções de local que o profissional atende; com uma só, ela já vem marcada (não há o que decidir). */
  protected readonly modalityOptions = computed<CgChoice<Modality>[]>(() => [
    ...(this.provider()?.homeCare ? [{ value: 'home' as const, label: 'Em casa' }] : []),
    { value: 'at_provider' as const, label: 'No local do profissional' },
  ]);

  protected openSheet(homeCare: boolean): void {
    this.need.set('');
    this.modality.set(homeCare ? null : 'at_provider');
    this.needError.set(null);
    this.modalityError.set(null);
    this.sendError.set(null);
    this.sheetOpen.set(true);
  }

  protected onNeed(event: Event): void {
    this.need.set((event.target as HTMLTextAreaElement).value);
    if (this.need().trim()) {
      this.needError.set(null);
    }
  }

  protected send(providerId: string): void {
    const result = this.network.createRequest(this.ctx.requireCaregiverId(), {
      providerId,
      need: this.need(),
      modality: this.modality(),
    });
    if (!result.ok) {
      this.needError.set(result.field === 'need' ? result.error : null);
      this.modalityError.set(result.field === 'modality' ? result.error : null);
      this.sendError.set(result.field ? null : result.error);
      return;
    }
    this.sheetOpen.set(false);
    this.sentFor.set(providerId);
  }

  // ===== Falar direto =====

  protected talk(): void {
    this.contact.open();
  }

  protected async copyPhone(phone: string): Promise<void> {
    const ok = await copyOrSelect(phone, this.phoneEl()?.nativeElement, this.doc);
    this.copyFailed.set(!ok);
    if (ok) {
      this.toast.show({ message: NUMBER_COPIED, durationMs: 8000 });
    }
  }
}
