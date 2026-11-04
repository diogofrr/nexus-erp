import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { configureCoreTest } from '@core/testing/test-helpers';
import { pick, pickAll, text } from '../testing/dom';
import { BadgeComponent, PLAN_NAMES, PlanBadgeComponent, ZaritBandBadgeComponent } from './badge.component';
import { DeadlineBadgeComponent, businessDeadlineView, calendarDeadlineView } from './deadline-badge.component';

@Component({
  imports: [BadgeComponent, PlanBadgeComponent, ZaritBandBadgeComponent, DeadlineBadgeComponent],
  template: `
    <app-badge id="b1" variant="success" icon="award">Em destaque</app-badge>
    <app-badge id="b2" variant="attention" dot outline large>Pendente</app-badge>
    <app-plan-badge id="p1" plan="sustenta" />
    <app-zarit-band-badge id="z1" [score]="63" />
    <app-zarit-band-badge id="z2" band="moderate_to_severe" long />
    <app-zarit-band-badge id="z3" [score]="0" />
    <app-deadline-badge id="d1" due="2026-11-04T13:20:00-03:00" />
    <app-deadline-badge id="d2" due="2026-11-04T10:00:00-03:00" />
    <app-deadline-badge id="d3" due="2026-11-04T17:00:00-03:00" />
    <app-deadline-badge id="d4" due="2026-11-09" unit="days" />
    <app-deadline-badge id="d5" due="2026-11-04T10:00:00-03:00" done />
  `,
})
class HostComponent {}

function render() {
  configureCoreTest({ today: '2026-11-04', time: '12:00' });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return (id: string) => pick(root, `#${id}`);
}

describe('selos', () => {
  it('Badge: variante, ícone e ponto vêm com texto (nunca só cor)', () => {
    const el = render();
    expect(el('b1').className).toContain('badge badge--success');
    expect(text(el('b1'))).toBe('Em destaque');
    expect(el('b1').querySelector('svg use')?.getAttribute('href')).toBe('icons/sprite.svg#i-award');
    expect(el('b2').className).toContain('badge--dot');
    expect(el('b2').className).toContain('badge--outline');
    expect(el('b2').className).toContain('badge--lg');
  });

  it('PlanBadge: ponto mais o nome do plano, na cor do plano', () => {
    const el = render();
    expect(text(el('p1'))).toBe(PLAN_NAMES.sustenta);
    expect(el('p1').className).toContain('badge--plan-sustenta');
    expect(el('p1').className).toContain('badge--dot');
  });

  it('ZaritBandBadge: faixa pela pontuação, com ícone de forma própria, rótulo e pontos', () => {
    const el = render();
    expect(text(el('z1'))).toBe('Sobrecarga: Severa · 63');
    expect(el('z1').className).toContain('badge--zarit-4');
    expect(el('z1').querySelector('use')?.getAttribute('href')).toBe('icons/sprite.svg#i-octagon-alert');
    expect(text(el('z2'))).toContain('Sobrecarga moderada a severa');
    expect(el('z2').querySelector('use')?.getAttribute('href')).toBe('icons/sprite.svg#i-triangle-alert');
    expect(el('z3').className).toContain('badge--zarit-1');
    expect(el('z3').querySelector('use')?.getAttribute('href')).toBe('icons/sprite.svg#i-circle-check');
    const shapes = ['z1', 'z2', 'z3'].map((id) => el(id).querySelector('use')?.getAttribute('href'));
    expect(new Set(shapes).size).toBe(3);
  });

  it('DeadlineBadge (horas úteis): No prazo, Faltam X, Atrasada há X, com horário absoluto no title', () => {
    const el = render();
    expect(text(el('d3'))).toContain('No prazo');
    expect(el('d3').className).toContain('badge--info');
    expect(text(el('d1'))).toContain('Faltam 1 h 20 min úteis');
    expect(el('d1').className).toContain('badge--attention');
    expect(text(el('d2'))).toContain('Atrasada há 2 h úteis');
    expect(el('d2').className).toContain('badge--danger');
    expect(el('d1').getAttribute('title')).toBe('Prazo: hoje, 13:20');
    expect(el('d1').getAttribute('tabindex')).toBe('0');
    expect(pick(el('d1'), '.sr-only').textContent).toContain('Prazo: hoje, 13:20');
  });

  it('DeadlineBadge (dias) e concluído', () => {
    const el = render();
    expect(text(el('d4'))).toContain('Vence em 5 dias');
    expect(text(el('d5'))).toContain('Concluída');
    expect(el('d5').className).toContain('badge--success');
  });
});

describe('cálculo do prazo', () => {
  const NOW = '2026-11-04T12:00:00-03:00';

  it('horas úteis: conta só seg a sex, 8h às 18h (sexta 17h30 vence na segunda)', () => {
    // sexta 06/11 17:30: faltam 30 min no dia; atraso medido na segunda 11/11? usa o expediente corrido
    expect(businessDeadlineView('2026-11-04T12:00:00-03:00', NOW).label).toBe('Vence agora');
    expect(businessDeadlineView('2026-11-04T14:00:00-03:00', NOW).label).toBe('Faltam 2 h úteis');
    expect(businessDeadlineView('2026-11-04T14:01:00-03:00', NOW).label).toBe('No prazo');
    expect(businessDeadlineView('2026-11-04T11:30:00-03:00', NOW)).toMatchObject({ tone: 'danger', label: 'Atrasada há 30 min úteis' });
    expect(businessDeadlineView('2026-11-03T12:00:00-03:00', NOW).absolute).toBe('Prazo: 03/11/2026, 12:00');
  });

  it('dias corridos: âmbar até 3 dias, vermelho vencido', () => {
    expect(calendarDeadlineView('2026-11-12', '2026-11-04').tone).toBe('ok');
    expect(calendarDeadlineView('2026-11-07', '2026-11-04')).toMatchObject({ tone: 'attention', label: 'Vence em 3 dias' });
    expect(calendarDeadlineView('2026-11-04', '2026-11-04').label).toBe('Vence hoje');
    expect(calendarDeadlineView('2026-11-03', '2026-11-04')).toMatchObject({ tone: 'danger', label: 'Vencida há 1 dia' });
    expect(pickAll(document.body, 'app-deadline-badge')).toHaveLength(0);
  });
});
