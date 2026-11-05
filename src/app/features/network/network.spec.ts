import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { ProviderCategory } from '@core/models';
import { pick, pickAll, text as textOf, typeInto } from '@shared/ui/testing/dom';
import { DialogService } from '@shared/ui/overlay';
import { BootedApp, bootApp, settle, signIn } from '../../layout/testing';
import { NetworkAdminService } from './state/network-admin.service';

const ROUTES_OF_PARTNER: readonly [string, string][] = [
  ['/app/rede/prestadores', 'Prestadores'],
  ['/app/rede/prestadores/prv_04', 'Aline Cristina Pires'],
  ['/app/rede/credenciamento', 'Credenciamento'],
  ['/app/rede/credenciamento/novo', 'Novo credenciamento'],
  ['/app/rede/credenciamento/acr_0016', 'Dra. Isadora Leal'],
  ['/app/rede/solicitacoes', 'Solicitações de serviço'],
  ['/app/rede/avaliacoes', 'Avaliações da rede'],
  ['/app/rede/auditoria', 'Auditoria quinzenal'],
  ['/app/rede/busca', 'Busca como o usuário vê'],
  ['/app/rede/sinais', 'Sinais da rede'],
];

const submit = (form: Element): void => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

describe('M08 Rede credenciada', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));
  const text = (el: Element | null): string => (el ? textOf(el) : '');
  const go = async (url: string): Promise<void> => {
    await app.router.navigateByUrl(url);
    await settle(app.fixture);
  };
  const admin = (): NetworkAdminService => TestBed.inject(NetworkAdminService);
  const row = (name: string): string =>
    text(all('tbody tr').find((r) => text(r).includes(name)) ?? null);

  afterEach(() => TestBed.resetTestingModule());

  describe('telas e estados', () => {
    it('cada tela da sócia renderiza com os dados do seed, com um só h1 e sem texto de valor por atendimento (AC-M08-12)', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores' });
      for (const [url, title] of ROUTES_OF_PARTNER) {
        await go(url);
        const headings = all('main h1');
        expect(headings, url).toHaveLength(1);
        expect(text(headings[0] ?? null), url).toContain(title);
        expect(text(q('main')).toLowerCase(), url).not.toMatch(/comiss|porcentagem|repasse/);
      }
      await go(`/app/rede/avaliacao-interna/${app.db.internalReviews.list()[0]?.id}`);
      expect(text(q('main h1'))).toContain('Avaliação interna');
    });

    it('lista: recusa 62,5% com selo, 28,6% sem selo, 30,0% com selo, "sem média" e faixas nos limites (AC-M08-03 e 07)', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores' });
      expect(row('Aline Cristina Pires')).toContain('62,5%');
      expect(row('Aline Cristina Pires')).toContain('5 de 8');
      expect(row('Aline Cristina Pires')).toContain('Risco de saída');
      expect(row('Fisio em Casa Uberlândia')).toContain('28,6%');
      expect(row('Fisio em Casa Uberlândia')).not.toContain('Risco de saída');
      expect(row('Cuidar Bem Home Care')).toContain('30,0%');
      expect(row('Cuidar Bem Home Care')).toContain('Risco de saída');
      expect(row('Dra. Valéria Costa')).toContain('Sem média');
      expect(row('Farmácia Vida Plena')).toContain('4,50');
      expect(row('Farmácia Vida Plena')).toContain('Excelência');
      expect(row('Drogaria Santa Clara')).toContain('4,00');
      expect(row('Drogaria Santa Clara')).toContain('Alerta');
      // Quem precisa de atenção vem primeiro: o primeiro da lista é um suspenso.
      expect(text(all('tbody tr')[0] ?? null)).toContain('Suspenso');
      expect(text(q('main'))).toContain('20 prestadores');
    });

    it('os filtros vão para a URL; o filtro do sino mostra o vazio acolhedor quando nada vence', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores?estado=suspenso' });
      const rows = all('tbody tr').map((r) => text(r));
      expect(rows).toHaveLength(2);
      expect(rows.join(' ')).toContain('Clínica Saúde Integral');
      expect(rows.join(' ')).toContain('Nutri Camila Rezende');
      await go('/app/rede/prestadores?filtro=risco-de-saida');
      expect(all('tbody tr')).toHaveLength(2);
      await go('/app/rede/prestadores?filtro=documento-vencendo');
      expect(text(q('main'))).toContain('Nenhum resultado com esses filtros');
    });

    it('ficha: ARP, sinais, abas e aviso do papel da Nexus, e prestador inexistente vira estado de erro', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores/prv_04' });
      expect(text(q('[data-role="arp-card"]'))).toContain('4,14');
      expect(text(q('[data-role="arp-card"]'))).toContain('Reclamações graves: 1');
      expect(text(q('[data-role="signals-card"]'))).toContain('62,5%');
      expect(text(q('[data-role="signals-card"]'))).toContain('Queda de disponibilidade');
      expect(text(q('main'))).toContain('A Nexus organiza a rede e não presta o serviço');
      expect(all('[role="tab"]').map((t) => text(t))).toEqual([
        'Dados',
        'Documentos',
        'Avaliações',
        'Solicitações',
        'Histórico',
        'E-mails',
      ]);
      await go('/app/rede/prestadores/prv_04?aba=avaliacoes');
      expect(all('[role="tabpanel"] tbody tr')).toHaveLength(7);
      await go('/app/rede/prestadores/prv_xx');
      expect(text(q('main'))).toContain('Não encontramos este prestador');
    });

    it('credenciamento: quadro por estado, somente leitura, com o que falta em cada cartão (F07)', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/credenciamento' });
      expect(all('.kanban__head').map((h) => text(h).replace(/\s*\d+\s*itens?$/, ''))).toEqual([
        'Solicitado',
        'Em análise',
        'Documentos pendentes',
        'Aprovado',
        'Reprovado',
      ]);
      expect(text(q('main'))).toContain('Faltam 2 critérios');
      expect(text(q('main'))).toContain('Documento vencido');
      expect(text(q('main'))).toContain('Nenhum processo aqui');
      expect(q('[draggable="true"]')).toBeNull();
    });
  });

  describe('credenciamento (AC-M08-01, 02 e 13)', () => {
    it('candidata com documento vencido: "Aprovar" desabilitado diz o que falta; só aprova depois de anexar e conferir', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/credenciamento/acr_0016' });
      expect(q('[data-role="approve"]')?.getAttribute('aria-disabled')).toBe('true');
      expect(text(q('[data-role="approve-hint"]'))).toContain('Para aprovar falta');
      expect(text(q('[data-role="approve-hint"]'))).toContain('registro no conselho vencido');
      expect(text(q('[data-role="documents"]'))).toContain('Vencido há 12 dias');
      expect(admin().approve('acr_0016').ok).toBe(false);
      const attached = admin().attachDocument('prv_16', {
        kind: 'council_registry',
        fileName: 'registro-novo.pdf',
        validUntil: '2027-05-30',
      });
      expect(attached.ok).toBe(true);
      expect(app.db.accreditations.get('acr_0016')?.status).toBe('in_review');
      expect(admin().approve('acr_0016').ok).toBe(false);
      expect(admin().setChecklist('acr_0016', 'council_registry', 'ok').ok).toBe(true);
      await settle(app.fixture);
      expect(q('[data-role="approve"]')?.getAttribute('aria-disabled')).toBeNull();
      expect(text(q('[data-role="approve-hint"]'))).toContain('Os 5 critérios estão cumpridos');
      expect(admin().approve('acr_0016').ok).toBe(true);
      expect(app.db.accreditations.get('acr_0016')?.status).toBe('approved');
    });

    it('documento: nome, validade do registro e validade vencida são conferidos', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores' });
      expect(admin().attachDocument('prv_16', { kind: 'council_registry', fileName: ' ' }).ok).toBe(false);
      const noValidity = admin().attachDocument('prv_16', { kind: 'council_registry', fileName: 'a.pdf' });
      expect(noValidity.ok ? '' : noValidity.error).toBe('Informe a validade do registro no conselho.');
      const past = admin().attachDocument('prv_16', {
        kind: 'council_registry',
        fileName: 'a.pdf',
        validUntil: '2026-01-01',
      });
      expect(past.ok ? '' : past.error).toContain('A validade informada já passou');
      expect(admin().attachDocument('prv_16', { kind: 'training_proof', fileName: 'diploma.pdf' }).ok).toBe(true);
    });

    it('prestador novo sem integração não vai a ativo; com os 3 passos, vai', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/credenciamento/acr_0017' });
      expect(admin().approve('acr_0017').ok).toBe(true);
      await settle(app.fixture);
      expect(text(q('[data-role="activate-hint"]'))).toContain('integração concluída');
      expect(admin().activate('prv_17').ok).toBe(false);
      expect(app.db.providers.get('prv_17')?.status).toBe('candidate');
      admin().recordIntegration('prv_17');
      admin().recordPops('prv_17');
      expect(admin().activate('prv_17').ok).toBe(false);
      admin().recordParallelBan('prv_17');
      expect(admin().activate('prv_17').ok).toBe(true);
      expect(app.db.providers.get('prv_17')?.status).toBe('active');
      expect(app.db.accreditations.get('acr_0017')?.status).toBe('active');
      expect(app.db.popAcknowledgements.count((a) => a.personId === 'prv_17')).toBe(
        app.db.pops.list().length,
      );
    });

    it('reprovar exige motivo; pedir documentos registra o e-mail e volta o processo a pendente', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/credenciamento/acr_0017' });
      expect(admin().reject('acr_0017', '  ').ok).toBe(false);
      expect(admin().requestDocuments('acr_0017', [], 'texto').ok).toBe(false);
      expect(admin().requestDocuments('acr_0017', ['training_proof'], ' ').ok).toBe(false);
      expect(
        admin().requestDocuments('acr_0017', ['training_proof'], 'Precisamos do diploma atualizado.').ok,
      ).toBe(true);
      expect(app.db.accreditations.get('acr_0017')?.status).toBe('pending_documents');
      await go('/app/rede/prestadores/prv_17?aba=emails');
      expect(text(q('[data-role="registered-email"]'))).toContain('Precisamos do diploma atualizado');
      expect(admin().reject('acr_0017', 'Sem integração possível neste momento.').ok).toBe(true);
      expect(app.db.accreditations.get('acr_0017')?.status).toBe('rejected');
      expect(app.db.providers.get('prv_17')?.status).toBe('rejected');
    });

    it('abrir processo cria candidato, checklist pendente e histórico; o formulário valida em linha', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/credenciamento/novo' });
      submit(pick(app.root, '[data-role="new-process-form"]'));
      await settle(app.fixture);
      expect(text(q('app-error-summary'))).toContain('Há');
      expect(text(q('app-error-summary'))).toContain('Informe o nome do prestador.');
      const result = admin().openProcess({
        name: 'Clínica Nova Vida',
        personType: 'company',
        category: 'clinic',
        specialtyLabel: 'Clínica multiprofissional',
        council: { body: 'NONE', status: 'not_applicable' },
        city: 'Uberlândia',
        homeCare: false,
        conditionsForNexusUsers: 'Condições combinadas.',
        email: 'contato@exemplo.com.br',
        phone: '(34) 90000-0100',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const acc = app.db.accreditations.get(result.value.accreditationId);
        expect(acc?.status).toBe('requested');
        expect(acc?.checklist.council_registry.status).toBe('not_applicable');
        expect(acc?.checklist.training_proof.status).toBe('pending');
        expect(app.db.providerStatusEvents.count((e) => e.providerId === result.value.id)).toBe(1);
      }
    });
  });

  describe('ARP, auditoria e avaliação interna', () => {
    it('média 3,9 ou menos suspende na auditoria e abre avaliação interna; a auditoria tem prévia, não grava na prévia e substitui no mesmo dia (AC-M08-04 e 08)', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/auditoria' });
      const before = app.db.arpSnapshots.size();
      expect(admin().previewAudit().willSuspend).toHaveLength(0);
      app.db.providerEvaluations.updateWhere((e) => e.providerId === 'prv_05', {
        technicalQuality: 1,
        punctualityCourtesy: 1,
        score: 1,
      });
      await settle(app.fixture);
      expect(admin().previewAudit().willSuspend.map((r) => r.summary.provider.id)).toEqual(['prv_05']);
      expect(app.db.arpSnapshots.size()).toBe(before);
      pick<HTMLButtonElement>(app.root, '[data-role="show-preview"]').click();
      await settle(app.fixture);
      expect(text(q('[data-role="will-suspend"]'))).toContain('Valdir Antunes');
      // O diálogo diz o número de suspensões no próprio botão.
      pick<HTMLButtonElement>(app.root, '[data-role="run-audit"]').click();
      const dialogs = TestBed.inject(DialogService);
      expect(dialogs.current()?.config.title).toBe('Rodar a auditoria quinzenal?');
      expect(dialogs.current()?.config.confirmLabel).toBe('Rodar auditoria e suspender 1 prestador');
      expect(dialogs.current()?.config.message).toContain('todos os 16 prestadores em atividade');
      dialogs.cancelAll();
      const result = admin().runAudit();
      expect(result.ok).toBe(true);
      expect(app.db.arpSnapshots.count((s) => s.auditDate === '2026-11-04')).toBe(16);
      expect(app.db.providers.get('prv_05')?.status).toBe('suspended');
      expect(
        app.db.internalReviews.find((r) => r.providerId === 'prv_05' && !r.decision)?.trigger,
      ).toBe('average_below_4');
      const snapshot = app.db.arpSnapshots.find((s) => s.providerId === 'prv_05' && s.auditDate === '2026-11-04');
      expect(snapshot?.band).toBe('deaccreditation');
      // Rodar de novo no mesmo dia pergunta se deve substituir e não duplica os instantâneos.
      await settle(app.fixture);
      pick<HTMLButtonElement>(app.root, '[data-role="run-audit"]').click();
      expect(dialogs.current()?.config.title).toBe('Já existe uma auditoria de hoje. Substituir?');
      dialogs.cancelAll();
      const again = admin().runAudit();
      expect(again.ok && again.value.replaced).toBe(true);
      expect(app.db.arpSnapshots.count((s) => s.auditDate === '2026-11-04')).toBe(16);
    });

    it('3 reclamações graves suspendem; 2 não suspendem (AC-M08-04)', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/avaliacoes' });
      const ids = app.db.providerEvaluations.query((e) => e.providerId === 'prv_12').map((e) => e.id);
      const first = admin().classifyGrave(ids[0] as string, 'unjustified_absence');
      const second = admin().classifyGrave(ids[1] as string, 'confidentiality_breach');
      expect(first.ok && first.value.suspended).toBe(false);
      expect(second.ok && second.value.suspended).toBe(false);
      expect(app.db.providers.get('prv_12')?.status).toBe('monitoring');
      const third = admin().classifyGrave(ids[2] as string, 'other');
      expect(third.ok && third.value.suspended).toBe(true);
      expect(app.db.providers.get('prv_12')?.status).toBe('suspended');
      expect(admin().classifyGrave(ids[2] as string, 'other').ok).toBe(false);
    });

    it('avaliação interna do suspenso mostra a justificativa que ele enviou (AC-M08-10)', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores' });
      const review = app.db.internalReviews.find((r) => r.providerId === 'prv_10');
      await go(`/app/rede/avaliacao-interna/${review?.id}`);
      expect(text(q('[data-role="provider-justification"]'))).toContain('reorganizamos a escala da equipe');
      expect(text(q('[data-role="case-average"]'))).toBe('3,57');
      const noJustification = app.db.internalReviews.find((r) => r.providerId === 'prv_14');
      await go(`/app/rede/avaliacao-interna/${noJustification?.id}`);
      expect(text(q('[data-role="no-justification"]'))).toBe('Nenhuma justificativa enviada até agora.');
    });

    it('decidir: confirmar exige o texto do e-mail e grava no histórico; reinstalar exige motivo e devolve à busca (AC-M08-09)', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores' });
      const review10 = app.db.internalReviews.find((r) => r.providerId === 'prv_10')?.id as string;
      const review14 = app.db.internalReviews.find((r) => r.providerId === 'prv_14')?.id as string;
      const noEmail = admin().decideReview(review10, 'confirm_deaccreditation', {
        email: { to: 'x@exemplo.com.br', subject: 'Encerramento', body: '  ' },
      });
      expect(noEmail.ok).toBe(false);
      const confirmed = admin().decideReview(review10, 'confirm_deaccreditation', {
        email: { to: 'x@exemplo.com.br', subject: 'Encerramento', body: 'Informamos o encerramento.' },
      });
      expect(confirmed.ok).toBe(true);
      expect(app.db.providers.get('prv_10')?.status).toBe('deaccredited');
      expect(app.db.internalReviews.get(review10)?.closureEmail?.body).toBe('Informamos o encerramento.');
      await go('/app/rede/prestadores/prv_10?aba=emails');
      expect(text(q('[data-role="registered-email"]'))).toContain('Informamos o encerramento.');
      expect(admin().decideReview(review14, 'reinstate', {}).ok).toBe(false);
      expect(admin().decideReview(review14, 'reinstate', { note: 'Sem prova das faltas.' }).ok).toBe(true);
      expect(['active', 'monitoring']).toContain(app.db.providers.get('prv_14')?.status);
      expect(admin().decideReview(review14, 'keep_monitoring', {}).ok).toBe(false);
    });

    it('suspender pela ficha: o motivo é obrigatório, o prestador sai da busca e a avaliação interna abre', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores/prv_05' });
      pick<HTMLButtonElement>(app.root, '[data-role="suspend"]').click();
      await settle(app.fixture);
      const form = pick(app.root, 'app-reason-drawer form');
      submit(form);
      await settle(app.fixture);
      expect(text(q('app-reason-drawer'))).toContain('Escreva o motivo da suspensão.');
      expect(app.db.providers.get('prv_05')?.status).toBe('active');
      typeInto(pick<HTMLTextAreaElement>(form, 'textarea'), 'Documentos incompletos');
      submit(form);
      await settle(app.fixture);
      expect(app.db.providers.get('prv_05')?.status).toBe('suspended');
      expect(app.db.internalReviews.find((r) => r.providerId === 'prv_05' && !r.decision)?.trigger).toBe('manual');
    });

    it('busca como o usuário vê: todos os ativos da especialidade, única opção, nenhuma opção e suspenso fora (AC-M08-05, 06 e 15)', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/busca' });
      const pair = app.db.providers.get('prv_11')?.category as ProviderCategory;
      await go(`/app/rede/busca?categoria=${pair}`);
      const options = (): string[] =>
        all('[data-role="search-option"]').map((li) => li.getAttribute('data-provider') ?? '');
      expect(options()).toEqual(['prv_11', 'prv_12']);
      expect(text(all('[data-role="search-option"]')[0] ?? null)).toContain('Em destaque');
      // O destaque do primeiro não esconde o segundo; suspender o primeiro deixa o outro como única opção.
      admin().suspend('prv_11', 'Documentos incompletos');
      await settle(app.fixture);
      expect(options()).toEqual(['prv_12']);
      expect(q('[data-role="search-result"]')?.getAttribute('data-availability')).toBe('single_option');
      expect(text(q('[data-role="search-result"]'))).toContain('Única opção disponível no momento');
      expect(text(q('[data-role="hidden-from-search"]'))).toContain('suspenso');
      const nutrition = app.db.providers.get('prv_14')?.category as ProviderCategory;
      await go(`/app/rede/busca?categoria=${nutrition}`);
      expect(options()).toEqual([]);
      expect(q('[data-role="search-result"]')?.getAttribute('data-availability')).toBe('none');
      expect(text(q('[data-role="search-result"]'))).toContain('Nenhuma opção disponível no momento');
      expect(text(q('[data-role="hidden-from-search"]'))).toContain('Nutri Camila Rezende');
      const homeCare = app.db.providers.get('prv_06')?.category as ProviderCategory;
      await go(`/app/rede/busca?categoria=${homeCare}`);
      expect(options()).toEqual(['prv_06']);
      expect(q('[data-role="search-result"]')?.getAttribute('data-availability')).toBe('single_option');
      const clinic = app.db.providers.get('prv_10')?.category as ProviderCategory;
      await go(`/app/rede/busca?categoria=${clinic}`);
      expect(q('[data-role="search-result"]')?.getAttribute('data-availability')).toBe('none');
    });

    it('sinais: recusa por prestador, queda de disponibilidade e queda gerada ao registrar a semana', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/sinais' });
      expect(text(q('[data-role="refusal-signal"]'))).toContain('62,5%');
      expect(text(q('[data-role="availability-signal"]'))).toContain('Aline Cristina Pires');
      expect(text(q('[data-role="availability-signal"]'))).toContain('Queda de 60,0%');
      expect(text(q('[data-role="flow-signal"]'))).toContain('Entradas');
      expect(admin().registerAvailability('prv_01', 80).ok).toBe(true);
      expect(admin().registerAvailability('prv_01', 99).ok).toBe(false);
      expect(admin().registerAvailability('prv_01', 2).ok).toBe(true);
      await settle(app.fixture);
      expect(text(q('[data-role="availability-signal"]'))).toContain('Dra. Renata Sampaio');
      expect(
        all('[data-role="availability-signal"] tbody tr').filter((r) => text(r).includes('Queda de disponibilidade')),
      ).toHaveLength(2);
    });

    it('as quatro listas de ação da auditoria levam à ficha', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/auditoria' });
      const group = (id: string): string => text(q(`[data-group="${id}"]`));
      expect(group('suspended')).toContain('Clínica Saúde Integral');
      expect(group('monitoring')).toContain('Cuidar Bem Home Care');
      expect(group('refusal')).toContain('Aline Cristina Pires');
      expect(group('documents')).toContain('Nenhum documento vence nos próximos 30 dias.');
      admin().registerMonitoringContact('prv_03', 'Combinado reforço de agenda na próxima quinzena.');
      await settle(app.fixture);
      expect(group('monitoring')).not.toContain('Fisio em Casa Uberlândia');
      expect(text(q('main'))).toContain('Última auditoria');
    });
  });

  describe('solicitações e avaliações (AC-M08-11)', () => {
    it('avaliação: duas notas de 1 a 5, só serviço concluído, uma por serviço', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/solicitacoes?estado=sem-avaliacao' });
      const completed = app.db.serviceRequests.find((r) => r.status === 'completed');
      expect(completed).toBeDefined();
      const id = completed?.id as string;
      const blank = admin().registerEvaluation(id, { technical: 5, punctuality: null });
      expect(blank.ok ? '' : blank.error).toBe('Escolha uma nota de 1 a 5 para a pontualidade e a cordialidade.');
      const noTechnical = admin().registerEvaluation(id, { technical: null, punctuality: 4 });
      expect(noTechnical.ok ? '' : noTechnical.error).toBe('Escolha uma nota de 1 a 5 para a qualidade técnica.');
      expect(admin().registerEvaluation(id, { technical: 6, punctuality: 4 }).ok).toBe(false);
      expect(admin().registerEvaluation(id, { technical: 0, punctuality: 4 }).ok).toBe(false);
      const created = admin().registerEvaluation(id, { technical: 5, punctuality: 4, comment: 'Atendimento cuidadoso.' });
      expect(created.ok).toBe(true);
      expect(created.ok && created.value.score).toBe(4.5);
      expect(app.db.serviceRequests.get(id)?.status).toBe('evaluated');
      const duplicate = admin().registerEvaluation(id, { technical: 5, punctuality: 5 });
      expect(duplicate.ok ? '' : duplicate.error).toContain('Este serviço já foi avaliado em 04/11/2026');
      const notCompleted = app.db.serviceRequests.find((r) => r.status === 'requested');
      const early = admin().registerEvaluation(notCompleted?.id as string, { technical: 5, punctuality: 5 });
      expect(early.ok ? '' : early.error).toBe('Só dá para avaliar um serviço concluído.');
    });

    it('a solicitação percorre os estados do fluxo e a recusa entra na taxa dos 30 dias', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/solicitacoes' });
      const caregiverId = app.db.caregivers.list()[0]?.id as string;
      const created = admin().createRequest({
        caregiverId,
        providerId: 'prv_01',
        need: 'Sessões de fisioterapia para a pessoa idosa',
        modality: 'home',
      });
      expect(created.ok).toBe(true);
      const id = created.ok ? created.value.id : '';
      const before = app.db.serviceRequests.count((r) => r.providerId === 'prv_01');
      expect(admin().respond(id, { accept: false, reason: ' ' }).ok).toBe(false);
      expect(admin().complete(id).ok).toBe(false);
      expect(admin().respond(id, { accept: true }).ok).toBe(true);
      expect(admin().respond(id, { accept: true }).ok).toBe(false);
      expect(admin().cancel(id, 'provider', '').ok).toBe(false);
      expect(admin().complete(id).ok).toBe(true);
      expect(app.db.serviceRequests.get(id)?.status).toBe('completed');
      expect(app.db.serviceRequests.count((r) => r.providerId === 'prv_01')).toBe(before);
      const second = admin().createRequest({ caregiverId, providerId: 'prv_01', need: 'Outra sessão', modality: 'at_provider' });
      const secondId = second.ok ? second.value.id : '';
      expect(admin().respond(secondId, { accept: false, reason: 'Agenda cheia nesta semana' }).ok).toBe(true);
      expect(app.db.serviceRequests.get(secondId)?.reason).toBe('Agenda cheia nesta semana');
      await go('/app/rede/prestadores/prv_01');
      expect(text(q('[data-role="signals-card"]'))).toContain('2 de 12');
    });

    it('pedido só vale para prestador na busca e domicílio só para quem atende em domicílio', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/solicitacoes' });
      const caregiverId = app.db.caregivers.list()[0]?.id as string;
      const suspended = admin().createRequest({ caregiverId, providerId: 'prv_10', need: 'Avaliação', modality: 'at_provider' });
      expect(suspended.ok ? '' : suspended.error).toContain('não está na busca');
      const noHome = admin().createRequest({ caregiverId, providerId: 'prv_02', need: 'Reabilitação', modality: 'home' });
      expect(noHome.ok ? '' : noHome.error).toContain('não atende em domicílio');
      expect(admin().createRequest({ caregiverId: 'cg_x', providerId: 'prv_02', need: 'x', modality: 'at_provider' }).ok).toBe(false);
      expect(admin().createRequest({ caregiverId, providerId: 'prv_02', need: ' ', modality: 'at_provider' }).ok).toBe(false);
    });

    it('lista de solicitações: novas primeiro, detalhe em gaveta pela URL e ações conforme o estado', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/solicitacoes' });
      expect(text(all('tbody tr')[0] ?? null)).toContain('Aguardando resposta');
      const requested = app.db.serviceRequests.find((r) => r.status === 'requested');
      await go(`/app/rede/solicitacoes?solicitacao=${requested?.id}`);
      expect(q('[data-role="request-detail"]')).not.toBeNull();
      expect(q('[data-role="accept"]')).not.toBeNull();
      expect(q('[data-role="cancel-user"]')).not.toBeNull();
      expect(q('[data-role="complete"]')).toBeNull();
      // A gestão vê o cuidador pelo código.
      expect(text(q('[data-role="request-detail"]'))).toMatch(/CUI-\d{4}/);
      await go('/app/rede/solicitacoes?solicitacao=srq_xxxx');
      expect(text(q('main'))).toContain('Não encontramos esta solicitação');
    });
  });

  describe('permissões e privacidade', () => {
    it('responsável técnico: só as fichas de psicologia, para validar o registro (AC-M08-14)', async () => {
      app = await bootApp({ userId: 'u2', url: '/app/rede/prestadores' });
      expect(all('tbody tr')).toHaveLength(1);
      expect(text(q('main'))).toContain('Dra. Valéria Costa');
      expect(text(q('main'))).not.toContain('Fisioterapia');
      expect(text(q('main'))).not.toContain('Recusa em 30 dias');
      await go('/app/rede/prestadores/prv_01');
      expect(text(q('main'))).toContain('Esta ficha não está disponível para o seu perfil');
      expect(text(q('main'))).not.toContain('Renata');
      await go('/app/rede/credenciamento');
      expect(app.router.url).toBe('/403');
      await go('/app/rede/auditoria');
      expect(app.router.url).toBe('/403');
      expect(TestBed.inject(AuditLogService).query({ action: 'denied' }).length).toBeGreaterThan(0);
    });

    it('o RT valida o registro de psicólogo da rede e o atendimento só lê', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores' });
      const opened = admin().openProcess({
        name: 'Dr. Caio Teixeira',
        personType: 'person',
        category: 'psychology',
        specialtyLabel: 'Psicologia (rede credenciada)',
        council: { body: 'CRP', number: '00555', state: '04', status: 'active', validUntil: '2027-12-31', fictitious: true },
        city: 'Uberlândia',
        homeCare: false,
        conditionsForNexusUsers: 'Condições combinadas.',
        email: 'caio@exemplo.com.br',
        phone: '(34) 90000-0200',
      });
      expect(opened.ok).toBe(true);
      const id = opened.ok ? opened.value.id : '';
      signIn('u7');
      expect(admin().validateCouncil(id).ok).toBe(false);
      expect(admin().approve(app.db.providers.get(id)?.accreditationId as string).ok).toBe(false);
      signIn('u2');
      expect(admin().canValidateCouncil({ category: 'psychology' })).toBe(true);
      expect(admin().canValidateCouncil({ category: 'physiotherapy' })).toBe(false);
      expect(admin().validateCouncil(id).ok).toBe(true);
      const acc = app.db.accreditations.get(app.db.providers.get(id)?.accreditationId as string);
      expect(acc?.checklist.council_registry.status).toBe('ok');
      expect(acc?.checklist.council_registry.checkedBy).toBe('u2');
      // O RT não confere outros critérios nem decide.
      expect(admin().setChecklist(acc?.id as string, 'training_proof', 'ok').ok).toBe(false);
      await go(`/app/rede/prestadores/${id}`);
      expect(text(q('[data-role="council-card"]'))).toContain('validado');
    });

    it('atendimento: lê toda a rede, registra solicitações e avaliações, e não decide nada', async () => {
      app = await bootApp({ userId: 'u7', url: '/app/rede/auditoria' });
      expect(q('[data-role="run-audit"]')).toBeNull();
      expect(q('[data-role="preview"]')).not.toBeNull();
      await go('/app/rede/credenciamento/acr_0016');
      expect(q('[data-role="approve"]')).toBeNull();
      expect(q('[data-role="check-criterion"]')).toBeNull();
      await go('/app/rede/prestadores');
      expect(q('[data-role="new-process"]')).toBeNull();
      await go('/app/rede/credenciamento/novo');
      expect(app.router.url).toBe('/403');
      await go('/app/rede/solicitacoes');
      expect(q('[data-role="new-request"]')).not.toBeNull();
      await go('/app/rede/prestadores/prv_04');
      expect(q('[data-role="suspend"]')).toBeNull();
      expect(q('[data-role="register-availability"]')).toBeNull();
      expect(admin().suspend('prv_04', 'x').ok).toBe(false);
      const caregiverId = app.db.caregivers.list()[0]?.id as string;
      const created = admin().createRequest({ caregiverId, providerId: 'prv_01', need: 'Sessões', modality: 'at_provider' });
      expect(created.ok).toBe(true);
      const id = created.ok ? created.value.id : '';
      expect(admin().respond(id, { accept: true }).ok).toBe(false);
      expect(admin().cancel(id, 'provider', 'x').ok).toBe(false);
      expect(admin().cancel(id, 'user', 'O usuário desistiu do pedido').ok).toBe(true);
      const completed = app.db.serviceRequests.find((r) => r.status === 'completed');
      expect(admin().registerEvaluation(completed?.id as string, { technical: 4, punctuality: 4 }).ok).toBe(true);
      expect(admin().classifyGrave(app.db.providerEvaluations.list()[0]?.id as string, 'other').ok).toBe(false);
      expect(admin().runAudit().ok).toBe(false);
    });

    it('a gestão vê o cuidador pelo código e o atendimento pelo nome', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/prestadores/prv_04?aba=avaliacoes' });
      expect(text(q('main'))).toMatch(/CUI-\d{4}/);
      for (const c of app.db.caregivers.list().slice(0, 40)) {
        expect(text(q('main'))).not.toContain(c.fullName);
      }
      TestBed.resetTestingModule();
      app = await bootApp({ userId: 'u7', url: '/app/rede/prestadores/prv_04?aba=avaliacoes' });
      expect(text(q('main'))).not.toMatch(/CUI-\d{4}/);
      expect(all('[role="tabpanel"] tbody tr')).toHaveLength(7);
    });

    it('psicólogo da equipe vai a /403 sem vazar nada da rede', async () => {
      app = await bootApp({ userId: 'u3', url: '/app/rede/prestadores' });
      expect(app.router.url).toBe('/403');
      expect(text(q('main'))).not.toContain('Aline Cristina Pires');
      expect(TestBed.inject(AuditLogService).query({ action: 'denied' }).length).toBeGreaterThan(0);
    });
  });

  describe('acessibilidade básica', () => {
    it('toda tela tem tabela com legenda e o formulário da gaveta tem rótulo em cada campo', async () => {
      app = await bootApp({ userId: 'u7', url: '/app/rede/solicitacoes' });
      expect(all('table caption').length).toBeGreaterThan(0);
      pick<HTMLButtonElement>(app.root, '[data-role="new-request"]').click();
      await settle(app.fixture);
      const controls = pickAll<HTMLElement>(app.root, 'app-request-create-drawer input, app-request-create-drawer select, app-request-create-drawer textarea');
      expect(controls.length).toBeGreaterThan(3);
      controls.forEach((control) => {
        const id = control.getAttribute('id');
        const labelled =
          (id !== null && app.root.querySelector(`label[for="${id}"]`) !== null) ||
          control.closest('label') !== null ||
          control.getAttribute('aria-label') !== null ||
          control.getAttribute('aria-labelledby') !== null;
        expect(labelled, control.outerHTML.slice(0, 80)).toBe(true);
      });
      submit(pick(app.root, '#nx-request-form'));
      await settle(app.fixture);
      expect(text(q('app-request-create-drawer app-error-summary'))).toContain('Escolha o cuidador que fez o pedido.');
      expect(text(q('app-request-create-drawer'))).toContain('Informe o prestador.');
    });

    it('a tela de credenciamento usa papéis de abas, checklist com texto e botão com motivo ao lado', async () => {
      app = await bootApp({ userId: 'u1', url: '/app/rede/credenciamento/acr_0016' });
      expect(q('ul.checklist[aria-label]')).not.toBeNull();
      all('.checklist__item').forEach((item) => {
        expect(text(item).length).toBeGreaterThan(10);
      });
      expect(q('[data-role="approve"]')?.getAttribute('aria-describedby')).toBe('nx-approve-hint');
      expect(AuthService).toBeDefined();
    });
  });
});
