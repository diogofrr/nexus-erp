import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { loginAs } from '../../shared/ui/testing/dom';
import { configureCoreTest } from '../testing/test-helpers';
import { AuditLogService } from './audit-log.service';
import { SUPERVISION_OTHER, SupervisionWindowService } from './supervision-window.service';

describe('janela de supervisão (F16-A, U-13)', () => {
  it('pede motivo, vale 30 minutos por caso e cada abertura continua gerando log', () => {
    const { db, clock } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
    loginAs('u2');
    const supervision = TestBed.inject(SupervisionWindowService);
    const before = db.accessLog.size();
    expect(supervision.access('zarit_alert', 'zal_0002', 'cg_0002')).toBe('needs_reason');
    expect(db.accessLog.size()).toBe(before);
    supervision.grant('zarit_alert', 'zal_0002', 'cg_0002', 'Supervisão de caso com alerta');
    expect(supervision.isOpen('cg_0002')).toBe(true);
    expect(supervision.isOpen('cg_0003')).toBe(false);
    expect(supervision.access('zarit_history', 'cg_0002', 'cg_0002')).toBe('open');
    const logs = TestBed.inject(AuditLogService).query({ action: 'supervise', subjectCaregiverId: 'cg_0002' });
    expect(logs.filter((l) => l.justification === 'Supervisão de caso com alerta')).toHaveLength(2);
    clock.setSimulated('2026-11-04', '12:31');
    expect(supervision.isOpen('cg_0002')).toBe(false);
    expect(supervision.access('zarit_alert', 'zal_0002', 'cg_0002')).toBe('needs_reason');
  });

  it('o motivo "Outro" exige 10 caracteres; os prontos valem; a janela some ao trocar de sessão', () => {
    configureCoreTest({ seed: true });
    expect(SupervisionWindowService.isValidReason(null, '')).toBe(false);
    expect(SupervisionWindowService.isValidReason('Auditoria de qualidade', '')).toBe(true);
    expect(SupervisionWindowService.isValidReason(SUPERVISION_OTHER, 'curto')).toBe(false);
    expect(SupervisionWindowService.isValidReason(SUPERVISION_OTHER, 'Revisão pedida pela coordenação')).toBe(true);
    loginAs('u2');
    const supervision = TestBed.inject(SupervisionWindowService);
    supervision.grant('zarit_alert', 'zal_0001', 'cg_0001', 'Revisão de ocorrência');
    expect(supervision.isOpen('cg_0001')).toBe(true);
    loginAs('u3');
    expect(supervision.isOpen('cg_0001')).toBe(false);
  });
});
