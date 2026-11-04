import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureCoreTest } from '@core/testing/test-helpers';
import { Database } from '@core/data';
import { loginAs, pick, pickAll, text, typeInto } from '../testing/dom';
import { MaskedFieldComponent, OTHER_REASON, REVEAL_REASONS, RevealEvent } from './masked-field.component';

const CPF = '000.123.456-00';

@Component({
  imports: [MaskedFieldComponent],
  template: `
    <app-masked-field
      kind="cpf"
      label="CPF"
      [value]="cpf"
      entity="caregiver"
      entityId="cg_0042"
      field="cpf"
      subjectId="cg_0042"
      [own]="own"
      (revealed)="revealed.push($event)"
      (remasked)="remasked = remasked + 1"
    />
  `,
})
class HostComponent {
  cpf: string | null = CPF;
  own = true;
  remasked = 0;
  readonly revealed: RevealEvent[] = [];
}

function setup(user: string, own = true) {
  const env = configureCoreTest({ seed: true });
  loginAs(user);
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.own = own;
  fixture.detectChanges();
  return { ...env, fixture, host: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
}

describe('MaskedFieldComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('atendimento vê o valor mascarado, com botão de ícone E texto, e o valor real nem está no DOM', () => {
    const { root } = setup('u7');
    const toggle = pick<HTMLButtonElement>(root, '.masked__toggle');
    expect(text(toggle)).toBe('Mostrar');
    expect(toggle.querySelector('svg')).not.toBeNull();
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar CPF (pede motivo)');
    expect(text(root)).toContain('***.***.***-**');
    expect(root.innerHTML).not.toContain(CPF);
    expect(text(root)).toContain('CPF oculto.');
  });

  it('pede motivo pronto, mostra por 30 s, remascara sozinho e grava reveal no log', () => {
    const { fixture, host, root, db } = setup('u7');
    pick<HTMLButtonElement>(root, '.masked__toggle').click();
    fixture.detectChanges();
    const popover = pick(root, '.reason-popover');
    expect(popover.getAttribute('role')).toBe('dialog');
    expect(pickAll(popover, 'input[type="radio"]')).toHaveLength(REVEAL_REASONS.length + 1);

    // sem motivo: erro e nada é revelado
    pick<HTMLButtonElement>(popover, '.btn--primary').click();
    fixture.detectChanges();
    expect(text(pick(popover, '.field__error'))).toContain('Escolha o motivo');
    expect(root.innerHTML).not.toContain(CPF);

    pickAll<HTMLInputElement>(popover, 'input[type="radio"]')[0]?.click();
    fixture.detectChanges();
    expect(text(pick(popover, '.btn--primary'))).toBe('Mostrar por 30 segundos');
    pick<HTMLButtonElement>(popover, '.btn--primary').click();
    fixture.detectChanges();

    expect(root.querySelector('.reason-popover')).toBeNull();
    expect(pick(root, '.masked').getAttribute('data-state')).toBe('revealed');
    expect(text(pick(root, '.masked__real'))).toBe(CPF);
    expect(text(pick(root, '.masked__note'))).toContain('30 s');
    expect(text(pick(root, '[aria-live="polite"]'))).toContain('Dados visíveis por 30 segundos');
    expect(host.revealed).toEqual([{ field: 'cpf', reason: REVEAL_REASONS[0] as string }]);

    const entry = db.accessLog.list().at(-1);
    expect(entry).toMatchObject({ action: 'reveal', entity: 'caregiver', entityId: 'cg_0042', subjectCaregiverId: 'cg_0042', justification: REVEAL_REASONS[0], detail: 'campo: cpf' });

    vi.advanceTimersByTime(29_000);
    fixture.detectChanges();
    expect(text(pick(root, '.masked__note'))).toContain('1 s');
    expect(pick(root, '.masked').getAttribute('data-state')).toBe('revealed');

    vi.advanceTimersByTime(1_000);
    fixture.detectChanges();
    expect(pick(root, '.masked').getAttribute('data-state')).toBe('hidden');
    expect(root.innerHTML).not.toContain(CPF);
    expect(host.remasked).toBe(1);
  });

  it('não tem botão de copiar e o texto não pode ser selecionado enquanto mascarado', () => {
    const { fixture, root } = setup('u7');
    expect(pickAll(root, 'button').map((b) => text(b).toLowerCase()).join(' ')).not.toContain('copiar');
    pick<HTMLButtonElement>(root, '.masked__toggle').click();
    fixture.detectChanges();
    pickAll<HTMLInputElement>(root, '.reason-popover input[type="radio"]')[1]?.click();
    pick<HTMLButtonElement>(root, '.reason-popover .btn--primary').click();
    fixture.detectChanges();
    expect(pickAll(root, 'button').map((b) => text(b).toLowerCase()).join(' ')).not.toContain('copiar');
    expect(text(pick(root, '.masked__toggle'))).toBe('Ocultar');
  });

  it('"Ocultar" remascara na hora e cancela a contagem', () => {
    const { fixture, host, root } = setup('u7');
    pick<HTMLButtonElement>(root, '.masked__toggle').click();
    fixture.detectChanges();
    pickAll<HTMLInputElement>(root, '.reason-popover input[type="radio"]')[2]?.click();
    pick<HTMLButtonElement>(root, '.reason-popover .btn--primary').click();
    fixture.detectChanges();
    pick<HTMLButtonElement>(root, '.masked__toggle').click();
    fixture.detectChanges();
    expect(pick(root, '.masked').getAttribute('data-state')).toBe('hidden');
    expect(host.remasked).toBe(1);
    vi.advanceTimersByTime(60_000);
    expect(host.remasked).toBe(1);
  });

  it('"Outro" exige ao menos 10 caracteres e grava o texto como justificativa', () => {
    const { fixture, root, db } = setup('u7');
    pick<HTMLButtonElement>(root, '.masked__toggle').click();
    fixture.detectChanges();
    const radios = pickAll<HTMLInputElement>(root, '.reason-popover input[type="radio"]');
    radios[radios.length - 1]?.click();
    fixture.detectChanges();
    expect(text(pick(root, '.reason-popover .field__label'))).toBe('Descreva o motivo');
    typeInto(pick<HTMLTextAreaElement>(root, '.reason-popover textarea'), 'curto');
    pick<HTMLButtonElement>(root, '.reason-popover .btn--primary').click();
    fixture.detectChanges();
    expect(text(pick(root, '.reason-popover .field__error'))).toContain('ao menos 10 caracteres');
    expect(root.innerHTML).not.toContain(CPF);
    typeInto(pick<HTMLTextAreaElement>(root, '.reason-popover textarea'), 'Conferir cadastro duplicado');
    pick<HTMLButtonElement>(root, '.reason-popover .btn--primary').click();
    fixture.detectChanges();
    expect(db.accessLog.list().at(-1)?.justification).toBe('Conferir cadastro duplicado');
    expect(OTHER_REASON).toContain('Outro');
  });

  it('Esc fecha o motivo sem revelar nada', () => {
    const { fixture, root, db } = setup('u7');
    const before = db.accessLog.list().length;
    pick<HTMLButtonElement>(root, '.masked__toggle').click();
    fixture.detectChanges();
    pick(root, '.reason-popover').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('.reason-popover')).toBeNull();
    expect(db.accessLog.list().length).toBe(before);
  });

  it('a gestão vê só o código CUI e o valor real não entra no DOM', () => {
    const { root } = setup('u1');
    expect(text(pick(root, '.code-chip'))).toContain('CUI-0042');
    expect(root.querySelector('.masked__toggle')).toBeNull();
    expect(root.innerHTML).not.toContain(CPF);
    expect(root.innerHTML).not.toContain('***.***.***-**');
  });

  it('o profissional credenciado e o psicólogo de outro caso veem só o mascarado, sem botão', () => {
    const provider = setup('u10');
    expect(text(provider.root)).toContain('***.***.***-**');
    expect(provider.root.querySelector('.masked__toggle')).toBeNull();
    TestBed.resetTestingModule();
    const other = setup('u3', false);
    expect(other.root.querySelector('.masked__toggle')).toBeNull();
    expect(text(other.root)).toContain('***.***.***-**');
  });

  it('a responsável técnica pode pedir para mostrar (supervisão com motivo)', () => {
    const { root } = setup('u2');
    expect(root.querySelector('.masked__toggle')).not.toBeNull();
  });

  it('sem valor mostra "Não informado" em vez de célula em branco', () => {
    const env = configureCoreTest({ seed: true });
    loginAs('u7');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.cpf = null;
    fixture.detectChanges();
    expect(text(fixture.nativeElement as HTMLElement)).toBe('Não informado');
    expect(env.db).toBeInstanceOf(Database);
  });
});
