import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Database } from '../data/database';
import { formatDate } from '../format/format';
import { Role } from '../models/access';
import { Caregiver, CaregiverStatus } from '../models/caregivers';
import { ActivityKind } from '../models/groups';
import { ProviderStatus } from '../models/network';
import { maskPhone } from '../privacy/masks';
import { StorageService } from '../storage/storage.service';
import { RECENTS_KEY } from './recents';
import { ActionDef, ScreenDef, actionsFor, screensFor } from './screens';

export type SearchGroupKey =
  | 'actions'
  | 'screens'
  | 'caregivers'
  | 'providers'
  | 'partners'
  | 'activities'
  | 'recent';

export interface SearchResult {
  /** Estável entre buscas (`screen:/app/painel`, `caregiver:cg_0001`). */
  id: string;
  group: SearchGroupKey;
  title: string;
  subtitle?: string;
  /** Código pseudonimizado (`CUI-0042`), mostrado no `code-chip`. */
  code?: string;
  /** Ícone do sprite. */
  icon: string;
  link: string;
  queryParams?: Record<string, string>;
}

export interface SearchGroup {
  key: SearchGroupKey;
  label: string;
  /** Até `MAX_PER_GROUP` resultados. */
  results: SearchResult[];
  /** Quantos casaram no total (a contagem do grupo). */
  total: number;
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
  total: number;
  /** Mensagem para a busca sem resultado (ou para a gestão, que busca só por código). */
  message: string | null;
}

export const SEARCH_MIN_CHARS = 2;
export const MAX_PER_GROUP = 6;
const MAX_RECENTS = 5;

const GROUP_LABELS: Record<SearchGroupKey, string> = {
  actions: 'Ações',
  screens: 'Ir para',
  caregivers: 'Cuidadores',
  providers: 'Prestadores',
  partners: 'Parceiros e empresas',
  activities: 'Atividades',
  recent: 'Recentes',
};

const CAREGIVER_STATUS: Record<CaregiverStatus, string> = {
  active: 'Ativo',
  paused_by_consent_revocation: 'Consentimento pausado',
  closure_requested: 'Encerramento solicitado',
  closed: 'Encerrado',
};

const PROVIDER_STATUS: Record<ProviderStatus, string> = {
  candidate: 'Candidato',
  active: 'Ativo',
  monitoring: 'Em monitoramento',
  suspended: 'Suspenso',
  deaccredited: 'Descredenciado',
  rejected: 'Reprovado',
};

const ACTIVITY_KIND: Record<ActivityKind, string> = {
  support_group: 'Grupo de apoio',
  training: 'Capacitação',
  group_therapy: 'Terapia de grupo',
  open_conversation_circle: 'Roda aberta',
};

/** Mensagem da gestão: ela busca cuidador só por código (regra A-09, LP-08). */
export const PARTNER_SEARCH_HINT = 'A gestão busca por código, por exemplo CUI-0001.';

export const EMPTY_SEARCH_MESSAGE =
  'Nada encontrado para o que você digitou. Tente o código (CUI-0001), parte do nome ou o nome de uma tela.';

/** Minúsculas e sem acentos: "Cecília" casa com "cecilia". */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Todas as palavras da busca aparecem no texto (sem acento e sem diferenciar maiúscula). */
export function matchesQuery(haystack: string, query: string): boolean {
  const text = normalizeText(haystack);
  return normalizeText(query)
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .every((token) => text.includes(token));
}

/** A busca parece um código de cuidador (`CUI-0042`, `cui`, `0042`)? */
export function looksLikeCaregiverCode(query: string): boolean {
  const compact = normalizeText(query).replace(/\s+/g, '');
  return /^cui-?\d{0,4}$/.test(compact) || /^\d{2,4}$/.test(compact);
}

/**
 * Casa um código de cuidador com o que foi digitado: "CUI-00" e "cui0042" casam pelo começo do código;
 * só dígitos ("042") casam em qualquer parte do número.
 */
