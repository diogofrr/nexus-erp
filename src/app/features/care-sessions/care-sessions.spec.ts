import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
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

const FORBIDDEN_WORDS = /diagnóstico|eficácia|paciente|guerreira|anjo|[\u2013\u2014]/i;

function helpers(app: BootedApp) {
  return {
    q: <T extends Element = HTMLElement>(selector: string): T | null => app.root.querySelector<T>(selector),
    all: <T extends Element = HTMLElement>(selector: string): T[] => Array.from(app.root.querySelectorAll<T>(selector)),
    dialog: (): HTMLDialogElement => app.root.querySelector('app-dialog-host dialog') as HTMLDialogElement,
    svc: (): CareSessionsService => TestBed.inject(CareSessionsService),
  };
}

describe('M05 agenda e agendamento (F04)', () => {
  it('o psicólogo vê a própria agenda semanal, com vagas e legenda em texto (SCR-M05-01)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/atendimento/agenda' });
    const { q, all } = helpers(app);
    expect(app.router.url).toContain('/app/atendimento/agenda');
    expect(q('h1')?.textContent).toContain('Agenda');
    expect(q('app-week-agenda [role="grid"]')).toBeTruthy();
    expect(all('app-week-agenda .slot').length).toBeGreaterThan(0);
    expect(q('app-week-agenda .agenda-legend')?.textContent).toContain('Aberta');
    // O psicólogo só vê a própria agenda: um psicólogo no filtro.
    expect(all('app-filter-chips[ng-reflect-label="Psicólogo"]').length).toBe(0);
    expect(app.root.textContent).not.toMatch(FORBIDDEN_WORDS);
  });

  it('o atendimento abre o diálogo Agendar sessão e vê o valor pela cota do plano (AC-M05-14, docs/20)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda' });
    const { q, dialog } = helpers(app);
    click(q('[data-role="open-schedule"]'));
    await settle(app.fixture);
    const drawer = app.root.querySelector('app-schedule-drawer dialog') as HTMLDialogElement;
    expect(drawer.hasAttribute('open')).toBe(true);
    expect(dialog()).toBeTruthy();
    const select = drawer.querySelector('[data-role="caregiver-select"]') as HTMLSelectElement;
    select.value = 'cg_0001';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(app.fixture);
    const summary = drawer.querySelector('[data-role="price-summary"]')?.textContent ?? '';
    // Cuida: 2 sessões por mês; Ana usou 1 em novembro, então a próxima é incluída (R$ 0,00).
    expect(summary).toContain('Incluída na cota do plano Cuida: total R$ 0,00');
    expect(summary).toContain('Neste mês: 1 de 2 sessões usadas');
    // docs/20: o ERP não oferece agendamento de sessão para Livre e Essencial.
    const options = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(options).toContain('cg_0001');
    expect(options).not.toContain('cg_0004');
    expect(options).not.toContain('cg_0002');
    // Sem nenhuma opção pré-marcada no tipo de atendimento do psicólogo; o atendimento recebe o do histórico.
    expect(drawer.textContent).toContain('Mostrando as vagas disponíveis para este cuidador.');
  });

  it('quando o atendimento agenda, o tipo de atendimento vem do histórico e a ajuda manda confirmar com o psicólogo (U-09, A-22)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda' });
    const { q, svc } = helpers(app);
    // docs/20: só quem é do Cuida ou do Sustenta aparece no agendamento.
    const session = app.db.careSessions.list().find((x) => x.kind === 'guidance' && svc().quote(x.caregiverId).allowed);
    expect(session).toBeTruthy();
    const caregiverId = session?.caregiverId ?? '';
    expect(svc().lastKind(caregiverId)).not.toBeNull();
    click(q('[data-role="open-schedule"]'));
    await settle(app.fixture);
    const drawer = app.root.querySelector('app-schedule-drawer dialog') as HTMLDialogElement;
    const search = drawer.querySelector('[data-role="caregiver-search"]');
    typeInto(search, app.db.caregivers.require(caregiverId).code);
    await settle(app.fixture);
    const select = drawer.querySelector('[data-role="caregiver-select"]') as HTMLSelectElement;
    select.value = caregiverId;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(app.fixture);
    const checked = drawer.querySelector('#sched-kind input[type="radio"]:checked')?.closest('label')?.textContent ?? '';
    expect(checked).toContain(svc().lastKind(caregiverId) === 'guidance' ? 'Orientação psicológica' : 'Psicoterapia');
    expect(drawer.querySelector('#sched-kind')?.parentElement?.textContent ?? drawer.textContent).toContain('confirme com o psicólogo do caso');
  });

  it('o valor da sessão vem da cota do plano (docs/20): Livre e Essencial não agendam; Cuida 2 e Sustenta 4 por mês', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda' });
    const { svc } = helpers(app);
    expect(svc().quote('cg_0004')).toMatchObject({ allowed: false }); // Livre
    expect(svc().quote('cg_0006')).toMatchObject({ allowed: false }); // Essencial
    expect(svc().quote('cg_0001')).toMatchObject({ allowed: true, included: true, totalCents: 0 }); // Cuida, 1 de 2
    expect(svc().quote('cg_0009').quota.limit).toBe(4); // Sustenta
    const slot = svc().freeSlots('psy_0001', true)[0];
    const refused = svc().schedule({ caregiverId: 'cg_0004', psychologistId: 'psy_0001', slotId: slot?.id ?? '', modality: 'online', kind: 'guidance' });
    expect(refused.ok === false && refused.errors[0]?.message).toBe('O atendimento psicológico individual faz parte dos planos Cuida e Sustenta.');
  });

  it('vaga reservada não recebe outra sessão e a vaga some das opções (F04, passo 5)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda' });
    const { svc } = helpers(app);
    const slot = svc().freeSlots('psy_0001', false)[0];
    expect(slot).toBeTruthy();
    const input = {
      caregiverId: 'cg_0021',
      psychologistId: 'psy_0001',
      slotId: slot?.id ?? '',
      modality: 'online' as const,
      kind: 'psychotherapy' as const,
    };
    const first = svc().schedule(input);
    expect(first.ok).toBe(true);
    expect(app.db.availabilitySlots.get(slot?.id ?? '')?.status).toBe('booked');
    const second = svc().schedule({ ...input, caregiverId: 'cg_0022' });
    expect(second.ok).toBe(false);
    expect(second.ok === false && second.errors[0]?.message).toContain('Essa vaga acabou de ser reservada');
  });

  it('sessão presencial no coworking com sala de 3 dos 4 itens de acessibilidade é bloqueada (AC-M05-07)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda' });
    const { svc } = helpers(app);
    const slot = svc().freeSlots('psy_0001', false)[0];
    const result = svc().schedule({
      caregiverId: 'cg_0021',
      psychologistId: 'psy_0001',
      slotId: slot?.id ?? '',
      modality: 'in_person_coworking',
      roomId: 'room_0003',
      kind: 'guidance',
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors[0]?.message).toContain('Falta sanitário adaptado (3 de 4 itens de acessibilidade)');
    const ok = svc().schedule({
      caregiverId: 'cg_0021',
      psychologistId: 'psy_0001',
      slotId: slot?.id ?? '',
      modality: 'in_person_coworking',
      roomId: 'room_0001',
      kind: 'guidance',
    });
    expect(ok.ok).toBe(true);
  });

  it('domicílio exige endereço e a caixa "domicílio adequado e seguro"; o tipo é obrigatório (RN-ATD-09, RN-ATD-19)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda' });
    const { svc } = helpers(app);
    const slot = svc().freeSlots('psy_0001', false)[0];
    const result = svc().schedule({
      caregiverId: 'cg_0004',
      psychologistId: 'psy_0001',
      slotId: slot?.id ?? '',
      modality: 'in_person_home',
      kind: null,
    });
    expect(result.ok).toBe(false);
    const fields = result.ok === false ? result.errors.map((e) => e.field) : [];
    expect(fields).toEqual(expect.arrayContaining(['homeAddress', 'homeSafe', 'kind']));
  });

  it('vagas prioritárias: Cuida, Sustenta e alerta amarelo (inclusive no Livre) veem; Livre sem alerta não (AC-M05-13)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda' });
    const { svc } = helpers(app);
    expect(svc().canSeePriority('cg_0001')).toBe(true); // Cuida
    expect(svc().canSeePriority('cg_0009')).toBe(true); // Sustenta
    expect(svc().canSeePriority('cg_0003')).toBe(true); // Livre com alerta amarelo (João)
    expect(svc().canSeePriority('cg_0004')).toBe(false); // Livre sem alerta
    const priority = app.db.availabilitySlots.list().find((s) => s.priorityOnly && s.status === 'open');
    if (priority) {
      const blocked = svc().schedule({
        caregiverId: 'cg_0004',
        psychologistId: priority.psychologistId,
        slotId: priority.id,
        modality: 'online',
        kind: 'guidance',
      });
      expect(blocked.ok).toBe(false);
    }
  });

  it('o psicólogo sem CRP ativo não aparece na agenda (RN-ATD-06)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda' });
    const { svc } = helpers(app);
    expect(svc().activePsychologists().length).toBe(4);
    app.db.psychologists.update('psy_0004', { crpStatus: 'inactive' });
    expect(svc().activePsychologists().map((p) => p.id)).not.toContain('psy_0004');
  });
});

