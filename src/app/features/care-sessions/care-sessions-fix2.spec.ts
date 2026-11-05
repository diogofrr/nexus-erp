import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { sessionStatusView } from './state/care-labels';
import { CareSessionsService } from './state/care-sessions.service';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};
const typeInto = (el: Element | null, value: string): void => {
  if (!el) {
    throw new Error('campo não encontrado');
  }
  (el as HTMLInputElement).value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const q = <T extends Element = HTMLElement>(app: BootedApp, selector: string): T | null => app.root.querySelector<T>(selector);
const all = <T extends Element = HTMLElement>(app: BootedApp, selector: string): T[] => Array.from(app.root.querySelectorAll<T>(selector));
const svc = (): CareSessionsService => TestBed.inject(CareSessionsService);
const clean = (el: Element | null): string => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

async function confirmDialog(app: BootedApp): Promise<void> {
  const dialog = app.root.querySelector('app-dialog-host dialog') as HTMLDialogElement;
  click(dialog.querySelector('[data-role="confirm"]'));
  await settle(app.fixture);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await settle(app.fixture);
}

describe('Redistribuir a agenda (CX-010, CX-011)', () => {
  it('a gestão não vê nem move caso com acompanhamento ativo; a RT vê e o marca', async () => {
    TestBed.resetTestingModule();
    await bootApp({ userId: 'u1', url: '/app/atendimento/ocupacao' });
    const partner = svc().transferableCases('psy_0001');
    expect(partner.length).toBeGreaterThan(5);
    expect(partner.some((c) => c.id === 'cg_0001')).toBe(false);
    expect(partner.every((c) => !c.activeRisk)).toBe(true);
    TestBed.resetTestingModule();
    await bootApp({ userId: 'u2', url: '/app/atendimento/ocupacao' });
    const rt = svc().transferableCases('psy_0001');
    expect(rt.find((c) => c.id === 'cg_0001')?.activeRisk).toBe(true);
    expect(rt.length).toBeGreaterThan(partner.length);
  });

  it('transfere só os casos escolhidos, com as sessões deles, e a gestão precisa informar o aval da RT', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u1', url: '/app/atendimento/ocupacao' });
    const cases = svc().transferableCases('psy_0001');
    const chosen = cases.slice(0, 3).map((c) => c.id);
    const input = [{ toId: 'psy_0004', caregiverIds: chosen }];
    const noApproval = svc().redistributeCases('psy_0001', input, 'Agenda acima de 80% por dois meses.');
    expect(noApproval.ok).toBe(false);
    expect(noApproval.ok === false && noApproval.errors[0]?.field).toBe('approval');
    const before = app.db.caregivers.count((c) => c.assignedPsychologistId === 'psy_0001');
    const result = svc().redistributeCases('psy_0001', input, 'Agenda acima de 80% por dois meses.', { rtApproved: true });
    expect(result.ok).toBe(true);
    expect(app.db.caregivers.count((c) => c.assignedPsychologistId === 'psy_0001')).toBe(before - 3);
    chosen.forEach((id) => expect(app.db.caregivers.get(id)?.assignedPsychologistId).toBe('psy_0004'));
    // As sessões futuras só dos casos escolhidos mudam de psicólogo.
    app.db.careSessions
      .list()
      .filter((s) => chosen.includes(s.caregiverId) && (s.status === 'scheduled' || s.status === 'confirmed') && s.startAt > '2026-11-04T12:00:00-03:00')
      .forEach((s) => expect(s.psychologistId).toBe('psy_0004'));
    const entry = app.db.accessLog.list().filter((e) => e.entity === 'psychologist_redistribution').at(-1);
    expect(entry?.detail).toContain('aval da responsável técnica informado pela gestão');
    // A gestão não move caso em acompanhamento ativo, nem para quem está no limite.
    expect(svc().redistributeCases('psy_0001', [{ toId: 'psy_0004', caregiverIds: ['cg_0001'] }], 'Motivo qualquer', { rtApproved: true }).ok).toBe(false);
    const atLimit = svc().redistributeCases('psy_0001', [{ toId: 'psy_0003', caregiverIds: [cases[5]?.id ?? ''] }], 'Motivo qualquer', { rtApproved: true });
    expect(atLimit.ok).toBe(false);
    expect(atLimit.ok === false && atLimit.errors[0]?.message).toContain('não recebe mais casos');
  });

  it('pela tela: a RT escolhe os casos, divide entre dois psicólogos, vê a ocupação depois e confirma com o efeito', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u2', url: '/app/atendimento/ocupacao' });
    await settle(app.fixture);
    click(app.root.querySelector('[data-psychologist="psy_0001"] [data-role="redistribute"]'));
    await settle(app.fixture);
    const drawer = q(app, 'app-redistribute-drawer') as HTMLElement;
    // CX-011: a Dra. Letícia, exatamente em 80%, "está no limite", não "acima".
    const blocked = clean(drawer.querySelector('[data-role="receiver-blocked"]'));
    expect(blocked).toContain('Dra. Letícia Amaral');
    expect(blocked).toContain('no limite de 80%, não recebe mais casos');
    expect(blocked).not.toContain('acima do limite de 80%');
    // Quem pode receber tem um campo de quantidade: Beatriz (70%) e Tiago (50%).
    expect(drawer.querySelectorAll('[data-role="receiver-qty"]')).toHaveLength(2);
    // Escolhe 4 casos pelo código (a RT também vê os de acompanhamento ativo, marcados).
    const boxes = Array.from(drawer.querySelectorAll<HTMLInputElement>('[data-role="case-list"] input[type="checkbox"]'));
    expect(boxes.length).toBeGreaterThan(10);
    expect(drawer.querySelector('[data-role="case-list"]')?.textContent).toContain('Acompanhamento ativo');
    click(drawer.querySelector('[data-role="clear-selection"]'));
    boxes.slice(0, 4).forEach((box) => click(box));
    await settle(app.fixture);
    expect(clean(drawer.querySelector('[data-role="selected-count"]'))).toBe('4 casos escolhidos');
    const [beatriz, tiago] = Array.from(drawer.querySelectorAll<HTMLInputElement>('[data-role="receiver-qty"]'));
    typeInto(beatriz ?? null, '1');
    typeInto(tiago ?? null, '3');
    await settle(app.fixture);
    const rows = Array.from(drawer.querySelectorAll('[data-role="projection"] tbody tr'));
    expect(rows).toHaveLength(3);
    expect(clean(drawer.querySelector('[data-psychologist="psy_0001"]'))).toContain('91,3%');
    expect(clean(drawer.querySelector('[data-psychologist="psy_0004"]'))).toContain('50,0%');
    expect(clean(drawer.querySelector('[data-role="projection-note"]'))).toContain('Estimativa');
    // Quem escolhe dar todos os casos a quem está a 70% vê o aviso de que passaria de 80%.
    click(drawer.querySelector('[data-role="clear-selection"]'));
    await settle(app.fixture);
    click(boxes[0] ?? null);
    typeInto(beatriz ?? null, '0');
    typeInto(tiago ?? null, '1');
    await settle(app.fixture);
    expect(drawer.querySelector('[data-role="exceeds-warning"]')).toBeNull();
    click(drawer.querySelector('[data-role="select-all"]'));
    await settle(app.fixture);
    const everyone = drawer.querySelectorAll('[data-role="case-list"] input[type="checkbox"]:checked').length;
    typeInto(beatriz ?? null, String(everyone));
    typeInto(tiago ?? null, '0');
    await settle(app.fixture);
    expect(drawer.querySelector('[data-role="exceeds-warning"]')).toBeTruthy();
    expect(clean(drawer.querySelector('[data-psychologist="psy_0002"]'))).toContain('passaria de 80%');
    // Volta aos 4 casos escolhidos antes.
    click(drawer.querySelector('[data-role="clear-selection"]'));
    await settle(app.fixture);
    boxes.slice(0, 4).forEach((box) => click(box));
    typeInto(beatriz ?? null, '1');
    typeInto(tiago ?? null, '3');
    typeInto(drawer.querySelector('[data-role="reason"]'), 'Agenda acima de 80% por dois meses seguidos.');
    await settle(app.fixture);
    click(drawer.querySelector('[data-role="redistribute-submit"]'));
    await settle(app.fixture);
    const dialog = app.root.querySelector('app-dialog-host dialog') as HTMLDialogElement;
    const dialogText = clean(dialog);
    expect(dialogText).toContain('Transferir 4 casos de Dr. Rafael Moreira?');
    expect(dialogText).toContain('1 caso para Dra. Beatriz Nogueira e 3 casos para Dr. Tiago Brandão');
    expect(dialogText).toContain('A ocupação de Dr. Rafael Moreira iria de 91,3% para cerca de');
    const before = app.db.caregivers.count((c) => c.assignedPsychologistId === 'psy_0001');
    await confirmDialog(app);
    expect(app.db.caregivers.count((c) => c.assignedPsychologistId === 'psy_0001')).toBe(before - 4);
    expect(app.db.caregivers.count((c) => c.assignedPsychologistId === 'psy_0004')).toBeGreaterThan(0);
  });

  it('pela tela: a gestão vê a caixa do aval da RT e só os casos sem acompanhamento ativo', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u1', url: '/app/atendimento/ocupacao' });
    await settle(app.fixture);
    click(app.root.querySelector('[data-psychologist="psy_0001"] [data-role="redistribute"]'));
    await settle(app.fixture);
    const drawer = q(app, 'app-redistribute-drawer') as HTMLElement;
    expect(drawer.querySelector('[data-role="rt-approval"]')).toBeTruthy();
    expect(drawer.querySelector('[data-role="active-follow-up-note"]')).toBeTruthy();
    expect(drawer.querySelector('[data-role="case-list"]')?.textContent).not.toContain('Acompanhamento ativo');
    expect(drawer.querySelector('[data-role="case-list"]')?.textContent).not.toContain('CUI-0001');
    // Nenhum nome de cuidador: só o código.
    const names = app.db.caregivers.list().slice(0, 29).map((c) => c.fullName);
    names.forEach((name) => expect(drawer.textContent).not.toContain(name));
  });
});

