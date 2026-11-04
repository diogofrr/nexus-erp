import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { pick, pickAll, press, text, typeInto } from '../testing/dom';
import { CheckboxComponent } from './checkbox.component';
import { ErrorSummaryComponent } from './error-summary.component';
import { FormFieldComponent } from './form-field.component';
import { RadioGroupComponent, RadioOption } from './radio-group.component';
import { RatingComponent } from './rating.component';
import { SearchFieldComponent } from './search-field.component';
import { SwitchComponent } from './switch.component';

const CHANNELS: RadioOption[] = [
  { value: 'app', label: 'Aplicativo' },
  { value: 'phone', label: 'Telefone', hint: 'Das 8h às 18h' },
  { value: 'email', label: 'E-mail', disabled: true },
];

@Component({
  imports: [ReactiveFormsModule, FormFieldComponent, CheckboxComponent, RadioGroupComponent, SwitchComponent, RatingComponent, SearchFieldComponent],
  template: `
    <app-checkbox [formControl]="accepted" hint="Opcional, não muda o plano.">Aceito receber avisos</app-checkbox>
    <app-checkbox id="mixed" [indeterminate]="true" [(checked)]="mixed">Todos</app-checkbox>
    <app-form-field label="Canal preferido" group>
      <app-radio-group [options]="channels" [formControl]="channel" />
    </app-form-field>
    <app-radio-group id="own" legend="Quem paga" [options]="payers" [(value)]="payer" />
    <app-switch [formControl]="auto">Avançar automaticamente ao responder</app-switch>
    <app-rating label="Nota do atendimento" [formControl]="score" />
    <app-search-field label="Buscar cuidador" placeholder="Código ou nome" [(value)]="term" (searched)="searches.push($event)" />
  `,
})
class HostComponent {
  readonly channels = CHANNELS;
  readonly payers: RadioOption<number>[] = [
    { value: 1, label: 'Próprio' },
    { value: 2, label: 'Empresa' },
  ];
  readonly accepted = new FormControl(false, { nonNullable: true });
  readonly channel = new FormControl<string | null>(null);
  readonly auto = new FormControl(false, { nonNullable: true });
  readonly score = new FormControl<number | null>(null);
  readonly mixed = signal(false);
  readonly payer = signal<number | null>(null);
  readonly term = signal('');
  readonly searches: string[] = [];
}

function render() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
}

describe('checkbox', () => {
  it('liga ao formulário, mostra a dica e aceita estado misto', () => {
    const { fixture, host, root } = render();
    const [box, mixed] = pickAll<HTMLInputElement>(root, 'app-checkbox input');
    expect(text(pick(root, 'app-checkbox label'))).toContain('Aceito receber avisos');
    expect(text(pick(root, 'app-checkbox small'))).toBe('Opcional, não muda o plano.');
    expect(box?.checked).toBe(false);
    box?.click();
    fixture.detectChanges();
    expect(host.accepted.value).toBe(true);
    expect(mixed?.indeterminate).toBe(true);
    mixed?.click();
    fixture.detectChanges();
    expect(host.mixed()).toBe(true);
    host.accepted.disable();
    fixture.detectChanges();
    expect(box?.disabled).toBe(true);
  });
});

describe('radio-group', () => {
  it('nada vem pré-marcado e a escolha vai ao controle', () => {
    const { fixture, host, root } = render();
    const radios = pickAll<HTMLInputElement>(root, 'app-form-field input[type="radio"]');
    expect(radios).toHaveLength(3);
    expect(radios.some((r) => r.checked)).toBe(false);
    expect(radios[2]?.disabled).toBe(true);
    radios[1]?.click();
    fixture.detectChanges();
    expect(host.channel.value).toBe('phone');
    host.channel.setValue('app');
    fixture.detectChanges();
    expect(radios[0]?.checked).toBe(true);
  });

  it('usa o rótulo do campo (grupo) ou a própria legenda como nome acessível', () => {
    const { root } = render();
    const group = pick(root, 'app-form-field [role="radiogroup"]');
    const label = pick(root, 'app-form-field .field__label');
    expect(group.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.tagName).toBe('SPAN');
    const own = pick(root, '#own [role="radiogroup"]');
    expect(own.getAttribute('aria-labelledby')).toBe(pick(root, '#own .field__label').id);
  });

  it('aceita valores de qualquer tipo com [(value)]', () => {
    const { fixture, host, root } = render();
    pickAll<HTMLInputElement>(root, '#own input')[1]?.click();
    fixture.detectChanges();
    expect(host.payer()).toBe(2);
  });
});

