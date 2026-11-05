import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupervisionWindowService } from '../../core/audit/supervision-window.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { ZARIT_DEMO_ITEMS } from '../../core/rules/zarit-items';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { DraftService } from '../../shared/ui/forms/draft.service';
import { ZaritService } from './state/zarit.service';

const q = (app: BootedApp, selector: string) => app.root.querySelector<HTMLElement>(selector);
const text = (app: BootedApp, selector = 'main'): string => q(app, selector)?.textContent?.replace(/\s+/g, ' ') ?? '';
const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};

/** A RT abre o caso com o motivo já informado (a janela de 30 minutos), sem passar pelo portão. */
async function openAsRt(alertId: string, caregiverId: string): Promise<BootedApp> {
  TestBed.resetTestingModule();
  const app = await bootApp({ userId: 'u2', url: '/app/painel' });
  TestBed.inject(SupervisionWindowService).grant('zarit_alert', alertId, caregiverId, 'Supervisão de caso com alerta');
  await app.router.navigateByUrl(`/app/acompanhamento/alertas/${alertId}`);
  await settle(app.fixture);
  return app;
}

describe('Zarit e alerta: ajustes do Fix-2', () => {
  it('CX-016: o alerta vermelho mostra pontuação, faixa, evolução, canal, telefone oculto e o link para a ficha', async () => {
    const app = await openAsRt('zal_0001', 'cg_0001');
    const card = q(app, '[data-role="before-call"]');
    expect(card).toBeTruthy();
    expect(text(app, '[data-role="call-score"]')).toContain('63 de 88');
    expect(text(app, '[data-role="call-score"]')).toContain('Severa');
    // Ana Paula passou de 48 na adesão para 63 hoje.
    expect(text(app, '[data-role="call-evolution"]')).toContain('Subiu de 48 para 63 pontos');
    expect(text(app, '[data-role="call-channel"]').length).toBeGreaterThan(0);
    // O telefone aparece mascarado, com "Mostrar" (que pede o motivo e vai ao log).
    expect(card?.textContent).not.toContain('(34) 90000-');
    expect(card?.querySelector('app-masked-field button')?.textContent).toContain('Mostrar');
    expect(q(app, '[data-role="open-caregiver"]')?.getAttribute('href')).toBe('/app/cuidadores/cg_0001');
  });

  it('CX-018: os blocos dizem a que passos do POP-05 correspondem e "Abrir a ocorrência" leva à ocorrência do caso', async () => {
    const app = await openAsRt('zal_0001', 'cg_0001');
    const pops = Array.from(app.root.querySelectorAll('[data-role="pop-steps"]')).map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
    expect(pops.join(' | ')).toContain('passos 1 e 2 do POP-05');
    expect(pops.join(' | ')).toContain('passo 3 do POP-05');
    expect(pops.join(' | ')).toContain('passos 4 e 5 do POP-05');
    expect(pops.join(' | ')).toContain('passos 6 e 7 do POP-05');
    const link = q(app, '[data-role="occurrence-link"]');
    expect(link?.getAttribute('href')).toBe('/app/governanca/ocorrencias/occ_0002');
    // O-2 só tem o acolhimento feito: faltam os passos 2 a 7 (a mesma numeração da ocorrência).
    expect(link?.textContent).toContain('passos 2 a 7 do POP-05 pendentes');
  });

  it('CX-017: registrar o contato conclui o passo 2 com a hora e o autor reais, e não grava texto em passo de outra pessoa', async () => {
    const app = await openAsRt('zal_0001', 'cg_0001');
    const before = app.db.occurrences.get('occ_0002')?.steps ?? [];
    expect(before.find((s) => s.n === 2)?.doneAt).toBeUndefined();
    expect(before.find((s) => s.n === 1)?.byUserId).toBe('u3');
    const svc = TestBed.inject(ZaritService);
    const result = svc.registerContact('zal_0001', {
      date: '2026-11-04',
      time: '09:47',
      byUserId: 'u2',
      channel: 'phone',
      note: 'Conversamos por telefone.',
    });
    expect(result.ok).toBe(true);
    const steps = app.db.occurrences.get('occ_0002')?.steps ?? [];
    // O passo 2 é da Cecília, às 09:47, com o texto dela.
    expect(steps.find((s) => s.n === 2)).toMatchObject({ byUserId: 'u2', note: 'Conversamos por telefone.' });
    expect(steps.find((s) => s.n === 2)?.doneAt).toBe('2026-11-04T09:47:00-03:00');
    // O passo 1 continua do Dr. Rafael, sem o texto da Cecília.
    expect(steps.find((s) => s.n === 1)?.byUserId).toBe('u3');
    expect(steps.find((s) => s.n === 1)?.note).toBeUndefined();
  });

  it('CX-020: a situação do encaminhamento começa vazia quando o risco é moderado e não grava sem escolha', async () => {
    const app = await openAsRt('zal_0001', 'cg_0001');
    const svc = TestBed.inject(ZaritService);
    svc.registerContact('zal_0001', { date: '2026-11-04', time: '09:47', byUserId: 'u2', channel: 'phone' });
    svc.registerRisk('zal_0001', { level: 'moderate', note: 'Risco moderado, rede de apoio presente.' });
    await settle(app.fixture);
    const select = q(app, '[data-role="referral-category"]') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(text(app, '[data-role="referral-block"]')).toContain('nenhuma situação vem marcada');
    click(q(app, '[data-role="register-referral"]'));
    await settle(app.fixture);
    expect(text(app, '[data-role="referral-block"]')).toContain('Escolha a situação do encaminhamento.');
    expect(app.db.zaritAlerts.get('zal_0001')?.referralIds).toHaveLength(0);
  });

  it('CX-020: com risco alto a situação grave vem sugerida', async () => {
    const app = await openAsRt('zal_0001', 'cg_0001');
    const svc = TestBed.inject(ZaritService);
    svc.registerContact('zal_0001', { date: '2026-11-04', time: '09:47', byUserId: 'u2', channel: 'phone' });
    svc.registerRisk('zal_0001', { level: 'high', note: 'Risco alto, sem rede de apoio agora.' });
    await settle(app.fixture);
    expect((q(app, '[data-role="referral-category"]') as HTMLSelectElement).value).toBe('severe_distress_or_suicide_risk');
  });

  it('CX-019: a RT pede ao psicólogo que ligue agora; o aviso chega ao sino dele e o pedido fica na tela', async () => {
    const app = await openAsRt('zal_0002', 'cg_0002');
    const button = q(app, '[data-role="request-contact"]');
    expect(button?.textContent).toContain('Pedir à Dra. Beatriz Nogueira que ligue agora');
    click(button);
    await settle(app.fixture);
    expect(q(app, '[data-role="request-sent"]')?.textContent).toContain('Pedido enviado às 12:00');
    const request = app.db.notifications.find((n) => n.kind === 'contact_requested:zal_0002');
    expect(request?.userId).toBe(app.db.psychologists.get('psy_0002')?.userId);
    // O aviso é do psicólogo: o sino da RT não o mostra (o do psicólogo é coberto em notification-fix2.spec.ts).
    expect(TestBed.inject(NotificationService).items().some((i) => i.type === 'contact_requested')).toBe(false);
  });

  it('CX-019: só a RT pede o contato (a psicóloga do caso não vê o botão)', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u4', url: '/app/acompanhamento/alertas/zal_0002' });
    await settle(app.fixture);
    expect(q(app, '[data-role="request-contact"]')).toBeNull();
    expect(TestBed.inject(ZaritService).requestContact('zal_0002').ok).toBe(false);
  });

  it('CX-023: o rascunho do contato volta ao reabrir a tela e some quando o contato é registrado', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u3', url: '/app/painel' });
    TestBed.inject(DraftService).save('zarit-alert', 'zal_0001', {
      channel: 'whatsapp',
      note: 'Tentei às 09:30, sem resposta.',
      by: 'u3',
      riskLevel: null,
      riskNote: '',
    });
    await app.router.navigateByUrl('/app/acompanhamento/alertas/zal_0001');
    await settle(app.fixture);
    expect((q(app, '[data-role="contact-channel"]') as HTMLSelectElement).value).toBe('whatsapp');
    expect((q(app, '[data-role="contact-note"]') as HTMLTextAreaElement).value).toBe('Tentei às 09:30, sem resposta.');
    expect(q(app, '[data-role="draft-restored"]')?.textContent).toContain('Rascunho recuperado');
    click(q(app, '[data-role="register-contact"]'));
    await settle(app.fixture);
    expect(app.db.zaritAlerts.get('zal_0001')?.contact?.channel).toBe('whatsapp');
    expect(TestBed.inject(DraftService).load('zarit-alert', 'zal_0001')).toBeNull();
  });

  it('CX-023: o que se digita é guardado como rascunho enquanto a pessoa escreve', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/alertas/zal_0001' });
    await settle(app.fixture);
    const note = q(app, '[data-role="contact-note"]') as HTMLTextAreaElement;
    note.value = 'Anotação a meio caminho';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(app.fixture);
    expect(TestBed.inject(DraftService).load<{ note: string }>('zarit-alert', 'zal_0001')?.data.note).toBe('Anotação a meio caminho');
  });

  it('CX-031: nenhum enunciado da escala tem gênero marcado e o botão da fila diz de quem é', async () => {
    const gendered = /sobrecarregado|\bdividido\b|\btenso\b/i;
    ZARIT_DEMO_ITEMS.forEach((item) => expect(item).not.toMatch(gendered));
    expect(ZARIT_DEMO_ITEMS[21]).toBe('No geral, sinto que o cuidado me sobrecarrega.');
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/fila' });
    await settle(app.fixture);
    const labels = Array.from(app.root.querySelectorAll('[data-role="row-action"]')).map((b) => b.getAttribute('aria-label') ?? '');
    expect(labels.length).toBeGreaterThan(5);
    labels.forEach((label) => expect(label).toMatch(/ (de|em) \S/));
    expect(labels.some((l) => l.startsWith('Aplicar a escala em '))).toBe(true);
  });

  it('CX-031: a tela de aplicar diz qual foi a anterior no mesmo vocabulário do histórico', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/zarit/cg_0003/nova' });
    await settle(app.fixture);
    expect(text(app, '[data-role="intro"]')).toMatch(/Aplicação (de adesão|trimestral nº \d)/);
    expect(text(app, '[data-role="previous-application"]')).toMatch(/A anterior foi (a adesão|a aplicação trimestral nº \d), em \d{2}\/\d{2}\/\d{4}\./);
  });

  it('CX-025: o alerta abre com a página no topo', async () => {
    document.documentElement.scrollTop = 600;
    await openAsRt('zal_0001', 'cg_0001');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.documentElement.scrollTop).toBe(0);
  });
});
