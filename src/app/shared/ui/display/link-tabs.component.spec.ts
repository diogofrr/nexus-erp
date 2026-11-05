import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ChartFrameComponent } from '../charts/chart-frame.component';
import { LinkTab, LinkTabsComponent } from './link-tabs.component';

@Component({ selector: 'app-test-page', template: '<p>página</p>' })
class PageComponent {}

@Component({
  selector: 'app-test-host',
  imports: [LinkTabsComponent, ChartFrameComponent],
  template: `
    <app-link-tabs label="Telas de teste" [items]="items" />
    <app-chart-frame><span class="inside">gráfico</span></app-chart-frame>
  `,
})
class HostComponent {
  readonly items: LinkTab[] = [
    { label: 'Visão geral', link: '/modulo', exact: true },
    { label: 'Projeção', link: '/modulo/projecao' },
    { label: 'Custos', link: '/modulo/custos', badge: 3 },
  ];
}

describe('app-link-tabs: navegação entre as telas de um módulo', () => {
  async function render(url: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'modulo', component: PageComponent },
          { path: 'modulo/projecao', component: PageComponent },
          { path: 'modulo/custos', component: PageComponent },
        ]),
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('é uma navegação nomeada com um link por tela e a contagem pequena quando há', async () => {
    const root = await render('/modulo');
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Telas de teste');
    const links = Array.from(root.querySelectorAll('a.tab'));
    expect(links.map((a) => a.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Visão geral', 'Projeção', 'Custos 3']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/modulo', '/modulo/projecao', '/modulo/custos']);
  });

  it('só a tela atual leva aria-current="page" e a aba "exata" não fica atual nas subtelas', async () => {
    const home = await render('/modulo');
    expect(home.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
    expect(home.querySelector('a[aria-current="page"]')?.textContent).toContain('Visão geral');
    TestBed.resetTestingModule();
    const sub = await render('/modulo/projecao');
    expect(sub.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
    expect(sub.querySelector('a[aria-current="page"]')?.textContent).toContain('Projeção');
  });

  it('a moldura do gráfico só limita a largura e mantém o conteúdo', async () => {
    const root = await render('/modulo');
    const frame = root.querySelector('app-chart-frame') as HTMLElement;
    expect(frame.style.maxWidth).toBe('46rem');
    expect(frame.querySelector('.inside')?.textContent).toBe('gráfico');
  });
});