describe('switch', () => {
  it('é um interruptor com rótulo que diz o efeito', () => {
    const { fixture, host, root } = render();
    const input = pick<HTMLInputElement>(root, 'app-switch input');
    expect(input.getAttribute('role')).toBe('switch');
    expect(text(pick(root, 'app-switch'))).toBe('Avançar automaticamente ao responder');
    input.click();
    fixture.detectChanges();
    expect(host.auto.value).toBe(true);
  });
});

describe('rating', () => {
  it('cinco botões numerados, extremos escritos e nada pré-marcado', () => {
    const { fixture, host, root } = render();
    const options = pickAll<HTMLInputElement>(root, 'app-rating input');
    expect(options).toHaveLength(5);
    expect(options.some((o) => o.checked)).toBe(false);
    expect(options[0]?.getAttribute('aria-label')).toBe('1, ruim');
    expect(options[4]?.getAttribute('aria-label')).toBe('5, excelente');
    expect(pickAll(root, '.rating__ends span').map((s) => text(s))).toEqual(['Ruim', 'Excelente']);
    options[3]?.click();
    fixture.detectChanges();
    expect(host.score.value).toBe(4);
    expect(pick(root, '.rating').getAttribute('aria-label')).toBe('Nota do atendimento');
  });
});

describe('search-field', () => {
  it('busca, limpa com o botão e com Esc, e emite a cada mudança', () => {
    const { fixture, host, root } = render();
    const input = pick<HTMLInputElement>(root, 'app-search-field input');
    expect(input.getAttribute('aria-label')).toBe('Buscar cuidador');
    expect(input.placeholder).toBe('Código ou nome');
    expect(root.querySelector('.input-wrap__action')).toBeNull();
    typeInto(input, 'Márcia');
    fixture.detectChanges();
    expect(host.term()).toBe('Márcia');
    expect(host.searches).toEqual(['Márcia']);
    pick<HTMLButtonElement>(root, '.input-wrap__action').click();
    fixture.detectChanges();
    expect(host.term()).toBe('');
    typeInto(input, 'Ana');
    fixture.detectChanges();
    press(input, 'Escape');
    fixture.detectChanges();
    expect(host.term()).toBe('');
    expect(host.searches).toEqual(['Márcia', '', 'Ana', '']);
  });
});

@Component({
  imports: [ErrorSummaryComponent],
  template: `
    <input id="nome" />
    <app-error-summary [items]="items()" />
  `,
})
class SummaryHost {
  readonly items = signal<{ controlId: string; message: string }[]>([]);
}

describe('error-summary', () => {
  it('fica escondido sem erros e lista a mesma frase do campo, em links', () => {
    const fixture = TestBed.createComponent(SummaryHost);
    fixture.detectChanges();
    const summary = pick(fixture.nativeElement as HTMLElement, 'app-error-summary');
    expect(summary.hidden).toBe(true);
    fixture.componentInstance.items.set([
      { controlId: 'nome', message: 'Informe o nome completo.' },
      { controlId: 'cpf', message: 'Parece um CPF real. Use um CPF fictício.' },
    ]);
    fixture.detectChanges();
    expect(summary.hidden).toBe(false);
    expect(summary.getAttribute('role')).toBe('alert');
    expect(text(pick(summary, 'h2'))).toBe('Há 2 pontos para corrigir');
    expect(pickAll(summary, 'a').map((a) => text(a))).toEqual(['Informe o nome completo.', 'Parece um CPF real. Use um CPF fictício.']);
  });

  it('o link leva o foco ao campo e o resumo recebe o foco ao aparecer', async () => {
    const fixture = TestBed.createComponent(SummaryHost);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    fixture.detectChanges();
    fixture.componentInstance.items.set([{ controlId: 'nome', message: 'Informe o nome completo.' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const summary = pick(fixture.nativeElement as HTMLElement, 'app-error-summary');
    expect(document.activeElement).toBe(summary);
    const link = pick<HTMLAnchorElement>(summary, 'a');
    link.click();
    expect(document.activeElement?.id).toBe('nome');
    (fixture.nativeElement as HTMLElement).remove();
  });
});
