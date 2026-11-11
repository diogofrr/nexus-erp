import { describe, expect, it } from 'vitest';
import { routes } from '../../../app.routes';
import { CAREGIVER_AREAS } from './caregiver-areas';
import { ROUTES as CAREGIVER_ROUTES, createCaregiverRoutes } from './caregiver.routes';

/** A tabela do contexto: área e rota base (docs/10-cuidador-contexto.md e docs/11-cuidador-arquitetura.md). */
const EXPECTED: readonly [string, string, 'session' | 'open'][] = [
  ['start', 'comecar', 'open'],
  ['start', 'mais/perfil', 'session'],
  ['today', 'hoje', 'session'],
  ['routine', 'rotina', 'session'],
  ['family', 'mais/familia', 'session'],
  ['care', 'cuidar-de-mim', 'session'],
  ['my-wellbeing', 'cuidar-de-mim/como-estou', 'session'],
  ['help', 'mais/ajuda', 'session'],
  ['help', 'ajuda-agora', 'open'],
  ['privacy', 'mais/privacidade', 'session'],
  ['network', 'rede', 'session'],
  ['card', 'rede/cartao', 'session'],
  ['plan', 'mais/plano', 'session'],
  ['groups', 'cuidar-de-mim/grupos', 'session'],
  ['content', 'cuidar-de-mim/conteudos', 'session'],
];

describe('Mapa de áreas do aplicativo do cuidador', () => {
  it('cada área é montada exatamente onde a tabela do contexto manda', () => {
    expect(CAREGIVER_AREAS.map((a) => [a.id, a.mount, a.access])).toEqual(EXPECTED);
  });

  it('as 13 áreas de página existem e os trechos de montagem não se repetem', () => {
    expect(new Set(CAREGIVER_AREAS.map((a) => a.id)).size).toBe(13);
    expect(new Set(CAREGIVER_AREAS.map((a) => a.mount)).size).toBe(CAREGIVER_AREAS.length);
  });

  it('cada área carrega sob demanda um arquivo de rotas com pelo menos uma rota', async () => {
    for (const area of CAREGIVER_AREAS) {
      const loaded = await area.load();
      expect(Array.isArray(loaded), `${area.id}/${area.exportName}`).toBe(true);
      expect(loaded.length, `${area.id}/${area.exportName}`).toBeGreaterThan(0);
    }
  });

  it('toda rota de área tem título (data.title) ou é um redirecionamento', async () => {
    for (const area of CAREGIVER_AREAS) {
      const loaded = await area.load();
      loaded.forEach((route) => {
        const hasTitle = typeof route.data?.['title'] === 'string' && route.data['title'] !== '';
        expect(hasTitle || route.redirectTo !== undefined, `${area.id} ${route.path}`).toBe(true);
      });
    }
  });
});

describe('Rotas de /cuidador no roteador central', () => {
  it('o app tem a rota cuidador, carregada sob demanda e protegida contra a equipe', () => {
    const route = routes.find((r) => r.path === 'cuidador');
    expect(route).toBeDefined();
    expect(typeof route?.loadChildren).toBe('function');
    expect(route?.canActivate).toHaveLength(1);
  });

  it('dentro do shell: as áreas abertas vêm antes do trecho com sessão, e o trecho com sessão confere a cada navegação', () => {
    const shell = CAREGIVER_ROUTES[0];
    const children = shell?.children ?? [];
    const open = children.filter((c) => c.loadChildren);
    expect(open.map((c) => c.path).sort()).toEqual(['ajuda-agora', 'comecar']);
    const guarded = children.find((c) => c.canActivate);
    expect(guarded?.runGuardsAndResolvers).toBe('always');
    const paths = (guarded?.children ?? []).map((c) => c.path);
    expect(paths[0]).toBe('');
    // O mais específico vem antes do mais genérico: rede/cartao antes de rede, cuidar-de-mim/* antes de cuidar-de-mim.
    expect(paths.indexOf('rede/cartao')).toBeLessThan(paths.indexOf('rede'));
    expect(paths.indexOf('cuidar-de-mim/como-estou')).toBeLessThan(paths.indexOf('cuidar-de-mim'));
    expect(paths.at(-1)).toBe('**');
    expect(paths).toContain('mais');
  });
});

describe('Catálogo do kit (só em desenvolvimento)', () => {
  const guardedPaths = (devMode: boolean): (string | undefined)[] =>
    (createCaregiverRoutes(devMode)[0]?.children?.find((c) => c.canActivate)?.children ?? []).map((c) => c.path);

  it('em produção a rota _kit não existe (cai em "Página não encontrada"); em desenvolvimento ela existe', () => {
    expect(guardedPaths(false)).not.toContain('_kit');
    expect(guardedPaths(true)).toContain('_kit');
    expect(CAREGIVER_ROUTES[0]?.children?.find((c) => c.canActivate)?.children?.some((c) => c.path === '_kit')).toBe(true);
  });

  it('/cuidador/_kit abre com sessão de cuidador e mostra os componentes', async () => {
    const { bootCaregiverApp } = await import('../testing');
    const { TestBed } = await import('@angular/core/testing');
    const app = await bootCaregiverApp('cg_0002', { url: '/cuidador/_kit' });
    expect(app.router.url).toBe('/cuidador/_kit');
    expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Kit do cuidador');
    ['.cg-note', '.cg-card', '.cg-dose', '.cg-mood', '.cg-row', '.cg-choice', '.cg-switch', '.cg-event', '.cg-block', '.cg-rating', '.cg-trend', '.cg-text-size', '.cg-emergency', '.cg-sheet'].forEach((selector) =>
      expect(app.root.querySelector(selector), selector).not.toBeNull(),
    );
    // O bloqueio por plano saiu do kit (docs/20, regra de exibição 1).
    expect(app.root.querySelector('.cg-plan-lock, app-cg-plan-lock')).toBeNull();
    TestBed.resetTestingModule();
  });
});
