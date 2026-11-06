import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import { ROUTES } from './my-wellbeing.routes';

/**
 * Como estou (C9, AC-CG-87 a 98): a evolução do cansaço lida com cuidado, o humor do dia, o pedido de revisão e "Combinar um
 * horário". O foco é o texto e o que NÃO aparece (alerta, número em destaque, vermelho, oferta).
 */
const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const URL = '/cuidador/cuidar-de-mim/como-estou';

describe('Área my-wellbeing (Como estou)', () => {
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
  const button = (label: string, root: ParentNode = app.root): HTMLButtonElement | undefined =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => text(b) === label);
  const sheet = (heading: string): HTMLElement => {
    const found = all('app-cg-sheet').find((s) => text(s.querySelector('.cg-sheet__title')) === heading);
    if (!found) {
      throw new Error(`folha não encontrada: ${heading}`);
    }
    return found;
  };
  const isOpen = (heading: string): boolean => sheet(heading).querySelector('dialog')?.hasAttribute('open') ?? false;
  const boot = async (id: string): Promise<void> => {
    app = await bootCaregiverApp(id, { url: URL });
  };
  const pageText = (): string => text(q('main'));
  /** Cada ponto: data, faixa, legenda e etiqueta, separados por espaço (o texto de cada pedaço é um elemento próprio). */
  const timelineLines = (): string[] =>
    all('.cg-trend__item').map((li) => Array.from(li.querySelectorAll('span')).map(text).filter(Boolean).join(' '));

  afterEach(() => TestBed.resetTestingModule());

  it('exporta as rotas da área', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  it('abre /cuidador/cuidar-de-mim/como-estou com o título e o h1', async () => {
    await boot('cg_0001');
    expect(app.router.url).toBe(URL);
    expect(text(q('main h1'))).toBe('Como estou');
    expect(document.title).toContain('Como estou');
  });

  describe('o que a tela mostra', () => {
    it('AC-CG-87: na ordem h1 com apoio, nota de cuidado, humor, linha do tempo e "Pedir revisão de uma decisão"; "Não é um diagnóstico." junto da linha do tempo', async () => {
      await boot('cg_0001');
      expect(text(q('.cg-page-header__desc'))).toBe(
        'Aqui você vê como o seu cansaço tem andado. Quem faz as perguntas é a equipe de psicologia. Você não precisa preencher nada.',
      );
      const order = [
        q('.cg-page-header__desc'),
        q('[data-role="care-note"]'),
        q('[data-role="mood"]'),
        q('[data-role="timeline"]'),
        q('[data-role="review"]'),
      ];
      order.forEach((el) => expect(el).not.toBeNull());
      for (let i = 0; i < order.length - 1; i += 1) {
        expect(order[i]!.compareDocumentPosition(order[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING, `posição ${i}`).toBeTruthy();
      }
      expect(text(q('[data-role="timeline-intro"]'))).toBe(
        'Cada ponto é uma conversa com a equipe. A escala ajuda a equipe a escutar você. Não é um diagnóstico.',
      );
      expect(text(q('[data-role="review"]'))).toBe('Pedir revisão de uma decisão');
      expect(text(q('[data-role="privacy-line"]'))).toBe('Só você e a equipe de psicologia que acompanha você veem estas informações.');
    });

    it('AC-CG-88 e 90: cada ponto mostra a data, a faixa por extenso e a pontuação só como legenda; a rampa é de azul, sem alarme (Ana)', async () => {
      await boot('cg_0001');
      // CXC-003: "hoje" no horário comercial (o relógio do teste marca 12:00 de uma quarta-feira).
      expect(text(q('[data-role="care-note"]'))).toBe('A equipe de psicologia vai falar com você hoje. Você não precisa fazer nada.');
      const lines = timelineLines();
      expect(lines).toHaveLength(2);
      // CXC-004: a frase da faixa vem primeiro; o nome técnico e os pontos são a legenda pequena.
      expect(lines[0]).toMatch(/^04\/11 O cuidado está pesando muito Sobrecarga severa 63 pontos Última conversa$/);
      expect(lines[1]).toMatch(/^04\/08 O cuidado pesa bastante Sobrecarga moderada a severa 48 pontos$/);
      expect(text(all('.cg-trend__item')[0]?.querySelector('span:nth-child(3)'))).toBe('O cuidado está pesando muito');
      expect(all('.cg-trend__dot').map((d) => d.getAttribute('data-band'))).toEqual(['4', '3']);
      expect(all('.cg-trend__score').map(text)).toEqual(['63 pontos', '48 pontos']);
      // Sem vermelho, âmbar, octógono, triângulo, termômetro, gráfico.
      const html = q('main')!.innerHTML;
      ['octagon', 'triangle', 'thermometer', 'siren', 'chart-column', 'gauge'].forEach((icon) => expect(html.includes(icon), icon).toBe(false));
      expect(all('.cg-note--error, .cg-note--late, .field--error, .btn--danger, .btn--danger-quiet')).toHaveLength(0);
      expect(text(q('[data-role="last-text"]'))).toBe('Sua última conversa foi em 04/11.');
      expect(text(q('[data-role="next-text"]'))).toBe('A próxima conversa de acompanhamento deve acontecer até 04/02/2027.');
    });

    it('AC-CG-89 e 97: nenhuma palavra de alarme, nenhum percentual, e nenhum convite de grupo, plano, desconto ou upgrade (Ana e Maria)', async () => {
      for (const id of ['cg_0001', 'cg_0002', 'cg_0003', 'cg_0012']) {
        await boot(id);
        const body = pageText().toLowerCase();
        ['alerta', 'eficácia', 'melhorou', 'piorou', '%', 'diagnóstico'].forEach((w) => {
          if (w === 'diagnóstico') {
            expect(body.split('não é um diagnóstico').join('').includes(w), `${id} ${w}`).toBe(false);
          } else {
            expect(body.includes(w), `${id} ${w}`).toBe(false);
          }
        });
        ['grupo', 'plano', 'desconto', 'upgrade', 'assine', 'r$', 'cartão', 'convite'].forEach((w) => expect(body.includes(w), `${id} ${w}`).toBe(false));
        expect(all('main a[href*="/plano"], main a[href*="/grupos"], main a[href*="/cartao"]')).toHaveLength(0);
        expect(/[\u2014\u2013!]/.test(pageText())).toBe(false);
        TestBed.resetTestingModule();
      }
    });

    it('os pontos de cada pessoa: João 52 e 66, Terezinha 18, 28 e 40, Marlene 0, Marcos 27', async () => {
      await boot('cg_0003');
      expect(q('[data-role="care-note"]')).toBeNull();
      expect(timelineLines().map((l) => l.replace(/ Última conversa$/, ''))).toEqual([
        '25/10 O cuidado pesa bastante Sobrecarga moderada a severa 52 pontos',
        '27/07 O cuidado está pesando muito Sobrecarga severa 66 pontos',
      ]);
      TestBed.resetTestingModule();
      await boot('cg_0012');
      expect(all('.cg-trend__score').map(text)).toEqual(['18 pontos', '28 pontos', '40 pontos']);
      expect(all('.cg-trend__band').map(text)).toEqual(['Sobrecarga ausente ou pequena', 'Sobrecarga moderada', 'Sobrecarga moderada']);
      TestBed.resetTestingModule();
      await boot('cg_0004');
      expect(timelineLines()[0]).toContain('Sobrecarga ausente ou pequena 0 pontos');
      TestBed.resetTestingModule();
      await boot('cg_0026');
      expect(timelineLines()).toHaveLength(1);
      expect(timelineLines()[0]).toContain('27 pontos');
      expect(timelineLines()[0]).toContain('Sobrecarga moderada');
    });

    it('"Ver todas" aparece só com mais de 4 conversas e mostra o resto', async () => {
      await boot('cg_0012');
      expect(q('[data-role="see-all"]')).toBeNull();
      for (let i = 0; i < 3; i += 1) {
        app.db.zaritAssessments.create({
          caregiverId: 'cg_0012',
          psychologistId: 'psy_0002',
          kind: 'quarterly',
          sequence: 10 + i,
          dueDate: `2025-0${i + 1}-10`,
          appliedAt: `2025-0${i + 1}-10`,
          answers: new Array<number>(22).fill(1),
          total: 22,
          band: 'moderate',
          status: 'completed',
          addenda: [],
        });
      }
      await flush();
      expect(all('.cg-trend__item')).toHaveLength(4);
      expect(text(q('[data-role="see-all"]'))).toBe('Ver todas');
      await click(q('[data-role="see-all"]'));
      expect(all('.cg-trend__item')).toHaveLength(6);
      // Datas de outro ano mostram o ano.
      expect(timelineLines().some((l) => /^10\/03\/2025 /.test(l))).toBe(true);
    });

    it('a próxima conversa só mostra data quando é futura; vencida, a equipe combina com a pessoa (S-33)', async () => {
      await boot('cg_0001');
      const pending = app.db.zaritAssessments.find((a) => a.caregiverId === 'cg_0001' && a.status === 'scheduled')!;
      app.db.zaritAssessments.update(pending.id, { dueDate: '2026-10-01' });
      await flush();
      expect(text(q('[data-role="next-text"]'))).toBe('A equipe vai combinar a próxima conversa com você.');
      expect(pageText().toLowerCase()).not.toContain('atrasad');
      expect(pageText().toLowerCase()).not.toContain('vencid');
    });

    it('AC-CG-96: "Entender as faixas" lista as 4 faixas com os intervalos e termina com a frase de apoio', async () => {
      await boot('cg_0001');
      await click(q('[data-role="bands"]'));
      expect(isOpen('Entender as faixas')).toBe(true);
      const lines = all('[data-role="bands-sheet"] li').map(text);
      expect(lines).toEqual([
        'Sobrecarga ausente ou pequena (0 a 20): o cuidado pesa pouco.',
        'Sobrecarga moderada (21 a 40): o cuidado pesa em parte do tempo.',
        'Sobrecarga moderada a severa (41 a 60): o cuidado pesa bastante.',
        'Sobrecarga severa (61 a 88): o cuidado está pesando muito.',
      ]);
      const last = q('[data-role="bands-sheet"]')!.lastElementChild;
      expect(text(last)).toBe('Em qualquer faixa, a equipe está aqui para conversar com você.');
      expect(text(q('[data-role="bands-sheet"]'))).toContain('Não é um diagnóstico.');
    });

    it('AC-CG-93: a pessoa nunca preenche a escala: só há as 5 opções do humor, nenhum campo de pergunta ou resposta', async () => {
      await boot('cg_0001');
      expect(all('main input[type="radio"]').filter((r) => !r.closest('dialog'))).toHaveLength(5);
      expect(all('main input[type="text"], main input[type="number"], main select')).toHaveLength(0);
      const body = pageText().toLowerCase();
      ['22 itens', '22 perguntas', 'responder a escala', 'preencher a escala', 'nunca', 'raramente'].forEach((w) => expect(body.includes(w), w).toBe(false));
    });
  });

  describe('contato da equipe', () => {
    it('AC-CG-91: Maria lê que a equipe ainda não conseguiu falar com ela, tem "Falar com a gente agora" e "Combinar um horário", e o pedido de revisão com a Dra. Beatriz', async () => {
      await boot('cg_0002');
      // CXC-003: um convite, sem "responsável técnica" e sem "ainda não conseguiu falar com você".
      expect(text(q('[data-role="care-note"]'))).toBe('Queremos falar com você. Se quiser, fale com a gente agora.');
      expect(pageText().toLowerCase()).not.toContain('responsável técnica');
      expect(pageText().toLowerCase()).not.toContain('não conseguiu');
      expect(text(q('[data-role="talk-now"]'))).toBe('Falar com a gente agora');
      expect(text(q('[data-role="arrange"]'))).toBe('Combinar um horário');
      const card = text(all('[data-role="review-card"]')[0]);
      expect(card).toBe('Seu pedido de revisão está com a Dra. Beatriz. Resposta até 10/11.');
      expect(pageText().toLowerCase()).not.toContain('vencid');
      expect(pageText().toLowerCase()).not.toContain('atrasad');
      expect(timelineLines()[0]).toContain('79 pontos');
    });

    it('"Falar com a gente agora" abre o "Como falar com a gente" da Base (e "Prefere falar agora?" para Ana)', async () => {
      await boot('cg_0002');
      await click(q('[data-role="talk-now"]'));
      expect(app.root.querySelector('app-cg-contact-dialog dialog')?.hasAttribute('open')).toBe(true);
      TestBed.resetTestingModule();
      await boot('cg_0001');
      expect(text(q('[data-role="talk-now"]'))).toBe('Prefere falar agora?');
    });

    it('AC-CG-91: "Combinar um horário" cria uma mensagem do aplicativo marcada como pedido de apoio, que aparece em Falar com a Nexus', async () => {
      await boot('cg_0002');
      const before = app.db.messages.query((m) => m.caregiverId === 'cg_0002').length;
      await click(q('[data-role="arrange"]'));
      expect(isOpen('Combinar um horário')).toBe(true);
      expect(all('app-cg-sheet .cg-choice__label').map(text)).toEqual(['Manhã', 'Tarde', 'Noite']);
      // Sem escolher, não grava.
      await click(q('[data-role="send-arrange"]'));
      expect(text(q('[data-role="arrange-error"]'))).toBe('Escolha o período em que a equipe pode falar com você.');
      expect(app.db.messages.query((m) => m.caregiverId === 'cg_0002')).toHaveLength(before);
      await click(all('app-cg-sheet .cg-choice').find((c) => text(c) === 'Manhã')?.querySelector('input'));
      await click(q('[data-role="send-arrange"]'));
      const messages = app.db.messages.query((m) => m.caregiverId === 'cg_0002');
      expect(messages).toHaveLength(before + 1);
      const created = messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0]!;
      expect(created).toMatchObject({
        channel: 'app',
        direction: 'in',
        subject: 'Combinar um horário',
        body: 'Prefiro que falem comigo de manhã.',
        isSupportRequest: true,
      });
      expect(isOpen('Combinar um horário')).toBe(false);
      expect(text(q('[data-role="arranged"]'))).toBe('Recebemos o seu pedido. A equipe procura você de manhã.');
      await app.router.navigateByUrl('/cuidador/mais/ajuda');
      await flush();
      expect(all('[data-role="message"]').some((m) => text(m).includes('Prefiro que falem comigo de manhã.'))).toBe(true);
    });
  });

  describe('pedir revisão', () => {
    it('AC-CG-92: escrever e enviar grava o pedido com o prazo e mostra "Pedido enviado. O psicólogo responde até {data}."', async () => {
      await boot('cg_0001');
      expect(q('[data-role="review-card"]')).toBeNull();
      await click(q('[data-role="review"]'));
      expect(isOpen('Pedir revisão')).toBe(true);
      expect(text(sheet('Pedir revisão'))).toContain(
        'Se você não concorda com algo que a equipe decidiu a partir dos seus resultados, conte aqui. O psicólogo responde por escrito.',
      );
      const field = q<HTMLTextAreaElement>('[data-role="review-field"]')!;
      field.value = 'Não concordo com a decisão de acompanhamento prioritário.';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await click(q('[data-role="send-review"]'));
      const created = app.db.reviewRequests.all().at(-1)!;
      expect(created).toMatchObject({
        caregiverId: 'cg_0001',
        about: 'zarit_decision',
        text: 'Não concordo com a decisão de acompanhamento prioritário.',
        dueAt: '2026-11-19',
      });
      expect(created.psychologistId).toBe(app.db.caregivers.require('cg_0001').assignedPsychologistId);
      expect(isOpen('Pedir revisão')).toBe(false);
      expect(text(q('[data-role="review-done"]'))).toBe('Pedido enviado. O psicólogo responde até 19/11.');
      expect(text(q('[data-role="review-card"]'))).toContain('Seu pedido de revisão está com');
      expect(text(q('[data-role="review-card"]'))).toContain('Resposta até 19/11.');
    });

    it('AC-CG-92: texto vazio mostra "Conte em uma frase o que você quer que a equipe reveja." e não grava; o que foi digitado continua se a folha fechar', async () => {
      await boot('cg_0001');
      const before = app.db.reviewRequests.size();
      await click(q('[data-role="review"]'));
      await click(q('[data-role="send-review"]'));
      expect(text(q('[data-role="review-error"]'))).toBe('Erro: Conte em uma frase o que você quer que a equipe reveja.');
      expect(app.db.reviewRequests.size()).toBe(before);
      const field = q<HTMLTextAreaElement>('[data-role="review-field"]')!;
      field.value = 'oi';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await click(q('[data-role="send-review"]'));
      expect(app.db.reviewRequests.size()).toBe(before);
      await click(button('Voltar', sheet('Pedir revisão')));
      await click(q('[data-role="review"]'));
      expect(q<HTMLTextAreaElement>('[data-role="review-field"]')!.value).toBe('oi');
    });

    it('quando a equipe responde, o cartão mostra a resposta e quem respondeu', async () => {
      await boot('cg_0002');
      const request = app.db.reviewRequests.find((r) => r.caregiverId === 'cg_0002')!;
      app.db.reviewRequests.update(request.id, { answer: 'Revisamos a decisão e mantivemos o acompanhamento. Vamos conversar sobre isso.', answeredAt: '2026-11-04T10:00:00-03:00' });
      await flush();
      expect(text(q('[data-role="review-card"]'))).toBe('Resposta da Dra. Beatriz, em 04/11:');
      expect(text(q('[data-role="review-answer"]'))).toBe('Revisamos a decisão e mantivemos o acompanhamento. Vamos conversar sobre isso.');
    });
  });

  describe('sem autorização de saúde', () => {
    it('AC-CG-94: Sônia não vê o humor nem a linha do tempo; vê "O acompanhamento está pausado" com "Autorizar de novo" e o caminho para pedir a cópia dos dados (S-28)', async () => {
      await boot('cg_0016');
      expect(q('[data-role="mood"]')).toBeNull();
      expect(q('app-cg-trend')).toBeNull();
      expect(q('[data-role="timeline"]')).toBeNull();
      expect(q('[data-role="care-note"]')).toBeNull();
      expect(pageText()).toContain('O acompanhamento está pausado');
      expect(text(q('[data-role="paused-text"]'))).toMatch(
        /^Você retirou a autorização de dados de saúde em \d{2}\/\d{2}\. A escala e o acompanhamento só voltam se você autorizar de novo\. O que já foi registrado fica guardado, sem uso\. Você pode pedir uma cópia dos seus dados em Privacidade\.$/,
      );
      expect(text(q('[data-role="paused-text"]'))).toContain('em 20/10');
      expect(q('a[href="/cuidador/mais/privacidade"]')).not.toBeNull();
      expect(text(q('[data-role="authorize"]'))).toBe('Autorizar de novo');
      expect(pageText().toLowerCase()).not.toContain('pontos');
    });

    it('"Autorizar de novo" grava o evento, reativa o cadastro e a linha do tempo volta', async () => {
      await boot('cg_0016');
      await click(q('[data-role="authorize"]'));
      expect(app.db.consentEvents.all().at(-1)).toMatchObject({ caregiverId: 'cg_0016', key: 'health_data', status: 'granted', channel: 'app', registeredByUserId: 'cg_0016' });
      expect(app.db.caregivers.require('cg_0016').status).toBe('active');
      expect(q('[data-role="paused-text"]')).toBeNull();
      expect(q('[data-role="mood"]')).not.toBeNull();
      expect(all('.cg-trend__item')).toHaveLength(1);
    });
  });

  describe('sem conversa de acompanhamento', () => {
    it('AC-CG-95: aparece o vazio "Ainda não houve uma conversa de acompanhamento." e nenhuma linha do tempo', async () => {
      await boot('cg_0001');
      app.db.zaritAssessments.removeWhere((a) => a.caregiverId === 'cg_0001');
      await flush();
      expect(text(q('[data-role="timeline-empty"]'))).toBe(
        'A equipe de psicologia conversa com você e aplica a escala. Você não precisa preencher nada.',
      );
      expect(text(q('[data-role="timeline"]'))).toContain('Ainda não houve uma conversa de acompanhamento');
      expect(q('app-cg-trend')).toBeNull();
      expect(q('[data-role="next-text"]')).toBeNull();
      expect(q('[data-role="bands"]')).toBeNull();
    });
  });

  describe('humor do dia', () => {
    it('AC-CG-98: tocar numa opção grava na hora, mostra "Anotado para hoje: Bem." com "Mudar", e o humor da semana aparece na folha', async () => {
      await boot('cg_0001');
      expect(all('main input[type="radio"]').some((r) => (r as HTMLInputElement).checked)).toBe(false);
      const before = app.db.wellbeingChecks.size();
      await click(all('main .cg-mood__option input')[3]);
      expect(app.db.wellbeingChecks.size()).toBe(before + 1);
      expect(app.db.wellbeingChecks.all().at(-1)).toMatchObject({ caregiverId: 'cg_0001', date: '2026-11-04', mood: 4 });
      expect(text(q('[data-role="mood-noted"]'))).toBe('Anotado para hoje: Bem.');
      // Mudar substitui o do dia (um registro por dia).
      await click(q('[data-role="mood-change"]'));
      await click(all('main .cg-mood__option input')[1]);
      expect(app.db.wellbeingChecks.size()).toBe(before + 1);
      expect(app.db.wellbeingChecks.all().at(-1)?.mood).toBe(2);
      expect(text(q('[data-role="mood-noted"]'))).toBe('Anotado para hoje: Mal.');
      await click(q('[data-role="week"]'));
      expect(isOpen('Os últimos 7 dias')).toBe(true);
      expect(all('[data-role="week-list"] li').map(text)).toEqual(['04/11: Mal', '02/11: Mal']);
    });

    it('sem nada anotado na semana, a folha diz isso; sem a autorização de saúde o serviço do humor recusa', async () => {
      await boot('cg_0024');
      await click(q('[data-role="week"]'));
      expect(text(q('[data-role="week-empty"]'))).toBe('Você ainda não anotou nenhum dia nesta semana.');
    });
  });

  it('texto de tela sem travessão, exclamação nem as palavras proibidas', async () => {
    await boot('cg_0002');
    const body = pageText().toLowerCase();
    expect(/[\u2014\u2013!]/.test(body)).toBe(false);
    ['paciente', 'idoso ', 'alerta', 'eficácia', 'guerreira'].forEach((w) => expect(body.includes(w)).toBe(false));
  });
});
