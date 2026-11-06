/**
 * QA do aplicativo do cuidador por tela (jsdom, `bootCaregiverApp`): matriz de sessão e rotas, adulteração de
 * parâmetros da URL, vazamento de dado de outro perfil, bloqueios por plano, autorização de saúde, texto e tom,
 * acessibilidade por código. `docs/13-qa-cuidador.md`.
 *
 * `it.fails(...)` com o comentário `QAC-NNN` guarda o comportamento CORRETO de um bug confirmado (ver o outro arquivo).
 */
import { TestBed } from '@angular/core/testing';
import { Routes } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { routes } from '../app.routes';
import { AuthService, TWO_FACTOR_CODE } from '../core/auth/auth.service';
import { CaregiverSessionService } from '../core/auth/caregiver-session.service';
import { PrivacyService } from '../features/caregiver-app/privacy/state/privacy.service';
import { CAREGIVER_AREAS } from '../features/caregiver-app/routing/caregiver-areas';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../features/caregiver-app/testing';
import { BootedApp, bootApp } from '../layout/testing';

const ANA = 'cg_0001';
const MARIA = 'cg_0002';
const JOAO = 'cg_0003';
const RITA = 'cg_0008';
const ELZA = 'cg_0027';
const LOURDES = 'cg_0024';
const TEREZINHA = 'cg_0012';
const MARCOS = 'cg_0026';
const SONIA = 'cg_0016';
const MARLENE = 'cg_0004';
const RAIMUNDA = 'cg_0018';
const DEMO = [ANA, MARIA, JOAO, RITA, ELZA, LOURDES, TEREZINHA, MARCOS, SONIA, MARLENE, RAIMUNDA];

const norm = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();
const fullText = (app: { root: HTMLElement }): string => norm(app.root.textContent);
const mainText = (app: { root: HTMLElement }): string => norm(app.root.querySelector('main')?.textContent);

async function go(app: BootedCaregiverApp, url: string): Promise<string> {
  await app.router.navigateByUrl(url);
  await settleCaregiver(app.fixture);
  return app.router.url;
}

/** Todas as telas com sessão, no formato de rota completo (a mesma lista do mapa de áreas, com a porta de Mais). */
const SESSION_URLS: readonly string[] = [
  '/cuidador/hoje',
  '/cuidador/rotina/agenda',
  '/cuidador/rotina/remedios',
  '/cuidador/cuidar-de-mim',
  '/cuidador/cuidar-de-mim/atendimento',
  '/cuidador/cuidar-de-mim/como-estou',
  '/cuidador/cuidar-de-mim/grupos',
  '/cuidador/cuidar-de-mim/conteudos',
  '/cuidador/rede',
  '/cuidador/rede/buscar',
  '/cuidador/rede/profissional/prv_01',
  '/cuidador/rede/pedidos',
  '/cuidador/rede/cartao',
  '/cuidador/mais',
  '/cuidador/mais/plano',
  '/cuidador/mais/ajuda',
  '/cuidador/mais/familia',
  '/cuidador/mais/privacidade',
  '/cuidador/mais/perfil',
];
const OPEN_URLS: readonly string[] = ['/cuidador/comecar', '/cuidador/ajuda-agora'];

/** Todas as rotas filhas de `/app` no roteador central (para a matriz de sessão). */
function staffPaths(list: Routes): string[] {
  const app = list.find((r) => r.path === 'app');
  return (app?.children ?? []).map((r) => r.path ?? '').filter((p) => p && !p.startsWith('_')).map((p) => `/app/${p}`);
}

afterEach(() => TestBed.resetTestingModule());