export function codeMatcher(query: string): (code: string) => boolean {
  const compact = normalizeText(query).replace(/\s+/g, '');
  if (/^\d+$/.test(compact)) {
    return (code) => normalizeText(code).replace('cui-', '').includes(compact);
  }
  const prefix =
    compact.startsWith('cui-') || compact === 'cui'
      ? compact
      : `cui-${compact.replace(/^cui/, '')}`;
  return (code) => normalizeText(code).startsWith(prefix);
}

interface RecentStore {
  userId: string;
  items: SearchResult[];
}

/**
 * Busca global e paleta de comandos (SCR-M02-02, UX 3.5). Uma só caixa, duas faces: achar coisas e ir a
 * lugares. Tudo respeita a matriz de permissões e a privacidade:
 *
 * | Perfil | Cuidadores | Mostra |
 * |---|---|---|
 * | `partner` | só pelo código (`CUI-0042`), nunca por nome | código, plano e status |
 * | `technical_lead` | todos | nome, código e psicólogo |
 * | `psychologist` | só os seus | nome, código e data da última aplicação |
 * | `support` | todos | nome, código, plano e contato MASCARADO |
 *  *
 * - O texto digitado NUNCA é guardado nem vai a URL, título da aba ou log (LP-21). O log registra o `view`
 *   do registro aberto, na tela que abrir.
 * - "Recentes" guarda as últimas 5 telas e registros abertos, só na sessão do navegador e por usuário.
 * - A paleta nunca executa ação destrutiva: ela abre a tela ou o formulário (AC-GL-09).
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);

  /** Ações da paleta para o perfil atual (a primeira face da caixa, sem digitar nada). */
  readonly actions = computed<SearchResult[]>(() => {
    const role = this.auth.role();
    return role ? actionsFor(role).map((a) => this.actionResult(a)) : [];
  });

  /** O que mostrar antes de digitar: ações do perfil e recentes. */
  suggestions(): SearchGroup[] {
    const groups: SearchGroup[] = [];
    const actions = this.actions();
    if (actions.length > 0) {
      groups.push(this.group('actions', actions));
    }
    const recents = this.recents();
    if (recents.length > 0) {
      groups.push(this.group('recent', recents));
    }
    return groups;
  }

  /** Busca por texto. Menos de 2 caracteres (e fora do formato de código) devolve só as sugestões. */
  search(rawQuery: string): SearchResponse {
    const query = rawQuery.trim();
    const role = this.auth.role();
    if (!role || !this.auth.isAuthenticated()) {
      return { query, groups: [], total: 0, message: null };
    }
    if (query.length < SEARCH_MIN_CHARS && !looksLikeCaregiverCode(query)) {
      return { query, groups: this.suggestions(), total: 0, message: null };
    }
    const groups: SearchGroup[] = [];
    const push = (key: SearchGroupKey, results: SearchResult[]): void => {
      if (results.length > 0) {
        groups.push(this.group(key, results));
      }
    };

    push(
      'actions',
      this.actions().filter((r) => matchesQuery(`${r.title} ${r.subtitle ?? ''}`, query)),
    );
    push('screens', this.screenResults(role, query));
    push('caregivers', this.caregiverResults(role, query));
    if (role === 'partner' || role === 'technical_lead' || role === 'support') {
      push('providers', this.providerResults(query));
    }
    if (role === 'partner' || role === 'support') {
      push('partners', this.partnerResults(query));
    }
    push('activities', this.activityResults(query));

    const total = groups.reduce((sum, g) => sum + g.total, 0);
    // A gestão que digita um nome recebe sempre a dica do código (A-09), mesmo que outras coisas casem.
    const message =
      role === 'partner' && !looksLikeCaregiverCode(query)
        ? PARTNER_SEARCH_HINT
        : total > 0
          ? null
          : EMPTY_SEARCH_MESSAGE;
    return { query, groups, total, message };
  }

  // ===== Recentes (só na sessão do navegador, por usuário) =====

  /** Últimas telas e registros abertos nesta sessão. Some ao sair e nunca guarda texto buscado. */
  recents(): SearchResult[] {
    const userId = this.auth.user()?.id;
    const stored = this.storage.readSession<RecentStore | null>(RECENTS_KEY, null);
    if (!userId || !stored || stored.userId !== userId) {
      return [];
    }
    return stored.items.map((item) => ({ ...item, group: 'recent' as const }));
  }

  /** Guarda um resultado aberto (nunca o texto digitado). */
  recordOpened(result: SearchResult): void {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return;
    }
    const current = this.recents().filter((r) => r.id !== result.id);
    const item: SearchResult = {
      id: result.id,
      group: result.group,
      title: result.title,
      icon: result.icon,
      link: result.link,
      ...(result.subtitle ? { subtitle: result.subtitle } : {}),
      ...(result.code ? { code: result.code } : {}),
      ...(result.queryParams ? { queryParams: result.queryParams } : {}),
    };
    const items = [item, ...current].slice(0, MAX_RECENTS);
    this.storage.writeSession(RECENTS_KEY, { userId, items } satisfies RecentStore);
  }

  /** Registra a visita a uma tela do catálogo (navegação comum), para a lista de recentes. */
  recordVisit(path: string): void {
    const role = this.auth.role();
    if (!role) {
      return;
    }
    const screen = screensFor(role).find((s) => s.link === path);
    if (screen) {
      this.recordOpened(this.screenResult(screen));
    }
  }

  clearRecents(): void {
    this.storage.removeSession(RECENTS_KEY);
  }

  // ===== Resultados por tipo =====

  private group(key: SearchGroupKey, all: SearchResult[]): SearchGroup {
    return {
      key,
      label: GROUP_LABELS[key],
      results: all.slice(0, MAX_PER_GROUP),
      total: all.length,
    };
  }

  private actionResult(action: ActionDef): SearchResult {
    return {
      id: action.id,
      group: 'actions',
      title: action.label,
      icon: action.icon,
      link: action.link,
      ...(action.queryParams ? { queryParams: action.queryParams } : {}),
    };
  }

  private screenResult(screen: ScreenDef): SearchResult {
    return {
      id: screen.id,
      group: 'screens',
      title: screen.label,
      icon: screen.icon,
      link: screen.link,
      ...(screen.parent ? { subtitle: screen.parent } : {}),
    };
  }

  private screenResults(role: Role, query: string): SearchResult[] {
    return screensFor(role)
      .filter((s) =>
        matchesQuery(`${s.label} ${s.parent ?? ''} ${(s.keywords ?? []).join(' ')}`, query),
      )
      .map((s) => this.screenResult(s));
  }

  private caregiverResults(role: Role, query: string): SearchResult[] {
    const all = this.db.caregivers.list();
    let matches: readonly Caregiver[];
    if (role === 'partner') {
      // A gestão busca só por código; nunca casa por nome (A-09).
      if (!looksLikeCaregiverCode(query)) {
        return [];
      }
      const isCode = codeMatcher(query);
      matches = all.filter((c) => isCode(c.code));
    } else if (role === 'psychologist') {
      const mine = this.auth.actor()?.psychologistId;
      matches = all.filter(
        (c) =>
          mine !== undefined &&
          c.assignedPsychologistId === mine &&
          matchesQuery(`${c.fullName} ${c.code}`, query),
      );
    } else {
      matches = all.filter((c) => matchesQuery(`${c.fullName} ${c.code}`, query));
    }
    if (matches.length === 0) {
      return [];
    }
    const planOf = this.planByCaregiver();
    const lastApplied =
      role === 'psychologist' ? this.lastAppliedByCaregiver() : new Map<string, string>();
    const psychologists = new Map(
      this.db.psychologists.list().map((p) => [p.id, p.displayName] as const),
    );
    return [...matches]
      .sort((a, b) =>
        role === 'partner'
          ? a.code.localeCompare(b.code)
          : a.fullName.localeCompare(b.fullName, 'pt-BR'),
      )
      .map((c): SearchResult => {
        const link = `/app/cuidadores/${c.id}`;
        switch (role) {
          case 'partner':
            return {
              id: `caregiver:${c.id}`,
              group: 'caregivers',
              title: c.code,
              subtitle: `${planOf.get(c.id) ?? 'Livre'} · ${CAREGIVER_STATUS[c.status]}`,
              code: c.code,
              icon: 'shield-check',
              link,
            };
          case 'technical_lead':
            return {
              id: `caregiver:${c.id}`,
              group: 'caregivers',
              title: c.fullName,
              subtitle: `${c.code} · ${psychologists.get(c.assignedPsychologistId ?? '') ?? 'sem psicólogo'}`,
              code: c.code,
              icon: 'user',
              link,
            };
          case 'psychologist': {
            const applied = lastApplied.get(c.id);
            return {
              id: `caregiver:${c.id}`,
              group: 'caregivers',
              title: c.fullName,
              subtitle: `${c.code} · ${applied ? `última aplicação em ${formatDate(applied)}` : 'sem aplicação ainda'}`,
              code: c.code,
              icon: 'user',
              link,
            };
          }
          default:
            return {
              id: `caregiver:${c.id}`,
              group: 'caregivers',
              title: c.fullName,
              subtitle: `${c.code} · ${planOf.get(c.id) ?? 'Livre'} · ${maskPhone(c.phone)}`,
              code: c.code,
              icon: 'user',
              link,
            };
        }
      });
  }

  private providerResults(query: string): SearchResult[] {
    return this.db.providers
      .query((p) => matchesQuery(`${p.name} ${p.specialtyLabel}`, query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((p) => ({
        id: `provider:${p.id}`,
        group: 'providers' as const,
        title: p.name,
        subtitle: `${p.specialtyLabel} · ${PROVIDER_STATUS[p.status]}`,
        icon: 'stethoscope',
        link: `/app/rede/prestadores/${p.id}`,
      }));
  }

  private partnerResults(query: string): SearchResult[] {
    const partners = this.db.partners
      .query((p) => matchesQuery(`${p.name} ${p.city}`, query))
      .map((p) => ({
        id: `partner:${p.id}`,
        group: 'partners' as const,
        title: p.name,
        subtitle: `Parceiro do Cartão · ${p.city}`,
        icon: 'store',
        link: `/app/parceiros/${p.id}`,
      }));
    const companies = this.db.corporateAccounts
      .query((c) => matchesQuery(c.companyName, query))
      .map((c) => ({
        id: `company:${c.id}`,
        group: 'partners' as const,
        title: c.companyName,
        subtitle: 'Empresa do canal corporativo',
        icon: 'building-2',
        link: `/app/empresas/${c.id}`,
      }));
    return [...partners, ...companies].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }

  private activityResults(query: string): SearchResult[] {
    return this.db.activities
      .query((a) => matchesQuery(`${a.title} ${ACTIVITY_KIND[a.kind]}`, query))
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
      .map((a) => ({
        id: `activity:${a.id}`,
        group: 'activities' as const,
        title: a.title,
        subtitle: ACTIVITY_KIND[a.kind],
        icon: 'users-round',
        link: `/app/grupos/${a.id}`,
      }));
  }

  private planByCaregiver(): Map<string, string> {
    const plans = new Map(this.db.plans.list().map((p) => [p.id as string, p.name] as const));
    const result = new Map<string, string>();
    this.db.subscriptions.list().forEach((s) => {
      if (s.status !== 'cancelled') {
        result.set(s.caregiverId, plans.get(s.planId) ?? s.planId);
      }
    });
    return result;
  }

  private lastAppliedByCaregiver(): Map<string, string> {
    const result = new Map<string, string>();
    this.db.zaritAssessments.list().forEach((a) => {
      if (a.status === 'completed' && a.appliedAt) {
        const current = result.get(a.caregiverId);
        if (!current || a.appliedAt > current) {
          result.set(a.caregiverId, a.appliedAt);
        }
      }
    });
    return result;
  }
}
