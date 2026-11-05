import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { DataSubjectRequestService } from '@core/privacy';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { nextTermVersion } from './pages/terms.page';
import { communicationTarget } from './pages/incidents.pages';


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

describe('M12 LGPD', () => {
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
  const click = async (el: Element | null | undefined): Promise<void> => {
    if (!el) {
      throw new Error('elemento não encontrado');
    }
    (el as HTMLElement).click();
    await settle(app.fixture);
  };
  const button = (label: string, root: ParentNode = app.root): HTMLButtonElement | null =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => text(b) === label) ?? null;
  const type = async (el: Element | null | undefined, value: string): Promise<void> => {
    const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!input) {
      throw new Error('campo não encontrado');
    }
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await settle(app.fixture);
  };
  /** O diálogo de confirmação (o que tem o botão de confirmar), não a paleta de comandos. */
  const confirmDialog = (): Element | null => q('[data-role="confirm"]')?.closest('dialog') ?? null;
  const dialogConfirm = async (typed?: string): Promise<void> => {
    const dialog = confirmDialog();
    if (typed !== undefined) {
      await type(dialog?.querySelector('input[type="text"]'), typed);
    }
    await click(dialog?.querySelector('[data-role="confirm"]'));
  };
  const drawerOf = (title: string): Element | null => all('dialog.drawer').find((d) => text(d).includes(title)) ?? null;

  afterEach(() => TestBed.resetTestingModule());

  describe('consentimentos (SCR-M12-01)', () => {
    it('a gestão vê a matriz por código, com 6 consentimentos e filtro de revogados (AC-M12-02)', async () => {
      await open('u1', '/app/lgpd/consentimentos');
      expect(text(q('h1'))).toBe('Consentimentos');
      expect(all('thead th').map((h) => text(h)).slice(1, 7)).toEqual(['Saúde', 'Indicadores', 'Família', 'Imagem', 'WhatsApp', 'Piloto']);
      app.db.caregivers.list().slice(0, 30).forEach((c) => expect(app.root.innerHTML).not.toContain(c.fullName));
      await go('/app/lgpd/consentimentos?visao=revogados');
      const rows = all('tbody tr').map((r) => text(r));
      expect(rows.some((r) => r.includes('CUI-0016') && r.includes('Revogado'))).toBe(true);
      expect(text(q('.table-footer'))).toContain('titulares');
    });

    it('recusar "imagem" não muda os demais e cada evento entra no histórico append-only (AC-M12-01, 07)', async () => {
      await open('u7', '/app/lgpd/consentimentos');
      const target = app.db.consents.find((c) => c.key === 'image_testimony' && c.status === 'pending' && c.caregiverId > 'cg_0100')!.caregiverId;
      const code = app.db.caregivers.require(target).code;
      await type(q('input[type="search"]'), code);
      const before = app.db.consents.query((c) => c.caregiverId === target).map((c) => `${c.key}:${c.status}`).filter((s) => !s.startsWith('image'));
      await click(all('tbody tr').find((r) => text(r).includes(code))?.querySelector('button'));
      const drawer = drawerOf('Consentimentos de');
      const image = drawer?.querySelector('section[data-key="image_testimony"]');
      expect(text(image)).toContain('Pendente');
      await click(button('Registrar recusa', image ?? undefined));
      expect(app.db.consents.find((c) => c.caregiverId === target && c.key === 'image_testimony')?.status).toBe('refused');
      const after = app.db.consents.query((c) => c.caregiverId === target).map((c) => `${c.key}:${c.status}`).filter((s) => !s.startsWith('image'));
      expect(after).toEqual(before);
      const events = app.db.consentEvents.query((e) => e.caregiverId === target && e.key === 'image_testimony');
      expect(events.map((e) => e.status)).toEqual(['refused']);
      expect(events[0]?.registeredByUserId).toBe('u7');
      // O histórico não tem editar nem apagar.
      await click(button('Ver histórico', drawer?.querySelector('section[data-key="image_testimony"]') ?? undefined));
      expect(text(drawer)).toContain('Consentimento recusado');
      const labels = Array.from(drawer?.querySelectorAll('button, a') ?? []).map((b) => text(b));
      expect(labels.some((l) => /Editar|Apagar|Excluir/i.test(l))).toBe(false);
    });

    it('revogar consentimento de saúde abre o diálogo de efeito, pausa o cadastro e encerra os alertas na hora (RN-LGPD-14)', async () => {
      await open('u7', '/app/lgpd/consentimentos');
      await click(all('tbody tr').find((r) => text(r).includes('CUI-0001'))?.querySelector('button'));
      const drawer = drawerOf('Consentimentos de');
      await click(button('Revogar consentimento', drawer?.querySelector('section[data-key="health_data"]') ?? undefined));
      expect(text(confirmDialog())).toContain('Retirar o consentimento');
      expect(text(confirmDialog())).toContain('Novas aplicações da Zarit não podem ser registradas');
      expect(app.db.consents.find((c) => c.caregiverId === 'cg_0001' && c.key === 'health_data')?.status).toBe('granted');
      await dialogConfirm();
      expect(app.db.consents.find((c) => c.caregiverId === 'cg_0001' && c.key === 'health_data')?.status).toBe('revoked');
      expect(app.db.caregivers.require('cg_0001').status).toBe('paused_by_consent_revocation');
      expect(app.db.zaritAlerts.query((a) => a.caregiverId === 'cg_0001').every((a) => a.status === 'closed')).toBe(true);
      expect(app.db.zaritAlerts.get('zal_0001')?.closureNote).toBe('consentimento revogado');
    });

    it('o psicólogo não vê o módulo; o atendimento não vê as telas do log (AC-M12-11)', async () => {
      await open('u3', '/app/painel');
      await go('/app/lgpd/consentimentos');
      expect(app.router.url).toBe('/403');
      await open('u7', '/app/lgpd/consentimentos');
      const links = all('app-lgpd-nav a').map((a) => text(a));
      expect(links).toEqual(['Consentimentos', 'Termos', 'Solicitações do titular']);
      for (const path of ['log', 'incidentes', 'politica', 'ripd', 'retencao']) {
        await go(`/app/lgpd/${path}`);
        expect(app.router.url, path).toBe('/403');
      }
    });
  });

  describe('termos (SCR-M12-02)', () => {
    it('três documentos separados: saúde, imagem e contrato de prestação, cada um com versão e data (AC-M12-12)', async () => {
      await open('u1', '/app/lgpd/termos');
      const titles = all('app-card .card__title').map((t) => text(t));
      expect(titles).toContain('Termo de consentimento para dados de saúde');
      expect(titles).toContain('Termo de autorização de uso de imagem e depoimento');
      expect(titles).toContain('Contrato de prestação de serviços');
      expect(text(q('main'))).toMatch(/versão 1\.0 · publicado em \d{2}\/\d{2}\/\d{4}/);
      expect(nextTermVersion('1.0')).toBe('1.1');
      expect(nextTermVersion('2.9')).toBe('2.10');
    });

    it('publicar nova versão deixa os consentimentos dados na antiga como "Desatualizado" (LP-06)', async () => {
      await open('u2', '/app/lgpd/termos');
      const card = all('app-card').find((c) => text(c).includes('Termo de contato por WhatsApp'));
      await click(button('Publicar nova versão', card ?? undefined));
      const drawer = drawerOf('Publicar nova versão');
      expect(text(drawer)).toContain('passa a 1.1');
      await type(drawer?.querySelector('textarea'), 'Autorizo contato por WhatsApp, nesta versão 1.1 do termo.');
      await click(button('Publicar a versão 1.1', drawer ?? undefined));
      expect(text(confirmDialog())).toContain('Publicar a versão 1.1 do termo?');
      await dialogConfirm();
      expect(app.db.consentTerms.find((t) => t.key === 'whatsapp_contact' && t.active)?.version).toBe('1.1');
      expect(app.db.consentTerms.find((t) => t.key === 'whatsapp_contact' && t.version === '1.0')?.active).toBe(false);
      await go('/app/lgpd/consentimentos?visao=desatualizados');
      expect(all('tbody tr').length).toBeGreaterThan(5);
      expect(text(q('tbody'))).toContain('Desatualizado');
    });
  });

  describe('solicitações do titular (SCR-M12-03 e 04)', () => {
    it('mostra os prazos do seed em texto e ícone: vence em 5 dias, vence em breve (2 dias), concluída (AC-M12-03)', async () => {
      await open('u7', '/app/lgpd/solicitacoes');
      const rows = all('tbody tr').map((r) => text(r));
      expect(rows.find((r) => r.includes('DSR-0001'))).toContain('Vence em 5 dias');
      expect(rows.find((r) => r.includes('DSR-0003'))).toContain('Vence em breve (2 dias)');
      expect(rows.find((r) => r.includes('DSR-0002'))).toContain('Concluída');
      // Ordem: prazo mais próximo primeiro, concluídas por último.
      expect(rows[0]).toContain('DSR-0003');
      expect(all('tbody tr .badge svg').length).toBeGreaterThan(3);
      await go('/app/lgpd/solicitacoes?filtro=vencendo');
      expect(all('tbody tr')).toHaveLength(1);
    });

    it('o atendimento registra em nome do titular: protocolo, prazo de 15 dias e log; ?acao=nova abre a gaveta', async () => {
      await open('u7', '/app/lgpd/solicitacoes?acao=nova&cuidador=cg_0100');
      const drawer = drawerOf('Nova solicitação do titular');
      expect(text(drawer)).toContain('CUI-0100');
      // Sem preencher, não grava.
      const before = app.db.dataSubjectRequests.size();
      await click(button('Registrar solicitação', drawer ?? undefined));
      expect(text(drawer?.querySelector('.error-summary'))).toContain('pontos para corrigir');
      expect(app.db.dataSubjectRequests.size()).toBe(before);
      await type(drawer?.querySelector('#nx-dsr-type'), 'access');
      const select = drawer?.querySelector<HTMLSelectElement>('#nx-dsr-type');
      const accessIndex = Array.from(select?.options ?? []).findIndex((o) => text(o) === 'Confirmação e acesso');
      await type(select, select?.options[accessIndex]?.value ?? '');
      await type(drawer?.querySelector('#nx-dsr-description'), 'Quer saber quais dados a Nexus guarda.');
      await click(button('Registrar solicitação', drawer ?? undefined));
      expect(app.db.dataSubjectRequests.size()).toBe(before + 1);
      const created = app.db.dataSubjectRequests.list()[before]!;
      expect(created.protocol).toBe('DSR-0006');
      expect(created.caregiverId).toBe('cg_0100');
      expect(created.dueAt).toBe(app.clock.addDays(15));
      expect(created.channel).toBe('in_person');
      expect(created.description).toContain('Quer saber');
      expect(all('.toast').map((t) => text(t)).join(' ')).toContain('DSR-0006');
      expect(app.db.accessLog.list().some((l) => l.action === 'create' && l.entity === 'data_subject_request' && l.entityId === created.id)).toBe(true);
    });

    it('rejeitar exige motivo escrito (LP-18) e concluir exige nota; concluir gera a resposta ao titular em bloco copiável', async () => {
      await open('u7', '/app/lgpd/solicitacoes/dsr_0005');
      await click(button('Rejeitar solicitação'));
      expect(text(q('main'))).toContain('Escreva o motivo da rejeição.');
      expect(app.db.dataSubjectRequests.get('dsr_0005')?.status).toBe('in_progress');
      await click(button('Concluir solicitação'));
      expect(text(q('main'))).toContain('Escreva a nota de resolução.');
      await type(q('#nx-dsr-note'), 'Pedido de revisão encaminhado ao psicólogo do caso.');
      await click(button('Concluir solicitação'));
      expect(app.db.dataSubjectRequests.get('dsr_0005')?.status).toBe('completed');
      expect(app.db.dataSubjectRequests.get('dsr_0005')?.resolutionNote).toContain('encaminhado');
      const reply = q<HTMLTextAreaElement>('textarea[aria-label="Texto da resposta ao titular"]');
      expect(reply?.value).toContain('DSR-0005');
      expect(reply?.value).toContain('foi concluída');
      expect(button('Copiar texto')).not.toBeNull();
    });

    it('rejeitar com motivo muda a situação e mostra o motivo no cabeçalho', async () => {
      await open('u7', '/app/lgpd/solicitacoes/dsr_0003');
      await type(q('#nx-dsr-reject'), 'O titular não confirmou a identidade.');
      await click(button('Rejeitar solicitação'));
      expect(app.db.dataSubjectRequests.get('dsr_0003')?.status).toBe('rejected_with_reason');
      expect(text(q('.banner--attention'))).toContain('O titular não confirmou a identidade.');
    });

    it('eliminação: o atendimento vê só o aviso; a gestão elimina com duas colunas e digitando o código (AC-M12-04)', async () => {
      await open('u7', '/app/lgpd/solicitacoes/dsr_0001');
      expect(text(q('main'))).toContain('Registrado. Um sócio ou o responsável técnico executa esta etapa.');
      expect(button('Eliminar o que pode ser eliminado')).toBeNull();
      await open('u1', '/app/lgpd/solicitacoes/dsr_0001');
      expect(app.root.innerHTML).not.toContain(app.db.caregivers.require('cg_0018').fullName);
      const messagesBefore = app.db.messages.count((m) => m.caregiverId === 'cg_0018');
      await click(button('Eliminar o que pode ser eliminado'));
      const dialog = confirmDialog();
      expect(text(dialog)).toContain('Será eliminado');
      expect(text(dialog)).toContain('Ficará bloqueado');
      expect(text(dialog)).toContain('Res. CFP 1/2009 (a confirmar)');
      expect(text(dialog)).toContain('Digite CUI-0018 para continuar');
      expect(dialog?.querySelector<HTMLButtonElement>('[data-role="confirm"]')?.disabled).toBe(true);
      await dialogConfirm('CUI-0018');
      const request = app.db.dataSubjectRequests.get('dsr_0001');
      expect(request?.status).toBe('completed');
      expect(request?.retentionBlockNote).toContain('Res. CFP 1/2009 (a confirmar)');
      expect(request?.retentionBlockNote).toContain('5 anos');
      expect(app.db.messages.count((m) => m.caregiverId === 'cg_0018')).toBe(0);
      expect(messagesBefore).toBeGreaterThanOrEqual(0);
      expect(app.db.zaritAssessments.query((z) => z.caregiverId === 'cg_0018' && z.status === 'completed').every((z) => !!z.retentionBlock)).toBe(true);
      expect(app.db.caregivers.require('cg_0018').status).toBe('closed');
      expect(text(q('main'))).toContain('Resposta ao titular');
    });

    it('anonimizar pede o código, troca identificadores por código e mantém a contagem (AC-M12-05)', async () => {
      await open('u2', '/app/painel');
      const request = TestBed.inject(DataSubjectRequestService).open({ caregiverId: 'cg_0100', type: 'anonymization_or_blocking' });
      const before = app.db.caregivers.size();
      await go(`/app/lgpd/solicitacoes/${request.id}`);
      await click(button('Anonimizar dados'));
      expect(text(confirmDialog())).toContain('Isso não pode ser desfeito.');
      await dialogConfirm('CUI-0100');
      const cg = app.db.caregivers.require('cg_0100');
      expect(cg.fullName).toBe('CUI-0100');
      expect(cg.cpf).toBe('000.000.000-00');
      expect(cg.email).toContain('cui-0100');
      expect(cg.anonymizedAt).toBeTruthy();
      expect(app.db.caregivers.size()).toBe(before);
      expect(app.db.dataSubjectRequests.get(request.id)?.status).toBe('completed');
    });

    it('correção: valida e-mail fictício, grava o valor anterior em histórico e atualiza o cadastro', async () => {
      await open('u7', '/app/lgpd/solicitacoes/dsr_0003');
      const cg = app.db.caregivers.require('cg_0020');
      await type(q('#nx-fix-value'), 'novo@gmail.com');
      await click(button('Registrar correção'));
      expect(text(q('main'))).toContain('Use um e-mail que termine em @exemplo.com.br.');
      expect(app.db.caregivers.require('cg_0020').email).toBe(cg.email);
      await type(q('#nx-fix-value'), 'novo.contato@exemplo.com.br');
      await click(button('Registrar correção'));
      expect(app.db.caregivers.require('cg_0020').email).toBe('novo.contato@exemplo.com.br');
      const done = app.db.dataSubjectRequests.get('dsr_0003');
      expect(done?.corrections).toHaveLength(1);
      expect(done?.corrections?.[0]?.previous).toBe(cg.email);
      expect(text(q('main'))).toContain('Correções feitas');
      expect(app.db.accessLog.list().some((l) => l.action === 'update' && l.entity === 'caregiver' && l.entityId === 'cg_0020')).toBe(true);
    });

    it('portabilidade gera o arquivo, conclui e a gestão não lê o conteúdo clínico (pacote selado, A-17)', async () => {
      await open('u1', '/app/painel');
      const request = TestBed.inject(DataSubjectRequestService).open({ caregiverId: 'cg_0001', type: 'portability' });
      await go(`/app/lgpd/solicitacoes/${request.id}`);
      expect(text(q('main'))).toContain('pacote selado');
      await click(button('Gerar o arquivo e concluir'));
      expect(app.db.dataSubjectRequests.get(request.id)?.status).toBe('completed');
      expect(app.db.accessLog.list().some((l) => l.action === 'export' && l.subjectCaregiverId === 'cg_0001')).toBe(true);
    });

    it('revogação pela solicitação usa o diálogo de efeito e conclui', async () => {
      await open('u7', '/app/painel');
      const request = TestBed.inject(DataSubjectRequestService).open({ caregiverId: 'cg_0005', type: 'consent_revocation' });
      await go(`/app/lgpd/solicitacoes/${request.id}`);
      await click(button('Registrar revogação'));
      expect(text(q('main'))).toContain('Escolha o consentimento');
      const select = q<HTMLSelectElement>('#nx-revoke-key');
      const index = Array.from(select?.options ?? []).findIndex((o) => text(o).includes('whatsapp') || text(o).includes('WhatsApp'));
      await type(select, select?.options[index]?.value ?? '');
      await click(button('Registrar revogação'));
      await dialogConfirm();
      expect(app.db.consents.find((c) => c.caregiverId === 'cg_0005' && c.key === 'whatsapp_contact')?.status).toBe('revoked');
      expect(app.db.dataSubjectRequests.get(request.id)?.status).toBe('completed');
    });

    it('revisão de decisão abre o pedido ao psicólogo do caso com o prazo da solicitação', async () => {
      await open('u7', '/app/lgpd/solicitacoes/dsr_0005');
      const before = app.db.reviewRequests.size();
      await click(button('Abrir pedido de revisão ao psicólogo'));
      expect(app.db.reviewRequests.size()).toBe(before + 1);
      const created = app.db.reviewRequests.list()[before]!;
      expect(created.psychologistId).toBe(app.db.caregivers.require('cg_0002').assignedPsychologistId);
      expect(created.dueAt).toBe(app.db.dataSubjectRequests.get('dsr_0005')?.dueAt);
      expect(text(q('main'))).toContain('já foi aberto ao psicólogo do caso');
    });
  });

  describe('log de auditoria (SCR-M12-05)', () => {
    it('o responsável técnico filtra por ação e por titular e exporta CSV sem conteúdo clínico (AC-M12-06)', async () => {
      await open('u2', '/app/lgpd/log');
      expect(text(q('h1'))).toBe('Log de acessos');
      expect(text(q('.table-footer'))).toMatch(/de \d+ registros/);
      const actions = new Set(all('tbody tr').map((r) => text(r)));
      expect(Array.from(actions).some((r) => r.includes('Acesso negado'))).toBe(true);
      await go('/app/lgpd/log?acao=reveal');
      const rows = all('tbody tr').map((r) => text(r));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.includes('Dado mostrado'))).toBe(true);
      await go('/app/lgpd/log?titular=CUI-0019');
      const subject = all('tbody tr').map((r) => text(r));
      expect(subject.every((r) => r.includes('CUI-0019'))).toBe(true);
      expect(subject.some((r) => r.includes('Exportação'))).toBe(true);
      expect(button('Exportar CSV')).not.toBeNull();
      const csv = app.db.accessLog.size() > 0 ? (await import('@core/audit')).AuditLogService : null;
      const service = TestBed.inject(csv as never) as { toCsv: (e: never) => string; query: (f: object) => never };
      const text2 = service.toCsv(service.query({ action: 'view' }));
      expect(text2.split('\n')[0]).toBe('data_hora;usuario;perfil;acao;entidade;id;titular;justificativa;detalhe');
      expect(text2).not.toMatch(/Ana Paula|Sobrecarga/);
    });

    it('a gestão só lê o log: sem exportar; o titular aparece pelo código e não pelo nome', async () => {
      await open('u1', '/app/lgpd/log');
      expect(button('Exportar CSV')).toBeNull();
      app.db.caregivers.list().slice(0, 30).forEach((c) => expect(app.root.innerHTML).not.toContain(c.fullName));
      expect(all('.code-chip').length).toBeGreaterThan(5);
      expect(text(q('main'))).toContain('não se edita nem se apaga');
      expect(all('tbody button').length).toBe(0);
    });

    it('filtro por titular com formato errado explica como digitar', async () => {
      await open('u2', '/app/lgpd/log');
      await type(q('#nx-log-subject'), 'Ana');
      expect(text(q('main'))).toContain('Digite o código no formato CUI-0001.');
    });
  });

  describe('incidentes (SCR-M12-06, F13)', () => {
    it('o seed tem 1 incidente aberto (o mais novo, em contenção) e 1 encerrado, que mostra as comunicações e não tem botão de edição (AC-M12-09)', async () => {
      await open('u1', '/app/lgpd/incidentes');
      const rows = all('tbody tr');
      expect(rows).toHaveLength(2);
      expect(text(rows[0])).toContain('Aberto');
      expect(text(rows[1])).toContain('Encerrado');
      await click(rows[1] ?? null);
      expect(app.router.url).toContain('/app/lgpd/incidentes/inc_0001');
      expect(text(q('main'))).toContain('Comunicar à ANPD');
      expect(text(q('main'))).toContain('Comunicação do incidente à Autoridade Nacional');
      expect(text(q('main'))).toContain('Incidente encerrado');
      expect(button('Encerrar incidente')).toBeNull();
      expect(button('Registrar comunicação à ANPD')).toBeNull();
      expect(q('a[href$="/novo"]')).toBeNull();
    });

    it('registrar, conter, comunicar e encerrar: só encerra com as duas comunicações e leva o POP à revisão', async () => {
      await open('u2', '/app/lgpd/incidentes/novo');
      await click(button('Registrar incidente'));
      expect(text(q('.error-summary'))).toContain('pontos para corrigir');
      await type(q('#nx-inc-description'), 'E-mail com a agenda enviado a destinatário errado.');
      await type(q('#nx-inc-subjects'), '2');
      await type(q('#nx-inc-measures'), 'Pedido de descarte ao destinatário.');
      await click(all<HTMLInputElement>('#nx-inc-kinds input[type="checkbox"]')[1]);
      const before = app.db.incidents.size();
      await click(button('Registrar incidente'));
      expect(app.db.incidents.size()).toBe(before + 1);
      const incident = app.db.incidents.list()[before]!;
      expect(incident.status).toBe('open');
      expect(incident.dataAffected).toEqual(['Agenda']);
      expect(app.router.url).toContain(`/app/lgpd/incidentes/${incident.id}`);
      expect(text(q('[data-role="deadline"]'))).toContain('3 dias úteis');
      expect(text(q('[data-role="deadline"]'))).toContain(communicationTarget(incident).split('-').reverse().join('/'));
      // Encerrar está desabilitado e diz o que falta.
      expect(button('Encerrar incidente')?.getAttribute('aria-disabled')).toBe('true');
      expect(text(q('[data-role="close-missing"]'))).toBe('Falta: comunicação à ANPD e comunicação aos titulares.');
      expect(text(q('main'))).toContain('Não inclua dado de saúde na comunicação.');
      await click(button('Marcar como contido'));
      expect(app.db.incidents.get(incident.id)?.status).toBe('contained');
      await click(button('Registrar comunicação à ANPD'));
      expect(text(q('main'))).toContain('Escreva o que foi comunicado à ANPD.');
      await type(q('#nx-comm-anpd'), 'Comunicado à ANPD por formulário.');
      await click(button('Registrar comunicação à ANPD'));
      expect(text(q('[data-role="close-missing"]'))).toBe('Falta: comunicação aos titulares.');
      await type(q('#nx-comm-subjects'), 'Titulares avisados por e-mail.');
      await click(button('Registrar comunicação aos titulares'));
      expect(app.db.incidents.get(incident.id)?.status).toBe('communicated');
      expect(q('[data-role="close-missing"]')).toBeNull();
      // Checagem de lacuna.
      await type(q('#nx-gap-pop'), 'POP-06');
      const select = q<HTMLSelectElement>('#nx-gap-pop');
      const idx = Array.from(select?.options ?? []).findIndex((o) => text(o).startsWith('POP-06'));
      await type(select, select?.options[idx]?.value ?? '');
      await click(button('Marcar o procedimento para revisão'));
      expect(app.db.pops.find((p) => p.code === 'POP-06')?.reviewState).toBe('revision_triggered');
      await click(button('Encerrar incidente'));
      await dialogConfirm();
      expect(app.db.incidents.get(incident.id)?.status).toBe('closed');
      expect(button('Encerrar incidente')).toBeNull();
    });

    it('a gestão lê o incidente mas não conduz', async () => {
      await open('u1', '/app/lgpd/incidentes');
      expect(q('a[href$="/novo"]')).toBeNull();
      await go('/app/lgpd/incidentes/novo');
      expect(app.router.url).toBe('/403');
    });
  });

  describe('política, RIPD e retenção (SCR-M12-07 a 09)', () => {
    it('a política mostra encarregada, canal do titular, finalidades e bases legais (AC-M12-08)', async () => {
      await open('u2', '/app/lgpd/politica');
      expect(text(q('main'))).toContain('Marina Quintela');
      expect(text(q('main'))).toContain('privacidade@exemplo.com.br');
      expect(text(q('main'))).toContain('Finalidades e bases legais');
      expect(text(q('main'))).toContain('Consentimento de saúde; tutela da saúde');
      expect(text(q('main'))).toContain('Direitos do titular');
    });

    it('o RIPD lista os riscos (R10) e as medidas', async () => {
      await open('u1', '/app/lgpd/ripd');
      expect(text(q('h1'))).toBe('Relatório de impacto (RIPD)');
      expect(text(q('main'))).toContain('R10: Vazamento ou perda de dados sensíveis');
      expect(text(q('main'))).toContain('Medidas');
      expect(text(q('main'))).toContain('Plano de resposta a incidentes (POP-06)');
    });

    it('a política em dois toques continua aberta a todos os perfis, fora do módulo (A-43)', async () => {
      await open('u7', '/app/canal-do-titular');
      expect(text(q('h1'))).toBe('Privacidade e canal do titular');
    });

    it('a simulação da passagem do tempo mostra o que seria eliminado sem apagar nada (LP-19)', async () => {
      await open('u2', '/app/lgpd/retencao');
      expect(text(q('main'))).toContain('Registro documental psicológico');
      expect(text(q('main'))).toContain('5 anos');
      const before = app.db.caregivers.size();
      await click(all<HTMLButtonElement>('app-segmented button').find((b) => text(b) === 'Daqui a 5 anos') ?? null);
      expect(text(q('[data-role="simulation-date"]'))).toContain(app.clock.addDays(0).slice(0, 4).replace(/^(\d{4})$/, (y) => String(Number(y) + 5)));
      expect(app.db.caregivers.size()).toBe(before);
    });
  });

  describe('acessibilidade e texto', () => {
    it('cada tela tem um h1, tabelas com legenda e nenhum travessão', async () => {
      await open('u2', '/app/lgpd/consentimentos');
      for (const path of ['consentimentos', 'termos', 'solicitacoes', 'solicitacoes/dsr_0001', 'log', 'incidentes', 'incidentes/inc_0001', 'politica', 'ripd', 'retencao']) {
        await go(`/app/lgpd/${path}`);
        expect(all('h1'), path).toHaveLength(1);
        expect(text(q('main')), path).not.toMatch(/[\u2014\u2013]/);
        expect(all('nav[aria-label="Privacidade (LGPD)"]'), path).toHaveLength(1);
      }
      await go('/app/lgpd/log');
      expect(text(q('table caption'))).toBe('Log de acessos');
    });

    it('todo campo tem rótulo nas telas com formulário e filtros', async () => {
      await open('u2', '/app/lgpd/log');
      expect(unlabeled(app.root.querySelector('main') as Element)).toEqual([]);
      for (const path of ['solicitacoes/dsr_0003', 'solicitacoes/dsr_0005', 'incidentes/novo', 'termos']) {
        await go(`/app/lgpd/${path}`);
        expect(unlabeled(app.root.querySelector('main') as Element), path).toEqual([]);
      }
    });

    it('solicitação de portabilidade concluída tem o JSON do titular para baixar (AC-M12-03)', async () => {
      await open('u7', '/app/lgpd/solicitacoes/dsr_0002');
      expect(text(q('main'))).toContain('Esta solicitação foi concluída');
      const download = button('Baixar o arquivo do titular (JSON)');
      expect(download).not.toBeNull();
      const before = app.db.accessLog.size();
      await click(download);
      expect(app.db.accessLog.size()).toBeGreaterThan(before);
      expect(app.db.accessLog.list().some((l) => l.action === 'export' && l.subjectCaregiverId === 'cg_0019')).toBe(true);
    });

    it('solicitação inexistente mostra erro com saída; a raiz do módulo leva aos consentimentos', async () => {
      await open('u7', '/app/lgpd/solicitacoes/dsr_9999');
      expect(text(q('.empty__title'))).toBe('Solicitação não encontrada');
      await go('/app/lgpd');
      expect(app.router.url).toBe('/app/lgpd/consentimentos');
    });
  });
});
