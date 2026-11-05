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
const tabLabels = (app: BootedApp): string[] =>
  pickAll(app.root, 'nav[aria-label="Telas da governança"] a').map((a) => text(a));

/** Confirma o diálogo de efeito aberto (botão com `data-role="confirm"`). */
async function confirmDialog(app: BootedApp): Promise<void> {
  const dialog = pick<HTMLDialogElement>(app.root, 'app-dialog-host dialog');
  pick<HTMLButtonElement>(dialog, '[data-role="confirm"]').click();
  await settle(app.fixture);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await settle(app.fixture);
}

describe('M13 Governança: POPs (SCR-M13-01 e 02, AC-M13-01 e 02)', () => {
  it('a biblioteca mostra POP-01 a POP-10 com os responsáveis do Quadro 11 e os estados do seed', async () => {
    const app = await open('u1', '/app/governanca/pops');
    const rows = pickAll(app.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(rows).toHaveLength(10);
    const byCode = (code: string): string => rows.find((r) => r.includes(code)) as string;
    expect(byCode('POP-01')).toContain('Gestão');
    expect(byCode('POP-04')).toContain('Gestão e responsável técnico');
    expect(byCode('POP-05')).toContain('Responsável técnico');
    expect(byCode('POP-07')).toContain('Responsável técnico');
    expect(byCode('POP-09')).toContain('Responsável técnico');
    // AC-M13-02: POP-02 e POP-06 a revisar, POP-08 com revisão acionada, o resto em dia.
    expect(byCode('POP-02')).toContain('A revisar');
    expect(byCode('POP-06')).toContain('A revisar');
    expect(byCode('POP-08')).toContain('Revisão acionada');
    for (const code of ['POP-01', 'POP-03', 'POP-04', 'POP-05', 'POP-07', 'POP-09', 'POP-10']) {
      expect(byCode(code)).toContain('Em dia');
    }
  });

  it('o filtro "a revisar" fica na URL e mostra só os 3 que pedem revisão', async () => {
    const app = await open('u1', '/app/governanca/pops?filtro=a-revisar');
    const rows = pickAll(app.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(rows).toHaveLength(3);
    expect(rows.join(' ')).toContain('POP-02');
    expect(rows.join(' ')).toContain('POP-08');
  });

  it('cada POP tem os 7 campos fixos, inclusive POP-05 e POP-07', async () => {
    for (const code of ['POP-05', 'POP-07', 'POP-01']) {
      const app = await open('u1', `/app/governanca/pops/${code}`);
      const titles = pickAll(app.root, '[data-role="pop-fields"] .card__title').map((t) => text(t));
      for (const field of [
        'Objetivo',
        'Responsável',
        'Materiais',
        'Passo a passo',
        'Registro exigido',
        'Indicadores',
        'Data da última revisão',
      ]) {
        expect(titles, `${code}: ${field}`).toContain(field);
      }
    }
    const pop07 = await open('u1', '/app/governanca/pops/POP-07');
    expect(text(pick(pop07.root, '[data-role="reminder"]'))).toContain(
      'Proteger a pessoa idosa sem abandonar quem cuida',
    );
    expect(text(pick(pop07.root, '[data-role="authorities"]'))).toContain('Disque 100');
    const pop05 = await open('u1', '/app/governanca/pops/POP-05');
    expect(text(pick(pop05.root, '[data-role="triggers"]'))).toContain('Alerta vermelho da Zarit');
  });

  it('registrar revisão: a gestão revisa POP da gestão, a data vira hoje e o desfazer volta o estado', async () => {
    const app = await open('u1', '/app/governanca/pops/POP-02');
    expect(text(pick(app.root, '[data-role="pop-state"]'))).toContain('A revisar');
    pick<HTMLButtonElement>(app.root, '[data-role="review"]').click();
    await settle(app.fixture);
    // Sem texto, o erro aparece em linha e nada é gravado.
    pick<HTMLFormElement>(app.root, '#pop-form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    expect(text(pick(app.root, 'app-drawer'))).toContain('Escreva o que foi revisado');
    typeInto(pick<HTMLTextAreaElement>(app.root, '#pop-note'), 'Revisão anual do credenciamento.');
    pick<HTMLFormElement>(app.root, '#pop-form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    const pop = app.db.pops.find((p) => p.code === 'POP-02');
    expect(pop?.lastReviewedAt).toBe('2026-11-04');
    expect(pop?.reviewState).toBe('up_to_date');
    expect(text(pick(app.root, '[data-role="pop-state"]'))).toContain('Em dia');
    expect(app.db.popReviews.list().filter((r) => r.popCode === 'POP-02').at(-1)?.note).toBe(
      'Revisão anual do credenciamento.',
    );
    expect(app.db.accessLog.list().at(-1)).toMatchObject({ action: 'update', entity: 'pop' });
    // Desfazer pelo toast.
    pick<HTMLButtonElement>(app.root, '.toast__action').click();
    await settle(app.fixture);
    expect(app.db.pops.find((p) => p.code === 'POP-02')?.reviewState).toBe('due');
    expect(text(pick(app.root, '[data-role="pop-state"]'))).toContain('A revisar');
  });

  it('só o RT age nos POPs do RT e só a gestão nos da gestão (RN-POP-14)', async () => {
    const partner = await open('u1', '/app/governanca/pops/POP-05');
    expect(partner.root.querySelector('[data-role="review"]')).toBeNull();
    expect(text(pick(partner.root, '[data-role="blocked-reason"]'))).toContain('responsável técnico');
    const lead = await open('u2', '/app/governanca/pops/POP-05');
    expect(lead.root.querySelector('[data-role="review"]')).not.toBeNull();
    const leadOnManagement = await open('u2', '/app/governanca/pops/POP-02');
    expect(leadOnManagement.root.querySelector('[data-role="review"]')).toBeNull();
    const both = await open('u2', '/app/governanca/pops/POP-04');
    expect(both.root.querySelector('[data-role="review"]')).not.toBeNull();
    const psychologist = await open('u3', '/app/governanca/pops/POP-05');
    expect(psychologist.root.querySelector('[data-role="review"]')).toBeNull();
    expect(psychologist.root.querySelector('[data-role="trigger"]')).toBeNull();
    expect(psychologist.router.url).toBe('/app/governanca/pops/POP-05');
    // O serviço também recusa, mesmo sem botão.
    const refused = TestBed.inject(GovernanceService).reviewPop('POP-05', 'tentativa de revisar sem ser o RT');
    expect(refused.ok).toBe(false);
  });

  it('acionar a revisão põe o POP em "Revisão acionada" até a próxima revisão', async () => {
    const app = await open('u2', '/app/governanca/pops/POP-05');
    pick<HTMLButtonElement>(app.root, '[data-role="trigger"]').click();
    await settle(app.fixture);
    typeInto(pick<HTMLTextAreaElement>(app.root, '#pop-note'), 'Passo 2 sem responsável claro no plantão.');
    pick<HTMLFormElement>(app.root, '#pop-form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    expect(app.db.pops.find((p) => p.code === 'POP-05')?.reviewState).toBe('revision_triggered');
    expect(text(pick(app.root, '[data-role="pop-state"]'))).toContain('Revisão acionada');
  });

  it('registrar a própria ciência vale uma vez por pessoa', async () => {
    const app = await open('u7', '/app/governanca/pops/POP-08');
    pick<HTMLButtonElement>(app.root, '[data-role="acknowledge"]').click();
    await settle(app.fixture);
    expect(app.db.popAcknowledgements.list().filter((a) => a.popCode === 'POP-08' && a.personType === 'user')).toHaveLength(1);
    expect(app.root.querySelector('[data-role="own-ack"]')).not.toBeNull();
    expect(TestBed.inject(GovernanceService).acknowledge('POP-08').ok).toBe(false);
  });

  it('POP que não existe mostra a mensagem, sem erro de tela', async () => {
    const app = await open('u1', '/app/governanca/pops/POP-99');
    expect(main(app)).toContain('Não encontramos este POP');
  });
});

describe('M13 Governança: riscos (SCR-M13-03 e 04, AC-M13-03 e 04)', () => {
  it('R1 (4x5=20) no topo, 8 prioritários e 4 não, e a matriz 5x5 posiciona cada risco', async () => {
    const app = await open('u1', '/app/governanca/riscos');
    const rows = pickAll(app.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(rows).toHaveLength(12);
    expect(rows[0]).toContain('R1');
    expect(rows[0]).toContain('20');
    expect(rows.filter((r) => r.includes('Prioritário'))).toHaveLength(8);
    expect(rows.filter((r) => r.includes('Acompanhamento'))).toHaveLength(4);
    const cells = pickAll(app.root, 'app-heat-matrix .heat__cell');
    expect(cells).toHaveLength(25);
    const cellOf = (p: number, i: number): Element => cells[(5 - p) * 5 + (i - 1)] as Element;
    expect(text(cellOf(4, 5))).toContain('R1');
    expect(text(cellOf(4, 5))).toContain('20');
    expect(text(cellOf(2, 5))).toContain('R9');
    expect(text(cellOf(2, 5))).toContain('R10');
    expect(text(cellOf(3, 3))).toContain('R11');
  });

  it('mudar P de R9 de 2 para 5 muda C para 25 e o move a prioritário, no topo do registro', async () => {
    const app = await open('u1', '/app/governanca/riscos/R9');
    expect(text(pick(app.root, '[data-role="risk-level"]'))).toContain('Criticidade 10');
    expect(text(pick(app.root, '[data-role="risk-level"]'))).toContain('Acompanhamento');
    const select = pick<HTMLSelectElement>(app.root, '#risk-p');
    select.value = select.options[4]?.value as string;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(app.fixture);
    expect(text(pick(app.root, '[data-role="risk-level"]'))).toContain('Criticidade 25');
    expect(text(pick(app.root, '[data-role="risk-level"]'))).toContain('Prioritário');
    expect(text(pick(app.root, '[data-role="formula"]'))).toContain('5 x 5');
    pick<HTMLButtonElement>(app.root, '[data-role="save"]').click();
    pick<HTMLFormElement>(app.root, 'form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    expect(app.db.risks.find((r) => r.code === 'R9')?.probability).toBe(5);
    expect(app.db.accessLog.list().at(-1)).toMatchObject({ action: 'update', entity: 'risk' });
    await app.router.navigateByUrl('/app/governanca/riscos');
    await settle(app.fixture);
    const rows = pickAll(app.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(rows[0]).toContain('R9');
    expect(rows[0]).toContain('25');
    expect(rows.filter((r) => r.includes('Prioritário'))).toHaveLength(9);
  });

  it('prioritário sem plano de tratamento não salva; o controle do sistema leva à tela certa', async () => {
    const app = await open('u2', '/app/governanca/riscos/R4');
    typeInto(pick<HTMLTextAreaElement>(app.root, '#risk-treatment'), '');
    pick<HTMLFormElement>(app.root, 'form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    expect(main(app)).toContain('Risco prioritário precisa de plano de tratamento');
    const links = pickAll<HTMLAnchorElement>(app.root, '[data-role="controls"] a').map((a) => a.getAttribute('href'));
    expect(links).toContain('/app/governanca');
  });

  it('psicólogo e atendimento leem o risco, sem editar', async () => {
    for (const userId of ['u3', 'u7']) {
      const app = await open(userId, '/app/governanca/riscos/R1');
      expect(app.router.url).toBe('/app/governanca/riscos/R1');
      expect(app.root.querySelector('[data-role="save"]')).toBeNull();
      expect(app.root.querySelector('[data-role="read-only"]')).not.toBeNull();
    }
  });
});

describe('M13 Governança: encaminhamentos (SCR-M13-05 e 06, AC-M13-05 e 09)', () => {
  it('o quadro reproduz as 7 linhas do Quadro 12 com observações', async () => {
    const app = await open('u2', '/app/governanca/encaminhamentos');
    const rows = pickAll(app.root, '[data-role="quadro-12"] tbody tr').map((r) => text(r));
    expect(rows).toHaveLength(7);
    expect(rows[1]).toContain('Rede de urgência em saúde mental; CVV (188)');
    expect(rows[1]).toContain('Conforme POP-05');
    expect(rows[3]).toContain('CREAS; Disque 100; Delegacia especializada; Ministério Público; Conselho Municipal da Pessoa Idosa');
    expect(rows[3]).toContain('conforme POP-07');
    expect(rows[5]).toContain('Comunicação imediata à família');
  });

  it('registrar por risco de suicídio mostra os destinos e o lembrete de POP-05 e grava', async () => {
    const app = await open('u2', '/app/governanca/encaminhamentos');
    pick<HTMLButtonElement>(app.root, '[data-role="new"]').click();
    await settle(app.fixture);
    const category = pick<HTMLSelectElement>(app.root, '#ref-category');
    category.value = 'severe_distress_or_suicide_risk';
    category.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(app.fixture);
    const destinations = pickAll(app.root, '[data-role="destinations"] label').map((l) => text(l));
    expect(destinations).toEqual(['Rede de urgência em saúde mental', 'CVV (188)']);
    expect(text(pick(app.root, '[data-role="reminder"]'))).toContain('Conforme POP-05');
    // Sem código nem destino, a validação fala em linha.
    pick<HTMLFormElement>(app.root, '#referral-form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    expect(text(pick(app.root, 'app-drawer'))).toContain('Informe o código do cuidador');
    expect(text(pick(app.root, 'app-drawer'))).toContain('Escolha ao menos um destino');
    // Preenche e registra.
    typeInto(pick<HTMLInputElement>(app.root, '#ref-code'), 'cui-0004');
    pickAll<HTMLInputElement>(app.root, '[data-role="destinations"] input')[1]?.click();
    await settle(app.fixture);
    const before = app.db.referrals.size();
    pick<HTMLFormElement>(app.root, '#referral-form').dispatchEvent(new Event('submit'));
    await settle(app.fixture);
    expect(app.db.referrals.size()).toBe(before + 1);
    const created = app.db.referrals.list().at(-1);
    expect(created).toMatchObject({
      caregiverId: 'cg_0004',
      category: 'severe_distress_or_suicide_risk',
      destinations: ['CVV (188)'],
      status: 'registered',
    });
    expect(app.db.accessLog.list().at(-1)).toMatchObject({ action: 'create', entity: 'referral', subjectCaregiverId: 'cg_0004' });
  });

  it('agravamento clínico exige marcar "família comunicada"', async () => {
    const app = await open('u2', '/app/governanca/encaminhamentos');
    const service = TestBed.inject(GovernanceService);
    const refused = service.createReferral({
      caregiverCode: 'CUI-0004',
      category: 'elder_clinical_worsening',
      destinations: ['UBS de referência'],
      date: '2026-11-04',
    });
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain('família');
    expect(
      service.createReferral({
        caregiverCode: 'CUI-0004',
        category: 'elder_clinical_worsening',
        destinations: ['UBS de referência'],
        date: '2026-11-04',
        familyCommunicated: true,
      }).ok,
    ).toBe(true);
    // Destino de outra categoria é recusado.
    expect(
      service.createReferral({
        caregiverCode: 'CUI-0004',
        category: 'social_vulnerability',
        destinations: ['CVV (188)'],
        date: '2026-11-04',
      }).ok,
    ).toBe(false);
    await settle(app.fixture);
  });

  it('a gestão vê só o total das categorias de risco e violência, e o resto só por código', async () => {
    const app = await open('u1', '/app/governanca/encaminhamentos');
    const t = main(app);
    expect(text(pick(app.root, '[data-role="restricted"]'))).toContain('Sofrimento psíquico grave ou risco de suicídio: 1');
    expect(text(pick(app.root, '[data-role="restricted"]'))).toContain('Violação de direitos, violência ou negligência: 1');
    const rows = pickAll(app.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(rows).toHaveLength(8);
    expect(rows.join(' ')).not.toContain('Disque 100');
    expect(rows.join(' ')).not.toContain('CVV');
    expect(t).not.toMatch(/Ana Paula|Eliane|Vanessa/);
    expect(rows.join(' ')).toMatch(/CUI-0003/);
  });

  it('o atendimento não vê encaminhamento clínico, nem que existe; o psicólogo vê só os seus casos', async () => {
    const support = await open('u7', '/app/governanca/encaminhamentos');
    const supportRows = pickAll(support.root, 'app-data-table tbody tr').map((r) => text(r));
    expect(supportRows.length).toBeGreaterThan(0);
    expect(supportRows.join(' ')).not.toMatch(/psiqui|urgência|CAPS|CREAS|Disque|UBS/i);
    expect(support.root.querySelector('[data-role="restricted"]')).toBeNull();
    expect(support.root.querySelector('[data-role="new"]')).toBeNull();
    const psy = await open('u3', '/app/governanca/encaminhamentos');
    const psyCodes = pickAll(psy.root, 'app-data-table tbody tr').map((r) => text(r).match(/CUI-\d{4}/)?.[0]);
    // Rafael: C03 (CAPS), C24 (CRAS) e C05 (clínica-escola).
    expect([...psyCodes].sort()).toEqual(['CUI-0003', 'CUI-0005', 'CUI-0024']);
  });

  it('registrar o retorno e encerrar passam pelos estados do fluxo', async () => {
    const app = await open('u2', '/app/governanca/encaminhamentos');
    const service = TestBed.inject(GovernanceService);
    const registered = app.db.referrals.find((r) => r.status === 'registered' && r.category === 'social_vulnerability');
    const id = (registered as { id: string }).id;
    expect(service.registerReferralReturn(id, '').ok).toBe(false);
    expect(service.registerReferralReturn(id, 'CRAS atendeu a família.').ok).toBe(true);
    expect(app.db.referrals.get(id)?.status).toBe('acknowledged');
    expect(service.closeReferral(id).ok).toBe(true);
    expect(app.db.referrals.get(id)?.status).toBe('closed');
  });
});
