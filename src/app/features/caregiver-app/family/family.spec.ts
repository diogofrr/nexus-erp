import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsentService } from '../../../core/privacy/consent.service';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './family.routes';
import { FamilyShareError, FamilyShareService } from './state/family-share.service';
import { FamilyShareData, NO_FAMILY_CHOICES, buildFamilyText } from './state/family-text';

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

const EXAMPLE: FamilyShareData = {
  elderFirstName: 'Helena',
  caregiverFirstName: 'Ana',
  today: '2026-11-05',
  appointmentsToday: [{ at: '2026-11-05T14:00:00-03:00', title: 'Fisioterapia', place: 'Clínica Movimento Vital' }],
  appointmentsWeek: [{ at: '2026-11-06T10:00:00-03:00', title: 'Consulta com o cardiologista' }],
  doses: [
    { time: '20:00', medicationName: 'Metformina' },
    { time: '08:00', medicationName: 'Losartana' },
  ],
};

describe('Família (UX C20)', () => {
  let app: BootedCaregiverApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null => app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] => Array.from(app.root.querySelectorAll<T>(selector));
  const flush = (): Promise<void> => settleCaregiver(app.fixture);
  const click = async (el: Element | null | undefined): Promise<void> => {
    if (!el) {
      throw new Error('elemento não encontrado');
    }
    (el as HTMLElement).click();
    await flush();
  };
  const open = async (id: string, options: { today?: string } = {}): Promise<void> => {
    TestBed.resetTestingModule();
    app = await bootCaregiverApp(id, { url: '/cuidador/mais/familia', ...options });
  };
  const switches = (): HTMLButtonElement[] => all<HTMLButtonElement>('app-cg-switch button');
  const box = (): string => text(q('.family-box'));
  const copyButton = (): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find((b) => text(b) === 'Copiar texto');

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window.navigator, 'clipboard');
  });

  it('exporta as rotas, abre em /cuidador/mais/familia e o título da aba é "Família"', async () => {
    expect(ROUTES.length).toBeGreaterThan(0);
    await open('cg_0001');
    expect(app.router.url).toBe('/cuidador/mais/familia');
    expect(document.title).toContain('Família');
    expect(text(q('main h1'))).toBe('Família');
  });

  describe('o texto, em função pura', () => {
    it('com as três chaves ligadas segue o exemplo do UX, só com nome e horário dos remédios', () => {
      expect(buildFamilyText(EXAMPLE, { today: true, week: true, medications: true })).toBe(
        'Rotina de Helena, quinta-feira, 05/11. Compromissos de hoje: 14:00 Fisioterapia (Clínica Movimento Vital). ' +
          'Compromissos desta semana: sex, 06/11, 10:00 Consulta com o cardiologista. ' +
          'Remédios de hoje: 08:00 Losartana, 20:00 Metformina. Enviado por Ana pelo app Nexus.',
      );
    });

    it('só entra o que foi ligado, e com tudo desligado não há texto', () => {
      expect(buildFamilyText(EXAMPLE, NO_FAMILY_CHOICES)).toBeNull();
      const onlyMeds = buildFamilyText(EXAMPLE, { today: false, week: false, medications: true }) as string;
      expect(onlyMeds).toContain('Remédios de hoje');
      expect(onlyMeds).not.toContain('Compromissos');
    });

    it('sem compromissos ou sem remédios, a linha diz "nenhum"', () => {
      const empty: FamilyShareData = { ...EXAMPLE, appointmentsToday: [], appointmentsWeek: [], doses: [] };
      expect(buildFamilyText(empty, { today: true, week: true, medications: true })).toBe(
        'Rotina de Helena, quinta-feira, 05/11. Compromissos de hoje: nenhum. Compromissos desta semana: nenhum. ' +
          'Remédios de hoje: nenhum. Enviado por Ana pelo app Nexus.',
      );
    });

    it('vários compromissos vêm em ordem e separados por ponto e vírgula', () => {
      const many: FamilyShareData = {
        ...EXAMPLE,
        appointmentsToday: [
          { at: '2026-11-05T17:00:00-03:00', title: 'Exame' },
          { at: '2026-11-05T09:00:00-03:00', title: 'Vacina' },
        ],
      };
      expect(buildFamilyText(many, { today: true, week: false, medications: false })).toContain(
        'Compromissos de hoje: 09:00 Vacina; 17:00 Exame.',
      );
    });
  });

  describe('AC-CG-166, 167 e 172: com a autorização', () => {
    it('Ana: as três chaves desligadas, a caixa pede para escolher e "Copiar texto" fica sem uso com o motivo escrito', async () => {
      await open('cg_0001');
      expect(all('.cg-switch__label').map(text)).toEqual([
        'Compromissos de hoje',
        'Compromissos desta semana',
        'Remédios de hoje (nome e horário)',
      ]);
      expect(switches().every((s) => s.getAttribute('aria-checked') === 'false')).toBe(true);
      expect(box()).toBe('Escolha o que você quer compartilhar.');
      expect(copyButton()?.disabled).toBe(true);
      expect(text(q('#family-reason'))).toBe('Escolha pelo menos um item.');
      expect(copyButton()?.getAttribute('aria-describedby')).toBe('family-reason');
      expect(text(q('.cg-page-header__desc'))).toBe(
        'Gere um texto com a rotina de Benedito para mandar à sua família. Você escolhe o que entra.',
      );
    });

    it('cada chave ligada acrescenta o trecho na hora e desligar o tira; tudo desligado volta à mensagem', async () => {
      await open('cg_0001');
      await click(switches()[2]);
      expect(box()).toMatch(/^Rotina de Benedito, quarta-feira, 04\/11\. Remédios de hoje: 07:30 Omeprazol, /);
      expect(box()).not.toContain('Compromissos');
      expect(copyButton()?.disabled).toBe(false);
      expect(q('#family-reason')).toBeNull();
      await click(switches()[0]);
      expect(box()).toContain('Compromissos de hoje: 16:00 ');
      await click(switches()[1]);
      expect(box()).toContain('Compromissos desta semana: ');
      await click(switches()[0]);
      expect(box()).not.toContain('Compromissos de hoje');
      await click(switches()[1]);
      await click(switches()[2]);
      expect(box()).toBe('Escolha o que você quer compartilhar.');
      expect(copyButton()?.disabled).toBe(true);
    });

    it('os compromissos novos da Agenda e o "onde" entram no texto', async () => {
      await open('cg_0001');
      const elderId = app.context.elderId() as string;
      app.db.careAppointments.removeWhere((a) => a.elderId === elderId);
      app.db.careAppointments.create({
        elderId,
        title: 'Consulta com o cardiologista',
        at: '2026-11-04T18:30:00-03:00',
        kind: 'medical',
        reminder: true,
        place: 'Clínica Movimento Vital',
      });
      app.db.careAppointments.create({
        elderId,
        title: 'Retorno',
        at: '2026-11-11T10:00:00-03:00',
        kind: 'medical',
        reminder: true,
      });
      app.db.careAppointments.create({
        elderId,
        title: 'Longe demais',
        at: '2026-11-12T10:00:00-03:00',
        kind: 'medical',
        reminder: true,
      });
      await flush();
      await click(switches()[0]);
      await click(switches()[1]);
      expect(box()).toContain('Compromissos de hoje: 18:30 Consulta com o cardiologista (Clínica Movimento Vital).');
      expect(box()).toContain('Compromissos desta semana: qua, 11/11, 10:00 Retorno.');
      expect(box()).not.toContain('Longe demais');
    });

    it('AC-CG-168: o texto só tem o primeiro nome da pessoa idosa, a data, os compromissos e remédios marcados, sem dose nem condição de saúde', async () => {
      await open('cg_0001');
      for (const s of switches()) {
        await click(s);
      }
      const content = box();
      const elder = app.context.elder();
      const caregiver = app.context.caregiver();
      expect(content.startsWith('Rotina de Benedito, quarta-feira, 04/11.')).toBe(true);
      expect(content.endsWith('Enviado por Ana pelo app Nexus.')).toBe(true);
      expect(content).not.toContain(elder?.fullName ?? '??');
      expect(content).not.toContain(caregiver?.fullName ?? '??');
      app.db.medications
        .query((m) => m.elderId === elder?.id)
        .forEach((m) => expect(content).not.toContain(m.dosage));
      if (elder?.conditionsSummary) {
        expect(content).not.toContain(elder.conditionsSummary);
      }
      expect(content).not.toMatch(/psic[oó]log|conversa|grupo|zarit|escala|pontos|sobrecarga|plano|cuida\b|essencial|cart[aã]o|R\$|CPF|@|\(34\)/i);
    });

    it('AC-CG-171: a conversa da própria pessoa com o psicólogo não aparece no texto nem entre as opções', async () => {
      await open('cg_0001');
      const psychologist = app.db.psychologists.find((p) => p.displayName.startsWith('Dra. Beatriz'));
      app.db.careSessions.create({
        caregiverId: 'cg_0001',
        psychologistId: psychologist?.id ?? '',
        slotId: 'slot_x',
        startAt: '2026-11-05T14:00:00-03:00',
        durationMin: 60,
        modality: 'online',
        kind: 'guidance',
        status: 'confirmed',
        priceCents: 10200,
        discountPercent: 15,
      });
      await flush();
      for (const s of switches()) {
        await click(s);
      }
      expect(box()).not.toContain('Beatriz');
      expect(box()).not.toMatch(/conversa/i);
      expect(switches()).toHaveLength(3);
    });

    it('AC-CG-172: não há botão de enviar por e-mail, WhatsApp ou outro canal, e o aviso fixo está visível', async () => {
      await open('cg_0001');
      expect(all('main button, main a').map(text).filter((t) => /enviar|e-mail|whatsapp|compartilhar com/i.test(t))).toEqual([]);
      expect(text(q('main'))).toContain('Nada de conversa com psicólogo, grupo ou resultado da escala entra aqui.');
      expect(all('a[href^="mailto:"], a[href*="wa.me"], a[href^="whatsapp:"], a[href^="tel:"]')).toHaveLength(0);
      // O aviso também aparece para quem ainda não autorizou.
      await open('cg_0003');
      expect(text(q('main'))).toContain('Nada de conversa com psicólogo, grupo ou resultado da escala entra aqui.');
    });
  });

  describe('AC-CG-169: copiar', () => {
    it('copia o texto, avisa com a frase do UX por 8 s e não mostra a instrução de copiar na mão', async () => {
      await open('cg_0001');
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
      await click(switches()[2]);
      await click(copyButton());
      expect(writeText).toHaveBeenCalledWith(box());
      const toast = TestBed.inject(ToastService).toasts()[0];
      expect(toast?.message).toBe('Texto copiado. Cole na conversa da sua família.');
      expect(toast?.durationMs).toBe(8000);
      expect(q('.family-status')).toBeNull();
    });

    it('se o navegador negar, a caixa fica selecionada e a frase diz como copiar na mão', async () => {
      await open('cg_0001');
      const writeText = vi.fn().mockRejectedValue(new Error('negado'));
      Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
      await click(switches()[0]);
      await click(copyButton());
      expect(text(q('.family-status'))).toBe('Não foi possível copiar. Segure sobre o texto e escolha Copiar.');
      const selection = window.getSelection();
      expect(selection?.rangeCount).toBe(1);
      const range = selection?.getRangeAt(0);
      expect(range?.commonAncestorContainer).toBe(q('.family-box'));
      expect(TestBed.inject(ToastService).toasts()).toHaveLength(0);
    });

    it('sem área de transferência no navegador também cai na instrução', async () => {
      await open('cg_0001');
      await click(switches()[0]);
      await click(copyButton());
      expect(text(q('.family-status'))).toContain('Segure sobre o texto e escolha Copiar.');
    });
  });

  describe('AC-CG-170: sem a autorização', () => {
    it('João: no lugar das chaves, o cartão com a pergunta, "Autorizo" e "Agora não" de peso igual', async () => {
      await open('cg_0003');
      expect(switches()).toHaveLength(0);
      const card = q('app-cg-card');
      expect(text(card)).toContain('Podemos compartilhar informações da pessoa idosa com a sua família?');
      const authorize = all('button').find((b) => text(b) === 'Autorizo');
      const later = all('button').find((b) => text(b) === 'Agora não');
      expect(authorize?.className).toBe(later?.className);
      expect(authorize?.className).not.toContain('btn--primary');
      expect(q('.family-box')).toBeNull();
    });

    it('"Agora não" não grava nada e mantém o cartão', async () => {
      await open('cg_0003');
      const events = app.db.consentEvents.size();
      await click(all('button').find((b) => text(b) === 'Agora não'));
      expect(app.db.consentEvents.size()).toBe(events);
      expect(TestBed.inject(ConsentService).status('cg_0003', 'family_sharing')).toBe('pending');
      expect(all('button').some((b) => text(b) === 'Autorizo')).toBe(true);
      expect(switches()).toHaveLength(0);
    });

    it('"Autorizo" grava o consentimento com o evento e libera as chaves', async () => {
      await open('cg_0003');
      await click(all('button').find((b) => text(b) === 'Autorizo'));
      expect(TestBed.inject(ConsentService).status('cg_0003', 'family_sharing')).toBe('granted');
      const event = app.db.consentEvents.list().filter((e) => e.caregiverId === 'cg_0003' && e.key === 'family_sharing').pop();
      expect(event?.status).toBe('granted');
      expect(event?.channel).toBe('app');
      expect(event?.registeredByUserId).toBe('cg_0003');
      expect(switches()).toHaveLength(3);
      expect(all('button').some((b) => text(b) === 'Autorizo')).toBe(false);
    });

    it('autorização retirada em Privacidade: volta o cartão, e o serviço recusa gerar o texto', async () => {
      await open('cg_0001');
      expect(switches()).toHaveLength(3);
      TestBed.inject(ConsentService).revoke('cg_0001', 'family_sharing', { channel: 'app', registeredByUserId: 'cg_0001' });
      await flush();
      expect(switches()).toHaveLength(0);
      expect(text(q('app-cg-card'))).toContain('Para compartilhar, precisamos da sua autorização');
      expect(() => TestBed.inject(FamilyShareService).text({ today: true, week: false, medications: false })).toThrow(FamilyShareError);
    });
  });

  it('o texto da tela não usa as palavras proibidas e não fala de plano', async () => {
    for (const id of ['cg_0001', 'cg_0003']) {
      await open(id);
      expect(text(q('main')), id).not.toMatch(/alerta|diagn|paciente|idoso|pontua|\bplano\b|R\$/i);
    }
  });
});
