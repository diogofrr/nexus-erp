import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanBadgeComponent } from '../display/badge.component';
import { pick, pickAll, press, stubMatchMedia, text, typeInto } from '../testing/dom';
import { CellDirective, DataTableComponent, RowKey, TableState } from './data-table.component';
import { TableColumn, TableSort } from './table-utils';

interface Person {
  id: string;
  name: string;
  code: string;
  plan: 'livre' | 'cuida' | 'sustenta';
  hours: number;
}

const NAMES = ['Ana', 'Bruna', 'Cecília', 'Débora', 'Elisa', 'Fátima', 'Gisele', 'Helena', 'Ivone', 'Júlia', 'Lúcia', 'Márcia', 'Neusa', 'Olívia', 'Patrícia', 'Rita', 'Sueli', 'Tânia', 'Vera', 'Zilda', 'Alice', 'Berta', 'Clara', 'Dalva', 'Eva', 'Flávia', 'Glória', 'Heloísa', 'Irene', 'Joana'];
const PEOPLE: Person[] = NAMES.map((name, i) => ({
  id: `cg_${String(i + 1).padStart(4, '0')}`,
  name,
  code: `CUI-${String(i + 1).padStart(4, '0')}`,
  plan: (['livre', 'cuida', 'sustenta'] as const)[i % 3] as Person['plan'],
  hours: (i * 7) % 13,
}));
const COLUMNS: TableColumn<Person>[] = [
  { key: 'name', header: 'Cuidador', primary: true, sortable: true },
  { key: 'plan', header: 'Plano', sortable: true },
  { key: 'hours', header: 'Horas/dia', align: 'end', sortable: true },
  { key: 'actions', header: 'Ações', actions: true },
];

@Component({
  imports: [DataTableComponent, CellDirective, PlanBadgeComponent],
  template: `
    <app-data-table
      caption="Cuidadores cadastrados"
      noun="cuidadores"
      [rows]="rows()"
      [columns]="columns"
      [state]="state()"
      searchable
      selectable
      rowClickable
      densityToggle
      [rowLabel]="label"
      [(sort)]="sort"
      [(selection)]="selection"
      [(density)]="density"
      (rowClick)="opened.push($event)"
      (retry)="retries = retries + 1"
      (filtersCleared)="cleared = cleared + 1"
    >
      <ng-template appCell="plan" let-row><app-plan-badge [plan]="row.plan" /></ng-template>
      <ng-template appCell="actions" let-row let-selecting="selecting"><button class="btn btn--sm" [disabled]="selecting">Abrir {{ row.code }}</button></ng-template>
      <button appBulkActions class="btn btn--sm">Exportar</button>
    </app-data-table>
  `,
})
class HostComponent {
  readonly columns = COLUMNS;
  readonly rows = signal<Person[]>(PEOPLE);
  readonly state = signal<TableState>('ready');
  readonly sort = signal<TableSort | null>(null);
  readonly selection = signal<readonly RowKey[]>([]);
  readonly density = signal<'comfortable' | 'compact'>('comfortable');
  readonly opened: Person[] = [];
  retries = 0;
  cleared = 0;
  readonly label = (row: Person): string => row.code;
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    root,
    rows: () => pickAll(root, 'tbody tr'),
    names: () => pickAll(root, 'tbody tr td[data-label="Cuidador"]').map((c) => text(c)),
    count: () => text(pick(root, '.table-footer [role="status"]')),
  };
}