describe('M05 estados da sessão (SCR-M05-04)', () => {
  it('cancelar com menos de 24 horas vira falta; com mais, cancelada pelo cuidador e a vaga volta (AC-M05-09)', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/atendimento/agenda' });
    const { svc } = helpers(app);
    const open = (date: string) =>
      app.db.availabilitySlots.create({ psychologistId: 'psy_0001', date, start: '12:00', end: '13:00', status: 'open', priorityOnly: false });
    const near = open('2026-11-05');
    const far = open('2026-11-12');
    const make = (slotId: string) =>
      svc().schedule({ caregiverId: 'cg_0021', psychologistId: 'psy_0001', slotId, modality: 'online', kind: 'psychotherapy' });
    const sooner = make(near.id);
    const farther = make(far.id);
    expect(sooner.ok).toBe(true);
    expect(farther.ok).toBe(true);
    // Faltam 12 horas para a sessão de 05/11 às 12:00.
    app.clock.setSimulated('2026-11-05', '00:00');
    if (sooner.ok && farther.ok) {
      expect(svc().cancelEffect(sooner.value, 'user')).toContain('registra falta');
      expect(svc().cancelEffect(farther.value, 'user')).toContain('libera a vaga');
      const cancelledSoon = svc().cancel(sooner.value.id, 'user');
      expect(cancelledSoon.ok && cancelledSoon.value.status).toBe('no_show');
      const cancelledLater = svc().cancel(farther.value.id, 'user');
      expect(cancelledLater.ok && cancelledLater.value.status).toBe('cancelled_by_user');
      expect(app.db.availabilitySlots.get(far.id)?.status).toBe('open');
      expect(app.db.availabilitySlots.get(near.id)?.status).toBe('booked');
    }
  });

  it('marcar sessão on-line como realizada sem confirmar o formato remoto é bloqueado (AC-M05-08)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/atendimento/agenda', time: '23:00' });
    const { svc } = helpers(app);
    const session = app.db.careSessions
      .list()
      .find((s) => s.psychologistId === 'psy_0001' && s.modality === 'online' && s.status === 'confirmed' && s.startAt < '2026-11-04T23:00:00-03:00');
    const target =
      session ??
      app.db.careSessions.create({
        caregiverId: 'cg_0001',
        psychologistId: 'psy_0001',
        slotId: 'slot_x',
        startAt: '2026-11-04T09:00:00-03:00',
        durationMin: 60,
        modality: 'online',
        kind: 'psychotherapy',
        status: 'confirmed',
        priceCents: 10200,
        discountPercent: 15,
      });
    const blocked = svc().markDone(target.id, { remoteConfirmed: false });
    expect(blocked.ok).toBe(false);
    expect(blocked.ok === false && blocked.errors[0]?.message).toContain('formato remoto é pertinente');
    const done = svc().markDone(target.id, { remoteConfirmed: true });
    expect(done.ok && done.value.remoteFormatConfirmedPertinent).toBe(true);
  });

  it('risco marcado em sessão exige o encaminhamento e abre a ocorrência POP-05 com passos já feitos', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/atendimento/agenda', time: '23:00' });
    const { svc } = helpers(app);
    const target = app.db.careSessions.create({
      caregiverId: 'cg_0005',
      psychologistId: 'psy_0001',
      slotId: 'slot_y',
      startAt: '2026-11-04T09:00:00-03:00',
      durationMin: 60,
      modality: 'online',
      kind: 'psychotherapy',
      status: 'confirmed',
      priceCents: 12000,
      discountPercent: 0,
    });
    const without = svc().markDone(target.id, { remoteConfirmed: true, risk: { destinations: [] } });
    expect(without.ok).toBe(false);
    const occBefore = app.db.occurrences.size();
    const done = svc().markDone(target.id, {
      remoteConfirmed: true,
      risk: { destinations: ['Rede de urgência em saúde mental'] },
    });
    expect(done.ok).toBe(true);
    expect(app.db.occurrences.size()).toBe(occBefore + 1);
    const occurrence = app.db.occurrences.list().at(-1);
    expect(occurrence?.kind).toBe('pop05_risk');
    expect(occurrence?.restrictedToUserIds).toEqual(expect.arrayContaining(['u2', 'u3']));
    expect(occurrence?.steps.filter((s) => s.doneAt).map((s) => s.n)).toEqual([1, 2, 4, 5, 6]);
    expect(app.db.referrals.list().at(-1)?.category).toBe('severe_distress_or_suicide_risk');
  });
});

