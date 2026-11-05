import { describe, expect, it } from 'vitest';
import {
  evaluationProblem,
  isEvaluationEditable,
  isRequestOpen,
  isValidRating,
  providerAcceptsAppRequests,
  serviceRequestProblem,
} from './service-requests';

describe('pedido de serviço à rede (RN-REDE-18, 25, 26, RN-LGPD-13)', () => {
  const home = { status: 'active' as const, homeCare: true };
  const office = { status: 'monitoring' as const, homeCare: false };

  it('só prestador ativo ou em monitoramento recebe pedido', () => {
    expect(serviceRequestProblem(home, 'Sessões de fisioterapia', 'home')).toBeNull();
    expect(serviceRequestProblem(office, 'Sessões de fisioterapia', 'at_provider')).toBeNull();
    expect(serviceRequestProblem(undefined, 'Sessões', 'home')).toBe('no_provider');
    (['suspended', 'deaccredited', 'candidate', 'rejected'] as const).forEach((status) => {
      expect(serviceRequestProblem({ status, homeCare: true }, 'Sessões', 'home')).toBe('not_searchable');
    });
  });

  it('exige a necessidade escrita e só aceita atendimento em casa de quem o oferece', () => {
    expect(serviceRequestProblem(home, '   ', 'home')).toBe('no_need');
    expect(serviceRequestProblem(office, 'Sessões', 'home')).toBe('home_not_offered');
    expect(serviceRequestProblem(office, 'Sessões', 'at_provider')).toBeNull();
    expect(serviceRequestProblem(home, 'Sessões', null)).toBeNull();
  });

  it('sem a cláusula de proteção de dados o pedido não sai pelo aplicativo (S-19)', () => {
    expect(providerAcceptsAppRequests({ dataProtectionClauseSignedAt: '2026-01-04' })).toBe(true);
    expect(providerAcceptsAppRequests({})).toBe(false);
  });

  it('o usuário cancela o pedido enviado ou aceito', () => {
    expect(isRequestOpen('requested')).toBe(true);
    expect(isRequestOpen('accepted')).toBe(true);
    (['completed', 'evaluated', 'refused_by_provider', 'cancelled_by_user', 'cancelled_by_provider'] as const).forEach(
      (status) => expect(isRequestOpen(status)).toBe(false),
    );
  });
});

describe('avaliação do serviço (RN-ARP-02 e 16)', () => {
  it('nota é inteira de 1 a 5', () => {
    [1, 2, 3, 4, 5].forEach((n) => expect(isValidRating(n)).toBe(true));
    [0, 6, 3.5, -1, null, undefined, Number.NaN].forEach((n) => expect(isValidRating(n)).toBe(false));
  });

  it('duas notas, serviço concluído e uma avaliação por serviço', () => {
    const completed = { status: 'completed' as const };
    expect(evaluationProblem(completed, 5, 4)).toBeNull();
    expect(evaluationProblem(completed, null, 4)).toBe('bad_technical');
    expect(evaluationProblem(completed, 5, null)).toBe('bad_punctuality');
    expect(evaluationProblem({ status: 'evaluated', evaluationId: 'evl_1' }, 5, 5)).toBe('already_evaluated');
    expect(evaluationProblem({ status: 'completed', evaluationId: 'evl_1' }, 5, 5)).toBe('already_evaluated');
    expect(evaluationProblem({ status: 'accepted' }, 5, 5)).toBe('not_completed');
    expect(evaluationProblem({ status: 'requested' }, 5, 5)).toBe('not_completed');
  });

  it('a correção vale até a data limite, inclusive', () => {
    expect(isEvaluationEditable({ editableUntil: '2026-11-11' }, '2026-11-11')).toBe(true);
    expect(isEvaluationEditable({ editableUntil: '2026-11-11' }, '2026-11-04')).toBe(true);
    expect(isEvaluationEditable({ editableUntil: '2026-11-11' }, '2026-11-12')).toBe(false);
  });
});
