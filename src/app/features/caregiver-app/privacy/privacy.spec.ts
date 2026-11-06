import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { DataSubjectRequestService } from '@core/privacy';
import { SubjectRightsService } from '@core/privacy/subject-rights.service';
import { TEST_DOWNLOADS } from '@core/testing/test-helpers';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { daysLeftText } from './state/privacy-copy';
import { ROUTES } from './privacy.routes';

/**
 * Privacidade e meus dados (C21, AC-CG-173 a 184): autorizações independentes, retirar com a folha de efeito, cópia dos
 * dados, eliminação com o que fica guardado, retirar o pedido, com quem compartilhamos e a política.
 */
const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Área privacy (Privacidade e meus dados)', () => {
  let app: BootedCaregiverApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null => app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] => Array.from(app.root.querySelectorAll<T>(selector));
  const flush = (): Promise<void> => settleCaregiver(app.fixture);
  const click = async (el: Element | null | undefined): Promise<void> => {
    if (!el) {
      throw new Error('elemento não encontrado');
    }
    (el as HTMLElement).click();
    await flush();
  };
  const row = (title: string): HTMLElement | undefined =>
    all('.cg-row').find((r) => text(r.querySelector('.cg-row__title')) === title);
  const sheet = (heading: string): HTMLElement => {
    const found = all('app-cg-sheet').find((s) => text(s.querySelector('.cg-sheet__title')) === heading);
    if (!found) {
      throw new Error(`folha não encontrada: ${heading}`);
    }
    return found;
  };
  const sheetButton = (heading: string, label: string): HTMLButtonElement | undefined =>
    Array.from(sheet(heading).querySelectorAll<HTMLButtonElement>('button')).find((b) => text(b) === label);
  const isOpen = (heading: string): boolean => sheet(heading).querySelector('dialog')?.hasAttribute('open') ?? false;
  const boot = async (id: string, extra: { time?: string } = {}): Promise<void> => {
    app = await bootCaregiverApp(id, { url: '/cuidador/mais/privacidade', ...extra });
  };

  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  it('abre /cuidador/mais/privacidade com o título e o h1', async () => {
    await boot('cg_0001');
    expect(app.router.url).toBe('/cuidador/mais/privacidade');
    expect(text(q('main h1'))).toBe('Privacidade e meus dados');
    expect(document.title).toContain('Privacidade e meus dados');
    expect(text(q('.cg-page-header__desc'))).toBe(
      'Você decide o que a Nexus pode fazer com os seus dados. Pode mudar quando quiser. O plano Livre continua em qualquer caso.',
    );
  });

  describe('Minhas autorizações', () => {
    it('AC-CG-173: lista as autorizações independentes, cada uma com o estado em texto e a data', async () => {
      await boot('cg_0001');
      const titles = all('[data-role="consents"] .cg-row__title').map(text);
      expect(titles.slice(0, 5)).toEqual([
        'Dados de saúde para o acompanhamento',
        'Resultados sem o seu nome',
        'Compartilhar com a família',
        'Imagem e depoimento',
        'Contato por WhatsApp',
      ]);
      all('[data-role="consents"] .cg-row__desc').forEach((d) => {
        expect(text(d)).toMatch(/^Você (autorizou( em \d{2}\/\d{2})?|não autorizou( desde \d{2}\/\d{2})?|ainda não decidiu)$/);
      });
      // Nada vem pré-marcado: o estado vem do que foi registrado no núcleo.
      const states = all('[data-role="consents"] .cg-row__desc').map(text);
      app.context.consents().filter((c) => c.key !== 'pilot_tcle').forEach((c, i) => {
        const expected = { granted: 'Você autorizou', refused: 'Você não autorizou', revoked: 'Você não autorizou', pending: 'Você ainda não decidiu' }[c.status];
        expect(states[i]?.startsWith(expected)).toBe(true);
      });
    });

    it('a autorização do piloto só aparece para quem já decidiu sobre ela (Lourdes, piloto)', async () => {
      await boot('cg_0001');
      const ana = all('[data-role="consents"] .cg-row__title').map(text);
      expect(ana.includes('Piloto da Nexus')).toBe(app.context.consentStatus('pilot_tcle') !== 'pending' || !!app.context.caregiver()?.isPilot);
      TestBed.resetTestingModule();
      await boot('cg_0024');
      expect(all('[data-role="consents"] .cg-row__title').map(text)).toContain('Piloto da Nexus');
      expect(all('[data-role="consents"] .cg-row')).toHaveLength(6);
    });

    it('tocar numa autorização abre a folha com o texto simples, o estado e as ações; "Ver histórico" não tem editar nem apagar', async () => {
      await boot('cg_0001');
      await click(row('Compartilhar com a família'));
      expect(isOpen('Compartilhar com a família')).toBe(true);
      const body = text(sheet('Compartilhar com a família'));
      expect(body).toContain('Podemos compartilhar informações da pessoa idosa com a sua família?');
      expect(body).toContain('Só as pessoas que você escolher.');
      expect(q('[data-role="consent-state"]')?.textContent).toMatch(/Você autorizou/);
      expect(sheetButton('Compartilhar com a família', 'Retirar a autorização')).toBeDefined();
      expect(sheetButton('Compartilhar com a família', 'Voltar')).toBeDefined();
      await click(sheet('Compartilhar com a família').querySelector('button[aria-expanded]'));
      const history = q('[data-role="history"]');
      expect(history).not.toBeNull();
      expect(text(history)).toMatch(/Você autorizou/);
      expect(text(history)).toMatch(/termo versão \d/);
      expect(sheet('Compartilhar com a família').querySelectorAll('[data-role="history"] button, [data-role="history"] a')).toHaveLength(0);
      expect(text(sheet('Compartilhar com a família')).toLowerCase()).not.toContain('apagar');
      expect(text(sheet('Compartilhar com a família')).toLowerCase()).not.toContain('editar');
    });

    it('AC-CG-174: retirar a de saúde mostra o efeito com o foco em Voltar e, ao confirmar, grava o evento "revoked" e pausa o acompanhamento', async () => {
      await boot('cg_0001');
      const eventsBefore = app.db.consentEvents.size();
      await click(row('Dados de saúde para o acompanhamento'));
      await click(sheetButton('Dados de saúde para o acompanhamento', 'Retirar a autorização'));
      expect(isOpen('Retirar a autorização?')).toBe(true);
      expect(isOpen('Dados de saúde para o acompanhamento')).toBe(false);
      expect(text(q('[data-role="revoke-effect"]'))).toBe(
        'Ao retirar: a escala de cansaço e o acompanhamento ficam pausados. O que já foi registrado fica guardado por 5 anos, como a norma do conselho pede. O plano Livre, a agenda e os remédios continuam. Você pode autorizar de novo quando quiser.',
      );
      expect(text(document.activeElement)).toBe('Voltar');
      expect(app.db.consentEvents.size()).toBe(eventsBefore);
      await click(sheetButton('Retirar a autorização?', 'Retirar a autorização'));
      expect(app.db.consentEvents.size()).toBe(eventsBefore + 1);
      const last = app.db.consentEvents.all().at(-1);
      expect(last).toMatchObject({ caregiverId: 'cg_0001', key: 'health_data', status: 'revoked', channel: 'app', registeredByUserId: 'cg_0001' });
      expect(app.db.caregivers.require('cg_0001').status).toBe('paused_by_consent_revocation');
      expect(app.context.healthConsent()).toBe(false);
      expect(app.context.staffContact()).toBe('none');
      expect(isOpen('Retirar a autorização?')).toBe(false);
      expect(text(row('Dados de saúde para o acompanhamento')?.querySelector('.cg-row__desc'))).toMatch(/^Você não autorizou desde \d{2}\/\d{2}$/);
      // Hoje e Como estou deixam de mostrar blocos de saúde (o humor some).
      await app.router.navigateByUrl('/cuidador/hoje');
      await flush();
      expect(all('.cg-mood')).toHaveLength(0);
      await app.router.navigateByUrl('/cuidador/cuidar-de-mim/como-estou');
      await flush();
      expect(all('.cg-mood')).toHaveLength(0);
      expect(text(q('main'))).toContain('O acompanhamento está pausado');
    });

    it('"Voltar" na folha de efeito não grava nada', async () => {
      await boot('cg_0001');
      const eventsBefore = app.db.consentEvents.size();
      await click(row('Dados de saúde para o acompanhamento'));
      await click(sheetButton('Dados de saúde para o acompanhamento', 'Retirar a autorização'));
      await click(sheetButton('Retirar a autorização?', 'Voltar'));
      expect(isOpen('Retirar a autorização?')).toBe(false);
      expect(app.db.consentEvents.size()).toBe(eventsBefore);
      expect(app.context.healthConsent()).toBe(true);
    });

    it('AC-CG-175: retirar imagem, WhatsApp, resultados sem o seu nome ou família não muda nenhuma outra autorização nem o plano', async () => {
      const keys: [string, string][] = [
        ['Imagem e depoimento', 'image_testimony'],
        ['Contato por WhatsApp', 'whatsapp_contact'],
        ['Resultados sem o seu nome', 'people_analytics'],
        ['Compartilhar com a família', 'family_sharing'],
      ];
      for (const [title, key] of keys) {
        await boot('cg_0001');
        const before = app.context.consents().map((c) => `${c.key}:${c.status}`);
        if (app.context.consentStatus(key as 'image_testimony') !== 'granted') {
          app.db.consents.update(app.db.consents.find((c) => c.caregiverId === 'cg_0001' && c.key === key)!.id, { status: 'granted' });
          await flush();
        }
        const planBefore = app.context.planId();
        await click(row(title));
        await click(sheetButton(title, 'Retirar a autorização'));
        await click(sheetButton('Retirar a autorização?', 'Retirar a autorização'));
        const after = app.context.consents().map((c) => `${c.key}:${c.status}`);
        const changed = after.filter((v, i) => v !== before[i]);
        expect(changed).toEqual([`${key}:revoked`]);
        expect(app.context.planId()).toBe(planBefore);
        expect(app.db.caregivers.require('cg_0001').status).toBe('active');
        TestBed.resetTestingModule();
      }
    });

    it('AC-CG-176: Sônia (saúde retirada) vê "Você não autorizou" e, ao Autorizar de novo, grava "granted" e reativa o cadastro', async () => {
      await boot('cg_0016');
      expect(text(row('Dados de saúde para o acompanhamento')?.querySelector('.cg-row__desc'))).toMatch(/^Você não autorizou/);
      await click(row('Dados de saúde para o acompanhamento'));
      expect(sheetButton('Dados de saúde para o acompanhamento', 'Retirar a autorização')).toBeUndefined();
      await click(sheetButton('Dados de saúde para o acompanhamento', 'Autorizar de novo'));
      const last = app.db.consentEvents.all().at(-1);
      expect(last).toMatchObject({ caregiverId: 'cg_0016', key: 'health_data', status: 'granted', channel: 'app', registeredByUserId: 'cg_0016' });
      expect(app.context.healthConsent()).toBe(true);
      expect(app.db.caregivers.require('cg_0016').status).toBe('active');
    });

    it('AC-CG-177: o histórico mostra autorizou, retirou e autorizou de novo, com a versão do termo', async () => {
      await boot('cg_0001');
      const title = 'Contato por WhatsApp';
      await click(row(title));
      await click(sheetButton(title, 'Retirar a autorização'));
      await click(sheetButton('Retirar a autorização?', 'Retirar a autorização'));
      await click(row(title));
      await click(sheetButton(title, 'Autorizar de novo'));
      await click(row(title));
      await click(sheet(title).querySelector('button[aria-expanded]'));
      const labels = all('[data-role="history"] li').map((li) => text(li.querySelector('span')));
      expect(labels).toEqual(['Você autorizou', 'Você retirou a autorização', 'Você autorizou']);
      all('[data-role="history"] li small').forEach((s) => expect(text(s)).toMatch(/^\d{2}\/\d{2}\/\d{4}, termo versão \d/));
    });

    it('quem ainda não decidiu escolhe entre Autorizar e Não autorizar, de peso igual', async () => {
      await boot('cg_0001');
      const pendingKey = app.context.consents().find((c) => c.status === 'pending' && c.key !== 'pilot_tcle')?.key;
      if (!pendingKey) {
        app.db.consents.update(app.db.consents.find((c) => c.caregiverId === 'cg_0001' && c.key === 'image_testimony')!.id, { status: 'pending' });
        await flush();
      }
      const key = app.context.consents().find((c) => c.status === 'pending' && c.key !== 'pilot_tcle')?.key;
      expect(key).toBeDefined();
      const title = { health_data: 'Dados de saúde para o acompanhamento', people_analytics: 'Resultados sem o seu nome', family_sharing: 'Compartilhar com a família', image_testimony: 'Imagem e depoimento', whatsapp_contact: 'Contato por WhatsApp', pilot_tcle: 'Piloto da Nexus' }[key!];
      await click(row(title));
      expect(text(q('[data-role="consent-state"]'))).toBe('Você ainda não decidiu');
      expect(sheetButton(title, 'Autorizar')).toBeDefined();
      await click(sheetButton(title, 'Não autorizar'));
      expect(app.context.consentStatus(key!)).toBe('refused');
      expect(app.db.consentEvents.all().at(-1)).toMatchObject({ key, status: 'refused', channel: 'app' });
    });
  });

  describe('Meus dados', () => {
    it('lista as cinco ações; "Corrigir meus dados" leva a Meu perfil', async () => {
      await boot('cg_0001');
      expect(all('[data-role="data-actions"] .cg-row__title').map(text)).toEqual([
        'Pedir uma cópia dos meus dados',
        'Corrigir meus dados',
        'Pedir eliminação dos meus dados',
        'Com quem os meus dados foram compartilhados',
        'Política de privacidade e contato do encarregado',
      ]);
      expect(row('Corrigir meus dados')?.getAttribute('href')).toBe('/cuidador/mais/perfil');
    });

    it('AC-CG-178: pedir a cópia grava a solicitação com protocolo e 15 dias; mostra "Faltam 15 dias" e, depois de concluída, "Baixar o arquivo"', async () => {
      await boot('cg_0004');
      const before = app.db.dataSubjectRequests.size();
      await click(row('Pedir uma cópia dos meus dados'));
      expect(text(q('[data-role="copy-text"]'))).toBe('A equipe prepara o arquivo com os seus dados e avisa você em até 15 dias.');
      await click(sheetButton('Pedir uma cópia dos meus dados', 'Pedir a cópia'));
      expect(app.db.dataSubjectRequests.size()).toBe(before + 1);
      const created = app.db.dataSubjectRequests.all().at(-1)!;
      expect(created).toMatchObject({ caregiverId: 'cg_0004', type: 'access', status: 'open', openedAt: '2026-11-04', dueAt: '2026-11-19', channel: 'app' });
      const card = q('[data-role="request"]');
      expect(text(card)).toContain('Cópia dos meus dados');
      // CXC-009: o código interno do pedido não aparece na tela; "Faltam 15 dias" diz o que falta.
      expect(text(card)).toContain('Pedido feito em 04/11.');
      expect(text(card)).not.toContain(created.protocol);
      expect(text(q('[data-role="request-status"]'))).toBe('Faltam 15 dias para a resposta');
      expect(all('.cg-note--error, .btn--danger-quiet, [class*="error"]').filter((e) => card?.contains(e))).toHaveLength(0);
      expect(Array.from(card?.querySelectorAll('button') ?? []).some((b) => text(b) === 'Baixar o arquivo')).toBe(false);

      // A equipe conclui: aparece o botão de baixar, que entrega o arquivo só do titular.
      TestBed.inject(DataSubjectRequestService).complete(created.id, 'Arquivo entregue ao titular.');
      await flush();
      expect(text(q('[data-role="request-status"]'))).toMatch(/^Concluído em \d{2}\/\d{2}\/\d{4}$/);
      const downloadsBefore = TEST_DOWNLOADS.length;
      await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Baixar o arquivo'));
      expect(TEST_DOWNLOADS.length).toBe(downloadsBefore + 1);
      expect(TEST_DOWNLOADS.at(-1)?.fileName).toMatch(/^meus-dados-CUI-\d{4}-2026-11-04\.json$/);
    });

    it('AC-CG-182: pedido repetido mostra "Você já tem um pedido de cópia em andamento." (sem o código) e não cria outro', async () => {
      await boot('cg_0004');
      await click(row('Pedir uma cópia dos meus dados'));
      await click(sheetButton('Pedir uma cópia dos meus dados', 'Pedir a cópia'));
      const protocol = app.db.dataSubjectRequests.all().at(-1)!.protocol;
      const size = app.db.dataSubjectRequests.size();
      await click(row('Pedir uma cópia dos meus dados'));
      expect(text(sheet('Pedir uma cópia dos meus dados').querySelector('[data-role="duplicate"]'))).toBe(
        'Você já tem um pedido de cópia em andamento.',
      );
      expect(sheetButton('Pedir uma cópia dos meus dados', 'Pedir a cópia')).toBeUndefined();
      expect(app.db.dataSubjectRequests.size()).toBe(size);
    });

    it('AC-CG-179: a eliminação mostra "Será eliminado" e "Ficará guardado e sem uso", exige a caixa e só então liga o botão; a pessoa continua usando o app', async () => {
      await boot('cg_0003');
      const messages = app.db.messages.query((m) => m.caregiverId === 'cg_0003').length;
      await click(row('Pedir eliminação dos meus dados'));
      const s = sheet('Pedir eliminação dos meus dados');
      expect(text(s.querySelector('#priv-erase'))).toBe('Será eliminado');
      expect(text(s)).toContain('o seu cadastro de contato, mensagens, agenda e remédios.');
      expect(text(s.querySelector('#priv-keep'))).toBe('Ficará guardado e sem uso');
      expect(text(s)).toContain('as respostas da escala e as anotações do atendimento, por 5 anos, como a norma do conselho pede. Depois disso, são apagados.');
      expect(text(s)).toContain('Você continua usando o app até a equipe concluir.');
      // CXC-009: o prazo vem NA folha, antes de confirmar, e sem código interno.
      expect(text(s.querySelector('[data-role="erasure-deadline"]'))).toBe('A equipe responde em até 15 dias.');
      expect(text(s)).not.toMatch(/DSR-\d+/);
      expect(text(s)).toContain('Entendi o que será eliminado e o que ficará guardado');
      const confirm = sheetButton('Pedir eliminação dos meus dados', 'Pedir eliminação');
      expect(confirm?.disabled).toBe(true);
      expect(text(s.querySelector('[data-role="erasure-hint"]'))).toBe('Marque a caixa para poder pedir.');
      expect(text(document.activeElement)).toBe('Voltar');
      await click(s.querySelector('input[type="checkbox"]'));
      expect(sheetButton('Pedir eliminação dos meus dados', 'Pedir eliminação')?.disabled).toBe(false);
      await click(sheetButton('Pedir eliminação dos meus dados', 'Pedir eliminação'));
      const created = app.db.dataSubjectRequests.all().at(-1)!;
      expect(created).toMatchObject({ caregiverId: 'cg_0003', type: 'erasure', status: 'open', dueAt: '2026-11-19' });
      expect(app.db.caregivers.require('cg_0003')).toMatchObject({ status: 'closure_requested', closureRequestedAt: '2026-11-04' });
      // Nada é eliminado antes de a equipe concluir; a pessoa segue dentro do app.
      expect(app.db.messages.query((m) => m.caregiverId === 'cg_0003')).toHaveLength(messages);
      expect(app.session.isSignedIn()).toBe(true);
      expect(text(q('[data-role="request-status"]'))).toBe('Faltam 15 dias para a resposta');
      expect(all<HTMLButtonElement>('button').some((b) => text(b) === 'Retirar o pedido')).toBe(true);
    });

    it('AC-CG-180: Retirar o pedido volta o cadastro a ativo e encerra o pedido sem efeito; nada é eliminado', async () => {
      await boot('cg_0003');
      await click(row('Pedir eliminação dos meus dados'));
      await click(sheet('Pedir eliminação dos meus dados').querySelector('input[type="checkbox"]'));
      await click(sheetButton('Pedir eliminação dos meus dados', 'Pedir eliminação'));
      const created = app.db.dataSubjectRequests.all().at(-1)!;
      const messages = app.db.messages.query((m) => m.caregiverId === 'cg_0003').length;
      await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Retirar o pedido'));
      expect(app.db.caregivers.require('cg_0003').status).toBe('active');
      expect(app.db.dataSubjectRequests.require(created.id)).toMatchObject({ status: 'rejected_with_reason', rejectedReason: 'Retirado pelo titular.' });
      expect(app.db.messages.query((m) => m.caregiverId === 'cg_0003')).toHaveLength(messages);
      expect(text(q('[data-role="request-status"]'))).toBe('Pedido retirado por você.');
      expect(all<HTMLButtonElement>('button').some((b) => text(b) === 'Retirar o pedido')).toBe(false);
    });

    it('Raimunda (pedido de eliminação aberto) vê o cartão com os dias restantes e "Retirar o pedido", e continua usando o app', async () => {
      await boot('cg_0018');
      expect(app.session.isSignedIn()).toBe(true);
      expect(text(q('[data-role="requests"] h2'))).toBe('Meus pedidos');
      expect(text(q('[data-role="request"]'))).toContain('Eliminação dos meus dados');
      expect(text(q('[data-role="request-status"]'))).toMatch(/^(Faltam \d+ dias para a resposta|Falta 1 dia para a resposta|O prazo termina hoje|A equipe vai responder em breve)$/);
      expect(all<HTMLButtonElement>('button').some((b) => text(b) === 'Retirar o pedido')).toBe(true);
      // O pedido repetido é recusado: a folha de eliminação diz que já há um pedido (sem o código).
      const pending = TestBed.inject(SubjectRightsService).pendingOf('cg_0018', 'erasure')!;
      expect(pending).toBeDefined();
      await click(row('Pedir eliminação dos meus dados'));
      expect(text(sheet('Pedir eliminação dos meus dados').querySelector('[data-role="duplicate"]'))).toBe(
        'Você já tem um pedido de eliminação em andamento.',
      );
    });

    it('o pedido de revisão de uma decisão (Maria) aparece em Como estou, não em Privacidade', async () => {
      await boot('cg_0002');
      expect(app.db.dataSubjectRequests.query((r) => r.caregiverId === 'cg_0002' && r.type === 'decision_review')).toHaveLength(1);
      expect(q('[data-role="requests"]')).toBeNull();
      expect(text(q('main'))).not.toContain('Revisão de uma decisão');
    });

    it('AC-CG-181: "Com quem os meus dados foram compartilhados" lista quem recebeu um pedido e diz que nada mais é compartilhado', async () => {
      await boot('cg_0008');
      const requests = app.db.serviceRequests.query((r) => r.caregiverId === 'cg_0008');
      expect(requests.length).toBeGreaterThan(0);
      await click(row('Com quem os meus dados foram compartilhados'));
      const items = all('[data-role="shared-with"] li');
      expect(items).toHaveLength(requests.length);
      const names = requests.map((r) => app.db.providers.require(r.providerId).name);
      names.forEach((name) => expect(items.some((li) => text(li).includes(name))).toBe(true));
      items.forEach((li) => expect(text(li)).toContain('Enviamos: nome, contato e o que você pediu.'));
      expect(text(q('[data-role="shared-note"]'))).toBe('Nada mais é compartilhado. O texto da Família é copiado por você: a Nexus não envia.');
    });

    it('quem nunca pediu um serviço vê "Nenhum profissional recebeu os seus dados."', async () => {
      await boot('cg_0026');
      if (app.db.serviceRequests.count((r) => r.caregiverId === 'cg_0026') > 0) {
        return;
      }
      await click(row('Com quem os meus dados foram compartilhados'));
      expect(text(q('[data-role="shared-empty"]'))).toBe('Nenhum profissional recebeu os seus dados.');
    });

    it('AC-CG-184: a política abre com o nome e o e-mail do encarregado, linguagem simples e o aviso de protótipo', async () => {
      await boot('cg_0001');
      await click(row('Política de privacidade e contato do encarregado'));
      expect(isOpen('Política de privacidade')).toBe(true);
      const policy = app.db.privacyDocuments.find((d) => d.kind === 'privacy_policy')!;
      expect(text(q('[data-role="dpo"]'))).toContain(policy.dpoName);
      expect(text(q('[data-role="dpo"]'))).toContain(policy.dpoEmail);
      expect(text(q('[data-role="policy"]'))).toContain('como a Nexus trata os seus dados');
      expect(text(q('[data-role="policy-proto"]'))).toBe('Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador.');
    });

    it('AC-CG-183: o botão vermelho existe só na folha de eliminação; nenhum outro item usa vermelho', async () => {
      await boot('cg_0001');
      const dangers = all('.btn--danger');
      expect(dangers).toHaveLength(1);
      expect(dangers[0]?.closest('app-cg-sheet')?.querySelector('.cg-sheet__title')?.textContent?.trim()).toBe('Pedir eliminação dos meus dados');
      expect(all('.btn--danger-quiet')).toHaveLength(0);
      // Sem nenhuma folha aberta, a página inteira não tem aviso de erro.
      expect(all('.cg-note--error')).toHaveLength(0);
    });
  });

  it('daysLeftText: dias corridos, no singular, e sem "vencido" depois do prazo', () => {
    expect(daysLeftText(12)).toBe('Faltam 12 dias para a resposta');
    expect(daysLeftText(1)).toBe('Falta 1 dia para a resposta');
    expect(daysLeftText(0)).toBe('O prazo termina hoje');
    expect(daysLeftText(-3)).toBe('A equipe vai responder em breve');
  });

  it('texto de tela sem travessão, exclamação nem as palavras proibidas', async () => {
    await boot('cg_0001');
    const body = text(q('main'));
    expect(/[\u2014\u2013!]/.test(body)).toBe(false);
    ['paciente', 'idoso ', 'alerta', 'eficácia', 'guerreira', 'diagnóstico'].forEach((w) => expect(body.toLowerCase().includes(w)).toBe(false));
  });
});
