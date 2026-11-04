import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ConsentService } from '@core/privacy';
import { configureCoreTest } from '@core/testing/test-helpers';
import { loginAs, pick, pickAll, text } from '../testing/dom';
import { ConsentToggleComponent, RevokeRequest } from './consent-toggle.component';
import { CONSENT_COPY } from './consent-copy';
import type { ConsentKey } from '@core/models';

@Component({
  imports: [ConsentToggleComponent],
  template: `
    <app-consent-toggle [caregiverId]="id" key="image_testimony" />
    <app-consent-toggle #health [caregiverId]="id" key="health_data" [autoRevoke]="auto" (revokeRequested)="requests.push($event)" (historyRequested)="history.push($event)" />
    <app-consent-toggle [caregiverId]="id" key="whatsapp_contact" readonly />
  `,
})
class HostComponent {
  id = 'cg_0017'; // C17: saúde e WhatsApp concedidos; imagem e People Analytics recusados
  auto = false;
  readonly requests: RevokeRequest[] = [];
  readonly history: ConsentKey[] = [];
}

function setup() {
  const env = configureCoreTest({ seed: true });
  loginAs('u7');
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const rows = () => pickAll(fixture.nativeElement as HTMLElement, 'app-consent-toggle');
  return { ...env, fixture, host: fixture.componentInstance, rows, consent: TestBed.inject(ConsentService) };
}

describe('ConsentToggleComponent', () => {
  it('mostra a pergunta em linguagem simples, o selo de estado e os detalhes no esqueleto de seis partes', () => {
    const { rows } = setup();
    const [image, health] = rows();
    expect(text(pick(image as HTMLElement, 'h4'))).toBe(CONSENT_COPY.image_testimony.question);
    expect(text(pick(image as HTMLElement, 'app-badge'))).toBe('Recusado');
    expect(text(pick(health as HTMLElement, 'app-badge'))).toBe('Ativo');
    const terms = pickAll(health as HTMLElement, '.consent__list dt').map((dt) => text(dt));
    expect(terms).toEqual(['O que vamos fazer', 'Por quê', 'Quem vê', 'Se você disser não', 'Se mudar de ideia']);
    expect(pick(health as HTMLElement, 'details').textContent).toContain('quando quiser');
  });

  it('nada vem pré-marcado: o interruptor reflete só o que foi concedido', () => {
    const { rows } = setup();
    const checked = rows().map((row) => pick<HTMLInputElement>(row, 'input[role="switch"]').checked);
    expect(checked).toEqual([false, true, true]);
  });

  it('ligar concede pelo ConsentService, grava o evento e muda o selo', () => {
    const { fixture, rows, consent } = setup();
    const image = rows()[0] as HTMLElement;
    pick<HTMLInputElement>(image, 'input[role="switch"]').click();
    fixture.detectChanges();
    expect(consent.status('cg_0017', 'image_testimony')).toBe('granted');
    expect(consent.history('cg_0017', 'image_testimony').at(-1)).toMatchObject({ status: 'granted', channel: 'in_person' });
    expect(text(pick(image, 'app-badge'))).toBe('Ativo');
    expect(text(pick(image, 'app-switch'))).toBe('Permitido');
  });

  it('desligar NÃO revoga sozinho: pede o diálogo de efeito com os efeitos da revogação', () => {
    const { fixture, host, rows, consent } = setup();
    const health = rows()[1] as HTMLElement;
    const toggle = pick<HTMLInputElement>(health, 'input[role="switch"]');
    toggle.click();
    fixture.detectChanges();
    expect(consent.status('cg_0017', 'health_data')).toBe('granted');
    expect(toggle.checked).toBe(true);
    expect(host.requests).toHaveLength(1);
    expect(host.requests[0]?.key).toBe('health_data');
    expect(host.requests[0]?.effects.join(' ')).toContain('Zarit');
  });

  it('com autoRevoke revoga na hora e mostra "Revogado"', () => {
    const env = configureCoreTest({ seed: true });
    loginAs('u7');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.auto = true;
    fixture.detectChanges();
    const health = pickAll(fixture.nativeElement as HTMLElement, 'app-consent-toggle')[1] as HTMLElement;
    pick<HTMLInputElement>(health, 'input[role="switch"]').click();
    fixture.detectChanges();
    expect(TestBed.inject(ConsentService).status('cg_0017', 'health_data')).toBe('revoked');
    expect(text(pick(health, 'app-badge'))).toBe('Revogado');
    expect(env.db.caregivers.get('cg_0017')?.status).toBe('paused_by_consent_revocation');
  });

  it('o botão "Ver histórico" avisa qual consentimento abrir e o modo leitura desabilita o interruptor', () => {
    const { fixture, host, rows } = setup();
    pick<HTMLButtonElement>(rows()[1] as HTMLElement, '.btn-link').click();
    fixture.detectChanges();
    expect(host.history).toEqual(['health_data']);
    expect(pick<HTMLInputElement>(rows()[2] as HTMLElement, 'input[role="switch"]').disabled).toBe(true);
  });
});
