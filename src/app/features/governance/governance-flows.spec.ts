import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { pick, pickAll, text, typeInto } from '../../shared/ui/testing/dom';
import { GovernanceService } from './state/governance.service';

async function open(userId: string, url: string): Promise<BootedApp> {
  TestBed.resetTestingModule();
  const app = await bootApp({ userId, url });
  await settle(app.fixture);
  return app;
}

const main = (app: BootedApp): string => text(pick(app.root, 'main'));

async function confirmDialog(app: BootedApp): Promise<void> {
  const dialog = pick<HTMLDialogElement>(app.root, 'app-dialog-host dialog');
  pick<HTMLButtonElement>(dialog, '[data-role="confirm"]').click();
  await settle(app.fixture);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await settle(app.fixture);
}

describe('M13 Governança: visão geral', () => {
  it('mostra o que pede atenção, com contagens do seed, e a sócia só vê a contagem de ocorrências', async () => {
    const app = await open('u1', '/app/governanca');
    const kpis = pickAll(app.root, 'app-kpi').map((k) => text(k));
    expect(kpis.find((k) => k.startsWith('POPs a revisar'))).toContain('3');
    expect(kpis.find((k) => k.startsWith('Riscos prioritários'))).toContain('8');
    expect(kpis.find((k) => k.startsWith('Conteúdos em revisão'))).toContain('2');
    expect(text(pick(app.root, '[data-role="counts-only"]'))).toContain('2 de situação de risco');
    expect(app.root.querySelector('[data-role="occurrence-list"]')).toBeNull();
    expect(pickAll(app.root, 'h1')).toHaveLength(1);
    expect(pickAll(app.root, '[data-role="due-pops"] a')).toHaveLength(3);
  });

  it('o menu da governança some a aba Ocorrências para o atendimento', async () => {
    const support = await open('u7', '/app/governanca');
    const labels = pickAll(support.root, 'nav[aria-label="Telas da governança"] a').map((a) => text(a));
    expect(labels).not.toContain('Ocorrências');
    expect(labels).toContain('Normas');
    const lead = await open('u2', '/app/governanca');
    expect(pickAll(lead.root, 'nav[aria-label="Telas da governança"] a').map((a) => text(a))).toContain('Ocorrências');
  });
});

