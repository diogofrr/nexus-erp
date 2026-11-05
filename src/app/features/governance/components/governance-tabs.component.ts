import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth';
import { LinkTab, LinkTabsComponent } from '@shared/ui/display/link-tabs.component';

/**
 * Atalho entre as telas da Governança (M13). Ocorrências só aparecem para quem a matriz libera (RT, psicólogo do
 * caso e, só contagem, a gestão); o atendimento não vê a aba nem sabe que ela existe (escopo 1.3).
 */
@Component({
  selector: 'app-governance-tabs',
  imports: [LinkTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-link-tabs label="Telas da governança" [items]="tabs()" />`,
})
export class GovernanceTabsComponent {
  private readonly auth = inject(AuthService);

  protected readonly tabs = computed<LinkTab[]>(() => {
    const base = '/app/governanca';
    const items: LinkTab[] = [
      { label: 'Visão geral', link: base, exact: true },
      { label: 'POPs', link: `${base}/pops` },
      { label: 'Riscos', link: `${base}/riscos` },
      { label: 'Encaminhamentos', link: `${base}/encaminhamentos` },
    ];
    if (this.auth.can('occurrences', 'view') || this.auth.can('occurrences', 'view_aggregate')) {
      items.push({ label: 'Ocorrências', link: `${base}/ocorrencias` });
    }
    items.push(
      { label: 'Formação', link: `${base}/formacao` },
      { label: 'Conteúdos', link: `${base}/conteudos` },
      { label: 'Normas', link: `${base}/normas` },
    );
    return items;
  });
}
