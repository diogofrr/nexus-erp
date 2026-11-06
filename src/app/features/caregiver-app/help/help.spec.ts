import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { CaregiverMessagesService } from '@core/care/caregiver-messages.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES, HELP_NOW_ROUTES } from './help.routes';

/**
 * Ajuda agora (C3, AC-CG-34 a 40) e Falar com a Nexus (C19, AC-CG-159 a 165). A fumaça de cada rota continua no
 * começo; depois, os fluxos, os estados e o texto sem as palavras proibidas.
 */
const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Área help (Falar com a Nexus e Ajuda agora)', () => {
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
  const button = (label: string): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find((b) => text(b).includes(label));
  const pageText = (): string => text(q('main'));

  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
    expect(HELP_NOW_ROUTES.length).toBeGreaterThan(0);
  });

  const cases = [
    { url: '/cuidador/mais/ajuda', final: '/cuidador/mais/ajuda', title: 'Falar com a Nexus', signedIn: true },
    { url: '/cuidador/ajuda-agora', final: '/cuidador/ajuda-agora', title: 'Ajuda agora', signedIn: false },
  ];

  cases.forEach((c) => {
    it(`abre ${c.url}${c.url === c.final ? '' : ` e vai a ${c.final}`} com o título "${c.title}"`, async () => {
      app = await bootCaregiverApp(c.signedIn ? 'cg_0001' : null, { url: c.url });
      expect(app.router.url).toBe(c.final);
      expect(q('main h1')?.textContent?.trim()).toBeTruthy();
      expect(document.title).toContain(c.title);
    });
  });

  describe('Ajuda agora (C3)', () => {
    it('AC-CG-34: mostra, nesta ordem, Emergência de saúde (192), CVV (188) e a equipe da Nexus, com "Mais contatos" recolhido', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/ajuda-agora' });
      expect(text(q('main h1'))).toBe('Ajuda agora');
      expect(text(q('.cg-page-header__desc'))).toBe('Escolha o que combina com o que está acontecendo.');
      const titles = all('main h2, main h3').map(text);
      expect(titles.slice(0, 3)).toEqual([
        'Emergência de saúde',
        'Estou muito mal ou penso em me machucar',
        'Falar com a equipe da Nexus',
      ]);
      expect(text(q('[data-role="help-samu"]'))).toContain('192');
      expect(text(q('[data-role="help-samu"]'))).toContain('A pessoa idosa ou você precisa de atendimento de saúde agora.');
      expect(text(q('[data-role="help-cvv"]'))).toContain('Ligue 188');
      expect(text(q('[data-role="help-nexus"]'))).toContain('Em horário comercial, a ligação é atendida na hora.');
      const more = q<HTMLDetailsElement>('[data-role="help-more"]');
      expect(more?.open).toBe(false);
      expect(text(more)).toContain('Disque 100');
      expect(text(more)).toContain('CRAS do seu bairro');
      const samuBtn = button('Ligar para o SAMU 192');
      const cvvBtn = button('Ligar para o CVV 188');
      expect(samuBtn).toBeDefined();
      expect(cvvBtn).toBeDefined();
      expect(text(button('Como falar com a gente'))).toBe('Como falar com a gente');
    });

    it('AC-CG-35: tocar no número abre o diálogo com o número grande, "Copiar número" e a frase de que a ligação não é feita; nenhum tel:', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/ajuda-agora' });
      await click(button('Ligar para o SAMU 192'));
      const dialog = q('app-call-number-sheet dialog');
      expect(dialog?.hasAttribute('open')).toBe(true);
      expect(text(q('app-call-number-sheet .cg-sheet__title'))).toBe('SAMU 192');
      expect(text(q('[data-role="call-number"]'))).toBe('192');
      expect(text(q('app-call-number-sheet'))).toContain('No protótipo, a ligação não é feita. Em uma emergência de verdade, ligue do seu telefone.');
      expect(text(q('app-call-number-sheet .cg-sheet__actions'))).toContain('Copiar número');
      expect(all('a[href^="tel:"], a[href*="wa.me"]')).toHaveLength(0);
      // O CVV e o Disque 100 usam o mesmo diálogo.
      await click(button('Voltar'));
      await click(button('Ligar para o CVV 188'));
      expect(text(q('[data-role="call-number"]'))).toBe('188');
      await click(button('Voltar'));
      await click(button('Ver o número do Disque 100'));
      expect(text(q('[data-role="call-number"]'))).toBe('100');
    });

    it('Copiar número: copia e diz "Número copiado."; com a área de transferência negada, seleciona o número e diz como copiar à mão', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/ajuda-agora' });
      await click(button('Ligar para o CVV 188'));
      // jsdom não tem área de transferência: plano B.
      await click(button('Copiar número'));
      expect(text(q('[data-role="call-feedback"]'))).toBe('Não foi possível copiar. Segure sobre o número e escolha Copiar.');
      expect(window.getSelection()?.toString().trim()).toBe('188');
      const copied: string[] = [];
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (value: string) => Promise.resolve(void copied.push(value)) },
      });
      await click(button('Copiar número'));
      expect(copied).toEqual(['188']);
      expect(text(q('[data-role="call-feedback"]'))).toBe('Número copiado.');
      Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
    });

    it('AC-CG-36: tela calma, sem vermelho, preço, plano, pergunta de consentimento nem as palavras proibidas', async () => {
      app = await bootCaregiverApp('cg_0002', { url: '/cuidador/ajuda-agora' });
      expect(all('.cg-note--error, .field--error, .btn--danger, [role="alert"]')).toHaveLength(0);
      const body = pageText().toLowerCase();
      ['r$', 'plano', 'autoriz', 'consentimento', 'assine', 'desconto', 'alerta', 'diagnóstico', 'paciente'].forEach((word) => {
        expect(body.includes(word)).toBe(false);
      });
      expect(/[\u2014\u2013!]/.test(pageText())).toBe(false);
    });

    it('AC-CG-37: abre normalmente sem sessão e sem autorização de saúde, com todo o conteúdo', async () => {
      app = await bootCaregiverApp(null, { url: '/cuidador/ajuda-agora' });
      expect(app.session.isSignedIn()).toBe(false);
      expect(app.router.url).toBe('/cuidador/ajuda-agora');
      expect(all('main h2, main h3').map(text).slice(0, 3)).toHaveLength(3);
      expect(text(q('[data-role="help-preferred"]'))).toContain('Telefone');
      expect(text(q('[data-role="help-preferred-value"]'))).toBe('(34) 90000-0000');
      TestBed.resetTestingModule();
      // Sônia retirou a autorização de saúde: a tela abre igual.
      app = await bootCaregiverApp('cg_0016', { url: '/cuidador/ajuda-agora' });
      expect(app.context.hasConsent('health_data')).toBe(false);
      expect(all('main h2, main h3').map(text).slice(0, 3)).toHaveLength(3);
    });

    it('AC-CG-38: quem prefere telefone (João) vê o telefone no cartão da equipe, com o número à vista', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/ajuda-agora' });
      expect(app.context.preferredChannel()).toBe('phone');
      const preferred = q('[data-role="help-preferred"]');
      expect(text(preferred)).toContain('Telefone');
      expect(text(preferred)).toContain('Seu canal preferido');
      expect(text(q('[data-role="help-preferred-value"]'))).toBe('(34) 90000-0000');
    });

    it('AC-CG-39: fora do horário comercial, a equipe mostra "Fechado agora. Abrimos amanhã às 8h."', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/ajuda-agora', time: '20:00' });
      expect(text(q('[data-role="help-closed"]'))).toContain('Fechado agora. Abrimos amanhã às 8h.');
      expect(text(q('[data-role="help-closed"]'))).toContain('Deixe uma mensagem pelo WhatsApp.');
      TestBed.resetTestingModule();
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/ajuda-agora', time: '10:00' });
      expect(q('[data-role="help-closed"]')).toBeNull();
    });

    it('AC-CG-40: o rodapé diz que os canais não substituem atendimento de saúde nem orientação sobre remédios', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/ajuda-agora' });
      expect(text(q('[data-role="help-footer"]'))).toContain(
        'Os canais da Nexus não substituem atendimento de saúde nem orientação sobre remédios.',
      );
    });

    it('"Como falar com a gente" abre o diálogo da Base, sem ligar de verdade', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/ajuda-agora' });
      await click(button('Como falar com a gente'));
      expect(app.root.querySelector('app-cg-contact-dialog dialog')?.hasAttribute('open')).toBe(true);
      expect(all('a[href^="tel:"], a[href*="wa.me"]')).toHaveLength(0);
    });
  });

  describe('Falar com a Nexus (C19)', () => {
    it('AC-CG-159: mostra os 4 canais com o preferido primeiro, os prazos certos e o aviso de emergência', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais/ajuda' });
      expect(text(q('.cg-hero__desc'))).toBe('Escolha o jeito mais fácil para você.');
      const rows = all('[data-role="channels"] .cg-row');
      expect(rows).toHaveLength(4);
      const titles = rows.map((r) => text(r.querySelector('.cg-row__title')));
      expect(titles).toEqual(['Telefone', 'WhatsApp', 'Mensagem no aplicativo', 'E-mail']);
      expect(text(rows[0]!)).toContain('Seu canal preferido');
      expect(text(rows[0]!)).toContain('(34) 90000-0000');
      expect(text(rows[0]!)).toContain('Na hora, em horário comercial (segunda a sexta, 8h às 18h)');
      expect(text(rows[1]!)).toContain('Até 4 horas úteis');
      expect(text(rows[2]!)).toContain('Até 24 horas úteis');
      expect(text(rows[3]!)).toContain('Até 48 horas úteis');
      expect(all('[data-role="preferred-tag"]')).toHaveLength(1);
      expect(pageText()).toContain('Os canais da Nexus não substituem atendimento de saúde nem orientação sobre remédios.');
      expect(pageText()).toContain('192');
    });

    it('quem prefere o aplicativo (Ana) vê a Mensagem no aplicativo primeiro', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais/ajuda' });
      const first = all('[data-role="channels"] .cg-row')[0];
      expect(text(first?.querySelector('.cg-row__title'))).toBe(
        { app: 'Mensagem no aplicativo', whatsapp: 'WhatsApp', phone: 'Telefone', email: 'E-mail' }[app.context.preferredChannel()],
      );
    });

    it('AC-CG-160: telefone e WhatsApp abrem o diálogo com o número e "Copiar número"; nenhum tel: nem wa.me', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais/ajuda' });
      await click(all('[data-role="channels"] .cg-row')[0]);
      const dialog = q('app-cg-contact-dialog dialog');
      expect(dialog?.hasAttribute('open')).toBe(true);
      expect(text(dialog)).toContain('(34) 90000-0000');
      expect(text(dialog)).toContain('Copiar número');
      expect(text(dialog)).toContain('No protótipo, a ligação não é feita.');
      expect(all('a[href^="tel:"], a[href*="wa.me"]')).toHaveLength(0);
    });

    it('AC-CG-162: Enviar mensagem grava uma mensagem do canal aplicativo com prazo de 24 horas úteis e ela aparece em "Suas mensagens"', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais/ajuda' });
      const before = app.db.messages.query((m) => m.caregiverId === 'cg_0001').length;
      await click(all('[data-role="channels"] .cg-row').find((r) => text(r).includes('Mensagem no aplicativo')));
      expect(q('[data-role="compose"]')).not.toBeNull();
      await click(all<HTMLInputElement>('.cg-choice__input')[1]);
      const field = q<HTMLTextAreaElement>('textarea');
      field!.value = 'Preciso mudar o horário da conversa de quinta.';
      field!.dispatchEvent(new Event('input', { bubbles: true }));
      await click(button('Enviar mensagem'));
      expect(text(q('[data-role="sent-note"]'))).toBe('Recebemos a sua mensagem. Respondemos em até 24 horas úteis.');
      const mine = app.db.messages.query((m) => m.caregiverId === 'cg_0001');
      expect(mine).toHaveLength(before + 1);
      const created = TestBed.inject(CaregiverMessagesService).thread('cg_0001')[0];
      expect(created).toMatchObject({
        channel: 'app',
        direction: 'in',
        status: 'new',
        subject: 'Preciso remarcar ou cancelar',
        body: 'Preciso mudar o horário da conversa de quinta.',
      });
      expect(created?.dueAt > created!.receivedAt).toBe(true);
      expect(text(all('[data-role="message"]')[0])).toContain('Preciso mudar o horário da conversa de quinta.');
      expect(text(all('[data-role="message"]')[0])).toContain('Enviada');
      expect(field!.value).toBe('');
    });

    it('AC-CG-162: mensagem em branco mostra "Escreva a sua mensagem para enviar." e não grava', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais/ajuda' });
      const before = app.db.messages.size();
      await click(all('[data-role="channels"] .cg-row').find((r) => text(r).includes('Mensagem no aplicativo')));
      await click(button('Enviar mensagem'));
      expect(text(q('.field__error'))).toContain('Escreva a sua mensagem para enviar.');
      expect(app.db.messages.size()).toBe(before);
    });

    it('AC-CG-163: quem nunca mandou mensagem (Marcos) vê o vazio com os assuntos à vista', async () => {
      app = await bootCaregiverApp('cg_0026', { url: '/cuidador/mais/ajuda' });
      expect(text(q('[data-role="messages-empty"]'))).toContain('Você ainda não mandou nenhuma mensagem');
      expect(text(q('[data-role="messages-empty"]'))).toContain('Quando você escrever para a equipe, a conversa aparece aqui.');
      const subjects = all('.cg-choice__label').map(text);
      expect(subjects).toEqual(['Dúvida sobre o app', 'Preciso remarcar ou cancelar', 'Outro assunto']);
      // Nada vem marcado.
      expect(all<HTMLInputElement>('.cg-choice__input').some((i) => i.checked)).toBe(false);
    });

    it('registra a conversa por telefone feita pela equipe (João) como "Conversa por telefone registrada em dd/mm."', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais/ajuda' });
      const registered = all('[data-role="message"]').find((m) => text(m).includes('Conversa por telefone registrada em'));
      expect(registered).toBeDefined();
      expect(text(registered)).toMatch(/Conversa por telefone registrada em \d{2}\/\d{2}\./);
    });

    it('AC-CG-164: fora do horário comercial o telefone avisa quando abre e a tela sugere WhatsApp ou mensagem', async () => {
      app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais/ajuda', time: '19:30' });
      expect(text(q('[data-role="phone-closed"]'))).toBe('Fechado agora. Abrimos amanhã às 8h.');
      expect(pageText()).toContain('Você pode escrever pelo WhatsApp ou deixar uma mensagem aqui.');
    });

    it('AC-CG-165: a tela inteira mostra que os canais não substituem atendimento de saúde e a indicação do SAMU 192', async () => {
      app = await bootCaregiverApp('cg_0002', { url: '/cuidador/mais/ajuda' });
      expect(pageText()).toContain('Em emergência, ligue 192 (SAMU).');
      expect(pageText()).toContain('não substituem atendimento de saúde nem orientação sobre remédios');
    });

    it('texto de tela sem travessão, exclamação nem as palavras proibidas', async () => {
      app = await bootCaregiverApp('cg_0003', { url: '/cuidador/mais/ajuda' });
      expect(/[\u2014\u2013!]/.test(pageText())).toBe(false);
      ['paciente', 'idoso ', 'alerta', 'eficácia', 'guerreira'].forEach((w) => expect(pageText().toLowerCase().includes(w)).toBe(false));
    });
  });
});
