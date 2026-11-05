import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate, formatTime } from '@core/format';
import { ConsentService } from '@core/privacy/consent.service';
import { ZARIT_ANSWER_LABELS, ZARIT_DEMO_ITEMS, ZARIT_ITEM_COUNT } from '@core/rules';
import {
  BadgeComponent,
  DraftService,
  EmptyStateComponent,
  PageHeaderComponent,
  WizardAnswers,
  WizardComponent,
  WizardItem,
} from '@shared/ui';
import { DialogService, PageContextService, ToastService } from '@shared/ui/overlay';
import { NO_CONSENT_TEXT, ZaritService } from '../state/zarit.service';

type Stage = 'intro' | 'wizard' | 'review';

const WIZARD_ITEMS: WizardItem[] = ZARIT_DEMO_ITEMS.map((question, i) => ({
  id: `q${i + 1}`,
  question,
  hint: 'Pense nas últimas semanas. Não há resposta certa ou errada.',
  options: ZARIT_ANSWER_LABELS.map((label, value) => ({ value, label })),
}));

/**
 * SCR-M06-02, Aplicar Zarit (F05, PD-04 e PD-09, tela de foco). Um item por tela, teclas 0 a 4, mapa dos itens,
 * rascunho automático e revisão antes de concluir. O total e a faixa só aparecem no fim. Sem consentimento de
 * saúde ativo não há aplicação nem rascunho (RN-ZRT-07, RN-LGPD-14). A aplicação concluída é assinada e imutável.
 */
