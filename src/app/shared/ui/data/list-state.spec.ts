import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { configureCoreTest } from '@core/testing/test-helpers';
import { ListState, createListState } from './list-state';

@Component({ selector: 'app-test-list-page', template: '' })
class ListPage {
  readonly list: ListState = createListState({
    key: 'caregivers',
    filterKeys: ['plano', 'status'],
    defaultSort: { key: 'name', direction: 'asc' },
  });
}

@Component({ selector: 'app-test-other-page', template: '' })
class OtherPage {}

function setup() {
  const env = configureCoreTest({
    providers: [provideRouter([{ path: 'cuidadores', component: ListPage }, { path: 'outra', component: OtherPage }])],
  });
  const router = TestBed.inject(Router);
  return { ...env, router, query: () => router.parseUrl(router.url).queryParams };
}

describe('createListState (filtros e ordem na URL)', () => {
  it('lê filtros, ordem e página da URL; sem nada usa a ordem padrão', async () => {
    const { router } = setup();
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/cuidadores?plano=cuida&ordem=hours:desc&pagina=3&lixo=1', ListPage);
    expect(page.list.filters()).toEqual({ plano: 'cuida' });
    expect(page.list.sort()).toEqual({ key: 'hours', direction: 'desc' });
    expect(page.list.page()).toBe(3);
    expect(page.list.hasActive()).toBe(true);
    expect(router.url).toContain('lixo=1');

    const empty = await harness.navigateByUrl('/cuidadores', ListPage);
    expect(empty.list.sort()).toEqual({ key: 'name', direction: 'asc' });
    expect(empty.list.page()).toBe(1);
    expect(empty.list.hasActive()).toBe(false);
  });

  it('os setters atualizam os sinais na hora e a URL logo depois, voltando à página 1 ao filtrar', async () => {
    const { query } = setup();
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/cuidadores?pagina=4', ListPage);
    page.list.setFilter('plano', 'cuida');
    expect(page.list.filters()).toEqual({ plano: 'cuida' });
    expect(page.list.page()).toBe(1);
    await harness.fixture.whenStable();
    expect(query()).toEqual({ plano: 'cuida' });
    page.list.setSort({ key: 'hours', direction: 'asc' });
    page.list.setPage(2);
    await harness.fixture.whenStable();
    expect(query()).toEqual({ plano: 'cuida', ordem: 'hours:asc', pagina: '2' });
    page.list.setFilter('status', 'active');
    await harness.fixture.whenStable();
    expect(query()).toEqual({ plano: 'cuida', status: 'active', ordem: 'hours:asc' });
    page.list.setFilter('plano', null);
    await harness.fixture.whenStable();
    expect(page.list.filters()).toEqual({ status: 'active' });
    page.list.setSort({ key: 'name', direction: 'asc' });
    await harness.fixture.whenStable();
    expect(query()).toEqual({ status: 'active' });
  });

  it('o texto da busca NUNCA vai para a URL, só para a sessão', async () => {
    const { router, session } = setup();
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/cuidadores', ListPage);
    page.list.search.set('Ana Paula');
    page.list.setFilter('plano', 'livre');
    await harness.fixture.whenStable();
    expect(router.url).not.toContain('Ana');
    expect(router.url).not.toContain('Paula');
    expect(session.data.get('nexus-erp:list:caregivers:q')).toBe('"Ana Paula"');
    expect(page.list.hasActive()).toBe(true);
  });

  it('ao voltar à lista sem parâmetros restaura o último estado da sessão', async () => {
    const { query } = setup();
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/cuidadores', ListPage);
    page.list.setFilter('plano', 'cuida');
    page.list.setSort({ key: 'hours', direction: 'desc' });
    await harness.fixture.whenStable();
    expect(query()).toEqual({ plano: 'cuida', ordem: 'hours:desc' });
    await harness.navigateByUrl('/outra', OtherPage);
    const back = await harness.navigateByUrl('/cuidadores', ListPage);
    await harness.fixture.whenStable();
    expect(query()).toEqual({ plano: 'cuida', ordem: 'hours:desc' });
    expect(back.list.filters()).toEqual({ plano: 'cuida' });
    expect(back.list.sort()).toEqual({ key: 'hours', direction: 'desc' });
  });

  it('o botão Voltar do navegador (URL mudou por fora) atualiza os sinais', async () => {
    setup();
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/cuidadores?plano=livre', ListPage);
    expect(page.list.filters()).toEqual({ plano: 'livre' });
    await harness.navigateByUrl('/cuidadores?plano=cuida&pagina=2', ListPage);
    expect(page.list.filters()).toEqual({ plano: 'cuida' });
    expect(page.list.page()).toBe(2);
    await harness.navigateByUrl('/cuidadores?status=active', ListPage);
    expect(page.list.filters()).toEqual({ status: 'active' });
    expect(page.list.page()).toBe(1);
  });

  it('"limpar" tira filtros, busca e página', async () => {
    const { query } = setup();
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/cuidadores?plano=cuida&status=active&pagina=2', ListPage);
    page.list.search.set('Ana');
    page.list.clear();
    await harness.fixture.whenStable();
    expect(query()).toEqual({});
    expect(page.list.search()).toBe('');
    expect(page.list.hasActive()).toBe(false);
  });
});
