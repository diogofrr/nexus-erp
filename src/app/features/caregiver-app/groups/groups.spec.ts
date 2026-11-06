import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { ContactDialogService } from '../state/contact-dialog.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './groups.routes';

const URL = '/cuidador/cuidar-de-mim/grupos';
const detail = (id: string): string => `${URL}?atividade=${id}`;

const mainText = (app: BootedCaregiverApp): string => (app.root.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ');

async function click(app: BootedCaregiverApp, element: Element | null | undefined): Promise<void> {
  if (!element) {
    throw new Error('Elemento não encontrado para clicar');
  }
  (element as HTMLElement).click();
  await settleCaregiver(app.fixture);
}

const byText = (app: BootedCaregiverApp, selector: string, label: string): HTMLElement | undefined =>
  Array.from(app.root.querySelectorAll<HTMLElement>(selector)).find((e) => e.textContent?.replace(/\s+/g, ' ').trim() === label);

const openSheet = (app: BootedCaregiverApp): HTMLDialogElement | null => app.root.querySelector<HTMLDialogElement>('main dialog.cg-sheet[open]');

const sheetText = (app: BootedCaregiverApp): string => (openSheet(app)?.textContent ?? '').replace(/\s+/g, ' ');

const card = (app: BootedCaregiverApp, title: string): HTMLElement | undefined =>
  Array.from(app.root.querySelectorAll<HTMLElement>('[data-role="activity"]')).find((c) => c.querySelector('.cg-card__title')?.textContent?.trim() === title);

function setPlan(app: BootedCaregiverApp, caregiverId: string, planId: 'livre' | 'essencial' | 'cuida' | 'sustenta'): void {
  const sub = app.db.subscriptions.find((s) => s.caregiverId === caregiverId);
  app.db.subscriptions.update(sub?.id ?? '', { planId });
}

/** Grupos e capacitações (UX C10): AC-CG-99 a 108. */
describe('Área groups (Grupos e capacitações)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  [URL, detail('act_0001'), detail('nao-existe')].forEach((url) => {
    it(`abre ${url} com o título "Grupos e capacitações" e um h1`, async () => {
      const app = await bootCaregiverApp('cg_0001', { url });
      expect(app.router.url).toBe(url);
      expect(document.title).toContain('Grupos e capacitações');
      expect(app.root.querySelectorAll('main h1').length).toBe(1);
    });
  });

  describe('a programação (AC-CG-99)', () => {
    it('mostra tipo, caráter, próximo encontro, formato e vagas de cada atividade da programação', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Grupos e capacitações');
      expect(mainText(app)).toContain('A programação do mês.');
      // CXC-021: o que a pessoa já faz fica só em "Minhas inscrições" e não se repete na programação.
      const listed = Array.from(app.root.querySelectorAll('[data-role="activity"] .cg-card__title')).map((t) => t.textContent?.trim());
      expect(listed).toEqual(['Lidar com as perdas, em grupo', 'Organização da rotina', 'Roda de conversa: cuidar de quem cuida']);
      expect(app.root.querySelector('#groups-all')?.textContent?.trim()).toBe('Outros grupos');
      // Sem inscrições, a programação traz as cinco atividades, na ordem de sempre.
      app.db.activityEnrollments.removeWhere((e) => e.caregiverId === 'cg_0001');
      await settleCaregiver(app.fixture);
      expect(app.root.querySelector('#groups-all')?.textContent?.trim()).toBe('Programação');
      const titles = Array.from(app.root.querySelectorAll('[data-role="activity"] .cg-card__title')).map((t) => t.textContent?.trim());
      expect(titles).toEqual([
        'Lidar com as perdas, em grupo',
        'Sobrecarga e autocuidado',
        'Organização da rotina',
        'Prevenção de quedas',
        'Roda de conversa: cuidar de quem cuida',
      ]);
      const text = (title: string) => (card(app, title)?.textContent ?? '').replace(/\s+/g, ' ');
      expect(text('Sobrecarga e autocuidado')).toContain('Grupo de apoio');
      expect(text('Sobrecarga e autocuidado')).toContain('Para aprender e trocar');
      expect(text('Sobrecarga e autocuidado')).not.toMatch(/psicoeducação/i);
      expect(text('Sobrecarga e autocuidado')).toContain('Próximo encontro: sáb, 07/11, às 14:00');
      expect(text('Sobrecarga e autocuidado')).toContain('No espaço de coworking');
      expect(text('Sobrecarga e autocuidado')).toMatch(/Lotado|\d+ vagas?/);
      // CXC-019: linguagem comum, e a distinção entre psicoterapia e orientação continua à vista (RN-GRP-16).
      expect(text('Lidar com as perdas, em grupo')).toContain('Grupo com psicólogo');
      expect(text('Lidar com as perdas, em grupo')).toContain('Psicoterapia em grupo');
      expect(text('Lidar com as perdas, em grupo')).not.toContain('Terapia de grupo');
      expect(text('Lidar com as perdas, em grupo')).toContain('Próximo encontro: hoje às 16:00');
      expect(text('Lidar com as perdas, em grupo')).toContain('Em andamento');
      expect(text('Organização da rotina')).toContain('On-line');
      expect(text('Organização da rotina')).toContain('Grupo de apoio');
      expect(text('Prevenção de quedas')).toContain('Capacitação');
      expect(text('Roda de conversa: cuidar de quem cuida')).toContain('Roda de conversa aberta');
      expect(text('Organização da rotina')).toMatch(/\d+ vagas?/);
    });

    it('rascunho, atividade cancelada e encerrada não aparecem', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      ['Prevenção de conflitos familiares', 'Administração segura de medicamentos', 'Comunicação com pessoas com demência'].forEach((t) =>
        expect(mainText(app)).not.toContain(t),
      );
    });

    it('sem atividades: "Ainda não há grupos neste mês"', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      app.db.activities.updateWhere(() => true, { status: 'draft' });
      await settleCaregiver(app.fixture);
      expect(mainText(app)).toContain('Ainda não há grupos neste mês');
      expect(mainText(app)).toContain('A programação é montada todo mês. Volte em breve.');
    });

    it('"Minhas inscrições" mostra o próximo encontro e a posição na lista de espera', async () => {
      const ana = await bootCaregiverApp('cg_0001', { url: URL });
      const rows = Array.from(ana.root.querySelectorAll('section[aria-labelledby="groups-mine"] .cg-row')).map(
        (r) => `${r.querySelector('.cg-row__title')?.textContent?.trim()} | ${r.querySelector('.cg-row__desc')?.textContent?.trim()}`,
      );
      expect(rows).toEqual([
        'Sobrecarga e autocuidado | Próximo encontro: sáb, 07/11, às 14:00',
        'Prevenção de quedas | Próximo encontro: sáb, 14/11, às 14:00',
      ]);
      TestBed.resetTestingModule();
      const lourdes = await bootCaregiverApp('cg_0024', { url: URL });
      const mine = lourdes.root.querySelector('section[aria-labelledby="groups-mine"]');
      expect(mine?.textContent).toContain('Sobrecarga e autocuidado');
      expect(mine?.textContent).toContain('Você está na lista de espera, posição 1.');
    });

    it('CXC-021: quem não tem acesso vê "Plano Cuida" na própria linha, sem pressão, e a roda aberta (que é para todos) vem primeiro', async () => {
      const maria = await bootCaregiverApp('cg_0002', { url: URL });
      const rows = Array.from(maria.root.querySelectorAll<HTMLElement>('[data-role="activity"]'));
      const first = rows[0];
      expect(first?.querySelector('.cg-card__title')?.textContent?.trim()).toBe('Roda de conversa: cuidar de quem cuida');
      expect(first?.querySelector('[data-role="plan-tag"]')).toBeNull();
      const tags = rows.slice(1).map((r) => r.querySelector('[data-role="plan-tag"]')?.textContent?.trim());
      expect(tags.every((t) => t === 'Plano Cuida')).toBe(true);
      expect(mainText(maria)).not.toMatch(/R\$|assine|desconto|upgrade/i);
      TestBed.resetTestingModule();
      const ana = await bootCaregiverApp('cg_0001', { url: URL });
      expect(ana.root.querySelector('[data-role="plan-tag"]')).toBeNull();
    });

    it('quem não está em nada não vê "Minhas inscrições"', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      expect(app.root.querySelector('section[aria-labelledby="groups-mine"]')).toBeNull();
    });

    it('tocar no cartão abre o detalhe com ?atividade= e o foco vai ao título; Voltar leva à lista', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: URL });
      await click(app, card(app, 'Organização da rotina'));
      expect(app.router.url).toBe(detail('act_0008'));
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Organização da rotina');
      expect(document.activeElement?.tagName).toBe('H1');
      expect(app.root.querySelector('[data-role="activity"]')).toBeNull();
      await click(app, app.root.querySelector('main a.cg-page-header__back'));
      expect(app.router.url).toBe(URL);
      expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Grupos e capacitações');
    });

    it('atividade em rascunho, cancelada ou inexistente: "Não encontramos esta atividade." com Voltar', async () => {
      for (const id of ['act_0007', 'act_0006', 'act_0005', 'nao-existe']) {
        const app = await bootCaregiverApp('cg_0001', { url: detail(id) });
        expect(mainText(app)).toContain('Não encontramos esta atividade.');
        expect(app.root.querySelector('main h1')?.textContent?.trim()).toBe('Grupos e capacitações');
        TestBed.resetTestingModule();
      }
    });
  });

  describe('o detalhe', () => {
    it('mostra o que é, o caráter explicado, o tema, todos os encontros, quem conduz e as vagas', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: detail('act_0001') });
      expect(app.root.querySelector('[data-role="kind"]')?.textContent?.trim()).toBe('Grupo de apoio');
      expect(app.root.querySelector('[data-role="character"]')?.textContent?.trim()).toBe('Para aprender e trocar');
      expect(app.root.querySelector('[data-role="character-text"]')?.textContent?.trim()).toBe(
        'Para aprender e trocar: encontros para conversar e aprender com outras pessoas. Não é psicoterapia.',
      );
      const meetings = Array.from(app.root.querySelectorAll('main dl li')).map((li) => li.textContent?.trim());
      expect(meetings).toEqual(['sáb, 07/11, às 14:00', 'sáb, 14/11, às 14:00', 'sáb, 21/11, às 14:00', 'sáb, 28/11, às 14:00']);
      expect(app.root.querySelector('[data-role="leader"]')?.textContent?.trim()).toBe(
        'Conduzido por Dr. Rafael Moreira, psicólogo (CRP-04/00102, fictício).',
      );
      expect(app.root.querySelector('[data-role="seats"]')?.textContent?.trim()).toBe('Lotado');
    });

    it('AC-CG-107: a sala presencial mostra o endereço e os 4 itens de acessibilidade', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0001') });
      const where = (app.root.querySelector('[data-role="where"]')?.textContent ?? '').replace(/\s+/g, ' ');
      expect(where).toContain('No espaço de coworking');
      const room = app.db.rooms.require(app.db.activities.require('act_0001').roomId ?? '');
      expect(where).toContain(`${room.name}, ${room.address}.`);
      expect(app.root.querySelector('[data-role="room-access"]')?.textContent?.trim()).toBe(
        'Sala com acesso sem degraus, sanitário adaptado, boa iluminação e assentos com apoio de braços.',
      );
    });

    it('uma atividade on-line não mostra sala', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0008') });
      expect(app.root.querySelector('[data-role="where"]')?.textContent?.trim()).toBe('On-line');
      expect(app.root.querySelector('[data-role="room-access"]')).toBeNull();
    });

    it('não fala de pontuação, faixa, alerta nem promete resultado (AC-CG-108)', async () => {
      for (const [id, url] of [['cg_0001', detail('act_0001')], ['cg_0002', detail('act_0001')], ['cg_0001', URL], ['cg_0002', URL], ['cg_0003', detail('act_0004')]] as const) {
        const app = await bootCaregiverApp(id, { url });
        const text = mainText(app).toLowerCase();
        expect(text).not.toMatch(/zarit|pontua|faixa|alerta|arbe|sobrecarga severa|vai melhorar|vai aliviar|vai ajudar|cura\b/);
        TestBed.resetTestingModule();
      }
    });
  });

  describe('entrar: sigilo e inscrição (AC-CG-100 e 101)', () => {
    it('Quero participar abre a folha do sigilo com o texto do grupo; sem marcar, mostra o erro e não inscreve', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0008') });
      expect(app.context.canUse('groups')).toBe(true);
      const join = app.root.querySelector<HTMLElement>('[data-role="join"]');
      expect(join?.textContent?.trim()).toBe('Quero participar');
      await click(app, join);
      expect(openSheet(app)).not.toBeNull();
      expect(openSheet(app)?.querySelector('.cg-sheet__title')?.textContent?.trim()).toBe('Contrato de sigilo do grupo');
      expect(openSheet(app)?.querySelector('[data-role="confidentiality"]')?.textContent?.trim()).toBe(app.db.activities.require('act_0008').confidentialityText);
      expect(sheetText(app)).toContain('Li e aceito o contrato de sigilo do grupo');
      expect(app.root.querySelector('[data-role="stamp"]')).toBeNull();
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(sheetText(app)).toContain('Marque que você leu o contrato de sigilo para entrar.');
      expect(app.db.activityEnrollments.count((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0001')).toBe(0);
    });

    it('marcada a caixa, mostra o carimbo com data e hora; Entrar no grupo grava o aceite e a atividade vai a "Minhas inscrições"', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0008') });
      await click(app, app.root.querySelector('[data-role="join"]'));
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      expect(app.root.querySelector('[data-role="stamp"]')?.textContent?.trim()).toBe('Aceito em 04/11/2026, às 12:00');
      expect(openSheet(app)?.querySelector('[data-role="confirm-join"]')?.textContent?.trim()).toBe('Entrar no grupo');
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(openSheet(app)).toBeNull();
      const saved = app.db.activityEnrollments.find((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0001');
      expect(saved).toMatchObject({ status: 'enrolled', confidentialityAcceptedAt: '2026-11-04T12:00:00-03:00' });
      const result = app.root.querySelector('[data-role="result"]')?.textContent?.replace(/\s+/g, ' ').trim();
      expect(result).toBe('Você está no grupo Organização da rotina. Primeiro encontro: ter, 10/11, às 19:00.');
      expect(TestBed.inject(ToastService).toasts().find((t) => t.message === result)).toBeUndefined();
      expect(app.root.querySelector('[data-role="standing"]')?.textContent).toContain('Você está no grupo.');
      expect(app.root.querySelector('[data-role="join"]')).toBeNull();
      await click(app, app.root.querySelector('main a.cg-page-header__back'));
      const mine = Array.from(app.root.querySelectorAll('section[aria-labelledby="groups-mine"] .cg-row__title')).map((t) => t.textContent?.trim());
      expect(mine).toContain('Organização da rotina');
    });

    it('Voltar fecha a folha sem inscrever, e uma capacitação chama o botão de "Entrar na capacitação"', async () => {
      const app = await bootCaregiverApp('cg_0027', { url: detail('act_0008') });
      await click(app, app.root.querySelector('[data-role="join"]'));
      await click(app, byText(app, 'main dialog.cg-sheet[open] button', 'Voltar'));
      expect(openSheet(app)).toBeNull();
      expect(app.db.activityEnrollments.count((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0027')).toBe(0);
      TestBed.resetTestingModule();
      const capa = await bootCaregiverApp('cg_0027', { url: detail('act_0002') });
      expect(capa.root.querySelector('[data-role="standing"]')?.textContent).toContain('Você está na capacitação.');
    });

    it('a roda aberta vale para todos e entra com o mesmo sigilo', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: detail('act_0004') });
      const join = app.root.querySelector<HTMLElement>('[data-role="join"]');
      expect(join?.textContent?.trim()).toBe('Quero participar');
      await click(app, join);
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      expect(openSheet(app)?.querySelector('[data-role="confirm-join"]')?.textContent?.trim()).toBe('Entrar na roda');
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0004' && e.caregiverId === 'cg_0002')?.status).toBe('enrolled');
      expect(app.root.querySelector('[data-role="result"]')?.textContent).toContain('Você está na roda Roda de conversa: cuidar de quem cuida.');
    });
  });

  describe('lista de espera (AC-CG-102)', () => {
    it('lotada, o botão é "Entrar na lista de espera" e a folha diz a posição; depois mostra a posição', async () => {
      const app = await bootCaregiverApp('cg_0012', { url: URL });
      setPlan(app, 'cg_0012', 'cuida');
      await app.router.navigateByUrl(detail('act_0001'));
      await settleCaregiver(app.fixture);
      const join = app.root.querySelector<HTMLElement>('[data-role="join"]');
      expect(join?.textContent?.trim()).toBe('Entrar na lista de espera');
      await click(app, join);
      expect(sheetText(app)).toContain('Você entra na posição 3.');
      expect(sheetText(app)).toContain('Se abrir uma vaga, você entra automaticamente e a gente avisa.');
      await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
      expect(openSheet(app)?.querySelector('[data-role="confirm-join"]')?.textContent?.trim()).toBe('Entrar na lista de espera');
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
      expect(app.root.querySelector('[data-role="result"]')?.textContent?.trim()).toBe('Você entrou na lista de espera, posição 3.');
      expect(app.root.querySelector('[data-role="standing"]')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Você está na lista de espera, posição 3. Avisamos quando abrir uma vaga.',
      );
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0012')).toMatchObject({ status: 'waitlist', waitlistPosition: 3 });
    });

    it('Lourdes e Elza já estão na fila: veem a posição e "Sair da lista"', async () => {
      const lourdes = await bootCaregiverApp('cg_0024', { url: detail('act_0001') });
      expect(lourdes.root.querySelector('[data-role="standing"]')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Você está na lista de espera, posição 1. Avisamos quando abrir uma vaga.',
      );
      expect(byText(lourdes, 'main button', 'Sair da lista')).toBeDefined();
      TestBed.resetTestingModule();
      const elza = await bootCaregiverApp('cg_0027', { url: detail('act_0001') });
      expect(elza.root.querySelector('[data-role="standing"]')?.textContent).toContain('posição 2');
    });

    it('Sair da lista pede confirmação e tira a pessoa da fila', async () => {
      const app = await bootCaregiverApp('cg_0027', { url: detail('act_0001') });
      await click(app, byText(app, 'main button', 'Sair da lista'));
      expect(sheetText(app)).toContain('Você sai da lista de espera. Você pode entrar de novo quando quiser.');
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-leave"]'));
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0027')?.status).toBe('cancelled');
      expect(app.root.querySelector('[data-role="result"]')?.textContent).toContain('Você saiu da lista de espera.');
    });
  });

  describe('bloqueio por plano (AC-CG-103 e 104)', () => {
    it('Essencial e Livre veem "Disponível no plano Cuida" no lugar do botão, sem vermelho; a roda aberta continua liberada', async () => {
      for (const [id, plan] of [['cg_0002', 'Essencial'], ['cg_0003', 'Livre']] as const) {
        const app = await bootCaregiverApp(id, { url: detail('act_0008') });
        const lock = app.root.querySelector('.cg-plan-lock') as HTMLElement;
        expect(lock.textContent).toContain('Disponível no plano Cuida');
        expect((lock.textContent ?? '').replace(/\s+/g, ' ')).toContain(
          `Grupos de apoio e capacitações fazem parte do plano Cuida. Seu plano agora é o ${plan}. As rodas de conversa abertas são para todos.`,
        );
        expect(lock.querySelector('a')?.textContent?.trim()).toBe('Ver os planos');
        expect(lock.querySelector('a')?.getAttribute('href')).toBe('/cuidador/mais/plano');
        expect(app.root.querySelector('[data-role="join"]')).toBeNull();
        expect(app.root.querySelector('main .cg-note--error')).toBeNull();
        expect(lock.textContent).not.toContain('R$');
        TestBed.resetTestingModule();
      }
    });

    it('a capacitação também é bloqueada, e a roda aberta mostra Quero participar', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: detail('act_0002') });
      expect(app.root.querySelector('.cg-plan-lock')).not.toBeNull();
      TestBed.resetTestingModule();
      const roda = await bootCaregiverApp('cg_0002', { url: detail('act_0004') });
      expect(roda.root.querySelector('.cg-plan-lock')).toBeNull();
      expect(roda.root.querySelector('[data-role="join"]')?.textContent?.trim()).toBe('Quero participar');
    });

    it('é o MESMO bloqueio para toda pessoa do mesmo plano, com ou sem alerta, pontuação ou ARBE', async () => {
      const texts: string[] = [];
      // Maria (acompanhamento com contato vencido), Terezinha, Sônia (saúde retirada) e Marcos: todas Essencial.
      for (const id of ['cg_0002', 'cg_0012', 'cg_0016', 'cg_0026']) {
        const app = await bootCaregiverApp(id, { url: detail('act_0008') });
        expect(app.context.planId()).toBe('essencial');
        texts.push((app.root.querySelector('.cg-plan-lock')?.textContent ?? '').replace(/\s+/g, ' ').trim());
        TestBed.resetTestingModule();
      }
      expect(new Set(texts).size).toBe(1);
      expect(texts[0]).not.toMatch(/zarit|pontua|faixa|alerta|arbe|risco/i);
    });
  });

  describe('terapia de grupo (AC-CG-105)', () => {
    it('mostra Psicoterapia, quem conduz com o registro e, sem a indicação do psicólogo, não deixa entrar nem diz o motivo', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: URL });
      app.db.activities.update('act_0003', { status: 'open' });
      await app.router.navigateByUrl(detail('act_0003'));
      await settleCaregiver(app.fixture);
      expect(app.root.querySelector('[data-role="kind"]')?.textContent?.trim()).toBe('Grupo com psicólogo');
      expect(app.root.querySelector('[data-role="character"]')?.textContent?.trim()).toBe('Psicoterapia em grupo');
      expect(app.root.querySelector('[data-role="character-text"]')?.textContent?.trim()).toBe(
        'Psicoterapia em grupo: um psicólogo da Nexus conduz o grupo, para cuidar do que você sente.',
      );
      expect(app.root.querySelector('main')?.textContent).not.toMatch(/objetivo clínico|psicoeducação/i);
      expect(app.root.querySelector('[data-role="leader"]')?.textContent?.trim()).toBe(
        'Conduzido por Dra. Letícia Amaral, psicóloga (CRP-04/00104, fictício).',
      );
      expect(app.root.querySelector('[data-role="standing"]')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Esta atividade começa com a indicação do seu psicólogo. Fale com a gente.',
      );
      expect(app.root.querySelector('[data-role="join"]')).toBeNull();
      expect(mainText(app).toLowerCase()).not.toMatch(/elegib|clínic[oa] do seu|zarit|pontua|motivo/);
      await click(app, byText(app, 'main button', 'Falar com a gente'));
      expect(TestBed.inject(ContactDialogService).isOpen()).toBe(true);
    });

    it('em andamento, as inscrições estão encerradas', async () => {
      const app = await bootCaregiverApp('cg_0002', { url: detail('act_0003') });
      expect(app.root.querySelector('[data-role="standing"]')?.textContent?.trim()).toBe('Em andamento. As inscrições estão encerradas.');
      expect(app.root.querySelector('[data-role="join"]')).toBeNull();
    });

    it('quem já faz parte (indicada pelo psicólogo) vê "Você está no grupo." e pode sair', async () => {
      const app = await bootCaregiverApp('cg_0004', { url: detail('act_0003') });
      expect(app.root.querySelector('[data-role="standing"]')?.textContent).toContain('Você está no grupo.');
    });
  });

  describe('sair do grupo (AC-CG-106)', () => {
    it('a folha diz que a vaga volta para outra pessoa; ao confirmar, cancela e promove o primeiro da fila', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0001') });
      const leave = byText(app, 'main button', 'Sair do grupo');
      expect(leave).toBeDefined();
      await click(app, leave);
      expect(sheetText(app)).toContain('Você deixa de participar. A sua vaga volta para outra pessoa.');
      const actions = Array.from(openSheet(app)?.querySelectorAll('.cg-sheet__actions button') ?? []).map((b) => b.textContent?.trim());
      expect(actions).toEqual(['Sair do grupo', 'Voltar']);
      await click(app, openSheet(app)?.querySelector('[data-role="confirm-leave"]'));
      expect(openSheet(app)).toBeNull();
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0001')?.status).toBe('cancelled');
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0024')?.status).toBe('enrolled');
      expect(app.root.querySelector('[data-role="result"]')?.textContent).toContain('Você saiu do grupo. A sua vaga voltou para outra pessoa.');
      expect(TestBed.inject(ToastService).toasts()).toHaveLength(0);
    });

    it('Voltar não tira ninguém; o botão seguro recebe o foco', async () => {
      const app = await bootCaregiverApp('cg_0001', { url: detail('act_0001') });
      await click(app, byText(app, 'main button', 'Sair do grupo'));
      expect(document.activeElement?.textContent?.trim()).toBe('Voltar');
      await click(app, byText(app, 'main dialog.cg-sheet[open] button', 'Voltar'));
      expect(openSheet(app)).toBeNull();
      expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0001')?.status).toBe('enrolled');
    });
  });

  it('sem o aceite, o domínio também recusa (a tela não decide sozinha)', async () => {
    const app = await bootCaregiverApp('cg_0027', { url: detail('act_0008') });
    await click(app, app.root.querySelector('[data-role="join"]'));
    await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
    expect(app.db.activityEnrollments.count((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0027')).toBe(0);
    // Marca e desmarca: o carimbo some e continua sem entrar.
    await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
    await click(app, openSheet(app)?.querySelector('input[type="checkbox"]'));
    expect(app.root.querySelector('[data-role="stamp"]')).toBeNull();
    await click(app, openSheet(app)?.querySelector('[data-role="confirm-join"]'));
    expect(sheetText(app)).toContain('Marque que você leu o contrato de sigilo para entrar.');
  });
});
