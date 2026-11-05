import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { ErrorSummaryComponent, ErrorSummaryItem } from './error-summary.component';
import { FormFieldComponent } from './form-field.component';
import { NxInputDirective } from './input.directive';

@Component({
  imports: [ReactiveFormsModule, FormFieldComponent, NxInputDirective, ErrorSummaryComponent],
  template: `
    <app-error-summary [items]="items()" />
    <app-form-field label="Nome" controlId="f-name" [forceErrors]="true"><input appInput [formControl]="name" /></app-form-field>
    <app-form-field label="E-mail" controlId="f-email" [forceErrors]="true"><input appInput [formControl]="email" /></app-form-field>
  `,
})
class HostComponent {
  readonly name = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly email = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly items = signal<ErrorSummaryItem[]>([]);
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
}

describe('ErrorSummaryComponent: sem "0 pontos", some conforme corrige e não anuncia de novo (QA-008, CX-043, V33)', () => {
  it('sem erros fica escondido e sem texto, nunca "Há 0 pontos para corrigir"', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await settle(fixture);
    const summary = (fixture.nativeElement as HTMLElement).querySelector('app-error-summary') as HTMLElement;
    expect(summary.hasAttribute('hidden')).toBe(true);
    expect(summary.textContent?.trim()).toBe('');
    expect(summary.textContent).not.toContain('0 pontos');
  });

  it('o item some quando o campo é corrigido, o resumo some no fim e só o primeiro aparecimento é anunciado', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    await settle(fixture);
    host.items.set([
      { controlId: 'f-name', message: 'Informe o nome.' },
      { controlId: 'f-email', message: 'Informe o e-mail.' },
    ]);
    await settle(fixture);
    const summary = root.querySelector('app-error-summary') as HTMLElement;
    expect(summary.textContent).toContain('Há 2 pontos para corrigir');
    expect(summary.getAttribute('role')).toBe('alert');
    expect(summary.getAttribute('aria-live')).toBeNull();

    host.name.setValue('Ana Souza');
    await settle(fixture);
    expect(summary.textContent).toContain('Há 1 ponto para corrigir');
    expect(summary.textContent).not.toContain('Informe o nome.');
    expect(summary.textContent).toContain('Informe o e-mail.');
    // Mudar em silêncio: o leitor de tela não repete o aviso a cada correção.
    expect(summary.getAttribute('aria-live')).toBe('off');

    host.email.setValue('ana@exemplo.com.br');
    await settle(fixture);
    expect(summary.hasAttribute('hidden')).toBe(true);
    expect(summary.textContent?.trim()).toBe('');

    // Um novo envio com erros volta a ser anunciado.
    host.name.setValue('');
    await settle(fixture);
    host.items.set([{ controlId: 'f-name', message: 'Informe o nome.' }]);
    await settle(fixture);
    expect(summary.textContent).toContain('Há 1 ponto para corrigir');
    expect(summary.getAttribute('aria-live')).toBeNull();
  });

  it('item de um campo que nunca esteve marcado como inválido continua até o próximo envio', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await settle(fixture);
    fixture.componentInstance.name.setValue('Ana');
    fixture.componentInstance.items.set([{ controlId: 'nao-existe', message: 'Escolha o titular.' }]);
    await settle(fixture);
    const summary = (fixture.nativeElement as HTMLElement).querySelector('app-error-summary') as HTMLElement;
    expect(summary.textContent).toContain('Escolha o titular.');
  });
});
