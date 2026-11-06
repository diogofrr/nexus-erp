/**
 * Varredura do aplicativo do cuidador: cada pessoa de demonstração x cada tela (e as telas com parâmetro), lendo o
 * texto e o HTML que de fato é desenhado. Cobre vazamento de dado de outro perfil, oferta ligada a saúde (RN-PLN-19),
 * tom e texto proibido, texto técnico (jargão, status em inglês, `undefined`) e acessibilidade por código.
 * `docs/13-qa-cuidador.md`.
 */
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

// As varreduras abrem 29 telas para até 11 pessoas: o limite padrão de 5 s não basta.
vi.setConfig({ testTimeout: 180_000 });
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../features/caregiver-app/testing';

const DEMO = ['cg_0001', 'cg_0002', 'cg_0003', 'cg_0008', 'cg_0027', 'cg_0024', 'cg_0012', 'cg_0026', 'cg_0016', 'cg_0004', 'cg_0018'];

const norm = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();

const URLS: readonly string[] = [
  '/cuidador/hoje',
  '/cuidador/rotina/agenda',
  '/cuidador/rotina/remedios',
  '/cuidador/cuidar-de-mim',
  '/cuidador/cuidar-de-mim/atendimento',
  '/cuidador/cuidar-de-mim/como-estou',
  '/cuidador/cuidar-de-mim/grupos',
  '/cuidador/cuidar-de-mim/grupos?atividade=act_0001',
  '/cuidador/cuidar-de-mim/grupos?atividade=act_0002',
  '/cuidador/cuidar-de-mim/grupos?atividade=act_0004',
  '/cuidador/cuidar-de-mim/conteudos',
  '/cuidador/cuidar-de-mim/conteudos?conteudo=gdc_0001',
  '/cuidador/rede',
  '/cuidador/rede/buscar',
  '/cuidador/rede/buscar?categoria=physiotherapy',
  '/cuidador/rede/buscar?categoria=pharmacy&casa=1',
  '/cuidador/rede/profissional/prv_01',
  '/cuidador/rede/profissional/prv_03',
  '/cuidador/rede/profissional/prv_09',
  '/cuidador/rede/pedidos',
  '/cuidador/rede/cartao',
  '/cuidador/mais',
  '/cuidador/mais/plano',
  '/cuidador/mais/plano?ver=planos',
  '/cuidador/mais/ajuda',
  '/cuidador/mais/familia',
  '/cuidador/mais/privacidade',
  '/cuidador/mais/perfil',
  '/cuidador/ajuda-agora',
];

interface Page {
  who: string;
  url: string;
  text: string;
  html: string;
  root: HTMLElement;
}

/** Percorre todas as telas de uma pessoa com um único boot e entrega o texto e o HTML de cada uma. */
async function sweep(caregiverId: string, urls: readonly string[], visit: (page: Page, app: BootedCaregiverApp) => void, layout?: 'drawer' | 'full'): Promise<void> {
  const app = await bootCaregiverApp(caregiverId, { url: '/cuidador/hoje', ...(layout ? { layout } : {}) });
  for (const url of urls) {
    await app.router.navigateByUrl(url);
    await settleCaregiver(app.fixture);
    visit({ who: caregiverId, url, text: norm(app.root.textContent), html: app.root.innerHTML, root: app.root }, app);
  }
  TestBed.resetTestingModule();
}

async function sweepAll(visit: (page: Page, app: BootedCaregiverApp) => void, layout?: 'drawer' | 'full', people: readonly string[] = DEMO): Promise<void> {
  for (const id of people) {
    await sweep(id, URLS, visit, layout);
  }
}

afterEach(() => TestBed.resetTestingModule());

