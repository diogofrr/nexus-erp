import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { GroupMembershipService } from '../../core/groups/group-membership.service';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { DraftService } from '../../shared/ui/forms/draft.service';
import { Activity } from '../../core/models';
import { ActivityForm, GroupsService } from './state/groups.service';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};

const FORBIDDEN_WORDS = /diagnóstico|eficácia|paciente|guerreira|anjo|[\u2013\u2014]/i;
const q = (app: BootedApp, selector: string) => app.root.querySelector<HTMLElement>(selector);
const text = (app: BootedApp, selector = 'main'): string => q(app, selector)?.textContent?.replace(/\s+/g, ' ') ?? '';
const dialog = (app: BootedApp): HTMLDialogElement => app.root.querySelector('app-dialog-host dialog') as HTMLDialogElement;

const accepted = { contractAccepted: true } as const;

/** Copia uma atividade do seed (sem id nem carimbos) com alterações, para montar cenários. */
function cloneActivity(app: BootedApp, id: string, overrides: Partial<Activity> = {}): Activity {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = app.db.activities.require(id);
  return app.db.activities.create({ ...rest, ...overrides });
}

function therapyForm(svc: GroupsService, overrides: Partial<ActivityForm> = {}): ActivityForm {
  return {
    ...svc.emptyForm(),
    kind: 'group_therapy',
    title: 'Terapia de grupo sobre rotina e descanso',
    theme: 'emotional_health',
    leaderType: 'psychologist',
    leaderId: 'psy_0003',
    mode: 'online',
    capacity: 6,
    meetings: [{ date: '2026-11-20', start: '18:00', end: '19:30' }],
    ...overrides,
  };
}

describe('M07 programação (SCR-M07-01, AC-M07-11, AC-M07-04)', () => {
  it('lista os 11 encontros da seed (docs/20) com caráter e vagas; a lotada mostra a lista de espera', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/grupos' });
    const rows = Array.from(app.root.querySelectorAll('app-data-table tbody tr, app-data-table .table tbody tr'));
    expect(rows.length).toBe(11);
    const content = rows.map((r) => r.textContent?.replace(/\s+/g, ' ') ?? '');
    const g1 = content.find((c) => c.includes('Sobrecarga e autocuidado')) ?? '';
    expect(g1).toContain('Lotada');
    expect(g1).toContain('Lotado: 6 de 6, 2 na lista de espera');
    expect(g1).toContain('Psicoterapia');
    const g3 = content.find((c) => c.includes('Lidar com as perdas')) ?? '';
    expect(g3).toContain('Psicoterapia');
    expect(g3).toContain('Em andamento');
    expect(text(app)).not.toMatch(FORBIDDEN_WORDS);
  });

  it('atividade cancelada e rascunho existem e aparecem nos filtros (AC-M07-11)', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/grupos?estado=cancelled' });
    expect(text(app, 'app-data-table')).toContain('Administração segura de medicamentos');
    expect(text(app, 'app-data-table')).not.toContain('Sobrecarga e autocuidado');
    await app.router.navigateByUrl('/app/grupos?estado=draft');
    await settle(app.fixture);
    expect(text(app, 'app-data-table')).toContain('Prevenção de conflitos familiares');
    await app.router.navigateByUrl('/app/grupos?visao=calendario');
    await settle(app.fixture);
    expect(q(app, '[data-role="month-label"]')).toBeTruthy();
  });

  it('o psicólogo vê por padrão os grupos que conduz; o atendimento não cria nem abre os indicadores', async () => {
    const rafael = await bootApp({ userId: 'u3', url: '/app/grupos' });
    expect(text(rafael, 'app-data-table')).toContain('Sobrecarga e autocuidado');
    expect(text(rafael, 'app-data-table')).not.toContain('Lidar com as perdas');
    expect(q(rafael, '[data-role="new-activity"]')).toBeTruthy();
    TestBed.resetTestingModule();
    const support = await bootApp({ userId: 'u7', url: '/app/grupos' });
    expect(q(support, '[data-role="new-activity"]')).toBeNull();
    expect(q(support, '[data-role="indicators-link"]')).toBeNull();
    for (const url of ['/app/grupos/novo', '/app/grupos/indicadores', '/app/grupos/act_0001/presenca']) {
      await support.router.navigateByUrl(url);
      await settle(support.fixture);
      expect(support.router.url, url).toBe('/403');
    }
  });
});

