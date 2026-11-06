import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { Clock } from '../../../core/clock/clock.service';
import { DateBrPipe, NumberBrPipe } from '../../../core/format/pipes';
import { BrowserDataService } from '../../../core/privacy/browser-data.service';
import { StorageService } from '../../../core/storage/storage.service';
import { BannerComponent } from '../../../shared/ui/overlay/banner.component';
import { DialogService } from '../../../shared/ui/overlay/dialog.service';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { HARD_NAVIGATE } from '../../../shared/ui/overlay/hard-navigation';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { firstNameOf } from '../../../shared/ui/overlay/user-display';
import { DemoDataService, IMPORT_REFUSED_TEXT, ImportPreview } from '../state/demo-data.service';
import { downloadTextFile } from '../../../core/export/file-download';

/** O que o seed gera (escopo, 5.15): usado no texto do diálogo de reset. */
export const SEED_SUMMARY = '340 cuidadores, 20 prestadores e 62 sessões';

/** Lê o texto de um arquivo escolhido pela pessoa (sem enviar a lugar nenhum). */
export function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Dá ao navegador um respiro para pintar o estado "carregando" antes de um trabalho pesado e síncrono. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

/**
 * Dados de demonstração (SCR-M15-01, F15, AC-M15-01 a 03). Mostra o estado atual (data dos dados, relógio
 * simulado, tamanho ocupado) e as contagens do banco; as ações seguras vêm primeiro (baixar e importar a
 * cópia) e as que apagam ficam numa seção separada ao fim, com diálogo de efeito:
 *
 * - **Voltar aos dados de demonstração**: troca tudo pelo seed original, mantém a sessão e o relógio (U-12),
 *   oferece "Baixar uma cópia antes" (marcada) e mostra "Restaurando 340 cuidadores..." enquanto trabalha.
 * - **Apagar todos os dados**: mesmo diálogo, mais digitar APAGAR; limpa as chaves `nexus-erp:` e volta à
 *   entrada com uma recarga completa.
 * - **Importar**: valida esquema e versão e mostra uma prévia antes de substituir; arquivo inválido é recusado
 *   sem alterar nada.
 */
