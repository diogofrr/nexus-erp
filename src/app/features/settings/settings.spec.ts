import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Clock } from '../../core/clock/clock.service';
import { dsrDeadlineState } from '../../core/rules/lgpd';
import { redAlertState } from '../../core/rules/pop05';
import { zaritAssessmentState } from '../../core/rules/zarit';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { UiPrefsService } from '../../shared/ui/overlay/ui-prefs.service';
import { DemoDataService, IMPORT_REFUSED_TEXT } from './state/demo-data.service';
import { CLOCK_DATE_ERROR, parseBrDate } from './pages/clock.page';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};

const typeInto = (input: HTMLInputElement | null, value: string): void => {
  if (!input) {
    throw new Error('campo não encontrado');
  }
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
};

describe('configurações: acesso por perfil (AC-M15-08)', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));

  it('a sócia vê as 8 áreas e as preferências; tema e "Preencher com exemplo" ficam no repositório', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes' });
    const areas = all('[data-role="areas"] a').map((a) => a.getAttribute('data-area'));
    expect(areas.sort()).toEqual([
      'arbe',
      'conteudos',
      'dados',
      'parametros',
      'relogio',
      'sobre',
      'suposicoes',
      'usuarios',
    ]);
    click(q('[data-role="theme-dark"]'));
    await settle(app.fixture);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(app.local.getItem('nexus-erp:ui-prefs')).toContain('"theme":"dark"');
    const fill = q<HTMLInputElement>('[data-role="fill-example"]') as HTMLInputElement;
    expect(fill.checked).toBe(true);
    click(fill);
    await settle(app.fixture);
    expect(TestBed.inject(UiPrefsService).fillWithExample()).toBe(false);
    document.documentElement.removeAttribute('data-theme');
  });

  it('o responsável técnico vê só ARBE e conteúdos e é barrado nas demais, com denied no log', async () => {
    app = await bootApp({ userId: 'u2', url: '/app/configuracoes' });
    expect(
      all('[data-role="areas"] a')
        .map((a) => a.getAttribute('data-area'))
        .sort(),
    ).toEqual(['arbe', 'conteudos']);
    const before = app.db.accessLog.size();
    for (const area of ['dados', 'relogio', 'parametros', 'usuarios', 'suposicoes', 'sobre']) {
      await app.router.navigateByUrl(`/app/configuracoes/${area}`);
      await settle(app.fixture);
      expect(app.router.url, area).toBe('/403');
    }
    expect(
      app.db.accessLog
        .list()
        .slice(before)
        .filter((e) => e.action === 'denied'),
    ).toHaveLength(6);
    await app.router.navigateByUrl('/app/configuracoes/arbe');
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/configuracoes/arbe');
    await app.router.navigateByUrl('/app/configuracoes/conteudos');
    await settle(app.fixture);
    expect(app.router.url).toBe('/app/configuracoes/conteudos');
  });

  it('atendimento e psicólogo não abrem Configurações', async () => {
    for (const userId of ['u7', 'u3']) {
      TestBed.resetTestingModule();
      app = await bootApp({ userId, url: '/app/configuracoes' });
      expect(app.router.url, userId).toBe('/403');
    }
  });
});