describe('DataTableComponent', () => {
  afterEach(() => document.body.replaceChildren());

  it('renderiza legenda, cabeçalhos, data-label em cada célula e o modelo de célula', () => {
    const { root, rows } = setup();
    expect(text(pick(root, 'caption'))).toBe('Cuidadores cadastrados');
    expect(pick(root, 'caption').classList.contains('sr-only')).toBe(true);
    expect(pick(root, 'table').getAttribute('role')).toBe('table');
    expect(pick(root, 'table').classList.contains('table--stack')).toBe(true);
    expect(pickAll(root, 'thead th').map((h) => text(h))).toEqual(['', 'Cuidador', 'Plano', 'Horas/dia', 'Ações']);
    expect(rows()).toHaveLength(25);
    const first = rows()[0] as HTMLElement;
    expect(pickAll(first, 'td').map((c) => c.getAttribute('data-label'))).toEqual(['Selecionar', 'Cuidador', 'Plano', 'Horas/dia', 'Ações']);
    expect(text(pick(first, 'td[data-label="Plano"] app-plan-badge'))).toBe('Livre');
    expect(text(pick(first, 'td[data-label="Ações"] button'))).toBe('Abrir CUI-0001');
    expect(pick(first, 'td[data-label="Horas/dia"]').classList.contains('col-num')).toBe(true);
    expect(pick(first, 'td[data-label="Cuidador"]').classList.contains('col-primary')).toBe(true);
  });

  it('mostra a contagem sempre e pagina em 25', () => {
    const { fixture, root, count, names } = setup();
    expect(count()).toBe('Mostrando 1 a 25 de 30 cuidadores');
    expect(pick(root, 'nav.pagination').getAttribute('aria-label')).toBe('Paginação');
    const page2 = pickAll<HTMLButtonElement>(root, '.pagination__page').find((b) => b.getAttribute('aria-label') === 'Página 2');
    page2?.click();
    fixture.detectChanges();
    expect(count()).toBe('Mostrando 26 a 30 de 30 cuidadores');
    expect(names()).toEqual(['Flávia', 'Glória', 'Heloísa', 'Irene', 'Joana']);
    expect(pick(root, '[aria-current="page"]').textContent?.trim()).toBe('2');
  });

  it('ordena pelo cabeçalho em três estados, com aria-sort e ícone', () => {
    const { fixture, host, root, names } = setup();
    const header = () => pick<HTMLTableCellElement>(root, 'thead th[aria-sort]');
    const toggle = () => pick<HTMLButtonElement>(root, 'thead th:nth-child(2) .th-sort');
    expect(pickAll(root, 'thead th').map((h) => h.getAttribute('aria-sort'))).toEqual([null, 'none', 'none', 'none', null]);
    toggle().click();
    fixture.detectChanges();
    expect(header().getAttribute('aria-sort')).toBe('ascending');
    expect(host.sort()).toEqual({ key: 'name', direction: 'asc' });
    expect(names().slice(0, 3)).toEqual(['Alice', 'Ana', 'Berta']);
    toggle().click();
    fixture.detectChanges();
    expect(header().getAttribute('aria-sort')).toBe('descending');
    expect(names()[0]).toBe('Zilda');
    toggle().click();
    fixture.detectChanges();
    expect(host.sort()).toBeNull();
    expect(names()[0]).toBe('Ana');
  });

  it('busca sem acento, volta à página 1 e mostra "filtrado de"', () => {
    const { fixture, root, count, names } = setup();
    typeInto(pick<HTMLInputElement>(root, '.table-toolbar input[type="search"]'), 'marcia');
    fixture.detectChanges();
    expect(names()).toEqual(['Márcia']);
    expect(count()).toBe('Mostrando 1 a 1 de 1 cuidadores (filtrado de 30)');
  });

  it('busca sem resultado: "Nada encontrado" com a frase da marca e "Limpar filtros", nunca tabela em branco', () => {
    const { fixture, host, root } = setup();
    typeInto(pick<HTMLInputElement>(root, '.table-toolbar input[type="search"]'), 'zzz');
    fixture.detectChanges();
    expect(root.querySelector('table')).toBeNull();
    expect(text(pick(root, '.empty__title'))).toBe('Nada encontrado para "zzz"');
    expect(text(pick(root, '.empty__text'))).toBe('Confira o nome ou o código e tente de novo, ou limpe os filtros.');
    pick<HTMLButtonElement>(root, '.empty__actions .btn').click();
    fixture.detectChanges();
    expect(host.cleared).toBe(1);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(25);
  });

  it('lista vazia (primeiro uso) sem filtros: texto acolhedor, sem botão de limpar', () => {
    const { fixture, host, root } = setup();
    host.rows.set([]);
    fixture.detectChanges();
    expect(text(pick(root, '.empty__title'))).toBe('Nada por aqui ainda');
    expect(root.querySelector('.empty__actions .btn')).toBeNull();
    expect(root.querySelector('.table-footer')).toBeNull();
  });

  it('carregando: esqueleto na forma da tabela com aria-busy', () => {
    const { fixture, host, root } = setup();
    host.state.set('loading');
    fixture.detectChanges();
    expect(pick(root, '.table-wrap').getAttribute('aria-busy')).toBe('true');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(root.querySelectorAll('.skeleton').length).toBeGreaterThan(10);
    expect(root.querySelector('.table-footer')).toBeNull();
  });

  it('erro: mensagem com "Tentar de novo"; sem permissão: cadeado e texto neutro', () => {
    const { fixture, host, root } = setup();
    host.state.set('error');
    fixture.detectChanges();
    expect(pick(root, '.empty').getAttribute('role')).toBe('alert');
    expect(text(pick(root, '.empty__title'))).toBe('Não foi possível carregar a lista');
    pick<HTMLButtonElement>(root, '.empty__actions .btn').click();
    expect(host.retries).toBe(1);
    host.state.set('forbidden');
    fixture.detectChanges();
    expect(text(pick(root, '.empty__title'))).toBe('Esta lista não está disponível para o seu perfil');
    expect(pick(root, '.empty__icon use').getAttribute('href')).toBe('icons/sprite.svg#i-lock');
  });

  it('seleção: cabeçalho marca a PÁGINA (estado misto), barra de lote e "selecionar todos os N resultados"', () => {
    const { fixture, host, root } = setup();
    const header = pick<HTMLInputElement>(root, 'thead input[type="checkbox"]');
    const first = pick<HTMLInputElement>(root, 'tbody input[type="checkbox"]');
    expect(first.getAttribute('aria-label')).toBe('Selecionar CUI-0001');
    expect(root.querySelector('.selection-bar')).toBeNull();
    first.click();
    fixture.detectChanges();
    expect(header.indeterminate).toBe(true);
    expect(text(pick(root, '.selection-bar'))).toContain('1 selecionado');
    expect(pick(root, 'tbody tr').getAttribute('aria-selected')).toBe('true');
    expect(pick<HTMLButtonElement>(root, 'tbody td[data-label="Ações"] button').disabled).toBe(true);
    header.click();
    fixture.detectChanges();
    expect(host.selection()).toHaveLength(25);
    expect(header.indeterminate).toBe(false);
    expect(text(pick(root, '.selection-bar'))).toContain('Selecionar todos os 30 resultados');
    pick<HTMLButtonElement>(root, '.selection-bar .btn-link').click();
    fixture.detectChanges();
    expect(host.selection()).toHaveLength(30);
    expect(text(pick(root, '.selection-bar span'))).toBe('30 selecionados');
    expect(root.querySelector('.selection-bar .btn-link')).toBeNull();
    expect(text(pick(root, '.selection-bar .cluster .btn'))).toBe('Exportar');
    pickAll<HTMLButtonElement>(root, '.selection-bar .btn').find((b) => text(b) === 'Limpar seleção')?.click();
    fixture.detectChanges();
    expect(host.selection()).toEqual([]);
    expect(root.querySelector('.selection-bar')).toBeNull();
  });

  it('linha clicável: Enter e clique abrem; clicar na caixa ou no botão da linha NÃO abre', () => {
    const { fixture, host, rows } = setup();
    const row = rows()[2] as HTMLElement;
    expect(row.getAttribute('tabindex')).toBe('-1');
    expect(rows()[0]?.getAttribute('tabindex')).toBe('0');
    row.click();
    expect(host.opened.map((p) => p.name)).toEqual(['Cecília']);
    press(row, 'Enter');
    expect(host.opened).toHaveLength(2);
    pick<HTMLInputElement>(row, 'input[type="checkbox"]').click();
    pick<HTMLButtonElement>(row, 'button').click();
    fixture.detectChanges();
    expect(host.opened).toHaveLength(2);
  });

  it('setas, Home e End movem o foco entre linhas (roving tabindex)', () => {
    const { fixture, rows } = setup();
    const first = rows()[0] as HTMLElement;
    first.focus();
    press(first, 'ArrowDown');
    fixture.detectChanges();
    expect(document.activeElement).toBe(rows()[1]);
    expect(rows()[1]?.getAttribute('tabindex')).toBe('0');
    expect(rows()[0]?.getAttribute('tabindex')).toBe('-1');
    press(rows()[1] as HTMLElement, 'End');
    expect(document.activeElement).toBe(rows()[24]);
    press(rows()[24] as HTMLElement, 'Home');
    expect(document.activeElement).toBe(rows()[0]);
    press(rows()[0] as HTMLElement, 'ArrowUp');
    expect(document.activeElement).toBe(rows()[0]);
  });

  it('densidade: o segmentado troca data-density da tabela', () => {
    const { fixture, host, root } = setup();
    expect(pick(root, 'table').getAttribute('data-density')).toBe('comfortable');
    pickAll<HTMLButtonElement>(root, 'app-segmented [role="radio"]')[0]?.click();
    fixture.detectChanges();
    expect(host.density()).toBe('compact');
    expect(pick(root, 'table').getAttribute('data-density')).toBe('compact');
  });

  it('por página: trocar para 50 mostra tudo e esconde a paginação', () => {
    const { fixture, root, rows } = setup();
    const select = pick<HTMLSelectElement>(root, '.pagination select');
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(rows()).toHaveLength(30);
    expect(root.querySelector('.pagination__pages')).toBeNull();
  });
});