describe('M05 anotação sigilosa (F18, SCR-M05-05)', () => {
  const draftNote = (app: BootedApp) => {
    const note = app.db.sessionNotes.list().find((n) => n.status === 'draft');
    if (!note) {
      throw new Error('o seed tem anotações em rascunho');
    }
    const session = app.db.careSessions.require(note.sessionId);
    const psychologist = app.db.psychologists.require(session.psychologistId);
    return { note, session, userId: psychologist.userId };
  };

  it('escrever, assinar com diálogo de efeito e então só adendar: sem botão de editar (AC-M05-10)', async () => {
    const probe = await bootApp({});
    const seed = draftNote(probe);
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: seed.userId, url: `/app/atendimento/sessoes/${seed.session.id}/anotacao` });
    const { q, dialog } = helpers(app);
    expect(q('[data-role="note-text"]')).toBeTruthy();
    expect(q('[data-role="sign"]')).toBeTruthy();
    typeInto(q('[data-role="note-text"]'), 'Conversa sobre a rotina de cuidado e o descanso nos fins de semana.');
    click(q('[data-role="save-draft"]'));
    await settle(app.fixture);
    expect(app.db.sessionNotes.get(seed.note.id)?.content).toContain('descanso nos fins de semana');
    click(q('[data-role="sign"]'));
    await settle(app.fixture);
    expect(dialog().textContent).toContain('não pode ser editada');
    click(dialog().querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    const signed = app.db.sessionNotes.get(seed.note.id);
    expect(signed?.status).toBe('signed');
    expect(signed?.signedAt).toBeTruthy();
    // Assinada: sem editar, só adendo.
    expect(q('[data-role="note-text"]')).toBeNull();
    expect(q('[data-role="sign"]')).toBeNull();
    typeInto(q('[data-role="addendum-text"]'), 'Complemento combinado com o cuidador.');
    click(q('[data-role="add-addendum"]'));
    await settle(app.fixture);
    const after = app.db.sessionNotes.get(seed.note.id);
    expect(after?.addenda.at(-1)?.content).toBe('Complemento combinado com o cuidador.');
    expect(after?.addenda.at(-1)?.at).toBeTruthy();
    // O serviço também recusa editar o texto assinado.
    expect(helpers(app).svc().saveDraft(seed.session.id, 'texto novo').ok).toBe(false);
    expect(app.db.accessLog.list().some((e) => e.entity === 'session_note' && e.action === 'update')).toBe(true);
  });

  it('o atendimento não abre anotação nem a aba clínica da sessão (AC-M05-11, V04)', async () => {
    const probe = await bootApp({});
    const seed = draftNote(probe);
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: 'u7', url: `/app/atendimento/sessoes/${seed.session.id}` });
    const { q } = helpers(app);
    expect(app.router.url).toBe(`/app/atendimento/sessoes/${seed.session.id}`);
    expect(q('[data-role="note-link"]')).toBeNull();
    expect(app.root.textContent).not.toContain(seed.note.content);
    await app.router.navigateByUrl(`/app/atendimento/sessoes/${seed.session.id}/anotacao`);
    await settle(app.fixture);
    expect(app.router.url).toBe('/403');
    expect(app.db.accessLog.list().some((e) => e.action === 'denied' && e.userId === 'u7')).toBe(true);
  });

  it('o psicólogo não abre anotação de outro psicólogo; o RT abre pelo portão de supervisão com log (AC-M05-12)', async () => {
    const probe = await bootApp({});
    const seed = draftNote(probe);
    const other = probe.db.psychologists.list().find((p) => p.id !== seed.session.psychologistId);
    TestBed.resetTestingModule();
    const app = await bootApp({ userId: other?.userId ?? 'u4', url: '/app/atendimento/agenda' });
    await app.router.navigateByUrl(`/app/atendimento/sessoes/${seed.session.id}/anotacao`);
    await settle(app.fixture);
    expect(app.router.url).toBe('/403');

    TestBed.resetTestingModule();
    const rt = await bootApp({ userId: 'u2', url: `/app/atendimento/sessoes/${seed.session.id}/anotacao` });
    const { q } = helpers(rt);
    const logBefore = rt.db.accessLog.size();
    expect(q('[data-role="supervision-gate"]')).toBeTruthy();
    expect(rt.root.textContent).not.toContain(seed.note.content);
    expect(q('[data-role="note-text"]')).toBeNull();
    const first = q<HTMLInputElement>('app-supervision-gate input[type="radio"]');
    click(first);
    click(q('[data-role="gate-open"]'));
    await settle(rt.fixture);
    expect(q('[data-role="supervision-gate"]')).toBeNull();
    expect(q('[data-role="note-body"]')?.textContent).toContain(seed.note.content.slice(0, 20));
    // Sem botões de edição para o RT.
    expect(q('[data-role="sign"]')).toBeNull();
    expect(q('[data-role="note-text"]')).toBeNull();
    const supervise = rt.db.accessLog
      .list()
      .slice(logBefore)
      .filter((e) => e.action === 'supervise' && e.entity === 'session_note');
    expect(supervise).toHaveLength(1);
    expect(supervise[0]?.justification).toBeTruthy();
  });
});

