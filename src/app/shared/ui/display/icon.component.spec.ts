import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { IconComponent } from './icon.component';

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

  it('com label vira imagem com nome acessível e aplica o tamanho', () => {
    const svg = render().querySelector('#b') as SVGElement;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Mostrar');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
    expect(svg.classList.contains('icon--sm')).toBe(true);
  });
});
