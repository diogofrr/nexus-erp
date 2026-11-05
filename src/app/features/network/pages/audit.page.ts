import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock, daysBetween } from '@core/clock';
import { formatDate, formatNumber } from '@core/format';
import { ArpBand } from '@core/models';
import { nextAuditDate } from '@core/rules';
import { CellDirective, DataTableComponent, PageHeaderComponent, TableColumn } from '@shared/ui';
import { BannerComponent, DialogService, ToastService } from '@shared/ui/overlay';
import { ArpBandComponent } from '../components/badges.component';
import { AuditResult, AuditRow, NetworkAdminService } from '../state/network-admin.service';
import { BAND_VIEW, pluralize } from '../state/network-labels';
import { DOCUMENT_EXPIRING_DAYS, NetworkService } from '@core/network';

interface PreviewRow {
  id: string;
  name: string;
  averageText: string;
  count: number;
  band: ArpBand;
  hasBand: boolean;
  changeText: string;
  graves: number;
  actionText: string;
  suspends: boolean;
}

interface Pending {
  id: string;
  name: string;
  detail: string;
  link: string[];
}

const ACTION_TEXT: Readonly<Record<AuditRow['action'], string>> = {
  suspend: 'Suspende agora e abre avaliação interna',
  suspend_document: 'Suspende agora (documento vencido há mais de 30 dias)',
  to_monitoring: 'Passa a monitoramento',
  to_active: 'Volta a ativo, em destaque',
  none: 'Sem mudança de estado',
};

/**
 * Auditoria quinzenal (SCR-M08-07, F08 parte B, A-34): "Ver prévia" mostra, sem gravar, a classificação que
 * sairia de cada prestador e quem seria suspenso na hora. "Rodar auditoria" grava um instantâneo por prestador
 * (que não é recalculado depois) e aplica as mudanças de estado; rodar de novo no mesmo dia pergunta se deve
 * substituir. As quatro listas de ação (descredenciamento, monitoramento, documentos, recusa alta) levam à ficha.
 */
