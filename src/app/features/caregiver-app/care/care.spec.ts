import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionBookingService } from '@core/care/session-booking.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './care.routes';
import { shortName } from '../state/people-format';
import { bookingErrorText } from './state/conversations.service';

/**
 * Porta de Cuidar de mim (C7, AC-CG-72 a 75) e Conversar com um psicólogo (C8, AC-CG-76 a 86): marcar em 2 passos mais a
 * folha de resumo, o preço do plano, cancelar com 24 horas, remarcar e os horários de prioridade sem etiqueta.
 */
const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Área care (Cuidar de mim e Conversar com um psicólogo)', () => {
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
  const button = (label: string, root: ParentNode = app.root): HTMLButtonElement | undefined =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => text(b) === label);
  const sheet = (heading: string): HTMLElement => {
    const found = all('app-cg-sheet').find((s) => text(s.querySelector('.cg-sheet__title')) === heading);
    if (!found) {
      throw new Error(`folha não encontrada: ${heading}`);
    }
    return found;
  };
  const isOpen = (heading: string): boolean => sheet(heading).querySelector('dialog')?.hasAttribute('open') ?? false;
  const boot = async (id: string, url = '/cuidador/cuidar-de-mim/atendimento', extra: { time?: string; today?: string } = {}): Promise<void> => {
    app = await bootCaregiverApp(id, { url, ...extra });
  };
  /** Marcar, formato e primeiro horário: deixa a folha de resumo aberta. */
  const goToSummary = async (formatTitle = 'On-line', pickIndex = 0): Promise<void> => {
    await click(q('[data-role="start-booking"]'));
    await click(all('[data-role="formats"] .cg-row').find((r) => text(r.querySelector('.cg-row__title')) === formatTitle));
    await click(all('[data-role="slot"]')[pickIndex]);
  };
  const chooseKind = async (label: string): Promise<void> => {
    const input = all('.cg-choice').find((c) => text(c.querySelector('.cg-choice__label')) === label)?.querySelector('input');
    await click(input);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  const cases = [
    { url: '/cuidador/cuidar-de-mim', final: '/cuidador/cuidar-de-mim', title: 'Cuidar de mim', signedIn: true },
    { url: '/cuidador/cuidar-de-mim/atendimento', final: '/cuidador/cuidar-de-mim/atendimento', title: 'Conversar com um psicólogo', signedIn: true },
  ];

  cases.forEach((c) => {
    it(`abre ${c.url}${c.url === c.final ? '' : ` e vai a ${c.final}`} com o título "${c.title}"`, async () => {
      app = await bootCaregiverApp(c.signedIn ? 'cg_0001' : null, { url: c.url });
      expect(app.router.url).toBe(c.final);
      expect(q('main h1')?.textContent?.trim()).toBeTruthy();
      expect(document.title).toContain(c.title);
    });
  });

  describe('A porta de Cuidar de mim (C7)', () => {
    it('AC-CG-72: exatamente 4 cartões, na ordem, cada um na rota certa, numa grade que vira 2 x 2 em tela larga', async () => {
      // Maria não tem conversa marcada no seed: o cartão de conversa fala do primeiro passo.
      await boot('cg_0002', '/cuidador/cuidar-de-mim');
      expect(text(q('main h1'))).toBe('Cuidar de mim');
      expect(text(q('.cg-page-header__desc'))).toBe('Um tempo para você, no seu ritmo.');
      const cards = all('[data-role="care-cards"] a.cg-card--link');
      expect(cards).toHaveLength(4);
      expect(cards.map((c) => text(c.querySelector('.cg-card__title')))).toEqual([
        'Conversar com um psicólogo',
        'Como estou',
        'Grupos e capacitações',
        'Conteúdos',
      ]);
      expect(cards.map((c) => c.getAttribute('href'))).toEqual([
        '/cuidador/cuidar-de-mim/atendimento',
        '/cuidador/cuidar-de-mim/como-estou',
        '/cuidador/cuidar-de-mim/grupos',
        '/cuidador/cuidar-de-mim/conteudos',
      ]);
      expect(q('[data-role="care-cards"]')?.classList.contains('cg-grid')).toBe(true);
      expect(text(q('[data-role="care-conversation"]'))).toBe('Escolha o formato e o horário.');
      expect(text(q('[data-role="care-wellbeing"]'))).toBe('Veja como o seu cansaço tem andado e conte como você está.');
      expect(text(q('[data-role="care-content"]'))).toBe('Leituras curtas sobre cuidar e sobre cuidar de você.');
      expect(text(q('main'))).toContain('Em emergência, ligue 192 (SAMU).');
    });

    it('AC-CG-73: para qualquer pessoa e plano os 4 cartões estão lá, sem cadeado, preço, selo de plano nem número', async () => {
      for (const id of ['cg_0001', 'cg_0002', 'cg_0003', 'cg_0027', 'cg_0024', 'cg_0016', 'cg_0026']) {
        await boot(id, '/cuidador/cuidar-de-mim');
        expect(all('[data-role="care-cards"] a.cg-card--link'), id).toHaveLength(4);
        const cards = text(q('[data-role="care-cards"]'));
        expect(all('.cg-plan-lock, svg[data-icon="lock"], .cg-plan-tag')).toHaveLength(0);
        expect(/R\$|plano|Plano|\d+ pontos/.test(cards), id).toBe(false);
        TestBed.resetTestingModule();
      }
    });

    it('AC-CG-74: com uma conversa marcada o cartão 1 diz o dia e a hora; sem autorização de saúde o cartão 2 diz "Acompanhamento pausado."', async () => {
      // Raimunda tem uma conversa confirmada para sex, 06/11, às 14:00 no seed.
      await boot('cg_0018', '/cuidador/cuidar-de-mim');
      expect(text(q('[data-role="care-conversation"]'))).toBe('Você tem uma conversa marcada: sex, 06/11, às 14:00.');
      TestBed.resetTestingModule();
      await boot('cg_0016', '/cuidador/cuidar-de-mim');
      expect(text(q('[data-role="care-wellbeing"]'))).toBe('Acompanhamento pausado.');
      expect(text(q('[data-role="care-conversation"]'))).toBe('Escolha o formato e o horário.');
    });

    it('AC-CG-75: quem está na lista de espera lê "Você está na lista de espera de 1 grupo."; nenhum cartão mostra pontuação, faixa ou alerta', async () => {
      await boot('cg_0024', '/cuidador/cuidar-de-mim');
      expect(text(q('[data-role="care-groups"]'))).toBe('Você está na lista de espera de 1 grupo.');
      const cards = text(q('[data-role="care-cards"]')).toLowerCase();
      ['pontos', 'sobrecarga', 'alerta', 'faixa'].forEach((w) => expect(cards.includes(w)).toBe(false));
      TestBed.resetTestingModule();
      // Maria (Essencial): a frase padrão, sem cadeado.
      await boot('cg_0002', '/cuidador/cuidar-de-mim');
      expect(text(q('[data-role="care-groups"]'))).toBe('Encontros com outras pessoas que cuidam e aulas práticas.');
      expect(all('.cg-plan-lock')).toHaveLength(0);
    });

    it('Ana e Lourdes (demonstração) já têm uma conversa marcada: a porta fala dela e Conversar mostra o cartão', async () => {
      await boot('cg_0001', '/cuidador/cuidar-de-mim');
      expect(text(q('[data-role="care-conversation"]'))).toMatch(/^Você tem uma conversa marcada: seg, 09\/11, às \d{2}:00\.$/);
      TestBed.resetTestingModule();
      await boot('cg_0024');
      const card = text(q('[data-role="next-conversation"]'));
      expect(text(q('main'))).toContain('Sua próxima conversa');
      expect(card).toContain('Dra. Letícia Amaral');
      expect(card).toContain('No espaço de coworking');
      expect(card).toContain('Confirmada');
    });

    it('quem está em grupos lê quantos são (Ana)', async () => {
      await boot('cg_0001', '/cuidador/cuidar-de-mim');
      const live = new Set(app.db.activities.query((a) => ['open', 'full', 'in_progress'].includes(a.status)).map((a) => a.id));
      const enrolled = app.db.activityEnrollments.query((e) => e.caregiverId === 'cg_0001' && e.status === 'enrolled' && live.has(e.activityId)).length;
      expect(enrolled).toBeGreaterThan(0);
      expect(text(q('[data-role="care-groups"]'))).toBe(enrolled === 1 ? 'Você está em 1 grupo.' : `Você está em ${enrolled} grupos.`);
    });
  });

  describe('Conversar com um psicólogo (C8)', () => {
    it('AC-CG-76: sem nenhuma conversa mostra o vazio acolhedor com "Marcar uma conversa" e o aviso de emergência', async () => {
      await boot('cg_0002');
      expect(text(q('main h1'))).toBe('Conversar com um psicólogo');
      expect(text(q('.cg-page-header__desc'))).toBe('As conversas são com psicólogos da Nexus, com registro no conselho de Psicologia.');
      expect(text(q('main'))).toContain('Você ainda não marcou nenhuma conversa');
      expect(text(q('[data-role="start-booking"]'))).toBe('Marcar uma conversa');
      expect(text(q('main'))).toContain('Em emergência, ligue 192 (SAMU).');
    });

    it('AC-CG-76: havendo conversa futura, o cartão "Sua próxima conversa" vem antes do botão, com dia, hora, quem e a situação', async () => {
      await boot('cg_0018');
      const card = q('[data-role="next-conversation"]');
      const start = q('[data-role="start-booking"]');
      expect(card).not.toBeNull();
      expect(card!.compareDocumentPosition(start!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(text(q('main'))).toContain('Sua próxima conversa');
      expect(text(card)).toContain('sex, 06/11, às 14:00');
      expect(text(card)).toContain('Orientação psicológica');
      expect(text(card)).toContain('No espaço de coworking');
      expect(text(q('[data-role="next-status"]'))).toBe('Confirmada');
    });

    it('AC-CG-77: Marcar mostra 3 formatos; um toque no formato leva ao horário, só de psicólogos com registro ativo', async () => {
      await boot('cg_0001');
      await click(q('[data-role="start-booking"]'));
      expect(text(q('[data-step-heading]'))).toBe('Como você prefere?');
      expect(all('[data-role="formats"] .cg-row__title').map(text)).toEqual(['On-line', 'No espaço de coworking', 'Em casa']);
      expect(all('[data-role="formats"] .cg-row__desc').map(text)).toEqual([
        'Pelo celular ou computador, de onde você estiver.',
        'Em uma sala com acesso sem degraus, em Uberlândia.',
        'O psicólogo vai até você, se for seguro e adequado.',
      ]);
      await click(all('[data-role="formats"] .cg-row')[0]);
      expect(text(q('[data-step-heading]'))).toBe('Qual horário?');
      const labels = all('[data-role="slot"]').map(text);
      expect(labels.length).toBeGreaterThan(0);
      labels.forEach((l) => expect(l).toMatch(/^\d{2}:\d{2} com (Dr|Dra)\. \S+$/));
      // Um psicólogo com registro inativo não aparece.
      TestBed.resetTestingModule();
      await boot('cg_0001');
      const rafaelSlots = app.db.availabilitySlots.query((s) => s.psychologistId === 'psy_0001' && s.status === 'open').length;
      expect(rafaelSlots).toBeGreaterThan(0);
      app.db.psychologists.update('psy_0001', { crpStatus: 'inactive' });
      await goToSummary();
      expect(all('[data-role="slot"]').map(text).some((l) => l.includes('Rafael'))).toBe(false);
    });

    it('AC-CG-77: no coworking mostra a sala com os 4 itens de acessibilidade (nunca a Jacarandá)', async () => {
      await boot('cg_0001');
      await click(q('[data-role="start-booking"]'));
      await click(all('[data-role="formats"] .cg-row')[1]);
      expect(text(q('[data-role="room"]'))).toMatch(/^Sala (Girassol|Ipê), Rua Exemplo, 120, Uberlândia$/);
      expect(text(q('[data-role="room"]'))).not.toContain('Jacarandá');
      // Sem nenhuma sala reservável, o formato não tem horário.
      TestBed.resetTestingModule();
      await boot('cg_0001');
      app.db.rooms.all().forEach((r) => app.db.rooms.update(r.id, { active: false }));
      await click(q('[data-role="start-booking"]'));
      await click(all('[data-role="formats"] .cg-row')[1]);
      expect(all('[data-role="slot"]')).toHaveLength(0);
      expect(text(q('main'))).toContain('Sem horários nesse formato nos próximos 14 dias. Escolha outro formato ou fale com a gente.');
      expect(button('Escolher outro formato')).toBeDefined();
      expect(button('Falar com a gente')).toBeDefined();
    });

    it('AC-CG-78: o horário escolhido abre a folha de resumo antes de gravar; "O que você procura?" vem vazio e não deixa gravar sem escolher', async () => {
      await boot('cg_0001');
      const before = app.db.careSessions.size();
      await goToSummary();
      expect(isOpen('Confirme a conversa')).toBe(true);
      const body = text(sheet('Confirme a conversa'));
      expect(body).toMatch(/Quando: .+, às \d{2}:\d{2} \(1 hora\)\./);
      expect(body).toMatch(/Com quem: (Dr|Dra)\. .+, (psicólogo|psicóloga) \(CRP-04\/\d+, fictício\)\./);
      expect(body).toContain('Como: On-line.');
      expect(body).toContain('O que você procura?');
      expect(body).toContain('O psicólogo confirma se o formato on-line serve para você. Se não servir, combina outro formato.');
      expect(body).toContain('O pagamento é combinado direto no atendimento. No protótipo não há cobrança.');
      expect(all<HTMLInputElement>('app-cg-sheet .cg-choice__input').some((i) => i.checked)).toBe(false);
      expect(all('app-cg-sheet .cg-choice__label').map(text)).toEqual(['Psicoterapia', 'Orientação psicológica', 'Não sei']);
      await click(q('[data-role="confirm-booking"]'));
      expect(text(q('[data-role="summary-error"]'))).toBe('Escolha uma das opções para continuar.');
      expect(app.db.careSessions.size()).toBe(before);
      expect(isOpen('Confirme a conversa')).toBe(true);
    });

    it('AC-CG-79: o Livre vê só "Total: R$ 120,00"; o Cuida vê o desconto de 15% e R$ 102,00; o Essencial 10%; o Sustenta 20%', async () => {
      const expected: [string, string | null, string][] = [
        ['cg_0003', null, 'Total: R$ 120,00.'],
        ['cg_0001', 'Desconto do plano Cuida (15%): menos R$ 18,00.', 'Total: R$ 102,00.'],
        ['cg_0002', 'Desconto do plano Essencial (10%): menos R$ 12,00.', 'Total: R$ 108,00.'],
        ['cg_0027', 'Desconto do plano Sustenta (20%): menos R$ 24,00.', 'Total: R$ 96,00.'],
      ];
      for (const [id, discount, total] of expected) {
        await boot(id);
        await goToSummary();
        expect(text(q('[data-role="summary-total"]')), id).toBe(total);
        if (discount) {
          expect(text(q('[data-role="summary-discount"]')), id).toBe(discount);
          expect(text(q('[data-role="summary-price"]'))).toContain('Conversa de 1 hora: R$ 120,00.');
        } else {
          expect(q('[data-role="summary-discount"]')).toBeNull();
          expect(text(q('[data-role="summary-price"]'))).not.toContain('Desconto');
          expect(text(sheet('Confirme a conversa'))).not.toMatch(/plano/i);
        }
        TestBed.resetTestingModule();
      }
    });

    it('AC-CG-80: Marcar conversa grava a sessão (formato, horário, tipo e preço do plano), tira o horário da lista e mostra a confirmação', async () => {
      await boot('cg_0001');
      await goToSummary();
      const slotsBefore = all('[data-role="slot"]').length;
      const slot = TestBed.inject(SessionBookingService)
        .activePsychologists()
        .flatMap((p) => TestBed.inject(SessionBookingService).freeSlots(p.id, true))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0]!;
      await chooseKind('Psicoterapia');
      await click(q('[data-role="confirm-booking"]'));
      const created = app.db.careSessions.all().at(-1)!;
      expect(created).toMatchObject({
        caregiverId: 'cg_0001',
        modality: 'online',
        kind: 'psychotherapy',
        status: 'scheduled',
        priceCents: 10200,
        discountPercent: 15,
        durationMin: 60,
      });
      expect(created.startAt.startsWith(slot.date)).toBe(true);
      expect(app.db.availabilitySlots.get(created.slotId)?.status).toBe('booked');
      expect(isOpen('Confirme a conversa')).toBe(false);
      expect(text(q('[data-role="confirmation"]'))).toMatch(/^Conversa marcada: .+, às \d{2}:\d{2}, com (a Dra\.|o Dr\.) \S+\.$/);
      expect(text(q('[data-role="confirmation-status"]'))).toBe('Aguardando confirmação do psicólogo');
      expect(q('a[href="/cuidador/rotina/agenda"]')).not.toBeNull();
      // A conversa nova é a próxima e o horário saiu da lista.
      expect(text(q('[data-role="next-conversation"]'))).toContain('Psicoterapia');
      await click(q('[data-role="start-booking"]'));
      await click(all('[data-role="formats"] .cg-row')[0]);
      expect(all('[data-role="slot"]')).toHaveLength(slotsBefore - 1);
    });

    it('"Não sei" grava orientação psicológica (S-07) e a conversa mostra o caráter', async () => {
      await boot('cg_0001');
      await goToSummary();
      await chooseKind('Não sei');
      await click(q('[data-role="confirm-booking"]'));
      expect(app.db.careSessions.all().at(-1)?.kind).toBe('guidance');
      expect(text(q('[data-role="next-conversation"]'))).toContain('Orientação psicológica');
    });

    it('AC-CG-81: horário tomado por outra pessoa no instante de gravar mostra "Esse horário acabou de ser reservado. Escolha outro." e o resumo continua', async () => {
      await boot('cg_0001');
      await goToSummary();
      await chooseKind('Orientação psicológica');
      // Outra pessoa (Rita, que também vê todos os horários) pega o mesmo horário antes.
      const booking = TestBed.inject(SessionBookingService);
      const target = booking
        .activePsychologists()
        .flatMap((p) => booking.freeSlots(p.id, true))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0]!;
      expect(booking.schedule({ caregiverId: 'cg_0008', psychologistId: target.psychologistId, slotId: target.id, modality: 'online', kind: 'guidance' }).ok).toBe(true);
      const sessions = app.db.careSessions.size();
      await click(q('[data-role="confirm-booking"]'));
      expect(text(q('[data-role="summary-error"]'))).toBe('Esse horário acabou de ser reservado. Escolha outro.');
      expect(app.db.careSessions.size()).toBe(sessions);
      expect(isOpen('Confirme a conversa')).toBe(true);
      expect(text(q('[data-role="summary-how"]'))).toBe('Como: On-line.');
    });

    it('AC-CG-84: "Em casa" pede o endereço, mostra o aviso de segurança e grava a segurança como ainda não confirmada', async () => {
      await boot('cg_0001');
      await click(q('[data-role="start-booking"]'));
      await click(all('[data-role="formats"] .cg-row')[2]);
      expect(text(q('main'))).toContain('Endereço da conversa');
      // Sem endereço não abre o resumo.
      await click(all('[data-role="slot"]')[0]);
      expect(isOpen('Confirme a conversa')).toBe(false);
      expect(text(q('.field__error'))).toContain('Informe o endereço da conversa.');
      const input = q<HTMLInputElement>('#conv-address')!;
      input.value = 'Rua das Flores, 45, Uberlândia';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
      await click(all('[data-role="slot"]')[0]);
      expect(isOpen('Confirme a conversa')).toBe(true);
      expect(text(q('[data-role="summary-place"]'))).toBe('Endereço: Rua das Flores, 45, Uberlândia.');
      expect(text(q('[data-role="summary-notice"]'))).toBe('O psicólogo confirma se o local é adequado e seguro antes de confirmar a conversa.');
      await chooseKind('Psicoterapia');
      await click(q('[data-role="confirm-booking"]'));
      const created = app.db.careSessions.all().at(-1)!;
      expect(created).toMatchObject({ modality: 'in_person_home', homeAddress: 'Rua das Flores, 45, Uberlândia', homeVisitConfirmedSafe: false, status: 'scheduled' });
    });

    it('no coworking a sessão grava a sala e o resumo mostra o local', async () => {
      await boot('cg_0001');
      await goToSummary('No espaço de coworking');
      expect(text(q('[data-role="summary-place"]'))).toMatch(/^Local: Sala (Girassol|Ipê), Rua Exemplo, 120, Uberlândia\.$/);
      await chooseKind('Psicoterapia');
      await click(q('[data-role="confirm-booking"]'));
      const created = app.db.careSessions.all().at(-1)!;
      expect(created.modality).toBe('in_person_coworking');
      expect(['room_0001', 'room_0002']).toContain(created.roomId);
    });

    it('AC-CG-82 e 83: cancelar a 24 horas ou mais diz que libera o horário sem custo, com Remarcar em vez de cancelar e Voltar; ao confirmar, a vaga volta a abrir', async () => {
      await boot('cg_0018');
      const session = app.db.careSessions.find((s) => s.caregiverId === 'cg_0018' && s.status === 'confirmed')!;
      await click(q('[data-role="next-conversation"]')?.closest('app-cg-card')?.querySelector('button'));
      expect(isOpen('Sua conversa')).toBe(true);
      await click(q('[data-role="cancel"]'));
      expect(isOpen('Cancelar a conversa?')).toBe(true);
      expect(text(q('[data-role="cancel-effect"]'))).toBe('Cancelar libera o horário. Não há custo.');
      const actions = Array.from(sheet('Cancelar a conversa?').querySelectorAll('.cg-sheet__actions button')).map(text);
      expect(actions).toEqual(['Remarcar em vez de cancelar', 'Cancelar a conversa', 'Voltar']);
      expect(text(document.activeElement)).toBe('Voltar');
      await click(q('[data-role="confirm-cancel"]'));
      expect(app.db.careSessions.require(session.id)).toMatchObject({ status: 'cancelled_by_user' });
      expect(app.db.availabilitySlots.get(session.slotId)?.status).toBe('open');
      expect(q('[data-role="next-conversation"]')).toBeNull();
      await click(q('[data-role="previous"] summary'));
      expect(text(q('[data-role="previous"]'))).toContain('Cancelada por você');
    });

    it('AC-CG-82: a menos de 24 horas a folha diz que o horário fica registrado como falta, e a conversa vira falta', async () => {
      await boot('cg_0018');
      app.clock.setSimulated('2026-11-06', '08:00');
      await flush();
      const session = app.db.careSessions.find((s) => s.caregiverId === 'cg_0018' && s.status === 'confirmed')!;
      await click(q('[data-role="next-conversation"]')?.closest('app-cg-card')?.querySelector('button'));
      await click(q('[data-role="cancel"]'));
      expect(text(q('[data-role="cancel-effect"]'))).toBe('Faltam menos de 24 horas. Se cancelar agora, o horário fica registrado como falta.');
      expect(button('Remarcar em vez de cancelar')).toBeDefined();
      expect(button('Voltar', sheet('Cancelar a conversa?'))).toBeDefined();
      await click(q('[data-role="confirm-cancel"]'));
      expect(app.db.careSessions.require(session.id).status).toBe('no_show');
    });

    it('"Voltar" na folha de cancelar não muda nada', async () => {
      await boot('cg_0018');
      const session = app.db.careSessions.find((s) => s.caregiverId === 'cg_0018' && s.status === 'confirmed')!;
      await click(q('[data-role="next-conversation"]')?.closest('app-cg-card')?.querySelector('button'));
      await click(q('[data-role="cancel"]'));
      await click(button('Voltar', sheet('Cancelar a conversa?')));
      expect(isOpen('Cancelar a conversa?')).toBe(false);
      expect(app.db.careSessions.require(session.id).status).toBe('confirmed');
    });

    it('AC-CG-83: remarcar escolhe o horário novo e só então libera o antigo; a conversa muda de horário', async () => {
      await boot('cg_0018');
      const old = app.db.careSessions.find((s) => s.caregiverId === 'cg_0018' && s.status === 'confirmed')!;
      await click(q('[data-role="next-conversation"]')?.closest('app-cg-card')?.querySelector('button'));
      await click(q('[data-role="reschedule"]'));
      expect(text(q('[data-step-heading]'))).toBe('Qual horário?');
      // O formato (coworking) e o tipo (orientação) ficam como estavam.
      expect(text(q('[data-role="room"]'))).toContain('Sala');
      await click(all('[data-role="slot"]')[0]);
      expect(isOpen('Confirme o novo horário')).toBe(true);
      expect(text(q('[data-role="summary-effect"]'))).toBe('O horário atual só é liberado depois que você marcar o novo.');
      expect(sheet('Confirme o novo horário').querySelector('app-cg-choice-group')).toBeNull();
      expect(app.db.availabilitySlots.get(old.slotId)?.status).toBe('booked');
      await click(button('Salvar novo horário'));
      const created = app.db.careSessions.all().at(-1)!;
      expect(created).toMatchObject({ caregiverId: 'cg_0018', status: 'scheduled', kind: 'guidance', modality: 'in_person_coworking' });
      expect(app.db.careSessions.require(old.id)).toMatchObject({ status: 'cancelled_by_user', rescheduledToId: created.id });
      expect(app.db.availabilitySlots.get(old.slotId)?.status).toBe('open');
      expect(text(q('[data-role="confirmation"]'))).toMatch(/^Conversa remarcada para .+, com (a Dra\.|o Dr\.) \S+\.$/);
    });

    it('remarcar a menos de 24 horas avisa antes que o horário atual fica registrado como falta', async () => {
      await boot('cg_0018');
      app.clock.setSimulated('2026-11-06', '09:00');
      await flush();
      await click(q('[data-role="next-conversation"]')?.closest('app-cg-card')?.querySelector('button'));
      await click(q('[data-role="reschedule"]'));
      // Não há vaga nova no mesmo dia: o aviso vem na folha de resumo do primeiro horário aberto.
      const slot = all('[data-role="slot"]')[0];
      expect(slot).toBeDefined();
      await click(slot);
      expect(text(q('[data-role="summary-effect"]'))).toBe('Faltam menos de 24 horas. Se remarcar agora, o horário atual fica registrado como falta.');
    });

    it('AC-CG-85: cada conversa mostra o caráter e os horários de prioridade aparecem sem etiqueta nem explicação (Rita, Cuida)', async () => {
      await boot('cg_0008');
      const booking = TestBed.inject(SessionBookingService);
      const withPriority = booking
        .activePsychologists()
        .flatMap((p) => booking.freeSlots(p.id, true))
        .filter((s) => s.priorityOnly);
      expect(withPriority.length).toBeGreaterThan(0);
      await click(q('[data-role="start-booking"]'));
      await click(all('[data-role="formats"] .cg-row')[0]);
      const page = text(q('main')).toLowerCase();
      ['prioridade', 'prioritári', 'urgente', 'destaque', 'reservado para você'].forEach((w) => expect(page.includes(w)).toBe(false));
      // Todos os horários são botões iguais, sem atributo nem classe de diferença.
      const slots = all<HTMLButtonElement>('[data-role="slot"]');
      expect(new Set(slots.map((b) => b.className)).size).toBe(1);
      expect(slots.every((b) => b.getAttribute('title') === null && b.getAttribute('aria-describedby') === null)).toBe(true);
      // O Livre sem acompanhamento prioritário (Marlene) vê menos horários e também sem etiqueta.
      const rita = all('[data-role="slot"]').length;
      TestBed.resetTestingModule();
      await boot('cg_0004');
      await click(q('[data-role="start-booking"]'));
      await click(all('[data-role="formats"] .cg-row')[0]);
      expect(all('[data-role="slot"]').length).toBeLessThan(rita);
    });

    it('quem retirou a autorização de saúde marca a conversa normalmente (Sônia): a agenda não depende dela', async () => {
      await boot('cg_0016');
      await goToSummary();
      await chooseKind('Psicoterapia');
      await click(q('[data-role="confirm-booking"]'));
      expect(app.db.careSessions.all().at(-1)).toMatchObject({ caregiverId: 'cg_0016', status: 'scheduled' });
    });

    it('AC-CG-86: a tela inteira não mostra pontuação, faixa, alerta nem a palavra paciente, nem travessão ou exclamação', async () => {
      await boot('cg_0001');
      await goToSummary();
      const body = text(q('main')).toLowerCase() + ' ' + text(sheet('Confirme a conversa')).toLowerCase();
      ['pontuação', 'pontos', 'faixa', 'alerta', 'paciente', 'sobrecarga', 'eficácia'].forEach((w) => expect(body.includes(w)).toBe(false));
      expect(/[\u2014\u2013!]/.test(body)).toBe(false);
    });

    it('o erro de horário de prioridade não explica o motivo', () => {
      expect(bookingErrorText([{ field: 'slot', message: 'Essa vaga não está disponível para este cuidador. Escolha outro horário.' }])).toEqual({
        field: 'slot',
        error: 'Esse horário não está disponível. Escolha outro.',
      });
    });

    it('shortName dá o tratamento e o primeiro nome', () => {
      expect(shortName('Dra. Beatriz Nogueira')).toBe('Dra. Beatriz');
      expect(shortName('Dr. Rafael Moreira')).toBe('Dr. Rafael');
      expect(shortName('Rafael Moreira')).toBe('Rafael');
    });
  });
});
