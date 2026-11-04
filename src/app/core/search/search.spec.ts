import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService, TWO_FACTOR_CODE } from '../auth/auth.service';
import { canAccessModule, MODULES } from '../auth/module-map';
import { ROLES } from '../auth/permissions';
import { Role } from '../models/access';
import { CoreTestEnv, FakeStorage, configureCoreTest } from '../testing/test-helpers';
import { ACTIONS, NAV_ITEMS, actionsFor, navLabel, screensFor } from './screens';
import {
  EMPTY_SEARCH_MESSAGE,
  PARTNER_SEARCH_HINT,
  SearchResponse,
  SearchService,
  codeMatcher,
  looksLikeCaregiverCode,
  matchesQuery,
  normalizeText,
} from './search.service';

function loginAs(userId: string): void {
  const auth = TestBed.inject(AuthService);
  const outcome = auth.selectProfile(userId);
  if (outcome.status === 'needs_two_factor') {
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
  }
}

const caregiverGroup = (response: SearchResponse) =>
  response.groups.find((g) => g.key === 'caregivers');

describe('busca: funções puras', () => {
  it('ignora acentos e maiúsculas e exige todas as palavras', () => {
    expect(normalizeText('Cecília  ')).toBe('cecilia');
    expect(matchesQuery('Dra. Cecília Montenegro', 'cecilia mont')).toBe(true);
    expect(matchesQuery('Dra. Cecília Montenegro', 'cecilia rafael')).toBe(false);
  });

  it('reconhece o formato de código e casa pelo começo ou pelos dígitos', () => {
    expect(looksLikeCaregiverCode('CUI-0042')).toBe(true);
    expect(looksLikeCaregiverCode('cui')).toBe(true);
    expect(looksLikeCaregiverCode('0042')).toBe(true);
    expect(looksLikeCaregiverCode('Ana')).toBe(false);
    expect(codeMatcher('CUI-00')('CUI-0042')).toBe(true);
    expect(codeMatcher('cui0042')('CUI-0042')).toBe(true);
    expect(codeMatcher('042')('CUI-0042')).toBe(true);
    expect(codeMatcher('cui-0043')('CUI-0042')).toBe(false);
  });
});

describe('catálogo de telas e ações por perfil', () => {
  it('toda tela e toda ação do perfil passam pela matriz de permissões (sem item morto)', () => {
    ROLES.forEach((role) => {
      const screens = screensFor(role);
      expect(screens.length, role).toBeGreaterThan(0);
      screens.forEach((s) => {
        if (s.moduleKey) {
          const module = MODULES.find((m) => m.key === s.moduleKey);
          expect(module && canAccessModule(role, module), `${role} ${s.link}`).toBe(true);
        }
        // O credenciado só abre o portal; a equipe nunca abre o portal.
        expect(s.link.startsWith('/portal'), `${role} ${s.link}`).toBe(role === 'provider');
      });
      actionsFor(role).forEach((a) => {
        const module = MODULES.find((m) => m.key === a.moduleKey);
        expect(module && canAccessModule(role, module), `${role} ${a.id}`).toBe(true);
        expect(a.roles).toContain(role);
      });
    });
  });

  it('o RT só abre as áreas de configurações liberadas a ele; a sócia abre todas', () => {
    const rt = screensFor('technical_lead').filter((s) => s.link.startsWith('/app/configuracoes'));
    expect(rt.map((s) => s.link).sort()).toEqual([
      '/app/configuracoes',
      '/app/configuracoes/arbe',
      '/app/configuracoes/conteudos',
    ]);
    const partner = screensFor('partner').filter((s) => s.link.startsWith('/app/configuracoes'));
    expect(partner.length).toBeGreaterThan(5);
    expect(screensFor('support').some((s) => s.link.startsWith('/app/configuracoes'))).toBe(false);
    expect(screensFor('psychologist').some((s) => s.link.startsWith('/app/financeiro'))).toBe(
      false,
    );
  });

  it('o rótulo do item muda quando o perfil só vê uma parte', () => {
    const caregivers = NAV_ITEMS.find((i) => i.key === 'caregivers');
    const care = NAV_ITEMS.find((i) => i.key === 'care-sessions');
    expect(caregivers && navLabel(caregivers, 'psychologist')).toBe('Meus cuidadores');
    expect(caregivers && navLabel(caregivers, 'partner')).toBe('Cuidadores (por código)');
    expect(caregivers && navLabel(caregivers, 'support')).toBe('Cuidadores');
    expect(care && navLabel(care, 'partner')).toBe('Ocupação da equipe');
  });

  it('as ações da paleta só abrem telas: nenhuma tem verbo destrutivo', () => {
    ACTIONS.forEach((a) =>
      expect(a.label.toLowerCase()).not.toMatch(
        /apagar|eliminar|excluir|anonimizar|descredenciar|resetar/,
      ),
    );
  });
});

