import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { pick, text, typeInto } from '../testing/dom';
import { ERROR_MESSAGES, NxValidators, fieldErrorMessage } from './form-errors';
import { FormFieldComponent } from './form-field.component';
import { NxInputDirective } from './input.directive';
import { NxMaskDirective } from './mask.directive';

@Component({
  imports: [ReactiveFormsModule, FormFieldComponent, NxInputDirective, NxMaskDirective],
  template: `
    <form [formGroup]="form">
      <app-form-field label="Nome completo" hint="Como está no documento." controlId="nome">
        <input appInput formControlName="name" />
      </app-form-field>
      <app-form-field label="CPF fictício" optional>
        <input appInput appMask="cpf" formControlName="cpf" />
      </app-form-field>
      <app-form-field label="Observação" [error]="serverError">
        <textarea appInput formControlName="note"></textarea>
      </app-form-field>
      <app-form-field label="Plano">
        <select appInput formControlName="plan"><option value="livre">Livre</option></select>
      </app-form-field>
    </form>
  `,
})
class HostComponent {
  serverError: string | null = null;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [NxValidators.required('o nome completo')] }),
    cpf: new FormControl('', { nonNullable: true, validators: [NxValidators.fictitiousCpf] }),
    note: new FormControl('', { nonNullable: true }),
    plan: new FormControl('livre', { nonNullable: true }),
  });
}

function render() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
}

describe('FormFieldComponent + appInput', () => {
  it('liga rótulo, dica e controle por for, id e aria-describedby', () => {
    const { root } = render();
    const label = pick<HTMLLabelElement>(root, 'label.field__label');
    const input = pick<HTMLInputElement>(root, 'input[formControlName="name"]');
    const hint = pick(root, '.field__hint');
    expect(label.htmlFor).toBe('nome');
    expect(input.id).toBe('nome');
    expect(input.classList.contains('input')).toBe(true);
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(root.querySelector('.field__error')).toBeNull();
  });

  it('aplica a classe pela tag (textarea e select)', () => {
    const { root } = render();
    expect(pick(root, 'textarea').classList.contains('textarea')).toBe(true);
    expect(pick(root, 'select').classList.contains('select')).toBe(true);
  });

  it('só mostra o erro depois que o campo é tocado, com prefixo oculto "Erro:" e aria-invalid', () => {
    const { fixture, host, root } = render();
    host.form.controls.name.markAsTouched();
    fixture.detectChanges();
    const error = pick(root, '.field__error');
    const input = pick<HTMLInputElement>(root, 'input[formControlName="name"]');
    expect(text(error)).toBe('Erro: Informe o nome completo.');
    expect(pick(error, '.sr-only').textContent).toContain('Erro:');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
    expect(pick(root, 'app-form-field').classList.contains('field--error')).toBe(true);
  });

  it('o erro some quando a pessoa corrige, sem limpar o que digitou', () => {
    const { fixture, host, root } = render();
    host.form.controls.name.markAsTouched();
    fixture.detectChanges();
    const input = pick<HTMLInputElement>(root, 'input[formControlName="name"]');
    typeInto(input, 'Ana Paula Ferraz');
    fixture.detectChanges();
    expect(root.querySelector('.field__error')).toBeNull();
    expect(input.value).toBe('Ana Paula Ferraz');
  });

  it('marca "(opcional)" e não usa asterisco nos obrigatórios', () => {
    const { root } = render();
    const labels = Array.from(root.querySelectorAll('.field__label')).map((l) => text(l));
    expect(labels).toContain('CPF fictício (opcional)');
    expect(labels).toContain('Nome completo');
    expect(labels.join(' ')).not.toContain('*');
  });

  it('erro explícito (servidor) tem prioridade e aparece sem o campo ser tocado', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.serverError = ERROR_MESSAGES.system;
    fixture.detectChanges();
    fixture.detectChanges();
    const errors = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.field__error')).map((e) => text(e));
    expect(errors).toEqual([`Erro: ${ERROR_MESSAGES.system}`]);
  });

  it('o validador de CPF fictício rejeita um CPF real com a frase do catálogo', () => {
    const { fixture, host, root } = render();
    const cpf = pick<HTMLInputElement>(root, 'input[formControlName="cpf"]');
    typeInto(cpf, '52998224725');
    host.form.controls.cpf.markAsTouched();
    fixture.detectChanges();
    expect(cpf.value).toBe('529.982.247-25');
    expect(text(pick(root, '.field--error .field__error'))).toBe('Erro: Parece um CPF real. Use um CPF fictício.');
    typeInto(cpf, '00012345600');
    fixture.detectChanges();
    expect(host.form.controls.cpf.valid).toBe(true);
  });
});

describe('catálogo de mensagens e validadores', () => {
  it('traduz os validadores nativos do Angular para frases do catálogo', () => {
    const control = new FormControl('', { validators: [Validators.required] });
    expect(fieldErrorMessage(control.errors, 'Data de nascimento')).toBe('Informe data de nascimento.');
    expect(fieldErrorMessage(new FormControl('a', Validators.minLength(3)).errors, 'Senha')).toBe('Senha deve ter pelo menos 3 caracteres.');
    expect(fieldErrorMessage(null)).toBeNull();
  });

  it('cada tipo de erro usa a frase do design system', () => {
    expect(ERROR_MESSAGES.required('a data de nascimento')).toBe('Informe a data de nascimento.');
    expect(ERROR_MESSAGES.format('O telefone', '(34) 90000-0000')).toBe('O telefone deve estar no formato (34) 90000-0000.');
    expect(ERROR_MESSAGES.minor).toBe('A pessoa cuidadora deve ter 18 anos ou mais.');
    expect(ERROR_MESSAGES.email).toBe('Use um e-mail que termine em @exemplo.com.br.');
    expect(ERROR_MESSAGES.range('As horas por dia', 0, 24)).toBe('As horas por dia devem ser de 0 a 24.');
    expect(ERROR_MESSAGES.duplicate).toBe('Já existe um cadastro com este código.');
  });

  it('valida e-mail fictício, telefone fictício, maioridade, intervalo e duplicidade', () => {
    const email = (v: string) => fieldErrorMessage(NxValidators.fictitiousEmail(new FormControl(v)), 'E-mail');
    expect(email('ana@exemplo.com.br')).toBeNull();
    expect(email('ana@gmail.com')).toBe(ERROR_MESSAGES.email);
    expect(email('ana')).toBe(ERROR_MESSAGES.emailShape);
    expect(NxValidators.fictitiousPhone(new FormControl('(34) 90000-0123'))).toBeNull();
    expect(fieldErrorMessage(NxValidators.fictitiousPhone(new FormControl('(11) 98888-7777')))).toBe(ERROR_MESSAGES.phone);
    const adult = NxValidators.adult(() => '2026-11-04');
    expect(adult(new FormControl('2010-01-01'))).toEqual({ minor: { message: ERROR_MESSAGES.minor } });
    expect(adult(new FormControl('1980-01-01'))).toBeNull();
    expect(fieldErrorMessage(NxValidators.range(0, 24, 'As horas por dia')(new FormControl(25)))).toBe('As horas por dia devem ser de 0 a 24.');
    expect(NxValidators.unique((v) => v === 'CUI-0001')(new FormControl('CUI-0001'))).toEqual({ duplicate: { message: ERROR_MESSAGES.duplicate } });
  });
});