describe('Remarcar sessão (CX-026, CX-027) e vagas do formulário (CX-030)', () => {
  function futureSession(app: BootedApp, psychologistId: string) {
    return app.db.careSessions
      .list()
      .find((s) => s.psychologistId === psychologistId && (s.status === 'scheduled' || s.status === 'confirmed') && s.startAt > '2026-11-06T12:00:00-03:00');
  }

  it('o detalhe da sessão tem "Remarcar sessão" ao lado de "Cancelar sessão", e o cancelar não esconde mais o reagendar', async () => {
    TestBed.resetTestingModule();
    const probe = await bootApp({ userId: 'u3', url: '/app/atendimento/agenda' });
    const session = futureSession(probe, 'psy_0001');
    expect(session).toBeDefined();
    await probe.router.navigateByUrl(`/app/atendimento/sessoes/${session?.id}`);
    await settle(probe.fixture);
    const reschedule = q(probe, '[data-role="reschedule"]');
    expect(reschedule?.textContent).toContain('Remarcar sessão');
    expect(q(probe, '[data-role="cancel"]')?.textContent).toContain('Cancelar sessão');
    click(q(probe, '[data-role="cancel"]'));
    await settle(probe.fixture);
    const cancelForm = clean(q(probe, '[data-role="cancel-form"]'));
    expect(cancelForm).toContain('use "Remarcar sessão"');
    expect(q(probe, '[data-role="cancel-form"] [data-role="reschedule"]')).toBeNull();
  });

  it('o psicólogo remarca: a antiga fica "Remarcada pelo psicólogo", com modalidade e tipo já preenchidos', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u3', url: '/app/atendimento/agenda' });
    const session = futureSession(app, 'psy_0001');
    expect(session).toBeDefined();
    await app.router.navigateByUrl(`/app/atendimento/sessoes/${session?.id}`);
    await settle(app.fixture);
    click(q(app, '[data-role="reschedule"]'));
    await settle(app.fixture);
    const drawer = q(app, 'app-session-detail-page app-schedule-drawer') ?? q(app, 'app-schedule-drawer');
    expect(clean(drawer?.querySelector('h2') ?? null)).toBe('Remarcar sessão');
    // Modalidade e tipo vêm da sessão atual (sem perguntar de novo).
    const modality = drawer?.querySelector<HTMLInputElement>('#sched-modality input[type="radio"]:checked');
    const kind = drawer?.querySelector<HTMLInputElement>('#sched-kind input[type="radio"]:checked');
    expect(modality).toBeTruthy();
    expect(kind).toBeTruthy();
    expect(clean(drawer?.querySelector('[data-role="reschedule-effect"]') ?? null)).toContain('só é liberada depois');
    // Pelo serviço: o psicólogo que precisa remarcar nunca gera falta nem "Cancelada pelo cuidador".
    const slot = svc().freeSlots('psy_0001', svc().canSeePriority(session?.caregiverId ?? '')).find((s) => s.id !== session?.slotId);
    const result = svc().reschedule(
      session?.id ?? '',
      {
        caregiverId: session?.caregiverId ?? '',
        psychologistId: 'psy_0001',
        slotId: slot?.id ?? '',
        modality: session?.modality ?? null,
        roomId: session?.roomId ?? null,
        homeAddress: session?.homeAddress ?? '',
        homeSafe: true,
        kind: session?.kind ?? null,
      },
      'psychologist',
    );
    expect(result.ok ? 'ok' : JSON.stringify(result.errors)).toBe('ok');
    const old = app.db.careSessions.get(session?.id ?? '');
    expect(old?.status).toBe('cancelled_by_psychologist');
    expect(old?.rescheduledToId).toBe(result.ok ? result.value.id : '');
    expect(old?.rescheduleRequestedBy).toBe('psychologist');
    expect(sessionStatusView(old ?? { status: 'scheduled' }).label).toBe('Remarcada pelo psicólogo');
    expect(app.db.availabilitySlots.get(session?.slotId ?? '')?.status).toBe('open');
  });

  it('o atendimento remarca a pedido do cuidador; a menos de 24 horas vale a regra do cancelamento (falta)', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda', today: '2026-11-04', time: '12:00' });
    const soon = app.db.careSessions.list().find((s) => s.psychologistId === 'psy_0001' && (s.status === 'scheduled' || s.status === 'confirmed') && s.startAt > '2026-11-04T12:00:00-03:00' && s.startAt < '2026-11-05T12:00:00-03:00');
    const later = futureSession(app, 'psy_0001');
    expect(later).toBeDefined();
    // Vagas comuns: servem a qualquer cuidador (as prioritárias dependem do plano).
    const nextSlot = (): string => svc().freeSlots('psy_0001', false)[0]?.id ?? '';
    const input = (session: NonNullable<typeof later>, slotId: string) => ({
      caregiverId: session.caregiverId,
      psychologistId: session.psychologistId,
      slotId,
      modality: session.modality,
      roomId: session.roomId ?? null,
      homeAddress: session.homeAddress ?? '',
      homeSafe: true,
      kind: session.kind,
    });
    // O psicólogo "Eu preciso remarcar" não existe para o atendimento.
    expect(svc().reschedule(later?.id ?? '', input(later as NonNullable<typeof later>, nextSlot()), 'psychologist').ok).toBe(false);
    if (soon) {
      expect(svc().rescheduleEffect(soon, 'user')).toContain('registra falta');
      expect(svc().rescheduleEffect(soon, 'psychologist')).toContain('fica como remarcada');
      const done = svc().reschedule(soon.id, input(soon, nextSlot()), 'user');
      expect(done.ok).toBe(true);
      expect(app.db.careSessions.get(soon.id)?.status).toBe('no_show');
      expect(sessionStatusView(app.db.careSessions.get(soon.id) ?? { status: 'no_show' }).label).toContain('Falta');
    }
    const ok = svc().reschedule(later?.id ?? '', input(later as NonNullable<typeof later>, nextSlot()), 'user');
    expect(ok.ok ? 'ok' : JSON.stringify(ok.errors)).toBe('ok');
    const updated = app.db.careSessions.get(later?.id ?? '');
    expect(updated?.status).toBe('cancelled_by_user');
    expect(sessionStatusView(updated ?? { status: 'scheduled' }).label).toBe('Remarcada a pedido do cuidador');
  });

  it('CX-030: o formulário de agendar não lista vagas antes de escolher o cuidador e diz o que mostra', async () => {
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u3', url: '/app/atendimento/agenda' });
    click(q(app, '[data-role="open-schedule"]'));
    await settle(app.fixture);
    const drawer = q(app, 'app-schedule-drawer dialog') as HTMLElement;
    expect(clean(drawer.querySelector('[data-role="slots-wait"]'))).toBe('Escolha o cuidador para ver as vagas disponíveis para ele.');
    expect(drawer.querySelectorAll('#sched-slot input[type="radio"]')).toHaveLength(0);
    const select = drawer.querySelector<HTMLSelectElement>('[data-role="caregiver-select"]') as HTMLSelectElement;
    const firstCaregiver = Array.from(select.options).find((o) => o.value !== '');
    select.value = firstCaregiver?.value ?? '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(app.fixture);
    expect(drawer.querySelector('[data-role="slots-wait"]')).toBeNull();
    expect(drawer.querySelectorAll('#sched-slot input[type="radio"]').length).toBeGreaterThan(0);
    expect(all(app, 'app-schedule-drawer dialog').length).toBeGreaterThan(0);
  });
});