describe('dados de demonstração (SCR-M15-01, AC-M15-01 a 03)', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const dialog = (): HTMLDialogElement =>
    app.root.querySelector('app-dialog-host dialog') as HTMLDialogElement;
  const counts = (): string => q('[data-role="counts"]')?.textContent?.replace(/\s+/g, ' ') ?? '';
  /** Quantidade mostrada na tela para um rótulo ("cuidadores" resulta 340). */
  const count = (label: string): number =>
    Number(new RegExp(`${label}\\s*(\\d+)`).exec(counts())?.[1] ?? Number.NaN);

  it('resetar devolve exatamente o seed e mantém a sessão e o relógio simulado (U-12)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/dados' });
    app.clock.setSimulated('2026-11-12');
    expect(count('cuidadores')).toBe(340);
    // Muda e apaga coisas.
    app.db.caregivers.update('cg_0001', { fullName: 'Alterada Para Teste' });
    app.db.caregivers.remove('cg_0340');
    app.db.providers.remove('prv_20');
    app.db.careSessions.removeWhere(() => true);
    await settle(app.fixture);
    expect(count('cuidadores')).toBe(339);

    TestBed.inject(DemoDataService).reset();
    await settle(app.fixture);
    expect(app.db.caregivers.size()).toBe(340);
    expect(app.db.providers.size()).toBe(20);
    expect(app.db.careSessions.size()).toBe(60);
    expect(app.db.caregivers.get('cg_0001')?.fullName).toBe('Ana Paula Ferraz');
    expect(count('cuidadores')).toBe(340);
    expect(count('prestadores')).toBe(20);
    expect(count('sessões de atendimento')).toBe(60);
    // Mantém o usuário conectado e o relógio.
    expect(app.auth.isAuthenticated()).toBe(true);
    expect(app.auth.user()?.id).toBe('u1');
    expect(TestBed.inject(Clock).simulatedDate()).toBe('2026-11-12');
    // O seed é gerado para a data simulada e o log recomeça com o registro do reset.
    expect(app.db.demoState()?.seededForToday).toBe('2026-11-12');
    expect(app.db.accessLog.list().at(-1)).toMatchObject({ action: 'update', entity: 'demo_data' });
  });

  it('o botão abre o diálogo de efeito com foco em Cancelar, caixa "Baixar uma cópia antes" marcada e mostra o progresso', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/dados' });
    app.db.caregivers.update('cg_0001', { fullName: 'Alterada Para Teste' });
    click(q('[data-role="reset"]'));
    await settle(app.fixture);
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(dialog().querySelector('h2')?.textContent).toBe('Voltar aos dados de demonstração?');
    const body = dialog().textContent ?? '';
    expect(body).toContain('340 cuidadores, 20 prestadores e 60 sessões');
    expect(body).toContain('Sua sessão continua como Helena');
    expect(body).toContain('O relógio simulado (04/11/2026) continua');
    expect(body).toContain('Não dá para desfazer');
    expect((dialog().querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(
      true,
    );
    expect(document.activeElement?.textContent?.trim()).toBe('Voltar');

    // Desmarca a cópia (jsdom não baixa arquivos) e confirma.
    click(dialog().querySelector('input[type="checkbox"]'));
    click(dialog().querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    expect(dialog().querySelector('[data-role="confirm"]')?.getAttribute('aria-busy')).toBe('true');
    expect(dialog().textContent).toContain('Restaurando 340 cuidadores...');
    await new Promise((resolve) => setTimeout(resolve, 120));
    await settle(app.fixture);
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(app.db.caregivers.get('cg_0001')?.fullName).toBe('Ana Paula Ferraz');
    expect(q('.toast')?.textContent).toContain('Dados de demonstração restaurados.');
  });

  it('cancelar não muda nada', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/dados' });
    app.db.caregivers.update('cg_0001', { fullName: 'Alterada Para Teste' });
    click(q('[data-role="reset"]'));
    await settle(app.fixture);
    click(dialog().querySelector('[data-role="cancel"]'));
    await settle(app.fixture);
    expect(app.db.caregivers.get('cg_0001')?.fullName).toBe('Alterada Para Teste');
  });

  it('a cópia exporta todas as entidades e importar o mesmo arquivo restaura o estado (AC-M15-02)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/dados' });
    const demo = TestBed.inject(DemoDataService);
    const copy = demo.buildCopy();
    expect(copy.fileName).toBe('nexus-erp-copia-2026-11-04.json');
    const parsed = JSON.parse(copy.text) as { collections: Record<string, unknown[]> };
    expect(Object.keys(parsed.collections).length).toBeGreaterThan(50);
    expect(parsed.collections['caregivers']).toHaveLength(340);
    expect(app.db.accessLog.list().at(-1)).toMatchObject({ action: 'export', entity: 'demo_data' });

    app.db.caregivers.update('cg_0001', { fullName: 'Alterada Para Teste' });
    app.db.caregivers.remove('cg_0002');
    const preview = demo.preview(copy.text);
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(demo.summary(preview.counts)).toBe(
        '340 cuidadores, 20 prestadores, 60 sessões de atendimento',
      );
    }
    expect(demo.importCopy(copy.text).ok).toBe(true);
    expect(app.db.caregivers.get('cg_0001')?.fullName).toBe('Ana Paula Ferraz');
    expect(app.db.caregivers.size()).toBe(340);
  });

  it('arquivo inválido é recusado sem alterar nada (AC-M15-03): o texto diz "Nada foi alterado"', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/dados' });
    const demo = TestBed.inject(DemoDataService);
    app.db.caregivers.update('cg_0001', { fullName: 'Alterada Para Teste' });
    const before = app.db.exportJson();

    [
      'isto não é json',
      '{"app":"outro"}',
      '[]',
      JSON.stringify({ app: 'nexus-erp', format: 99, schemaVersion: '7', collections: {} }),
    ].forEach((text) => {
      const preview = demo.preview(text);
      expect(preview.ok).toBe(false);
      expect(demo.importCopy(text).ok).toBe(false);
    });
    expect(app.db.exportJson()).toBe(before);

    // Pela tela: escolher um arquivo errado mostra o aviso e não troca os dados.
    const input = q<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
    const file = new File(['{"app":"outro"}'], 'copia.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle(app.fixture);
    expect(q('[data-role="refused"]')?.textContent).toBe(IMPORT_REFUSED_TEXT);
    expect(app.db.caregivers.get('cg_0001')?.fullName).toBe('Alterada Para Teste');
  });

  it('pela tela: escolhe uma cópia válida, vê a prévia e confirma a importação', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/dados' });
    const demo = TestBed.inject(DemoDataService);
    const copy = demo.buildCopy();
    app.db.caregivers.update('cg_0001', { fullName: 'Alterada Para Teste' });
    const input = q<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [new File([copy.text], copy.fileName)],
      configurable: true,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    await settle(app.fixture);
    expect(q('[data-role="preview"]')?.textContent).toContain(
      'Tem 340 cuidadores, 20 prestadores, 60 sessões de atendimento.',
    );
    click(q('[data-role="confirm-import"]'));
    await settle(app.fixture);
    expect(dialog().querySelector('h2')?.textContent).toBe('Importar a cópia?');
    click(dialog().querySelector('[data-role="confirm"]'));
    await new Promise((resolve) => setTimeout(resolve, 120));
    await settle(app.fixture);
    expect(app.db.caregivers.get('cg_0001')?.fullName).toBe('Ana Paula Ferraz');
    expect(q('.toast')?.textContent).toContain('Cópia importada');
  });

  it('apagar tudo: exige digitar APAGAR, limpa as chaves nexus-erp: e volta à entrada com recarga completa', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/dados' });
    click(q('[data-role="erase"]'));
    await settle(app.fixture);
    const confirm = dialog().querySelector<HTMLButtonElement>(
      '[data-role="confirm"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    typeInto(dialog().querySelector('input[type="text"]'), 'APAGAR');
    await settle(app.fixture);
    expect(confirm.disabled).toBe(false);
    click(confirm);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle(app.fixture);
    expect([...app.local.data.keys()].filter((k) => k.startsWith('nexus-erp:'))).toEqual([]);
    expect([...app.session.data.keys()].filter((k) => k.startsWith('nexus-erp:'))).toEqual([]);
    expect(app.hardNavigations).toEqual(['/login']);
    expect(app.auth.isAuthenticated()).toBe(false);
  });
});

