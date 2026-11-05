import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { configureCoreTest } from '../testing/test-helpers';
import { ReviewRequestService } from './review-request.service';

function setup() {
  const env = configureCoreTest({ seed: true });
  return { ...env, reviews: TestBed.inject(ReviewRequestService) };
}

describe('ReviewRequestService (pedido de revisão de uma decisão, RN-ZRT-20)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('registra o pedido com o psicólogo do caso e o prazo de 15 dias corridos', () => {
    const { reviews, db } = setup();
    const result = reviews.register('cg_0001', 'zarit_decision', '  Não concordo com a decisão de acompanhamento.  ');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.request).toMatchObject({
      caregiverId: 'cg_0001',
      psychologistId: db.caregivers.require('cg_0001').assignedPsychologistId,
      about: 'zarit_decision',
      text: 'Não concordo com a decisão de acompanhamento.',
      dueAt: '2026-11-19',
    });
    expect(reviews.forCaregiver('cg_0001')[0]?.id).toBe(result.request.id);
  });

  it('texto curto demais ou cuidador desconhecido não gravam nada', () => {
    const { reviews, db } = setup();
    const before = db.reviewRequests.size();
    expect(reviews.register('cg_0001', 'zarit_decision', ' ok ')).toEqual({ ok: false, reason: 'text_too_short' });
    expect(reviews.register('cg_9999', 'zarit_decision', 'Peço a revisão da decisão.')).toEqual({ ok: false, reason: 'unknown_caregiver' });
    expect(db.reviewRequests.size()).toBe(before);
  });

  it('lista só os pedidos da própria pessoa (Maria tem o pedido do seed)', () => {
    const { reviews } = setup();
    expect(reviews.forCaregiver('cg_0002')).toHaveLength(1);
    expect(reviews.forCaregiver('cg_0001')).toHaveLength(0);
  });
});
