import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { PLAN_NOT_INCLUDED_NOTICE } from '@core/rules';
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

const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('M04 Planos, assinaturas e Cartão Nexus', () => {
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
  const drawerRoot = (): Element => all('dialog.drawer').find((d) => text(d).includes('Registrar uso do cartão')) as Element;
  const button = (label: string): HTMLButtonElement | null => all<HTMLButtonElement>('button').find((b) => text(b) === label) ?? null;

  afterEach(() => TestBed.resetTestingModule());

  describe('planos (SCR-M04-01)', () => {
    it('mostra exatamente R$ 0,00, R$ 49,90, R$ 119,90 e R$ 149,90, nessa ordem, e o aviso da mensalidade (AC-M04-01, 11)', async () => {
      await open('u7', '/app/assinaturas/planos');
      expect(text(q('h1'))).toBe('Planos');
      expect(all('.plan-card__price').map((p) => text(p).replace(/gratuito|por mês/g, '').trim())).toEqual(['R$ 0,00', 'R$ 49,90', 'R$ 119,90', 'R$ 149,90']);
      expect(all('.plan-card__head').map((h) => text(h))).toEqual(['Livre', 'Essencial', 'Cuida', 'Sustenta']);
      expect(text(q('main'))).toContain(PLAN_NOT_INCLUDED_NOTICE);
      expect(PLAN_NOT_INCLUDED_NOTICE).toBe('A mensalidade não inclui serviços da rede nem atendimento psicológico.');
    });

    it('não mostra "R$ 169,90" nem plano "Integral" em lugar nenhum (AC-M04-02)', async () => {
      await open('u1', '/app/assinaturas/planos');
      const content = text(q('main'));
      expect(content).not.toContain('169,90');
      expect(content).not.toMatch(/Integral/i);
    });

    it('grupos e capacitações a partir do Cuida: o cartão do Essencial não os mostra (AC-M04-03)', async () => {
      await open('u7', '/app/assinaturas/planos');
      const cards = all('.plan-card');
      expect(text(cards[1] ?? null)).not.toContain('Grupos de apoio');
      expect(text(cards[1] ?? null)).not.toContain('Capacitações');
      expect(text(cards[2] ?? null)).toContain('Grupos de apoio');
      expect(text(cards[2] ?? null)).toContain('Capacitações');
      // A tabela de comparação diz em texto, não só por cor.
      const row = all('tbody tr').find((r) => text(r).startsWith('Grupos de apoio'));
      expect(row).toBeTruthy();
      expect(text(row ?? null)).toContain('Não inclui');
      expect(text(row ?? null)).toContain('Inclui');
      expect(q('table.table--stack')).toBeNull();
    });

    it('o valor médio e o líquido (realizado e de referência) aparecem só para a gestão', async () => {
      await open('u1', '/app/assinaturas/planos');
      expect(text(q('main'))).toContain('Valor médio e líquido por assinante');
      expect(text(q('main'))).toContain('R$ 100,90');
      expect(text(q('main'))).toContain('R$ 89,80');
      await open('u7', '/app/assinaturas/planos');
      expect(text(q('main'))).not.toContain('Valor médio e líquido por assinante');
      await open('u2', '/app/assinaturas/planos');
      expect(text(q('main'))).not.toContain('Valor médio');
    });
  });

  describe('assinaturas (SCR-M04-02)', () => {
    it('totais por plano do seed: 17 assinantes, 7 Essencial, 5 Cuida (3 pagas pela empresa), 5 Sustenta', async () => {
      await open('u7', '/app/assinaturas');
      expect(text(q('h1'))).toBe('Assinaturas');
      const kpis = all('app-kpi').map((k) => text(k));
      expect(kpis[0]).toContain('17');
      expect(kpis[1]).toContain('7');
      expect(kpis[2]).toContain('5');
      expect(kpis[2]).toContain('3 pagas pela empresa');
      expect(kpis[3]).toContain('5');
    });

    it('lista as 340 assinaturas, com próximo ciclo mais próximo primeiro e cancelamento agendado à vista', async () => {
      await open('u7', '/app/assinaturas');
      expect(text(q('.table-footer'))).toContain('de 340 assinaturas');
      const firstRow = text(q('tbody tr'));
      expect(firstRow).toMatch(/Essencial|Cuida|Sustenta/);
      await go('/app/assinaturas?filtro=cancelamento-agendado');
      expect(all('tbody tr')).toHaveLength(1);
      expect(text(q('tbody tr'))).toContain('Cancelamento agendado');
    });

    it('a gestão vê o cuidador só pelo código; o atendimento vê o nome (A-09, LP-08)', async () => {
      await open('u1', '/app/assinaturas');
      const html = app.root.innerHTML;
      app.db.caregivers.list().slice(0, 40).forEach((c) => expect(html).not.toContain(c.fullName));
      expect(all('.code-chip').length).toBeGreaterThan(3);
      await open('u7', '/app/assinaturas');
      expect(app.root.innerHTML).toContain(app.db.caregivers.require('cg_0001').fullName);
    });

    it('o psicólogo não vê a tela (AC-M04-10) e o responsável técnico só lê', async () => {
      await open('u3', '/app/painel');
      await go('/app/assinaturas');
      expect(app.router.url).toBe('/403');
      await open('u2', '/app/assinaturas');
      expect(text(q('h1'))).toBe('Assinaturas');
      const sub = app.db.subscriptions.find((s) => s.caregiverId === 'cg_0008')!;
      await go(`/app/assinaturas/${sub.id}`);
      expect(button('Trocar plano')).toBeNull();
      expect(text(q('main'))).toContain('Plano atual');
    });
  });

  describe('detalhe e troca de plano (SCR-M04-03, F03)', () => {
    it('upgrade de Livre para Essencial emite o cartão na hora, atualiza a tela e avisa com a consequência (AC-M04-04)', async () => {
      await open('u7', '/app/painel');
      const sub = app.db.subscriptions.find((s) => s.caregiverId === 'cg_0100')!;
      await go(`/app/assinaturas/${sub.id}`);
      expect(text(q('main'))).toContain('Cartão Nexus a partir do Essencial');
      await click(button('Assinar um plano'));
      const drawer = all('dialog.drawer').find((d) => text(d).includes('Assinar um plano')) ?? null;
      expect(text(drawer)).toContain('Plano atual');
      const option = drawer?.querySelector<HTMLInputElement>('[data-plan="essencial"] input');
      await click(option ?? null);
      expect(text(drawer?.querySelector('[data-role="effect"]') ?? null)).toContain('Vale hoje');
      expect(text(drawer?.querySelector('[data-role="effect"]') ?? null)).toContain('O Cartão Nexus é emitido agora');
      await click(all<HTMLButtonElement>('dialog.drawer button').find((b) => text(b) === 'Fazer upgrade para o Essencial') ?? null);
      expect(app.db.subscriptions.get(sub.id)?.planId).toBe('essencial');
      const card = app.db.benefitCards.find((c) => c.caregiverId === 'cg_0100');
      expect(card?.status).toBe('active');
      expect(text(q('main'))).toContain(card?.number ?? 'sem cartão');
      expect(text(q('.toast'))).toContain('Plano alterado para Essencial');
    });

    it('descer de plano mostra o efeito e, depois de agendar, a faixa de mudança agendada com "Manter o plano atual" (A-18)', async () => {
      await open('u1', '/app/painel');
      const sub = app.db.subscriptions.find((s) => s.caregiverId === 'cg_0008')!;
      await go(`/app/assinaturas/${sub.id}`);
      await click(button('Trocar plano'));
      const drawer = all('dialog.drawer').find((d) => text(d).includes('Trocar plano')) ?? null;
      expect(drawer?.querySelector('[data-plan="cuida"] input')?.hasAttribute('disabled')).toBe(true);
      await click(drawer?.querySelector('[data-plan="essencial"] input') ?? null);
      expect(text(drawer?.querySelector('[data-role="effect"]') ?? null)).toContain('Vale no fim do ciclo');
      await click(all<HTMLButtonElement>('dialog.drawer button').find((b) => text(b) === 'Agendar mudança para o Essencial') ?? null);
      expect(text(q('[data-role="scheduled"]'))).toContain('Mudança agendada: Cuida para Essencial em');
      expect(text(q('[data-role="scheduled"]'))).not.toContain('Cancelamento');
      await click(button('Manter o plano atual'));
      expect(q('[data-role="scheduled"]')).toBeNull();
      expect(all('.toast').map((t) => text(t)).join(' ')).toContain('Plano mantido');
      expect(app.db.subscriptions.get(sub.id)?.status).toBe('active');
    });

    it('plano pago pela empresa: o painel diz que a mudança é feita pelo contrato e não oferece trocar', async () => {
      await open('u7', '/app/painel');
      const sub = app.db.subscriptions.find((s) => s.caregiverId === 'cg_0021')!;
      await go(`/app/assinaturas/${sub.id}`);
      expect(text(q('main'))).toContain('Empresa: Exemplo Logística Ltda.');
      await click(button('Trocar plano'));
      const drawer = all('dialog.drawer').find((d) => text(d).includes('Trocar plano')) ?? null;
      expect(text(drawer)).toContain('Este plano é pago pela empresa Exemplo Logística Ltda. A mudança é feita pelo contrato.');
      expect(drawer?.querySelector('fieldset')?.hasAttribute('disabled')).toBe(true);
    });

    it('cancelar agenda e, no fim do ciclo (relógio simulado), o plano vira Livre e o cartão fica inativo (AC-M04-06)', async () => {
      await open('u7', '/app/painel');
      const sub = app.db.subscriptions.find((s) => s.caregiverId === 'cg_0007')!;
      await go(`/app/assinaturas/${sub.id}`);
      await click(button('Trocar plano'));
      const drawer = all('dialog.drawer').find((d) => text(d).includes('Trocar plano')) ?? null;
      await click(drawer?.querySelector('[data-plan="livre"] input') ?? null);
      await click(all<HTMLButtonElement>('dialog.drawer button').find((b) => text(b) === 'Agendar cancelamento') ?? null);
      expect(text(q('[data-role="scheduled"]'))).toContain('Cancelamento agendado para');
      const due = app.db.subscriptions.get(sub.id)?.scheduledChangeAt as string;
      app.clock.setSimulated(due, '12:00');
      await go('/app/assinaturas');
      expect(app.db.subscriptions.get(sub.id)?.planId).toBe('livre');
      expect(app.db.benefitCards.find((c) => c.caregiverId === 'cg_0007')?.status).toBe('inactive');
    });
  });

  describe('cartões (SCR-M04-04 e 05)', () => {
    it('lista os 17 cartões ativos e nenhum cuidador Livre sem histórico de cartão (AC-M04-09)', async () => {
      await open('u7', '/app/assinaturas/cartoes');
      expect(text(q('h1'))).toBe('Cartões Nexus');
      expect(text(all('app-kpi')[0] ?? null)).toContain('17');
      expect(all('tbody tr').length).toBeGreaterThanOrEqual(17);
      const livre = app.db.subscriptions.query((s) => s.planId === 'livre').map((s) => s.caregiverId);
      const rowsText = text(q('table'));
      livre.slice(0, 30).forEach((id) => expect(rowsText).not.toContain(app.db.caregivers.require(id).code));
    });

    it('registrar uso de R$ 100,00 em parceiro com 10% grava desconto de R$ 10,00; parceiro suspenso não aparece (AC-M04-07)', async () => {
      await open('u7', '/app/assinaturas/cartoes');
      await click(button('Registrar uso do cartão'));
      const drawer = all('dialog.drawer').find((d) => text(d).includes('Registrar uso do cartão')) ?? null;
      const partners = Array.from(drawer?.querySelectorAll('#nx-usage-partner option') ?? []).map((o) => text(o));
      expect(partners.some((p) => p.includes('Drogaria Popular Central'))).toBe(false);
      expect(partners.some((p) => p.includes('Farmácia Bem-Estar'))).toBe(true);
      const card = app.db.benefitCards.find((c) => c.status === 'active')!;
      const partner = app.db.partners.find((p) => p.name === 'Farmácia Bem-Estar')!;
      const set = async (selector: string, value: string): Promise<void> => {
        const el = drawer?.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
        if (!el) {
          throw new Error(selector);
        }
        el.value = value;
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
        await settle(app.fixture);
      };
      // Sem preencher: resumo de erros, nada gravado.
      const before = app.db.cardUsages.size();
      await click(all<HTMLButtonElement>('dialog.drawer button').find((b) => text(b) === 'Registrar uso') ?? null);
      expect(text(drawer?.querySelector('.error-summary') ?? null)).toContain('pontos para corrigir');
      expect(app.db.cardUsages.size()).toBe(before);
      const cardSelect = drawer?.querySelector<HTMLSelectElement>('#nx-usage-card');
      const cardIndex = Array.from(cardSelect?.options ?? []).findIndex((o) => text(o).startsWith(card.number));
      await set('#nx-usage-card', cardSelect?.options[cardIndex]?.value ?? '');
      const partnerSelect = drawer?.querySelector<HTMLSelectElement>('#nx-usage-partner');
      const partnerIndex = Array.from(partnerSelect?.options ?? []).findIndex((o) => text(o).startsWith(partner.name));
      await set('#nx-usage-partner', partnerSelect?.options[partnerIndex]?.value ?? '');
      await set('#nx-usage-amount', '10000');
      expect(text(drawer?.querySelector('[data-role="discount"]') ?? null)).toContain('R$ 10,00');
      await click(all<HTMLButtonElement>('dialog.drawer button').find((b) => text(b) === 'Registrar uso') ?? null);
      expect(app.db.cardUsages.size()).toBe(before + 1);
      const usage = app.db.cardUsages.list()[before]!;
      expect(usage.amountCents).toBe(10000);
      expect(usage.discountCents).toBe(Math.round((10000 * partner.discountPercent) / 100));
    });

    it('o responsável técnico lê os cartões, mas não registra uso', async () => {
      await open('u2', '/app/assinaturas/cartoes');
      expect(button('Registrar uso do cartão')).toBeNull();
    });
  });

  describe('acessibilidade e texto', () => {
    it('cada tela tem um h1, a tabela tem legenda e nada de travessão', async () => {
      await open('u7', '/app/assinaturas');
      for (const url of ['/app/assinaturas', '/app/assinaturas/planos', '/app/assinaturas/cartoes']) {
        await go(url);
        expect(all('h1'), url).toHaveLength(1);
        expect(text(q('main')), url).not.toMatch(/[\u2014\u2013]/);
        expect(all('table caption').length, url).toBeGreaterThan(0);
      }
    });

    it('todo campo tem rótulo: filtros, busca e a gaveta de uso do cartão', async () => {
      await open('u7', '/app/assinaturas/cartoes');
      expect(unlabeled(app.root.querySelector('main') as Element)).toEqual([]);
      await click(button('Registrar uso do cartão'));
      expect(unlabeled(drawerRoot())).toEqual([]);
      await go('/app/assinaturas');
      expect(unlabeled(app.root.querySelector('main') as Element)).toEqual([]);
    });

    it('assinatura inexistente mostra erro acolhedor com saída', async () => {
      await open('u7', '/app/assinaturas/sub_9999');
      expect(text(q('.empty__title'))).toBe('Assinatura não encontrada');
    });
  });
});
