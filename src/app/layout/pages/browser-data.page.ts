import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BrowserDataService } from '../../core/privacy/browser-data.service';
import { STORAGE_KEYS, StorageService, StorageUsageItem } from '../../core/storage/storage.service';
import { DialogService } from '../../shared/ui/overlay/dialog.service';
import { GlyphComponent } from '../../shared/ui/overlay/glyph.component';
import { BannerComponent } from '../../shared/ui/overlay/banner.component';
import { HARD_NAVIGATE } from '../../shared/ui/overlay/hard-navigation';
import { UiPrefsService } from '../../shared/ui/overlay/ui-prefs.service';

/** Nomes em português do que o protótipo guarda (SCR-M12-10). O que não está aqui aparece pelo nome técnico. */
const NAMES: Readonly<Record<string, string>> = {
  session: 'Sua sessão (fecha com a aba)',
  'recent-opened': 'Telas e registros abertos recentemente (fecha com a aba)',
  clock: 'Relógio simulado',
  'ui-notice': 'Aviso da primeira visita',
  'ui-prefs': 'Preferências de tela',
  settings: 'Parâmetros do protótipo',
  'financial-params': 'Parâmetros financeiros',
  'pilot-config': 'Metas do piloto',
  'demo-state': 'Estado da demonstração',
  'schema-version': 'Versão dos dados',
  accessLog: 'Log de acessos',
  caregivers: 'Cuidadores',
  elders: 'Pessoas idosas',
  zaritAssessments: 'Aplicações da escala',
  careSessions: 'Sessões de atendimento',
  careAppointments: 'Compromissos de cuidado',
  wellbeingChecks: 'Registros de bem-estar',
  messages: 'Mensagens',
  subscriptions: 'Assinaturas',
  serviceRequests: 'Solicitações de serviço',
  providerEvaluations: 'Avaliações da rede',
  availabilitySlots: 'Vagas da agenda',
  appUsage: 'Uso do aplicativo (simulado)',
  consentEvents: 'Histórico de consentimentos',
  consents: 'Consentimentos',
  notifications: 'Notificações vistas',
};

/** Tamanho em texto: `812 B`, `34,2 KB`, `1,7 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1).replace('.', ',')} KB`;
  }
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Meus dados no navegador (SCR-M12-10, AC-M12-10): o que o protótipo guardou neste navegador, quanto ocupa e
 * o botão "Apagar todos os dados do navegador", com diálogo de efeito e confirmação digitada (nível 3). Ao
 * concluir, limpa as chaves `nexus-erp:` e leva à entrada com uma recarga completa. Disponível a todos os
 * perfis, inclusive o credenciado.
 */
@Component({
  selector: 'app-browser-data-page',
  imports: [GlyphComponent, BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Meus dados no navegador</h1>
            <p class="page-header__desc">
              Tudo o que este protótipo guarda fica só neste navegador. Nada é enviado a um
              servidor.
            </p>
          </div>
        </div>
      </header>

      <div class="stack stack--6">
        @if (storage.mode() === 'memory') {
          <app-banner
            variant="attention"
            heading="O armazenamento do navegador não está disponível"
          >
            Os dados ficam só em memória e somem ao recarregar a página.
          </app-banner>
        }

        <section class="card" aria-labelledby="nx-bd-summary">
          <div class="card__header">
            <div>
              <h2 class="card__title" id="nx-bd-summary">O que está guardado</h2>
              <p class="card__sub">{{ items().length }} itens, {{ total() }} no total</p>
            </div>
          </div>
          <div class="card__body">
            <dl class="dl">
              <dt>Dados de demonstração</dt>
              <dd class="t-num">{{ sizeOf('demo') }}</dd>
              <dt>Sessão</dt>
              <dd class="t-num">{{ sizeOf('session') }}</dd>
              <dt>Preferências e avisos</dt>
              <dd class="t-num">{{ sizeOf('prefs') }}</dd>
            </dl>
          </div>
          <div class="table-wrap table-wrap--flush">
            <table class="table" data-density="compact">
              <caption class="sr-only">
                Os 10 itens que mais ocupam espaço no navegador
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Onde fica</th>
                  <th scope="col" class="col-num">Tamanho</th>
                </tr>
              </thead>
              <tbody>
                @for (row of biggest(); track row.key) {
                  <tr>
                    <td class="col-primary">{{ row.label }}</td>
                    <td>{{ row.area === 'session' ? 'Sessão da aba' : 'Neste navegador' }}</td>
                    <td class="col-num">{{ row.size }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="nx-bd-erase">
          <h2 class="card__title" id="nx-bd-erase">Ações que apagam dados</h2>
          <p class="t-muted t-ui">
            Apagar remove os dados de demonstração, o relógio simulado, as preferências de tela e o
            aviso da primeira visita, e leva você de volta à entrada. Quando você entrar de novo, os
            dados de demonstração voltam ao original.
          </p>
          <div>
            <button type="button" class="btn btn--danger-quiet" data-role="erase" (click)="erase()">
              <svg appGlyph="trash-2"></svg>Apagar todos os dados do navegador
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class BrowserDataPageComponent {
  private readonly browserData = inject(BrowserDataService);
  protected readonly storage = inject(StorageService);
  private readonly dialogs = inject(DialogService);
  private readonly prefs = inject(UiPrefsService);
  private readonly navigate = inject(HARD_NAVIGATE);

  private readonly usage = computed(() => {
    // `notices` entra na dependência para a tela se atualizar quando o armazenamento muda.
    this.storage.notices();
    return this.browserData.usage();
  });

  protected readonly items = computed(() => this.usage().items);
  protected readonly total = computed(() => formatBytes(this.usage().totalBytes));

  protected readonly biggest = computed(() =>
    this.items()
      .slice(0, 10)
      .map((i: StorageUsageItem) => ({
        key: `${i.area}:${i.name}`,
        label: NAMES[i.name] ?? i.name,
        area: i.area,
        size: formatBytes(i.bytes),
      })),
  );

  protected sizeOf(group: 'demo' | 'session' | 'prefs'): string {
    const prefs = new Set<string>([STORAGE_KEYS.uiNotice, STORAGE_KEYS.clock, 'ui-prefs']);
    const bytes = this.items()
      .filter((i) =>
        group === 'session'
          ? i.area === 'session'
          : group === 'prefs'
            ? i.area === 'local' && prefs.has(i.name)
            : i.area === 'local' && !prefs.has(i.name),
      )
      .reduce((sum, i) => sum + i.bytes, 0);
    return formatBytes(bytes);
  }

  /** Nível 3 do guia (5.8): descreve o efeito e pede para digitar APAGAR. */
  protected async erase(): Promise<void> {
    const result = await this.dialogs.confirm({
      level: 3,
      title: 'Apagar todos os dados do navegador?',
      message: 'Isto apaga o que o protótipo guardou neste navegador e leva você à entrada.',
      effects: {
        erase: [
          'os dados de demonstração (cuidadores, prestadores, sessões e o log de acessos)',
          'o relógio simulado, as preferências de tela e o aviso da primeira visita',
          'a sua sessão',
        ],
      },
      irreversibleNote:
        'Não dá para desfazer. Os dados de demonstração voltam ao original na próxima entrada.',
      confirmLabel: 'Apagar tudo',
      typeToConfirm: 'APAGAR',
      busyLabel: 'Apagando...',
      run: () => {
        this.browserData.eraseAll();
        this.prefs.reload();
      },
    });
    if (result.confirmed) {
      this.navigate('/login');
    }
  }
}