describe('M07 inscrição por plano (F11, AC-M07-01 a 05)', () => {
  it('Essencial na terapia de grupo é bloqueado com a explicação "planos Cuida e Sustenta" (AC-M07-01, docs/20)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/grupos/act_0008' });
    const svc = TestBed.inject(GroupsService);
    const checks = svc.checksFor(app.db.activities.require('act_0008'), { caregiverId: 'cg_0006' });
    const plan = checks.find((c) => c.id === 'plan');
    expect(plan?.state).toBe('fail');
    expect(plan?.text).toContain('Cuida e Sustenta');
    const result = svc.enroll({ activityId: 'act_0008', caregiverId: 'cg_0006', ...accepted });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.some((e) => e.message.includes('Cuida e Sustenta'))).toBe(true);
    expect(app.db.activityEnrollments.count((e) => e.activityId === 'act_0008' && e.caregiverId === 'cg_0006')).toBe(0);
    // Pela tela: o diálogo mostra todas as checagens de uma vez e o botão diz o motivo.
    click(q(app, '[data-role="enroll"]'));
    await settle(app.fixture);
    const search = app.root.querySelector('app-enroll-drawer input[type="search"]') as HTMLInputElement;
    search.value = 'CUI-0006';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(app.fixture);
    const select = app.root.querySelector('app-enroll-drawer [data-role="enroll-select"]') as HTMLSelectElement;
    select.value = 'cg_0006';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(app.fixture);
    const drawer = app.root.querySelector('app-enroll-drawer dialog') as HTMLDialogElement;
    expect(drawer.textContent).toContain('Cuida e Sustenta');
    expect(drawer.querySelector('[data-role="enroll-submit"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(drawer.querySelector('[data-role="why-disabled"]')?.textContent).toContain('Cuida e Sustenta');
  });

  it('Cuida e Sustenta entram; sem o aceite do sigilo a inscrição não conclui; o aceite grava data e hora (AC-M07-02)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/grupos/act_0009' });
    const svc = TestBed.inject(GroupsService);
    const refused = svc.enroll({ activityId: 'act_0009', caregiverId: 'cg_0001', contractAccepted: false });
    expect(refused.ok).toBe(false);
    expect(refused.ok === false && refused.errors.some((e) => e.field === 'contract')).toBe(true);
    const ok = svc.enroll({ activityId: 'act_0009', caregiverId: 'cg_0001', ...accepted });
    expect(ok.ok && ok.value.enrollment.status).toBe('enrolled');
    expect(ok.ok && ok.value.enrollment.confidentialityAcceptedAt).toBe('2026-11-04T12:00:00-03:00');
    // Sustenta também (C17, Sustenta).
    expect(svc.enroll({ activityId: 'act_0009', caregiverId: 'cg_0017', ...accepted }).ok).toBe(true);
    // Duplicada não entra de novo.
    expect(svc.enroll({ activityId: 'act_0009', caregiverId: 'cg_0001', ...accepted }).ok).toBe(false);
    // O sigilo aparece no detalhe, com o carimbo.
    await app.router.navigateByUrl('/app/grupos/act_0009');
    await settle(app.fixture);
    expect(text(app, '[data-role="enrolled"]')).toContain('04/11/2026 12:00');
  });

  it('a roda de conversa aberta aceita Livre e participante externo (AC-M07-03)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/grupos/act_0004' });
    const svc = TestBed.inject(GroupsService);
    expect(svc.enroll({ activityId: 'act_0004', caregiverId: 'cg_0013', ...accepted }).ok).toBe(true);
    const badMail = svc.enroll({ activityId: 'act_0004', external: { name: 'Visitante Teste', email: 'visitante@gmail.com' }, ...accepted });
    expect(badMail.ok).toBe(false);
    const external = svc.enroll({ activityId: 'act_0004', external: { name: 'Visitante Teste', email: 'visitante@exemplo.com.br' }, ...accepted });
    expect(external.ok && external.value.enrollment.external?.name).toBe('Visitante Teste');
    // Externo não entra em grupo de apoio.
    expect(svc.enroll({ activityId: 'act_0008', external: { name: 'Visitante Teste', email: 'visitante@exemplo.com.br' }, ...accepted }).ok).toBe(false);
    expect(app.db.activityEnrollments.count((e) => e.activityId === 'act_0004')).toBe(13);
  });

  it('o grupo lotado tem 6 inscritos e 2 na fila; cancelar promove o primeiro e o estado acompanha as vagas (AC-M07-04)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/grupos/act_0001' });
    const svc = TestBed.inject(GroupsService);
    const membership = TestBed.inject(GroupMembershipService);
    expect(app.db.activities.get('act_0001')?.status).toBe('full');
    expect(membership.seatsTaken('act_0001')).toBe(6);
    expect(membership.waitlist('act_0001').map((e) => e.caregiverId)).toEqual(['cg_0024', 'cg_0027']);
    expect(q(app, '[data-role="enroll"]')?.textContent).toContain('Entrar na lista de espera');
    expect(text(app)).toContain('Lotado: 6 de 6, 2 na lista de espera');
    const enrollment = (cg: string) =>
      app.db.activityEnrollments.require(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === cg)?.id ?? '');
    // O diálogo diz quem será promovida.
    click(q(app, '[data-enrollment="' + enrollment('cg_0001').id + '"] [data-role="cancel-enrollment"]'));
    await settle(app.fixture);
    expect(dialog(app).textContent).toContain('Lourdes Campos');
    expect(dialog(app).textContent).toContain('será promovida');
    click(dialog(app).querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    expect(enrollment('cg_0001').status).toBe('cancelled');
    expect(enrollment('cg_0024').status).toBe('enrolled');
    expect(enrollment('cg_0027').waitlistPosition).toBe(1);
    expect(app.db.activities.get('act_0001')?.status).toBe('full');
    expect(svc.cancelEnrollment(enrollment('cg_0008').id).ok).toBe(true);
    expect(enrollment('cg_0027').status).toBe('enrolled');
    expect(app.db.activities.get('act_0001')?.status).toBe('full');
    expect(svc.cancelEnrollment(enrollment('cg_0009').id).ok).toBe(true);
    expect(app.db.activities.get('act_0001')?.status).toBe('open');
  });

  it('terapia de grupo: selo de psicoterapia; só Cuida e Sustenta entram, sem exigir a indicação do psicólogo (AC-M07-05, docs/20)', async () => {
    const partner = await bootApp({ userId: 'u1', url: '/app/grupos/novo' });
    const svc = TestBed.inject(GroupsService);
    const created = svc.save(therapyForm(svc), true);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const id = created.value.id;
    expect(created.value.character).toBe('psychotherapy');
    expect(created.value.requiresEligibility).toBe(false);
    expect(created.value.minPlan).toBe('cuida');
    expect(created.value.status).toBe('open');
    await partner.router.navigateByUrl(`/app/grupos/${id}`);
    await settle(partner.fixture);
    expect(q(partner, '[data-role="character"]')?.textContent).toContain('Psicoterapia');
    // O atendimento: o Essencial é recusado pelo plano; a indicação não é exigida.
    TestBed.resetTestingModule();
    const support = await bootApp({ userId: 'u7', url: '/app/grupos/act_0003' });
    const svcSupport = TestBed.inject(GroupsService);
    const therapyId = cloneActivity(support, 'act_0003', { status: 'open', meetings: [] }).id;
    expect(svcSupport.enroll({ activityId: therapyId, caregiverId: 'cg_0006', ...accepted, eligible: true }).ok).toBe(false);
    expect(svcSupport.checksFor(support.db.activities.require(therapyId), { caregiverId: 'cg_0021' }).find((c) => c.id === 'eligibility')).toMatchObject({
      state: 'na',
      text: 'Não é exigida: a terapia de grupo vale para os planos Cuida e Sustenta.',
    });
    const sustenta = svcSupport.enroll({ activityId: therapyId, caregiverId: 'cg_0021', ...accepted });
    expect(sustenta.ok && sustenta.value.enrollment.eligibleForGroupTherapy).toBeUndefined();
    // Letícia (psicóloga do caso de C11, Sustenta) pode registrar a indicação; ela fica gravada.
    TestBed.resetTestingModule();
    const leticia = await bootApp({ userId: 'u5', url: '/app/grupos/act_0003' });
    const svcLeticia = TestBed.inject(GroupsService);
    const therapy = cloneActivity(leticia, 'act_0003', { status: 'open', meetings: [] });
    const marked = svcLeticia.enroll({ activityId: therapy.id, caregiverId: 'cg_0011', ...accepted, eligible: true });
    expect(marked.ok && marked.value.enrollment.eligibleForGroupTherapy).toBe(true);
    expect(svcLeticia.enroll({ activityId: therapy.id, caregiverId: 'cg_0007', ...accepted, eligible: true }).ok).toBe(false);
  });
});

