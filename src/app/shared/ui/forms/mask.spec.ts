import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { pick, typeInto } from '../testing/dom';
import { NxInputDirective } from './input.directive';
import { maskCpfText, maskDateText, maskPhoneText, parseCurrencyCents, parseDateText, parseNumberText, sanitizeNumberText } from './mask-utils';
import { NxMaskDirective } from './mask.directive';

@Component({
  imports: [ReactiveFormsModule, NxInputDirective, NxMaskDirective],
  template: `
    <input id="cpf" appInput appMask="cpf" [formControl]="cpf" />
    <input id="phone" appInput appMask="phone" [formControl]="phone" />
    <input id="price" appInput appMask="currency" [formControl]="price" />
    <input id="hours" appInput appMask="number" min="0" max="24" rangeMessage="As horas por dia devem ser de 0 a 24." [formControl]="hours" />
    <input id="score" appInput appMask="number" decimals="1" [formControl]="score" />
    <input id="birth" appInput appMask="date" [formControl]="birth" />
  `,
})
class HostComponent {
  readonly cpf = new FormControl('', { nonNullable: true });
  readonly phone = new FormControl('', { nonNullable: true });
  readonly price = new FormControl<number | null>(null);
  readonly hours = new FormControl<number | null>(null);
  readonly score = new FormControl<number | null>(null);
  readonly birth = new FormControl<string | null>(null);
}

function render() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const input = (id: string) => pick<HTMLInputElement>(root, `#${id}`);
  return { fixture, host: fixture.componentInstance, input };
}

describe('máscaras (funções puras)', () => {
  it('formata CPF, telefone e data de forma progressiva, aceitando colar com pontuação', () => {
    expect(maskCpfText('1234')).toBe('123.4');
    expect(maskCpfText('123.456.789-00')).toBe('123.456.789-00');
    expect(maskCpfText('123456789001234')).toBe('123.456.789-00');
    expect(maskPhoneText('34')).toBe('(34');
    expect(maskPhoneText('3490000')).toBe('(34) 90000');
    expect(maskPhoneText('3490000012')).toBe('(34) 90000-012');
    expect(maskPhoneText('34900000123')).toBe('(34) 90000-0123');
    expect(maskPhoneText('3432221111')).toBe('(34) 3222-1111');
    expect(maskDateText('0411')).toBe('04/11');
    expect(maskDateText('04')).toBe('04');
  });

  it('interpreta data, dinheiro em centavos e número', () => {
    expect(parseDateText('04/11/2026')).toBe('2026-11-04');
    expect(parseDateText('31/02/2026')).toBeNull();
    expect(parseDateText('04/11')).toBeNull();
    expect(parseCurrencyCents('R$ 1.234,56')).toBe(123456);
    expect(parseCurrencyCents('')).toBeNull();
    expect(sanitizeNumberText('8.5x', 1, false)).toBe('8,5');
    expect(sanitizeNumberText('8,55', 1, false)).toBe('8,5');
    expect(sanitizeNumberText('8,5', 0, false)).toBe('85');
    expect(parseNumberText('8,5')).toBe(8.5);
    expect(parseNumberText('-')).toBeNull();
  });
});

describe('NxMaskDirective', () => {
  it('CPF: formata ao digitar e guarda o texto formatado; incompleto vira erro com mensagem', () => {
    const { host, input } = render();
    typeInto(input('cpf'), '1234');
    expect(input('cpf').value).toBe('123.4');
    expect(host.cpf.errors).toEqual({ format: { message: 'O CPF deve estar no formato 000.000.000-00.' } });
    typeInto(input('cpf'), '12345678900');
    expect(input('cpf').value).toBe('123.456.789-00');
    expect(host.cpf.value).toBe('123.456.789-00');
    expect(host.cpf.valid).toBe(true);
    expect(input('cpf').getAttribute('inputmode')).toBe('numeric');
    expect(input('cpf').getAttribute('maxlength')).toBe('14');
    expect(input('cpf').getAttribute('placeholder')).toBe('000.000.000-00');
  });

  it('telefone: (34) 90000-0123 e erro enquanto incompleto', () => {
    const { host, input } = render();
    typeInto(input('phone'), '349000');
    expect(host.phone.errors).toEqual({ format: { message: 'O telefone deve estar no formato (34) 90000-0000.' } });
    typeInto(input('phone'), '34900000123');
    expect(input('phone').value).toBe('(34) 90000-0123');
    expect(host.phone.valid).toBe(true);
    expect(input('phone').getAttribute('inputmode')).toBe('tel');
  });

  it('moeda: o modelo guarda CENTAVOS e o texto sai em R$ com vírgula', () => {
    const { host, input } = render();
    typeInto(input('price'), '5');
    expect(input('price').value).toBe('R$ 0,05');
    typeInto(input('price'), '123456');
    expect(input('price').value).toBe('R$ 1.234,56');
    expect(host.price.value).toBe(123456);
    host.price.setValue(4990);
    expect(input('price').value).toBe('R$ 49,90');
    typeInto(input('price'), '');
    expect(host.price.value).toBeNull();
  });

  it('número: respeita o intervalo com a frase do catálogo e aceita decimais com vírgula', () => {
    const { host, input } = render();
    typeInto(input('hours'), '25');
    expect(host.hours.value).toBe(25);
    expect(host.hours.errors).toEqual({ range: { min: 0, max: 24, message: 'As horas por dia devem ser de 0 a 24.' } });
    typeInto(input('hours'), '24');
    expect(host.hours.valid).toBe(true);
    typeInto(input('score'), '8,5');
    expect(host.score.value).toBe(8.5);
    expect(input('score').getAttribute('inputmode')).toBe('decimal');
    input('score').dispatchEvent(new Event('blur'));
    expect(input('score').value).toBe('8,5');
  });

  it('data (pt-BR): o modelo guarda ISO, mostra dd/mm/aaaa e acusa data que não existe', () => {
    const { host, input } = render();
    typeInto(input('birth'), '04112026');
    expect(input('birth').value).toBe('04/11/2026');
    expect(host.birth.value).toBe('2026-11-04');
    typeInto(input('birth'), '31022026');
    expect(host.birth.value).toBeNull();
    expect(host.birth.errors).toEqual({ date: { message: 'A data deve estar no formato dd/mm/aaaa, por exemplo 04/11/2026.' } });
    host.birth.setValue('1980-03-09');
    expect(input('birth').value).toBe('09/03/1980');
  });

  it('valor nulo limpa o campo e desabilitar o controle desabilita o input', () => {
    const { host, input } = render();
    host.cpf.setValue('000.123.456-00');
    expect(input('cpf').value).toBe('000.123.456-00');
    host.cpf.setValue('');
    expect(input('cpf').value).toBe('');
    host.birth.setValue(null);
    expect(input('birth').value).toBe('');
    host.cpf.disable();
    expect(input('cpf').disabled).toBe(true);
  });
});
