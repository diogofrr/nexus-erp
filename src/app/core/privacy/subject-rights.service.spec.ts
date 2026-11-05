import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { configureCoreTest } from '../testing/test-helpers';
import { ConsentService } from './consent.service';
import { SubjectRightsService, WITHDRAWN_BY_SUBJECT } from './subject-rights.service';

function setup() {
  const env = configureCoreTest({ seed: true });
  return { ...env, rights: TestBed.inject(SubjectRightsService), consents: TestBed.inject(ConsentService) };
}

describe('SubjectRightsService (pedidos do titular pelo aplicativo, RN-LGPD-18, 20, 21, 24)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('pede a cópia: protocolo novo, 15 dias corridos pelo relógio e canal aplicativo; pedir de novo devolve o mesmo', () => {
    const { rights, db } = setup();
    const first = rights.requestCopy('cg_0004');
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.request).toMatchObject({
      caregiverId: 'cg_0004',
      type: 'access',
      status: 'open',
      openedAt: '2026-11-04',
      dueAt: '2026-11-19',
      channel: 'app',
    });
    expect(first.request.protocol).toMatch(/^DSR-\d{4}$/);
    const size = db.dataSubjectRequests.size();
    const again = rights.requestCopy('cg_0004');
    expect(again).toMatchObject({ ok: false, reason: 'duplicate' });
    expect(again.ok ? '' : (again as { existing: { protocol: string } }).existing.protocol).toBe(first.request.protocol);
    expect(db.dataSubjectRequests.size()).toBe(size);
  });

  it('pede a eliminação: o cadastro vai a "encerramento pedido" e nada é eliminado na hora', () => {
    const { rights, db } = setup();
    const messagesBefore = db.messages.query((m) => m.caregiverId === 'cg_0003').length;
    const result = rights.requestErasure('cg_0003');
    expect(result.ok).toBe(true);
    expect(db.caregivers.require('cg_0003')).toMatchObject({ status: 'closure_requested', closureRequestedAt: '2026-11-04' });
    expect(db.caregivers.require('cg_0003').fullName).toContain('João');
    expect(db.messages.query((m) => m.caregiverId === 'cg_0003')).toHaveLength(messagesBefore);
  });

  it('quem já tem pedido de eliminação aberto (Raimunda) vê o pedido e não cria outro', () => {
    const { rights } = setup();
    const pending = rights.pendingOf('cg_0018', 'erasure');
    expect(pending).toBeDefined();
    expect(rights.requestErasure('cg_0018')).toMatchObject({ ok: false, reason: 'duplicate' });
  });

  it('retirar o pedido de eliminação devolve o cadastro e encerra o pedido como retirado, sem apagar nada', () => {
    const { rights, db } = setup();
    const made = rights.requestErasure('cg_0004');
    expect(made.ok).toBe(true);
    if (!made.ok) {
      return;
    }
    const out = rights.withdraw('cg_0004', made.request.id);
    expect(out.ok).toBe(true);
    expect(db.caregivers.require('cg_0004').status).toBe('active');
    expect(db.caregivers.require('cg_0004').closureRequestedAt).toBeUndefined();
    const stored = db.dataSubjectRequests.require(made.request.id);
    expect(stored.rejectedReason).toBe(WITHDRAWN_BY_SUBJECT);
    expect(rights.wasWithdrawn(stored)).toBe(true);
    expect(rights.pendingOf('cg_0004', 'erasure')).toBeUndefined();
    // Já retirado: não dá para retirar de novo.
    expect(rights.withdraw('cg_0004', made.request.id)).toMatchObject({ ok: false, reason: 'not_allowed' });
  });

  it('quem retirou a autorização de saúde volta a "pausado" ao retirar o pedido de eliminação (Sônia)', () => {
    const { rights, db, consents } = setup();
    expect(consents.status('cg_0016', 'health_data')).toBe('revoked');
    expect(db.caregivers.require('cg_0016').status).toBe('paused_by_consent_revocation');
    const made = rights.requestErasure('cg_0016');
    expect(made.ok).toBe(true);
    if (!made.ok) {
      return;
    }
    expect(db.caregivers.require('cg_0016').status).toBe('closure_requested');
    rights.withdraw('cg_0016', made.request.id);
    expect(db.caregivers.require('cg_0016').status).toBe('paused_by_consent_revocation');
  });

  it('o titular só retira o próprio pedido', () => {
    const { rights } = setup();
    const pending = rights.pendingOf('cg_0018', 'erasure');
    expect(pending).toBeDefined();
    if (!pending) {
      return;
    }
    expect(rights.withdraw('cg_0001', pending.id)).toMatchObject({ ok: false, reason: 'not_allowed' });
    expect(rights.withdraw('cg_0018', pending.id).ok).toBe(true);
  });
});