describe('DataTableComponent no celular', () => {
  afterEach(() => document.body.replaceChildren());

  it('troca a paginação por "Carregar mais 25" e leva ordenação e "selecionar todos" para a barra de ferramentas', () => {
    const restore = stubMatchMedia(true);
    const { fixture, root, rows, count } = setup();
    expect(rows()).toHaveLength(25);
    expect(root.querySelector('nav.pagination')).toBeNull();
    expect(text(pick(root, '.table-footer .btn'))).toBe('Carregar mais 25');
    expect(count()).toBe('Mostrando 25 de 30 cuidadores');
    pick<HTMLButtonElement>(root, '.table-footer .btn').click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(30);
    expect(root.querySelector('.table-footer .btn')).toBeNull();
    expect(count()).toBe('30 cuidadores');
    // o cabeçalho some nos cartões: ordenar e selecionar tudo ficam na barra de ferramentas
    const sortSelect = pick<HTMLSelectElement>(root, '.table-toolbar select');
    expect(Array.from(sortSelect.options).map((o) => o.text)).toContain('Cuidador, crescente');
    sortSelect.value = 'name:desc';
    sortSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(text(pick(root, 'tbody td[data-label="Cuidador"]'))).toBe('Zilda');
    expect(text(pick(root, '.table-toolbar .check'))).toBe('Selecionar todos');
    expect(root.querySelector('app-segmented')).toBeNull();
    restore();
  });
});
