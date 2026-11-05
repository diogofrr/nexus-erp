import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { NotificationService } from '../../core/notifications/notification.service';
import { ConsentService } from '../../core/privacy/consent.service';
import { BootedApp, bootApp, settle, signIn } from '../../layout/testing';
import { ArbeService } from './state/arbe.service';
import { ZaritService } from './state/zarit.service';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};

const FORBIDDEN_WORDS = /diagnóstico|eficácia|paciente|guerreira|anjo|[\u2013\u2014]/i;

/** 22 respostas de 0 a 4 cuja soma é `total` (0 a 88). */
function answersFor(total: number): number[] {
  const answers = new Array<number>(22).fill(0);
  let left = total;
  for (let i = 0; i < answers.length && left > 0; i += 1) {
    const value = Math.min(4, left);
    answers[i] = value;
    left -= value;
  }
  return answers;
}

const q = (app: BootedApp, selector: string) => app.root.querySelector<HTMLElement>(selector);
const text = (app: BootedApp, selector = 'main'): string => q(app, selector)?.textContent?.replace(/\s+/g, ' ') ?? '';
const dialog = (app: BootedApp): HTMLDialogElement => app.root.querySelector('app-dialog-host dialog') as HTMLDialogElement;
const key = (k: string): void => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
};

