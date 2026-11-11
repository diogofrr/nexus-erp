import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ConsentService } from '../../../core/privacy/consent.service';
import { ToastService } from '../../../shared/ui/overlay/toast.service';
import { ContactDialogService } from '../state/contact-dialog.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ProfileError, ProfileService } from './state/profile.service';
import { SignupService } from './state/signup.service';
import { ROUTES, PROFILE_ROUTES } from './start.routes';

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Começar e Meu perfil (UX C2 e C22)', () => {
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
  const type = async (selector: string, value: string, scope: ParentNode = app.root): Promise<void> => {
    const el = scope.querySelector<HTMLInputElement>(selector);
    if (!el) {
      throw new Error(`não achei ${selector}`);
    }
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
  };
  const buttonByText = (label: string): HTMLElement | undefined =>
    all<HTMLElement>('button, a').find((b) => text(b) === label);
  const openGuest = async (options: { time?: string; local?: import('../../../core/testing/test-helpers').FakeStorage; seed?: boolean } = {}): Promise<void> => {
    TestBed.resetTestingModule();
    app = await bootCaregiverApp(null, { url: '/cuidador/comecar', layout: 'drawer', ...options });
  };
  const open = async (id: string, url: string): Promise<void> => {
    TestBed.resetTestingModule();
    app = await bootCaregiverApp(id, { url });
  };

  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área e abre os dois endereços com os títulos certos', async () => {
    expect(ROUTES.length).toBeGreaterThan(0);
    expect(PROFILE_ROUTES.length).toBeGreaterThan(0);
    await openGuest();
    expect(app.router.url).toBe('/cuidador/comecar');
    expect(document.title).toContain('Começar');
    await open('cg_0001', '/cuidador/mais/perfil');
    expect(app.router.url).toBe('/cuidador/mais/perfil');
    expect(document.title).toContain('Meu perfil');
  });

  // ============================ Começar ============================

  describe('boas-vindas e o modo foco (AC-CG-24)', () => {
    it('h1 "Vamos começar", as três linhas, "Começar" e "Já tenho conta"; cabeçalho com Ajuda agora e sem barra inferior', async () => {
      await openGuest();
      expect(text(q('main h1'))).toBe('Vamos começar');
      const lines = all('.start-list li').map(text);
      expect(lines).toEqual([
        'Leva uns 5 minutos. Você pode parar e continuar depois.',
        'Você escolhe o que autoriza e pode mudar quando quiser.',
        'O plano Livre não custa nada e não pede cartão.',
      ]);
      expect(buttonByText('Começar')?.className).toContain('btn--primary');
      expect(buttonByText('Já tenho conta')?.getAttribute('href')).toBe('/login');
      expect(q('a.cg-help-now')?.getAttribute('href')).toBe('/cuidador/ajuda-agora');
      expect(all('.cg-nav--bottom')).toHaveLength(0);
      expect(q('.banner--prototype')).not.toBeNull();
    });

    it('as 5 etapas na ordem, com "Etapa X de 5" e o nome da etapa', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      expect(all('.stepper__label').map(text)).toEqual([
        'Sobre você',
        'Quem você cuida',
        'Seu dia a dia',
        'O que você autoriza',
        'Confira e termine',
      ]);
      expect(text(q('.step-counter'))).toContain('Etapa 1 de 5: Sobre você');
      expect(text(q('main h1'))).toBe('Sobre você');
      expect(document.activeElement?.tagName).toBe('H1');
      expect(text(q('[aria-live="polite"].sr-only'))).toBe('Etapa 1 de 5');
    });

    it('quem já tem sessão vai direto a Hoje', async () => {
      await open('cg_0001', '/cuidador/comecar');
      expect(app.router.url).toBe('/cuidador/hoje');
    });
  });

  /** Preenche a etapa 1 com dados válidos (CPF fictício). */
  const fillYou = async (overrides: Partial<Record<'name' | 'birth' | 'cpf' | 'phone' | 'email', string>> = {}): Promise<void> => {
    await type('#st-name', overrides.name ?? 'Marta Exemplo Teste');
    await type('#st-birth', overrides.birth ?? '1980-05-20');
    await type('#st-cpf', overrides.cpf ?? '00012345600');
    await type('#st-phone', overrides.phone ?? '34900000555');
    await type('#st-email', overrides.email ?? 'marta.teste@exemplo.com.br');
  };
  const fillElder = async (): Promise<void> => {
    await type('#st-elder-name', 'Alice Exemplo Teste');
    await type('#st-elder-birth', '1945-03-10');
    const select = q<HTMLSelectElement>('#st-relationship');
    if (!select) {
      throw new Error('sem select de parentesco');
    }
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    await click(all<HTMLInputElement>('.cg-choice__input')[1]);
  };
  const toStep = async (n: number): Promise<void> => {
    await click(buttonByText('Começar'));
    if (n >= 1) {
      await fillYou();
      await click(buttonByText('Continuar'));
    }
    if (n >= 2) {
      await fillElder();
      await click(buttonByText('Continuar'));
    }
    if (n >= 3) {
      await type('#st-hours', '4');
      await click(all<HTMLInputElement>('.cg-choice__input')[0]);
      await click(buttonByText('Continuar'));
    }
    if (n >= 4) {
      await click(buttonByText('Continuar'));
    }
  };

  describe('etapa 1, Sobre você (AC-CG-25 e 26)', () => {
    it('tem os 6 campos, o botão de exemplo e a dica de CPF fictício', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      expect(all('app-form-field label').map(text)).toEqual(['Nome completo', 'Data de nascimento', 'CPF', 'Celular', 'E-mail', 'Cidade']);
      expect(q<HTMLInputElement>('#st-city')?.value).toBe('Uberlândia');
      // CXC-015: uma frase antes do CPF diz para que ele serve.
      expect(text(q('main'))).toContain('Serve para identificar a sua conta. No protótipo, use um CPF fictício.');
      expect(text(q('main'))).toContain('Exemplo: (34) 90000-0000');
      expect(text(q('main'))).toContain('Use um e-mail que termine em @exemplo.com.br');
      expect(buttonByText('Gerar CPF fictício')).toBeDefined();
      expect(buttonByText('Preencher com dados de exemplo')).toBeDefined();
    });

    it('menos de 18 anos: a frase junto do campo e no resumo, e nada digitado é apagado; com exatamente 18 anos passa', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      await fillYou({ birth: '2008-11-05' });
      await click(buttonByText('Continuar'));
      expect(text(q('main h1'))).toBe('Sobre você');
      expect(text(q('app-form-field .field__error'))).toContain('Você precisa ter 18 anos ou mais.');
      // CXC-024: com um ponto só a caixa grande nem aparece; a frase está junto do campo e o foco vai a ele.
      expect(text(q('app-error-summary'))).toBe('');
      expect(document.activeElement?.id).toBe('st-birth');
      expect(q<HTMLInputElement>('#st-name')?.value).toBe('Marta Exemplo Teste');
      expect(q<HTMLInputElement>('#st-cpf')?.value).toBe('000.123.456-00');
      // Hoje é 04/11/2026: nascer em 04/11/2008 dá exatamente 18 anos.
      await type('#st-birth', '2008-11-04');
      await click(buttonByText('Continuar'));
      expect(text(q('main h1'))).toBe('Quem você cuida');
    });

    it('CPF que parece real: a frase do UX; "Gerar CPF fictício" põe um fictício e o erro some', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      await fillYou({ cpf: '52998224725' });
      await click(buttonByText('Continuar'));
      expect(text(q('app-form-field .field__error'))).toContain('Parece um CPF real. Use um CPF fictício.');
      await click(buttonByText('Gerar CPF fictício'));
      const cpf = q<HTMLInputElement>('#st-cpf')?.value ?? '';
      expect(cpf).toMatch(/^000\.\d{3}\.\d{3}-0[01]$/);
      expect(all('app-form-field .field__error').filter((e) => text(e).includes('CPF real'))).toHaveLength(0);
      await click(buttonByText('Continuar'));
      expect(text(q('main h1'))).toBe('Quem você cuida');
    });

    it('campos em branco: erro junto de cada campo e um resumo curto (só quantos pontos, sem repetir a lista), com o foco no resumo (CXC-023)', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      await click(buttonByText('Continuar'));
      expect(text(q('app-error-summary'))).toContain('Há 5 pontos para corrigir');
      expect(text(q('app-error-summary'))).toContain('Eles estão marcados abaixo, junto de cada campo.');
      expect(q('app-error-summary a')).toBeNull();
      expect(text(q('app-error-summary'))).not.toContain('Informe o nome completo.');
      expect(all('app-form-field .field__error')).toHaveLength(5);
      expect(text(q('app-form-field .field__error'))).toContain('Informe o nome completo.');
    });

    it('um CPF fictício que já tem conta é recusado', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      const taken = app.db.caregivers.list()[0]?.cpf ?? '';
      await fillYou({ cpf: taken.replace(/\D/g, '') });
      await click(buttonByText('Continuar'));
      expect(text(q('app-form-field .field__error'))).toContain('Já existe uma conta com este CPF fictício.');
    });

    it('"Preencher com dados de exemplo" preenche com dados fictícios e dá para continuar', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      await click(buttonByText('Preencher com dados de exemplo'));
      expect(q<HTMLInputElement>('#st-email')?.value).toMatch(/@exemplo\.com\.br$/);
      await click(buttonByText('Continuar'));
      expect(text(q('main h1'))).toBe('Quem você cuida');
      expect(q<HTMLInputElement>('#st-elder-name')?.value).toContain('Exemplo');
    });
  });

  describe('etapa 2, Quem você cuida', () => {
    it('não pede condição de saúde nem remédio; a rotina vem em 3 cartões, nada marcado', async () => {
      await openGuest();
      await toStep(1);
      expect(text(q('main h1'))).toBe('Quem você cuida');
      expect(all('app-form-field label').map(text)).toEqual(['Nome da pessoa idosa', 'Data de nascimento dela', 'Quem é essa pessoa para você?']);
      expect(all('.cg-choice__label').map(text)).toEqual([
        'Faz quase tudo sem ajuda',
        'Precisa de ajuda em algumas tarefas',
        'Precisa de ajuda em quase tudo',
      ]);
      expect(all<HTMLInputElement>('.cg-choice__input').filter((i) => i.checked)).toHaveLength(0);
      expect(Array.from(q<HTMLSelectElement>('#st-relationship')?.options ?? []).map(text)).toEqual([
        'Escolha uma opção',
        'Filha',
        'Filho',
        'Esposa ou marido',
        'Nora',
        'Neto ou neta',
        'Outro',
      ]);
      expect(text(q('main'))).toContain('Os remédios você cadastra depois, em Rotina.');
      await click(buttonByText('Continuar'));
      expect(text(q('app-error-summary'))).toContain('Há 4 pontos para corrigir');
    });
  });

  describe('etapa 3, Seu dia a dia (AC-CG-27)', () => {
    it('horas fora de 0 a 24: a frase do UX; os botões menos e mais ficam entre 0 e 24', async () => {
      await openGuest();
      await toStep(2);
      expect(text(q('main h1'))).toBe('Seu dia a dia');
      await type('#st-hours', '25');
      await click(all<HTMLInputElement>('.cg-choice__input')[0]);
      await click(buttonByText('Continuar'));
      expect(text(q('app-form-field .field__error'))).toContain('As horas por dia devem ser de 0 a 24.');
      await type('#st-hours', '24');
      await click(q('button[aria-label="Mais uma hora por dia"]'));
      expect(q<HTMLInputElement>('#st-hours')?.value).toBe('24');
      await type('#st-hours', '0');
      await click(q('button[aria-label="Menos uma hora por dia"]'));
      expect(q<HTMLInputElement>('#st-hours')?.value).toBe('0');
    });

    it('canal WhatsApp: o campo do número aparece já preenchido com o celular; o tamanho da letra vale na hora', async () => {
      await openGuest();
      await toStep(2);
      expect(q('#st-whatsapp')).toBeNull();
      await click(all<HTMLInputElement>('.cg-choice__input')[1]);
      expect(all('.cg-choice__label').map(text)).toEqual(['Pelo aplicativo', 'Pelo WhatsApp', 'Por telefone']);
      expect(q<HTMLInputElement>('#st-whatsapp')?.value).toBe('(34) 90000-0555');
      await click(all<HTMLInputElement>('.cg-text-size__input')[2]);
      expect(q('app-caregiver-shell')?.getAttribute('data-text')).toBe('xlarge');
      expect(text(q('main'))).toContain('Assim fica o texto no seu aplicativo.');
    });
  });

  describe('etapa 4, O que você autoriza (AC-CG-28 e 29)', () => {
    it('CXC-015: a saúde em duas frases com "Ler mais"; as outras quatro recolhidas em "Outras autorizações (opcional)"; cinco cartões independentes, nada marcado, nada de piloto', async () => {
      await openGuest();
      await toStep(3);
      expect(text(q('main h1'))).toBe('O que você autoriza');
      expect(text(q('main'))).toContain('Você escolhe cada item separado.');
      // Só a saúde aparece de cara, curta; as outras quatro estão atrás do bloco opcional, que começa fechado.
      expect(all('app-cg-card[data-consent]').map((c) => c.getAttribute('data-consent'))).toEqual(['health_data']);
      const toggle = q('[data-role="others-toggle"]');
      expect(text(toggle)).toBe('Outras autorizações (opcional)');
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
      expect(text(q('main'))).toContain('Se você não abrir esta parte, tudo fica em "Decidir depois".');
      const health = q('app-cg-card[data-consent="health_data"]');
      expect(text(health?.querySelector('.start-p')).split(/(?<=\.)\s/)).toHaveLength(2);
      expect(text(health)).not.toContain('O que vamos fazer');
      await click(health?.querySelector('button.cg-link-btn'));
      expect(text(health)).toContain('O que vamos fazer');
      expect(text(health)).toContain('Se você disser não');
      await click(toggle);
      expect(toggle?.getAttribute('aria-expanded')).toBe('true');
      const cards = all('app-cg-card[data-consent]');
      expect(cards.map((c) => c.getAttribute('data-consent'))).toEqual([
        'health_data',
        'people_analytics',
        'family_sharing',
        'image_testimony',
        'whatsapp_contact',
      ]);
      cards.forEach((card) => {
        expect(Array.from(card.querySelectorAll('.cg-choice__label')).map(text)).toEqual(['Concordo', 'Não concordo', 'Decidir depois']);
        expect(Array.from(card.querySelectorAll<HTMLInputElement>('.cg-choice__input')).filter((i) => i.checked)).toHaveLength(0);
        const classes = Array.from(card.querySelectorAll('.cg-choice')).map((l) => l.className);
        expect(new Set(classes).size).toBe(1);
      });
      expect(text(q('main'))).not.toMatch(/piloto|TCLE/i);
      // As outras ficam recolhidas até "Ler mais".
      expect(text(cards[1])).not.toContain('O que vamos fazer');
      await click(cards[1]?.querySelector('button.cg-link-btn'));
      expect(text(cards[1])).toContain('O que vamos fazer');
    });

    it('quem não escolhe nada fica em "Decidir depois" (pendente) e a conta é criada normalmente no plano Livre', async () => {
      await openGuest();
      await toStep(4);
      expect(text(q('main h1'))).toBe('Confira e termine');
      // CXC-015: a etapa 5 é uma linha por bloco, sem repetir tudo.
      expect(all('[data-role="review"] li')).toHaveLength(4);
      expect(text(q('[data-role="review"]'))).toContain('Saúde: Decidir depois. Outras 4: Decidir depois.');
      await click(q<HTMLInputElement>('app-checkbox input'));
      await click(buttonByText('Criar minha conta'));
      const created = app.db.caregivers.find((c) => c.fullName === 'Marta Exemplo Teste');
      expect(created).toBeDefined();
      const consent = TestBed.inject(ConsentService);
      expect(consent.list(created?.id ?? '').map((c) => c.status)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending', 'pending']);
      expect(app.db.subscriptions.find((s) => s.caregiverId === created?.id)?.planId).toBe('livre');
      expect(text(q('main'))).toContain('A agenda, os remédios e os conteúdos continuam. A conversa de acompanhamento só acontece com a sua autorização.');
      expect(text(q('main'))).not.toContain('Tudo bem.');
    });

    it('saúde recusada: a nota (sem "Tudo bem") aparece na hora e a conta é criada no plano Livre', async () => {
      await openGuest();
      await toStep(3);
      const health = q('app-cg-card[data-consent="health_data"]');
      await click(health?.querySelectorAll<HTMLInputElement>('.cg-choice__input')[1]);
      expect(text(q('main'))).toContain('A agenda, os remédios e os conteúdos continuam.');
      await click(buttonByText('Continuar'));
      await click(q<HTMLInputElement>('app-checkbox input'));
      await click(buttonByText('Criar minha conta'));
      const created = app.db.caregivers.find((c) => c.fullName === 'Marta Exemplo Teste');
      expect(TestBed.inject(ConsentService).status(created?.id ?? '', 'health_data')).toBe('refused');
      expect(app.db.subscriptions.find((s) => s.caregiverId === created?.id)?.planId).toBe('livre');
    });
  });

  describe('etapa 5 e a conta nova (AC-CG-30 e 31)', () => {
    const answer = async (key: string, index: number): Promise<void> => {
      if (!q(`app-cg-card[data-consent="${key}"]`)) {
        await click(q('[data-role="others-toggle"]'));
      }
      await click(q(`app-cg-card[data-consent="${key}"]`)?.querySelectorAll<HTMLInputElement>('.cg-choice__input')[index]);
    };

    it('sem o aceite do aviso de emergência a conta não é criada e a frase aparece; com o aceite, grava a data e a hora', async () => {
      await openGuest({ time: '10:42' });
      await toStep(4);
      const before = app.db.caregivers.size();
      await click(buttonByText('Criar minha conta'));
      expect(app.db.caregivers.size()).toBe(before);
      expect(text(q('#st-notice'))).toContain('Marque que você leu o aviso para criar a conta.');
      expect(text(q('main'))).toContain('Em emergência, ligue 192 (SAMU).');
      expect(text(q('#st-notice'))).toContain('Marque que você leu o aviso para criar a conta.');
      await click(q<HTMLInputElement>('app-checkbox input'));
      await click(buttonByText('Criar minha conta'));
      expect(app.db.caregivers.size()).toBe(before + 1);
      const created = app.db.caregivers.find((c) => c.fullName === 'Marta Exemplo Teste');
      expect(created?.emergencyNoticeAcceptedAt).toBe('2026-11-04T10:42:00-03:00');
    });

    it('nasce 1 cuidador ativo, 1 pessoa idosa vinculada, 1 assinatura Livre e 6 consentimentos com o que foi escolhido', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      await fillYou();
      await click(buttonByText('Continuar'));
      await fillElder();
      await click(buttonByText('Continuar'));
      await type('#st-hours', '6');
      await click(all<HTMLInputElement>('.cg-choice__input')[1]);
      await type('#st-whatsapp', '(34) 90000-0777');
      await click(buttonByText('Continuar'));
      await answer('health_data', 0);
      await answer('people_analytics', 1);
      await answer('family_sharing', 0);
      await answer('whatsapp_contact', 0);
      await click(buttonByText('Continuar'));
      const review = text(q('[data-role="review"]'));
      expect(review).toContain('6 h por dia · Pelo WhatsApp');
      expect(review).toContain('Saúde: Concordo. Outras: 2 concordo, 1 não concordo, 1 decidir depois.');
      const caregiversBefore = app.db.caregivers.size();
      const eldersBefore = app.db.elders.size();
      const subsBefore = app.db.subscriptions.size();
      await click(q<HTMLInputElement>('app-checkbox input'));
      await click(buttonByText('Criar minha conta'));

      expect(app.db.caregivers.size()).toBe(caregiversBefore + 1);
      expect(app.db.elders.size()).toBe(eldersBefore + 1);
      expect(app.db.subscriptions.size()).toBe(subsBefore + 1);
      const created = app.db.caregivers.find((c) => c.fullName === 'Marta Exemplo Teste');
      expect(created?.code).toBe('CUI-0341');
      expect(created?.status).toBe('active');
      expect(created?.dailyCareHours).toBe(6);
      expect(created?.preferredChannel).toBe('whatsapp');
      expect(created?.whatsapp).toBe('(34) 90000-0777');
      expect(created?.relationship).toBe('daughter');
      expect(created?.cpf).toBe('000.123.456-00');
      const elder = app.db.elders.find((e) => e.caregiverId === created?.id);
      expect(elder?.fullName).toBe('Alice Exemplo Teste');
      expect(elder?.dependency).toBe('partial');
      expect(elder?.conditionsSummary).toBeUndefined();
      expect(app.db.subscriptions.find((s) => s.caregiverId === created?.id)?.planId).toBe('livre');
      const statuses = Object.fromEntries(TestBed.inject(ConsentService).list(created?.id ?? '').map((c) => [c.key, c.status]));
      expect(statuses).toEqual({
        health_data: 'granted',
        people_analytics: 'refused',
        family_sharing: 'granted',
        image_testimony: 'pending',
        whatsapp_contact: 'granted',
        pilot_tcle: 'pending',
      });
      const events = app.db.consentEvents.query((e) => e.caregiverId === created?.id);
      expect(events).toHaveLength(4);
      events.forEach((e) => expect(e.channel).toBe('app'));
      // A pessoa entra com a conta nova e vê a tela "Tudo pronto".
      expect(app.context.caregiverId()).toBe(created?.id);
      expect(text(q('main h1'))).toBe('Tudo pronto, Marta.');
      expect(text(q('main'))).toContain('Sua conta no plano Livre está criada.');
      expect(text(q('main'))).toContain('Se você autorizou o acompanhamento, a equipe de psicologia entra em contato para uma primeira conversa.');
      expect(all('.cg-row__title').map(text)).toEqual(['Cadastrar os remédios', 'Adicionar um compromisso', 'Conhecer o Cuidar de mim']);
      expect(buttonByText('Ir para Hoje')?.getAttribute('href')).toBe('/cuidador/hoje');
      // O rascunho se foi.
      expect([...app.local.data.keys()].some((k) => k.includes('draft:caregiver-start'))).toBe(false);
    });

    it('o novo cuidador aparece na lista do ERP e recebe o próximo código', async () => {
      await openGuest();
      await toStep(4);
      await click(q<HTMLInputElement>('app-checkbox input'));
      await click(buttonByText('Criar minha conta'));
      const created = app.db.caregivers.find((c) => c.fullName === 'Marta Exemplo Teste');
      expect(created?.id).toBe('cg_0341');
      expect(app.db.caregivers.size()).toBe(341);
      // Um segundo cadastro continua a numeração.
      expect(TestBed.inject(SignupService).cpfTaken('000.123.456-00')?.code).toBe('CUI-0341');
    });

    it('WhatsApp como canal sem autorizar o contato por WhatsApp: a conta nasce com o aplicativo e guarda o número', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      await fillYou();
      await click(buttonByText('Continuar'));
      await fillElder();
      await click(buttonByText('Continuar'));
      await type('#st-hours', '2');
      await click(all<HTMLInputElement>('.cg-choice__input')[1]);
      await click(buttonByText('Continuar'));
      await click(q('[data-role="others-toggle"]'));
      expect(text(q('main'))).toContain('Sem esta autorização, falamos pelo aplicativo.');
      await click(buttonByText('Continuar'));
      await click(q<HTMLInputElement>('app-checkbox input'));
      await click(buttonByText('Criar minha conta'));
      const created = app.db.caregivers.find((c) => c.fullName === 'Marta Exemplo Teste');
      expect(created?.preferredChannel).toBe('app');
      expect(created?.whatsapp).toBe('(34) 90000-0555');
    });

    it('CXC-013: o voltar do aparelho volta um passo do cadastro, e da etapa 1 às boas-vindas', async () => {
      await openGuest();
      await click(buttonByText('Começar'));
      await fillYou();
      await click(buttonByText('Continuar'));
      expect(text(q('main h1'))).toBe('Quem você cuida');
      const back = async (): Promise<void> => {
        window.history.back();
        await new Promise((resolve) => setTimeout(resolve, 40));
        await flush();
      };
      await back();
      expect(text(q('main h1'))).toBe('Sobre você');
      expect(q<HTMLInputElement>('#st-name')?.value).toBe('Marta Exemplo Teste');
      await back();
      expect(text(q('main h1'))).toBe('Vamos começar');
      expect(app.router.url).toBe('/cuidador/comecar');
    });

    it('"Editar" no resumo volta à etapa e mantém os dados; "Voltar" também', async () => {
      await openGuest();
      await toStep(4);
      await click(all('[data-role="review"] button').find((b) => text(b).startsWith('Editar')));
      expect(text(q('main h1'))).toBe('Sobre você');
      expect(q<HTMLInputElement>('#st-name')?.value).toBe('Marta Exemplo Teste');
      await click(buttonByText('Continuar'));
      expect(text(q('main h1'))).toBe('Quem você cuida');
      await click(buttonByText('Voltar'));
      // O "Voltar" segue o voltar do aparelho (CXC-013): o histórico responde um instante depois.
      await new Promise((resolve) => setTimeout(resolve, 40));
      await flush();
      expect(text(q('main h1'))).toBe('Sobre você');
      expect(q<HTMLInputElement>('#st-birth')?.value).toBe('1980-05-20');
    });
  });

  describe('AC-CG-32: rascunho', () => {
    it('guarda a cada etapa, mostra a hora e, ao voltar, pergunta "Retomar ou começar de novo?" com dois botões iguais', async () => {
      await openGuest({ time: '10:42' });
      await toStep(2);
      expect(text(q('.start-status'))).toBe('Rascunho salvo às 10:42');
      const local = app.local;
      await openGuest({ time: '11:10', local, seed: false });
      expect(text(q('main h1'))).toBe('Vamos começar');
      expect(text(q('app-cg-note'))).toContain('Você tem um cadastro em andamento');
      expect(text(q('app-cg-note'))).toContain('Retomar ou começar de novo?');
      const resume = buttonByText('Retomar');
      const startOver = buttonByText('Começar de novo');
      expect(resume?.className).toBe(startOver?.className);
      await click(resume);
      expect(text(q('main h1'))).toBe('Seu dia a dia');
      await click(buttonByText('Voltar'));
      expect(q<HTMLInputElement>('#st-elder-name')?.value).toBe('Alice Exemplo Teste');
      expect(q<HTMLSelectElement>('#st-relationship')?.selectedIndex).toBe(1);
      expect(all<HTMLInputElement>('.cg-choice__input')[1]?.checked).toBe(true);
      await click(buttonByText('Voltar'));
      expect(q<HTMLInputElement>('#st-name')?.value).toBe('Marta Exemplo Teste');
      expect(q<HTMLInputElement>('#st-cpf')?.value).toBe('000.123.456-00');
      expect(q<HTMLInputElement>('#st-birth')?.value).toBe('1980-05-20');
    });

    it('"Começar de novo" apaga o rascunho', async () => {
      await openGuest();
      await toStep(1);
      const local = app.local;
      await openGuest({ local, seed: false });
      await click(buttonByText('Começar de novo'));
      expect(all('main app-cg-note')).toHaveLength(0);
      expect([...app.local.data.keys()].some((k) => k.includes('draft:caregiver-start'))).toBe(false);
    });
  });

  it('AC-CG-33: nenhuma etapa pede número de cartão, validade, pagamento, condição de saúde ou remédio', async () => {
    await openGuest();
    await click(buttonByText('Começar'));
    for (let step = 0; step < 4; step += 1) {
      const labels = all('main label, main legend, main h2, main h3').map(text).join(' | ');
      expect(labels, `etapa ${step + 1}`).not.toMatch(/cart[aã]o de cr|validade|cvv|pagamento|condi[cç][aã]o de sa[uú]de|diagn|medicamento|rem[eé]dio d/i);
      if (step === 0) {
        await fillYou();
      } else if (step === 1) {
        await fillElder();
      } else if (step === 2) {
        await type('#st-hours', '3');
        await click(all<HTMLInputElement>('.cg-choice__input')[0]);
      }
      await click(buttonByText('Continuar'));
    }
    expect(all<HTMLInputElement>('input').filter((i) => /card|cc-|cartao|cvv|expir/i.test(`${i.name} ${i.id} ${i.getAttribute('autocomplete') ?? ''}`))).toHaveLength(0);
  });

  // ============================ Meu perfil ============================

  describe('Meu perfil: AC-CG-185', () => {
    it('h1, os 3 cartões com os dados (CPF inteiro, sem máscara) e o seletor de tamanho da letra', async () => {
      await open('cg_0001', '/cuidador/mais/perfil');
      const ana = app.db.caregivers.get('cg_0001');
      const elder = app.db.elders.find((e) => e.caregiverId === 'cg_0001');
      expect(text(q('main h1'))).toBe('Meu perfil');
      expect(all('app-cg-card h2').map(text)).toEqual(['Você', 'Quem você cuida', 'Seu dia a dia']);
      const cards = all('app-cg-card');
      expect(text(cards[0])).toContain(ana?.fullName ?? '??');
      // CXC-024: o CPF começa recolhido e a pessoa o mostra com um toque (é o dado dela, sem máscara quando pedido).
      expect(text(cards[0])).not.toContain(ana?.cpf ?? '??');
      expect(text(cards[0].querySelector('[data-role="cpf"]'))).toBe('•••.•••.•••-••');
      await click(cards[0].querySelector('[data-role="toggle-cpf"]'));
      expect(text(cards[0])).toContain(ana?.cpf ?? '??');
      expect(ana?.cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
      expect(text(cards[0])).toContain(ana?.phone ?? '??');
      expect(text(cards[0])).toContain(ana?.email ?? '??');
      expect(text(cards[1])).toContain(elder?.fullName ?? '??');
      expect(text(cards[1])).toContain('Filha');
      expect(text(cards[2])).toContain(`${ana?.dailyCareHours}`);
      expect(text(cards[2])).toContain('Pelo aplicativo');
      // O tamanho da letra fica só em Mais (docs/20, regra 4: nada repetido); o perfil são os 3 cartões.
      expect(all('.cg-text-size__input')).toHaveLength(0);
      expect(all('app-cg-card').filter((c) => c.querySelector('button')).length).toBe(3);
    });

    it('AC-CG-189: nada de condição de saúde, remédio, diagnóstico, atendimento, grupo ou escala', async () => {
      await open('cg_0001', '/cuidador/mais/perfil');
      const elder = app.db.elders.find((e) => e.caregiverId === 'cg_0001');
      const main = text(q('main'));
      if (elder?.conditionsSummary) {
        expect(main).not.toContain(elder.conditionsSummary);
      }
      app.db.medications.query((m) => m.elderId === elder?.id).forEach((m) => expect(main).not.toContain(m.name));
      expect(main).not.toMatch(/diagn|rem[eé]dio|sobrecarga|escala|zarit|grupo|psic[oó]log|\bplano\b/i);
    });
  });

  describe('Meu perfil: AC-CG-186 a 188 e 190', () => {
    const sheet = (): HTMLElement => {
      const found = all('dialog[open]');
      expect(found).toHaveLength(1);
      return found[0] as HTMLElement;
    };
    const editButton = (card: number): HTMLElement | undefined =>
      Array.from(all('app-cg-card')[card]?.querySelectorAll<HTMLElement>('button.cg-link-btn') ?? []).find((b) => text(b).startsWith('Editar'));
    const saveButton = (): HTMLElement | undefined =>
      Array.from(sheet().querySelectorAll<HTMLElement>('button')).find((b) => text(b) === 'Salvar alterações');

    it('"Editar" abre a folha só daquela seção, valida sem apagar o digitado e salva com "Dados salvos."', async () => {
      await open('cg_0001', '/cuidador/mais/perfil');
      await click(editButton(0));
      expect(text(sheet().querySelector('.cg-sheet__title'))).toBe('Editar: Você');
      expect(Array.from(sheet().querySelectorAll('app-form-field label')).map(text)).toEqual(['Nome completo', 'Data de nascimento', 'Celular', 'E-mail', 'Cidade']);
      // Sem CPF, sem campo da pessoa idosa e sem campo do dia a dia nesta folha.
      expect(sheet().querySelector('#pf-cpf, #pf-elder-name, #pf-hours')).toBeNull();
      await type('#pf-email', 'errado@gmail.com', sheet());
      await type('#pf-birth', '2015-01-01', sheet());
      await type('#pf-name', 'Ana Paula Ferraz Souza', sheet());
      await click(saveButton());
      expect(text(sheet().querySelector('app-error-summary'))).toContain('Há 2 pontos para corrigir');
      expect(text(sheet())).toContain('Use um e-mail que termine em @exemplo.com.br.');
      expect(text(sheet())).toContain('Você precisa ter 18 anos ou mais.');
      expect(sheet().querySelector<HTMLInputElement>('#pf-name')?.value).toBe('Ana Paula Ferraz Souza');
      expect(app.db.caregivers.get('cg_0001')?.fullName).toBe('Ana Paula Ferraz');
      await type('#pf-email', 'ana.nova@exemplo.com.br', sheet());
      await type('#pf-birth', '1981-02-03', sheet());
      await click(saveButton());
      expect(all('dialog[open]')).toHaveLength(0);
      const ana = app.db.caregivers.get('cg_0001');
      expect(ana?.fullName).toBe('Ana Paula Ferraz Souza');
      expect(ana?.email).toBe('ana.nova@exemplo.com.br');
      expect(ana?.birthDate).toBe('1981-02-03');
      expect(TestBed.inject(ToastService).toasts()[0]?.message).toBe('Dados salvos.');
      expect(text(all('app-cg-card')[0])).toContain('Ana Paula Ferraz Souza');
    });

    it('salvar sem mudar nada diz "Nada mudou." e não é erro', async () => {
      await open('cg_0001', '/cuidador/mais/perfil');
      await click(editButton(0));
      await click(saveButton());
      expect(all('dialog[open]')).toHaveLength(0);
      expect(TestBed.inject(ToastService).toasts()[0]?.message).toBe('Nada mudou.');
    });

    it('"Quem você cuida": muda o nome, o parentesco e a rotina da pessoa', async () => {
      await open('cg_0001', '/cuidador/mais/perfil');
      await click(editButton(1));
      expect(text(sheet().querySelector('.cg-sheet__title'))).toBe('Editar: Quem você cuida');
      await type('#pf-elder-name', 'Benedito Ferraz Neto', sheet());
      const select = sheet().querySelector<HTMLSelectElement>('#pf-relationship');
      select?.dispatchEvent(new Event('change'));
      if (select) {
        select.selectedIndex = 2;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await flush();
      await click(sheet().querySelectorAll<HTMLInputElement>('.cg-choice__input')[2]);
      await click(saveButton());
      const elder = app.db.elders.find((e) => e.caregiverId === 'cg_0001');
      expect(elder?.fullName).toBe('Benedito Ferraz Neto');
      expect(elder?.dependency).toBe('total');
      expect(app.db.caregivers.get('cg_0001')?.relationship).toBe('son');
    });

    it('AC-CG-190: mudar as horas por dia salva sem aviso adicional e sem falar de risco', async () => {
      await open('cg_0001', '/cuidador/mais/perfil');
      await click(editButton(2));
      await type('#pf-hours', '10', sheet());
      await click(saveButton());
      expect(app.db.caregivers.get('cg_0001')?.dailyCareHours).toBe(10);
      const toasts = TestBed.inject(ToastService).toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0]?.message).toBe('Dados salvos.');
      expect(text(q('main'))).not.toMatch(/risco|avalia|alerta|reavalia/i);
    });

    it('AC-CG-187: prefere WhatsApp sem número: a nota com "Informar o número"; ao informar, a nota some', async () => {
      await open('cg_0002', '/cuidador/mais/perfil');
      expect(text(q('main'))).not.toContain('Você prefere o WhatsApp, mas não informou o número.');
      app.db.caregivers.update('cg_0002', { whatsapp: undefined });
      await flush();
      expect(text(q('main app-cg-note'))).toContain('Você prefere o WhatsApp, mas não informou o número. Informe para a equipe poder falar com você.');
      await click(buttonByText('Informar o número'));
      expect(text(sheet().querySelector('.cg-sheet__title'))).toBe('Editar: Seu dia a dia');
      const field = sheet().querySelector<HTMLInputElement>('#pf-whatsapp');
      expect(field?.value).toBe(app.db.caregivers.get('cg_0002')?.phone);
      await type('#pf-whatsapp', '34900000222', sheet());
      await click(saveButton());
      expect(app.db.caregivers.get('cg_0002')?.whatsapp).toBe('(34) 90000-0222');
      expect(all('main app-cg-note')).toHaveLength(0);
    });

    it('trocar o canal de WhatsApp para telefone não apaga o número do WhatsApp', async () => {
      await open('cg_0002', '/cuidador/mais/perfil');
      const number = app.db.caregivers.get('cg_0002')?.whatsapp;
      expect(number).toBeTruthy();
      await click(editButton(2));
      await click(sheet().querySelectorAll<HTMLInputElement>('.cg-choice__input')[2]);
      await click(saveButton());
      expect(app.db.caregivers.get('cg_0002')?.preferredChannel).toBe('phone');
      expect(app.db.caregivers.get('cg_0002')?.whatsapp).toBe(number);
    });

    it('horas fora de 0 a 24 e WhatsApp sem número aparecem como erro na folha', async () => {
      await open('cg_0001', '/cuidador/mais/perfil');
      await click(editButton(2));
      await type('#pf-hours', '30', sheet());
      await click(saveButton());
      expect(text(sheet())).toContain('As horas por dia devem ser de 0 a 24.');
      await type('#pf-hours', '5', sheet());
      await click(sheet().querySelectorAll<HTMLInputElement>('.cg-choice__input')[1]);
      await type('#pf-whatsapp', '', sheet());
      await click(saveButton());
      expect(text(sheet())).toContain('Informe o número do WhatsApp.');
    });

    it('AC-CG-188: o CPF não é editável e o texto leva ao diálogo "Como falar com a gente"', async () => {
      await open('cg_0001', '/cuidador/mais/perfil');
      expect(all('input').filter((i) => /cpf/i.test(`${i.id} ${i.getAttribute('formcontrolname') ?? ''}`))).toHaveLength(0);
      const link = buttonByText('Para corrigir o CPF, fale com a gente.');
      expect(link).toBeDefined();
      await click(link);
      expect(TestBed.inject(ContactDialogService).isOpen()).toBe(true);
    });

    it('o serviço também recusa o que a tela recusa e nunca mexe no CPF', async () => {
      await open('cg_0001', '/cuidador/mais/perfil');
      const service = TestBed.inject(ProfileService);
      const base = { fullName: 'Ana Paula Ferraz', birthDate: '1981-02-03', phone: '(34) 90000-0001', email: 'ana@exemplo.com.br', city: 'Uberlândia' };
      expect(() => service.updateYou('cg_0001', { ...base, birthDate: '2015-01-01' })).toThrow(ProfileError);
      expect(() => service.updateYou('cg_0001', { ...base, email: 'ana@gmail.com' })).toThrow(ProfileError);
      expect(() => service.updateDaily('cg_0001', { hours: 25, channel: 'app', whatsapp: '' })).toThrow('As horas por dia devem ser de 0 a 24.');
      const cpf = app.db.caregivers.get('cg_0001')?.cpf;
      service.updateYou('cg_0001', { ...base, city: 'Araguari' });
      expect(app.db.caregivers.get('cg_0001')?.cpf).toBe(cpf);
      expect(app.db.caregivers.get('cg_0001')?.city).toBe('Araguari');
    });
  });
});