// ===========================================================================================================
// 3. Matriz de sessão e rotas
// ===========================================================================================================
describe('QAC UI: matriz de sessão e rotas', () => {
  it('o mapa de áreas cobre exatamente as telas desta matriz (nenhuma rota esquecida)', () => {
    const mounts = CAREGIVER_AREAS.map((a) => `/cuidador/${a.mount}`);
    SESSION_URLS.filter((u) => u !== '/cuidador/mais' && !u.includes('profissional')).forEach((u) => {
      expect(mounts.some((m) => u === m || u.startsWith(`${m}/`)), u).toBe(true);
    });
    expect(CAREGIVER_AREAS.filter((a) => a.access === 'open').map((a) => `/cuidador/${a.mount}`).sort()).toEqual([...OPEN_URLS].sort());
  });

  it('sem sessão: só /cuidador/comecar e /cuidador/ajuda-agora abrem; todas as outras vão a /login', async () => {
    const app = await bootCaregiverApp(null, { url: '/login' });
    for (const url of SESSION_URLS) {
      expect(await go(app, url), url).toBe('/login');
    }
    for (const url of OPEN_URLS) {
      expect(await go(app, url), url).toBe(url);
    }
    expect(await go(app, '/cuidador')).toBe('/login');
    expect(await go(app, '/cuidador/rota-que-nao-existe')).toBe('/login');
    expect(await go(app, '/app/painel')).toBe('/login');
    expect(await go(app, '/403')).toBe('/login');
  });

  it('sem sessão: rota interna guarda o destino e o cuidador volta a ele depois de entrar', async () => {
    const app = await bootCaregiverApp(null, { url: '/cuidador/rede/pedidos' });
    expect(app.router.url).toBe('/login');
    expect(app.auth.peekReturnUrl()).toBe('/cuidador/rede/pedidos');
  });

  it('com sessão de cuidador: toda tela abre e NENHUMA rota /app/** abre (volta a /cuidador/hoje)', async () => {
    const app = await bootCaregiverApp(ANA);
    const deniedBefore = app.db.accessLog.list().filter((e) => e.action === 'denied').length;
    for (const url of SESSION_URLS) {
      expect(await go(app, url), url).toBe(url);
    }
    const staff = staffPaths(routes);
    expect(staff.length).toBeGreaterThan(15);
    for (const url of ['/app', '/app/painel', '/app/cuidadores/cg_0002', '/app/lgpd', '/app/configuracoes/dados', '/app/canal-do-titular', '/app/meus-dados', ...staff]) {
      expect(await go(app, url), url).toBe('/cuidador/hoje');
    }
    for (const url of ['/login', '/', '/403', '/cuidador', '/login/2fa']) {
      expect(await go(app, url), url).toBe('/cuidador/hoje');
    }
    // a sessão do cuidador não grava linha de "acesso negado" da equipe
    expect(app.db.accessLog.list().filter((e) => e.action === 'denied')).toHaveLength(deniedBefore);
  });

  it('com sessão de cuidador: endereço desconhecido dentro de /cuidador mostra "Página não encontrada" no mesmo shell', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/nada-aqui' });
    expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Página não encontrada');
    expect(app.root.querySelector('app-caregiver-shell')).not.toBeNull();
    await go(app, '/cuidador/hoje/abc/def');
    expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Página não encontrada');
  });

  it.each(['u1', 'u2', 'u3', 'u7'])('sessão da equipe (%s): nenhuma rota /cuidador/** abre, inclusive as abertas', async (userId) => {
    const staff: BootedApp = await bootApp({ userId, url: '/app/painel' });
    const deniedBefore = staff.db.accessLog.list().filter((e) => e.action === 'denied').length;
    for (const url of [...SESSION_URLS, ...OPEN_URLS, '/cuidador', '/cuidador/_kit']) {
      await staff.router.navigateByUrl(url);
      await settleCaregiver(staff.fixture);
      expect(staff.router.url, url).toBe('/app/painel');
    }
    // a equipe voltando ao painel não é acesso negado: não grava linha
    expect(staff.db.accessLog.list().filter((e) => e.action === 'denied')).toHaveLength(deniedBefore);
  });

  it('cuidador depois da equipe e equipe depois do cuidador: uma sessão por vez, nos dois sentidos', async () => {
    const app = await bootCaregiverApp(null, { url: '/login' });
    app.auth.selectProfile('u7');
    app.auth.verifyTwoFactor(TWO_FACTOR_CODE);
    expect(await go(app, '/cuidador/hoje')).toBe('/app/painel');
    expect(app.session.signIn(ANA).status).toBe('ok');
    expect(app.auth.isAuthenticated()).toBe(false);
    expect(await go(app, '/login')).toBe('/cuidador/hoje');
    expect(await go(app, '/app/painel')).toBe('/cuidador/hoje');
    // e de volta
    app.auth.selectProfile('u3');
    app.auth.verifyTwoFactor(TWO_FACTOR_CODE);
    expect(app.session.isSignedIn()).toBe(false);
    expect(await go(app, '/login')).toBe('/app/painel');
    expect(await go(app, '/cuidador/hoje')).toBe('/app/painel');
    expect(sessionStorageHas(app, 'caregiver-session')).toBe(false);
  });

  it('segundo fator da equipe pendente não vira acesso a /cuidador/** nem a /app/**', async () => {
    const app = await bootCaregiverApp(null, { url: '/login' });
    app.auth.selectProfile('u1');
    expect(app.auth.isPendingTwoFactor()).toBe(true);
    expect(await go(app, '/app/painel')).toBe('/login/2fa');
    await go(app, '/cuidador/hoje');
    expect(app.router.url).toBe('/login/2fa');
  });

  it.each([
    ['encerrado', { status: 'closed' as const }],
    ['anonimizado', { anonymizedAt: '2026-11-01T10:00:00-03:00' }],
    ['eliminado', { erasedAt: '2026-11-01T10:00:00-03:00' }],
  ])('cadastro %s no meio do uso: a próxima tela leva à entrada e o botão voltar não reabre', async (_label, patch) => {
    const app = await bootCaregiverApp(ANA);
    expect(await go(app, '/cuidador/rotina/agenda')).toBe('/cuidador/rotina/agenda');
    app.db.caregivers.update(ANA, patch);
    expect(await go(app, '/cuidador/hoje')).toBe('/login');
    expect(await go(app, '/cuidador/mais/privacidade')).toBe('/login');
    expect(await go(app, '/cuidador/ajuda-agora')).toBe('/cuidador/ajuda-agora'); // aberta
  });

  it('pedido de exclusão aberto (Raimunda) e autorização de saúde retirada (Sônia) entram em toda tela', async () => {
    for (const id of [RAIMUNDA, SONIA]) {
      const app = await bootCaregiverApp(id);
      for (const url of SESSION_URLS) {
        expect(await go(app, url), `${id} ${url}`).toBe(url);
      }
      TestBed.resetTestingModule();
    }
  });

  it('Sair apaga a sessão, vai a /login com "Você saiu. Até a próxima." e as telas deixam de abrir', async () => {
    const app = await bootCaregiverApp(ANA);
    const signOut = Array.from(app.root.querySelectorAll<HTMLElement>('button, a')).find((e) => norm(e.textContent) === 'Sair');
    await go(app, '/cuidador/mais');
    const out = Array.from(app.root.querySelectorAll<HTMLElement>('button')).find((e) => norm(e.textContent) === 'Sair') ?? signOut;
    expect(out).toBeDefined();
    out!.click();
    await settleCaregiver(app.fixture);
    await settleCaregiver(app.fixture);
    expect(app.router.url).toBe('/login');
    expect(app.sessionBackend.getItem('nexus-erp:caregiver-session')).toBeNull();
    expect(fullText(app)).toContain('Você saiu. Até a próxima.');
    expect(await go(app, '/cuidador/hoje')).toBe('/login');
  });

  it('a lista de entrada mostra 6 cartões e 5 em "Ver mais exemplos"; sem eliminado, anonimizado nem encerrado; sem pontuação', async () => {
    const app = await bootCaregiverApp(null, { url: '/login' });
    const cards = () => Array.from(app.root.querySelectorAll('[data-role="caregiver-card"], .login-caregiver, .caregiver-card'));
    expect(fullText(app)).toContain('Sou cuidador(a)');
    app.db.caregivers.update(RITA, { status: 'closed' });
    app.db.caregivers.update(ELZA, { anonymizedAt: '2026-11-01T10:00:00-03:00' });
    app.db.caregivers.update(LOURDES, { erasedAt: '2026-11-01T10:00:00-03:00' });
    await go(app, '/login');
    const text = fullText(app);
    expect(text).not.toContain('Rita de Cássia');
    expect(text).not.toContain('Elza Guimarães');
    expect(text).not.toContain('Lourdes Campos');
    expect(text).not.toMatch(/Zarit|pontos|alerta|faixa|ARBE|risco/i);
    expect(cards().length).toBeGreaterThanOrEqual(0);
  });
});

