import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ROLES } from '../../../core/auth/permissions';
import { NAV_GROUPS, NAV_ITEMS, actionsFor, screensFor } from '../../../core/search/screens';
import { ICON_NAMES, IconComponent, toIconName } from './icon.component';

@Component({
  imports: [IconComponent],
  template: `
    <svg appIcon="calendar" id="a"></svg>
    <svg appIcon="eye" size="sm" label="Mostrar" id="b"></svg>
  `,
})
class HostComponent {}

describe('IconComponent', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('monta o <use> do sprite no namespace SVG e fica decorativo', () => {
    const svg = render().querySelector('#a') as SVGElement;
    const use = svg.querySelector('use') as SVGUseElement;
    expect(svg.classList.contains('icon')).toBe(true);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(use.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(use.getAttribute('href')).toBe('icons/sprite.svg#i-calendar');
  });

  it('toIconName aceita o nome do sprite e cai no ícone neutro para um nome desconhecido', () => {
    expect(toIconName('calendar')).toBe('calendar');
    expect(toIconName('nao-existe')).toBe('circle-dot');
    expect(toIconName('nao-existe', 'info')).toBe('info');
  });

  it('todo ícone que o núcleo guarda como texto (menu, telas, ações) existe no sprite', () => {
    const names = new Set<string>(ICON_NAMES);
    NAV_ITEMS.forEach((i) => expect(names.has(i.icon), i.icon).toBe(true));
    NAV_GROUPS.forEach((g) => expect(names.has(g.icon), g.icon).toBe(true));
    ROLES.forEach((role) => {
      screensFor(role).forEach((s) => expect(names.has(s.icon), `${role} ${s.link} ${s.icon}`).toBe(true));
      actionsFor(role).forEach((a) => expect(names.has(a.icon), `${role} ${a.id} ${a.icon}`).toBe(true));
    });
  });

  it('com label vira imagem com nome acessível e aplica o tamanho', () => {
    const svg = render().querySelector('#b') as SVGElement;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Mostrar');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
    expect(svg.classList.contains('icon--sm')).toBe(true);
  });
});