describe('M06 aplicar a escala (F05, SCR-M06-02 e 03)', () => {
  it('63 hoje cria o alerta vermelho com prazo 23:59, a ocorrência POP-05 e as pendências do dia (AC-M06-04)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/fila' });
    const svc = TestBed.inject(ZaritService);
    const occurrences = app.db.occurrences.size();
    const result = svc.apply('cg_0005', answersFor(63));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.total).toBe(63);
    expect(result.value.band).toBe('severe');
    const alert = result.value.alert;
    expect(alert?.level).toBe('red');
    expect(alert?.deadlineAt).toBe('2026-11-04T23:59:00-03:00');
    expect(alert?.status).toBe('open');
    // A ocorrência nasce sozinha, ligada ao alerta, restrita ao RT e ao psicólogo do caso.
    expect(app.db.occurrences.size()).toBe(occurrences + 1);
    const occurrence = app.db.occurrences.get(alert?.occurrenceId ?? '');
    expect(occurrence?.kind).toBe('pop05_risk');
    expect(occurrence?.sourceAlertId).toBe(alert?.id);
    expect(occurrence?.restrictedToUserIds).toEqual(expect.arrayContaining(['u2', 'u3']));
    expect(occurrence?.steps).toHaveLength(7);
    // A próxima aplicação (3 meses depois) já fica agendada.
    expect(result.value.next.dueDate).toBe('2027-02-04');
    expect(result.value.next.status).toBe('scheduled');
    // O psicólogo e o RT recebem a pendência pelo título da tarefa, sem escore.
    const mine = TestBed.inject(NotificationService).items();
    const pending = mine.find((n) => n.key === `red_contact_pending:${alert?.id}`);
    expect(pending?.title).toBe('Contato do mesmo dia pendente');
    expect(pending?.context).not.toMatch(/63|severa/i);
    signIn('u2');
    const forTl = TestBed.inject(NotificationService).items();
    expect(forTl.some((n) => n.key === `red_contact_pending:${alert?.id}`)).toBe(true);
    // O log guarda a criação sem o escore.
    const logs = app.db.accessLog.list().filter((e) => e.entity === 'zarit_assessment' && e.action === 'create');
    expect(logs.length).toBeGreaterThan(0);
    logs.forEach((e) => expect(`${e.detail ?? ''}`).not.toContain('63'));
  });

  it('41 a 60 cria o alerta amarelo e a tarefa "revisar rede de apoio"; o cuidador ganha as vagas prioritárias (AC-M06-07)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/fila' });
    const result = TestBed.inject(ZaritService).apply('cg_0005', answersFor(48));
    expect(result.ok && result.value.alert?.level).toBe('yellow');
    expect(result.ok && result.value.alert?.supportNetworkReviewDone).toBe(false);
    expect(result.ok && result.value.alert?.deadlineAt).toBeUndefined();
    const task = TestBed.inject(NotificationService).items().find((n) => n.type === 'support_network_task');
    expect(task?.title).toBe('Tarefa: revisar rede de apoio');
    expect(app.db.zaritAlerts.count((a) => a.caregiverId === 'cg_0005' && a.level === 'yellow' && a.status !== 'closed')).toBe(1);
  });

  it('as faixas e os limites aparecem no resultado: 0, 20, 21, 40, 41, 60, 61 e 88 (AC-M06-01)', async () => {
    const expected: [number, string][] = [
      [0, 'Sobrecarga ausente ou pequena'],
      [20, 'Sobrecarga ausente ou pequena'],
      [21, 'Sobrecarga moderada'],
      [40, 'Sobrecarga moderada'],
      [41, 'Sobrecarga moderada a severa'],
      [60, 'Sobrecarga moderada a severa'],
      [61, 'Sobrecarga severa'],
      [88, 'Sobrecarga severa'],
    ];
    for (const [total, label] of expected) {
      TestBed.resetTestingModule();
      const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/fila' });
      const result = TestBed.inject(ZaritService).apply('cg_0005', answersFor(total));
      expect(result.ok, `total ${total}`).toBe(true);
      if (!result.ok) {
        return;
      }
      await app.router.navigateByUrl(`/app/acompanhamento/zarit/cg_0005/resultado/${result.value.assessment.id}`);
      await settle(app.fixture);
      const content = text(app);
      expect(content, `total ${total}`).toContain(label);
      expect(q(app, '[data-role="total"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(`${total} de 88`);
      expect(content).toContain('Este resultado apoia a sua escuta clínica');
      expect(content).not.toMatch(FORBIDDEN_WORDS);
      const alert = result.value.alert;
      expect(alert?.level ?? null).toBe(total >= 61 ? 'red' : total >= 41 ? 'yellow' : null);
    }
  });

  it('respostas fora de 0 a 4 ou faltando são rejeitadas no serviço (AC-M06-03)', async () => {
    await bootApp({ userId: 'u3', url: '/app/acompanhamento/fila' });
    const svc = TestBed.inject(ZaritService);
    const bad = answersFor(10);
    bad[3] = 5;
    expect(svc.apply('cg_0005', bad).ok).toBe(false);
    expect(svc.apply('cg_0005', answersFor(10).slice(0, 21)).ok).toBe(false);
    const neg = answersFor(10);
    neg[0] = -1;
    expect(svc.apply('cg_0005', neg).ok).toBe(false);
  });

  it('o assistente de um item por tela: teclas 0 a 4, Concluir desabilitado com o item que falta, revisão e resultado (AC-M06-02)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/zarit/cg_0005/nova' });
    expect(text(app)).toContain('Aplicação trimestral nº 1');
    expect(text(app)).toContain('Enunciados de demonstração');
    expect(text(app)).toContain('Dado sensível · cifrado em repouso (simulado)');
    click(q(app, '[data-role="begin"]'));
    await settle(app.fixture);
    expect(text(app)).toContain('Item 1 de 22');
    // Total e faixa não aparecem durante a aplicação.
    expect(text(app)).toContain('Resultado e faixa só aparecem ao concluir.');
    // Vai ao último item sem responder: o botão fica desabilitado e diz o que falta.
    click(app.root.querySelectorAll<HTMLElement>('.item-map__btn')[21]);
    await settle(app.fixture);
    const finish = app.root.querySelector('.wizard__foot .btn--primary') as HTMLButtonElement;
    expect(finish.getAttribute('aria-disabled')).toBe('true');
    expect(app.root.querySelector('.wizard__foot')?.textContent).toContain('Faltam os itens');
    // Responde os 22 itens com a tecla 2 (avançar sozinho) e conclui: 44 pontos, faixa amarela.
    click(app.root.querySelectorAll<HTMLElement>('.item-map__btn')[0]);
    await settle(app.fixture);
    for (let i = 0; i < 22; i += 1) {
      key('2');
      await settle(app.fixture);
    }
    click(app.root.querySelector('.wizard__foot .btn--primary'));
    await settle(app.fixture);
    expect(q(app, '[data-role="review"]')).toBeTruthy();
    click(q(app, '[data-role="finish"]'));
    await settle(app.fixture);
    expect(dialog(app).textContent).toContain('não pode mais ser editada');
    click(dialog(app).querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    await settle(app.fixture);
    expect(app.router.url).toContain('/app/acompanhamento/zarit/cg_0005/resultado/');
    expect(q(app, '[data-role="total"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('44 de 88');
    expect(q(app, '[data-role="alert-yellow"]')?.textContent).toContain('Abrir tarefa de revisão da rede de apoio');
    // A aplicação ficou assinada, sem rascunho.
    const done = app.db.zaritAssessments.list().filter((z) => z.caregiverId === 'cg_0005' && z.status === 'completed').at(-1);
    expect(done?.total).toBe(44);
    expect(done?.signedAt).toBeTruthy();
    expect(done?.answers).toHaveLength(22);
  });

  it('sem consentimento de saúde não há aplicação nem rascunho; revogar fecha os alertas e tira do painel (AC-M06-09)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/fila' });
    const consent = TestBed.inject(ConsentService);
    expect(app.db.zaritAlerts.get('zal_0001')?.status).toBe('open');
    consent.revoke('cg_0001', 'health_data', { channel: 'phone' });
    expect(app.db.zaritAlerts.get('zal_0001')?.status).toBe('closed');
    expect(app.db.zaritAlerts.get('zal_0001')?.closureNote).toBe('consentimento revogado');
    const svc = TestBed.inject(ZaritService);
    const blocked = svc.apply('cg_0001', answersFor(10));
    expect(blocked.ok).toBe(false);
    expect(blocked.ok === false && blocked.errors[0]?.message).toContain('Sem consentimento de dados de saúde');
    await app.router.navigateByUrl('/app/acompanhamento/zarit/cg_0001/nova');
    await settle(app.fixture);
    expect(q(app, '[data-role="no-consent"]')).toBeTruthy();
    expect(app.root.querySelector('app-wizard')).toBeNull();
    // Nenhum rascunho foi gravado.
    expect(Array.from(app.local.data.keys()).some((k) => k.includes('draft:zarit'))).toBe(false);
    // Sai da fila e do painel.
    await app.router.navigateByUrl('/app/acompanhamento/fila');
    await settle(app.fixture);
    expect(text(app)).not.toContain('Ana Paula Ferraz');
  });
});

