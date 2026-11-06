import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { configureCoreTest } from '../../../core/testing/test-helpers';
import {
  CG_CALENDAR_KIND_LABELS,
  CG_CALENDAR_KINDS,
  CgCalendarComponent,
  CgCalendarEvent,
  calendarDayLabel,
} from './cg-calendar.component';

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Hoje, nos testes, é quarta-feira, 04/11/2026 (novembro de 2026 começa num domingo e tem 5 linhas). */
function mount(options: { today?: string; events?: CgCalendarEvent[]; selected?: string | null } = {}): ComponentFixture<CgCalendarComponent> {
  // Um teste pode montar duas vezes (um mês com compromissos e outro sem): cada montagem começa limpa.
  TestBed.resetTestingModule();
  configureCoreTest({ today: options.today ?? '2026-11-04', time: '12:00' });
  const fixture = TestBed.createComponent(CgCalendarComponent);
  fixture.componentRef.setInput('events', options.events ?? []);
  if (options.selected !== undefined) {
    fixture.componentRef.setInput('selected', options.selected);
  }
  fixture.detectChanges();
  return fixture;
}

describe('Calendário do kit do cuidador (app-cg-calendar)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const root = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;
  const all = <T extends Element = HTMLElement>(f: ComponentFixture<unknown>, selector: string): T[] =>
    Array.from(root(f).querySelectorAll<T>(selector));
  const day = (f: ComponentFixture<unknown>, date: string): HTMLButtonElement => {
    const el = root(f).querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
    if (!el) {
      throw new Error(`o dia ${date} não está na grade`);
    }
    return el;
  };
  const title = (f: ComponentFixture<unknown>): string => text(root(f).querySelector('.cg-cal__title'));
  const settle = async (f: ComponentFixture<unknown>): Promise<void> => {
    for (let i = 0; i < 3; i += 1) {
      f.detectChanges();
      await f.whenStable();
    }
  };
  const press = async (f: ComponentFixture<unknown>, el: Element, key: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    await settle(f);
    return event;
  };
  const click = async (f: ComponentFixture<unknown>, el: Element): Promise<void> => {
    (el as HTMLElement).click();
    await settle(f);
  };
  const button = (f: ComponentFixture<unknown>, label: string): HTMLButtonElement => {
    const el = all<HTMLButtonElement>(f, 'button').find((b) => b.getAttribute('aria-label') === label || text(b) === label);
    if (!el) {
      throw new Error(`não achei o botão "${label}"`);
    }
    return el;
  };
  const activeDate = (): string | undefined => (document.activeElement as HTMLElement | null)?.dataset['date'];

  describe('cabeçalho e grade', () => {
    it('mostra o mês e o ano por extenso e os botões Mês anterior, Próximo mês e Hoje', () => {
      const f = mount();
      expect(title(f)).toBe('novembro de 2026');
      expect(all(f, 'button.cg-cal__step').map((b) => b.getAttribute('aria-label'))).toEqual(['Mês anterior', 'Próximo mês']);
      expect(text(root(f).querySelector('button.cg-cal__today'))).toBe('Hoje');
      // O mês fala por aria-live para quem não enxerga a troca.
      expect(root(f).querySelector('.cg-cal__title')?.getAttribute('aria-live')).toBe('polite');
    });

    it('é uma grade: role grid com uma linha de dias da semana e 5 linhas de 7 células, domingo primeiro', () => {
      const f = mount();
      const grid = root(f).querySelector('[role="grid"]');
      expect(grid).not.toBeNull();
      expect(grid?.getAttribute('aria-labelledby')).toBe(root(f).querySelector('.cg-cal__title')?.id);
      const rows = all(f, '[role="row"]');
      expect(rows).toHaveLength(6);
      expect(all(f, '[role="columnheader"]').map(text)).toEqual(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']);
      expect(all(f, '[role="columnheader"]').map((c) => c.getAttribute('aria-label'))[0]).toBe('domingo');
      expect(all(f, '[role="gridcell"]')).toHaveLength(35);
      // Cada célula tem um botão com o número do dia.
      expect(all(f, '[role="gridcell"] > button')).toHaveLength(35);
      expect(text(day(f, '2026-11-01').querySelector('.cg-cal__num'))).toBe('1');
      expect(rows[1]?.querySelector('[data-date]')?.getAttribute('data-date')).toBe('2026-11-01');
    });

    it('os dias do mês anterior e do seguinte aparecem esmaecidos', () => {
      const f = mount();
      const faded = all(f, '.cg-cal__day.is-other').map((b) => b.dataset['date']);
      expect(faded).toEqual(['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05']);
      expect(day(f, '2026-11-15').classList.contains('is-other')).toBe(false);
    });

    it('hoje leva aria-current="date" e só ele; sem dia escolhido, nenhum fica com aria-selected', () => {
      const f = mount();
      const current = all(f, '[aria-current="date"]');
      expect(current).toHaveLength(1);
      expect(current[0]?.getAttribute('data-date')).toBe('2026-11-04');
      expect(current[0]?.classList.contains('is-today')).toBe(true);
      expect(all(f, '[role="gridcell"][aria-selected="true"]')).toHaveLength(0);
      expect(all(f, '[role="gridcell"][aria-selected="false"]')).toHaveLength(35);
    });

    it('hoje vem do relógio do sistema: com o relógio em 31/12 a grade abre em dezembro', () => {
      const f = mount({ today: '2026-12-31' });
      expect(title(f)).toBe('dezembro de 2026');
      expect(root(f).querySelector('[aria-current="date"]')?.getAttribute('data-date')).toBe('2026-12-31');
    });

    it('sem nenhuma cor sozinha: nenhum texto com travessão, exclamação ou emoji', () => {
      const f = mount({ events: [{ date: '2026-11-04', kind: 'medical' }] });
      expect(text(root(f))).not.toMatch(/[\u2013\u2014!]/);
      expect(all(f, '[aria-label]').map((e) => e.getAttribute('aria-label')).join(' ')).not.toMatch(/[\u2013\u2014!]/);
    });
  });

  describe('rótulos para leitor de tela', () => {
    it('um dia sem compromisso diz só o dia por extenso; hoje diz "hoje"', () => {
      const f = mount();
      expect(day(f, '2026-11-07').getAttribute('aria-label')).toBe('7 de novembro, sábado');
      expect(day(f, '2026-11-04').getAttribute('aria-label')).toBe('4 de novembro, quarta-feira, hoje');
    });

    it('um dia com compromisso diz quantos são e o nome de cada tipo, nunca só a cor', () => {
      const f = mount({
        events: [
          { date: '2026-11-06', kind: 'medical' },
          { date: '2026-11-06', kind: 'physio' },
          { date: '2026-11-09', kind: 'you' },
        ],
      });
      expect(day(f, '2026-11-06').getAttribute('aria-label')).toBe('6 de novembro, sexta-feira, 2 compromissos: Consulta e Fisioterapia');
      expect(day(f, '2026-11-09').getAttribute('aria-label')).toBe('9 de novembro, segunda-feira, 1 compromisso: Para você');
      // As marcas são só desenho: o rótulo do botão é que fala.
      expect(day(f, '2026-11-06').querySelector('.cg-cal__marks')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('a função do rótulo junta os tipos sem repetir, na ordem da legenda', () => {
      expect(calendarDayLabel('2026-11-06', false, ['physio', 'medical', 'medical'])).toBe(
        '6 de novembro, sexta-feira, 3 compromissos: Consulta e Fisioterapia',
      );
      expect(calendarDayLabel('2026-11-04', true, ['you', 'other', 'psychological'])).toBe(
        '4 de novembro, quarta-feira, hoje, 3 compromissos: Psicologia, Para você e Outro',
      );
    });

    it('cada tipo tem o seu nome escrito', () => {
      expect(CG_CALENDAR_KINDS.map((k) => CG_CALENDAR_KIND_LABELS[k])).toEqual(['Consulta', 'Fisioterapia', 'Psicologia', 'Para você', 'Outro']);
    });
  });

  describe('marcas e legenda', () => {
    it('uma marca por compromisso, com o tipo em data-kind, na ordem dos compromissos', () => {
      const f = mount({
        events: [
          { date: '2026-11-06', kind: 'physio' },
          { date: '2026-11-06', kind: 'medical' },
          { date: '2026-11-06', kind: 'you' },
        ],
      });
      const marks = day(f, '2026-11-06').querySelectorAll('.cg-cal__mark');
      expect(Array.from(marks).map((m) => m.getAttribute('data-kind'))).toEqual(['physio', 'medical', 'you']);
      expect(day(f, '2026-11-06').classList.contains('has-events')).toBe(true);
      expect(day(f, '2026-11-07').classList.contains('has-events')).toBe(false);
      expect(day(f, '2026-11-07').querySelectorAll('.cg-cal__mark')).toHaveLength(0);
    });

    it('passando de 3 compromissos mostra duas marcas e a contagem do que falta', () => {
      const f = mount({
        events: Array.from({ length: 5 }, (_v, i) => ({ date: '2026-11-10', kind: (['medical', 'physio', 'other', 'other', 'you'] as const)[i] ?? 'other' })),
      });
      const cell = day(f, '2026-11-10');
      expect(cell.querySelectorAll('.cg-cal__mark')).toHaveLength(2);
      expect(text(cell.querySelector('.cg-cal__more'))).toBe('+3');
      expect(cell.getAttribute('aria-label')).toBe('10 de novembro, terça-feira, 5 compromissos: Consulta, Fisioterapia, Para você e Outro');
      // Exatamente 3: três marcas, sem contagem.
      const three = mount({ events: [1, 2, 3].map(() => ({ date: '2026-11-10', kind: 'other' as const })) });
      expect(day(three, '2026-11-10').querySelectorAll('.cg-cal__mark')).toHaveLength(3);
      expect(day(three, '2026-11-10').querySelector('.cg-cal__more')).toBeNull();
    });

    it('sem compromisso à vista não há legenda; com compromisso, só os tipos que aparecem, na ordem fixa', () => {
      const empty = mount();
      expect(empty.nativeElement.querySelector('.cg-cal__legend')).toBeNull();
      const f = mount({
        events: [
          { date: '2026-11-06', kind: 'other' },
          { date: '2026-11-07', kind: 'medical' },
          { date: '2026-11-09', kind: 'you' },
        ],
      });
      const legend = root(f).querySelector('.cg-cal__legend');
      expect(legend?.getAttribute('aria-label')).toBe('Tipos de compromisso');
      expect(all(f, '.cg-cal__legend li').map(text)).toEqual(['Consulta', 'Para você', 'Outro']);
      expect(all(f, '.cg-cal__legend .cg-cal__mark').map((m) => m.getAttribute('data-kind'))).toEqual(['medical', 'you', 'other']);
    });

    it('compromisso de um mês longe não faz legenda neste mês', async () => {
      const f = mount({ events: [{ date: '2027-03-10', kind: 'medical' }] });
      expect(root(f).querySelector('.cg-cal__legend')).toBeNull();
      f.componentRef.setInput('selected', '2027-03-01');
      await settle(f);
      expect(all(f, '.cg-cal__legend li').map(text)).toEqual(['Consulta']);
    });

    it('um tipo que só entrou na contagem "+3" também consta na legenda', () => {
      const f = mount({
        events: [
          { date: '2026-11-10', kind: 'medical' },
          { date: '2026-11-10', kind: 'medical' },
          { date: '2026-11-10', kind: 'medical' },
          { date: '2026-11-10', kind: 'medical' },
          { date: '2026-11-10', kind: 'physio' },
        ],
      });
      expect(all(f, '.cg-cal__legend li').map(text)).toEqual(['Consulta', 'Fisioterapia']);
    });
  });

  describe('escolher o dia', () => {
    it('tocar num dia o escolhe: aria-selected só nele, e o valor sai por selected', async () => {
      const f = mount();
      await click(f, day(f, '2026-11-06'));
      expect(f.componentInstance.selected()).toBe('2026-11-06');
      expect(all(f, '[role="gridcell"][aria-selected="true"]')).toHaveLength(1);
      expect(day(f, '2026-11-06').closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('true');
      expect(day(f, '2026-11-06').classList.contains('is-selected')).toBe(true);
      await click(f, day(f, '2026-11-12'));
      expect(f.componentInstance.selected()).toBe('2026-11-12');
      expect(all(f, '[role="gridcell"][aria-selected="true"]')).toHaveLength(1);
      expect(day(f, '2026-11-06').classList.contains('is-selected')).toBe(false);
    });

    it('escolher um dia esmaecido leva a grade ao mês dele', async () => {
      const f = mount();
      await click(f, day(f, '2026-12-02'));
      expect(f.componentInstance.selected()).toBe('2026-12-02');
      expect(title(f)).toBe('dezembro de 2026');
      expect(day(f, '2026-12-02').classList.contains('is-selected')).toBe(true);
    });

    it('a grade acompanha o dia escolhido por fora (por exemplo, depois de adicionar em outro mês)', async () => {
      const f = mount({ selected: '2026-11-06' });
      expect(title(f)).toBe('novembro de 2026');
      f.componentRef.setInput('selected', '2027-02-14');
      await settle(f);
      expect(title(f)).toBe('fevereiro de 2027');
      expect(day(f, '2027-02-14').classList.contains('is-selected')).toBe(true);
    });

    it('Enter e Espaço escolhem o dia onde o foco está', async () => {
      const f = mount();
      await press(f, day(f, '2026-11-10'), 'Enter');
      expect(f.componentInstance.selected()).toBe('2026-11-10');
      const space = await press(f, day(f, '2026-11-11'), ' ');
      expect(f.componentInstance.selected()).toBe('2026-11-11');
      expect(space.defaultPrevented).toBe(true);
    });
  });

  describe('trocar de mês', () => {
    it('Próximo mês e Mês anterior andam um mês e não mudam o dia escolhido', async () => {
      const f = mount({ selected: '2026-11-06' });
      await click(f, button(f, 'Próximo mês'));
      expect(title(f)).toBe('dezembro de 2026');
      expect(f.componentInstance.selected()).toBe('2026-11-06');
      await click(f, button(f, 'Mês anterior'));
      await click(f, button(f, 'Mês anterior'));
      expect(title(f)).toBe('outubro de 2026');
      expect(f.componentInstance.selected()).toBe('2026-11-06');
    });

    it('janeiro volta a dezembro do ano anterior e dezembro vai a janeiro do ano seguinte', async () => {
      const f = mount({ selected: '2027-01-10' });
      expect(title(f)).toBe('janeiro de 2027');
      await click(f, button(f, 'Mês anterior'));
      expect(title(f)).toBe('dezembro de 2026');
      await click(f, button(f, 'Próximo mês'));
      expect(title(f)).toBe('janeiro de 2027');
      await click(f, button(f, 'Mês anterior'));
      await click(f, button(f, 'Próximo mês'));
      await click(f, button(f, 'Próximo mês'));
      expect(title(f)).toBe('fevereiro de 2027');
    });

    it('Hoje volta ao mês de hoje e escolhe o dia de hoje', async () => {
      const f = mount({ selected: '2027-03-15' });
      expect(title(f)).toBe('março de 2027');
      await click(f, button(f, 'Hoje'));
      expect(title(f)).toBe('novembro de 2026');
      expect(f.componentInstance.selected()).toBe('2026-11-04');
      expect(day(f, '2026-11-04').closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('true');
    });

    it('Hoje também volta ao mês de hoje quando a pessoa só andou pelos meses e o dia de hoje já estava escolhido', async () => {
      const f = mount({ selected: '2026-11-04' });
      await click(f, button(f, 'Próximo mês'));
      await click(f, button(f, 'Próximo mês'));
      expect(title(f)).toBe('janeiro de 2027');
      await click(f, button(f, 'Hoje'));
      expect(title(f)).toBe('novembro de 2026');
    });

    it('o número de linhas acompanha o mês: agosto de 2026 tem 6 e novembro de 2026 tem 5', async () => {
      const f = mount({ selected: '2026-08-10' });
      expect(all(f, '[role="gridcell"]')).toHaveLength(42);
      await click(f, button(f, 'Próximo mês'));
      await click(f, button(f, 'Próximo mês'));
      await click(f, button(f, 'Próximo mês'));
      expect(title(f)).toBe('novembro de 2026');
      expect(all(f, '[role="gridcell"]')).toHaveLength(35);
    });
  });

  describe('teclado', () => {
    it('só um dia entra na ordem do Tab (tabindex 0): o escolhido, ou hoje, ou o dia 1', async () => {
      const f = mount();
      const stops = (): (string | undefined)[] => all(f, '.cg-cal__day').filter((b) => b.getAttribute('tabindex') === '0').map((b) => b.dataset['date']);
      expect(stops()).toEqual(['2026-11-04']);
      await click(f, day(f, '2026-11-12'));
      expect(stops()).toEqual(['2026-11-12']);
      f.componentRef.setInput('selected', null);
      await click(f, button(f, 'Próximo mês'));
      expect(stops()).toEqual(['2026-12-01']);
    });

    it('as setas movem o foco um dia e uma semana, sem escolher o dia', async () => {
      const f = mount();
      const start = day(f, '2026-11-10');
      start.focus();
      await press(f, start, 'ArrowRight');
      expect(activeDate()).toBe('2026-11-11');
      await press(f, day(f, '2026-11-11'), 'ArrowLeft');
      expect(activeDate()).toBe('2026-11-10');
      await press(f, day(f, '2026-11-10'), 'ArrowDown');
      expect(activeDate()).toBe('2026-11-17');
      await press(f, day(f, '2026-11-17'), 'ArrowUp');
      expect(activeDate()).toBe('2026-11-10');
      expect(f.componentInstance.selected()).toBeNull();
      // O tabindex 0 acompanha o foco.
      expect(day(f, '2026-11-10').getAttribute('tabindex')).toBe('0');
      expect(all(f, '.cg-cal__day').filter((b) => b.getAttribute('tabindex') === '0')).toHaveLength(1);
    });

    it('a seta prevenida: a página não rola junto', async () => {
      const f = mount();
      const event = await press(f, day(f, '2026-11-10'), 'ArrowDown');
      expect(event.defaultPrevented).toBe(true);
      const other = await press(f, day(f, '2026-11-17'), 'a');
      expect(other.defaultPrevented).toBe(false);
    });

    it('Home vai ao domingo e End ao sábado da semana', async () => {
      const f = mount();
      await press(f, day(f, '2026-11-11'), 'Home');
      expect(activeDate()).toBe('2026-11-08');
      await press(f, day(f, '2026-11-08'), 'End');
      expect(activeDate()).toBe('2026-11-14');
    });

    it('a seta que passa do fim do mês leva o foco ao mês seguinte e troca o título', async () => {
      const f = mount();
      await press(f, day(f, '2026-11-30'), 'ArrowRight');
      expect(title(f)).toBe('dezembro de 2026');
      expect(activeDate()).toBe('2026-12-01');
      expect(day(f, '2026-12-01').getAttribute('tabindex')).toBe('0');
      await press(f, day(f, '2026-12-01'), 'ArrowLeft');
      expect(title(f)).toBe('novembro de 2026');
      expect(activeDate()).toBe('2026-11-30');
    });

    it('PageDown e PageUp andam um mês levando o foco; na virada do ano troca o ano', async () => {
      const f = mount({ selected: '2026-12-15' });
      expect(title(f)).toBe('dezembro de 2026');
      await press(f, day(f, '2026-12-15'), 'PageDown');
      expect(title(f)).toBe('janeiro de 2027');
      expect(activeDate()).toBe('2027-01-15');
      await press(f, day(f, '2027-01-15'), 'PageUp');
      expect(title(f)).toBe('dezembro de 2026');
      expect(activeDate()).toBe('2026-12-15');
    });

    it('PageDown num dia 31 cai no último dia do mês curto', async () => {
      const f = mount({ selected: '2026-01-31' });
      await press(f, day(f, '2026-01-31'), 'PageDown');
      expect(title(f)).toBe('fevereiro de 2026');
      expect(activeDate()).toBe('2026-02-28');
    });
  });
});
