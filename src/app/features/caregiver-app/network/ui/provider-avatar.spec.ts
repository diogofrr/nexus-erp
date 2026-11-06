import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ProviderAvatarComponent, providerInitials, providerTint } from './provider-avatar.component';
import { StarsComponent } from './stars.component';

describe('Avatar do profissional e estrelas (V2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('as iniciais pulam o título e as ligações e usam a primeira e a última palavra', () => {
    expect(providerInitials('Dra. Renata Sampaio')).toBe('RS');
    expect(providerInitials('Dr. Eduardo Falcão')).toBe('EF');
    expect(providerInitials('Cuidadora Rosimeire Tavares')).toBe('RT');
    expect(providerInitials('Nutri Camila Rezende')).toBe('CR');
    expect(providerInitials('Fisio em Casa Uberlândia')).toBe('CU');
    expect(providerInitials('Drogaria')).toBe('D');
    expect(providerInitials('')).toBe('');
  });

  it('a tinta é sempre a mesma para o mesmo nome e uma das quatro calmas', () => {
    const tints = ['blue', 'green', 'gold', 'slate'];
    for (const name of ['Dra. Renata Sampaio', 'Dr. Eduardo Falcão', 'Nutri Camila Rezende', 'Farmácia Bem-Estar']) {
      expect(tints).toContain(providerTint(name));
      expect(providerTint(name)).toBe(providerTint(name));
    }
  });

  it('o avatar é decorativo (aria-hidden) e mostra as iniciais; o tamanho vira classe', () => {
    const fixture = TestBed.createComponent(ProviderAvatarComponent);
    fixture.componentRef.setInput('name', 'Dra. Renata Sampaio');
    fixture.componentRef.setInput('size', 'xl');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.textContent?.trim()).toBe('RS');
    expect(host.classList.contains('is-xl')).toBe(true);
  });

  it('as estrelas valem a nota arredondada, ficam escondidas do leitor de tela e somem sem nota', () => {
    const fixture = TestBed.createComponent(StarsComponent);
    fixture.componentRef.setInput('value', 4.8);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('svg').length).toBe(5);
    expect(host.querySelectorAll('svg.on').length).toBe(5);
    fixture.componentRef.setInput('value', 3.2);
    fixture.detectChanges();
    expect(host.querySelectorAll('svg.on').length).toBe(3);
    expect(host.querySelectorAll('svg.off').length).toBe(2);
    fixture.componentRef.setInput('value', null);
    fixture.detectChanges();
    expect(host.querySelectorAll('svg').length).toBe(0);
  });
});