describe('M06 fila e alerta vermelho (F06, SCR-M06-01 e 05)', () => {
  it('a fila ordena vermelho vencido, vermelho do dia, ARBE crítico, amarelo, Zarit vencida e a vencer (AC-M06-05, AC-M06-16)', async () => {
    const app = await bootApp({ userId: 'u2', url: '/app/acompanhamento/fila' });
    const rows = Array.from(app.root.querySelectorAll('app-data-table tbody tr, app-data-table .table tbody tr'));
    expect(rows.length).toBeGreaterThan(3);
    const content = rows.map((r) => r.textContent?.replace(/\s+/g, ' ') ?? '');
    expect(content[0]).toContain('Maria Aparecida Lemos');
    expect(content[0]).toContain('Prazo de contato vencido');
    expect(content[1]).toContain('Ana Paula Ferraz');
    expect(content[1]).toContain('Contato do mesmo dia pendente');
    const order = ['Prazo de contato vencido', 'Contato do mesmo dia pendente', 'Alerta de esgotamento (ARBE): crítico', 'Alerta amarelo', 'Alerta de esgotamento (ARBE): atenção', 'Aplicação da escala vencida', 'Aplicação da escala a vencer'];
    const rank = (row: string): number => order.findIndex((o) => row.includes(o));
    const ranks = content.map(rank).filter((n) => n >= 0);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    // O vermelho do dia mostra o cronômetro em texto.
    expect(content[1]).toMatch(/Faltam \d+ h/);
    expect(text(app)).not.toMatch(FORBIDDEN_WORDS);
  });

  it('o vermelho de Maria está vencido e escalado, visível ao RT (AC-M06-05)', async () => {
    const app = await bootApp({ userId: 'u2', url: '/app/acompanhamento/alertas/zal_0002' });
    // O RT abre o caso pelo portão de supervisão, com motivo e log.
    expect(q(app, '[data-role="supervision-gate"]')).toBeTruthy();
    click(app.root.querySelector<HTMLInputElement>('app-supervision-gate input[type="radio"]'));
    click(q(app, '[data-role="gate-open"]'));
    await settle(app.fixture);
    expect(q(app, '[data-role="supervision-gate"]')).toBeNull();
    expect(q(app, '[data-role="countdown"]')?.getAttribute('data-state')).toBe('overdue');
    expect(text(app)).toContain('Escalado ao responsável técnico');
    expect(text(app)).toContain('Você pode registrar o contato em nome da equipe');
    expect(app.db.accessLog.list().some((e) => e.action === 'supervise' && e.entity === 'zarit_alert' && e.entityId === 'zal_0002')).toBe(true);
  });

  it('contato, avaliação de risco e encaminhamento alimentam a ocorrência e só então o alerta encerra (AC-M06-06)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/fila' });
    const svc = TestBed.inject(ZaritService);
    const applied = svc.apply('cg_0005', answersFor(70));
    if (!applied.ok || !applied.value.alert) {
      throw new Error('a aplicação deveria criar o alerta vermelho');
    }
    const alertId = applied.value.alert.id;
    const occurrenceId = applied.value.alert.occurrenceId ?? '';
    // Sem nada registrado, não encerra e diz o que falta.
    const early = svc.closeAlert(alertId);
    expect(early.ok).toBe(false);
    expect(early.ok === false && early.errors[0]?.message).toContain('horário do contato');
    expect(early.ok === false && early.errors[0]?.message).toContain('nível e nota da avaliação de risco');
    // Horário futuro é recusado.
    const future = svc.registerContact(alertId, { date: '2026-11-04', time: '23:00', byUserId: 'u3', channel: 'phone' });
    expect(future.ok).toBe(false);
    expect(future.ok === false && future.errors[0]?.message).toBe('O horário do contato não pode ser depois de agora.');
    // Contato às 10:42 (agora é 12:00): prazo cumprido, passos 1 e 2 da ocorrência já feitos.
    const contact = svc.registerContact(alertId, { date: '2026-11-04', time: '10:42', byUserId: 'u3', channel: 'whatsapp', note: 'Conversa de acolhimento.' });
    expect(contact.ok && contact.value.late).toBe(false);
    expect(app.db.zaritAlerts.get(alertId)?.status).toBe('contacted');
    const steps = app.db.occurrences.get(occurrenceId)?.steps ?? [];
    expect(steps.filter((s) => s.doneAt).map((s) => s.n)).toEqual([1, 2]);
    expect(steps[1]?.byUserId).toBe('u3');
    // Risco alto exige o encaminhamento.
    expect(svc.registerRisk(alertId, { level: '', note: '' }).ok).toBe(false);
    expect(svc.registerRisk(alertId, { level: 'high', note: 'Risco alto, sem rede de apoio no momento.' }).ok).toBe(true);
    const missing = svc.closeAlert(alertId);
    expect(missing.ok === false && missing.errors[0]?.message).toBe('Falta: encaminhamento.');
    expect(svc.registerReferral(alertId, { category: 'severe_distress_or_suicide_risk', destinations: [] }).ok).toBe(false);
    expect(svc.registerReferral(alertId, { category: 'severe_distress_or_suicide_risk', destinations: ['Rede de urgência em saúde mental', 'CVV (188)'] }).ok).toBe(true);
    expect(app.db.referrals.list().at(-1)?.occurrenceId).toBe(occurrenceId);
    expect(app.db.occurrences.get(occurrenceId)?.steps.filter((s) => s.doneAt).map((s) => s.n)).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    const closed = svc.closeAlert(alertId, 'Caso acompanhado.');
    expect(closed.ok).toBe(true);
    expect(app.db.zaritAlerts.get(alertId)?.status).toBe('closed');
    expect(app.db.occurrences.get(occurrenceId)?.steps.find((s) => s.n === 6)?.doneAt).toBeTruthy();
    // Depois de encerrado, só adendo: nenhuma ação de alerta funciona de novo.
    expect(svc.closeAlert(alertId).ok).toBe(false);
  });

  it('pela tela: registrar contato e avaliação de risco no alerta vermelho do dia (F06, 1 minuto)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/alertas/zal_0001' });
    expect(q(app, '[data-role="countdown"]')?.getAttribute('data-state')).toBe('on_time');
    expect(text(app)).toContain('Prazo hoje, 23:59');
    // Encerrar fica desabilitado e a lista do que falta aparece ao lado.
    expect(q(app, '[data-role="close-alert"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(q(app, '[data-role="missing"]')?.textContent).toContain('horário do contato');
    const by = q(app, '[data-role="contact-by"]') as HTMLSelectElement;
    expect(by.value).toBe('u3');
    const channel = q(app, '[data-role="contact-channel"]') as HTMLSelectElement;
    channel.value = 'phone';
    channel.dispatchEvent(new Event('change', { bubbles: true }));
    click(q(app, '[data-role="register-contact"]'));
    await settle(app.fixture);
    expect(app.db.zaritAlerts.get('zal_0001')?.contact?.channel).toBe('phone');
    expect(app.db.zaritAlerts.get('zal_0001')?.status).toBe('contacted');
    expect(q(app, '[data-role="contact-summary"]')).toBeTruthy();
    // Risco: nível e nota são obrigatórios.
    click(q(app, '[data-role="register-risk"]'));
    await settle(app.fixture);
    expect(app.db.zaritAlerts.get('zal_0001')?.riskAssessment).toBeUndefined();
    expect(text(app)).toContain('Escolha o nível');
    // O contato foi ligado à ocorrência que já existia (O-2) sem redigitar.
    expect(app.db.occurrences.get('occ_0002')?.steps.find((s) => s.n === 2)?.byUserId).toBe('u3');
  });

  it('a gestão e o atendimento não abrem o acompanhamento individual; o psicólogo não abre caso alheio (AC-M06-10, AC-M06-15)', async () => {
    const support = await bootApp({ userId: 'u7', url: '/app/acompanhamento' });
    expect(support.router.url).toBe('/403');
    for (const url of ['/app/acompanhamento/fila', '/app/acompanhamento/alertas/zal_0001', '/app/acompanhamento/arbe', '/app/acompanhamento/agregado']) {
      await support.router.navigateByUrl(url);
      await settle(support.fixture);
      expect(support.router.url, url).toBe('/403');
    }
    TestBed.resetTestingModule();
    const partner = await bootApp({ userId: 'u1', url: '/app/acompanhamento/fila' });
    expect(partner.router.url).toBe('/403');
    await partner.router.navigateByUrl('/app/acompanhamento/alertas/zal_0001');
    await settle(partner.fixture);
    expect(partner.router.url).toBe('/403');
    TestBed.resetTestingModule();
    const rafael = await bootApp({ userId: 'u3', url: '/app/acompanhamento/fila' });
    const before = rafael.db.accessLog.size();
    for (const url of ['/app/acompanhamento/cuidador/cg_0002', '/app/acompanhamento/alertas/zal_0002', '/app/acompanhamento/zarit/cg_0002/nova']) {
      await rafael.router.navigateByUrl(url);
      await settle(rafael.fixture);
      expect(rafael.router.url, url).toBe('/403');
    }
    expect(rafael.db.accessLog.list().slice(before).filter((e) => e.action === 'denied').length).toBe(3);
    // Nada do caso alheio aparece na fila do Rafael.
    await rafael.router.navigateByUrl('/app/acompanhamento/fila');
    await settle(rafael.fixture);
    expect(text(rafael)).not.toContain('Maria Aparecida Lemos');
    expect(text(rafael)).toContain('Ana Paula Ferraz');
  });
});