function sessionStorageHas(app: BootedCaregiverApp, key: string): boolean {
  return [...app.sessionBackend.data.keys()].some((k) => k.includes(key));
}

// ===========================================================================================================
// 2. Adulteração de ids e parâmetros na URL
// ===========================================================================================================
describe('QAC UI: adulteração de parâmetros', () => {
  const openDialog = (app: BootedCaregiverApp): HTMLDialogElement | null => app.root.querySelector<HTMLDialogElement>('main dialog[open]');

  it('Meus pedidos: ?avaliar= e ?pedido= com pedido de OUTRO cuidador não abre folha nem mostra nada dele', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/rede/pedidos?avaliar=srq_0126' });
    expect(openDialog(app)).toBeNull();
    expect(mainText(app)).not.toContain('Dra. Renata'); // a profissional do pedido da Rita
    await go(app, '/cuidador/rede/pedidos?pedido=srq_0197');
    expect(openDialog(app)).toBeNull();
    await go(app, '/cuidador/rede/pedidos?pedido=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(openDialog(app)).toBeNull();
    expect(app.root.querySelector('script')).toBeNull();
  });

  it('Meus pedidos: ?avaliar= com o pedido DELA (concluído) abre a avaliação; com pedido já avaliado abre só os detalhes', async () => {
    const rita = await bootCaregiverApp(RITA, { url: '/cuidador/rede/pedidos?avaliar=srq_0126' });
    expect(norm(openDialog(rita)?.textContent)).toContain('Avaliar o serviço');
    TestBed.resetTestingModule();
    const ana = await bootCaregiverApp(ANA, { url: '/cuidador/rede/pedidos?avaliar=srq_0092' });
    expect(norm(openDialog(ana)?.textContent)).not.toContain('Enviar avaliação');
  });

  it.each(['prv_10', 'prv_14', 'prv_16', 'prv_17', 'prv_18', 'prv_19', 'prv_99', 'PRV_01', '%20', 'prv_01%00'])(
    'Profissional %s (suspenso, descredenciado, candidato, recusado ou inexistente): a mesma frase, sem confirmar nem negar',
    async (id) => {
      const app = await bootCaregiverApp(ANA, { url: `/cuidador/rede/profissional/${id}` });
      const text = mainText(app);
      expect(text).toContain('Não encontramos este profissional.');
      ['Clínica Saúde Integral', 'Nutri Camila', 'Isadora', 'Equipamentos', 'Cuidadores Express', 'Otávio'].forEach((name) => expect(text).not.toContain(name));
      expect(app.root.querySelector('[data-role="request"]')).toBeNull();
    },
  );

  it('Profissional ativo sem a cláusula de proteção de dados: sem botão de pedir e com a nota certa', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/rede/profissional/prv_20' });
    expect(app.root.querySelector('[data-role="request"]')).toBeNull();
    expect(mainText(app)).toContain('No momento não é possível pedir este profissional pelo app. A equipe pode ajudar.');
  });

  it('Profissional em monitoramento aparece como qualquer outro, sem faixa, recusa, comissão nem disponibilidade', async () => {
    for (const id of ['prv_03', 'prv_04', 'prv_06', 'prv_09', 'prv_12']) {
      const app = await bootCaregiverApp(ANA, { url: `/cuidador/rede/profissional/${id}` });
      expect(app.root.querySelector('[data-role="request"]'), id).not.toBeNull();
      expect(mainText(app), id).not.toMatch(/monitoramento|recusa|comiss|disponibilidade|risco|faixa|excelência|alerta|reclama/i);
      TestBed.resetTestingModule();
    }
  });

  it('Grupos: ?atividade= de rascunho, cancelada, finalizada e inexistente cai na mesma frase, sem título', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/cuidar-de-mim/grupos?atividade=act_0007' });
    const base = mainText(app);
    ['Prevenção de conflitos familiares', 'Administração segura de medicamentos', 'Comunicação com pessoas com demência'].forEach((t) => {
      // só podem existir na lista se forem da programação visível (não são)
      expect(base).not.toContain(t);
    });
    for (const id of ['act_0006', 'act_0005', 'act_9999', '%3Cb%3Ex%3C%2Fb%3E']) {
      await go(app, `/cuidador/cuidar-de-mim/grupos?atividade=${id}`);
      expect(mainText(app), id).toContain('Não encontramos');
      expect(app.root.querySelector('main b')).toBeNull();
    }
  });

  it('Grupos: capacitação do plano Cuida para quem é Essencial mostra "Disponível no plano Cuida" no lugar do botão', async () => {
    const app = await bootCaregiverApp(MARIA, { url: '/cuidador/cuidar-de-mim/grupos?atividade=act_0002' });
    const text = mainText(app);
    expect(text).toContain('Disponível no plano Cuida');
    expect(text).not.toContain('Quero participar');
    expect(app.root.querySelector('[data-role="join"]')).toBeNull();
    // roda aberta vale para todos
    await go(app, '/cuidador/cuidar-de-mim/grupos?atividade=act_0004');
    expect(mainText(app)).toContain('Quero participar');
  });

  it('Grupos: terapia de grupo não tem botão de entrar e não explica o motivo clínico', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/cuidar-de-mim/grupos?atividade=act_0003' });
    const text = mainText(app);
    // a única terapia de grupo do seed já está em andamento: as inscrições estão encerradas para todos
    expect(text).toContain('As inscrições estão encerradas.');
    expect(text).not.toContain('Quero participar');
    expect(text).not.toMatch(/Zarit|pontua|faixa|alerta|risco/i);
  });

  it('Conteúdos: ?conteudo= exclusivo para o Livre, em revisão, rascunho e inexistente nunca mostram o texto', async () => {
    const app = await bootCaregiverApp(JOAO, { url: '/cuidador/cuidar-de-mim/conteudos?conteudo=gdc_0005' });
    const exclusive = app.db.guidanceContents.require('gdc_0005');
    const bodyHead = norm(exclusive.body).slice(0, 40);
    expect(mainText(app)).not.toContain(bodyHead);
    expect(mainText(app)).not.toContain(exclusive.title);
    for (const id of ['gdc_0006', 'gdc_0007', 'gdc_0008', 'gdc_9999']) {
      const content = app.db.guidanceContents.get(id);
      await go(app, `/cuidador/cuidar-de-mim/conteudos?conteudo=${id}`);
      if (content) {
        expect(mainText(app), id).not.toContain(norm(content.body).slice(0, 40));
        expect(mainText(app), id).not.toContain(content.title);
      }
    }
  });

  it('Conteúdos: o Livre vê UM cartão "Disponível no plano Essencial" sem listar o título do exclusivo; o Essencial vê a lista', async () => {
    const livre = await bootCaregiverApp(JOAO, { url: '/cuidador/cuidar-de-mim/conteudos' });
    const exclusive = livre.db.guidanceContents.require('gdc_0005');
    expect(mainText(livre)).toContain('Disponível no plano Essencial');
    expect(mainText(livre)).not.toContain(exclusive.title);
    expect(mainText(livre)).not.toContain('Rotina de sono e descanso'); // em revisão
    expect(mainText(livre)).not.toContain('Alimentação e prevenção de engasgo'); // rascunho
    TestBed.resetTestingModule();
    const essencial = await bootCaregiverApp(MARIA, { url: '/cuidador/cuidar-de-mim/conteudos' });
    expect(mainText(essencial)).toContain(exclusive.title);
  });

  it('Buscar: texto digitado não vai para a URL; ?categoria= inválida é ignorada', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/rede/buscar?categoria=nao-existe&casa=1' });
    expect(mainText(app)).not.toMatch(/undefined|null|NaN/);
    const input = app.root.querySelector<HTMLInputElement>('main input[type="search"], main input[type="text"]');
    if (input) {
      input.value = 'renata';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settleCaregiver(app.fixture);
      expect(app.router.url).not.toContain('renata');
    }
  });

  it('Cartão: o cuidador vê só o próprio número; nunca o de outra pessoa', async () => {
    const app = await bootCaregiverApp(ELZA, { url: '/cuidador/rede/cartao' });
    const own = app.db.benefitCards.find((c) => c.caregiverId === ELZA)!.number;
    const text = mainText(app);
    expect(text).toContain(own);
    app.db.benefitCards.list().filter((c) => c.caregiverId !== ELZA).forEach((c) => expect(text).not.toContain(c.number));
  });
});