describe('M13 Governança: ocorrências (SCR-M13-07 e 08, AC-M13-06, 07 e 08)', () => {
  it('o RT vê as 3 ocorrências; a restrição ao RT e ao psicólogo do caso vale na lista', async () => {
    const lead = await open('u2', '/app/governanca/ocorrencias');
    const rows = pickAll(lead.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(rows).toHaveLength(3);
    expect(rows.join(' ')).toContain('CUI-0001');
    expect(rows.join(' ')).toContain('CUI-0011');
    expect(rows.join(' ')).toContain('CUI-0028');
    expect(rows.join(' ')).not.toMatch(/Ana Paula|Eliane|Vanessa/);
    // Rafael só tem a do caso dele (C01).
    const rafael = await open('u3', '/app/governanca/ocorrencias');
    const mine = pickAll(rafael.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toContain('CUI-0001');
  });

  it('a gestão só vê contagens e o atendimento é barrado (AC-M13-08)', async () => {
    const partner = await open('u1', '/app/governanca/ocorrencias');
    expect(partner.router.url).toBe('/app/governanca/ocorrencias');
    expect(partner.root.querySelector('app-data-table')).toBeNull();
    expect(text(pick(partner.root, '[data-role="counts-only"]'))).toContain('Situações de risco (POP-05)');
    expect(main(partner)).not.toMatch(/CUI-\d{4}/);
    const support = await open('u7', '/app/governanca/ocorrencias');
    expect(support.router.url).toBe('/403');
    expect(text(pick(support.root, 'main'))).not.toContain('POP-05');
    // O detalhe também: a gestão e o atendimento não abrem.
    const detailPartner = await open('u1', '/app/governanca/ocorrencias/occ_0002');
    expect(detailPartner.router.url).toBe('/403');
    const detailSupport = await open('u7', '/app/governanca/ocorrencias/occ_0002');
    expect(detailSupport.router.url).toBe('/403');
  });

  it('O-1 (POP-05 de C11) está encerrada com os 7 passos feitos; O-2 (C01) mostra os passos pendentes', async () => {
    const closed = await open('u2', '/app/governanca/ocorrencias/occ_0001');
    expect(text(pick(closed.root, '[data-role="status"]'))).toContain('7 de 7 passos feitos');
    expect(text(pick(closed.root, '[data-role="status"]'))).toContain('Encerrada');
    expect(closed.root.querySelector('[data-role="step-form"]')).toBeNull();
    expect(text(pick(closed.root, '[data-role="closing"]'))).toContain('Encerrada');
    const progress = await open('u2', '/app/governanca/ocorrencias/occ_0002');
    expect(text(pick(progress.root, '[data-role="status"]'))).toContain('2 de 7 passos feitos');
    expect(text(pick(progress.root, '[data-role="missing"]'))).toContain('Para encerrar, falta');
    expect(text(pick(progress.root, '[data-role="closing"]'))).toContain('os passos 3, 4, 5, 6, 7');
    expect(pick<HTMLButtonElement>(progress.root, '[data-role="close-occurrence"]').disabled).toBe(true);
    // Cada passo feito tem hora e responsável.
    expect(main(progress)).toContain('por Dr. Rafael Moreira');
    expect(main(progress)).toContain('Pendente');
  });

  it('O-3 (POP-07 de C28): notificação não comunicada e o lembrete de proteger sem abandonar quem cuida', async () => {
    const app = await open('u2', '/app/governanca/ocorrencias/occ_0003');
    expect(text(pick(app.root, '[data-role="reminder"]'))).toContain('Proteger a pessoa idosa sem abandonar quem cuida');
    const authorities = pickAll(app.root, '[data-role="authorities"] li').map((l) => text(l));
    expect(authorities).toHaveLength(2);
    expect(authorities[0]).toContain('CREAS');
    expect(authorities[0]).toContain('Não comunicado');
    expect(authorities[1]).toContain('Disque 100');
    // Registrar a comunicação ao CREAS completa a linha, sem duplicar.
    typeInto(pick<HTMLInputElement>(app.root, '#auth-protocol'), 'CREAS-2026-77');
    pick<HTMLFormElement>(app.root, '[data-role="authority-form"]').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    const occurrence = app.db.occurrences.get('occ_0003');
    expect(occurrence?.authoritiesNotified).toHaveLength(2);
    expect(occurrence?.authoritiesNotified[0]).toMatchObject({ body: 'CREAS', at: '2026-11-04', protocol: 'CREAS-2026-77' });
    expect(text(pick(app.root, '[data-role="authorities"]'))).toContain('protocolo CREAS-2026-77');
  });

  it('registrar um passo grava hora, responsável e log; psicólogo conduz mas só o RT encerra', async () => {
    const rafael = await open('u3', '/app/governanca/ocorrencias/occ_0002');
    expect(rafael.root.querySelector('[data-role="step-form"]')).not.toBeNull();
    expect(rafael.root.querySelector('[data-role="close-occurrence"]')).toBeNull();
    expect(text(pick(rafael.root, '[data-role="close-owner"]'))).toContain('Só o responsável técnico encerra');
    typeInto(pick<HTMLTextAreaElement>(rafael.root, '#occ-note'), 'Avaliação de risco feita por telefone.');
    pick<HTMLFormElement>(rafael.root, '[data-role="step-form"]').dispatchEvent(new Event('submit'));
    await settle(rafael.fixture);
    const step = rafael.db.occurrences.get('occ_0002')?.steps.find((s) => s.n === 3);
    expect(step?.byUserId).toBe('u3');
    expect(step?.doneAt).toMatch(/^2026-11-04T12:00/);
    expect(step?.note).toBe('Avaliação de risco feita por telefone.');
    expect(rafael.db.accessLog.list().at(-1)).toMatchObject({ action: 'update', entity: 'occurrence', entityId: 'occ_0002' });
    expect(text(pick(rafael.root, '[data-role="status"]'))).toContain('3 de 7 passos feitos');
    // Outro psicólogo não conduz a ocorrência de Rafael.
    const beatriz = await open('u4', '/app/governanca/ocorrencias/occ_0002');
    expect(beatriz.root.querySelector('[data-role="step-form"]')).toBeNull();
    expect(main(beatriz)).toContain('não está disponível para o seu perfil');
    expect(main(beatriz)).not.toContain('CUI-0001');
  });

  it('abrir a ocorrência fica no log de acesso; encerrar exige os 7 passos e pede confirmação com o efeito', async () => {
    const app = await open('u2', '/app/governanca/ocorrencias/occ_0002');
    expect(app.db.accessLog.list().some((e) => e.action === 'view' && e.entity === 'occurrence' && e.entityId === 'occ_0002')).toBe(true);
    const service = TestBed.inject(GovernanceService);
    expect(service.closeOccurrence('occ_0002').ok).toBe(false);
    for (let n = 3; n <= 7; n += 1) {
      expect(service.registerStep('occ_0002', n, '').ok).toBe(true);
    }
    expect(service.registerStep('occ_0002', 7, '').ok).toBe(false);
    await settle(app.fixture);
    const close = pick<HTMLButtonElement>(app.root, '[data-role="close-occurrence"]');
    expect(close.disabled).toBe(false);
    close.click();
    await settle(app.fixture);
    const dialog = pick<HTMLDialogElement>(app.root, 'app-dialog-host dialog');
    expect(text(dialog)).toContain('Encerrar a ocorrência de CUI-0001?');
    expect(text(dialog)).toContain('Continua registrado');
    await confirmDialog(app);
    expect(app.db.occurrences.get('occ_0002')?.status).toBe('closed');
  });

  it('o RT abre uma ocorrência nova com todos os passos pendentes, restrita a ele e ao psicólogo do caso', async () => {
    const app = await open('u2', '/app/governanca/ocorrencias');
    pick<HTMLButtonElement>(app.root, '[data-role="new"]').click();
    await settle(app.fixture);
    typeInto(pick<HTMLInputElement>(app.root, '#occ-code'), 'CUI-0005');
    pick<HTMLFormElement>(app.root, '#occ-form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    const created = app.db.occurrences.list().at(-1);
    expect(created?.caregiverId).toBe('cg_0005');
    expect(created?.kind).toBe('pop05_risk');
    expect(created?.steps).toHaveLength(7);
    expect(created?.steps.every((s) => !s.doneAt)).toBe(true);
    expect(created?.restrictedToUserIds).toEqual(['u2', 'u3']);
    expect(app.router.url).toBe(`/app/governanca/ocorrencias/${created?.id}`);
  });
});

describe('M13 Governança: formação (SCR-M13-09, AC-M13-10)', () => {
  it('mostra as quatro frentes e o prestador sem integração como pendente', async () => {
    const app = await open('u1', '/app/governanca/formacao');
    const fronts = pickAll(app.root, '[data-front]').map((f) => f.getAttribute('data-front'));
    expect(fronts).toEqual(['provider_integration', 'group_professionals', 'management', 'continuing']);
    const integration = pickAll(app.root, '[data-role="integration-status"] li').map((l) => text(l));
    const pending = integration.filter((l) => l.includes('Pendente'));
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(integration.join(' ')).toContain('Equipamentos Cuidar+');
    expect(integration.find((l) => l.includes('Equipamentos Cuidar+'))).toContain('Pendente');
    expect(main(app)).toContain('Integração dos credenciados');
    expect(main(app)).toContain('Formação continuada');
  });

  it('marcar presença só vale a partir do dia do evento e conclui a integração do prestador', async () => {
    const app = await open('u1', '/app/governanca/formacao');
    const service = TestBed.inject(GovernanceService);
    const future = app.db.trainingEvents.find((e) => e.front === 'provider_integration' && e.date > '2026-11-04');
    const futureEvent = future as { id: string };
    expect(service.setAttendance(futureEvent.id, 0, true).ok).toBe(false);
    const past = app.db.trainingEvents.find(
      (e) => e.front === 'continuing' && e.date < '2026-11-04' && e.attendees.some((a) => !a.present),
    ) as {
      id: string;
      attendees: { personId: string; present: boolean }[];
    };
    const absent = past.attendees.findIndex((a) => !a.present);
    expect(service.setAttendance(past.id, absent, true).ok).toBe(true);
    expect(app.db.trainingEvents.get(past.id)?.attendees[absent]?.present).toBe(true);
    // Integração: criar o evento de hoje com o prestador sem integração e marcar presença.
    const created = service.createTrainingEvent({
      front: 'provider_integration',
      title: 'Integração extra',
      date: '2026-11-04',
      attendees: [{ personType: 'provider', personId: 'prv_17' }],
    });
    expect(created.ok).toBe(true);
    expect(app.db.providers.get('prv_17')?.integrationDoneAt).toBeUndefined();
    expect(service.setAttendance(created.id as string, 0, true).ok).toBe(true);
    expect(app.db.providers.get('prv_17')?.integrationDoneAt).toBe('2026-11-04');
  });

  it('o evento novo exige título e ao menos uma pessoa; psicólogo só lê', async () => {
    const lead = await open('u2', '/app/governanca/formacao');
    pick<HTMLButtonElement>(lead.root, '[data-role="new"]').click();
    await settle(lead.fixture);
    pick<HTMLFormElement>(lead.root, '#training-form').dispatchEvent(new Event('submit'));
    await settle(lead.fixture);
    expect(text(pick(lead.root, 'app-drawer'))).toContain('Informe o título do evento');
    expect(text(pick(lead.root, 'app-drawer'))).toContain('Escolha ao menos uma pessoa');
    const psy = await open('u3', '/app/governanca/formacao');
    expect(psy.root.querySelector('[data-role="new"]')).toBeNull();
    expect(pickAll<HTMLInputElement>(psy.root, '[data-event] input[type="checkbox"]').every((c) => c.disabled)).toBe(true);
  });
});

describe('M13 Governança: conteúdos de orientação (SCR-M13-10, AC-M13-11)', () => {
  it('lista os 8 conteúdos: 5 publicados, 2 em revisão e 1 rascunho', async () => {
    const app = await open('u1', '/app/governanca/conteudos');
    const rows = pickAll(app.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(rows).toHaveLength(8);
    expect(rows.filter((r) => r.includes('Publicado'))).toHaveLength(5);
    expect(rows.filter((r) => r.includes('Em revisão'))).toHaveLength(2);
    expect(rows.filter((r) => r.includes('Rascunho'))).toHaveLength(1);
    expect(rows.filter((r) => r.includes('Planos pagos'))).toHaveLength(1);
  });

  it('a gestão não publica conteúdo em revisão; o RT publica, com a data da aprovação', async () => {
    const partner = await open('u1', '/app/governanca/conteudos');
    const inReview = partner.db.guidanceContents.find((c) => c.status === 'in_review') as { id: string; title: string };
    const row = pickAll<HTMLElement>(partner.root, 'app-data-table tbody tr').find((r) => text(r).includes(inReview.title));
    row?.click();
    await settle(partner.fixture);
    const approve = pick<HTMLButtonElement>(partner.root, '[data-role="approve"]');
    expect(approve.disabled).toBe(true);
    expect(text(pick(partner.root, '[data-role="approve-reason"]'))).toContain('Só o responsável técnico aprova e publica');
    expect(TestBed.inject(GovernanceService).approve(inReview.id).ok).toBe(false);
    expect(partner.db.guidanceContents.get(inReview.id)?.status).toBe('in_review');

    const lead = await open('u2', '/app/governanca/conteudos');
    const leadRow = pickAll<HTMLElement>(lead.root, 'app-data-table tbody tr').find((r) => text(r).includes(inReview.title));
    leadRow?.click();
    await settle(lead.fixture);
    pick<HTMLButtonElement>(lead.root, '[data-role="approve"]').click();
    await settle(lead.fixture);
    await confirmDialog(lead);
    const published = lead.db.guidanceContents.get(inReview.id);
    expect(published?.status).toBe('published');
    expect(published?.approvedAt).toBe('2026-11-04');
    expect(published?.approvedByUserId).toBe('u2');
    expect(lead.db.accessLog.list().at(-1)).toMatchObject({ action: 'update', entity: 'guidance_content' });
  });

  it('escrever, enviar para revisão e devolver a rascunho; publicado só muda depois de voltar', async () => {
    const app = await open('u1', '/app/governanca/conteudos');
    const service = TestBed.inject(GovernanceService);
    expect(service.saveContent(null, { title: 'Oi', body: 'curto', exclusive: false }).ok).toBe(false);
    const saved = service.saveContent(null, {
      title: 'Cuidar do sono quando a rotina aperta',
      body: 'Escolha um horário regular para dormir e peça ajuda para cobrir a noite uma vez por semana.',
      exclusive: false,
    });
    expect(saved.ok).toBe(true);
    const id = saved.id as string;
    expect(app.db.guidanceContents.get(id)?.status).toBe('draft');
    expect(service.sendToReview(id).ok).toBe(true);
    expect(app.db.guidanceContents.get(id)?.status).toBe('in_review');
    const published = app.db.guidanceContents.find((c) => c.status === 'published') as { id: string };
    expect(service.saveContent(published.id, { title: 'Novo título', body: 'Texto novo com mais de dez letras.', exclusive: false }).ok).toBe(false);
    // Psicólogo só lê.
    const psy = await open('u3', '/app/governanca/conteudos');
    expect(psy.root.querySelector('[data-role="new"]')).toBeNull();
    expect(pickAll(psy.root, 'app-data-table tbody tr').length).toBeGreaterThanOrEqual(8);
  });
});

describe('M13 Governança: normas (SCR-M13-11, AC-M13-12)', () => {
  it('lista as seis normas, com "vigência confirmada em" vazia', async () => {
    const app = await open('u1', '/app/governanca/normas');
    const rows = pickAll(app.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(rows).toHaveLength(6);
    expect(rows.join(' ')).toContain('Código de Ética Profissional do Psicólogo (CFP, 2005)');
    expect(rows.join(' ')).toContain('Resolução CFP nº 9/2024');
    expect(rows.join(' ')).toContain('Lei nº 13.709/2018 (LGPD)');
    expect(rows.every((r) => r.includes('Ainda não confirmada'))).toBe(true);
  });

  it('confirmar a vigência grava a data e o desfazer volta ao vazio; data futura é recusada', async () => {
    const app = await open('u2', '/app/governanca/normas');
    pickAll<HTMLButtonElement>(app.root, '[data-role="confirm"]')[0]?.click();
    await settle(app.fixture);
    typeInto(pick<HTMLInputElement>(app.root, '#norm-date'), '31122030');
    pick<HTMLFormElement>(app.root, '#norm-form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    expect(text(pick(app.root, 'app-drawer'))).toContain('não pode ser no futuro');
    typeInto(pick<HTMLInputElement>(app.root, '#norm-date'), '03112026');
    pick<HTMLFormElement>(app.root, '#norm-form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    const norm = app.db.norms.list()[0];
    expect(norm?.confirmedInForceAt).toBe('2026-11-03');
    expect(pickAll(app.root, 'app-data-table tbody tr').map((r) => text(r))[0]).toContain('Confirmada em 03/11/2026');
    pick<HTMLButtonElement>(app.root, '.toast__action').click();
    await settle(app.fixture);
    expect(app.db.norms.list()[0]?.confirmedInForceAt).toBeUndefined();
  });

  it('psicólogo e atendimento leem as normas, sem o botão de confirmar', async () => {
    for (const userId of ['u3', 'u7']) {
      const app = await open(userId, '/app/governanca/normas');
      expect(pickAll(app.root, 'app-data-table tbody tr')).toHaveLength(6);
      expect(app.root.querySelector('[data-role="confirm"]')).toBeNull();
    }
  });
});

describe('M13 Governança: acessibilidade básica', () => {
  it('um h1, abas como navegação nomeada e campos do formulário com rótulo', async () => {
    const app = await open('u2', '/app/governanca/encaminhamentos');
    expect(pickAll(app.root, 'h1')).toHaveLength(1);
    expect(app.root.querySelector('nav[aria-label="Telas da governança"]')).not.toBeNull();
    pick<HTMLButtonElement>(app.root, '[data-role="new"]').click();
    await settle(app.fixture);
    const controls = pickAll<HTMLElement>(app.root, '#referral-form input[type="text"], #referral-form select, #referral-form textarea, #referral-form input:not([type])');
    expect(controls.length).toBeGreaterThanOrEqual(3);
    for (const control of controls) {
      const labelled = control.id !== '' && app.root.querySelector(`label[for="${control.id}"]`) !== null;
      expect(labelled, control.outerHTML.slice(0, 80)).toBe(true);
    }
  });
});