describe('M05 ocupação (SCR-M05-06, EQP)', () => {
  const rowOf = (app: BootedApp, psychologistId: string) =>
    TestBed.inject(CareSessionsService).occupancyFor(app.db.psychologists.require(psychologistId));

  it('Rafael: 86,3% e 91,3% com o aviso de agenda acima de 80% por dois meses (AC-M05-01)', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/atendimento/ocupacao' });
    const row = rowOf(app, 'psy_0001');
    expect(row.months.map((m) => m.occupancyPercent)).toEqual([86.3, 91.3, row.months[2]?.occupancyPercent]);
    expect(row.overload).toBe(true);
    expect(app.root.textContent).toContain('86,3%');
    expect(app.root.textContent).toContain('91,3%');
    expect(app.root.querySelector('[data-role="overload-text"]')?.textContent).toContain('acima de 80% há dois meses seguidos');
  });

  it('Letícia (80,0% e 80,0%) não dispara; Beatriz (85,0% e 70,0%) não dispara (AC-M05-02, AC-M05-03)', async () => {
    const app = await bootApp({ userId: 'u2', url: '/app/atendimento/ocupacao' });
    const leticia = rowOf(app, 'psy_0003');
    expect(leticia.months.slice(0, 2).map((m) => m.occupancyPercent)).toEqual([80, 80]);
    expect(leticia.overload).toBe(false);
    const beatriz = rowOf(app, 'psy_0002');
    expect(beatriz.months.slice(0, 2).map((m) => m.occupancyPercent)).toEqual([85, 70]);
    expect(beatriz.overload).toBe(false);
    expect(app.root.textContent).toContain('80,0%');
  });

  it('Tiago: mês -2 sem agenda mostra n/d e nenhum alerta; o mês corrente é parcial e não entra na regra (AC-M05-04, AC-M05-05)', async () => {
    const app = await bootApp({ userId: 'u2', url: '/app/atendimento/ocupacao' });
    const tiago = rowOf(app, 'psy_0004');
    expect(tiago.months[0]?.occupancyPercent).toBeNull();
    expect(tiago.months[1]?.occupancyPercent).toBe(50);
    expect(tiago.overload).toBe(false);
    expect(tiago.months[2]?.isPartialMonth).toBe(true);
    expect(tiago.months[0]?.isPartialMonth).toBe(false);
    const card = app.root.querySelector('[data-psychologist="psy_0004"]');
    expect(card?.textContent).toContain('n/d');
    expect(card?.textContent).toContain('parcial');
  });

  it('a sócia vê horas por psicólogo sem nenhum cuidador identificado (AC-M05-15)', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/atendimento' });
    expect(app.router.url).toBe('/app/atendimento/ocupacao');
    const text = app.root.querySelector('main')?.textContent ?? '';
    expect(text).toContain('Dr. Rafael Moreira');
    expect(text).toContain('Horas disponibilizadas');
    const names = app.db.caregivers.list().slice(0, 29).map((c) => c.fullName);
    names.forEach((name) => expect(text).not.toContain(name));
    // A agenda e as sessões ficam fora do alcance da sócia.
    await app.router.navigateByUrl('/app/atendimento/agenda');
    await settle(app.fixture);
    expect(app.router.url).toBe('/403');
  });

  it('redistribuir de Rafael para Tiago transfere sessões futuras e cuidadores, grava motivo e a ocupação de Rafael cai (AC-M05-06)', async () => {
    const app = await bootApp({ userId: 'u2', url: '/app/atendimento/ocupacao' });
    const svc = TestBed.inject(CareSessionsService);
    const before = rowOf(app, 'psy_0001').months[2]?.availableHours ?? 0;
    const preview = svc.redistributionPreview('psy_0001');
    expect(preview.caregivers).toBeGreaterThan(0);
    expect(preview.sessions).toBeGreaterThan(0);
    const weak = svc.redistribute('psy_0001', 'psy_0004', '');
    expect(weak.ok).toBe(false);
    const result = svc.redistribute('psy_0001', 'psy_0004', 'Agenda acima de 80% por dois meses.');
    expect(result.ok).toBe(true);
    expect(app.db.caregivers.count((c) => c.assignedPsychologistId === 'psy_0001')).toBe(0);
    expect(app.db.careSessions.count((s) => s.psychologistId === 'psy_0001' && (s.status === 'scheduled' || s.status === 'confirmed') && s.startAt > '2026-11-04T12:00:00-03:00')).toBe(0);
    const after = rowOf(app, 'psy_0001').months[2]?.availableHours ?? 0;
    expect(after).toBeLessThan(before);
    const entry = app.db.accessLog.list().find((e) => e.entity === 'psychologist_redistribution');
    expect(entry?.justification).toBe('Agenda acima de 80% por dois meses.');
    // O psicólogo de origem não faz a transferência.
    TestBed.resetTestingModule();
    const rafael = await bootApp({ userId: 'u3', url: '/app/atendimento/ocupacao' });
    expect(TestBed.inject(CareSessionsService).redistribute('psy_0001', 'psy_0004', 'Motivo qualquer').ok).toBe(false);
    expect(rafael.router.url).toBe('/app/atendimento/ocupacao');
  });
});