describe('M06 histórico e evolução (SCR-M06-04, AC-M06-08)', () => {
  it('João: -21,2%; Terezinha: -55,0%; Cláudia (adesão 0): n/d', async () => {
    const app = await bootApp({ userId: 'u2', url: '/app/acompanhamento/fila' });
    const svc = TestBed.inject(ZaritService);
    expect(svc.evolutionOf('cg_0003')?.display).toBe('-21,2%');
    expect(svc.evolutionOf('cg_0012')?.display).toBe('-55,0%');
    expect(svc.evolutionOf('cg_0013')?.display).toBe('n/d');
    expect(app.db.zaritAssessments.count((z) => z.caregiverId === 'cg_0003' && z.status === 'completed')).toBeGreaterThanOrEqual(2);
  });

  it('o psicólogo do caso vê o histórico com a evolução na tela e a próxima aplicação', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/cuidador/cg_0003' });
    const evolution = q(app, '[data-role="evolution"]')?.textContent ?? '';
    expect(evolution).toContain('-21,2%');
    expect(q(app, '[data-role="next-due"]')?.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(text(app)).toContain('Assinada, não pode ser editada');
    expect(text(app)).not.toMatch(FORBIDDEN_WORDS);
    // Adendo: a aplicação original nunca é editada.
    const first = app.root.querySelector('[data-assessment]');
    expect(first).toBeTruthy();
    click(app.root.querySelector('[data-role="addendum-open"]'));
    await settle(app.fixture);
    const area = q(app, '[data-role="addendum-text"]') as HTMLTextAreaElement;
    area.value = 'Complemento sobre o contexto da aplicação.';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    click(q(app, '[data-role="addendum-save"]'));
    await settle(app.fixture);
    const withAddendum = app.db.zaritAssessments.list().find((z) => z.addenda.length > 0);
    expect(withAddendum?.addenda[0]?.content).toBe('Complemento sobre o contexto da aplicação.');
    expect(withAddendum?.total).toBeDefined();
  });

  it('cuidador sem consentimento: a aba mostra o estado e não revela o histórico (Sônia, C16)', async () => {
    const app = await bootApp({ userId: 'u4', url: '/app/acompanhamento/cuidador/cg_0016' });
    expect(q(app, '[data-role="no-consent"]')).toBeTruthy();
    expect(text(app)).toContain('Sem consentimento de dados de saúde');
    expect(app.root.querySelector('[data-assessment]')).toBeNull();
  });
});