describe('relógio simulado (SCR-M15-02, AC-M15-04)', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);

  it('lê datas no formato dd/mm/aaaa e recusa o resto com a frase do catálogo', () => {
    expect(parseBrDate('12/11/2026')).toBe('2026-11-12');
    expect(parseBrDate(' 01/12/2026 ')).toBe('2026-12-01');
    expect(parseBrDate('31/02/2026')).toBeNull();
    expect(parseBrDate('2026-11-12')).toBeNull();
    expect(parseBrDate('')).toBeNull();
  });

  it('"+1 dia", "+7 dias", "+1 mês", data digitada e "Voltar ao relógio real"; o chip e o toast acompanham', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/relogio' });
    expect(q('[data-role="today"]')?.textContent).toBe('04/11/2026');
    click(q('[data-role="plus-1d"]'));
    await settle(app.fixture);
    expect(app.clock.today()).toBe('2026-11-05');
    expect(q('.toast')?.textContent).toContain(
      'Avançou 1 dia. Hoje (simulado) agora é 05/11/2026.',
    );
    click(q('[data-role="plus-7d"]'));
    click(q('[data-role="plus-1m"]'));
    await settle(app.fixture);
    expect(app.clock.today()).toBe('2026-12-12');
    expect(q('.topbar__chip')?.textContent).toContain('Hoje (simulado): 12/12/2026');

    typeInto(q('#nx-clock-date'), '31/13/2026');
    click(q('[data-role="apply"]'));
    await settle(app.fixture);
    expect(q('.field__error')?.textContent).toContain(CLOCK_DATE_ERROR);
    expect(app.clock.today()).toBe('2026-12-12');
    typeInto(q('#nx-clock-date'), '12/11/2026');
    click(q('[data-role="apply"]'));
    await settle(app.fixture);
    expect(app.clock.today()).toBe('2026-11-12');

    click(q('[data-role="real"]'));
    await settle(app.fixture);
    expect(app.clock.isSimulated()).toBe(false);
    expect(q('.topbar__chip')).toBeNull();
    expect(q('[data-role="real"]')?.hasAttribute('disabled')).toBe(true);
  });

  it('avançar 8 dias vence a aplicação da escala, o alerta do dia e a solicitação do titular', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/relogio' });
    const zarit = app.db.zaritAssessments.find(
      (a) => a.caregiverId === 'cg_0015' && a.status === 'scheduled',
    );
    const alert = app.db.zaritAlerts.get('zal_0001');
    const dsr = app.db.dataSubjectRequests.get('dsr_0001');
    expect(zarit && zaritAssessmentState(zarit.dueDate, app.clock.today(), false)).toBe('due');
    expect(alert && redAlertState(alert, app.clock.now())).toBe('open');
    expect(dsr && dsrDeadlineState(dsr, app.clock.today())).toBe('on_time');
    click(q('[data-role="plus-7d"]'));
    click(q('[data-role="plus-1d"]'));
    await settle(app.fixture);
    expect(app.clock.today()).toBe('2026-11-12');
    expect(zarit && zaritAssessmentState(zarit.dueDate, app.clock.today(), false)).toBe('overdue');
    expect(alert && redAlertState(alert, app.clock.now())).toBe('overdue');
    expect(dsr && dsrDeadlineState(dsr, app.clock.today())).toBe('overdue');
  });
});