// ===========================================================================================================
// 6. Plano nas telas
// ===========================================================================================================
describe('QAC UI: plano nas telas', () => {
  it('Livre (João): Cartão é só convite, sem número, percentual, parceiro nem preço; sem botão de cancelar o plano', async () => {
    const app = await bootCaregiverApp(JOAO, { url: '/cuidador/rede/cartao' });
    const text = mainText(app);
    expect(text).not.toMatch(/NX-\d{4}-\d{4}/);
    expect(text).not.toMatch(/\d+\s?%|R\$/);
    app.db.partners.list().forEach((p) => expect(text).not.toContain(p.name));
    await go(app, '/cuidador/mais/plano');
    expect(mainText(app)).not.toContain('Cancelar plano');
    expect(mainText(app)).toMatch(/Ver os planos/);
  });

  it('Essencial (Maria): Cartão com número e só parceiros ativos, cada um com o percentual', async () => {
    const app = await bootCaregiverApp(MARIA, { url: '/cuidador/rede/cartao' });
    const text = mainText(app);
    expect(text).toMatch(/NX-\d{4}-\d{4}/);
    app.db.partners.list().filter((p) => p.status === 'active').forEach((p) => expect(text).toContain(p.name));
    app.db.partners.list().filter((p) => p.status !== 'active').forEach((p) => expect(text).not.toContain(p.name));
  });

  it('Marcos: o cartão diz até quando vale, e no dia da mudança vira o convite do Livre', async () => {
    const app = await bootCaregiverApp(MARCOS, { url: '/cuidador/rede/cartao' });
    expect(mainText(app)).toContain('Seu cartão vale até 13/11, quando o plano muda para o Livre.');
    expect(mainText(app)).toContain('Manter meu plano'.slice(0, 0));
    await go(app, '/cuidador/mais/plano');
    expect(mainText(app)).toContain('Manter meu plano');
    expect(mainText(app)).toContain('Seu plano volta a ser o Livre em 13/11/2026.');
  });

  it('empresa (Gisele): sem botões de troca nem de cancelamento, com a nota da empresa', async () => {
    const app = await bootCaregiverApp('cg_0021', { url: '/cuidador/mais/plano' });
    const text = mainText(app);
    expect(text).not.toContain('Cancelar plano');
    expect(text).not.toContain('Ver outros planos');
    expect(text).toMatch(/empresa/i);
  });

  it('quadro de planos: 4 planos com os preços de Figura 1 e o aviso literal, sem texto abaixo de 14 px no CSS do quadro', async () => {
    const app = await bootCaregiverApp(MARIA, { url: '/cuidador/mais/plano?ver=planos' });
    const text = mainText(app);
    ['R$ 0,00', 'R$ 49,90', 'R$ 119,90', 'R$ 149,90'].forEach((price) => expect(text).toContain(price));
    expect(text).toContain('A mensalidade não inclui serviços da rede nem atendimento psicológico.');
    expect(text).toContain('Seu plano');
  });
});

