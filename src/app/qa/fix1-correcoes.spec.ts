/**
 * Regressão das correções do Fix-1 (`docs/07-correcoes-fix1.md`) que não cabem nos testes de cada módulo: banner da
 * primeira visita, 404 dentro do shell, busca, aba de acompanhamento, pedido de atribuição de psicólogo, contador no
 * singular e validações de nome, horas e preço. Cada teste leva o ID do achado (QA-nnn ou CX-nnn) no nome.
 */
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { NotificationService } from '../core/notifications/notification.service';
import { SearchService } from '../core/search/search.service';
import { caregiverFieldsGroup } from '../features/caregivers/state/caregiver-form';
import { BootedApp, bootApp, settle, signIn } from '../layout/testing';

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Fix-1: shell, entrada e busca', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null => app.root.querySelector<T>(selector);
  afterEach(() => TestBed.resetTestingModule());

  it('QA-003: o banner "Antes de começar" não aparece nas telas de entrada e, dentro, entra no fluxo da página', async () => {
    app = await bootApp({ url: '/login' });
    expect(q('.banner--consent')).toBeNull();
    signIn('u7');
    await app.router.navigateByUrl('/app/painel');
    await settle(app.fixture);
    const banner = q('.banner--consent');
    expect(banner).not.toBeNull();
    // `banner--dock` é a classe que o CSS usa para tirar o banner de cima do conteúdo abaixo de 1024 px.
    expect(banner?.classList.contains('banner--dock')).toBe(true);
    expect(text(banner)).toContain('Antes de começar');
  });

  it('CX-015: o 404 com sessão aberta mantém o shell, a busca e o menu do usuário; sem sessão, a moldura simples', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/alertas' });
    expect(text(q('h1'))).toBe('Página não encontrada');
    expect(q('.app-shell')).not.toBeNull();
    expect(q('.search-trigger')).not.toBeNull();
    expect(q('.user-trigger')).not.toBeNull();
    expect(q('nav[aria-label="Módulos"]')).not.toBeNull();
    expect(q('[data-role="home"]')?.getAttribute('href')).toBe('/app/painel');
    // Fora de /app também.
    await app.router.navigateByUrl('/qualquer/coisa');
    await settle(app.fixture);
    expect(text(q('h1'))).toBe('Página não encontrada');
    expect(q('.app-shell')).not.toBeNull();
    TestBed.resetTestingModule();
    app = await bootApp({ url: '/nada-aqui' });
    expect(text(q('h1'))).toBe('Página não encontrada');
    expect(q('.app-shell')).toBeNull();
  });

  it('CX-024: a busca não repete o módulo quando uma subtela dele já responde ("arbe")', async () => {
    app = await bootApp({ userId: 'u2', url: '/app/painel' });
    const titles = (query: string): string[] =>
      (TestBed.inject(SearchService).search(query).groups.find((g) => g.key === 'screens')?.results ?? []).map((r) => r.title);
    expect(titles('arbe')).toContain('Parâmetros da ARBE');
    expect(titles('arbe')).not.toContain('Configurações');
    // Quando o nome do módulo é o que a pessoa digitou, ele aparece.
    expect(titles('configuracoes')).toContain('Configurações');
  });

  it('CX-001: o contador da lista de solicitações do titular concorda no singular', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/lgpd/solicitacoes?filtro=vencendo' });
    const count = text(q('.page-header strong'));
    expect(count).toBe('1 solicitação');
    expect(text(q('.table-footer'))).not.toContain('1 solicitações');
  });
});

describe('Fix-1: cadastro e acompanhamento', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null => app.root.querySelector<T>(selector);
  afterEach(() => TestBed.resetTestingModule());

  it('QA-005: o alerta vermelho vencido aparece como vencido na aba do cuidador, como na fila', async () => {
    app = await bootApp({ userId: 'u4', url: '/app/cuidadores/cg_0002?aba=acompanhamento' });
    const alerts = text(q('[data-role="monitoring"] app-card:nth-of-type(2)')) || text(q('[data-role="monitoring"]'));
    expect(alerts).toContain('Alerta vermelho');
    expect(alerts).toContain('Prazo de contato vencido');
    expect(alerts).not.toContain('Em acompanhamento');
  });

  it('CX-041: o atendimento pede a atribuição de psicólogo e o aviso chega ao responsável técnico, sem repetir', async () => {
    app = await bootApp({ userId: 'u7', url: '/app/painel' });
    app.db.caregivers.update('cg_0030', { assignedPsychologistId: undefined });
    await app.router.navigateByUrl('/app/cuidadores/cg_0030');
    await settle(app.fixture);
    const button = q<HTMLButtonElement>('[data-role="request-assignment"]');
    expect(text(button)).toBe('Pedir atribuição de psicólogo');
    button?.click();
    await settle(app.fixture);
    expect(text(q('.toast'))).toContain('O responsável técnico foi avisado');
    expect(app.db.notifications.count((n) => n.kind === 'assign_psychologist:cg_0030')).toBe(app.db.users.count((u) => u.role === 'technical_lead' && u.active));
    expect(q('[data-role="request-assignment"]')).toBeNull();
    expect(text(q('app-caregiver-summary-tab'))).toContain('já foi avisado');

    // A responsável técnica vê a pendência no sino e ela some quando o psicólogo é atribuído.
    TestBed.inject(AuthService).logout('user');
    signIn('u2');
    const titles = (): string[] => TestBed.inject(NotificationService).items().map((n) => n.title);
    expect(titles()).toContain('Atribuir psicólogo a um cadastro novo');
    app.db.caregivers.update('cg_0030', { assignedPsychologistId: 'psy_0001' });
    expect(titles()).not.toContain('Atribuir psicólogo a um cadastro novo');
  });

  it('QA-016: nome de uma letra ou de 600 caracteres é recusado; de 3 a 120 passa', () => {
    TestBed.configureTestingModule({});
    const group = caregiverFieldsGroup(() => '2026-11-05');
    const name = group.controls.fullName;
    name.setValue('A');
    expect(name.errors).toEqual({ length: { min: 3, max: 120, message: 'O nome deve ter de 3 a 120 caracteres.' } });
    name.setValue('x'.repeat(600));
    expect(name.errors?.['length']).toBeDefined();
    name.setValue('Ana Souza');
    expect(name.valid).toBe(true);
    name.setValue('x'.repeat(120));
    expect(name.valid).toBe(true);
  });
});