describe('parâmetros (SCR-M15-03, AC-M15-06 e 07)', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));
  const discountInput = (plan: string): HTMLInputElement =>
    q(`[data-plan="${plan}"] input[type="number"]`) as HTMLInputElement;

  it('mostra os benefícios acumulados por plano (somente leitura) e o desconto de cada um', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/parametros' });
    const names = all('[data-plan] h3').map((h) => h.textContent?.trim());
    expect(names[0]).toContain('Nexus Livre');
    expect(names[3]).toContain('R$ 149,90');
    expect(all('[data-plan="livre"] [data-role="benefits"] li')).toHaveLength(5);
    expect(all('[data-plan="sustenta"] [data-role="benefits"] li')).toHaveLength(15);
    expect(discountInput('cuida').value).toBe('15');
  });

  it('mudar o desconto do Cuida para 25% grava no plano (AC-M15-06) e "Desfazer" devolve o valor', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/parametros' });
    expect(app.db.plans.get('cuida')?.psychSessionDiscountPercent).toBe(15);
    typeInto(discountInput('cuida'), '25');
    click(q('[data-role="save"]'));
    await settle(app.fixture);
    expect(app.db.plans.get('cuida')?.psychSessionDiscountPercent).toBe(25);
    expect(app.db.accessLog.list().at(-1)).toMatchObject({ action: 'update', entity: 'settings' });
    const toast = q('.toast');
    expect(toast?.textContent).toContain('Parâmetros salvos.');
    click(toast?.querySelector('.toast__action'));
    await settle(app.fixture);
    expect(app.db.plans.get('cuida')?.psychSessionDiscountPercent).toBe(15);
    expect(discountInput('cuida').value).toBe('15');
  });

  it('valor fora da faixa mostra a frase do catálogo no campo e no resumo e não grava', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/parametros' });
    typeInto(discountInput('cuida'), '150');
    click(q('[data-role="save"]'));
    await settle(app.fixture);
    expect(q('.field__error')?.textContent).toContain(
      'O desconto deve ser um número inteiro de 0 a 100.',
    );
    expect(q('.error-summary')?.textContent).toContain('Há 1 ponto para corrigir');
    expect(q('.error-summary')?.textContent).toContain(
      'O desconto deve ser um número inteiro de 0 a 100.',
    );
    expect(app.db.plans.get('cuida')?.psychSessionDiscountPercent).toBe(15);
    typeInto(discountInput('cuida'), '');
    click(q('[data-role="save"]'));
    await settle(app.fixture);
    expect(q('.field__error')?.textContent).toContain('Informe o desconto.');
  });

  it('capacidade do grupo, taxa de recusa, prazos e SLA são editáveis e valem na hora', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/parametros' });
    const field = (label: string): HTMLInputElement => {
      const labelEl = all<HTMLLabelElement>('label.field__label').find(
        (l) => l.textContent?.trim() === label,
      );
      return app.root.querySelector<HTMLInputElement>(`#${labelEl?.htmlFor}`) as HTMLInputElement;
    };
    typeInto(field('Capacidade padrão do grupo'), '20');
    typeInto(field('Limiar da taxa de recusa'), '35');
    typeInto(field('Prazo no WhatsApp'), '6');
    click(q('[data-role="save"]'));
    await settle(app.fixture);
    const settings = app.db.settings.get();
    expect(settings.groupDefaultCapacity).toBe(20);
    expect(settings.refusalRateThresholdPercent).toBe(35);
    expect(settings.slaHours.whatsapp).toBe(6);
    // Restaurar padrões só preenche o formulário; grava ao salvar.
    click(q('[data-role="restore"]'));
    await settle(app.fixture);
    expect(app.db.settings.get().groupDefaultCapacity).toBe(20);
    click(q('[data-role="save"]'));
    await settle(app.fixture);
    expect(app.db.settings.get().groupDefaultCapacity).toBe(12);
    expect(app.db.settings.get().refusalRateThresholdPercent).toBe(30);
  });

  it('as regras do documento aparecem somente leitura: mínimo de 5 avaliações, 4,5, 4,0 e as faixas da Zarit (AC-M15-07)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/parametros' });
    const fixed = q('[data-role="fixed-rules"]');
    expect(fixed).not.toBeNull();
    expect(fixed?.querySelectorAll('input, select, textarea')).toHaveLength(0);
    const text = fixed?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('5 avaliações');
    expect(text).toContain('média a partir de 4,5');
    expect(text).toContain('média de 4,0 a menos de 4,5');
    expect(text).toContain('Escala de Zarit, 0 a 20');
    expect(text).toContain('Sobrecarga severa');
    expect(text).toContain('Escala de Zarit, 61 a 88');
  });
});

