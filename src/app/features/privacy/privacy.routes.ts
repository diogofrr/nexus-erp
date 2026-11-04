import { Routes } from '@angular/router';
import { ModulePlaceholderComponent } from '../_placeholder/module-placeholder.component';

/**
 * M12 LGPD, montado em `/app/lgpd`.
 * Telas: `consentimentos`, `termos`, `solicitacoes`, `solicitacoes/:id`, `log`, `incidentes`, `politica`, `ripd`, `retencao`. "Meus dados no navegador" (SCR-M12-10) fica no rodapé.
 */
export const ROUTES: Routes = [
  { path: '', component: ModulePlaceholderComponent, data: { title: 'LGPD', moduleId: 'M12' } },
];
