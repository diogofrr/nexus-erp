import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { caregiverLabel } from '@core/privacy/caregiver-label';
import { EmptyStateComponent, PageHeaderComponent } from '@shared/ui';
import { PageContextService } from '@shared/ui/overlay';
import { ElderCareComponent } from '../components/elder-care.component';

/** SCR-M03-04 Pessoa idosa: dados, grau de dependência, medicamentos e compromissos (a gestão não abre esta tela). */
@Component({
  selector: 'app-elder-page',
  imports: [ElderCareComponent, EmptyStateComponent, PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      @if (caregiver(); as cg) {
        <app-page-header title="Pessoa idosa e cuidados" [description]="'Cuidador ' + label()">
          <a class="btn" [routerLink]="['/app/cuidadores', cg.id]">Voltar ao perfil</a>
        </app-page-header>
        <app-elder-care [caregiver]="cg" />
      } @else {
        <app-empty-state kind="error" title="Cuidador não encontrado" text="Confira o endereço ou volte à lista de cuidadores.">
          <a class="btn" routerLink="/app/cuidadores">Voltar para Cuidadores</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class ElderPage {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly page = inject(PageContextService);
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });

  protected readonly caregiver = computed(() => {
    this.db.caregivers.all();
    return this.db.caregivers.get(this.id());
  });
  protected readonly label = computed(() => {
    const cg = this.caregiver();
    return cg ? caregiverLabel(this.auth.role(), cg).text : '';
  });

  constructor() {
    effect(() => {
      const cg = this.caregiver();
      if (!cg) {
        return;
      }
      untracked(() =>
        this.page.setCrumbs([
          { label: 'Cuidadores', link: '/app/cuidadores' },
          { label: this.label(), link: `/app/cuidadores/${cg.id}` },
          { label: 'Pessoa idosa' },
        ]),
      );
    });
  }
}