describe('parâmetros da ARBE (SCR-M15-04)', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const inputs = (): HTMLInputElement[] =>
    Array.from(app.root.querySelectorAll<HTMLInputElement>('input[type="number"]'));

  it('o responsável técnico edita e o valor vale na hora; "Desfazer" devolve', async () => {
    app = await bootApp({ userId: 'u2', url: '/app/configuracoes/arbe' });
    expect(inputs().map((i) => i.value)).toEqual(['8', '3', '30', '41', '61']);
    typeInto(inputs()[0] ?? null, '9');
    click(q('[data-role="save"]'));
    await settle(app.fixture);
    expect(app.db.settings.get().arbe.hoursThreshold).toBe(9);
    click(q('.toast .toast__action'));
    await settle(app.fixture);
    expect(app.db.settings.get().arbe.hoursThreshold).toBe(8);
  });

  it('a pontuação crítica não pode ficar abaixo da do critério e a faixa de cada campo é respeitada', async () => {
    app = await bootApp({ userId: 'u2', url: '/app/configuracoes/arbe' });
    typeInto(inputs()[4] ?? null, '30');
    click(q('[data-role="save"]'));
    await settle(app.fixture);
    expect(q('.field__error')?.textContent).toContain(
      'A pontuação do alerta crítico deve ser igual ou maior que a do critério.',
    );
    expect(app.db.settings.get().arbe.criticalZarit).toBe(61);
    typeInto(inputs()[0] ?? null, '30');
    click(q('[data-role="save"]'));
    await settle(app.fixture);
    expect(q('.error-summary')?.textContent).toContain('Há 2 pontos para corrigir');
    expect(q('.error-summary')?.textContent).toContain(
      'O limite de horas por dia deve ser um número inteiro de 1 a 24.',
    );
  });

  it('a sócia também edita; restaurar padrões volta aos limites do documento (só grava ao salvar)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/arbe' });
    app.db.settings.patch({
      arbe: {
        hoursThreshold: 10,
        supportRequestsThreshold: 5,
        windowDays: 60,
        zaritThreshold: 45,
        criticalZarit: 70,
      },
    });
    TestBed.resetTestingModule();
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/arbe' });
    app.db.settings.patch({
      arbe: {
        hoursThreshold: 10,
        supportRequestsThreshold: 5,
        windowDays: 60,
        zaritThreshold: 45,
        criticalZarit: 70,
      },
    });
    await app.router.navigateByUrl('/app/configuracoes');
    await app.router.navigateByUrl('/app/configuracoes/arbe');
    await settle(app.fixture);
    expect(inputs().map((i) => i.value)).toEqual(['10', '5', '60', '45', '70']);
    click(q('[data-role="restore"]'));
    await settle(app.fixture);
    expect(inputs().map((i) => i.value)).toEqual(['8', '3', '30', '41', '61']);
    expect(app.db.settings.get().arbe.hoursThreshold).toBe(10);
    click(q('[data-role="save"]'));
    await settle(app.fixture);
    expect(app.db.settings.get().arbe).toEqual({
      hoursThreshold: 8,
      supportRequestsThreshold: 3,
      windowDays: 30,
      zaritThreshold: 41,
      criticalZarit: 61,
    });
  });
});

