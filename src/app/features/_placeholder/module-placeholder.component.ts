import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Tela provisória dos módulos ainda não construídos ("Módulo em construção"). Sem estilo e sem lógica:
 * quem constrói o módulo troca este componente pelas páginas reais em `<slug>.routes.ts` e, quando todos
 * os módulos estiverem prontos, apaga esta pasta.
 *
 * O título e o id do módulo chegam pelo `data` da rota (`withComponentInputBinding`).
 */
@Component({
  selector: 'app-module-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <h1>{{ title() }}</h1>
      @if (moduleId()) {
        <p>{{ moduleId() }}</p>
      }
      <p>Módulo em construção</p>
    </div>
  `,
})
export class ModulePlaceholderComponent {
  readonly title = input('Módulo');
  readonly moduleId = input('');
}
