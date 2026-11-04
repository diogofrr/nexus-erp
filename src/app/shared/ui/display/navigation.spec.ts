import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { configureCoreTest } from '@core/testing/test-helpers';
import { pick, pickAll, press, stubMatchMedia, text } from '../testing/dom';
import { AgendaSlot, WeekAgendaComponent } from './week-agenda.component';
import { KanbanBoardComponent, KanbanCardDirective, KanbanColumn } from './kanban-board.component';
import { SegmentOption, SegmentedComponent } from './segmented.component';
import { TabItem, TabsComponent } from './tabs.component';

@Component({
  imports: [TabsComponent, SegmentedComponent],
  template: `
    <app-tabs label="Ficha do cuidador" [tabs]="tabs" [(selected)]="tab">
      @switch (tab()) {
        @case ('resumo') { <p id="p-resumo">Resumo do caso</p> }
        @case ('plano') { <p id="p-plano">Plano e cartão</p> }
        @case ('consent') { <p id="p-consent">Consentimentos</p> }
      }
    </app-tabs>
    <app-segmented label="Densidade" [options]="options" [(value)]="density" />
  `,
})
class TabsHost {
  readonly tab = signal<string | undefined>('resumo');
  readonly tabs: TabItem[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'plano', label: 'Plano e cartão', badge: 2 },
    { id: 'acomp', label: 'Acompanhamento', disabled: true, disabledReason: 'Sem acesso clínico' },
    { id: 'consent', label: 'Consentimentos' },
  ];
  readonly density = signal<string | undefined>('comfortable');
  readonly options: SegmentOption[] = [
    { value: 'compact', label: 'Compacta' },
    { value: 'comfortable', label: 'Confortável' },
    { value: 'wide', label: 'Ampla' },
  ];
}

function renderTabs() {
  const fixture = TestBed.createComponent(TabsHost);
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, root, tabs: () => pickAll<HTMLButtonElement>(root, '[role="tab"]') };
}

describe('Tabs', () => {
  afterEach(() => document.body.replaceChildren());

  it('papéis ARIA: tablist, tab, tabpanel ligados por id; só a aba atual entra no Tab', () => {
    const { root, tabs } = renderTabs();
    expect(pick(root, '[role="tablist"]').getAttribute('aria-label')).toBe('Ficha do cuidador');
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
    expect(tabs().map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
    const panel = pick(root, '[role="tabpanel"]');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs()[0]?.id);
    expect(tabs()[0]?.getAttribute('aria-controls')).toBe(panel.id);
    expect(text(pick(root, '#p-resumo'))).toBe('Resumo do caso');
  });

  it('setas, Home e End movem e selecionam, pulando a aba desabilitada e dando a volta', () => {
    const { fixture, host, tabs } = renderTabs();
    press(tabs()[0] as HTMLElement, 'ArrowRight');
    fixture.detectChanges();
    expect(host.tab()).toBe('plano');
    expect(document.activeElement).toBe(tabs()[1]);
    press(tabs()[1] as HTMLElement, 'ArrowRight');
    fixture.detectChanges();
    expect(host.tab()).toBe('consent');
    press(tabs()[3] as HTMLElement, 'ArrowRight');
    fixture.detectChanges();
    expect(host.tab()).toBe('resumo');
    press(tabs()[0] as HTMLElement, 'End');
    fixture.detectChanges();
    expect(host.tab()).toBe('consent');
    press(tabs()[3] as HTMLElement, 'Home');
    fixture.detectChanges();
    expect(host.tab()).toBe('resumo');
    press(tabs()[0] as HTMLElement, 'ArrowLeft');
    fixture.detectChanges();
    expect(host.tab()).toBe('consent');
  });

  it('aba desabilitada explica o motivo e o painel só renderiza o que está aberto', () => {
    const { fixture, root, tabs } = renderTabs();
    expect(tabs()[2]?.disabled).toBe(true);
    expect(tabs()[2]?.getAttribute('title')).toBe('Sem acesso clínico');
    expect(text(tabs()[2] as HTMLElement)).toContain('Sem acesso clínico');
    expect(text(tabs()[1] as HTMLElement)).toContain('Plano e cartão 2');
    tabs()[1]?.click();
    fixture.detectChanges();
    expect(root.querySelector('#p-resumo')).toBeNull();
    expect(root.querySelector('#p-plano')).not.toBeNull();
  });
});

describe('Segmented', () => {
  afterEach(() => document.body.replaceChildren());

  it('grupo de opção única com setas, Home e End', () => {
    const { fixture, host, root } = renderTabs();
    const radios = () => pickAll<HTMLButtonElement>(root, '[role="radio"]');
    expect(pick(root, '[role="radiogroup"]').getAttribute('aria-label')).toBe('Densidade');
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios().map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    press(radios()[1] as HTMLElement, 'ArrowRight');
    fixture.detectChanges();
    expect(host.density()).toBe('wide');
    press(radios()[2] as HTMLElement, 'ArrowRight');
    fixture.detectChanges();
    expect(host.density()).toBe('compact');
    press(radios()[0] as HTMLElement, 'End');
    fixture.detectChanges();
    expect(host.density()).toBe('wide');
    press(radios()[2] as HTMLElement, 'Home');
    fixture.detectChanges();
    expect(host.density()).toBe('compact');
    radios()[1]?.click();
    fixture.detectChanges();
    expect(host.density()).toBe('comfortable');
  });
});