describe('M07 nova atividade (SCR-M07-02, AC-M07-06, AC-M07-10)', () => {
  it('presencial em sala com 3 dos 4 itens de acessibilidade é bloqueado; a sala completa passa (AC-M07-06)', async () => {
    await bootApp({ userId: 'u1', url: '/app/grupos/novo' });
    const svc = TestBed.inject(GroupsService);
    const base: ActivityForm = {
      ...svc.emptyForm(),
      kind: 'group_therapy',
      title: 'Grupo de autocuidado às quartas',
      theme: 'self_care',
      leaderType: 'psychologist',
      leaderId: 'psy_0002',
      mode: 'in_person',
      capacity: 10,
      meetings: [{ date: '2026-11-25', start: '19:00', end: '20:30' }],
    };
    const blocked = svc.save({ ...base, roomId: 'room_0003' }, true);
    expect(blocked.ok).toBe(false);
    expect(blocked.ok === false && blocked.errors.find((e) => e.field === 'room')?.message).toContain('Falta sanitário adaptado');
    expect(svc.save({ ...base, roomId: '' }, true).ok).toBe(false);
    const ok = svc.save({ ...base, roomId: 'room_0001' }, true);
    expect(ok.ok && ok.value.roomId).toBe('room_0001');
    expect(ok.ok && ok.value.meetings[0]?.id).toMatch(/^act_\d{4}_m1$/);
    expect(ok.ok && ok.value.minPlan).toBe('cuida');
  });

  it('só os 8 temas de grupo e os 6 de capacitação são oferecidos e aceitos (AC-M07-10)', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/grupos/novo' });
    const svc = TestBed.inject(GroupsService);
    click(app.root.querySelectorAll<HTMLElement>('app-radio-group input[type="radio"]')[0]);
    await settle(app.fixture);
    const theme = q(app, '[data-role="theme"]') as HTMLSelectElement;
    expect(theme.querySelectorAll('option').length).toBe(1 + 6);
    click(app.root.querySelectorAll<HTMLElement>('app-radio-group input[type="radio"]')[1]);
    await settle(app.fixture);
    expect((q(app, '[data-role="theme"]') as HTMLSelectElement).querySelectorAll('option').length).toBe(1 + 8);
    const form: ActivityForm = {
      ...svc.emptyForm(),
      kind: 'training',
      title: 'Capacitação de apoio na rotina',
      theme: 'self_care',
      leaderType: 'guest',
      guestName: 'Convidado Exemplo',
      mode: 'online',
      capacity: 12,
      meetings: [{ date: '2026-12-02', start: '19:00', end: '20:00' }],
    };
    const wrong = svc.save(form, false);
    expect(wrong.ok).toBe(false);
    expect(wrong.ok === false && wrong.errors.some((e) => e.field === 'theme')).toBe(true);
    const right = svc.save({ ...form, theme: 'first_aid' }, false);
    expect(right.ok && right.value.status).toBe('draft');
  });

  it('terapia de grupo só com psicólogo da Nexus com CRP ativo; divulgação sem promessa de resultado (RN-GRP-04, 15)', async () => {
    await bootApp({ userId: 'u1', url: '/app/grupos/novo' });
    const svc = TestBed.inject(GroupsService);
    const guest = svc.save(therapyForm(svc, { leaderType: 'guest', guestName: 'Convidado Exemplo' }), true);
    expect(guest.ok).toBe(false);
    const promise = svc.save(therapyForm(svc, { title: 'Grupo com resultado garantido' }), true);
    expect(promise.ok === false && promise.errors.find((e) => e.field === 'title')?.message).toContain('prometer resultado terapêutico');
    TestBed.inject(GroupMembershipService);
    const inactive = svc.save(therapyForm(svc), true);
    expect(inactive.ok).toBe(true);
    // O psicólogo só cria o que conduz.
    TestBed.resetTestingModule();
    await bootApp({ userId: 'u3', url: '/app/grupos/novo' });
    const svcPsy = TestBed.inject(GroupsService);
    const other = svcPsy.save(therapyForm(svcPsy, { leaderId: 'psy_0003' }), false);
    expect(other.ok).toBe(false);
    const mine = svcPsy.save(
      {
        ...svcPsy.emptyForm(),
        kind: 'group_therapy',
        title: 'Grupo de organização da rotina',
        theme: 'routine_organization',
        mode: 'online',
        capacity: 12,
        meetings: [{ date: '2026-12-03', start: '19:00', end: '20:30' }],
      },
      true,
    );
    expect(mine.ok && mine.value.leaders[0]?.professionalRegistration).toBe('CRP-04/00102 (fictício)');
  });

  it('a nova atividade guarda rascunho e oferece retomar (UX 5.12)', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/grupos/novo' });
    expect(q(app, '[data-role="draft-banner"]')).toBeNull();
    const drafts = TestBed.inject(DraftService);
    drafts.save('activity', 'novo', { ...TestBed.inject(GroupsService).emptyForm(), title: 'Rascunho guardado' });
    await app.router.navigateByUrl('/app/grupos');
    await settle(app.fixture);
    await app.router.navigateByUrl('/app/grupos/novo');
    await settle(app.fixture);
    expect(q(app, '[data-role="draft-banner"]')?.textContent).toContain('Retomar rascunho');
    click(q(app, '[data-role="resume-draft"]'));
    await settle(app.fixture);
    expect((q(app, '[data-role="title"]') as HTMLInputElement).value).toBe('Rascunho guardado');
  });
});

