import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionBookingService } from '@core/care/session-booking.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';

/**
 * Agenda recorrente do protótipo: marcar conversa nunca fica sem horário, mesmo quando os horários da semente já
 * passaram (os dados ficam no navegador e os dias correm). Ao abrir "Conversar com um psicólogo" o app garante horários
 * abertos para os 7 psicólogos nos próximos dias úteis, sem repetir vaga e sem mexer no que já está marcado.
 */
const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Conversar com um psicólogo: sempre há horário (agenda recorrente)', () => {
  let app: BootedCaregiverApp;
  const all = <T extends Element = HTMLElement>(selector: string): T[] => Array.from(app.root.querySelectorAll<T>(selector));
  const q = <T extends Element = HTMLElement>(selector: string): T | null => app.root.querySelector<T>(selector);
  const click = async (el: Element | null | undefined): Promise<void> => {
    if (!el) {
      throw new Error('elemento não encontrado');
    }
    (el as HTMLElement).click();
    await settleCaregiver(app.fixture);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('sem nenhum horário aberto guardado, a tela abre horários nos 3 formatos, de todas as 7 pessoas', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/hoje' });
    // Como se os horários da semente já tivessem passado: nenhuma vaga aberta.
    app.db.availabilitySlots.removeWhere((s) => s.status === 'open');
    await app.router.navigateByUrl('/cuidador/cuidar-de-mim/atendimento');
    await settleCaregiver(app.fixture);

    for (const format of ['On-line', 'No espaço de coworking', 'Em casa']) {
      await click(q('[data-role="start-booking"]'));
      await click(all('[data-role="formats"] .cg-row').find((r) => text(r.querySelector('.cg-row__title')) === format));
      expect(all('[data-role="slot"]').length, format).toBeGreaterThan(0);
      expect(text(q('main')), format).not.toContain('Sem horários nesse formato');
      await app.router.navigateByUrl('/cuidador/hoje');
      await app.router.navigateByUrl('/cuidador/cuidar-de-mim/atendimento');
      await settleCaregiver(app.fixture);
    }
    const withOpen = new Set(app.db.availabilitySlots.query((s) => s.status === 'open').map((s) => s.psychologistId));
    expect(withOpen.size).toBe(7);
  });

  it('é idempotente: a segunda vez não cria nada, e nunca repete uma vaga já existente', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/cuidar-de-mim/atendimento' });
    const booking = TestBed.inject(SessionBookingService);
    expect(booking.ensureOpenAvailability()).toBe(0);
    const keys = app.db.availabilitySlots.list().map((s) => `${s.psychologistId} ${s.date} ${s.start}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Só dias úteis, a partir de amanhã.
    const today = app.clock.today();
    app.db.availabilitySlots
      .query((s) => s.status === 'open' && s.date > today)
      .forEach((s) => expect([0, 6]).not.toContain(new Date(`${s.date}T12:00:00Z`).getUTCDay()));
  });
});
