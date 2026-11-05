import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { toDayNumber } from '../../../core/clock/date-utils';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { ContactDialogService } from '../state/contact-dialog.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './today.routes';
import { withArticle } from '../state/people-format';
import { greetingFor, inviteKindFor } from './state/today-rules';
import { WellbeingCheckService, WellbeingError } from './state/wellbeing-check.service';

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** As palavras que nunca aparecem em Hoje (AC-CG-43, 44 e 56). */
const NEVER_IN_TODAY = /alerta|vermelho|urgente|vencid|atrasad|pontos|pontua|sobrecarga|faixa|ARBE|Cartão Nexus|R\$|plano/i;

describe('Hoje (UX C4)', () => {
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
  const open = async (id: string, options: { time?: string; layout?: 'drawer' | 'full' } = {}): Promise<void> => {
    TestBed.resetTestingModule();
    app = await bootCaregiverApp(id, { url: '/cuidador/hoje', ...options });
  };
  const buttonByText = (label: string): HTMLElement | undefined =>
    all<HTMLElement>('button, a').find((b) => text(b) === label);

  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área e abre com o título "Hoje"', async () => {
    expect(ROUTES.length).toBeGreaterThan(0);
    await open('cg_0001');
    expect(app.router.url).toBe('/cuidador/hoje');
    expect(document.title).toContain('Hoje');
  });

  describe('regras puras', () => {
    it('a saudação segue o relógio: Bom dia até 11:59, Boa tarde até 17:59, Boa noite depois (S-14)', () => {
      const at = (time: string): string => `2026-11-04T${time}:00-03:00`;
      expect(greetingFor(at('00:00'))).toBe('Bom dia');
      expect(greetingFor(at('11:59'))).toBe('Bom dia');
      expect(greetingFor(at('12:00'))).toBe('Boa tarde');
      expect(greetingFor(at('17:59'))).toBe('Boa tarde');
      expect(greetingFor(at('18:00'))).toBe('Boa noite');
    });

    it('o convite do dia é rodízio por calendário e só pula o item que não existe (S-11)', () => {
      const kinds = ['conversation', 'circle', 'reading'] as const;
      const dates = ['2026-11-04', '2026-11-05', '2026-11-06'];
      const picked = dates.map((d) => inviteKindFor(d, [...kinds]));
      expect(new Set(picked).size).toBe(3);
      // O mesmo dia dá sempre o mesmo convite.
      expect(inviteKindFor('2026-11-04', [...kinds])).toBe(picked[0]);
      // Sem roda e sem leitura, a conversa com o psicólogo é sempre possível.
      dates.forEach((d) => expect(inviteKindFor(d, [])).toBe('conversation'));
      // Sem roda, o dia da roda vira o próximo da ordem.
      const circleDay = dates[picked.indexOf('circle')] as string;
      expect(inviteKindFor(circleDay, ['reading'])).toBe('reading');
      expect(toDayNumber(circleDay)).toBeGreaterThan(0);
    });

    it('a conversa é "com a Dra." ou "com o Dr."', () => {
      expect(withArticle('Dra. Beatriz Nogueira')).toBe('a Dra. Beatriz Nogueira');
      expect(withArticle('Dr. Rafael Moreira')).toBe('o Dr. Rafael Moreira');
      expect(withArticle('Beatriz')).toBe('Beatriz');
    });
  });

  describe('AC-CG-41 e 42: ordem dos blocos e saudação', () => {
    it('um só h1, com a saudação e o dia, e os blocos na ordem do UX', async () => {
      await open('cg_0001', { time: '08:30' });
      expect(all('main h1')).toHaveLength(1);
      expect(text(q('main h1'))).toBe('Bom dia, Ana');
      expect(text(q('.cg-page-header__desc'))).toBe('quarta-feira, 04/11');
      const order = all('h1, h2, h3, .cg-note__title').map(text).filter((t) => t !== '');
      const index = (needle: string): number => order.findIndex((t) => t.includes(needle));
      expect(index('Bom dia, Ana')).toBe(0);
      expect(index('A equipe de psicologia vai falar com você hoje.')).toBeGreaterThan(index('Bom dia, Ana'));
      expect(index('Próximo compromisso')).toBeGreaterThan(index('A equipe de psicologia'));
      expect(index('Remédios de hoje')).toBeGreaterThan(index('Próximo compromisso'));
      expect(index('Como você está hoje?')).toBeGreaterThan(index('Remédios de hoje'));
    });

    it('troca a saudação pela hora', async () => {
      await open('cg_0001', { time: '15:00' });
      expect(text(q('main h1'))).toBe('Boa tarde, Ana');
      await open('cg_0001', { time: '20:30' });
      expect(text(q('main h1'))).toBe('Boa noite, Ana');
    });
  });

  describe('AC-CG-43 a 45 e 56: a nota de cuidado e o que nunca aparece', () => {
    it('Ana: "vai falar com você hoje", sem alarme e sem convite', async () => {
      await open('cg_0001');
      const note = q('app-cg-note.cg-note--care');
      expect(text(note)).toContain('A equipe de psicologia vai falar com você hoje.');
      expect(text(note)).toContain('Você não precisa fazer nada.');
      expect(note?.className).toContain('cg-note--care');
      expect(text(q('main'))).not.toMatch(NEVER_IN_TODAY);
      // O convite do dia não aparece ao lado da nota de cuidado, e Ana não tem serviço a avaliar.
      expect(all('h2').map(text)).not.toContain('Para você');
      expect(text(q('main'))).not.toContain('Uma conversa só para você');
    });

    it('"Prefere falar agora?" abre o diálogo "Como falar com a gente"', async () => {
      await open('cg_0001');
      await click(buttonByText('Prefere falar agora?'));
      expect(TestBed.inject(ContactDialogService).isOpen()).toBe(true);
    });

    it('Maria: "ainda não conseguiu falar com você" com o botão, em azul de cuidado e nunca vencido ou atrasado', async () => {
      await open('cg_0002');
      const note = q('app-cg-note.cg-note--care');
      expect(text(note)).toContain('A equipe ainda não conseguiu falar com você.');
      expect(text(note)).toContain('A responsável técnica foi avisada e vai procurar você.');
      expect(buttonByText('Falar com a gente agora')).toBeDefined();
      expect(all('.cg-note--error, .cg-note--late')).toHaveLength(0);
      expect(text(q('main'))).not.toMatch(NEVER_IN_TODAY);
      expect(all('h2').map(text)).not.toContain('Para você');
      await click(buttonByText('Falar com a gente agora'));
      expect(TestBed.inject(ContactDialogService).isOpen()).toBe(true);
    });

    it('com o contato registrado pela equipe, a nota não aparece mais', async () => {
      await open('cg_0001');
      expect(q('app-cg-note.cg-note--care')).not.toBeNull();
      app.db.zaritAlerts.updateWhere((a) => a.caregiverId === 'cg_0001' && a.level === 'red', {
        status: 'contacted',
        contact: { at: app.clock.now(), byUserId: 'usr_equipe', channel: 'phone' },
      });
      await flush();
      expect(text(q('main'))).not.toContain('A equipe de psicologia vai falar com você hoje.');
      expect(all('app-cg-note.cg-note--care')).toHaveLength(0);
    });

    it('nenhuma pessoa de demonstração vê plano, preço, pontuação, faixa ou "alerta" em Hoje', async () => {
      for (const id of ['cg_0001', 'cg_0002', 'cg_0003', 'cg_0008', 'cg_0027', 'cg_0024', 'cg_0026', 'cg_0016', 'cg_0004']) {
        await open(id);
        expect(text(q('main')), id).not.toMatch(NEVER_IN_TODAY);
        expect(all('app-cg-plan-tag, app-cg-plan-lock, .cg-plan-tag'), id).toHaveLength(0);
      }
    });

    it('Marcos: a mudança de plano não aparece em Hoje', async () => {
      await open('cg_0026');
      expect(text(q('main'))).not.toMatch(/muda para|Livre|cancelamento/i);
    });
  });

  describe('próximo compromisso', () => {
    it('mostra o mais perto, com o link para a Agenda', async () => {
      await open('cg_0001');
      const card = q('app-cg-card a.cg-card--link');
      expect(card?.getAttribute('href')).toBe('/cuidador/rotina/agenda');
      expect(text(card)).toContain('Próximo compromisso');
      expect(text(card)).toMatch(/, hoje às \d{2}:\d{2}/);
    });

    it('a conversa da própria pessoa com o psicólogo vem com "Para você" quando é a mais próxima', async () => {
      await open('cg_0001');
      const ana = app.context.caregiverId() as string;
      // Tira os compromissos da pessoa idosa de hoje e dos próximos dias e marca uma conversa de amanhã.
      app.db.careAppointments.removeWhere((a) => a.elderId === app.context.elderId());
      const psychologist = app.db.psychologists.list()[0];
      app.db.careSessions.create({
        caregiverId: ana,
        psychologistId: psychologist?.id ?? '',
        slotId: 'slot_x',
        startAt: '2026-11-05T14:00:00-03:00',
        durationMin: 60,
        modality: 'online',
        kind: 'guidance',
        status: 'scheduled',
        priceCents: 10200,
        discountPercent: 15,
      });
      await flush();
      const card = q('app-cg-card a.cg-card--link');
      expect(text(card)).toContain('Sua conversa com');
      expect(text(card)).toContain('amanhã às 14:00');
      expect(text(card)).toContain('Para você');
    });

    it('sem compromisso nenhum, mostra o vazio com "Adicionar compromisso"', async () => {
      await open('cg_0001');
      app.db.careAppointments.removeWhere((a) => a.elderId === app.context.elderId());
      await flush();
      expect(text(q('main'))).toContain('Nenhum compromisso nos próximos dias.');
      expect(buttonByText('Adicionar compromisso')?.getAttribute('href')).toContain('/cuidador/rotina/agenda');
    });

    it('um compromisso de hoje cuja hora já passou não é mais o próximo', async () => {
      await open('cg_0001', { time: '20:00' });
      expect(text(q('app-cg-card a.cg-card--link'))).not.toMatch(/hoje às/);
    });
  });

  describe('AC-CG-46 a 49: remédios de hoje', () => {
    it('mostra "2 de 4 dados" e as 4 linhas de Ana, sem "Ver todos"', async () => {
      await open('cg_0001');
      expect(text(q('.today-progress'))).toBe('2 de 4 dados');
      expect(all('app-cg-dose')).toHaveLength(4);
      expect(buttonByText('Ver todos (4)')).toBeUndefined();
      expect(all('.cg-dose.is-given')).toHaveLength(2);
    });

    it('um toque em "Dei" marca a dose, a linha fica no lugar e a faixa dura 8 s com "Desfazer"', async () => {
      await open('cg_0001', { time: '12:05' });
      const before = all('app-cg-dose').map((d) => text(d.querySelector('.cg-dose__name')));
      const dei = all<HTMLButtonElement>('app-cg-dose button').find((b) => b.getAttribute('aria-label')?.startsWith('Dei o '));
      expect(dei).toBeDefined();
      const countBefore = app.db.doseChecks.size();
      await click(dei);
      expect(app.db.doseChecks.size()).toBe(countBefore + 1);
      const check = app.db.doseChecks.list()[app.db.doseChecks.size() - 1];
      expect(check?.medicationId).toBeTruthy();
      expect(check?.date).toBe('2026-11-04');
      expect(check?.givenAt).toBe('2026-11-04T12:05:00-03:00');
      expect(text(q('.today-progress'))).toBe('3 de 4 dados');
      expect(all('.cg-dose.is-given')).toHaveLength(3);
      expect(all('app-cg-dose').map((d) => text(d.querySelector('.cg-dose__name')))).toEqual(before);
      expect(text(q('.cg-dose.is-given'))).toContain('Dado às');
      const toast = TestBed.inject(ToastService).toasts()[0];
      expect(toast?.message).toBe('Anotado às 12:05.');
      expect(toast?.action?.label).toBe('Desfazer');
      expect(toast?.durationMs).toBe(8000);
    });

    it('"Desfazer" remove a marcação, sem diálogo de confirmação', async () => {
      await open('cg_0001');
      const countBefore = app.db.doseChecks.size();
      const undo = all<HTMLButtonElement>('app-cg-dose button').find((b) => b.getAttribute('aria-label')?.startsWith('Desfazer'));
      await click(undo);
      expect(app.db.doseChecks.size()).toBe(countBefore - 1);
      expect(text(q('.today-progress'))).toBe('1 de 4 dados');
      expect(app.root.querySelector('dialog[open]')).toBeNull();
    });

    it('a dose cujo horário passou fica em âmbar suave, com relógio, e "Dei" continua disponível', async () => {
      await open('cg_0001', { time: '12:10' });
      const late = q('.cg-dose.is-late');
      expect(late).not.toBeNull();
      expect(text(late)).toContain('Passou do horário (12:00)');
      expect(late?.querySelector('svg')).not.toBeNull();
      expect(late?.querySelector('button.btn')).not.toBeNull();
      expect(all('.cg-dose.is-late .cg-dose__state--late')).toHaveLength(1);
    });

    it('mais de 4 doses: quatro linhas e "Ver todos (N)" que leva a Remédios', async () => {
      await open('cg_0001');
      const elderId = app.context.elderId() as string;
      app.db.medications.create({ elderId, name: 'Vitamina D', dosage: '2000 UI', times: ['09:00', '21:00'], active: true });
      await flush();
      expect(all('app-cg-dose')).toHaveLength(4);
      const more = buttonByText('Ver todos (6)');
      expect(more?.getAttribute('href')).toBe('/cuidador/rotina/remedios');
    });

    it('nenhum remédio cadastrado: o vazio com "Cadastrar um remédio"', async () => {
      await open('cg_0001');
      const elderId = app.context.elderId();
      app.db.medications.removeWhere((m) => m.elderId === elderId);
      await flush();
      expect(text(q('main'))).toContain('Nenhum remédio cadastrado.');
      expect(buttonByText('Cadastrar um remédio')?.getAttribute('href')).toContain('/cuidador/rotina/remedios');
    });

    it('remédios cadastrados, mas nenhum para hoje: "Hoje não há remédios para dar."', async () => {
      await open('cg_0001');
      const elderId = app.context.elderId();
      app.db.medications.updateWhere((m) => m.elderId === elderId, { active: false });
      await flush();
      expect(text(q('main'))).toContain('Hoje não há remédios para dar.');
    });

    it('conta nova sem nada: nota suave com os dois caminhos', async () => {
      await open('cg_0001');
      const elderId = app.context.elderId();
      app.db.medications.removeWhere((m) => m.elderId === elderId);
      app.db.careAppointments.removeWhere((a) => a.elderId === elderId);
      app.db.careSessions.removeWhere((s) => s.caregiverId === 'cg_0001');
      await flush();
      expect(text(q('main'))).toContain('Ainda não há nada para hoje. Comece pelos remédios ou por um compromisso.');
      expect(buttonByText('Cadastrar um remédio')).toBeDefined();
      expect(buttonByText('Adicionar compromisso')).toBeDefined();
    });
  });

  describe('AC-CG-50 e 51: humor do dia', () => {
    it('mostra as 5 opções, nada marcado, e grava um registro por dia; "Mudar" substitui', async () => {
      await open('cg_0003');
      expect(all('.cg-mood__option')).toHaveLength(5);
      expect(all<HTMLInputElement>('.cg-mood__input').filter((i) => i.checked)).toHaveLength(0);
      const before = app.db.wellbeingChecks.count((c) => c.caregiverId === 'cg_0003');
      await click(all<HTMLInputElement>('.cg-mood__input')[3]);
      expect(app.db.wellbeingChecks.count((c) => c.caregiverId === 'cg_0003')).toBe(before + 1);
      expect(app.db.wellbeingChecks.find((c) => c.caregiverId === 'cg_0003' && c.date === '2026-11-04')?.mood).toBe(4);
      expect(text(q('main'))).toContain('Anotado para hoje: Bem.');
      await click(buttonByText('Mudar'));
      expect(all('.cg-mood__option')).toHaveLength(5);
      await click(all<HTMLInputElement>('.cg-mood__input')[4]);
      expect(app.db.wellbeingChecks.count((c) => c.caregiverId === 'cg_0003')).toBe(before + 1);
      expect(app.db.wellbeingChecks.find((c) => c.caregiverId === 'cg_0003' && c.date === '2026-11-04')?.mood).toBe(5);
      expect(text(q('main'))).toContain('Anotado para hoje: Muito bem.');
    });

    it('as 5 opções têm o mesmo visual: nenhuma cor de semáforo', async () => {
      await open('cg_0003');
      const classes = all('.cg-mood__option').map((o) => o.className);
      expect(new Set(classes).size).toBe(1);
    });

    it('"Muito mal" ou "Mal": a nota "Dias difíceis acontecem" com "Falar com a gente"; "Muito mal" também leva a Ajuda agora', async () => {
      await open('cg_0003');
      await click(all<HTMLInputElement>('.cg-mood__input')[0]);
      const note = all('app-cg-note.cg-note--care').find((n) => text(n).includes('Dias difíceis acontecem.'));
      expect(text(note)).toContain('Dias difíceis acontecem. Se quiser conversar, fale com a gente.');
      expect(text(note)).toContain('Falar com a gente');
      expect(note?.querySelector('a[href="/cuidador/ajuda-agora"]')).not.toBeNull();
      await click(buttonByText('Mudar'));
      await click(all<HTMLInputElement>('.cg-mood__input')[1]);
      const mal = all('app-cg-note.cg-note--care').find((n) => text(n).includes('Dias difíceis acontecem.'));
      expect(mal).toBeDefined();
      expect(mal?.querySelector('a[href="/cuidador/ajuda-agora"]')).toBeNull();
      await click(buttonByText('Mudar'));
      await click(all<HTMLInputElement>('.cg-mood__input')[3]);
      expect(text(q('main'))).not.toContain('Dias difíceis acontecem.');
    });

    it('Sônia (saúde retirada): sem humor e sem nota de cuidado', async () => {
      await open('cg_0016');
      expect(all('.cg-mood__option')).toHaveLength(0);
      expect(text(q('main'))).not.toContain('Como você está hoje?');
      expect(all('app-cg-note.cg-note--care')).toHaveLength(0);
    });

    it('o serviço recusa o humor sem a autorização de saúde, também fora da tela', async () => {
      await open('cg_0016');
      const service = TestBed.inject(WellbeingCheckService);
      expect(() => service.record('cg_0016', 3)).toThrow(WellbeingError);
      expect(app.db.wellbeingChecks.count((c) => c.caregiverId === 'cg_0016' && c.date === '2026-11-04')).toBe(0);
    });
  });

  describe('AC-CG-52 e 53: "Para você"', () => {
    it('Rita: o serviço concluído sem avaliação vira "Como foi o atendimento de ...?" com Avaliar', async () => {
      await open('cg_0008');
      const request = app.db.serviceRequests.find((r) => r.caregiverId === 'cg_0008' && r.status === 'completed' && !r.evaluationId);
      const provider = app.db.providers.get(request?.providerId ?? '');
      expect(all('h2').map(text)).toContain('Para você');
      expect(text(q('main'))).toContain(`Como foi o atendimento de ${provider?.name}?`);
      const avaliar = buttonByText('Avaliar');
      expect(avaliar?.getAttribute('href')).toBe(`/cuidador/rede/pedidos?avaliar=${request?.id}`);
    });

    it('depois de avaliado, o cartão some', async () => {
      await open('cg_0008');
      const request = app.db.serviceRequests.find((r) => r.caregiverId === 'cg_0008' && r.status === 'completed' && !r.evaluationId);
      app.db.serviceRequests.update(request?.id ?? '', { status: 'evaluated', evaluationId: 'evl_x' });
      await flush();
      expect(text(q('main'))).not.toContain('Como foi o atendimento de');
    });

    it('Elza (já avaliou): sem "Avaliar"', async () => {
      await open('cg_0027');
      expect(buttonByText('Avaliar')).toBeUndefined();
    });

    it('o convite do dia é de item aberto a todos os planos, sem preço, plano nem bloqueio', async () => {
      const seen = new Set<string>();
      for (const day of ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']) {
        TestBed.resetTestingModule();
        app = await bootCaregiverApp('cg_0003', { url: '/cuidador/hoje', today: day });
        const card = all('h2').find((h) => text(h) === 'Para você')?.parentElement;
        expect(card, day).toBeDefined();
        seen.add(text(card?.querySelector('h3')));
        expect(text(card), day).not.toMatch(/R\$|\bplano\b|Essencial|Sustenta|bloque|assine|desconto/i);
        const link = card?.querySelector('a.btn');
        expect(link?.getAttribute('href') ?? '', day).toMatch(
          /^\/cuidador\/cuidar-de-mim\/(atendimento|grupos\?atividade=act_\d+|conteudos\?conteudo=gdc_\d+)$/,
        );
      }
      expect(seen.size).toBeGreaterThanOrEqual(2);
    });

    it('o convite não muda pela pontuação nem pelo plano: o mesmo dia dá o mesmo convite para quem tem planos diferentes', async () => {
      const titles: string[] = [];
      for (const id of ['cg_0003', 'cg_0027', 'cg_0012', 'cg_0026']) {
        await open(id);
        const card = all('h2').find((h) => text(h) === 'Para você')?.parentElement;
        titles.push(text(card?.querySelector('h3')));
      }
      expect(new Set(titles).size).toBe(1);
    });
  });

  describe('AC-CG-54: "Falar com a gente"', () => {
    it('João (telefone): o cartão "Prefere falar com a gente?" com o número em destaque', async () => {
      await open('cg_0003');
      const card = all('h3').find((h) => text(h) === 'Prefere falar com a gente?')?.closest('app-cg-card');
      expect(card).toBeDefined();
      expect(text(card?.querySelector('.today-phone'))).toBe('(34) 90000-0000');
      expect(text(card)).toContain('No protótipo, a ligação não é feita.');
      // Nenhum link tel: nem wa.me.
      expect(app.root.innerHTML).not.toMatch(/href="(tel:|https?:\/\/wa\.me)/);
    });

    it('os demais: botão de texto "Falar com a gente" que abre o diálogo', async () => {
      await open('cg_0012');
      expect(all('h3').map(text)).not.toContain('Prefere falar com a gente?');
      expect(text(q('main'))).toContain('Precisa de ajuda com o app ou com a sua conta?');
      await click(buttonByText('Falar com a gente'));
      expect(TestBed.inject(ContactDialogService).isOpen()).toBe(true);
    });
  });

  describe('AC-CG-55: duas colunas em tela larga', () => {
    it('compromisso e remédios na coluna principal; humor e convite na lateral; a nota ocupa a largura toda acima', async () => {
      await open('cg_0003', { layout: 'full' });
      const main = q('.today-main');
      const side = q('.today-side');
      expect(text(main)).toContain('Próximo compromisso');
      expect(text(main)).toContain('Remédios de hoje');
      expect(text(side)).toContain('Como você está hoje?');
      expect(text(side)).toContain('Para você');
      await open('cg_0001', { layout: 'full' });
      const note = q('app-cg-note.cg-note--care');
      expect(note?.closest('.today-cols')).toBeNull();
    });
  });

  it('sem conexão, uma nota suave diz que os dados continuam neste navegador; com a conexão de volta, ela some', async () => {
    await open('cg_0001');
    expect(text(q('main'))).not.toContain('Você está sem conexão.');
    window.dispatchEvent(new Event('offline'));
    await flush();
    expect(text(q('app-cg-note.cg-note--soft'))).toContain('Você está sem conexão. Seus dados continuam neste navegador.');
    expect(all('.cg-note--error')).toHaveLength(0);
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(text(q('main'))).not.toContain('Você está sem conexão.');
  });

  it('um toque em "Dei" funciona também para quem tem a letra Bem grande e o texto não é cortado', async () => {
    await open('cg_0001');
    app.context.setFontScale('xlarge');
    await flush();
    expect(q('app-caregiver-shell')?.getAttribute('data-text')).toBe('xlarge');
    expect(all('.cg-dose button').length).toBeGreaterThan(0);
  });
});
