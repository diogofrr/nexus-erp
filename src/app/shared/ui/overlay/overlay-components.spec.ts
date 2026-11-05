import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { InactivityService, INACTIVITY_CONFIG } from '../../../core/auth/inactivity.service';
import { AuthService, TWO_FACTOR_CODE } from '../../../core/auth/auth.service';
import { UiNoticeService } from '../../../core/privacy/browser-data.service';
import { configureCoreTest } from '../../../core/testing/test-helpers';
import { BannerComponent } from './banner.component';
import { ConsentBannerComponent } from './consent-banner.component';
import { DrawerComponent } from './drawer.component';
import { IconComponent } from '../display/icon.component';
import { SessionDialogComponent, formatCountdown, spokenTime } from './session-dialog.component';

@Component({
  imports: [BannerComponent, IconComponent],
  template: `
    <app-banner variant="attention" heading="Documento vence em 12 dias">
      Peça o novo registro.
      <button bannerActions class="btn btn--sm">Ver documento</button>
    </app-banner>
    <app-banner variant="danger">Não foi possível salvar.</app-banner>
    <app-banner variant="prototype">Protótipo de demonstração.</app-banner>
    <svg appIcon="clock" size="lg"></svg>
  `,
})
class BannerHostComponent {}

describe('BannerComponent e IconComponent', () => {
  it('aplica a variante, o ícone e o papel certos', async () => {
    const fixture = TestBed.createComponent(BannerHostComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const banners = root.querySelectorAll('.banner');
    expect(banners[0]?.classList.contains('banner--attention')).toBe(true);
    expect(banners[0]?.getAttribute('role')).toBe('status');
    expect(banners[0]?.querySelector('.banner__title')?.textContent).toContain('vence em 12 dias');
    expect(banners[0]?.querySelector('.banner__actions button')?.textContent).toContain(
      'Ver documento',
    );
    expect(banners[1]?.getAttribute('role')).toBe('alert');
    expect(banners[2]?.classList.contains('banner--prototype')).toBe(true);
    expect(banners[2]?.querySelector('.banner__actions')?.childNodes).toHaveLength(0);
    const use = root.querySelector('svg.icon--lg use') as SVGUseElement;
    expect(use.getAttribute('href')).toBe('icons/sprite.svg#i-clock');
    expect(use.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});

@Component({
  imports: [DrawerComponent],
  template: `
    <button id="origem" type="button">Abrir</button>
    <app-drawer [(open)]="open" heading="Detalhe da mensagem" subtitle="WhatsApp">
      <p>Corpo</p>
      <button drawerFooter class="btn" id="dentro">Enviar</button>
    </app-drawer>
  `,
})
class DrawerHostComponent {
  readonly open = signal(false);
}

describe('DrawerComponent', () => {
  it('abre, mostra título e rodapé, fecha com Esc e devolve o foco a quem abriu', async () => {
    const fixture = TestBed.createComponent(DrawerHostComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const origin = root.querySelector('#origem') as HTMLButtonElement;
    origin.focus();

    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    await fixture.whenStable();
    const dialog = root.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.querySelector('.drawer__title')?.textContent).toContain('Detalhe da mensagem');
    expect(dialog.querySelector('#dentro')).not.toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Fechar');

    dialog.dispatchEvent(new KeyboardEvent('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(origin);
  });
});

describe('ConsentBannerComponent', () => {
  it('aparece na primeira visita e some depois do "Entendi" (grava pelo núcleo)', async () => {
    configureCoreTest({ seed: false });
    const fixture = TestBed.createComponent(ConsentBannerComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.banner--consent')).not.toBeNull();
    expect(root.textContent).toContain('protótipo de demonstração');

    (root.querySelector('[data-role="details"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(root.textContent).toContain('Meus dados no navegador');

    (root.querySelector('[data-role="acknowledge"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(root.querySelector('.banner--consent')).toBeNull();
    expect(TestBed.inject(UiNoticeService).acknowledged()).toBe(true);
  });
});

describe('SessionDialogComponent', () => {
  it('formata a contagem como m:ss', () => {
    expect(formatCountdown(119)).toBe('1:59');
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(null)).toBe('0:00');
    expect(spokenTime(100)).toBe('1 minuto e 40 segundos');
    expect(spokenTime(120)).toBe('2 minutos');
    expect(spokenTime(45)).toBe('45 segundos');
    expect(spokenTime(61)).toBe('1 minuto e 1 segundo');
  });

  it('abre no aviso, anuncia só ao abrir, em 1:00 e em 0:30 e "continuar" fecha o aviso', async () => {
    configureCoreTest({
      seed: true,
      providers: [
        provideRouter([]),
        {
          provide: INACTIVITY_CONFIG,
          useValue: { timeoutMs: 120_000, warningMs: 20_000, tickMs: 3_600_000 },
        },
      ],
    });
    const auth = TestBed.inject(AuthService);
    auth.selectProfile('u1');
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
    const inactivity = TestBed.inject(InactivityService);
    const fixture = TestBed.createComponent(SessionDialogComponent);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const dialog = root.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(false);

    inactivity.start();
    const base = inactivity['lastActivityMs'];
    inactivity.evaluate(base + 20_000);
    await fixture.whenStable();
    await fixture.whenStable();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(inactivity.warningVisible()).toBe(true);
    expect(root.querySelector('[data-role="countdown"]')?.textContent).toBe('1:40');
    const live = root.querySelector('#nx-session-live') as HTMLElement;
    expect(live.textContent).toContain('1 minuto e 40 segundos');
    expect(document.activeElement).toBe(root.querySelector('[data-role="extend"]'));

    // Avança 30 s: o texto lido não muda a cada segundo, só em 1:00 e 0:30.
    const before = live.textContent;
    inactivity.evaluate(base + 30_000);
    await fixture.whenStable();
    expect(live.textContent).toBe(before);
    inactivity.evaluate(base + 60_000);
    await fixture.whenStable();
    expect(live.textContent).toContain('1 minuto');
    inactivity.evaluate(base + 90_000);
    await fixture.whenStable();
    expect(live.textContent).toContain('30 segundos');

    (root.querySelector('[data-role="extend"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(inactivity.warningVisible()).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(false);
    inactivity.stop();
  });
});
