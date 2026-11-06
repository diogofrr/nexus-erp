import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { FakeStorage } from '../../../core/testing/test-helpers';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { dayCardHeading, dayHeading, whenText } from './state/agenda-format';
import { AgendaError, AgendaService } from './state/agenda.service';
import {
  MedicationError,
  MedicationService,
  medicationProblems,
  normalizeTimes,
} from './state/medication.service';
import { ROUTES } from './routine.routes';

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** As frases que nunca aparecem nestas telas (sem orientação de dose, sem alarme). */
const NEVER_HERE = /diagn|alerta|vencid|atrasad|urgente|pontos|pontua|sobrecarga|aumente|reduza|pare de tomar|troque o/i;

describe('Rotina (UX C5 e C6)', () => {
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
  const open = async (id: string, url: string, options: { time?: string; today?: string } = {}): Promise<void> => {
    TestBed.resetTestingModule();
    app = await bootCaregiverApp(id, { url, ...options });
  };
  /** A folha aberta (a única `dialog[open]`). */
  const sheet = (): HTMLElement => {
    const found = all('dialog[open]');
    expect(found).toHaveLength(1);
    return found[0] as HTMLElement;
  };
  const inSheet = <T extends Element = HTMLElement>(selector: string): T => {
    const el = sheet().querySelector<T>(selector);
    if (!el) {
      throw new Error(`não achei ${selector} na folha`);
    }
    return el;
  };
  const sheetButton = (label: string): HTMLElement => {
    const el = Array.from(sheet().querySelectorAll<HTMLElement>('button, a')).find((b) => text(b) === label);
    if (!el) {
      throw new Error(`não achei o botão "${label}" na folha`);
    }
    return el;
  };
  const type = async (el: HTMLInputElement, value: string): Promise<void> => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
  };
  const buttonByText = (label: string): HTMLElement | undefined =>
    all<HTMLElement>('button, a').find((b) => text(b) === label);
  const toastMessages = (): string[] => TestBed.inject(ToastService).toasts().map((t) => t.message);

  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  const cases = [
    { url: '/cuidador/rotina', final: '/cuidador/rotina/agenda', title: 'Agenda' },
    { url: '/cuidador/rotina/agenda', final: '/cuidador/rotina/agenda', title: 'Agenda' },
    { url: '/cuidador/rotina/remedios', final: '/cuidador/rotina/remedios', title: 'Remédios' },
  ];
  cases.forEach((c) => {
    it(`abre ${c.url}${c.url === c.final ? '' : ` e vai a ${c.final}`} com o título "${c.title}"`, async () => {
      await open('cg_0001', c.url);
      expect(app.router.url).toBe(c.final);
      expect(text(q('main h1'))).toBe('Rotina');
      expect(document.title).toContain(c.title);
    });
  });

  describe('regras puras e serviços', () => {
    it('o título de cada dia: Hoje, Amanhã e "sex, 06/11"', () => {
      expect(dayHeading('2026-11-04', '2026-11-04')).toBe('Hoje, qua 04/11');
      expect(dayHeading('2026-11-05', '2026-11-04')).toBe('Amanhã, qui 05/11');
      expect(dayHeading('2026-11-06', '2026-11-04')).toBe('sex, 06/11');
      expect(dayHeading('2027-01-08', '2026-11-04')).toBe('sex, 08/01/2027');
      expect(whenText('2026-11-06T15:00:00-03:00', '2026-11-04')).toBe('sex, 06/11, às 15:00');
    });

    it('o título do dia escolhido no calendário: Hoje, Amanhã e "Sexta, 6 de novembro"', () => {
      expect(dayCardHeading('2026-11-04', '2026-11-04')).toBe('Hoje, 4 de novembro');
      expect(dayCardHeading('2026-11-05', '2026-11-04')).toBe('Amanhã, 5 de novembro');
      expect(dayCardHeading('2026-11-06', '2026-11-04')).toBe('Sexta, 6 de novembro');
      expect(dayCardHeading('2026-11-08', '2026-11-04')).toBe('Domingo, 8 de novembro');
      expect(dayCardHeading('2026-11-03', '2026-11-04')).toBe('Terça, 3 de novembro');
      expect(dayCardHeading('2027-01-08', '2026-11-04')).toBe('Sexta, 8 de janeiro de 2027');
    });

    it('remédio: sem nome ou sem horário não passa; horários sem repetição e em ordem', () => {
      expect(medicationProblems({ name: ' ', times: [] })).toEqual(['name_required', 'times_required']);
      expect(medicationProblems({ name: 'Losartana', times: ['25:00'] })).toEqual(['time_format']);
      expect(medicationProblems({ name: 'Losartana', times: ['08:00'] })).toEqual([]);
      expect(normalizeTimes(['20:00', '08:00', '08:00'])).toEqual(['08:00', '20:00']);
    });

    it('a agenda valida na borda e devolve o que foi tirado para o "Desfazer"', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      const agenda = TestBed.inject(AgendaService);
      const elderId = app.context.elderId() as string;
      expect(() => agenda.add(elderId, { title: '', kind: 'other', date: '2026-11-03', time: '10:00', place: '', reminder: true })).toThrow(AgendaError);
      const created = agenda.add(elderId, { title: '  Exame  ', kind: 'medical', date: '2026-11-07', time: '09:00', place: ' Laboratório ', reminder: true });
      expect(created.title).toBe('Exame');
      expect(created.place).toBe('Laboratório');
      expect(created.at).toBe('2026-11-07T09:00:00-03:00');
      const removed = agenda.remove(created.id);
      expect(app.db.careAppointments.get(created.id)).toBeUndefined();
      agenda.restore(removed);
      expect(app.db.careAppointments.get(created.id)?.title).toBe('Exame');
    });

    it('"Dei em outro horário" só aceita hora no formato certo e que já passou', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios');
      const meds = TestBed.inject(MedicationService);
      const check = app.db.doseChecks.find((d) => d.date === '2026-11-04' && d.time === '08:00');
      expect(check).toBeDefined();
      expect(() => meds.changeGivenTime(check?.id ?? '', '8h')).toThrow(MedicationError);
      expect(() => meds.changeGivenTime(check?.id ?? '', '18:00')).toThrow('Escolha uma hora que já passou.');
      expect(meds.changeGivenTime(check?.id ?? '', '09:15').givenAt).toBe('2026-11-04T09:15:00-03:00');
    });
  });

  /** Escolhe um dia no calendário (um toque no botão do dia). */
  const pickDay = async (date: string): Promise<void> => {
    await click(q(`[data-date="${date}"]`));
  };
  /** Abre a Agenda e passa para a lista (o alternador "Lista"). */
  const openList = async (id: string, url: string, options: { time?: string; today?: string } = {}): Promise<void> => {
    await open(id, url, options);
    await click(buttonByText('Lista'));
  };
  const selectedHeading = (): string => text(q('#agenda-selected-day'));
  const dateAfter = (date: string): string => {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  };
  /** O primeiro dia a partir de `from` em que a pessoa idosa e o cuidador não têm nada marcado. */
  const freeDay = (from: string): string => {
    const busy = new Set<string>([
      ...app.db.careAppointments.list().map((a) => a.at.slice(0, 10)),
      ...app.db.careSessions.list().map((x) => x.startAt.slice(0, 10)),
    ]);
    let date = from;
    while (busy.has(date)) {
      date = dateAfter(date);
    }
    return date;
  };
  const monthTitle = (): string => text(q('.cg-cal__title'));

  describe('Agenda em calendário: AC-CG-57', () => {
    it('h1 "Rotina", as duas abas, o alternador, o calendário do mês e o botão primário do dia', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      expect(text(q('main h1'))).toBe('Rotina');
      const tabs = all('[role="tab"]');
      expect(tabs.map(text)).toEqual(['Agenda', 'Remédios']);
      expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
      expect(q('[role="tablist"]')).not.toBeNull();
      expect(q('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe('routine-tab-agenda');
      // O alternador: Calendário (marcado) e Lista.
      const toggles = all('.routine-view__btn');
      expect(toggles.map(text)).toEqual(['Calendário', 'Lista']);
      expect(toggles.map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
      expect(q('.routine-view')?.getAttribute('aria-label')).toBe('Ver a agenda como');
      // O calendário do mês de hoje, com hoje escolhido.
      expect(q('app-cg-calendar [role="grid"]')).not.toBeNull();
      expect(monthTitle()).toBe('novembro de 2026');
      expect(q('[data-date="2026-11-04"]')?.getAttribute('aria-current')).toBe('date');
      expect(q('[data-date="2026-11-04"]')?.closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('true');
      // Um só botão primário na tela: o do dia.
      expect(all('.routine-panel button.btn--primary').map(text)).toEqual(['Adicionar compromisso neste dia']);
      // O cartão do dia: hoje, com o compromisso de hoje da Ana.
      expect(selectedHeading()).toBe('Hoje, 4 de novembro');
      expect(all('.routine-selected app-cg-row').map((r) => text(r.querySelector('.cg-row__title')))).toEqual(['16:00 Sessão de fisioterapia']);
      // Em calendário não há títulos de grupo da lista.
      expect(all('main h2.routine-day')).toHaveLength(0);
    });

    it('as setas movem entre as abas', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      const first = q('#routine-tab-agenda') as HTMLElement;
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await flush();
      expect(app.router.url).toBe('/cuidador/rotina/remedios');
    });

    it('compromisso de hoje cuja hora já passou leva a etiqueta neutra "Já passou" (CXC-001), sem vermelho', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda', { time: '19:00' });
      const late = q('.routine-late');
      expect(text(late)).toBe('Já passou');
      expect(late?.querySelector('svg')).not.toBeNull();
      expect(all('.cg-note--error')).toHaveLength(0);
    });

    it('tocar noutro dia mostra a lista dele; o dia fica marcado e o cartão diz qual é', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      const apt = app.db.careAppointments.find((a) => a.elderId === app.context.elderId() && a.at.startsWith('2026-11-05')) as { title: string };
      await pickDay('2026-11-05');
      expect(selectedHeading()).toBe('Amanhã, 5 de novembro');
      expect(all('.routine-selected app-cg-row').some((r) => text(r).includes(apt.title))).toBe(true);
      expect(q('[data-date="2026-11-05"]')?.closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('true');
      expect(q('[data-date="2026-11-04"]')?.closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('false');
      await pickDay('2026-11-06');
      expect(selectedHeading()).toBe('Sexta, 6 de novembro');
      // O compromisso de amanhã não aparece mais no cartão.
      expect(all('.routine-selected app-cg-row').some((r) => text(r).includes(apt.title))).toBe(false);
    });

    it('dia vazio: "Nada marcado para este dia" e o botão de adicionar continua ali', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      await pickDay(freeDay('2026-11-12'));
      expect(text(q('.routine-selected .cg-note'))).toBe('Nada marcado para este dia');
      expect(all('.routine-selected app-cg-row')).toHaveLength(0);
      expect(all('.routine-panel button.btn--primary').map(text)).toEqual(['Adicionar compromisso neste dia']);
    });

    it('as marcas do calendário dizem o tipo no rótulo: a fisioterapia de hoje, a consulta de amanhã e a conversa "Para você"', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      expect(q('[data-date="2026-11-04"]')?.getAttribute('aria-label')).toBe('4 de novembro, quarta-feira, hoje, 1 compromisso: Fisioterapia');
      expect(q('[data-date="2026-11-05"]')?.getAttribute('aria-label')).toContain('1 compromisso: Consulta');
      expect(q('[data-date="2026-11-09"]')?.getAttribute('aria-label')).toContain('Para você');
      // A legenda só traz os tipos que aparecem no mês.
      expect(all('.cg-cal__legend li').map(text)).toEqual(expect.arrayContaining(['Consulta', 'Fisioterapia', 'Para você']));
    });

    it('sem compromisso nenhum: o calendário aparece, sem legenda, e o dia diz que não há nada marcado', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      app.db.careAppointments.removeWhere((a) => a.elderId === app.context.elderId());
      // A conversa com o psicólogo que o seed deixa para a Ana também é compromisso.
      app.db.careSessions.removeWhere((x) => x.caregiverId === app.context.caregiverId());
      await flush();
      expect(q('app-cg-calendar')).not.toBeNull();
      expect(q('.cg-cal__legend')).toBeNull();
      expect(all('.cg-cal__mark')).toHaveLength(0);
      expect(text(q('.routine-selected .cg-note'))).toBe('Nada marcado para este dia');
      expect(all('.routine-panel button.btn--primary').map(text)).toEqual(['Adicionar compromisso neste dia']);
    });

    it('dia que já passou: só se lê, sem botão de adicionar (não se marca compromisso no passado)', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      app.db.careAppointments.create({
        elderId: app.context.elderId() as string,
        title: 'Consulta de ontem',
        at: '2026-11-03T10:00:00-03:00',
        kind: 'medical',
        reminder: true,
      });
      await flush();
      await pickDay('2026-11-03');
      expect(selectedHeading()).toBe('Terça, 3 de novembro');
      expect(text(q('.routine-selected'))).toContain('Consulta de ontem');
      expect(all('.routine-selected app-cg-row')).toHaveLength(0);
      expect(all('.routine-selected .routine-plain')).toHaveLength(1);
      expect(all('.routine-panel button.btn--primary')).toHaveLength(0);
    });

    it('o teclado leva ao dia: seta, Enter e o cartão muda', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      const today = q('[data-date="2026-11-04"]') as HTMLElement;
      today.focus();
      today.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      await flush();
      const next = q('[data-date="2026-11-05"]') as HTMLElement;
      expect(document.activeElement).toBe(next);
      next.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await flush();
      expect(selectedHeading()).toBe('Amanhã, 5 de novembro');
    });

    it('Hoje, no calendário, volta ao dia de hoje; Próximo mês não troca o dia do cartão', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      await pickDay('2026-11-06');
      await click(all('app-cg-calendar button').find((b) => b.getAttribute('aria-label') === 'Próximo mês'));
      expect(monthTitle()).toBe('dezembro de 2026');
      expect(selectedHeading()).toBe('Sexta, 6 de novembro');
      await click(all('app-cg-calendar button').find((b) => text(b) === 'Hoje'));
      expect(monthTitle()).toBe('novembro de 2026');
      expect(selectedHeading()).toBe('Hoje, 4 de novembro');
    });

    it('abre o formulário direto com ?novo=1, vindo de Hoje (sem dia preenchido)', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda?novo=1');
      expect(sheet().querySelector('.cg-sheet__title')?.textContent).toContain('Novo compromisso');
      expect(inSheet<HTMLInputElement>('#apt-date').value).toBe('');
    });
  });

  describe('Agenda em calendário: AC-CG-58 a 63', () => {
    const fillNew = async (title: string, kind: number, date: string, time: string): Promise<void> => {
      await type(inSheet<HTMLInputElement>('#apt-title'), title);
      if (kind >= 0) {
        await click(sheet().querySelectorAll<HTMLInputElement>('input[type="radio"]')[kind]);
      }
      await type(inSheet<HTMLInputElement>('#apt-date'), date);
      await type(inSheet<HTMLInputElement>('#apt-time'), time);
    };
    const addButton = (): HTMLElement | undefined => buttonByText('Adicionar compromisso neste dia');

    it('"Adicionar compromisso neste dia" abre o formulário com o dia já preenchido', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      const day = freeDay('2026-11-12');
      await pickDay(day);
      await click(addButton());
      expect(text(sheet().querySelector('.cg-sheet__title'))).toBe('Novo compromisso');
      expect(inSheet<HTMLInputElement>('#apt-date').value).toBe(day);
      // O resto vem em branco, e o lembrete ligado.
      expect(inSheet<HTMLInputElement>('#apt-title').value).toBe('');
      expect(inSheet<HTMLInputElement>('#apt-time').value).toBe('');
      expect(sheet().querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')).toHaveLength(0);
      expect(inSheet('app-cg-switch button').getAttribute('aria-checked')).toBe('true');
    });

    it('adicionar: título, tipo e hora com o dia já escolhido; aparece no dia certo, com faixa de 8 s e "Desfazer"', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      await pickDay('2026-11-12');
      await click(addButton());
      expect(inSheet<HTMLInputElement>('#apt-date').value).toBe('2026-11-12');
      expect(Array.from(sheet().querySelectorAll('.routine-chip')).map(text)).toEqual(['Consulta', 'Fisioterapia', 'Psicologia', 'Outro']);
      // "Lembrar de mim" vem ligado (AC-CG-62).
      expect(inSheet('app-cg-switch button').getAttribute('aria-checked')).toBe('true');
      await fillNew('Consulta com o dentista', 0, '2026-11-12', '15:30');
      await click(sheetButton('Salvar compromisso'));
      expect(all('dialog[open]')).toHaveLength(0);
      const created = app.db.careAppointments.find((a) => a.title === 'Consulta com o dentista');
      expect(created?.at).toBe('2026-11-12T15:30:00-03:00');
      expect(created?.kind).toBe('medical');
      expect(created?.reminder).toBe(true);
      expect(created?.elderId).toBe(app.context.elderId());
      expect(selectedHeading()).toBe('Quinta, 12 de novembro');
      expect(all('app-cg-row').some((r) => text(r).includes('15:30 Consulta com o dentista'))).toBe(true);
      // O dia ganhou a marca de consulta.
      expect(q('[data-date="2026-11-12"]')?.getAttribute('aria-label')).toContain('1 compromisso: Consulta');
      const toast = TestBed.inject(ToastService).toasts()[0];
      expect(toast?.message).toBe('Compromisso salvo.');
      expect(toast?.action?.label).toBe('Desfazer');
      expect(toast?.durationMs).toBe(8000);
      toast?.action?.run();
      await flush();
      expect(app.db.careAppointments.find((a) => a.title === 'Consulta com o dentista')).toBeUndefined();
      expect(q('[data-date="2026-11-12"]')?.getAttribute('aria-label')).not.toContain('compromisso');
    });

    it('adicionar em outro mês: o calendário acompanha o dia (e o mês) do que foi salvo', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      await click(addButton());
      await fillNew('Vacina da gripe', 3, '2027-01-15', '09:00');
      await click(sheetButton('Salvar compromisso'));
      expect(monthTitle()).toBe('janeiro de 2027');
      expect(selectedHeading()).toBe('Sexta, 15 de janeiro de 2027');
      expect(q('[data-date="2027-01-15"]')?.closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('true');
      expect(all('.routine-selected app-cg-row').map((r) => text(r.querySelector('.cg-row__title')))).toEqual(['09:00 Vacina da gripe']);
    });

    it('"Onde ou com quem" é opcional e aparece como apoio do compromisso', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      await click(addButton());
      await fillNew('Fisioterapia', 1, '2026-11-10', '10:00');
      await type(inSheet<HTMLInputElement>('#apt-place'), 'Clínica Movimento Vital');
      await click(sheetButton('Salvar compromisso'));
      const row = all('app-cg-row').find((r) => text(r).includes('10:00 Fisioterapia'));
      expect(text(row?.querySelector('.cg-row__desc'))).toBe('Clínica Movimento Vital');
    });

    it('erros junto do campo e no resumo, e nada do que foi digitado é apagado (AC-CG-59)', async () => {
      await openList('cg_0001', '/cuidador/rotina/agenda');
      // Aberto da lista, o formulário vem sem o dia: o dia também é pedido.
      await click(buttonByText('Adicionar compromisso'));
      await click(sheetButton('Salvar compromisso'));
      expect(all('app-cg-sheet .field__error').map(text)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Informe o que é o compromisso.'),
          expect.stringContaining('Escolha o tipo do compromisso.'),
          expect.stringContaining('Informe o dia do compromisso.'),
          expect.stringContaining('Informe a hora do compromisso.'),
        ]),
      );
      expect(text(inSheet('app-error-summary'))).toContain('Há 4 pontos para corrigir');
      expect(app.db.careAppointments.find((a) => a.title === '')).toBeUndefined();

      // Dia que já passou e hora de hoje que já passou: as frases do UX; o título digitado fica.
      await type(inSheet<HTMLInputElement>('#apt-title'), 'Exame de vista');
      await type(inSheet<HTMLInputElement>('#apt-date'), '2026-11-03');
      await type(inSheet<HTMLInputElement>('#apt-time'), '10:00');
      await click(sheetButton('Salvar compromisso'));
      expect(text(sheet())).toContain('Escolha um dia de hoje em diante.');
      await type(inSheet<HTMLInputElement>('#apt-date'), '2026-11-04');
      await type(inSheet<HTMLInputElement>('#apt-time'), '11:00');
      await click(sheetButton('Salvar compromisso'));
      expect(text(sheet())).toContain('Escolha uma hora que ainda não passou.');
      expect(inSheet<HTMLInputElement>('#apt-title').value).toBe('Exame de vista');
      expect(inSheet<HTMLInputElement>('#apt-date').value).toBe('2026-11-04');
      expect(inSheet<HTMLInputElement>('#apt-time').value).toBe('11:00');
      // Em hora que ainda não passou, mas sem o tipo, ainda não salva.
      await type(inSheet<HTMLInputElement>('#apt-time'), '13:00');
      await click(sheetButton('Salvar compromisso'));
      expect(text(sheet())).toContain('Escolha o tipo do compromisso.');
      expect(app.db.careAppointments.find((a) => a.title === 'Exame de vista')).toBeUndefined();
      await click(sheet().querySelectorAll<HTMLInputElement>('input[type="radio"]')[2]);
      await click(sheetButton('Salvar compromisso'));
      expect(app.db.careAppointments.find((a) => a.title === 'Exame de vista')?.kind).toBe('psychological');
    });

    it('com o dia preenchido faltam só título, tipo e hora; apagar o dia traz o pedido de volta', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      await pickDay('2026-11-06');
      await click(addButton());
      await click(sheetButton('Salvar compromisso'));
      expect(text(inSheet('app-error-summary'))).toContain('Há 3 pontos para corrigir');
      expect(inSheet<HTMLInputElement>('#apt-date').value).toBe('2026-11-06');
      await type(inSheet<HTMLInputElement>('#apt-date'), '');
      await click(sheetButton('Salvar compromisso'));
      expect(text(inSheet('app-error-summary'))).toContain('Há 4 pontos para corrigir');
    });

    it('desligar "Lembrar de mim" no cadastro grava reminder falso, sem confirmação (AC-CG-62)', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      await click(addButton());
      await fillNew('Vacina', 3, '2026-11-09', '08:00');
      await click(inSheet('app-cg-switch button'));
      expect(inSheet('app-cg-switch button').getAttribute('aria-checked')).toBe('false');
      await click(sheetButton('Salvar compromisso'));
      expect(app.db.careAppointments.find((a) => a.title === 'Vacina')?.reminder).toBe(false);
      expect(all('dialog[open]')).toHaveLength(0);
    });

    it('o detalhe liga e desliga o lembrete na hora (AC-CG-62)', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      const apt = app.db.careAppointments.find((a) => a.elderId === app.context.elderId() && a.at.startsWith('2026-11-05')) as { id: string; title: string };
      await pickDay('2026-11-05');
      await click(all('app-cg-row button').find((b) => text(b).includes(apt.title)));
      expect(sheet().querySelector('.cg-sheet__title')?.textContent).toContain(apt.title);
      expect(inSheet('app-cg-switch button').getAttribute('aria-checked')).toBe('true');
      await click(inSheet('app-cg-switch button'));
      expect(app.db.careAppointments.get(apt.id)?.reminder).toBe(false);
      expect(all('dialog[open]')).toHaveLength(1);
    });

    it('remarcar muda o compromisso de lugar, o calendário vai ao dia novo, e o "Desfazer" restaura e volta ao dia de antes (AC-CG-60)', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      const apt = app.db.careAppointments.find((a) => a.elderId === app.context.elderId() && a.at.startsWith('2026-11-05')) as { id: string; title: string; at: string };
      await pickDay('2026-11-05');
      await click(all('app-cg-row button').find((b) => text(b).includes(apt.title)));
      await click(sheetButton('Remarcar'));
      expect(text(sheet().querySelector('.cg-sheet__title'))).toBe('Remarcar compromisso');
      // CXC-018: remarcar abre só o dia e a hora; o nome do compromisso aparece como texto e o resto não é pedido de novo.
      expect(text(inSheet('[data-role="reschedule-what"]'))).toBe(apt.title);
      expect(sheet().querySelector('#apt-title')).toBeNull();
      expect(sheet().querySelector('#apt-kind')).toBeNull();
      expect(sheet().querySelector('#apt-place')).toBeNull();
      expect(sheet().querySelectorAll('app-form-field')).toHaveLength(2);
      // O dia e a hora de antes já vêm preenchidos.
      expect(inSheet<HTMLInputElement>('#apt-date').value).toBe('2026-11-05');
      await type(inSheet<HTMLInputElement>('#apt-date'), '2026-11-06');
      await type(inSheet<HTMLInputElement>('#apt-time'), '15:00');
      await click(sheetButton('Salvar novo horário'));
      expect(app.db.careAppointments.get(apt.id)?.at).toBe('2026-11-06T15:00:00-03:00');
      // O calendário foi ao dia novo e o compromisso está lá.
      expect(selectedHeading()).toBe('Sexta, 6 de novembro');
      expect(all('.routine-selected app-cg-row').some((r) => text(r).includes(`15:00 ${apt.title}`))).toBe(true);
      const toast = TestBed.inject(ToastService).toasts()[0];
      expect(toast?.message).toBe('Remarcado para sex, 06/11, às 15:00.');
      expect(toast?.action?.label).toBe('Desfazer');
      toast?.action?.run();
      await flush();
      expect(app.db.careAppointments.get(apt.id)?.at).toBe(apt.at);
      expect(selectedHeading()).toBe('Amanhã, 5 de novembro');
      expect(all('.routine-selected app-cg-row').some((r) => text(r).includes(apt.title))).toBe(true);
    });

    it('tirar da agenda: folha com o efeito, foco em "Voltar", e só depois de confirmar o compromisso sai (AC-CG-61)', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      const apt = app.db.careAppointments.find((a) => a.elderId === app.context.elderId() && a.at.startsWith('2026-11-05')) as { id: string; title: string };
      await pickDay('2026-11-05');
      await click(all('app-cg-row button').find((b) => text(b).includes(apt.title)));
      await click(sheetButton('Tirar da agenda'));
      expect(text(sheet().querySelector('.cg-sheet__title'))).toBe('Tirar este compromisso da agenda?');
      expect(text(sheet())).toContain('Ele some da sua agenda e dos lembretes.');
      expect(text(document.activeElement)).toBe('Voltar');
      expect(app.db.careAppointments.get(apt.id)).toBeDefined();
      // Voltar não tira nada.
      await click(sheetButton('Voltar'));
      expect(app.db.careAppointments.get(apt.id)).toBeDefined();
      // Confirmar tira.
      await click(all('app-cg-row button').find((b) => text(b).includes(apt.title)));
      await click(sheetButton('Tirar da agenda'));
      await click(sheetButton('Tirar da agenda'));
      expect(app.db.careAppointments.get(apt.id)).toBeUndefined();
      expect(all('app-cg-row').some((r) => text(r).includes(apt.title))).toBe(false);
      // O dia continua aberto, agora sem o compromisso (e sem a marca de consulta).
      expect(selectedHeading()).toBe('Amanhã, 5 de novembro');
      expect(q('[data-date="2026-11-05"]')?.getAttribute('aria-label')).not.toContain('Consulta');
      const toast = TestBed.inject(ToastService).toasts()[0];
      expect(toast?.message).toBe('Compromisso retirado.');
      // A pessoa foi para outro dia antes de desfazer: o "Desfazer" devolve o compromisso e o calendário volta ao dia dele.
      await pickDay('2026-11-08');
      toast?.action?.run();
      await flush();
      expect(app.db.careAppointments.get(apt.id)?.title).toBe(apt.title);
      expect(selectedHeading()).toBe('Amanhã, 5 de novembro');
      expect(all('app-cg-row').some((r) => text(r).includes(apt.title))).toBe(true);
    });

    it('a conversa da própria pessoa com o psicólogo aparece com "Para você" e leva a Conversar com um psicólogo (AC-CG-63)', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      const psychologist = app.db.psychologists.find((p) => p.displayName.startsWith('Dra. Beatriz'));
      app.db.careSessions.create({
        caregiverId: 'cg_0001',
        psychologistId: psychologist?.id ?? '',
        slotId: 'slot_x',
        startAt: '2026-11-06T14:00:00-03:00',
        durationMin: 60,
        modality: 'online',
        kind: 'guidance',
        status: 'confirmed',
        priceCents: 10200,
        discountPercent: 15,
      });
      await flush();
      expect(q('[data-date="2026-11-06"]')?.getAttribute('aria-label')).toContain('Para você');
      await pickDay('2026-11-06');
      const row = all('app-cg-row').find((r) => text(r).includes('Sua conversa com a Dra. Beatriz'));
      expect(text(row)).toContain('14:00');
      expect(text(row)).toContain('Para você');
      expect(row?.querySelector('a')?.getAttribute('href')).toBe('/cuidador/cuidar-de-mim/atendimento');
    });
  });

  describe('Agenda em lista: a visão antiga continua', () => {
    it('o alternador passa para a Lista e a escolha fica guardada no navegador (e volta no próximo acesso)', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      expect(app.local.getItem('nexus-erp:caregiver-agenda-view')).toBeNull();
      await click(buttonByText('Lista'));
      expect(all('.routine-view__btn').map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
      expect(q('app-cg-calendar')).toBeNull();
      expect(app.local.getItem('nexus-erp:caregiver-agenda-view')).toBe('"list"');
      // Recarrega com o mesmo armazenamento: abre direto na lista.
      const local = app.local;
      TestBed.resetTestingModule();
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/agenda', local, seed: false });
      expect(q('app-cg-calendar')).toBeNull();
      expect(all('main h2.routine-day').length).toBeGreaterThan(0);
      // E volta ao calendário.
      await click(buttonByText('Calendário'));
      expect(q('app-cg-calendar')).not.toBeNull();
      expect(app.local.getItem('nexus-erp:caregiver-agenda-view')).toBe('"calendar"');
    });

    it('um valor guardado que não é calendário nem lista cai no calendário', async () => {
      const local = new FakeStorage();
      local.setItem('nexus-erp:caregiver-agenda-view', '"mosaico"');
      TestBed.resetTestingModule();
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/agenda', local });
      expect(q('app-cg-calendar')).not.toBeNull();
    });

    it('o dia aberto no calendário continua o mesmo depois de ir à lista e voltar', async () => {
      await open('cg_0001', '/cuidador/rotina/agenda');
      await pickDay('2026-11-06');
      await click(buttonByText('Lista'));
      await click(buttonByText('Calendário'));
      expect(selectedHeading()).toBe('Sexta, 6 de novembro');
      expect(monthTitle()).toBe('novembro de 2026');
    });

    it('h1 "Rotina", as duas abas, o botão primário e os dias com compromisso agrupados (AC-CG-57)', async () => {
      await openList('cg_0001', '/cuidador/rotina/agenda');
      expect(text(q('main h1'))).toBe('Rotina');
      expect(all('[role="tab"]').map(text)).toEqual(['Agenda', 'Remédios']);
      expect(buttonByText('Adicionar compromisso')?.className).toContain('btn--primary');
      expect(all('.routine-panel button.btn--primary')).toHaveLength(1);
      const headings = all('main h2.routine-day').map(text);
      expect(headings[0]).toBe('Hoje, qua 04/11');
      expect(headings.every((h) => /^(Hoje|Amanhã), [^\s,]+ \d\d\/\d\d$|^[^\s,]+, \d\d\/\d\d$/.test(h))).toBe(true);
      // Só os dias que têm compromisso aparecem (um título por dia, sem repetir), e cada título tem o seu compromisso.
      expect(new Set(headings).size).toBe(headings.length);
      expect(all('main section[aria-labelledby^="agenda-day-"]').every((s) => s.querySelectorAll('app-cg-row').length > 0)).toBe(true);
      // Cada compromisso mostra a hora e o título.
      expect(all('app-cg-row').every((r) => /^\d{2}:\d{2} /.test(text(r.querySelector('.cg-row__title'))))).toBe(true);
    });

    it('compromisso de hoje cuja hora já passou também leva "Já passou" na lista', async () => {
      await openList('cg_0001', '/cuidador/rotina/agenda', { time: '19:00' });
      expect(text(q('.routine-late'))).toBe('Já passou');
    });

    it('sem compromisso nenhum: o vazio acolhedor com "Adicionar compromisso"', async () => {
      await openList('cg_0001', '/cuidador/rotina/agenda');
      app.db.careAppointments.removeWhere((a) => a.elderId === app.context.elderId());
      // A conversa com o psicólogo que o seed deixa para a Ana também é compromisso.
      app.db.careSessions.removeWhere((x) => x.caregiverId === app.context.caregiverId());
      await flush();
      expect(text(q('.empty__title'))).toBe('Nenhum compromisso por aqui');
      expect(text(q('.empty__text'))).toBe('Quando você adicionar uma consulta ou uma sessão, ela aparece nesta lista.');
      expect(all('button.btn--primary').filter((b) => text(b) === 'Adicionar compromisso')).toHaveLength(1);
    });

    it('"Ver anteriores" mostra os últimos 7 dias só para ler, e "Ver mais datas" amplia para 30 dias', async () => {
      await openList('cg_0001', '/cuidador/rotina/agenda');
      const elderId = app.context.elderId() as string;
      app.db.careAppointments.create({ elderId, title: 'Consulta antiga', at: '2026-11-02T10:00:00-03:00', kind: 'medical', reminder: true });
      app.db.careAppointments.create({ elderId, title: 'Consulta longe', at: '2026-11-25T10:00:00-03:00', kind: 'medical', reminder: true });
      await flush();
      expect(text(q('main'))).not.toContain('Consulta antiga');
      expect(text(q('main'))).not.toContain('Consulta longe');
      await click(buttonByText('Ver anteriores'));
      expect(text(q('main'))).toContain('Consulta antiga');
      expect(all('.routine-plain').some((li) => text(li).includes('Consulta antiga'))).toBe(true);
      await click(buttonByText('Ver mais datas'));
      expect(text(q('main'))).toContain('Consulta longe');
      expect(buttonByText('Ver mais datas')).toBeUndefined();
    });

    it('na lista também: tocar abre o detalhe, remarcar muda o compromisso de dia e "Adicionar compromisso" abre o formulário em branco', async () => {
      await openList('cg_0001', '/cuidador/rotina/agenda');
      const apt = app.db.careAppointments.find((a) => a.elderId === app.context.elderId() && a.at.startsWith('2026-11-05')) as { id: string; title: string };
      await click(all('app-cg-row button').find((b) => text(b).includes(apt.title)));
      expect(sheet().querySelector('.cg-sheet__title')?.textContent).toContain(apt.title);
      await click(sheetButton('Remarcar'));
      await type(inSheet<HTMLInputElement>('#apt-date'), '2026-11-06');
      await type(inSheet<HTMLInputElement>('#apt-time'), '15:00');
      await click(sheetButton('Salvar novo horário'));
      expect(app.db.careAppointments.get(apt.id)?.at).toBe('2026-11-06T15:00:00-03:00');
      expect(all('main h2.routine-day').map(text)).toContain('sex, 06/11');
      await click(buttonByText('Adicionar compromisso'));
      expect(inSheet<HTMLInputElement>('#apt-date').value).toBe('');
    });
  });

  describe('Remédios: AC-CG-64 a 71', () => {
    it('aba Remédios atual, "Hoje" com todas as doses em ordem, "Todos os remédios" e o aviso fixo', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios');
      expect(all('[role="tab"]').map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
      expect(all('main h2').map(text)).toEqual(expect.arrayContaining(['Hoje', 'Todos os remédios']));
      const times = all('app-cg-dose .cg-dose__time').map(text);
      expect(times).toHaveLength(4);
      // CXC-005: o que falta vem primeiro (cada grupo em ordem de horário), depois as doses dadas.
      const given = all('app-cg-dose .cg-dose').map((d) => d.classList.contains('is-given'));
      expect(given).toEqual([false, false, true, true]);
      expect([...times.slice(0, 2)].sort()).toEqual(times.slice(0, 2));
      expect([...times.slice(2)].sort()).toEqual(times.slice(2));
      expect(text(q('main'))).toContain('O app só ajuda você a lembrar. Dúvida sobre dose ou troca de remédio: fale com o médico ou a farmácia.');
      // "Todos os remédios" repete a lista de hoje: fica recolhida atrás de um link (CXC-005).
      expect(all('app-cg-row')).toHaveLength(0);
      await click(q('[data-role="edit-toggle"]'));
      expect(all('app-cg-row')).toHaveLength(3);
      expect(buttonByText('Adicionar remédio')).toBeDefined();
    });

    it('"Dei" grava a marcação com remédio, dia, horário previsto e agora; continua depois de recarregar (AC-CG-65)', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios', { time: '12:05' });
      const before = app.db.doseChecks.size();
      await click(all('app-cg-dose button').find((b) => b.getAttribute('aria-label')?.startsWith('Dei o ')));
      expect(app.db.doseChecks.size()).toBe(before + 1);
      const check = app.db.doseChecks.list()[app.db.doseChecks.size() - 1];
      expect(check?.date).toBe('2026-11-04');
      expect(check?.time).toMatch(/^\d{2}:\d{2}$/);
      expect(check?.givenAt).toBe('2026-11-04T12:05:00-03:00');
      expect(text(q('.cg-dose.is-given:last-of-type, .cg-dose.is-given'))).toContain('Dado às');
      expect(text(q('.routine-progress'))).toBe('3 de 4 dados');
      // Recarrega o app com o mesmo armazenamento (sem gerar o seed de novo).
      const local = app.local;
      TestBed.resetTestingModule();
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/remedios', time: '12:05', local, seed: false });
      expect(text(q('.routine-progress'))).toBe('3 de 4 dados');
    });

    it('"Desfazer" remove sem confirmar; "Dei em outro horário" troca só o givenAt (AC-CG-66)', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios', { time: '12:05' });
      const undo = all<HTMLButtonElement>('app-cg-dose button').find((b) => b.getAttribute('aria-label')?.startsWith('Desfazer'));
      const before = app.db.doseChecks.size();
      await click(undo);
      expect(app.db.doseChecks.size()).toBe(before - 1);
      expect(all('dialog[open]')).toHaveLength(0);
      // A linha dada que sobrou abre a folha do outro horário.
      await click(buttonByText('Dei em outro horário: Omeprazol das 07:30') ?? all<HTMLElement>('button').find((b) => text(b).startsWith('Dei em outro horário')));
      expect(text(sheet().querySelector('.cg-sheet__title'))).toBe('Dei em outro horário');
      const field = inSheet<HTMLInputElement>('#dose-time');
      expect(field.value).toMatch(/^\d{2}:\d{2}$/);
      await type(field, '09:20');
      await click(sheetButton('Salvar horário'));
      const changed = app.db.doseChecks.query((d) => d.date === '2026-11-04' && d.givenAt === '2026-11-04T09:20:00-03:00');
      expect(changed).toHaveLength(1);
      expect(changed[0]?.time).not.toBe('09:20');
      expect(all('dialog[open]')).toHaveLength(0);
    });

    it('"Dei em outro horário" recusa hora de hoje que ainda não chegou', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios', { time: '12:05' });
      await click(all<HTMLElement>('button').find((b) => text(b).startsWith('Dei em outro horário')));
      await type(inSheet<HTMLInputElement>('#dose-time'), '18:00');
      await click(sheetButton('Salvar horário'));
      expect(text(sheet())).toContain('Escolha uma hora que já passou.');
      expect(all('dialog[open]')).toHaveLength(1);
    });

    it('adicionar remédio: nome, dose e horário; entra em "Todos os remédios" e as doses de hoje aparecem (AC-CG-67)', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios', { time: '12:05' });
      await click(buttonByText('Adicionar remédio'));
      expect(text(sheet().querySelector('.cg-sheet__title'))).toBe('Novo remédio');
      expect(Array.from(sheet().querySelectorAll('.routine-time')).map(text)).toEqual(['Manhã 08:00', 'Tarde 14:00', 'Noite 20:00']);
      await type(inSheet<HTMLInputElement>('#med-name'), 'Vitamina D');
      await type(inSheet<HTMLInputElement>('#med-dosage'), '2000 UI');
      await click(sheet().querySelectorAll<HTMLInputElement>('.routine-time input')[2]);
      await type(inSheet<HTMLInputElement>('#med-other'), '21:30');
      await click(sheetButton('Incluir horário'));
      expect(Array.from(sheet().querySelectorAll('.routine-time')).map(text)).toContain('21:30');
      await click(sheetButton('Salvar remédio'));
      expect(all('dialog[open]')).toHaveLength(0);
      const med = app.db.medications.find((m) => m.name === 'Vitamina D');
      expect(med?.times).toEqual(['20:00', '21:30']);
      expect(med?.dosage).toBe('2000 UI');
      expect(med?.active).toBe(true);
      expect(med?.elderId).toBe(app.context.elderId());
      await click(q('[data-role="edit-toggle"]'));
      expect(all('app-cg-row').some((r) => text(r).includes('Vitamina D'))).toBe(true);
      expect(all('app-cg-dose').filter((d) => text(d).includes('Vitamina D'))).toHaveLength(2);
      expect(toastMessages()).toContain('Remédio salvo.');
    });

    it('sem nome ou sem horário aparecem os erros, junto do campo e no resumo, e o digitado fica', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios');
      await click(buttonByText('Adicionar remédio'));
      await type(inSheet<HTMLInputElement>('#med-dosage'), '10 mg');
      await click(sheetButton('Salvar remédio'));
      const errors = all('app-cg-sheet .field__error').map(text);
      expect(errors.some((e) => e.includes('Informe o nome do remédio.'))).toBe(true);
      expect(errors.some((e) => e.includes('Escolha pelo menos um horário.'))).toBe(true);
      expect(text(inSheet('app-error-summary'))).toContain('Há 2 pontos para corrigir');
      expect(inSheet<HTMLInputElement>('#med-dosage').value).toBe('10 mg');
      expect(app.db.medications.find((m) => m.dosage === '10 mg')).toBeUndefined();
      await type(inSheet<HTMLInputElement>('#med-other'), '');
      await click(sheetButton('Incluir horário'));
      expect(text(sheet())).toContain('Informe uma hora no formato 08:00.');
    });

    it('a chave "em uso" desligada põe em pausa: sai de Hoje, o histórico fica e não existe apagar (AC-CG-68)', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios');
      const med = app.db.medications.find((m) => m.elderId === app.context.elderId() && m.name === 'Omeprazol');
      const checksBefore = app.db.doseChecks.count((d) => d.medicationId === med?.id);
      expect(checksBefore).toBeGreaterThan(0);
      await click(q('[data-role="edit-toggle"]'));
      await click(all('app-cg-row button').find((b) => text(b).includes('Omeprazol')));
      expect(text(sheet().querySelector('.cg-sheet__title'))).toBe('Editar remédio');
      expect(inSheet<HTMLInputElement>('#med-name').value).toBe('Omeprazol');
      await click(inSheet('app-cg-switch button'));
      expect(text(sheet())).toContain('Em pausa. Ele não aparece em Hoje nem gera lembrete. O histórico fica guardado.');
      await click(sheetButton('Salvar alterações'));
      expect(app.db.medications.get(med?.id ?? '')?.active).toBe(false);
      expect(app.db.medications.get(med?.id ?? '')).toBeDefined();
      expect(app.db.doseChecks.count((d) => d.medicationId === med?.id)).toBe(checksBefore);
      expect(all('app-cg-dose').some((d) => text(d).includes('Omeprazol'))).toBe(false);
      expect(buttonByText('Ver os remédios em pausa (1)')).toBeDefined();
      await click(buttonByText('Ver os remédios em pausa (1)'));
      expect(all('app-cg-row').some((r) => text(r).includes('Omeprazol') && text(r).includes('Em pausa'))).toBe(true);
      expect(all('button, a').filter((b) => /apagar|excluir|remover|deletar/i.test(text(b)))).toHaveLength(0);
    });

    it('sem remédio cadastrado: o vazio com "Cadastrar um remédio"; sem dose hoje: "Hoje não há remédios para dar." (AC-CG-69)', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios');
      app.db.medications.updateWhere((m) => m.elderId === app.context.elderId(), { active: false });
      await flush();
      expect(text(q('main'))).toContain('Hoje não há remédios para dar.');
      app.db.medications.removeWhere((m) => m.elderId === app.context.elderId());
      await flush();
      expect(text(q('.empty__title'))).toBe('Você ainda não cadastrou remédios');
      expect(text(q('.empty__text'))).toBe('Cadastre os remédios e o app mostra, a cada dia, os horários de cada um.');
      expect(buttonByText('Cadastrar um remédio')?.className).toContain('btn--primary');
      // O aviso fixo continua.
      expect(text(q('main'))).toContain('O app só ajuda você a lembrar.');
    });

    it('não há campo de diagnóstico, de motivo nem de orientação de dose (AC-CG-70)', async () => {
      await open('cg_0001', '/cuidador/rotina/remedios');
      await click(buttonByText('Adicionar remédio'));
      const labels = all('app-cg-sheet label, app-cg-sheet legend').map(text).join(' | ');
      expect(labels).not.toMatch(/diagn|motivo|para que serve|orienta/i);
      expect(text(q('main'))).not.toMatch(NEVER_HERE);
    });

    it('João (pouca familiaridade digital) vê as doses na variante grande: hora em 22 px e Dei de 96 px (UX C6, por pessoa)', async () => {
      await open('cg_0003', '/cuidador/rotina/remedios');
      expect(all('.cg-dose').length).toBeGreaterThan(0);
      expect(all('.cg-dose').every((d) => d.classList.contains('cg-dose--large'))).toBe(true);
      await open('cg_0001', '/cuidador/rotina/remedios');
      expect(all('.cg-dose--large')).toHaveLength(0);
    });

    it('a dose cujo horário passou fica em âmbar suave, com relógio, e "Dei" continua (AC-CG-71)', async () => {
      await open('cg_0003', '/cuidador/rotina/remedios', { time: '13:00' });
      const late = q('.cg-dose.is-late');
      expect(text(late)).toContain('Ainda não anotado');
      expect(text(late)).not.toMatch(/passou/i);
      expect(late?.querySelector('button.btn')?.getAttribute('aria-label')).toContain('Dei o ');
      expect(all('.cg-note--error')).toHaveLength(0);
    });
  });

  it('sem conexão, as duas abas avisam com uma nota suave e os dados continuam', async () => {
    for (const url of ['/cuidador/rotina/agenda', '/cuidador/rotina/remedios']) {
      await open('cg_0001', url);
      window.dispatchEvent(new Event('offline'));
      await flush();
      expect(text(q('main')), url).toContain('Você está sem conexão. Seus dados continuam neste navegador.');
      window.dispatchEvent(new Event('online'));
      await flush();
      expect(text(q('main')), url).not.toContain('Você está sem conexão.');
    }
  });

  it('nenhuma das duas abas usa as palavras proibidas nem fala de plano', async () => {
    for (const url of ['/cuidador/rotina/agenda', '/cuidador/rotina/remedios']) {
      await open('cg_0002', url);
      expect(text(q('main')), url).not.toMatch(NEVER_HERE);
      expect(text(q('main')), url).not.toMatch(/R\$|\bplano\b/i);
    }
  });
});