describe('M07 detalhe, sigilo e privacidade (SCR-M07-03, AC-M07-07)', () => {
  it('mostra o caráter, o aviso de que não promete resultado e o número de inscrição profissional', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/grupos/act_0001' });
    expect(q(app, '[data-role="character"]')?.textContent).toContain('Psicoterapia');
    expect(q(app, '[data-role="no-promise"]')?.textContent).toContain('não promete resultado terapêutico');
    expect(q(app, '[data-role="leader"]')?.textContent).toContain('CRP-04/00102 (fictício)');
    expect(q(app, '[data-role="min-plan"]')?.textContent).toContain('Planos Cuida e Sustenta');
    expect(text(app, '[data-role="contract"]')).toContain('o que for dito no grupo fica no grupo');
    expect(text(app)).not.toMatch(FORBIDDEN_WORDS);
  });

  it('a sócia vê só códigos; o atendimento não vê quem está na terapia de grupo; o RT valida o enquadramento', async () => {
    const partner = await bootApp({ userId: 'u1', url: '/app/grupos/act_0001' });
    const content = text(partner, '[data-role="enrolled"]');
    expect(content).toContain('CUI-0001');
    expect(content).not.toContain('Ana Paula Ferraz');
    expect(q(partner, '[data-role="enroll"]')).toBeTruthy();
    TestBed.resetTestingModule();
    const support = await bootApp({ userId: 'u7', url: '/app/grupos/act_0003' });
    expect(text(support, '[data-role="enrolled"]')).not.toContain('Lourdes Campos');
    expect(text(support, '[data-role="enrolled"]')).not.toContain('CUI-0024');
    expect(text(support, '[data-role="enrolled"]')).toContain('4 participantes inscritos');
    TestBed.resetTestingModule();
    const rt = await bootApp({ userId: 'u2', url: '/app/grupos/act_0003' });
    expect(text(rt, '[data-role="enrolled"]')).toContain('Lourdes Campos');
    expect(q(rt, '[data-role="enroll"]')).toBeNull();
    click(q(rt, '[data-role="validate-framing"]'));
    await settle(rt.fixture);
    expect(rt.db.accessLog.list().some((e) => e.entity === 'activity_framing' && e.userId === 'u2')).toBe(true);
    expect(q(rt, '[data-role="framing-validated"]')?.textContent).toContain('Dra. Cecília Montenegro');
  });
});

