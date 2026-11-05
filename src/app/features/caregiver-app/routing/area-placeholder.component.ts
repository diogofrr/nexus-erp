import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EmptyStateComponent } from '../../../shared/ui/display/empty-state.component';
import { CgPageHeaderComponent } from '../ui/cg-page-header.component';

/**
 * Tela provisória de toda sub-rota das áreas do aplicativo do cuidador: o título (de `data.title` da rota) e "Em
 * construção". Cada dev de página SUBSTITUI o `component: CaregiverPlaceholderComponent` da própria rota pela tela
 * de verdade (`loadComponent: () => import('./pages/...')`). Deve ser removido da área quando ela ficar pronta.
 */
@Component({
  selector: 'app-cg-placeholder',
  imports: [CgPageHeaderComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-page-header [title]="title" />
    <app-empty-state title="Em construção" text="Esta tela ainda não está pronta." />
  `,
})
export class CaregiverPlaceholderComponent {
  protected readonly title: string = String(inject(ActivatedRoute).snapshot.data['title'] ?? 'Em construção');
}