// ---- Kanban ---------------------------------------------------------------------------------------------

interface Process {
  name: string;
  missing: string;
}

@Component({
  imports: [KanbanBoardComponent, KanbanCardDirective],
  template: `
    <app-kanban-board [columns]="columns" (cardOpened)="opened.push($event)">
      <ng-template appKanbanCard let-item let-column="column">
        <strong>{{ item.name }}</strong>&ngsp;<span class="t-caption">{{ item.missing }} ({{ column }})</span>
      </ng-template>
    </app-kanban-board>
  `,
})
class KanbanHost {
  readonly opened: { item: unknown; columnId: string }[] = [];
  readonly columns: KanbanColumn<Process>[] = [
    { id: 'requested', label: 'Solicitado', items: [{ name: 'Dra. Sônia Peixoto', missing: 'faltam 2 critérios' }] },
    { id: 'review', label: 'Em análise', items: [{ name: 'Fisio em Casa', missing: 'faltam 3 critérios' }, { name: 'Clínica X', missing: 'documento vencido' }] },
    { id: 'approved', label: 'Aprovado', items: [] },
  ];
}

describe('KanbanBoard', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('colunas com contagem, cartões com o que falta e coluna vazia com a frase da marca', () => {
    const fixture = TestBed.createComponent(KanbanHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const heads = pickAll(root, '.kanban__head').map((h) => text(h));
    expect(heads).toEqual(['Solicitado 1 itens', 'Em análise 2 itens', 'Aprovado 0 itens']);
    expect(pickAll(root, '.kanban__card')).toHaveLength(3);
    expect(text(pick(root, '.kanban__card'))).toBe('Dra. Sônia Peixoto faltam 2 critérios (requested)');
    expect(text(pick(root, '.kanban__empty'))).toBe('Nenhum processo aqui.');
    expect(root.querySelector('button.kanban__head')).toBeNull();
  });

  it('clicar no cartão abre a decisão (não arrasta)', () => {
    const fixture = TestBed.createComponent(KanbanHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    pickAll<HTMLButtonElement>(root, '.kanban__card')[1]?.click();
    expect(fixture.componentInstance.opened).toEqual([{ item: { name: 'Fisio em Casa', missing: 'faltam 3 critérios' }, columnId: 'review' }]);
    expect(root.querySelector('[draggable="true"]')).toBeNull();
  });

  it('no celular vira acordeão: botão com aria-expanded recolhe e expande a coluna', () => {
    const restore = stubMatchMedia(true);
    const fixture = TestBed.createComponent(KanbanHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const heads = pickAll<HTMLButtonElement>(root, 'button.kanban__head');
    expect(heads).toHaveLength(3);
    expect(heads.map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'true', 'true']);
    heads[1]?.click();
    fixture.detectChanges();
    expect(heads[1]?.getAttribute('aria-expanded')).toBe('false');
    expect(pickAll(root, '.kanban__col')[1]?.getAttribute('data-collapsed')).toBe('true');
    expect(heads[1]?.getAttribute('aria-controls')).toBe(pickAll(root, '.kanban__col > .stack')[1]?.id);
    heads[1]?.click();
    fixture.detectChanges();
    expect(pickAll(root, '.kanban__col')[1]?.getAttribute('data-collapsed')).toBe('false');
    restore();
  });
});

// ---- Agenda semanal ---------------------------------------------------------------------------------------

@Component({
  imports: [WeekAgendaComponent],
  template: `<app-week-agenda caption="Agenda da semana de 02 a 06 de novembro" [days]="days" [slots]="slots" (slotSelected)="picked.push($event)" />`,
})
class AgendaHost {
  readonly days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
  readonly picked: AgendaSlot[] = [];
  readonly slots: AgendaSlot[] = [
    { id: 's1', date: '2026-11-02', time: '08:00', status: 'open' },
    { id: 's2', date: '2026-11-03', time: '08:00', status: 'booked', label: 'CUI-0042' },
    { id: 's3', date: '2026-11-04', time: '09:00', status: 'confirmed', label: 'CUI-0051' },
    { id: 's4', date: '2026-11-04', time: '12:00', status: 'priority' },
    { id: 's5', date: '2026-11-05', time: '09:00', status: 'blocked' },
    { id: 's6', date: '2026-11-06', time: '10:00', status: 'noshow', label: 'CUI-0044' },
    { id: 's7', date: '2026-11-06', time: '11:00', status: 'done' },
  ];
}

function renderAgenda() {
  configureCoreTest({ today: '2026-11-04', time: '12:00' });
  const fixture = TestBed.createComponent(AgendaHost);
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, root, slots: () => pickAll<HTMLButtonElement>(root, '.agenda button.slot') };
}