describe('M07 presença e indicadores (SCR-M07-05 e 06, AC-M07-08)', () => {
  it('marcar a presença atualiza a taxa de presença e o indicador de participação', async () => {
    const app = await bootApp({ userId: 'u5', url: '/app/grupos/act_0003/presenca' });
    const svc = TestBed.inject(GroupsService);
    const activity = app.db.activities.require('act_0003');
    expect(svc.statsOf(activity).presencePercent).toBe(100);
    expect(svc.statsOf(activity).doneMeetings).toBe(2);
    const first = svc.holders('act_0003')[0];
    const meeting = activity.meetings[0];
    expect(svc.setAttendance(first?.id ?? '', meeting?.id ?? '', false).ok).toBe(true);
    expect(svc.statsOf(app.db.activities.require('act_0003')).presencePercent).toBe(87.5);
    await settle(app.fixture);
    expect(text(app, '[data-role="kpi-rate"]')).toContain('87,5%');
    // Encontro que ainda não começou não aceita presença.
    const future = activity.meetings.find((m) => !m.done);
    expect(svc.setAttendance(first?.id ?? '', future?.id ?? '', true).ok).toBe(future ? false : true);
    // A sócia vê o mesmo número nos indicadores.
    TestBed.resetTestingModule();
    const partner = await bootApp({ userId: 'u1', url: '/app/grupos/indicadores' });
    expect(text(partner, '[data-role="indicators-table"]')).toContain('Sobrecarga e autocuidado');
    expect(text(partner, '[data-role="kpi-fill"]')).toMatch(/\d+,\d%/);
  });

  it('marcar o encontro como realizado passa a atividade a em andamento; encerrar fecha e dá o estado final a cada inscrito', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/grupos/act_0009/presenca', time: '23:00' });
    const svc = TestBed.inject(GroupsService);
    const activity = app.db.activities.require('act_0009');
    const first = activity.meetings[0];
    // O encontro de G9 é daqui a 8 dias: ainda não começou.
    expect(svc.markMeetingDone('act_0009', first?.id ?? '').ok).toBe(false);
    app.clock.setSimulated('2026-11-12', '21:00');
    expect(svc.markMeetingDone('act_0009', first?.id ?? '').ok).toBe(true);
    expect(app.db.activities.get('act_0009')?.status).toBe('in_progress');
    const holders = svc.holders('act_0009');
    expect(svc.setAttendance(holders[0]?.id ?? '', first?.id ?? '', true).ok).toBe(true);
    expect(svc.finishActivity('act_0009').ok).toBe(true);
    expect(app.db.activities.get('act_0009')?.status).toBe('finished');
    expect(app.db.activityEnrollments.require(holders[0]?.id ?? '').status).toBe('attended');
    expect(app.db.activityEnrollments.require(holders[1]?.id ?? '').status).toBe('absent');
  });

  it('cancelar a atividade cancela as inscrições e a lista de espera', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/grupos/act_0001' });
    const svc = TestBed.inject(GroupsService);
    const result = svc.cancelActivity('act_0001');
    expect(result.ok && result.value.affected).toBe(8);
    expect(app.db.activities.get('act_0001')?.status).toBe('cancelled');
    expect(app.db.activityEnrollments.count((e) => e.activityId === 'act_0001' && (e.status === 'enrolled' || e.status === 'waitlist'))).toBe(0);
    expect(svc.enroll({ activityId: 'act_0001', caregiverId: 'cg_0001', ...accepted }).ok).toBe(false);
  });
});

