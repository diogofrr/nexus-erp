import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@shared/ui';
import { KitDataSection } from './kit-data.section';
import { KitDisplaySection } from './kit-display.section';
import { KitFormsSection } from './kit-forms.section';

/**
 * Página de demonstração do kit de componentes (`/app/_kit`): mostra TODOS os componentes de
 * `src/app/shared/ui` com estados e dados de exemplo (com dados, carregando, vazio, erro, sem permissão).
 * Para ver o celular, estreite a janela para 390 px: a tabela vira cartões, o quadro vira acordeão e a
 * agenda mostra a visão do dia. Nada aqui grava dado.
 */
@Component({
  selector: 'app-kit-page',
  imports: [PageHeaderComponent, KitFormsSection, KitDataSection, KitDisplaySection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--8">
      <app-page-header
        title="Kit de componentes"
        description="Biblioteca de formulários, dados e apresentação. Dados fictícios, nada é gravado."
        [breadcrumbs]="[{ label: 'Painel', link: '/app/painel' }, { label: 'Kit de componentes' }]"
      />
      <nav aria-label="Seções do kit">
        <ul class="chip-group" role="list">
          @for (section of sections; track section.id) {
            <li><a class="chip" [attr.href]="'#' + section.id">{{ section.label }}</a></li>
          }
        </ul>
      </nav>
      <div class="banner" role="note">
        <div class="banner__body">
          <span class="banner__title">Como ver o celular</span>
          <span class="banner__text">
            Estreite a janela para 390 px. A tabela vira cartões com o rótulo de cada coluna, o quadro vira acordeão,
            a agenda mostra a visão do dia e as barras de ação ficam à mão.
          </span>
        </div>
      </div>
      <app-kit-forms />
      <app-kit-data />
      <app-kit-display />
    </div>
  `,
})
export class KitPage {
  protected readonly sections = [
    { id: 'kit-forms-title', label: 'Formulários' },
    { id: 'kit-masked-title', label: 'Dado sensível' },
    { id: 'kit-consent-title', label: 'Consentimento' },
    { id: 'kit-table-title', label: 'Tabela' },
    { id: 'kit-pagination-title', label: 'Paginação' },
    { id: 'kit-badges-title', label: 'Selos' },
    { id: 'kit-kpi-title', label: 'Indicadores' },
    { id: 'kit-states-title', label: 'Estados' },
    { id: 'kit-nav-title', label: 'Abas e critérios' },
    { id: 'kit-board-title', label: 'Quadro' },
    { id: 'kit-agenda-title', label: 'Agenda' },
    { id: 'kit-wizard-title', label: 'Assistente' },
    { id: 'kit-icons-title', label: 'Ícones' },
  ];
}