describe('WeekAgenda', () => {
  afterEach(() => document.body.replaceChildren());

  it('grade com role grid, cabeçalho de dias, hoje destacado e legenda com ícone e texto', () => {
    const { root } = renderAgenda();
    const grid = pick(root, '[role="grid"]');
    expect(grid.getAttribute('aria-label')).toBe('Agenda da semana de 02 a 06 de novembro');
    expect(pickAll(grid, '[role="columnheader"]').map((h) => text(h))).toEqual(['Hora', 'seg02', 'ter03', 'qua04', 'qui05', 'sex06']);
    const today = pick(grid, '.agenda__dayhead.is-today');
    expect(text(today)).toBe('qua04');
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(pickAll(grid, '[role="row"]')).toHaveLength(11);
    const legend = pickAll(root, '.agenda-legend [role="listitem"]').map((l) => text(l));
    expect(legend).toEqual(['Aberta', 'Reservada', 'Confirmada', 'Vaga prioritária', 'Bloqueada', 'Realizada', 'Falta']);
    expect(text(root.querySelector('p') as HTMLElement)).toBe('2 vagas abertas nesta semana');
  });

  it('cada vaga tem ícone, texto do estado e nome acessível completo', () => {
    const { slots } = renderAgenda();
    expect(slots()).toHaveLength(7);
    const booked = slots().find((s) => s.getAttribute('aria-label')?.includes('CUI-0042'));
    expect(booked?.getAttribute('aria-label')).toBe('ter 03/11/2026, 08:00, Reservada, CUI-0042');
    expect(booked?.className).toBe('slot slot--booked');
    expect(booked?.querySelector('use')?.getAttribute('href')).toBe('icons/sprite.svg#i-user');
    const blocked = slots().find((s) => s.classList.contains('slot--blocked'));
    expect(blocked?.getAttribute('aria-disabled')).toBe('true');
    expect(text(blocked as HTMLElement)).toBe('Bloqueada');
  });

  it('Enter e clique abrem a vaga; vaga bloqueada não abre', () => {
    const { host, slots } = renderAgenda();
    slots()[0]?.click();
    expect(host.picked.map((s) => s.id)).toEqual(['s1']);
    slots().find((s) => s.classList.contains('slot--blocked'))?.click();
    expect(host.picked).toHaveLength(1);
  });

  it('setas navegam entre vagas existentes, Home e End vão às pontas da linha', () => {
    const { fixture, slots } = renderAgenda();
    const first = slots()[0] as HTMLButtonElement; // seg 08:00
    first.focus();
    press(first, 'ArrowRight');
    fixture.detectChanges();
    expect(document.activeElement?.getAttribute('aria-label')).toContain('ter 03/11/2026, 08:00');
    press(document.activeElement as HTMLElement, 'ArrowLeft');
    fixture.detectChanges();
    expect(document.activeElement).toBe(first);
    press(first, 'End');
    fixture.detectChanges();
    expect(document.activeElement?.getAttribute('aria-label')).toContain('ter 03/11/2026, 08:00');
    const nine = slots().find((s) => s.getAttribute('aria-label')?.includes('CUI-0051')) as HTMLButtonElement;
    nine.focus();
    press(nine, 'ArrowDown');
    fixture.detectChanges();
    expect(document.activeElement?.getAttribute('aria-label')).toContain('Vaga prioritária');
    // só uma vaga entra na ordem do Tab (roving tabindex)
    expect(slots().filter((s) => s.tabIndex === 0)).toHaveLength(1);
  });

  it('mostra a linha do "agora" na hora atual do dia de hoje', () => {
    const { root } = renderAgenda();
    expect(root.querySelectorAll('.agenda__now')).toHaveLength(1);
  });

  it('visão do dia para o celular: seletor de dias e lista de vagas com selo de estado', () => {
    const { fixture, root } = renderAgenda();
    const chips = pickAll<HTMLButtonElement>(root, '.day-picker .chip');
    expect(chips.map((c) => text(c))).toEqual(['seg 02', 'ter 03', 'qua 04', 'qui 05', 'sex 06', 'Hoje']);
    expect(chips[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(pickAll(root, '.list-card .list-row').map((r) => text(r))).toEqual([
      '09:00 CUI-0051 Confirmada',
      '12:00 Vaga prioritária Vaga prioritária',
    ]);
    chips[4]?.click();
    fixture.detectChanges();
    expect(chips[4]?.getAttribute('aria-pressed')).toBe('true');
    expect(pickAll(root, '.list-card .list-row').map((r) => text(r))).toEqual([
      '10:00 CUI-0044 Falta',
      '11:00 Realizada Realizada',
    ]);
    chips[5]?.click();
    fixture.detectChanges();
    expect(chips[2]?.getAttribute('aria-pressed')).toBe('true');
  });
});
