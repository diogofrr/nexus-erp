import { MODULES, canAccessModule, homePathFor } from '../../core/auth/module-map';
import { Role } from '../../core/models/access';

/** Telas de rodapé abertas a toda a equipe (privacidade, meus dados, catálogo de componentes). */
const TEAM_COMMON = ['/app/canal-do-titular', '/app/meus-dados', '/app/_kit'];

/**
 * Para onde ir depois de entrar (U-02, A-03): ao link de origem, se a pessoa o abria antes de ser levada à
 * entrada E o perfil que entrou pode abri-lo; senão, à tela inicial do perfil (`/app/painel`).
 * Nunca volta à entrada, ao 403 nem a rota inexistente.
 */
export function destinationAfterLogin(role: Role, returnUrl: string | null): string {
  const home = homePathFor(role);
  if (!returnUrl || !returnUrl.startsWith('/')) {
    return home;
  }
  const path = returnUrl.split(/[?#]/)[0] ?? '';
  if (path.startsWith('/login') || path === '/403' || path === '/') {
    return home;
  }
  if (TEAM_COMMON.some((p) => path === p || path.startsWith(`${p}/`))) {
    return returnUrl;
  }
  const module = MODULES.filter(
    (m) => m.inMenu && (path === m.path || path.startsWith(`${m.path}/`)),
  ).sort((a, b) => b.path.length - a.path.length)[0];
  return module && canAccessModule(role, module) ? returnUrl : home;
}