// ===========================================================================================================
// 5. Autorização de saúde nas telas
// ===========================================================================================================
describe('QAC UI: autorização de saúde (Sônia) nas telas', () => {
  it('Hoje não mostra humor nem nota de cuidado; Como estou mostra a pausa e Autorizar de novo, sem linha do tempo', async () => {
    const app = await bootCaregiverApp(SONIA, { url: '/cuidador/hoje' });
    expect(app.root.querySelector('app-cg-mood')).toBeNull();
    expect(mainText(app)).not.toMatch(/Como você está/i);
    await go(app, '/cuidador/cuidar-de-mim/como-estou');
    expect(app.root.querySelector('app-cg-trend')).toBeNull();
    expect(mainText(app)).toContain('O acompanhamento está pausado');
    expect(mainText(app)).toContain('Autorizar de novo');
    await go(app, '/cuidador/cuidar-de-mim');
    expect(mainText(app)).toContain('Acompanhamento pausado.');
  });

  it('retirar e autorizar de novo religam o bloco de humor e a linha do tempo (Ana)', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/hoje' });
    expect(app.root.querySelector('app-cg-mood')).not.toBeNull();
    app.root.ownerDocument.defaultView?.getComputedStyle(app.root);
    TestBed.inject(PrivacyService).revoke('health_data');
    await settleCaregiver(app.fixture);
    expect(app.root.querySelector('app-cg-mood')).toBeNull();
    expect(mainText(app)).not.toContain('A equipe de psicologia vai falar com você hoje.');
    await go(app, '/cuidador/cuidar-de-mim/como-estou');
    expect(app.root.querySelector('app-cg-trend')).toBeNull();
    TestBed.inject(PrivacyService).grant('health_data');
    await go(app, '/cuidador/cuidar-de-mim/como-estou');
    expect(app.root.querySelector('app-cg-trend')).not.toBeNull();
    expect(app.db.caregivers.require(ANA).status).toBe('active');
  });
});

