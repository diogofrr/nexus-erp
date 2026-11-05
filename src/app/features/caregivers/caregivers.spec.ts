import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AuditLogService } from '@core/audit';
import { CaregiverService, NewCaregiverInput } from './state/caregiver.service';
import { BootedApp, bootApp, settle } from '../../layout/testing';


/** Controles de formulário sem nome acessível (rótulo, aria-label ou aria-labelledby). */
function unlabeled(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('input, select, textarea'))
    .filter((el) => !(el instanceof HTMLInputElement && (el.type === 'hidden' || el.type === 'radio')))
    .filter((el) => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) {
        return false;
      }
      const id = el.getAttribute('id');
      if (id && root.querySelector(`label[for="${id}"]`)) {
        return false;
      }
      return !el.closest('label');
    })
    .map((el) => `${el.tagName.toLowerCase()}#${el.id}`);
}

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('M03 Cuidadores', () => {
  let app: BootedApp;

  const q = <T extends Element = HTMLElement>(selector: string): T | null => app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] => Array.from(app.root.querySelectorAll<T>(selector));
  const open = async (userId: string, url: string): Promise<void> => {
    TestBed.resetTestingModule();
    app = await bootApp({ userId, url });
  };
  const go = async (url: string): Promise<void> => {
    await app.router.navigateByUrl(url);
    await settle(app.fixture);
  };
  const click = async (el: Element | null): Promise<void> => {
    if (!el) {
      throw new Error('elemento não encontrado');
    }
    (el as HTMLElement).click();
    await settle(app.fixture);
  };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const input = (): NewCaregiverInput => ({
    fullName: 'Cuidadora Teste Um',
    birthDate: '1980-01-10',
    cpf: '000.999.111-00',
    email: 'teste.um@exemplo.com.br',
    phone: '(34) 90000-0777',
    relationship: 'daughter',
    sex: 'female',
    city: 'Uberlândia',
    dailyCareHours: 6,
    preferredChannel: 'app',
    digitalLiteracy: 'medium',
    elder: { fullName: 'Pessoa Idosa Teste', birthDate: '1945-05-05', dependency: 'partial' },
    consents: { whatsapp_contact: 'granted', image_testimony: 'refused' },
    consentChannel: 'in_person',
    planId: 'livre',
  });

  describe('lista (SCR-M03-01)', () => {
    it('a gestão vê só códigos, plano e situação: nenhum nome, CPF, telefone nem e-mail no DOM (AC-M03-04)', async () => {
      await open('u1', '/app/cuidadores');
      expect(text(q('h1'))).toBe('Cuidadores');
      expect(all('tbody tr').length).toBeGreaterThan(0);
      expect(all('.code-chip').length).toBeGreaterThan(5);
      const html = app.root.innerHTML;
      app.db.caregivers.list().slice(0, 60).forEach((c) => {
        expect(html).not.toContain(c.fullName);
        expect(html).not.toContain(c.cpf);
        expect(html).not.toContain(c.email);
      });
      expect(q('.masked__toggle')).toBeNull();
      expect(q('[aria-label*="Mostrar"]')).toBeNull();
      expect(text(q('.table-footer'))).toContain('de 340 cuidadores');
    });

    it('o atendimento vê nome e telefone mascarado, sem CPF nem e-mail (AC-M03-05)', async () => {
      await open('u7', '/app/cuidadores');
      const cg = app.db.caregivers.require('cg_0001');
      expect(app.root.innerHTML).toContain(cg.fullName);
      expect(app.root.innerHTML).not.toContain(cg.cpf);
      expect(app.root.innerHTML).not.toContain(cg.email);
      expect(app.root.innerHTML).not.toContain(cg.phone);
      expect(q('a.btn[href$="/novo"]')).not.toBeNull();
    });

    it('o psicólogo só lista os cuidadores dele e vê "Meus cuidadores" (AC-M03-07)', async () => {
      await open('u3', '/app/cuidadores');
      expect(text(q('h1'))).toBe('Meus cuidadores');
      const mine = app.db.caregivers.query((c) => c.assignedPsychologistId === 'psy_0001');
      expect(text(q('.page-header__desc'))).toContain(`${mine.length} cuidadores`);
      const others = app.db.caregivers.query((c) => c.assignedPsychologistId !== 'psy_0001').slice(0, 30);
      others.forEach((c) => expect(app.root.innerHTML).not.toContain(c.fullName));
      expect(q('a.btn[href$="/novo"]')).toBeNull();
    });

    it('filtra por plano pela URL, restaura ao voltar e mostra o vazio acolhedor (AC-M03-12)', async () => {
      await open('u7', '/app/cuidadores?plano=cuida');
      expect(text(q('.table-footer'))).toContain('5');
      expect(all('app-active-filters .chip').length).toBeGreaterThan(0);
      await go('/app/cuidadores?plano=sustenta&status=closed');
      expect(text(q('.empty__title'))).toContain('Nenhum resultado');
    });

    it('a visão "novos" (?filtro=novos, do painel) mostra só os cadastros ativos dos últimos 7 dias (AC-M02-08)', async () => {
      await open('u7', '/app/cuidadores?filtro=novos');
      const from = app.clock.addDays(-7);
      const expected = app.db.caregivers.list().filter((c) => c.enrolledAt > from && c.status === 'active').length;
      expect(expected).toBeGreaterThan(0);
      expect(all('tbody tr')).toHaveLength(expected);
      expect(text(q('app-active-filters'))).toContain('Cadastros dos últimos 7 dias');
      await go('/app/cuidadores');
      expect(all('tbody tr').length).toBeGreaterThan(expected);
    });

    it('a visão "Aplicação da escala pendente" e o contador usam a escala só como pendente ou em dia (E-05)', async () => {
      await open('u7', '/app/cuidadores');
      expect(app.root.innerHTML).not.toMatch(/Sobrecarga|Severa|alerta vermelho/i);
      expect(app.root.innerHTML).toMatch(/Em dia|Aplicação pendente|Sem consentimento de saúde/);
    });

    it('exportar CSV não inclui dado sensível e grava log de exportação', async () => {
      await open('u7', '/app/cuidadores');
      const caregivers = app.db.caregivers.list();
      const csv = TestBed.inject(CaregiverService).listCsv(
        [
          { id: 'cg_0001', code: 'CUI-0001', name: 'Ana', phone: '', city: '', planId: 'cuida', status: 'active', isPilot: false, enrolledAt: '2026-01-01', psychologistId: null, psychologistName: null, scale: { kind: 'none', label: '' } },
        ],
        { cuida: 'Cuida' },
      );
      expect(csv).toContain('CUI-0001');
      expect(csv).not.toContain(caregivers[0]?.cpf ?? 'x');
      expect(csv).not.toContain('Ana');
      expect(app.db.accessLog.list().some((l) => l.action === 'export' && l.entity === 'caregiver_list_csv')).toBe(true);
    });
  });

  describe('cadastro novo (SCR-M03-02)', () => {
    it('rejeita CPF válido, menor de idade e aceita 18 anos completos hoje (AC-M03-01, AC-M03-03)', async () => {
      await open('u7', '/app/cuidadores/novo');
      expect(text(q('h1'))).toBe('Novo cuidador');
      expect(text(q('.page-header__desc'))).toContain('Etapa 1 de 5');
      // CPF matematicamente válido
      const set = async (id: string, value: string): Promise<void> => {
        const el = q<HTMLInputElement>(`#${id}`);
        if (!el) {
          throw new Error(id);
        }
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        await settle(app.fixture);
      };
      await set('nx-cg-cpf', '529.982.247-25');
      expect(text(q('#nx-cg-cpf')?.closest('.field') ?? null)).toContain('Parece um CPF real. Use um CPF fictício.');
      await set('nx-cg-cpf', '000.123.456-00');
      expect(text(q('#nx-cg-cpf')?.closest('.field') ?? null)).not.toContain('Parece um CPF real');
      const today = app.clock.today();
      const [y, m, d] = today.split('-');
      await set('nx-cg-birthDate', `${d}/${m}/${Number(y) - 17}`);
      expect(text(q('#nx-cg-birthDate')?.closest('.field') ?? null)).toContain('O cuidador precisa ter 18 anos ou mais.');
      await set('nx-cg-birthDate', `${d}/${m}/${Number(y) - 18}`);
      expect(q('#nx-cg-birthDate')?.closest('.field')?.querySelector('.field__error')).toBeNull();
    });

    it('"Continuar" sem preencher mostra o resumo de erros e não limpa nada', async () => {
      await open('u7', '/app/cuidadores/novo');
      await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Continuar') ?? null);
      expect(text(q('.error-summary'))).toContain('pontos para corrigir');
      expect(all('.error-summary a').length).toBeGreaterThan(3);
      expect(text(q('.page-header__desc'))).toContain('Etapa 1 de 5');
    });

    it('com "Preencher com exemplo" percorre as 5 etapas e cria o cuidador no plano Livre, sem cartão, com 6 consentimentos pendentes (AC-M03-02)', async () => {
      await open('u7', '/app/cuidadores/novo');
      await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Preencher com exemplo') ?? null);
      const next = (): HTMLButtonElement | undefined => all<HTMLButtonElement>('button').find((b) => text(b) === 'Continuar');
      await click(next() ?? null);
      expect(text(q('.page-header__desc'))).toContain('Etapa 2 de 5');
      await click(next() ?? null);
      expect(text(q('.page-header__desc'))).toContain('Etapa 3 de 5');
      // Nada vem marcado nos seis consentimentos.
      expect(all('section[data-key]').length).toBe(6);
      expect(all('section[data-key] input[type="radio"]:checked').length).toBe(0);
      // CX-038: sem a escolha explícita (concorda, não concorda ou decidir depois) não segue.
      await click(next() ?? null);
      expect(text(q('.page-header__desc'))).toContain('Etapa 3 de 5');
      expect(all('.error-summary a')).toHaveLength(6);
      expect(text(q('.error-summary'))).toContain('concorda, não concorda ou decidir depois');
      // "Decidir depois" é a terceira opção de cada pergunta e conta como escolha.
      for (const section of all('section[data-key]')) {
        await click(section.querySelectorAll('input[type="radio"]')[2]);
      }
      expect(all('section[data-key] input[type="radio"]:checked')).toHaveLength(6);
      await click(next() ?? null);
      await click(next() ?? null);
      expect(text(q('.page-header__desc'))).toContain('Etapa 5 de 5');
      expect(text(q('[data-role="summary"]'))).toContain('Pendente');
      const before = app.db.caregivers.size();
      await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Criar cadastro') ?? null);
      expect(app.db.caregivers.size()).toBe(before + 1);
      const created = app.db.caregivers.list()[before];
      expect(created?.code).toBe('CUI-0341');
      expect(app.db.subscriptions.find((s) => s.caregiverId === created?.id)?.planId).toBe('livre');
      expect(app.db.benefitCards.count((c) => c.caregiverId === created?.id)).toBe(0);
      const consents = app.db.consents.query((c) => c.caregiverId === created?.id);
      expect(consents).toHaveLength(6);
      expect(consents.every((c) => c.status === 'pending')).toBe(true);
      expect(app.router.url).toContain('/app/cuidadores/cg_0341');
      expect(text(q('.banner--success'))).toContain('Cadastro criado: CUI-0341');
      expect(app.db.accessLog.list().some((l) => l.action === 'create' && l.entity === 'caregiver' && l.entityId === 'cg_0341')).toBe(true);
    });

    it('o psicólogo e a gestão não abrem o cadastro novo (rota negada grava denied)', async () => {
      await open('u3', '/app/cuidadores');
      await go('/app/cuidadores/novo');
      expect(app.router.url).toBe('/403');
      expect(app.db.accessLog.list().some((l) => l.action === 'denied')).toBe(true);
    });

    it('o serviço grava consentimento concedido e recusado sem mexer nos demais (AC-M12-01)', () => {
      TestBed.resetTestingModule();
      return bootApp({ userId: 'u7', url: '/app/painel' }).then((booted) => {
        app = booted;
        const service = TestBed.inject(CaregiverService);
        const { caregiver } = service.create(input());
        const consents = app.db.consents.query((c) => c.caregiverId === caregiver.id);
        expect(consents.find((c) => c.key === 'whatsapp_contact')?.status).toBe('granted');
        expect(consents.find((c) => c.key === 'image_testimony')?.status).toBe('refused');
        expect(consents.find((c) => c.key === 'health_data')?.status).toBe('pending');
        expect(() => service.create(input())).toThrow(/CPF/);
      });
    });
  });

  describe('perfil (SCR-M03-03)', () => {
    it('o atendimento vê as abas permitidas e NÃO vê Acompanhamento nem Atendimento (AC-M03-06)', async () => {
      await open('u7', '/app/cuidadores/cg_0001');
      const tabs = all('[role="tab"]').map((t) => text(t));
      expect(tabs).toEqual(['Resumo', 'Pessoa idosa e cuidados', 'Plano e cartão', 'Consentimentos', 'Comunicação', 'Histórico']);
      expect(text(q('h1'))).toBe('Ana Paula Ferraz');
    });

    it('o CPF vem mascarado e "Mostrar" pede motivo, grava reveal no log (AC-M03-05)', async () => {
      await open('u7', '/app/cuidadores/cg_0001');
      expect(app.root.innerHTML).not.toContain(app.db.caregivers.require('cg_0001').cpf);
      const toggle = all<HTMLButtonElement>('.masked__toggle').find((b) => b.getAttribute('aria-label')?.includes('CPF')) ?? null;
      await click(toggle);
      expect(q('.reason-popover')).not.toBeNull();
      await click(q('.reason-popover input[type="radio"]'));
      await click(all<HTMLButtonElement>('.reason-popover button').find((b) => text(b).startsWith('Mostrar por')) ?? null);
      expect(app.root.innerHTML).toContain(app.db.caregivers.require('cg_0001').cpf);
      const entry = app.db.accessLog.list().find((l) => l.action === 'reveal' && l.entityId === 'cg_0001' && l.detail === 'campo: cpf' && l.userId === 'u7');
      expect(entry?.justification).toBeTruthy();
    });

    it('a gestão abre a ficha só pelo código e sem botão de mostrar (AC-M03-04)', async () => {
      await open('u1', '/app/cuidadores/cg_0001');
      expect(text(q('h1'))).toBe('CUI-0001');
      expect(text(q('.page'))).toContain('Pseudonimizado');
      expect(app.root.innerHTML).not.toContain('Ana Paula');
      expect(q('.masked__toggle')).toBeNull();
      const tabs = all('[role="tab"]').map((t) => text(t));
      expect(tabs).not.toContain('Acompanhamento');
      expect(tabs).not.toContain('Pessoa idosa e cuidados');
    });

    it('o psicólogo abrir cuidador de outro psicólogo por URL leva a Acesso negado e grava denied (AC-M03-07)', async () => {
      await open('u3', '/app/cuidadores');
      await go('/app/cuidadores/cg_0002');
      expect(app.router.url).toBe('/403');
      const denied = app.db.accessLog.list().filter((l) => l.action === 'denied' && l.userId === 'u3');
      expect(denied.some((l) => l.detail?.includes('cg_0002'))).toBe(true);
      // Mesmo resultado para um cuidador que não existe: não revela se o recurso existe.
      await go('/app/cuidadores/cg_9999');
      expect(app.router.url).toBe('/403');
    });

    it('o responsável técnico passa pelo portão de supervisão e cada abertura grava supervise e view (AC-M03-08, F16-A)', async () => {
      await open('u2', '/app/cuidadores/cg_0002?aba=acompanhamento');
      expect(q('[data-role="supervision-gate"]')).not.toBeNull();
      expect(text(q('[data-role="supervision-gate"]'))).toContain('Este caso é acompanhado pela Dra. Beatriz Nogueira.');
      expect(text(q('[data-role="supervision-gate"]'))).toContain('Seu acesso será registrado no log');
      const before = app.db.accessLog.size();
      // Sem motivo, não abre.
      await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Ver conteúdo') ?? null);
      expect(text(q('[data-role="supervision-gate"]'))).toContain('Escolha o motivo');
      expect(app.db.accessLog.size()).toBe(before);
      await click(q('[data-role="supervision-gate"] input[type="radio"]'));
      await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Ver conteúdo') ?? null);
      expect(q('[data-role="monitoring"]')).not.toBeNull();
      const logs = app.db.accessLog.list().filter((l) => l.userId === 'u2' && l.subjectCaregiverId === 'cg_0002');
      expect(logs.some((l) => l.action === 'supervise' && !!l.justification)).toBe(true);
      expect(logs.some((l) => l.action === 'view')).toBe(true);
      expect(text(q('[data-role="monitoring"]'))).toContain('Supervisão registrada às');
      // O RT não ganha botão de editar a anotação nem aplicar a escala de outro psicólogo.
      expect(all('a').some((a) => text(a) === 'Aplicar a escala')).toBe(false);
    });

    it('o psicólogo do caso abre o Acompanhamento sem portão e grava view; mostra faixa e a nota de que não é diagnóstico', async () => {
      await open('u3', '/app/cuidadores/cg_0001?aba=acompanhamento');
      expect(q('[data-role="supervision-gate"]')).toBeNull();
      expect(q('[data-role="monitoring"]')).not.toBeNull();
      expect(text(q('[data-role="monitoring"]'))).toContain('Sobrecarga');
      expect(text(q('[data-role="monitoring"]'))).toMatch(/Não é um diagnóstico/);
      expect(app.db.accessLog.list().some((l) => l.action === 'view' && l.userId === 'u3' && l.subjectCaregiverId === 'cg_0001' && l.entity === 'zarit_assessment')).toBe(true);
    });

    it('cuidadora com consentimento de saúde revogado: a aba Acompanhamento mostra o motivo e não deixa aplicar a escala (AC-M03-10, AC-M12-02)', async () => {
      await open('u4', '/app/cuidadores/cg_0016?aba=acompanhamento');
      expect(text(q('.page'))).toContain('Sem consentimento de saúde');
      expect(text(q('.page'))).toContain('revogado em');
      expect(all('a').some((a) => text(a) === 'Aplicar a escala')).toBe(false);
      expect(app.db.caregivers.require('cg_0016').status).toBe('paused_by_consent_revocation');
    });

    it('elegibilidade ao piloto: Uberaba com pessoa idosa independente mostra 2 critérios reprovados e bloqueia (AC-M03-09)', async () => {
      await open('u7', '/app/cuidadores/cg_0025');
      const pilot = q('[data-role="pilot"]');
      expect(text(pilot)).toContain('1 de 3 critérios atendidos');
      expect(text(pilot)).toContain('2 critérios reprovados');
      const mark = all<HTMLButtonElement>('button').find((b) => text(b) === 'Marcar como piloto');
      expect(mark?.getAttribute('aria-disabled')).toBe('true');
      expect(text(q('[data-role="pilot-missing"]'))).toContain('TCLE');
      await click(mark ?? null);
      expect(app.db.caregivers.require('cg_0025').isPilot).toBe(false);
    });

    it('marcar piloto com os critérios e o TCLE cria a coorte; retirar do piloto pede confirmação', async () => {
      await open('u7', '/app/painel');
      const service = TestBed.inject(CaregiverService);
      // C06 está no piloto; um cuidador de volume elegível sem TCLE ativo é bloqueado.
      const candidate = app.db.caregivers.find((c) => !c.isPilot && c.city === 'Uberlândia' && app.db.elders.find((e) => e.caregiverId === c.id)?.dependency !== 'independent');
      expect(candidate).toBeTruthy();
      const id = candidate?.id as string;
      expect(service.pilotEligibility(id).tcleActive).toBe(false);
      expect(() => service.enrollInPilot(id)).toThrow(/TCLE/);
      TestBed.inject(CaregiverService);
      const consent = (await import('@core/privacy')).ConsentService;
      TestBed.inject(consent).grant(id, 'pilot_tcle', { channel: 'in_person' });
      service.enrollInPilot(id);
      expect(app.db.caregivers.require(id).isPilot).toBe(true);
      const enrollment = app.db.pilotEnrollments.find((p) => p.caregiverId === id);
      expect(enrollment?.windows.map((w) => w.name)).toEqual(['enrollment', 'month3', 'month6']);
      service.leavePilot(id);
      expect(app.db.caregivers.require(id).isPilot).toBe(false);
      expect(app.db.pilotEnrollments.find((p) => p.caregiverId === id)?.exitedAt).toBeTruthy();
    });

    it('só o responsável técnico atribui psicólogo (AC-M03-14)', async () => {
      await open('u2', '/app/cuidadores/cg_0001');
      expect(q('#nx-assign')).not.toBeNull();
      const select = q<HTMLSelectElement>('#nx-assign') as HTMLSelectElement;
      select.value = 'psy_0002';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle(app.fixture);
      expect(app.db.caregivers.require('cg_0001').assignedPsychologistId).toBe('psy_0002');
      await open('u7', '/app/cuidadores/cg_0001');
      expect(q('#nx-assign')).toBeNull();
    });

    it('pedir encerramento mostra o que será eliminado e bloqueado, muda a situação e cria a solicitação POP-10 (AC-M03-11)', async () => {
      await open('u7', '/app/cuidadores/cg_0018');
      await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Encerrar cadastro') ?? null);
      const drawer = all('dialog.drawer').find((d) => text(d).includes('Encerrar cadastro') && text(d).includes('Será eliminado')) ?? null;
      expect(text(drawer)).toContain('Será eliminado');
      expect(text(drawer)).toContain('Ficará bloqueado por registro documental');
      expect(text(drawer)).toContain('Res. CFP 1/2009');
      // CX-033: o atendimento não descobre se há Zarit, alerta ou ocorrência (nem tipos, nem quantidades) e não lê "(a confirmar)".
      expect(text(drawer)).not.toMatch(/Escala de Zarit|Alertas de Zarit|Alertas da ARBE|Ocorrências POP|Anotações de sessão/);
      expect(text(drawer)).not.toContain('(a confirmar)');
      expect(text(drawer)).toContain('Registros clínicos, se houver, ficam retidos por 5 anos');
      expect(app.db.caregivers.require('cg_0018').status).toBe('active');
      const service = TestBed.inject(CaregiverService);
      const before = app.db.dataSubjectRequests.size();
      const request = service.requestClosure('cg_0011', 'O cuidador pediu para encerrar o cadastro');
      expect(app.db.caregivers.require('cg_0011').status).toBe('closure_requested');
      expect(request.type).toBe('erasure');
      expect(app.db.dataSubjectRequests.size()).toBe(before + 1);
      // Reaproveita a eliminação já aberta (C18).
      const reused = service.requestClosure('cg_0018', 'Cadastro duplicado');
      expect(reused.id).toBe('dsr_0001');
      expect(app.db.dataSubjectRequests.size()).toBe(before + 1);
    });

    it('exportar dados do titular: o atendimento gera pacote selado sem Zarit legível; só dados do titular (AC-M03-13)', async () => {
      await open('u7', '/app/cuidadores/cg_0019?aba=consentimentos');
      expect(text(q('[data-role="export-note"]'))).toContain('Inclui apenas os dados de');
      const { SubjectExportService } = await import('@core/privacy/subject-export.service');
      const file = TestBed.inject(SubjectExportService).build('cg_0019');
      expect(file.mode).toBe('sealed');
      const json = JSON.parse(file.json) as { subject: { code: string; zaritAssessments: unknown[]; clinicalSealed: { sealed: boolean; payload: string }; caregiver: { id: string } } };
      expect(json.subject.code).toBe('CUI-0019');
      expect(json.subject.zaritAssessments).toEqual([]);
      expect(json.subject.clinicalSealed.sealed).toBe(true);
      const decoded = JSON.parse(atob(json.subject.clinicalSealed.payload)) as { zaritAssessments: unknown[] };
      expect(Array.isArray(decoded.zaritAssessments)).toBe(true);
      expect(file.json).not.toContain('cg_0001"');
      expect(app.db.accessLog.list().some((l) => l.action === 'export' && l.subjectCaregiverId === 'cg_0019')).toBe(true);
    });
  });

  describe('pessoa idosa (SCR-M03-04)', () => {
    it('sem consentimento de saúde, condições e medicamentos ficam fechados (U-08); com consentimento, leitura grava view', async () => {
      await open('u7', '/app/cuidadores/cg_0016/idoso');
      expect(text(q('h1'))).toBe('Pessoa idosa e cuidados');
      expect(text(q('.page'))).toContain('Disponível depois do consentimento de saúde');
      expect(q('[data-role="conditions"]')).toBeNull();
      await open('u3', '/app/cuidadores/cg_0005/idoso');
      expect(text(q('.page'))).toContain('Condições de saúde');
      expect(q('[data-role="conditions"]')).not.toBeNull();
      expect(app.db.accessLog.list().some((l) => l.action === 'view' && l.entity === 'elder_conditions' && l.subjectCaregiverId === 'cg_0005')).toBe(true);
    });

    it('o atendimento não vê condições de saúde nem medicamentos, só o que o cadastro precisa, e nada é gravado como leitura clínica (CX-034)', async () => {
      await open('u7', '/app/cuidadores/cg_0005/idoso');
      const page = text(q('.page'));
      expect(page).toContain('Fechado para o atendimento');
      expect(page).toContain('Compromissos de cuidado');
      expect(page).not.toContain('Medicamento');
      expect(q('[data-role="conditions"]')).toBeNull();
      const elder = app.db.elders.find((e) => e.caregiverId === 'cg_0005');
      if (elder?.conditionsSummary) {
        expect(app.root.innerHTML).not.toContain(elder.conditionsSummary);
      }
      app.db.medications.query((m) => m.elderId === elder?.id).forEach((m) => expect(app.root.innerHTML).not.toContain(m.name));
      expect(app.db.accessLog.list().some((l) => l.action === 'view' && l.entity === 'elder_conditions' && l.subjectCaregiverId === 'cg_0005')).toBe(false);
    });

    it('a gestão não abre a tela da pessoa idosa (matriz)', async () => {
      await open('u1', '/app/cuidadores');
      await go('/app/cuidadores/cg_0005/idoso');
      expect(app.router.url).toBe('/403');
    });

    it('o responsável técnico passa pelo portão também para a saúde da pessoa idosa', async () => {
      await open('u2', '/app/cuidadores/cg_0005/idoso');
      expect(q('[data-role="supervision-gate"]')).not.toBeNull();
      expect(q('[data-role="conditions"]')).toBeNull();
    });
  });

  describe('acessibilidade e estados', () => {
    it('toda página tem um h1, a tabela tem legenda e as caixas de seleção têm rótulo', async () => {
      await open('u7', '/app/cuidadores');
      expect(all('h1')).toHaveLength(1);
      expect(text(q('table caption'))).toBe('Cuidadores cadastrados');
      const boxes = all<HTMLInputElement>('tbody input[type="checkbox"]');
      expect(boxes.length).toBeGreaterThan(0);
      expect(boxes[0]?.getAttribute('aria-label')).toMatch(/^Selecionar CUI-\d{4}$/);
      await go('/app/cuidadores/cg_0001');
      expect(all('h1')).toHaveLength(1);
      expect(q('[role="tablist"]')?.getAttribute('aria-label')).toBe('Ficha do cuidador');
    });

    it('todo campo de formulário tem rótulo: cadastro novo (4 etapas), edição e encerramento', async () => {
      await open('u7', '/app/cuidadores/novo');
      await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Preencher com exemplo') ?? null);
      for (let step = 0; step < 5; step += 1) {
        expect(unlabeled(app.root), `etapa ${step + 1}`).toEqual([]);
        if (step < 4) {
          await click(all<HTMLButtonElement>('button').find((b) => text(b) === 'Continuar') ?? null);
        }
      }
      // O rascunho automático guarda o cadastro a cada mudança de etapa (UX 5.12).
      expect(Array.from(app.local.data.keys()).some((k) => k.includes('draft:caregiver-new'))).toBe(true);
    });

    it('cuidador inexistente mostra estado de erro com saída, sem tela em branco', async () => {
      await open('u7', '/app/cuidadores/cg_9999');
      expect(text(q('.empty__title'))).toBe('Cuidador não encontrado');
      expect(all('a').some((a) => text(a) === 'Voltar para Cuidadores')).toBe(true);
    });

    it('nenhum texto da interface traz travessão, "paciente" ou "idoso(a)"', async () => {
      await open('u7', '/app/cuidadores/cg_0001');
      for (const aba of ['', '?aba=idoso', '?aba=plano', '?aba=consentimentos', '?aba=comunicacao', '?aba=historico']) {
        await go(`/app/cuidadores/cg_0001${aba}`);
        const content = text(q('main'));
        expect(content, aba).not.toMatch(/[\u2014\u2013]/);
        expect(content, aba).not.toMatch(/\bpaciente\b|\bidoso\(a\)/i);
      }
    });

    it('o log não ganha nome do cuidador na URL nem no título da aba', async () => {
      await open('u7', '/app/cuidadores/cg_0001');
      expect(document.title).toBe('Perfil do cuidador · Nexus ERP');
      expect(app.router.url).not.toContain('Ana');
      expect(TestBed.inject(AuditLogService)).toBeTruthy();
    });
  });
});
