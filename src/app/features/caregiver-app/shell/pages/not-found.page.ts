import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/ui/display/empty-state.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';

/** Endereço que não existe dentro do aplicativo do cuidador: mesma moldura, texto simples e volta a Hoje. */
@Component({
  selector: 'app-cg-not-found-page',
  imports: [RouterLink, CgPageHeaderComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-page-header title="Página não encontrada" />
    <app-empty-state
      title="Não encontramos esta página"
      text="O endereço pode estar errado ou a página mudou de lugar."
    >
      <a class="btn btn--primary" routerLink="/cuidador/hoje" data-role="home">Ir para Hoje</a>
    </app-empty-state>
  `,
})
export class NotFoundPageComponent {}