@Component({
  selector: 'app-zarit-apply-page',
  imports: [BadgeComponent, EmptyStateComponent, PageHeaderComponent, RouterLink, WizardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow stack stack--6">
      <app-page-header title="Aplicar a escala de Zarit" [description]="subtitle()">
        <button type="button" class="btn" (click)="leave()" data-role="leave">Sair da aplicação</button>
      </app-page-header>

      @if (!caregiver()) {
        <app-empty-state title="Cuidador não encontrado" text="Volte à fila e escolha o cuidador de novo.">
          <a class="btn btn--primary" routerLink="/app/acompanhamento/fila">Voltar à fila</a>
        </app-empty-state>
      } @else if (!consentOk()) {
        <app-empty-state kind="forbidden" title="Sem consentimento de dados de saúde" [text]="blockedText()" data-role="no-consent">
          <a class="btn btn--primary" [routerLink]="['/app/cuidadores', caregiver()?.id]" [queryParams]="{ aba: 'consentimentos' }">
            Ver consentimentos do cuidador
          </a>
          <a class="btn" routerLink="/app/acompanhamento/fila">Voltar à fila</a>
          <p class="t-caption">O atendimento pode registrar o consentimento.</p>
        </app-empty-state>
      } @else {
        <div class="cluster">
          <app-badge variant="info" icon="lock">Dado sensível · cifrado em repouso (simulado)</app-badge>
        </div>

        @if (stage() === 'intro') {
          <section class="card card--pad stack stack--3" aria-labelledby="intro-title" data-role="intro">
            <h2 id="intro-title" class="card__title">{{ kindText() }}</h2>
            <p>{{ introText }}</p>
            <p class="t-caption">
              Enunciados de demonstração (paráfrases). Troque pelo texto oficial licenciado antes de uso real.
            </p>
            @if (draftInfo(); as info) {
              <p class="banner banner--consent" data-role="draft-info">{{ info }}</p>
            }
            <div>
              <button type="button" class="btn btn--primary" (click)="begin()" data-role="begin">Começar</button>
            </div>
          </section>
        } @else if (stage() === 'wizard') {
          <p class="t-ui" data-role="auto-notice">Ao escolher uma resposta, avançamos para o próximo item. Você pode desligar isso abaixo.</p>
          <app-wizard
            [items]="items"
            [(answers)]="answers"
            [(index)]="index"
            [(autoAdvance)]="auto"
            draftForm="zarit"
            [draftId]="caregiver()?.id ?? 'novo'"
            finishLabel="Concluir e ver resultado"
            (completed)="toReview()"
            (exited)="saveAndLeave()"
          />
        } @else {
          <section class="card card--pad stack stack--3" aria-labelledby="review-title" data-role="review">
            <h2 id="review-title" class="card__title">Revisão das {{ total }} respostas</h2>
            <p class="t-ui">Confira as respostas. Use Alterar para corrigir qualquer item antes de concluir.</p>
            <ol class="stack stack--2">
              @for (item of items; track item.id; let i = $index) {
                <li class="cluster cluster--between">
                  <span><strong class="t-num">{{ i + 1 }}.</strong> {{ item.question }}</span>
                  <span class="cluster">
                    <app-badge variant="neutral">{{ answerText(item.id) }}</app-badge>
                    <button type="button" class="btn btn--sm" (click)="change(i)" [attr.aria-label]="'Alterar o item ' + (i + 1)">Alterar</button>
                  </span>
                </li>
              }
            </ol>
            @if (error(); as msg) {
              <p class="field__error" role="alert" data-role="apply-error">{{ msg }}</p>
            }
            <div class="cluster">
              <button type="button" class="btn" (click)="stage.set('wizard')">Voltar às perguntas</button>
              <button type="button" class="btn btn--primary" (click)="finish()" data-role="finish">Concluir e ver resultado</button>
            </div>
          </section>
        }
      }
    </div>
  `,
})
export class ZaritApplyPageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly svc = inject(ZaritService);
  private readonly consent = inject(ConsentService);
  private readonly drafts = inject(DraftService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly page = inject(PageContextService);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly items = WIZARD_ITEMS;
  protected readonly total = ZARIT_ITEM_COUNT;
  protected readonly introText =
    '22 itens, de 0 (nunca) a 4 (sempre ou quase sempre). Leva cerca de 5 minutos. O total aparece só no final.';

  protected readonly stage = signal<Stage>('intro');
  protected readonly answers = signal<WizardAnswers>({});
  protected readonly index = signal(0);
  protected readonly auto = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly lost = signal(false);

  protected readonly caregiver = computed(() => this.db.caregivers.get(this.params().get('caregiverId') ?? ''));
  protected readonly consentOk = computed(() => {
    const c = this.caregiver();
    return !!c && c.status === 'active' && this.consent.isActive(c.id, 'health_data') && !this.lost();
  });
  protected readonly subtitle = computed(() => {
    const c = this.caregiver();
    return c ? `${c.fullName}, ${formatDate(this.clock.today())}` : '';
  });
  protected readonly kindText = computed(() => {
    const c = this.caregiver();
    const sequence = c ? (this.svc.pendingOf(c.id)?.sequence ?? this.svc.completedOf(c.id).length) : 0;
    return sequence === 0 ? 'Aplicação de adesão' : `Aplicação trimestral nº ${sequence}`;
  });
  protected readonly blockedText = computed(() => {
    if (this.lost()) {
      return this.revokedText();
    }
    const c = this.caregiver();
    return c && c.status !== 'active' && !this.consent.isActive(c.id, 'health_data')
      ? 'A aplicação da escala está pausada. A escala só pode ser aplicada com o consentimento ativo.'
      : NO_CONSENT_TEXT;
  });
  protected readonly draftInfo = computed(() => {
    const c = this.caregiver();
    const draft = c ? this.drafts.load<{ index: number }>('zarit', c.id) : null;
    return draft ? `Há um rascunho de ${this.drafts.describe(draft)}, no item ${draft.data.index + 1}. Você escolhe se retoma depois de começar.` : null;
  });

  constructor() {
    this.page.setCrumbs([
      { label: 'Acompanhamento', link: '/app/acompanhamento/fila' },
      { label: 'Aplicar Zarit' },
    ]);
  }

  protected begin(): void {
    this.stage.set('wizard');
  }

  protected answerText(id: string): string {
    const value = this.answers()[id];
    return value === undefined ? 'Sem resposta' : `${value}, ${ZARIT_ANSWER_LABELS[Number(value)]?.toLowerCase() ?? ''}`;
  }

  protected toReview(): void {
    this.error.set(null);
    // O assistente apaga o rascunho ao concluir; a revisão o guarda de novo até a assinatura.
    const caregiver = this.caregiver();
    if (caregiver && this.consentOk()) {
      this.drafts.save('zarit', caregiver.id, { answers: this.answers(), index: this.index() });
    }
    this.stage.set('review');
  }

  protected change(itemIndex: number): void {
    this.index.set(itemIndex);
    this.stage.set('wizard');
  }

  private revokedText(): string {
    const caregiver = this.caregiver();
    const event = caregiver
      ? this.db.consentEvents
          .query((e) => e.caregiverId === caregiver.id && e.key === 'health_data' && e.status === 'revoked')
          .sort((a, b) => b.at.localeCompare(a.at))[0]
      : undefined;
    return `O consentimento de saúde deste cuidador foi revogado${event ? ` às ${formatTime(event.at)}` : ''}. A aplicação não pode ser salva.`;
  }

  protected async finish(): Promise<void> {
    const caregiver = this.caregiver();
    if (!caregiver) {
      return;
    }
    const ordered = this.items.map((item) => Number(this.answers()[item.id]));
    const { confirmed } = await this.dialogs.confirm({
      title: 'Concluir a aplicação da escala?',
      message: 'Ao concluir, a aplicação é assinada e não pode mais ser editada. Correções entram como adendo.',
      confirmLabel: 'Concluir a aplicação',
      cancelLabel: 'Voltar à revisão',
      irreversibleNote: 'O resultado aparece em seguida.',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.apply(caregiver.id, ordered);
    if (!result.ok) {
      const first = result.errors[0];
      if (first?.field === 'consent') {
        this.drafts.clear('zarit', caregiver.id);
        this.lost.set(true);
        return;
      }
      this.error.set(first?.message ?? 'Não foi possível salvar. Tente de novo; se continuar, avise a equipe.');
      return;
    }
    this.drafts.clear('zarit', caregiver.id);
    void this.router.navigate(['/app/acompanhamento/zarit', caregiver.id, 'resultado', result.value.assessment.id]);
  }

  protected saveAndLeave(): void {
    this.toasts.success('Rascunho salvo. Você pode retomar a aplicação depois.');
    void this.router.navigate(['/app/acompanhamento/fila']);
  }

  protected async leave(): Promise<void> {
    if (this.stage() === 'intro') {
      void this.router.navigate(['/app/acompanhamento/fila']);
      return;
    }
    const { confirmed } = await this.dialogs.confirm({
      title: 'Sair da aplicação da escala?',
      message: 'O que você respondeu até aqui fica guardado como rascunho, para retomar depois.',
      confirmLabel: 'Sair da aplicação',
      cancelLabel: 'Continuar aplicando',
    });
    if (confirmed) {
      void this.router.navigate(['/app/acompanhamento/fila']);
    }
  }
}
