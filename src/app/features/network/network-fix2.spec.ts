import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BootedApp, bootApp, settle } from '../../layout/testing';
import { pick, pickAll, text } from '../../shared/ui/testing/dom';

async function open(userId: string, url: string): Promise<BootedApp> {
  TestBed.resetTestingModule();
  const app = await bootApp({ userId, url });
  await settle(app.fixture);
  return app;
}

describe('Auditoria da rede: prévia só com quem muda (CX-013)', () => {
  it('a prévia mostra primeiro quem muda, com um interruptor para ver todos, e a frase de resumo bate com a tabela', async () => {
    const app = await open('u1', '/app/rede/auditoria');
    pick<HTMLButtonElement>(app.root, '[data-role="show-preview"]').click();
    await settle(app.fixture);
    const total = app.db.providers.count((p) => ['active', 'monitoring', 'suspended'].includes(p.status));
    expect(total).toBeGreaterThan(10);
    const summary = text(pick(app.root, '[data-role="preview-summary"]'));
    const visible = pickAll(app.root, '[data-role="preview"] tbody tr');
    const match = /^(\d+) de (\d+) prestadores mudam de faixa ou de estado\./.exec(summary);
    if (match) {
      expect(visible).toHaveLength(Number(match[1]));
      expect(Number(match[1])).toBeLessThan(Number(match[2]));
    } else {
      expect(summary).toContain('Nenhum dos');
    }
    // O interruptor mostra a rede inteira, com quem muda no topo.
    const toggle = pick(app.root, '[data-role="show-all"] button, [data-role="show-all"] input');
    toggle.click();
    await settle(app.fixture);
    const everyone = pickAll(app.root, '[data-role="preview"] tbody tr');
    expect(everyone.length).toBeGreaterThan(visible.length);
  });

  it('o título do resumo é coerente com a tabela: ninguém é suspenso, mas quem está na faixa de alerta é dito', async () => {
    const app = await open('u1', '/app/rede/auditoria');
    pick<HTMLButtonElement>(app.root, '[data-role="show-preview"]').click();
    await settle(app.fixture);
    const banner = text(pick(app.root, '[data-role="no-suspension"]'));
    expect(banner).toContain('Nenhum prestador é suspenso agora');
    expect(banner).not.toContain('Nenhum prestador entra em descredenciamento');
    // Se há prestador na faixa "Alerta para Descredenciamento", o resumo diz que não há suspensão automática.
    const hasAlertBand = text(pick(app.root, '[data-role="preview"]')).includes('Alerta para Descredenciamento');
    if (hasAlertBand) {
      expect(banner).toContain('sem suspensão automática');
    }
  });
});
