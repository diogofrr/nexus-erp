import { describe, expect, it } from 'vitest';
import { ZaritAlert } from '../models';
import { staffContactState } from './staff-contact';

type A = Pick<ZaritAlert, 'level' | 'status' | 'deadlineAt' | 'contact'>;
const NOW = '2026-11-04T12:00:00-03:00';
const red = (overrides: Partial<A> = {}): A => ({
  level: 'red',
  status: 'open',
  deadlineAt: '2026-11-04T23:59:00-03:00',
  ...overrides,
});

describe('Contato da equipe visto pelo cuidador (RN-ZRT-13, 14 e 19)', () => {
  it('vermelho aberto, sem contato e dentro do prazo: a equipe vai falar hoje', () => {
    expect(staffContactState([red()], NOW, true)).toBe('today');
  });

  it('vermelho sem contato depois do prazo: a equipe ainda não conseguiu falar', () => {
    expect(
      staffContactState([red({ deadlineAt: '2026-11-03T23:59:00-03:00' })], NOW, true),
    ).toBe('not_yet');
    // O vencido vale mais que o do dia.
    expect(
      staffContactState(
        [red(), red({ deadlineAt: '2026-11-03T23:59:00-03:00' })],
        NOW,
        true,
      ),
    ).toBe('not_yet');
  });

  it('com contato feito, encerrado, amarelo ou sem alerta: nada a dizer', () => {
    expect(
      staffContactState(
        [red({ status: 'contacted', contact: { at: NOW, byUserId: 'u2', channel: 'phone' } })],
        NOW,
        true,
      ),
    ).toBe('none');
    expect(staffContactState([red({ status: 'closed' })], NOW, true)).toBe('none');
    expect(staffContactState([{ level: 'yellow', status: 'open' }], NOW, true)).toBe('none');
    expect(staffContactState([], NOW, true)).toBe('none');
  });

  it('sem o consentimento de saúde nunca há nota (RN-LGPD-14)', () => {
    expect(staffContactState([red()], NOW, false)).toBe('none');
    expect(
      staffContactState([red({ deadlineAt: '2026-11-03T23:59:00-03:00' })], NOW, false),
    ).toBe('none');
  });
});