@Component({
  selector: 'app-settings-data-page',
  imports: [BannerComponent, IconComponent, DateBrPipe, NumberBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <header class="page-header">
        <div class="page-header__row">
          <div class="page-header__titles">
            <h1>Dados de demonstração</h1>
            <p class="page-header__desc">
              Tudo o que aparece no protótipo é fictício e fica só neste navegador. Aqui você guarda
              uma cópia, importa de volta ou recomeça do zero.
            </p>
          </div>
        </div>
      </header>

      <div class="stack stack--6">
        <section class="card" aria-labelledby="nx-data-state">
          <div class="card__header">
            <h2 class="card__title" id="nx-data-state">Estado atual</h2>
          </div>
          <div class="card__body">
            <dl class="dl">
              <dt>Dados gerados para</dt>
              <dd>{{ demo.seededFor() | dateBr }}</dd>
              @if (clock.simulatedDate(); as simulated) {
                <dt>Hoje (simulado)</dt>
                <dd>{{ simulated | dateBr }}</dd>
              }
              <dt>Ocupado no navegador</dt>
              <dd class="t-num" data-role="size">{{ size() }}</dd>
              <dt>Sessão</dt>
              <dd>{{ auth.user()?.displayName }}</dd>
            </dl>
          </div>
        </section>

        <section class="card" aria-labelledby="nx-data-counts">
          <div class="card__header">
            <h2 class="card__title" id="nx-data-counts">O que tem agora</h2>
          </div>
          <div class="card__body">
            <dl class="dl" data-role="counts">
              @for (row of demo.counts(); track row.label) {
                <dt>{{ row.label }}</dt>
                <dd class="t-num">{{ row.value | numberBr }}</dd>
              }
            </dl>
          </div>
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="nx-data-copy">
          <h2 class="card__title" id="nx-data-copy">Cópia dos dados</h2>
          <p class="t-muted t-ui" data-role="copy-scope">
            A cópia é um arquivo JSON com o que a gestão pode ver: <strong>os cadastros aparecem pelo código
            (CUI-0000), sem nome, CPF nem contato</strong>, e ela não leva escala de Zarit, notas de sessão,
            mensagens nem dados de saúde. Ao importar uma cópia, esses dados deixam de existir neste
            navegador.
          </p>
          <div class="cluster">
            <button type="button" class="btn" data-role="export" (click)="exportCopy()">
              <svg appIcon="download"></svg>Baixar cópia (JSON)
            </button>
            <button type="button" class="btn" data-role="import" (click)="file.click()">
              <svg appIcon="upload"></svg>Importar cópia
            </button>
            <input
              #file
              class="sr-only"
              type="file"
              accept="application/json,.json"
              tabindex="-1"
              aria-label="Escolher o arquivo da cópia"
              (change)="onFile($event)"
            />
          </div>

          @if (preview(); as p) {
            @if (p.ok) {
              <div class="banner banner--attention" role="status" data-role="preview">
                <svg appIcon="triangle-alert"></svg>
                <div class="banner__body">
                  <p class="banner__title">Cópia de {{ p.exportedAt }} pronta para importar</p>
                  <p class="banner__text">
                    Tem {{ summaryOf(p) }}.
                    @if (p.clockDate) {
                      O relógio simulado vai para {{ p.clockDate }}.
                    }
                    Os dados atuais serão substituídos.
                    @if (p.management) {
                      Esta é uma cópia da visão da gestão: tem códigos no lugar de nomes e não tem escala de Zarit,
                      notas, mensagens nem dados de saúde.
                    }
                  </p>
                  <div class="banner__actions">
                    <button
                      type="button"
                      class="btn btn--sm btn--primary"
                      data-role="confirm-import"
                      (click)="confirmImport(p)"
                    >
                      Importar esta cópia
                    </button>
                    <button
                      type="button"
                      class="btn btn--sm btn--ghost"
                      (click)="preview.set(null)"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            } @else {
              <app-banner variant="danger" heading="Não foi possível importar" liveRole="alert">
                <span data-role="refused">{{ refusedText }}</span>
                <ul class="t-ui">
                  @for (reason of p.reasons.slice(0, 3); track $index) {
                    <li>{{ reason }}</li>
                  }
                </ul>
              </app-banner>
            }
          }
        </section>

        <section class="card card--pad stack stack--3" aria-labelledby="nx-data-danger">
          <h2 class="card__title" id="nx-data-danger">Ações que apagam dados</h2>
          <p class="t-muted t-ui">
            Antes de apagar, baixe uma cópia. Estas ações pedem confirmação.
          </p>
          <div class="cluster">
            <button type="button" class="btn btn--danger-quiet" data-role="reset" (click)="reset()">
              <svg appIcon="refresh-cw"></svg>Voltar aos dados de demonstração
            </button>
            <button type="button" class="btn btn--danger-quiet" data-role="erase" (click)="erase()">
              <svg appIcon="trash-2"></svg>Apagar todos os dados
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class DataPageComponent {
  protected readonly demo = inject(DemoDataService);
  protected readonly auth = inject(AuthService);
  protected readonly clock = inject(Clock);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly storage = inject(StorageService);
  private readonly browserData = inject(BrowserDataService);
  private readonly doc = inject(DOCUMENT);
  private readonly navigate = inject(HARD_NAVIGATE);

  protected readonly refusedText = IMPORT_REFUSED_TEXT;
  protected readonly preview = signal<ImportPreview | null>(null);

  /** Tamanho ocupado no navegador; relê quando as contagens mudam (reset, importação). */
  protected readonly size = computed(() => {
    this.demo.counts();
    const bytes = this.storage.usage().totalBytes;
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`
      : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  });

  protected summaryOf(preview: Extract<ImportPreview, { ok: true }>): string {
    return this.demo.summary(preview.counts);
  }

  protected exportCopy(): void {
    const copy = this.demo.buildCopy();
    if (downloadTextFile(this.doc, copy.fileName, copy.text)) {
      this.toasts.success(`Cópia baixada: ${copy.fileName}.`);
    } else {
      this.toasts.error('Não foi possível baixar a cópia neste navegador.');
    }
  }

  /** Escolheu um arquivo: valida e mostra a prévia; arquivo errado é recusado sem alterar nada (AC-M15-03). */
  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.preview.set(this.demo.preview(await readFileText(file)));
  }

  protected async confirmImport(preview: Extract<ImportPreview, { ok: true }>): Promise<void> {
    const result = await this.dialogs.confirm({
      title: 'Importar a cópia?',
      message: `A cópia de ${preview.exportedAt} tem ${this.demo.summary(preview.counts)}.`,
      effects: {
        erase: [
          'os dados atuais deste navegador, trocados pelos da cópia',
          ...(preview.management
            ? ['nomes, escala de Zarit, notas, mensagens e dados de saúde, que a cópia da gestão não leva']
            : []),
        ],
      },
      irreversibleNote:
        'Não dá para desfazer. Baixe uma cópia dos dados atuais antes, se quiser guardá-los.',
      confirmLabel: 'Importar cópia',
      busyLabel: 'Importando...',
      run: async () => {
        await nextPaint();
        const outcome = this.demo.importCopy(preview.text);
        if (!outcome.ok) {
          throw new Error(outcome.errors.join(' '));
        }
      },
    });
    if (result.confirmed) {
      this.preview.set(null);
      this.toasts.success('Cópia importada. Os dados foram substituídos.');
    }
  }

  /** Nível 2 do guia (F15): efeito descrito, "Baixar uma cópia antes" marcada e foco em Cancelar. */
  protected async reset(): Promise<void> {
    const name = firstNameOf(this.auth.user()?.displayName ?? '');
    const simulated = this.clock.simulatedDate();
    const parts = [
      `Tudo o que você criou ou mudou neste navegador será trocado pelos dados de demonstração originais (${SEED_SUMMARY}).`,
      `Sua sessão continua como ${name}.`,
      simulated ? `O relógio simulado (${simulated.split('-').reverse().join('/')}) continua.` : '',
    ].filter((p) => p.length > 0);
    const result = await this.dialogs.confirm({
      title: 'Voltar aos dados de demonstração?',
      message: parts.join(' '),
      irreversibleNote: 'Não dá para desfazer. O log de acessos também será recriado.',
      checkbox: { label: 'Baixar uma cópia antes', checked: true },
      confirmLabel: 'Voltar aos dados de demonstração',
      busyLabel: 'Restaurando 340 cuidadores...',
      run: async (outcome) => {
        if (outcome.checkbox) {
          const copy = this.demo.buildCopy();
          downloadTextFile(this.doc, copy.fileName, copy.text);
        }
        await nextPaint();
        this.demo.reset();
      },
    });
    if (result.confirmed) {
      this.toasts.success('Dados de demonstração restaurados.');
    }
  }

  /** Nível 3: mesmo diálogo, mais digitar APAGAR. Limpa as chaves `nexus-erp:` e volta à entrada. */
  protected async erase(): Promise<void> {
    const result = await this.dialogs.confirm({
      level: 3,
      title: 'Apagar todos os dados?',
      message: 'Isto apaga tudo o que o protótipo guardou neste navegador e leva você à entrada.',
      effects: {
        erase: [
          'os dados de demonstração e o log de acessos',
          'o relógio simulado, as preferências de tela e o aviso da primeira visita',
          'a sua sessão',
        ],
      },
      irreversibleNote:
        'Não dá para desfazer. Os dados de demonstração voltam ao original na próxima entrada.',
      confirmLabel: 'Apagar tudo',
      typeToConfirm: 'APAGAR',
      busyLabel: 'Apagando...',
      run: () => this.browserData.eraseAll(),
    });
    if (result.confirmed) {
      this.navigate('/login');
    }
  }
}