describe('conteúdos, usuários, suposições e sobre', () => {
  let app: BootedApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));
  const dialog = (): HTMLDialogElement =>
    app.root.querySelector('app-dialog-host dialog') as HTMLDialogElement;

  it('só a responsável técnica aprova a publicação de um conteúdo (RN-POP-09)', async () => {
    app = await bootApp({ userId: 'u2', url: '/app/configuracoes/conteudos' });
    const inReview = app.db.guidanceContents.find((c) => c.status === 'in_review');
    expect(inReview).toBeDefined();
    const row = all('tbody tr').find((r) => r.textContent?.includes(inReview?.title ?? '@@'));
    expect(row?.textContent).toContain('Em revisão');
    click(row?.querySelector('[data-role="open"]'));
    await settle(app.fixture);
    click(q('[data-role="approve"]'));
    await settle(app.fixture);
    expect(dialog().querySelector('h2')?.textContent).toContain('Aprovar e publicar');
    click(dialog().querySelector('[data-role="confirm"]'));
    await settle(app.fixture);
    const published = app.db.guidanceContents.get(inReview?.id ?? '');
    expect(published).toMatchObject({
      status: 'published',
      approvedByUserId: 'u2',
      approvedAt: '2026-11-04',
    });

    // A sócia edita, mas não vê o botão de aprovar.
    TestBed.resetTestingModule();
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/conteudos' });
    const another = app.db.guidanceContents.find((c) => c.status === 'in_review');
    if (another) {
      const r = all('tbody tr').find((x) => x.textContent?.includes(another.title));
      click(r?.querySelector('[data-role="open"]'));
      await settle(app.fixture);
      expect(q('[data-role="approve"]')).toBeNull();
    }
  });

  it('cria um conteúdo em rascunho e o envia para revisão; título e texto são obrigatórios', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/conteudos' });
    const before = app.db.guidanceContents.size();
    click(q('[data-role="new"]'));
    await settle(app.fixture);
    click(q('[data-role="save-draft"]'));
    await settle(app.fixture);
    expect(q('.field__error')?.textContent).toContain('Informe o título do conteúdo.');
    expect(app.db.guidanceContents.size()).toBe(before);
    typeInto(q('#nx-content-title'), 'Como organizar a semana de cuidados');
    typeInto(
      q('#nx-content-body'),
      'Comece pelas tarefas que só você pode fazer e peça apoio para as demais.',
    );
    click(q('[data-role="send-review"]'));
    await settle(app.fixture);
    expect(app.db.guidanceContents.size()).toBe(before + 1);
    expect(app.db.guidanceContents.list().at(-1)).toMatchObject({
      title: 'Como organizar a semana de cuidados',
      status: 'in_review',
    });
  });

  it('usuários de demonstração: os 8 da equipe, com perfil, acesso e quem está conectado', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/usuarios' });
    const rows = all('tbody tr');
    expect(rows).toHaveLength(8);
    expect(rows.filter((r) => r.textContent?.includes('Conectado'))).toHaveLength(1);
    expect(rows[7]?.textContent).toContain('Atendimento/Relacionamento');
    expect(rows[7]?.textContent).toContain('Exige código');
    expect(rows.some((r) => r.textContent?.includes('Profissional credenciado'))).toBe(false);
  });

  it('suposições: cada uma com valor padrão e atual; o que mudou aparece como "Alterada" (AC-M15-09)', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/suposicoes' });
    app.clock.resetToReal();
    await settle(app.fixture);
    const editable = all('[data-role="editable"] tbody tr');
    expect(editable.length).toBeGreaterThan(20);
    editable.forEach((r) => {
      expect(r.querySelectorAll('td')).toHaveLength(5);
      expect(r.getAttribute('data-state')).toBe('default');
    });
    app.db.plans.update('cuida', { psychSessionDiscountPercent: 25 });
    app.db.settings.patch({ groupDefaultCapacity: 20 });
    await settle(app.fixture);
    const changed = all('[data-role="editable"] tbody tr[data-state="changed"]');
    expect(changed.map((r) => r.textContent?.replace(/\s+/g, ' '))).toEqual([
      expect.stringContaining('Desconto na sessão com psicólogo, plano Nexus Cuida15%25%Alterada'),
      expect.stringContaining('Capacidade padrão do grupo12 vagas20 vagasAlterada'),
    ]);
    expect(all('[data-role="fixed"] tbody tr').length).toBeGreaterThanOrEqual(8);
  });

  it('sobre: versão e aviso de protótipo', async () => {
    app = await bootApp({ userId: 'u1', url: '/app/configuracoes/sobre' });
    expect(q('h1')?.textContent).toBe('Sobre o protótipo');
    expect(q('.dl')?.textContent).toContain('0.1.0');
  });
});