describe('M06 ARBE (SCR-M06-07, AC-M06-12, AC-M06-13)', () => {
  it('a ARBE gera crítico para Ana e atenção para Adriana, sem alertas a mais no recálculo', async () => {
    const app = await bootApp({ userId: 'u2', url: '/app/acompanhamento/arbe' });
    const ana = app.db.arbeAlerts.list().find((a) => a.caregiverId === 'cg_0001');
    const adriana = app.db.arbeAlerts.list().find((a) => a.caregiverId === 'cg_0029');
    expect(ana?.level).toBe('critical');
    expect(ana?.criteria.hoursPerDay.value).toBe(11);
    expect(ana?.criteria.supportRequests.value).toBe(4);
    expect(adriana?.level).toBe('attention');
    expect([adriana?.criteria.hoursPerDay.value, adriana?.criteria.supportRequests.value, adriana?.criteria.zarit.value]).toEqual([9, 3, 35]);
    expect(app.db.arbeAlerts.size()).toBe(TestBed.inject(ArbeService).recomputeAll() + app.db.arbeAlerts.size());
    expect(text(app)).toContain('Ana Paula Ferraz');
    expect(text(app)).toContain('Crítico');
    expect(text(app)).toContain('Limites em vigor');
    expect(q(app, '[data-role="edit-limits"]')).toBeTruthy();
  });

  it('mudar os limites recalcula: o de atenção sai e o crítico nasce; confirmar, contatar, encerrar e descartar com motivo', async () => {
    const app = await bootApp({ userId: 'u5', url: '/app/acompanhamento/arbe' });
    // Letícia (u5) não acompanha Adriana: o RT é quem vê e age.
    expect(text(app)).not.toContain('Adriana Fonseca');
    TestBed.resetTestingModule();
    const rt = await bootApp({ userId: 'u2', url: '/app/acompanhamento/arbe' });
    expect(text(rt)).toContain('Adriana Fonseca');
    const arbe = TestBed.inject(ArbeService);
    const settings = rt.db.settings.get().arbe;
    rt.db.settings.patch({ arbe: { ...settings, zaritThreshold: 30 } });
    await settle(rt.fixture);
    const alerts = rt.db.arbeAlerts.query((a) => a.caregiverId === 'cg_0029');
    expect(alerts.find((a) => a.level === 'attention')?.status).toBe('discarded');
    expect(alerts.find((a) => a.level === 'attention')?.discardReason).toContain('Limites da ARBE alterados');
    expect(alerts.find((a) => a.level === 'critical')?.status).toBe('generated');
    // Voltar ao limite antigo desfaz o crítico e devolve o de atenção.
    rt.db.settings.patch({ arbe: settings });
    arbe.recomputeAll();
    const again = rt.db.arbeAlerts.query((a) => a.caregiverId === 'cg_0029');
    expect(again.find((a) => a.level === 'critical')?.status).toBe('discarded');
    expect(again.some((a) => a.level === 'attention' && a.status === 'generated')).toBe(true);
    // Transições.
    const alert = rt.db.arbeAlerts.query((a) => a.caregiverId === 'cg_0029' && a.status === 'generated')[0];
    expect(arbe.discard(alert?.id ?? '', '').ok).toBe(false);
    expect(arbe.confirm(alert?.id ?? '').ok).toBe(true);
    expect(arbe.close(alert?.id ?? '', 'Encerrado').ok).toBe(false);
    expect(arbe.registerContact(alert?.id ?? '').ok).toBe(true);
    expect(arbe.close(alert?.id ?? '', 'Conversa feita e rotina reorganizada.').ok).toBe(true);
    expect(rt.db.arbeAlerts.get(alert?.id ?? '')?.status).toBe('closed');
  });
});

