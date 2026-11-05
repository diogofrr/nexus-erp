import { describe, expect, it } from 'vitest';
import {
  checkInvite,
  checkPartnerActivation,
  checkPartnerMove,
  inviteEmailError,
  missingValidationText,
  modelChangeSendsBackToReview,
  seatCounts,
} from './partner-rules';

describe('regras de parceiros (RN-CRT-06 e RN-CRT-07)', () => {
  it('sem remuneração ativa sem validação; com remuneração exige as duas', () => {
    expect(checkPartnerActivation({ model: 'none' })).toEqual({ canActivate: true, missing: [] });
    expect(checkPartnerActivation({ model: 'fixed_fee' })).toEqual({
      canActivate: false,
      missing: ['legal', 'ethics'],
    });
    expect(
      checkPartnerActivation({ model: 'fixed_fee', legalValidatedAt: '2026-10-01' }).missing,
    ).toEqual(['ethics']);
    expect(
      checkPartnerActivation({
        model: 'commission_non_psychological',
        legalValidatedAt: '2026-10-01',
        ethicsValidatedAt: '2026-10-02',
      }).canActivate,
    ).toBe(true);
  });

  it('o motivo do botão desabilitado diz o que falta', () => {
    const move = checkPartnerMove(
      { status: 'legal_ethics_review', remuneration: { model: 'fixed_fee' } },
      'active',
    );
    expect(move).toEqual({
      ok: false,
      message: 'Para ativar falta: validação jurídica e validação ética.',
    });
    expect(missingValidationText(['ethics'])).toBe('validação ética');
  });

  it('só existem os passos do funil e parceria encerrada não anda', () => {
    const base = { remuneration: { model: 'none' as const } };
    expect(checkPartnerMove({ ...base, status: 'prospect' }, 'active').ok).toBe(false);
    expect(checkPartnerMove({ ...base, status: 'prospect' }, 'legal_ethics_review').ok).toBe(true);
    expect(checkPartnerMove({ ...base, status: 'active' }, 'suspended').ok).toBe(true);
    expect(checkPartnerMove({ ...base, status: 'suspended' }, 'active').ok).toBe(true);
    expect(checkPartnerMove({ ...base, status: 'ended' }, 'active').ok).toBe(false);
  });

  it('trocar o modelo de um parceiro ativo para um com remuneração o devolve à validação', () => {
    expect(modelChangeSendsBackToReview('active', 'none', 'fixed_fee')).toBe(true);
    expect(modelChangeSendsBackToReview('suspended', 'fixed_fee', 'commission_non_psychological')).toBe(true);
    expect(modelChangeSendsBackToReview('active', 'fixed_fee', 'none')).toBe(false);
    expect(modelChangeSendsBackToReview('prospect', 'none', 'fixed_fee')).toBe(false);
  });
});

describe('regras do canal corporativo (RN-CORP-06 e RN-CORP-07)', () => {
  const seats = (...status: ('active' | 'invited' | 'removed')[]) => status.map((s) => ({ status: s }));

  it('conta vagas ativas, convidadas e livres', () => {
    expect(seatCounts({ seats: 5 }, seats('active', 'active', 'active', 'invited', 'invited'))).toEqual({
      contracted: 5,
      active: 3,
      invited: 2,
      occupied: 5,
      free: 0,
    });
    expect(seatCounts({ seats: 5 }, seats('active', 'removed')).free).toBe(4);
  });

  it('bloqueia o convite além das vagas e fora de contrato ativo, com o motivo escrito', () => {
    const full = checkInvite({ status: 'active', seats: 5 }, seats('active', 'active', 'active', 'invited', 'invited'));
    expect(full.ok).toBe(false);
    expect(!full.ok && full.message).toContain('As 5 vagas contratadas já estão ocupadas');
    expect(checkInvite({ status: 'active', seats: 5 }, seats('active')).ok).toBe(true);
    const negotiating = checkInvite({ status: 'negotiation', seats: 5 }, []);
    expect(!negotiating.ok && negotiating.message).toBe('Só um contrato ativo recebe colaboradores.');
  });

  it('e-mail do colaborador só no domínio fictício', () => {
    expect(inviteEmailError('ana@exemplo.com.br')).toBeNull();
    expect(inviteEmailError('ana@gmail.com')).toContain('@exemplo.com.br');
    expect(inviteEmailError('sem-arroba')).not.toBeNull();
  });
});