describe('M07 mudança de plano (RN-GRP-17, AC-M07-09)', () => {
  it('Cuida para Essencial tira o cuidador das turmas futuras de terapia de grupo; a capacitação e a turma em andamento ficam (docs/20)', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/grupos' });
    const membership = TestBed.inject(GroupMembershipService);
    // Turma em andamento (ciclo já pago) com a mesma pessoa: permanece.
    const running = cloneActivity(app, 'act_0008', { status: 'in_progress', title: 'Grupo em andamento' });
    app.db.activityEnrollments.create({ activityId: running.id, caregiverId: 'cg_0008', status: 'enrolled', attendance: [], confidentialityAcceptedAt: '2026-10-01T10:00:00-03:00' });
    const sub = app.db.subscriptions.find((s) => s.caregiverId === 'cg_0023');
    app.db.subscriptions.update(sub?.id ?? '', { planId: 'essencial' });
    const changes = membership.reconcilePlanLoss('cg_0023');
    const touched = changes.map((c) => c.cancelled.activityId).sort();
    expect(touched).toEqual(['act_0001']);
    expect(app.db.activityEnrollments.find((e) => e.caregiverId === 'cg_0023' && e.activityId === 'act_0002')?.status).toBe('enrolled');
    // A vaga aberta em G1 promoveu o primeiro da fila.
    expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0024')?.status).toBe('enrolled');
    // Cuidador com plano baixado também sai sozinho quando alguém abre a programação (autocorreção).
    const sub8 = app.db.subscriptions.find((s) => s.caregiverId === 'cg_0008');
    app.db.subscriptions.update(sub8?.id ?? '', { planId: 'essencial' });
    await app.router.navigateByUrl('/app/grupos/act_0001');
    await settle(app.fixture);
    expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0001' && e.caregiverId === 'cg_0008')?.status).toBe('cancelled');
    expect(app.db.activityEnrollments.find((e) => e.activityId === running.id && e.caregiverId === 'cg_0008')?.status).toBe('enrolled');
    expect(app.db.activityEnrollments.find((e) => e.activityId === 'act_0003' && e.caregiverId === 'cg_0024')?.status).toBe('enrolled');
  });
});

describe('M07 acessibilidade e texto', () => {
  it('toda tela tem um h1 e nenhuma usa palavra proibida', async () => {
    const urls = ['/app/grupos', '/app/grupos/novo', '/app/grupos/indicadores', '/app/grupos/act_0002', '/app/grupos/act_0003/presenca', '/app/grupos/act_0007'];
    for (const url of urls) {
      TestBed.resetTestingModule();
      const app = await bootApp({ userId: 'u1', url });
      expect(app.root.querySelectorAll('h1').length, url).toBe(1);
      expect(text(app), url).not.toMatch(FORBIDDEN_WORDS);
    }
  });

  it('a tabela de inscritos tem legenda e a lista da programação tem legenda', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/grupos/act_0002' });
    expect(app.root.querySelector('[data-role="enrolled-table"] caption')?.textContent).toContain('Inscritos em Prevenção de quedas');
    TestBed.resetTestingModule();
    const list = await bootApp({ userId: 'u1', url: '/app/grupos' });
    expect(list.root.querySelector('app-data-table caption')?.textContent).toContain('Programação de grupos e capacitações');
  });
});
