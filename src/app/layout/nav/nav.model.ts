import { ModuleKey, menuFor, moduleByKey } from '../../core/auth/module-map';
import { Role } from '../../core/models/access';
import { NAV_GROUPS, NAV_ITEMS, NavGroupId, NavItemDef, navLabel } from '../../core/search/screens';

/** Um destino do menu lateral. */
export interface NavLink {
  key: ModuleKey;
  label: string;
  icon: string;
  path: string;
  group: NavGroupId;
}

/**
 * Uma linha do menu: um link solto (o Painel, ou um grupo que só tem um item visível, que vira link direto
 * com o nome do item) ou um grupo recolhível com título.
 */
export type NavEntry =
  | { kind: 'link'; link: NavLink }
  | { kind: 'group'; id: NavGroupId; title: string; icon: string; links: NavLink[] };

function linkOf(item: NavItemDef, role: Role): NavLink {
  return {
    key: item.key,
    label: navLabel(item, role),
    icon: item.icon,
    path: moduleByKey(item.key).path,
    group: item.group,
  };
}

/**
 * Monta o menu lateral do perfil. Os itens vêm de `menuFor(role)` (a matriz de permissões do núcleo): o
 * menu NUNCA mostra o que o perfil não pode abrir (AC-M01-08), então não existe item morto.
 *
 * Regras do guia de UX (3.2): grupos na ordem Painel, Pessoas, Cuidado, Rede e parceiros, Relacionamento,
 * Gestão, Segurança e normas, Sistema; grupo sem item visível não aparece; grupo com um único item visível
 * vira link direto com o nome do item.
 */
export function buildNavigation(role: Role): NavEntry[] {
  const allowed = new Set(menuFor(role).map((m) => m.key));
  const entries: NavEntry[] = [];
  NAV_GROUPS.forEach((group) => {
    const links = NAV_ITEMS.filter((i) => i.group === group.id && allowed.has(i.key)).map((i) =>
      linkOf(i, role),
    );
    if (links.length === 0) {
      return;
    }
    if (group.title === null || links.length === 1) {
      links.forEach((link) => entries.push({ kind: 'link', link }));
      return;
    }
    entries.push({ kind: 'group', id: group.id, title: group.title, icon: group.icon, links });
  });
  return entries;
}

/** Todos os links do menu, na ordem de exibição. */
export function flattenNavigation(entries: readonly NavEntry[]): NavLink[] {
  return entries.flatMap((e) => (e.kind === 'link' ? [e.link] : e.links));
}

/** Atalhos fixados do usuário ("Fixados"), só os que ele ainda pode abrir, no máximo 3. */
export function pinnedLinks(role: Role, pinned: readonly ModuleKey[]): NavLink[] {
  const all = flattenNavigation(buildNavigation(role));
  return pinned
    .map((key) => all.find((l) => l.key === key))
    .filter((l): l is NavLink => l !== undefined)
    .slice(0, 3);
}

/** Grupo (ou link solto) a que pertence a rota atual, para abrir o grupo certo ao navegar. */
export function activeGroupOf(url: string, entries: readonly NavEntry[]): NavGroupId | null {
  const path = url.split(/[?#]/)[0] ?? '';
  for (const entry of entries) {
    if (entry.kind !== 'group') {
      continue;
    }
    if (entry.links.some((l) => path === l.path || path.startsWith(`${l.path}/`))) {
      return entry.id;
    }
  }
  return null;
}
