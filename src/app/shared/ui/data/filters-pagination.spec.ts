import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { pick, pickAll, text } from '../testing/dom';
import { ActiveFilter, ActiveFiltersComponent, FilterChipsComponent, FilterOption } from './filter-chips.component';
import { PaginationComponent } from './pagination.component';
import { SortHeaderComponent } from './sort-header.component';
import { TableSort } from './table-utils';

const PLANS: FilterOption[] = [
  { value: 'livre', label: 'Livre', count: 323 },
  { value: 'cuida', label: 'Cuida', count: 5 },
  { value: 'sustenta', label: 'Sustenta', disabled: true },
];

@Component({
  imports: [FilterChipsComponent, ActiveFiltersComponent, PaginationComponent, SortHeaderComponent],
  template: `
    <app-filter-chips id="single" label="Plano" [options]="plans" [(value)]="plan" [allCount]="340" />
    <app-filter-chips id="multi" label="Status" [options]="plans" multiple [(values)]="statuses" />
    <app-active-filters id="active" [filters]="active" (removed)="removed.push($event)" (cleared)="cleared = cleared + 1" />
    <app-pagination id="pg" [total]="340" [(page)]="page" [(pageSize)]="size" noun="cuidadores" summary />
    <table class="table"><thead><tr>
      <th id="th" appSortHeader="name" [sort]="sort()" (sortChange)="sort.set($event)">Cuidador</th>
      <th id="th2" appSortHeader="plan" [sort]="sort()" (sortChange)="sort.set($event)">Plano</th>
    </tr></thead></table>
  `,
})
class HostComponent {
  readonly plans = PLANS;
  readonly plan = signal<string | null>(null);
  readonly statuses = signal<readonly string[]>([]);
  readonly active: ActiveFilter[] = [{ key: 'plan', label: 'Plano: Cuida' }, { key: 'status', label: 'Status: Ativo' }];
  readonly removed: string[] = [];
  cleared = 0;
  readonly page = signal(1);
  readonly size = signal(25);
  readonly sort = signal<TableSort | null>(null);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, root, el: (id: string) => pick(root, `#${id}`) };
}

describe('FilterChips', () => {
  it('modo simples: "Todos" ativo, escolher marca aria-pressed e escolher de novo desmarca', () => {
    const { fixture, host, el } = setup();
    const chips = () => pickAll<HTMLButtonElement>(el('single'), 'button');
    expect(el('single').querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Plano');
    expect(chips().map((c) => text(c))).toEqual(['Todos 340', 'Livre 323', 'Cuida 5', 'Sustenta']);
    expect(chips().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
    expect(chips()[3]?.disabled).toBe(true);
    chips()[2]?.click();
    fixture.detectChanges();
    expect(host.plan()).toBe('cuida');
    expect(chips().map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false']);
    chips()[2]?.click();
    fixture.detectChanges();
    expect(host.plan()).toBeNull();
    chips()[1]?.click();
    chips()[0]?.click();
    fixture.detectChanges();
    expect(host.plan()).toBeNull();
  });

  it('modo múltiplo: liga e desliga cada chip sem chip "Todos"', () => {
    const { fixture, host, el } = setup();
    const chips = () => pickAll<HTMLButtonElement>(el('multi'), 'button');
    expect(chips()).toHaveLength(3);
    chips()[0]?.click();
    chips()[1]?.click();
    fixture.detectChanges();
    expect(host.statuses()).toEqual(['livre', 'cuida']);
    chips()[0]?.click();
    fixture.detectChanges();
    expect(host.statuses()).toEqual(['cuida']);
    expect(chips().map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('filtros ativos viram chips removíveis com nome acessível e "Limpar filtros"', () => {
    const { fixture, host, el } = setup();
    const removes = pickAll<HTMLButtonElement>(el('active'), '.chip__remove');
    expect(removes.map((b) => b.getAttribute('aria-label'))).toEqual(['Remover filtro Plano: Cuida', 'Remover filtro Status: Ativo']);
    expect(pickAll(el('active'), '.chip--removable').map((c) => text(c))).toEqual(['Plano: Cuida', 'Status: Ativo']);
    removes[1]?.click();
    expect(host.removed).toEqual(['status']);
    pickAll<HTMLButtonElement>(el('active'), '.btn').find((b) => text(b) === 'Limpar filtros')?.click();
    fixture.detectChanges();
    expect(host.cleared).toBe(1);
  });
});

describe('Pagination', () => {
  it('resumo, páginas com reticências, aria-current e limites dos botões', () => {
    const { fixture, host, el } = setup();
    expect(text(pick(el('pg'), '[aria-live]'))).toBe('Mostrando 1 a 25 de 340 cuidadores');
    const current = () => pick(el('pg'), '[aria-current="page"]');
    expect(text(current())).toBe('1');
    expect(pick<HTMLButtonElement>(el('pg'), '[aria-label="Página anterior"]').disabled).toBe(true);
    pick<HTMLButtonElement>(el('pg'), '[aria-label="Próxima página"]').click();
    fixture.detectChanges();
    expect(host.page()).toBe(2);
    expect(text(pick(el('pg'), '[aria-live]'))).toBe('Mostrando 26 a 50 de 340 cuidadores');
    pickAll<HTMLButtonElement>(el('pg'), '.pagination__page').find((b) => b.getAttribute('aria-label') === 'Página 14')?.click();
    fixture.detectChanges();
    expect(host.page()).toBe(14);
    expect(text(pick(el('pg'), '[aria-live]'))).toBe('Mostrando 326 a 340 de 340 cuidadores');
    expect(pick<HTMLButtonElement>(el('pg'), '[aria-label="Próxima página"]').disabled).toBe(true);
    expect(el('pg').textContent).toContain('…');
  });

  it('trocar o tamanho volta à página 1', () => {
    const { fixture, host, el } = setup();
    pick<HTMLButtonElement>(el('pg'), '[aria-label="Próxima página"]').click();
    const select = pick<HTMLSelectElement>(el('pg'), 'select');
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['25', '50', '100']);
    select.value = '100';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(host.size()).toBe(100);
    expect(host.page()).toBe(1);
    expect(text(pick(el('pg'), '[aria-live]'))).toBe('Mostrando 1 a 100 de 340 cuidadores');
  });
});

describe('SortHeader', () => {
  it('aria-sort acompanha a ordem e só a coluna ordenada troca o ícone', () => {
    const { fixture, host, el } = setup();
    const icon = (id: string) => pick(el(id), 'use').getAttribute('href');
    expect(el('th').getAttribute('aria-sort')).toBe('none');
    expect(icon('th')).toBe('icons/sprite.svg#i-chevrons-up-down');
    pick<HTMLButtonElement>(el('th'), 'button').click();
    fixture.detectChanges();
    expect(host.sort()).toEqual({ key: 'name', direction: 'asc' });
    expect(el('th').getAttribute('aria-sort')).toBe('ascending');
    expect(el('th2').getAttribute('aria-sort')).toBe('none');
    expect(icon('th')).toBe('icons/sprite.svg#i-arrow-up');
    expect(icon('th2')).toBe('icons/sprite.svg#i-chevrons-up-down');
    pick<HTMLButtonElement>(el('th'), 'button').click();
    fixture.detectChanges();
    expect(el('th').getAttribute('aria-sort')).toBe('descending');
  });
});