describe('M06 pedidos de revisão (SCR-M06-09, AC-M06-14)', () => {
  it('o pedido de Maria aparece para a psicóloga do caso, com prazo, e a resposta fica registrada', async () => {
    const app = await bootApp({ userId: 'u4', url: '/app/acompanhamento/revisoes' });
    const card = app.root.querySelector('[data-review]');
    expect(card?.textContent).toContain('Maria Aparecida Lemos');
    expect(card?.textContent).toMatch(/Faltam|No prazo|prazo/i);
    const input = q(app, '[data-role="answer-input"]') as HTMLTextAreaElement;
    input.value = 'Revisei a decisão com o responsável técnico e vamos conversar na próxima sessão.';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    click(q(app, '[data-role="answer-submit"]'));
    await settle(app.fixture);
    const request = app.db.reviewRequests.list()[0];
    expect(request?.answer).toContain('Revisei a decisão');
    expect(request?.answeredAt).toBeTruthy();
    TestBed.resetTestingModule();
    const other = await bootApp({ userId: 'u5', url: '/app/acompanhamento/revisoes' });
    expect(text(other)).not.toContain('Maria Aparecida Lemos');
    expect(text(other)).toContain('Nenhum pedido de revisão aqui');
  });

  it('o pedido registrado em nome do cuidador ganha o prazo das solicitações do titular', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/revisoes' });
    const svc = TestBed.inject(ZaritService);
    const ok = svc.registerReviewRequest('cg_0003', 'zarit_decision', 'Peço para rever a decisão sobre o meu acompanhamento.');
    expect(ok.ok && ok.value.dueAt).toBe('2026-11-19');
    expect(svc.registerReviewRequest('cg_0002', 'zarit_decision', 'Pedido de outro caso.').ok).toBe(false);
    expect(app.db.reviewRequests.size()).toBe(2);
  });
});