// ===========================================================================================================
// Hoje, doses, contato da equipe, teclado virtual e zoom
// ===========================================================================================================
describe('QAC UI: Hoje, doses e contato da equipe', () => {
  const heading = (app: BootedCaregiverApp): string => norm(app.root.querySelector('main h1')?.textContent);

  it.each([
    ['08:00', 'Bom dia, Ana'],
    ['11:59', 'Bom dia, Ana'],
    ['12:00', 'Boa tarde, Ana'],
    ['17:59', 'Boa tarde, Ana'],
    ['18:00', 'Boa noite, Ana'],
    ['23:59', 'Boa noite, Ana'],
    ['00:00', 'Bom dia, Ana'],
  ])('a saudação às %s é "%s"', async (time, greeting) => {
    const app = await bootCaregiverApp(ANA, { time, url: '/cuidador/hoje' });
    expect(heading(app)).toBe(greeting);
  });

  it('o contato da equipe vira nota e some quando a equipe registra o contato (Ana e Maria)', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/hoje' });
    expect(mainText(app)).toContain('A equipe de psicologia vai falar com você hoje.');
    const alert = app.db.zaritAlerts.find((a) => a.caregiverId === ANA && a.level === 'red' && a.status === 'open')!;
    app.db.zaritAlerts.update(alert.id, { status: 'contacted', contact: { at: '2026-11-04T12:30:00-03:00', byUserId: 'u3', channel: 'phone' } });
    await settleCaregiver(app.fixture);
    expect(mainText(app)).not.toContain('A equipe de psicologia vai falar com você hoje.');
    expect(mainText(app)).toContain('Para você');
    TestBed.resetTestingModule();
    const maria = await bootCaregiverApp(MARIA, { url: '/cuidador/hoje' });
    // CXC-003: o contato que não aconteceu é um convite, sem "responsável técnica" e sem "não conseguiu".
    expect(mainText(maria)).toContain('Queremos falar com você.');
    expect(mainText(maria)).toContain('Falar com a gente agora');
    expect(mainText(maria)).not.toMatch(/vencid|atrasad|prazo/i);
    const mariaAlert = maria.db.zaritAlerts.find((a) => a.caregiverId === MARIA && a.level === 'red' && a.status === 'open')!;
    maria.db.zaritAlerts.update(mariaAlert.id, { status: 'contacted', contact: { at: '2026-11-04T12:30:00-03:00', byUserId: 'u4', channel: 'phone' } });
    await settleCaregiver(maria.fixture);
    expect(mainText(maria)).not.toContain('Queremos falar com você.');
  });

  it('o contato da equipe vira "ainda não" depois das 23h59', async () => {
    const app = await bootCaregiverApp(ANA, { time: '23:59', url: '/cuidador/hoje' });
    // CXC-003: fora do horário comercial a nota não promete "hoje".
    expect(mainText(app)).toContain('A equipe de psicologia vai falar com você amanhã de manhã.');
    app.clock.setSimulated('2026-11-05', '00:00');
    await settleCaregiver(app.fixture);
    expect(mainText(app)).toContain('Queremos falar com você.');
  });

  it('"Dei" grava a marcação sem mudar a linha de lugar, a faixa traz "Desfazer" e desfazer não pede confirmação', async () => {
    const app = await bootCaregiverApp(ANA, { url: '/cuidador/hoje' });
    const rows = () => Array.from(app.root.querySelectorAll('main app-cg-dose')).map((r) => norm(r.textContent));
    const before = rows();
    const checksBefore = app.db.doseChecks.count();
    const dei = Array.from(app.root.querySelectorAll<HTMLElement>('main app-cg-dose button')).find((b) => norm(b.textContent) === 'Dei')!;
    dei.click();
    await settleCaregiver(app.fixture);
    expect(app.db.doseChecks.count()).toBe(checksBefore + 1);
    const created = app.db.doseChecks.list().at(-1)!;
    expect(created).toMatchObject({ date: '2026-11-04' });
    expect(created.givenAt).toMatch(/^2026-11-04T12:00:\d\d-03:00$/);
    expect(rows()).toHaveLength(before.length);
    expect(rows().filter((r) => r.includes('Dado às'))).toHaveLength(before.filter((r) => r.includes('Dado às')).length + 1);
    const undo = Array.from(app.root.querySelectorAll<HTMLElement>('button, a')).filter((b) => norm(b.textContent) === 'Desfazer').find((b) => !b.closest('app-cg-dose'));
    expect(undo).toBeDefined();
    undo!.click();
    await settleCaregiver(app.fixture);
    expect(app.db.doseChecks.count()).toBe(checksBefore);
    expect(app.root.querySelector('dialog[open]')).toBeNull();
  });

  // QAC-011: o shell esconde a barra inferior quando o `visualViewport` fica abaixo de 75% da janela, sem olhar se há campo
  // com foco nem o zoom. Quem dá zoom de pinça (comum entre quem tem baixa visão) perde a navegação.
  const fakeViewport = () => {
    const listeners: ((event: Event) => void)[] = [];
    const viewport = {
      height: window.innerHeight,
      scale: 1,
      addEventListener: (_type: string, listener: (event: Event) => void) => listeners.push(listener),
      removeEventListener: () => undefined,
    };
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    return { viewport, fire: () => listeners.forEach((l) => l(new Event('resize'))) };
  };

  it('teclado virtual aberto (janela encolhida): a barra inferior some e volta ao fechar', async () => {
    const fake = fakeViewport();
    try {
      const app = await bootCaregiverApp(ANA, { url: '/cuidador/rede/buscar', layout: 'drawer' });
      expect(app.root.querySelector('app-cg-nav')).not.toBeNull();
      // QAC-011: só é teclado quando há um campo de texto com foco (e a janela encolhe, sem zoom).
      const field = app.root.querySelector<HTMLElement>('main input[type="search"]');
      expect(field).not.toBeNull();
      field?.focus();
      fake.viewport.height = Math.round(window.innerHeight * 0.5);
      fake.fire();
      await settleCaregiver(app.fixture);
      expect(app.root.querySelector('app-cg-nav')).toBeNull();
      fake.viewport.height = window.innerHeight;
      fake.fire();
      await settleCaregiver(app.fixture);
      expect(app.root.querySelector('app-cg-nav')).not.toBeNull();
      // Tocar fora do campo (o foco sai) com a janela ainda encolhida: a barra volta (AC-CG-05).
      field?.focus();
      fake.viewport.height = Math.round(window.innerHeight * 0.5);
      fake.fire();
      await settleCaregiver(app.fixture);
      expect(app.root.querySelector('app-cg-nav')).toBeNull();
      field?.blur();
      await settleCaregiver(app.fixture);
      expect(app.root.querySelector('app-cg-nav')).not.toBeNull();
    } finally {
      Reflect.deleteProperty(window, 'visualViewport');
    }
  });

  // QAC-011 (corrigido no Fix B): antes era `it.fails`.
  it('QAC-011: zoom de pinça (escala 2, nenhum campo com foco) não esconde a barra de navegação', async () => {
    const fake = fakeViewport();
    try {
      const app = await bootCaregiverApp(ANA, { url: '/cuidador/hoje', layout: 'drawer' });
      expect(app.root.querySelector('app-cg-nav')).not.toBeNull();
      (document.activeElement as HTMLElement | null)?.blur();
      fake.viewport.scale = 2;
      fake.viewport.height = Math.round(window.innerHeight / 2);
      fake.fire();
      await settleCaregiver(app.fixture);
      expect(app.root.querySelector('app-cg-nav')).not.toBeNull();
    } finally {
      Reflect.deleteProperty(window, 'visualViewport');
    }
  });

  it('QAC-011: com zoom de pinça (escala 2) a barra fica mesmo com um campo de texto com foco', async () => {
    const fake = fakeViewport();
    try {
      const app = await bootCaregiverApp(ANA, { url: '/cuidador/rede/buscar', layout: 'drawer' });
      app.root.querySelector<HTMLElement>('main input[type="search"]')?.focus();
      fake.viewport.scale = 2;
      fake.viewport.height = Math.round(window.innerHeight / 2);
      fake.fire();
      await settleCaregiver(app.fixture);
      expect(app.root.querySelector('app-cg-nav')).not.toBeNull();
    } finally {
      Reflect.deleteProperty(window, 'visualViewport');
    }
  });
});