describe('SearchService', () => {
  let env: CoreTestEnv;
  let search: SearchService;
  let session: FakeStorage;

  beforeEach(() => {
    session = new FakeStorage();
    env = configureCoreTest({ seed: true, session });
    search = TestBed.inject(SearchService);
  });

  it('a gestão busca cuidador só por código e nunca vê nome', () => {
    loginAs('u1');
    // Por nome: nenhum cuidador, e a mensagem diz como buscar.
    const byName = search.search('Ana Paula');
    expect(caregiverGroup(byName)).toBeUndefined();
    expect(byName.message).toBe(PARTNER_SEARCH_HINT);
    expect(search.search('Ana').message).toBe(PARTNER_SEARCH_HINT);

    // Por código: devolve o código, o plano e o status, sem nome nem contato.
    const byCode = search.search('CUI-0001');
    const result = caregiverGroup(byCode)?.results[0];
    expect(result?.title).toBe('CUI-0001');
    expect(result?.subtitle).toBe('Nexus Cuida · Ativo');
    expect(result?.link).toBe('/app/cuidadores/cg_0001');
    const everything = JSON.stringify(byCode);
    env.db.caregivers.list().forEach((c) => {
      expect(everything).not.toContain(c.fullName);
      expect(everything).not.toContain(c.phone);
      expect(everything).not.toContain(c.email);
    });

    // Prefixo: conta o total do grupo mesmo mostrando só os primeiros.
    const prefix = caregiverGroup(search.search('CUI-00'));
    expect(prefix?.results.length).toBe(6);
    expect(prefix?.total).toBeGreaterThanOrEqual(29);
    expect(search.search('cui').groups.some((g) => g.key === 'caregivers')).toBe(true);
  });

  it('o atendimento busca por nome e vê o contato mascarado, nunca o telefone inteiro', () => {
    loginAs('u7');
    const response = search.search('Ana Paula');
    const result = caregiverGroup(response)?.results[0];
    expect(result?.title).toBe('Ana Paula Ferraz');
    expect(result?.subtitle).toContain('CUI-0001');
    expect(result?.subtitle).toMatch(/\(34\) 9\*{4}-\d{4}/);
    const ana = env.db.caregivers.get('cg_0001');
    expect(JSON.stringify(response)).not.toContain(ana?.phone ?? 'x');
    // Sem acentos e sem diferenciar maiúsculas.
    expect(caregiverGroup(search.search('JOAO batista'))?.results[0]?.title).toBe(
      'João Batista Carneiro',
    );
  });

  it('a responsável técnica busca todos os cuidadores e vê o psicólogo responsável', () => {
    loginAs('u2');
    const result = caregiverGroup(search.search('Maria Aparecida'))?.results[0];
    expect(result?.title).toBe('Maria Aparecida Lemos');
    expect(result?.subtitle).toBe('CUI-0002 · Dra. Beatriz Nogueira');
  });

  it('o psicólogo só encontra os próprios cuidadores e vê a data da última aplicação', () => {
    loginAs('u3'); // Dr. Rafael
    expect(caregiverGroup(search.search('Maria Aparecida'))).toBeUndefined();
    expect(search.search('Maria Aparecida').message).toBe(EMPTY_SEARCH_MESSAGE);
    const own = caregiverGroup(search.search('Ana Paula'))?.results[0];
    expect(own?.title).toBe('Ana Paula Ferraz');
    expect(own?.subtitle).toMatch(/^CUI-0001 · última aplicação em \d{2}\/\d{2}\/\d{4}$/);
    // Todos os resultados de cuidador são dele.
    const all = caregiverGroup(search.search('CUI-'));
    all?.results.forEach((r) => {
      const id = r.id.replace('caregiver:', '');
      expect(env.db.caregivers.get(id)?.assignedPsychologistId).toBe('psy_0001');
    });
  });

  it('o credenciado não encontra cuidador algum, só as próprias telas e solicitações', () => {
    loginAs('u9');
    const response = search.search('Ana');
    expect(caregiverGroup(response)).toBeUndefined();
    const docs = search.search('documentos');
    expect(docs.groups.find((g) => g.key === 'screens')?.results[0]?.link).toBe(
      '/portal/documentos',
    );
    const requests = search.search('solicitação');
    const own = requests.groups.find((g) => g.key === 'requests');
    expect(own?.total).toBeGreaterThanOrEqual(2);
    // Nenhuma rota da equipe em nenhum resultado.
    ['a', 'e', 'o', 'documentos', 'CUI-0001'].forEach((q) => {
      search
        .search(q)
        .groups.flatMap((g) => g.results)
        .forEach((r) => expect(r.link.startsWith('/app'), `${q}: ${r.link}`).toBe(false));
    });
    // E a solicitação mostrada não identifica o cuidador.
    expect(JSON.stringify(own)).not.toMatch(/CUI-|cg_/);
  });

  it('nenhum perfil recebe resultado de uma tela que não pode abrir', () => {
    const roles: [Role, string][] = [
      ['partner', 'u1'],
      ['technical_lead', 'u2'],
      ['psychologist', 'u3'],
      ['support', 'u7'],
    ];
    roles.forEach(([role, userId]) => {
      loginAs(userId);
      ['pa', 'ar', 'de', 'fin', 'lgpd', 'log', 'rede', 'config'].forEach((q) => {
        search
          .search(q)
          .groups.flatMap((g) => g.results)
          .filter(
            (r) =>
              r.link.startsWith('/app/') &&
              !['caregiver', 'provider', 'partner', 'company', 'activity'].some((p) =>
                r.id.startsWith(p),
              ),
          )
          .forEach((r) => {
            const module = MODULES.filter(
              (m) => r.link === m.path || r.link.startsWith(`${m.path}/`),
            ).sort((a, b) => b.path.length - a.path.length)[0];
            if (module) {
              expect(canAccessModule(role, module), `${role}: ${r.link}`).toBe(true);
            }
          });
      });
    });
    loginAs('u7');
    expect(search.search('financeiro').groups.some((g) => g.key === 'screens')).toBe(false);
    loginAs('u2');
    expect(search.search('financeiro').groups.some((g) => g.key === 'screens')).toBe(false);
  });

  it('sem digitar mostra as ações do perfil; menos de 2 caracteres não busca', () => {
    loginAs('u7');
    const suggestions = search.suggestions();
    expect(suggestions[0]?.key).toBe('actions');
    expect(suggestions[0]?.results.map((r) => r.title)).toContain('Novo cuidador');
    expect(suggestions[0]?.results.map((r) => r.title)).not.toContain('Aplicar a escala de Zarit');
    expect(search.search('a').groups).toEqual(suggestions);
    expect(search.search('a').total).toBe(0);
    expect(search.search('').message).toBeNull();
  });

  it('o texto buscado nunca é guardado; os recentes guardam só o que foi aberto, por usuário', () => {
    loginAs('u7');
    const response = search.search('Ana Paula');
    const opened = caregiverGroup(response)?.results[0];
    expect(opened).toBeDefined();
    search.recordOpened(opened as NonNullable<typeof opened>);
    const raw = [...session.data.values()].join('\n');
    expect(raw).not.toContain('Ana Paula Ferraz CUI');
    expect(raw).toContain('caregiver:cg_0001');
    expect([...session.data.keys()].every((k) => k.startsWith('nexus-erp:'))).toBe(true);
    expect(search.recents().map((r) => r.id)).toEqual(['caregiver:cg_0001']);

    // Sem texto buscado em lugar algum (nem local nem sessão).
    expect([...env.local.data.values()].join('\n')).not.toContain('"Ana Paula"');

    // Outro usuário não vê os recentes do primeiro.
    loginAs('u1');
    expect(search.recents()).toEqual([]);
    // Volta ao primeiro: ainda estão lá? Não: o armazenamento é do último usuário que gravou.
    search.recordOpened({
      id: 'screen:/app/painel',
      group: 'screens',
      title: 'Painel',
      icon: 'layout-dashboard',
      link: '/app/painel',
    });
    loginAs('u7');
    expect(search.recents()).toEqual([]);
  });

  it('guarda no máximo 5 recentes, sem repetir, e registra visita a telas do catálogo', () => {
    loginAs('u1');
    [
      '/app/painel',
      '/app/cuidadores',
      '/app/financeiro',
      '/app/rede',
      '/app/parceiros',
      '/app/empresas',
      '/app/financeiro',
    ].forEach((p) => search.recordVisit(p));
    search.recordVisit('/app/nao-existe');
    const recents = search.recents();
    expect(recents).toHaveLength(5);
    expect(recents[0]?.link).toBe('/app/financeiro');
    expect(new Set(recents.map((r) => r.id)).size).toBe(5);
    search.clearRecents();
    expect(search.recents()).toEqual([]);
  });
});