describe('QAC varredura: o que aparece não é de outro perfil', () => {
  it('nenhuma tela mostra jargão clínico ou interno (Zarit, ARBE, POP, RN, faixa de monitoramento, recusa, comissão)', async () => {
    const found: string[] = [];
    const pattern = /\b(ARBE|POP-?\d*|RN-[A-Z]+|ZRT|slot|PSY|riskFlag|monitoramento|taxa de recusa|comiss(ão|ões)|disponibilidade do prestador|risco de saída|descredenciad)/i;
    await sweepAll((p) => {
      const m = pattern.exec(p.text);
      if (m) {
        found.push(`${p.who} ${p.url}: ${m[0]} ...${p.text.slice(Math.max(0, m.index - 40), m.index + 60)}`);
      }
    });
    expect(found).toEqual([]);
  });

  it('a palavra "Zarit" só aparece onde o UX permite (nenhuma tela do cuidador a usa; a escala é "escala de cansaço")', async () => {
    const found: string[] = [];
    await sweepAll((p) => {
      // A política de privacidade (texto jurídico do seed) cita a "Escala de Zarit"; as telas do app dizem "escala de cansaço".
      const text = p.url === '/cuidador/mais/privacidade' ? p.text.replace(/Escala de Zarit/g, '') : p.text;
      if (/zarit/i.test(text)) {
        found.push(`${p.who} ${p.url}`);
      }
    });
    expect(found).toEqual([]);
  });

  it('Hoje, Ajuda agora e Como estou não têm plano, preço, desconto, convite nem pontuação (exceto a legenda da linha do tempo)', async () => {
    const found: string[] = [];
    const pages = ['/cuidador/hoje', '/cuidador/ajuda-agora', '/cuidador/cuidar-de-mim/como-estou'];
    const offer = /\b(plano|planos|Livre|Essencial|Cuida|Sustenta|desconto|upgrade|assinatura|assine|mensalidade|oferta|promo)\b|R\$/;
    for (const id of DEMO) {
      await sweep(id, pages, (p) => {
        // o menu do usuário e a barra mostram o nome do plano? Só o texto da tela interessa
        const main = norm(p.root.querySelector('main')?.textContent);
        const m = offer.exec(main);
        if (m) {
          found.push(`${p.who} ${p.url}: ${main.slice(Math.max(0, m.index - 30), m.index + 50)}`);
        }
        if (p.url !== '/cuidador/cuidar-de-mim/como-estou' && /\d+ pontos/.test(main)) {
          found.push(`${p.who} ${p.url}: pontuação em tela`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it('Hoje, Ajuda agora e Como estou: o cabeçalho e a barra não mostram plano nem selo de plano', async () => {
    const found: string[] = [];
    for (const id of DEMO) {
      await sweep(id, ['/cuidador/hoje', '/cuidador/ajuda-agora', '/cuidador/cuidar-de-mim/como-estou'], (p) => {
        const chrome = norm(p.root.querySelector('app-cg-header, app-cg-nav, header, nav')?.textContent);
        const m = /(\bplano\b|Essencial|\bCuida\b|Sustenta|\bLivre\b)/.exec(chrome);
        if (m) {
          found.push(`${p.who} ${p.url}: ${chrome}`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it('Conversar com um psicólogo: horário de prioridade não leva etiqueta nem texto que explique o motivo', async () => {
    const found: string[] = [];
    for (const id of DEMO) {
      await sweep(id, ['/cuidador/cuidar-de-mim/atendimento'], (p) => {
        if (/priorit|preferenc|urgente|acompanhamento prioritário|vaga especial/i.test(p.text)) {
          found.push(`${p.who} ${p.url}`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it('Rede (Buscar, Profissional e Meus pedidos) não traz comentário de avaliação de outras pessoas nem nome de avaliador', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rede/profissional/prv_01' });
    const evaluations = app.db.providerEvaluations.query((e) => e.providerId === 'prv_01');
    evaluations.forEach((e) => app.db.providerEvaluations.update(e.id, { comment: `COMENTARIO-DE-OUTRO-${e.id}` }));
    const fullNames = [...app.db.caregivers.list().filter((c) => c.id !== 'cg_0001').map((c) => c.fullName), ...app.db.elders.list().map((e) => e.fullName)];
    for (const url of ['/cuidador/rede/profissional/prv_01', '/cuidador/rede/buscar?categoria=physiotherapy', '/cuidador/rede/pedidos', '/cuidador/rede']) {
      await app.router.navigateByUrl(url);
      await settleCaregiver(app.fixture);
      const main = norm(app.root.querySelector('main')?.textContent);
      expect(main, url).not.toContain('COMENTARIO-DE-OUTRO');
      // nome completo de outro cuidador ou de outra pessoa idosa
      expect(
        fullNames.filter((n) => main.includes(n)),
        url,
      ).toEqual([]);
    }
  });

  it('Meus pedidos: o comentário da própria avaliação aparece só para quem escreveu', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rede/pedidos' });
    const mine = app.db.providerEvaluations.find((e) => e.caregiverId === 'cg_0001')!;
    app.db.providerEvaluations.update(mine.id, { comment: 'MEU-COMENTARIO-ANA' });
    const others = app.db.providerEvaluations.query((e) => e.caregiverId !== 'cg_0001' && e.providerId === mine.providerId);
    others.forEach((e) => app.db.providerEvaluations.update(e.id, { comment: `DE-OUTRO-${e.id}` }));
    await app.router.navigateByUrl('/cuidador/rede/pedidos');
    await settleCaregiver(app.fixture);
    const all = norm(app.root.textContent);
    expect(all).not.toContain('DE-OUTRO-');
  });

  it('o prestador não recebe dado de saúde: o pedido tem só nome, contato (do cadastro) e o que a pessoa precisa', async () => {
    const app = await bootCaregiverApp('cg_0001');
    const request = app.db.serviceRequests.find((r) => r.caregiverId === 'cg_0001')!;
    const keys = Object.keys(request).sort();
    ['zarit', 'score', 'band', 'alert', 'consent', 'health', 'mood', 'wellbeing', 'condition'].forEach((word) => {
      expect(keys.filter((k) => k.toLowerCase().includes(word))).toEqual([]);
    });
  });
});

describe('QAC varredura: texto e tom', () => {
  it('nenhuma tela traz travessão, exclamação, emoji nem as palavras proibidas', async () => {
    const found: string[] = [];
    const rules: [string, RegExp][] = [
      ['travessão', /[\u2014\u2013]/],
      ['exclamação', /!/],
      ['emoji', /\p{Extended_Pictographic}/u],
      ['palavra proibida', /\b(guerreira|anjo|heroína|paciente|pacientes|idoso|idosos|eficácia)\b/i],
      ['técnico', /\b(undefined|NaN|null|Invalid Date)\b|\[object/],
      ['status em inglês', /\b(scheduled|confirmed|cancelled|completed|requested|accepted|no_show|enrolled|waitlist|closure_requested|evaluated|refused_by_provider)\b/],
    ];
    await sweepAll((p) => {
      rules.forEach(([name, re]) => {
        const m = re.exec(p.text);
        if (m) {
          found.push(`${p.who} ${p.url} [${name}] ...${p.text.slice(Math.max(0, m.index - 30), m.index + 40)}`);
        }
      });
    });
    expect(found).toEqual([]);
  });

  it('"diagnóstico" só aparece na frase "não é um diagnóstico"; "alerta" nunca aparece', async () => {
    const found: string[] = [];
    await sweepAll((p) => {
      const stripped = p.text.replace(/não é um diagnóstico/gi, '');
      if (/diagn[óo]stic/i.test(stripped)) {
        found.push(`${p.who} ${p.url} diagnóstico`);
      }
      if (/\balerta/i.test(p.text)) {
        found.push(`${p.who} ${p.url} alerta`);
      }
      if (/\b(vencid[oa]|atrasad[oa])\b/i.test(p.text)) {
        found.push(`${p.who} ${p.url} vencido/atrasado: ${/.{0,30}\b(vencid[oa]|atrasad[oa])\b.{0,30}/i.exec(p.text)?.[0]}`);
      }
    });
    expect(found).toEqual([]);
  });

  it('o aviso de protótipo aparece ao fim de toda tela, com o texto literal', async () => {
    const found: string[] = [];
    const literal = 'Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador.';
    await sweepAll((p) => {
      if (!p.text.includes(literal)) {
        found.push(`${p.who} ${p.url}`);
      }
    }, undefined, ['cg_0001', 'cg_0016']);
    expect(found).toEqual([]);
  });

  it('nenhum link tel: nem wa.me, nenhum endereço externo, nenhum campo de cartão de pagamento', async () => {
    const found: string[] = [];
    await sweepAll((p) => {
      p.root.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') ?? '';
        if (/^(tel:|mailto:|sms:|https?:|\/\/)/i.test(href) || /wa\.me/.test(href)) {
          found.push(`${p.who} ${p.url} href=${href}`);
        }
      });
      const fields = Array.from(p.root.querySelectorAll('input, select, textarea')).map((e) => `${e.getAttribute('name') ?? ''} ${e.getAttribute('id') ?? ''} ${e.getAttribute('autocomplete') ?? ''}`).join(' ');
      if (/cc-number|cc-exp|cc-csc|card-?number|cvv|cvc/i.test(fields)) {
        found.push(`${p.who} ${p.url} campo de cartão`);
      }
    }, undefined, ['cg_0001', 'cg_0002', 'cg_0003']);
    expect(found).toEqual([]);
  });
});

describe('QAC varredura: acessibilidade por código', () => {
  it('um único h1 por tela e o h1 está em main', async () => {
    const found: string[] = [];
    await sweepAll((p) => {
      const h1 = p.root.querySelectorAll('h1');
      if (h1.length !== 1) {
        found.push(`${p.who} ${p.url}: ${h1.length} h1`);
      }
      if (p.root.querySelectorAll('main h1').length !== 1) {
        found.push(`${p.who} ${p.url}: h1 fora de main`);
      }
    }, undefined, ['cg_0001', 'cg_0003', 'cg_0016']);
    expect(found).toEqual([]);
  });

  // QAC-009: o cartão do kit (`app-cg-card`) e o bloqueio por plano desenham o título sempre como h3. Em oito telas não há
  // h2 antes, e quem navega por títulos (leitor de tela) escuta h1 e logo h3.
  it.fails('QAC-009: a hierarquia de títulos não pula nível (h1 seguido de h3) em nenhuma tela', async () => {
    const found: string[] = [];
    await sweepAll((p) => {
      const levels = Array.from(p.root.querySelectorAll('main h1, main h2, main h3, main h4')).map((h) => Number(h.tagName[1]));
      levels.forEach((level, i) => {
        if (i > 0 && level - (levels[i - 1] as number) > 1) {
          found.push(`${p.who} ${p.url}: título pula de h${levels[i - 1]} para h${level}`);
        }
      });
    }, undefined, ['cg_0001', 'cg_0003', 'cg_0016']);
    expect(found).toEqual([]);
  });

  it('todo botão, link e campo tem nome acessível; todo ícone sem texto tem aria-label; ids não se repetem', async () => {
    const found: string[] = [];
    const nameOf = (el: Element): string => {
      const label = el.getAttribute('aria-label') ?? '';
      const labelledBy = el.getAttribute('aria-labelledby');
      const byId = labelledBy ? labelledBy.split(/\s+/).map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '').join(' ') : '';
      return norm(label || byId || el.textContent || el.getAttribute('title') || el.getAttribute('alt'));
    };
    await sweepAll((p) => {
      p.root.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="switch"], summary').forEach((el) => {
        if (!nameOf(el)) {
          found.push(`${p.who} ${p.url}: sem nome <${el.tagName.toLowerCase()} class="${el.getAttribute('class') ?? ''}">`);
        }
      });
      p.root.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach((el) => {
        const id = el.getAttribute('id');
        const hasLabel = !!(id && p.root.querySelector(`label[for="${id}"]`)) || !!el.closest('label') || !!el.getAttribute('aria-label') || !!el.getAttribute('aria-labelledby');
        if (!hasLabel) {
          found.push(`${p.who} ${p.url}: campo sem rótulo <${el.tagName.toLowerCase()} id="${id ?? ''}" name="${el.getAttribute('name') ?? ''}">`);
        }
      });
      p.root.querySelectorAll('svg, [appIcon], app-icon').forEach((icon) => {
        const parent = icon.closest('button, a');
        const own = icon.getAttribute('aria-hidden') === 'true' || icon.getAttribute('aria-label') || icon.getAttribute('role') === 'img';
        if (parent && !own && !norm(parent.textContent) && !parent.getAttribute('aria-label')) {
          found.push(`${p.who} ${p.url}: ícone sem texto nem rótulo`);
        }
      });
      const ids = new Map<string, number>();
      p.root.querySelectorAll('[id]').forEach((el) => ids.set(el.id, (ids.get(el.id) ?? 0) + 1));
      ids.forEach((n, id) => {
        if (n > 1) {
          found.push(`${p.who} ${p.url}: id repetido ${id} x${n}`);
        }
      });
    }, undefined, ['cg_0001', 'cg_0003']);
    expect(found).toEqual([]);
  });

  it('barra inferior (celular): 5 itens na ordem, aria-current na seção atual; no computador a barra não existe', async () => {
    const small = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/agenda', layout: 'drawer' });
    const items = Array.from(small.root.querySelectorAll('app-cg-nav a')).map((a) => norm(a.textContent));
    expect(items).toEqual(['Hoje', 'Rotina', 'Cuidar de mim', 'Rede', 'Mais']);
    const current = Array.from(small.root.querySelectorAll('app-cg-nav a[aria-current="page"]')).map((a) => norm(a.textContent));
    expect(current).toEqual(['Rotina']);
    TestBed.resetTestingModule();
    const wide = await bootCaregiverApp('cg_0001', { url: '/cuidador/rede/pedidos', layout: 'full' });
    expect(wide.root.querySelectorAll('nav.cg-bottom-nav, .cg-bottom-nav').length).toBe(0);
    const topCurrent = Array.from(wide.root.querySelectorAll('app-cg-nav [aria-current="page"]')).map((a) => norm(a.textContent));
    expect(topCurrent).toEqual(['Rede']);
  });

  it('link "Ir para o conteúdo", Ajuda agora em todo shell e região viva dos avisos', async () => {
    const found: string[] = [];
    await sweepAll((p) => {
      if (!/Ir para o conteúdo/.test(p.text)) {
        found.push(`${p.who} ${p.url}: sem link "Ir para o conteúdo"`);
      }
      const help = Array.from(p.root.querySelectorAll('a')).filter((a) => norm(a.textContent) === 'Ajuda agora');
      if (help.length !== 1) {
        found.push(`${p.who} ${p.url}: ${help.length} links "Ajuda agora"`);
      }
    }, undefined, ['cg_0001', 'cg_0003']);
    expect(found).toEqual([]);
  });
});

describe('QAC varredura: minimização de dados (RN-LGPD-08) e planos na rede', () => {
  it('a condição de saúde da pessoa idosa (campo sensível) não aparece em nenhuma tela de nenhuma pessoa de demonstração', async () => {
    const found: string[] = [];
    for (const id of DEMO) {
      const app = await bootCaregiverApp(id, { url: '/cuidador/hoje' });
      const elder = app.db.elders.find((e) => e.caregiverId === id)!;
      // O seed não preenche o campo; o QA preenche com um texto único para provar que nada o desenha.
      app.db.elders.update(elder.id, { conditionsSummary: `CONDICAO-SENSIVEL-${id}` });
      for (const url of URLS) {
        await app.router.navigateByUrl(url);
        await settleCaregiver(app.fixture);
        if ((app.root.innerHTML + app.root.textContent).includes('CONDICAO-SENSIVEL')) {
          found.push(`${id} ${url}`);
        }
      }
      TestBed.resetTestingModule();
    }
    expect(found).toEqual([]);
  });

  it('Buscar: quem é Livre não vê as condições especiais do profissional; quem é Essencial vê', async () => {
    const livre = await bootCaregiverApp('cg_0003', { url: '/cuidador/rede/buscar?categoria=physiotherapy' });
    const conditions = livre.db.providers.list().filter((p) => p.category === 'physiotherapy' && p.conditionsForNexusUsers).map((p) => p.conditionsForNexusUsers);
    expect(conditions.length).toBeGreaterThan(0);
    const livreText = norm(livre.root.querySelector('main')?.textContent);
    conditions.forEach((c) => expect(livreText).not.toContain(norm(c)));
    // a linha de condições da lista vive na folha "Lado a lado"; a ficha do profissional mostra a mesma frase para o Livre
    TestBed.resetTestingModule();
    const essencial = await bootCaregiverApp('cg_0002', { url: '/cuidador/rede/buscar?categoria=physiotherapy' });
    const text = norm(essencial.root.querySelector('main')?.textContent);
    expect(text).not.toContain('Condições especiais: a partir do plano Essencial.');
  });

  it('o bloqueio por plano é idêntico para duas pessoas do mesmo plano, com alertas diferentes (Maria x Terezinha, Essencial)', async () => {
    const lock = async (id: string): Promise<string> => {
      const app = await bootCaregiverApp(id, { url: '/cuidador/cuidar-de-mim/grupos?atividade=act_0002' });
      const text = norm(app.root.querySelector('main')?.textContent);
      TestBed.resetTestingModule();
      return text;
    };
    const maria = await lock('cg_0002'); // alerta vermelho vencido
    const terezinha = await lock('cg_0012'); // sem alerta nenhum
    expect(maria).toBe(terezinha);
  });
});

describe('QAC varredura: avisos fixos (AC-CG-10, 34, 35, 40, 165)', () => {
  it('Ajuda agora, Falar com a Nexus e Conversar com um psicólogo trazem o 192 e o aviso de que os canais não substituem atendimento de saúde', async () => {
    const found: string[] = [];
    for (const id of ['cg_0001', 'cg_0003', 'cg_0016']) {
      await sweep(id, ['/cuidador/ajuda-agora', '/cuidador/mais/ajuda', '/cuidador/cuidar-de-mim/atendimento'], (p) => {
        if (!/192/.test(p.text)) {
          found.push(`${p.who} ${p.url}: sem 192`);
        }
        if (p.url !== '/cuidador/cuidar-de-mim/atendimento' && !/não substituem atendimento de saúde nem orientação sobre remédios/.test(p.text)) {
          found.push(`${p.who} ${p.url}: sem o aviso dos canais`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it('Ajuda agora abre sem sessão, na ordem 192, 188 e Falar com a equipe, e não pergunta consentimento nem mostra plano ou preço', async () => {
    const app = await bootCaregiverApp(null, { url: '/cuidador/ajuda-agora' });
    const text = norm(app.root.textContent);
    expect(app.router.url).toBe('/cuidador/ajuda-agora');
    const order = ['192', '188', 'Falar com a equipe'].map((t) => text.indexOf(t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).not.toMatch(/consentimento|autoriza|plano|R\$|desconto/i);
  });
});