@Component({
  selector: 'app-network-audit-page',
  imports: [RouterLink, ArpBandComponent, BannerComponent, CellDirective, DataTableComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Auditoria quinzenal"
        [description]="statusText()"
      >
        @if (manager()) {
          <button type="button" class="btn" data-role="show-preview" [attr.aria-expanded]="showPreview()" (click)="showPreview.set(!showPreview())">
            {{ showPreview() ? 'Esconder a prévia' : 'Ver prévia' }}
          </button>
          <button type="button" class="btn btn--primary" data-role="run-audit" (click)="run()">Rodar auditoria</button>
        }
      </app-page-header>

      <div class="stack stack--6">
        @if (due()) {
          <app-banner variant="attention" heading="Auditoria quinzenal pendente">
            A última auditoria foi há {{ daysSince() }} dias. Veja a prévia e rode a auditoria para classificar a rede.
          </app-banner>
        }
        @if (lastResult(); as result) {
          <app-banner variant="success" heading="Auditoria gravada" data-role="audit-result">
            Instantâneo de hoje ({{ format(result.auditDate) }}) gravado para {{ pluralize(result.snapshots, 'prestador', 'prestadores') }}.
            @if (result.suspended.length > 0) {
              Saíram da busca e foram para avaliação interna: {{ result.suspended.join(', ') }}.
            } @else {
              Nenhum prestador foi suspenso.
            }
          </app-banner>
        }

        @if (showPreview() || !manager()) {
          <section class="stack stack--3" aria-labelledby="nx-preview-title" data-role="preview">
            <h2 class="card__title" id="nx-preview-title">Prévia da auditoria</h2>
            <p class="t-caption">A prévia mostra o que sairia agora. Nada é gravado até você rodar a auditoria.</p>
            @if (preview().willSuspend.length > 0) {
              <app-banner variant="danger" heading="O que muda se você rodar agora" data-role="will-suspend">
                @for (row of preview().willSuspend; track row.summary.provider.id) {
                  <span class="block">{{ row.summary.provider.name }}: {{ row.reason }}. Sai da busca na hora.</span>
                }
              </app-banner>
            } @else {
              <app-banner variant="success" heading="O que muda se você rodar agora">
                Nenhum prestador entra em descredenciamento. Ninguém sai da busca.
              </app-banner>
            }
            <app-data-table
              caption="Classificação que sairia na auditoria"
              noun="prestadores"
              [rows]="previewRows()"
              [columns]="columns"
              searchable
              searchLabel="Buscar prestador na prévia"
              [stack]="false"
              emptyTitle="Nenhum prestador em atividade"
              emptyText="Quando houver prestadores ativos, em monitoramento ou suspensos, eles aparecem na prévia."
            >
              <ng-template appCell="name" let-row>
                <a class="row-link" [routerLink]="['/app/rede/prestadores', row.id]">{{ row.name }}</a>
              </ng-template>
              <ng-template appCell="band" let-row>
                @if (row.hasBand) {
                  <app-arp-band [band]="row.band" />
                } @else {
                  <span class="t-muted">Sem média (menos de 5 avaliações)</span>
                }
              </ng-template>
            </app-data-table>
          </section>
        }

        <section class="stack stack--3" aria-labelledby="nx-actions-title">
          <h2 class="card__title" id="nx-actions-title">O que pede ação</h2>
          <div class="grid grid--2 grid--gap-6">
            @for (group of groups(); track group.id) {
              <section class="card card--pad stack stack--3" [attr.aria-labelledby]="'nx-group-' + group.id" [attr.data-group]="group.id">
                <h3 class="card__title" [id]="'nx-group-' + group.id">{{ group.title }} ({{ group.items.length }})</h3>
                @if (group.items.length === 0) {
                  <p class="t-caption">{{ group.empty }}</p>
                } @else {
                  <ul class="stack stack--2">
                    @for (item of group.items; track item.id) {
                      <li>
                        <a [routerLink]="item.link">{{ item.name }}</a>
                        <span class="t-caption block">{{ item.detail }}</span>
                      </li>
                    }
                  </ul>
                }
              </section>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AuditPage {
  private readonly clock = inject(Clock);
  private readonly admin = inject(NetworkAdminService);
  private readonly network = inject(NetworkService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly pluralize = pluralize;
  protected readonly manager = computed(() => this.admin.isManager());
  protected readonly showPreview = signal(false);
  protected readonly lastResult = signal<AuditResult | null>(null);

  protected readonly preview = computed(() => this.admin.previewAudit());

  protected readonly due = computed(() => {
    const last = this.preview().lastAuditDate;
    return last === undefined || daysBetween(last, this.clock.today()) >= 15;
  });
  protected readonly daysSince = computed(() => {
    const last = this.preview().lastAuditDate;
    return last ? daysBetween(last, this.clock.today()) : 0;
  });
  protected readonly statusText = computed(() => {
    const last = this.preview().lastAuditDate;
    if (!last) {
      return 'Ainda não houve auditoria. Rode a primeira para classificar a rede.';
    }
    const days = daysBetween(last, this.clock.today());
    return `Última auditoria: ${formatDate(last)} (há ${days} ${days === 1 ? 'dia' : 'dias'}). Próxima: ${formatDate(nextAuditDate(last))}.`;
  });

  protected readonly columns: TableColumn<PreviewRow>[] = [
    { key: 'name', header: 'Prestador', primary: true, sortable: true, value: (r) => r.name },
    { key: 'averageText', header: 'Média', align: 'end', noSearch: true },
    { key: 'count', header: 'Avaliações', align: 'end', noSearch: true },
    { key: 'band', header: 'Faixa de hoje', noSearch: true },
    { key: 'changeText', header: 'Mudança desde a última', muted: true },
    { key: 'graves', header: 'Graves', align: 'end', noSearch: true },
    { key: 'actionText', header: 'O que a auditoria faz' },
  ];

  protected readonly previewRows = computed<PreviewRow[]>(() =>
    this.preview().rows.map((row) => {
      const s = row.summary;
      const changed = row.previousBand !== null && row.previousBand !== row.nextBand;
      return {
        id: s.provider.id,
        name: s.provider.name,
        averageText: s.average === null ? 'Sem média' : formatNumber(s.average, 2),
        count: s.evaluationCount,
        band: s.band,
        hasBand: s.evaluationCount > 0 || s.band === 'deaccreditation',
        changeText: changed
          ? `${BAND_VIEW[row.previousBand as ArpBand].label} para ${BAND_VIEW[row.nextBand].label}`
          : row.previousBand === null
            ? 'Primeira classificação'
            : 'Sem mudança de faixa',
        graves: s.graveCount,
        actionText: ACTION_TEXT[row.action],
        suspends: row.action === 'suspend' || row.action === 'suspend_document',
      };
    }),
  );

  protected readonly groups = computed(() => {
    const summaries = this.network.summaries();
    const last = this.preview().lastAuditDate;
    const link = (id: string): string[] => ['/app/rede/prestadores', id];
    const suspended: Pending[] = summaries
      .filter((s) => s.provider.status === 'suspended')
      .map((s) => ({
        id: s.provider.id,
        name: s.provider.name,
        detail: s.openReview ? 'Avaliação interna aberta, aguardando decisão.' : 'Suspenso, sem avaliação interna aberta.',
        link: s.openReview ? ['/app/rede/avaliacao-interna', s.openReview.id] : link(s.provider.id),
      }));
    const monitoring: Pending[] = summaries
      .filter((s) => s.provider.status === 'monitoring' && !this.admin.wasContactedSinceAudit(s.provider.id, last))
      .map((s) => ({
        id: s.provider.id,
        name: s.provider.name,
        detail: 'Contate o prestador para entender a queda e combinar ajustes.',
        link: link(s.provider.id),
      }));
    const documents: Pending[] = summaries
      .filter((s) => s.provider.status === 'active' || s.provider.status === 'monitoring')
      .flatMap((s) => {
        const issues = this.admin.documentsOf(s.provider.id).flatMap((d) => {
          if (!d.validUntil) {
            return [];
          }
          const left = daysBetween(this.clock.today(), d.validUntil);
          return left <= DOCUMENT_EXPIRING_DAYS
            ? [left < 0 ? `Vencido há ${Math.abs(left)} dias` : `Vence em ${left} dias`]
            : [];
        });
        return issues.length > 0
          ? [{ id: s.provider.id, name: s.provider.name, detail: issues.join('; '), link: link(s.provider.id) }]
          : [];
      });
    const refusal: Pending[] = summaries
      .filter((s) => (s.provider.status === 'active' || s.provider.status === 'monitoring') && s.refusal.exitRisk)
      .map((s) => ({
        id: s.provider.id,
        name: s.provider.name,
        detail: `Recusa em 30 dias: ${formatNumber(s.refusal.percent ?? 0, 1)}% (${s.refusal.refusedOrCancelledByProvider} de ${s.refusal.received}).`,
        link: link(s.provider.id),
      }));
    return [
      { id: 'suspended', title: 'Entraram em descredenciamento', items: suspended, empty: 'Nenhum prestador suspenso agora.' },
      { id: 'monitoring', title: 'Monitoramento a contatar', items: monitoring, empty: 'Todos os prestadores em monitoramento já foram contatados.' },
      { id: 'documents', title: 'Documentos vencendo', items: documents, empty: 'Nenhum documento vence nos próximos 30 dias.' },
      { id: 'refusal', title: 'Recusa alta', items: refusal, empty: 'Nenhum prestador com recusa alta.' },
    ];
  });

  protected format(date: string): string {
    return formatDate(date);
  }

  protected async run(): Promise<void> {
    const preview = this.admin.previewAudit();
    const n = preview.willSuspend.length;
    const total = preview.rows.length;
    const names = preview.willSuspend.map((r) => r.summary.provider.name).join(', ');
    const { confirmed } = await this.dialogs.confirm({
      title: preview.alreadyRanToday ? 'Já existe uma auditoria de hoje. Substituir?' : 'Rodar a auditoria quinzenal?',
      message: `Vai gravar um instantâneo de todos os ${total} prestadores em atividade.${preview.alreadyRanToday ? ' O instantâneo de hoje será trocado pelo novo.' : ''}`,
      effects: {
        ...(n > 0
          ? { block: [`${pluralize(n, 'prestador sai', 'prestadores saem')} da busca agora e ${n === 1 ? 'vai' : 'vão'} para avaliação interna: ${names}`] }
          : {}),
        keep: ['o instantâneo gravado, que não é recalculado depois'],
      },
      irreversibleNote: 'Não dá para desfazer a suspensão por esta tela.',
      confirmLabel: n > 0 ? `Rodar auditoria e suspender ${pluralize(n, 'prestador', 'prestadores')}` : 'Rodar auditoria',
      busyLabel: 'Gravando a auditoria...',
      run: () => {
        const result = this.admin.runAudit();
        if (!result.ok) {
          throw new Error(result.error);
        }
        this.lastResult.set(result.value);
      },
    });
    if (confirmed) {
      const result = this.lastResult();
      this.showPreview.set(false);
      this.toasts.success(
        result && result.suspended.length > 0
          ? `Auditoria gravada. ${pluralize(result.suspended.length, 'prestador saiu', 'prestadores saíram')} da busca.`
          : 'Auditoria gravada. Ninguém saiu da busca.',
      );
    }
  }
}