describe('M06 painel agregado (SCR-M06-10, AC-M06-11, AC-M06-17)', () => {
  it('a sócia cai no painel agregado, sem nome e com "menos de 5" onde o recorte é pequeno', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/acompanhamento' });
    expect(app.router.url).toBe('/app/acompanhamento/agregado');
    const content = text(app);
    expect(content).toContain('Sobrecarga agregada');
    expect(content).toContain('menos de 5');
    expect(content).not.toContain('Ana Paula Ferraz');
    expect(content).not.toMatch(/CUI-\d{4}/);
    // Alertas vermelhos abertos são 2 no seed: suprimidos.
    expect(q(app, '[data-role="kpi-red"]')?.textContent).toContain('menos de 5');
    // Contato no mesmo dia: 3 casos, abaixo do mínimo para a sócia.
    expect(q(app, '[data-role="kpi-same-day"]')?.textContent).toContain('menos de 5');
    // Ela só lê os limites da ARBE.
    expect(q(app, '[data-role="limits"]')?.textContent).toContain('Só o responsável técnico edita os limites');
    expect(content).not.toMatch(FORBIDDEN_WORDS);
  });

  it('com algum recorte suprimido, o total do painel fica oculto (A-30)', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/acompanhamento/agregado' });
    const people = q(app, '[data-role="kpi-people"]')?.textContent ?? '';
    const suppressed = Array.from(app.root.querySelectorAll('[data-role="distribution"] .chart__table, [data-role="distribution"] table')).some((t) => /menos de 5/i.test(t.textContent ?? ''));
    if (suppressed) {
      expect(people).toContain('menos de 5');
    }
    expect(q(app, '[data-role="privacy-note"]')?.textContent).toContain('menos de 5');
  });

  it('o RT vê o contato no mesmo dia: 66,7% (2 de 3 vermelhos com prazo vencido)', async () => {
    const app = await bootApp({ userId: 'u2', url: '/app/acompanhamento/agregado' });
    const kpi = q(app, '[data-role="kpi-same-day"]')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(kpi).toContain('66,7%');
    expect(kpi).toContain('2 de 3');
  });

  it('o psicólogo vê o agregado só dos seus casos', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/acompanhamento/agregado' });
    expect(text(app)).toContain('Painel agregado');
    expect(q(app, '[data-role="kpi-same-day"]')).toBeNull();
  });
});

describe('M06 acessibilidade e texto', () => {
  it('toda tela tem um h1, a tabela da fila tem legenda e nenhuma usa palavra proibida', async () => {
    const urls = ['/app/acompanhamento/fila', '/app/acompanhamento/arbe', '/app/acompanhamento/revisoes', '/app/acompanhamento/agregado', '/app/acompanhamento/cuidador/cg_0001', '/app/acompanhamento/alertas/zal_0001'];
    for (const url of urls) {
      TestBed.resetTestingModule();
      const app = await bootApp({ userId: 'u3', url });
      expect(app.root.querySelectorAll('h1').length, url).toBe(1);
      expect(text(app), url).not.toMatch(FORBIDDEN_WORDS);
    }
    TestBed.resetTestingModule();
    const queue = await bootApp({ userId: 'u3', url: '/app/acompanhamento/fila' });
    expect(queue.root.querySelector('app-data-table caption')?.textContent).toContain('Fila de acompanhamento');
  });
});