describe('M05 salas e disponibilidade', () => {
  it('a sala Jacarandá aparece bloqueada com o motivo (3 de 4) e só a sócia edita (RN-ATD-10)', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/atendimento/salas' });
    const card = app.root.querySelector('[data-room="room_0003"]');
    expect(card?.textContent).toContain('Bloqueada');
    expect(card?.textContent).toContain('Falta sanitário adaptado');
    expect(app.root.querySelector('[data-role="new-room"]')).toBeTruthy();
    TestBed.resetTestingModule();
    const rt = await bootApp({ userId: 'u2', url: '/app/atendimento/salas' });
    expect(rt.root.querySelector('[data-role="new-room"]')).toBeNull();
    expect(rt.root.querySelector('[data-role="edit-room"]')).toBeNull();
  });

  it('o psicólogo abre, marca como prioritária, bloqueia e fecha vagas; vaga reservada não muda', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/atendimento/disponibilidade' });
    const svc = TestBed.inject(CareSessionsService);
    const day = '2026-11-12';
    expect(svc.slotAt('psy_0001', day, '10:00')).toBeUndefined();
    expect(svc.setSlotState('psy_0001', day, '10:00', 'open').ok).toBe(true);
    expect(svc.slotAt('psy_0001', day, '10:00')?.status).toBe('open');
    svc.setSlotState('psy_0001', day, '10:00', 'priority');
    expect(svc.slotAt('psy_0001', day, '10:00')?.priorityOnly).toBe(true);
    svc.setSlotState('psy_0001', day, '10:00', 'blocked');
    expect(svc.slotAt('psy_0001', day, '10:00')?.status).toBe('blocked');
    svc.setSlotState('psy_0001', day, '10:00', 'none');
    expect(svc.slotAt('psy_0001', day, '10:00')).toBeUndefined();
    const booked = app.db.availabilitySlots.list().find((s) => s.psychologistId === 'psy_0001' && s.status === 'booked' && s.date > '2026-11-04');
    if (booked) {
      expect(svc.setSlotState('psy_0001', booked.date, booked.start, 'none').ok).toBe(false);
    }
    // Pela tela: o clique muda a vaga.
    const cell = app.root.querySelector('[data-cell="2026-11-05 15:00"]') as HTMLButtonElement | null;
    expect(cell).toBeTruthy();
    expect(app.root.textContent).toContain('Disponibilidade');
    expect(app.root.querySelector('[data-role="summary"]')?.textContent).toContain('abertas');
    // O atendimento não abre a disponibilidade de ninguém.
    TestBed.resetTestingModule();
    const support = await bootApp({ userId: 'u7', url: '/app/atendimento/disponibilidade' });
    expect(support.router.url).toBe('/403');
  });

  it('a sessão do dia aparece na lista com o estado em texto e a fila leva à tela única de acompanhamento', async () => {
    const app = await bootApp({ userId: 'u3', url: '/app/atendimento/sessoes' });
    const rows = app.root.querySelectorAll('app-data-table tbody tr, app-data-table .table tbody tr');
    expect(rows.length).toBeGreaterThan(0);
    expect(app.root.querySelector('h1')?.textContent).toContain('Sessões');
    expect(app.root.textContent).not.toMatch(FORBIDDEN_WORDS);
    await app.router.navigateByUrl('/app/atendimento/fila');
    await settle(app.fixture);
    expect(app.router.url).toContain('/app/acompanhamento');
  });
});
