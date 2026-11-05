import { describe, expect, it } from 'vitest';
import { AuditLogService } from '@core/audit';
import { AuthService, can, menuFor } from '@core/auth';
import { Clock, addDays } from '@core/clock';
import { Database, NewEntity } from '@core/data';
import { FORMAT_PIPES, formatMoney } from '@core/format';
import type { Caregiver } from '@core/models';
import { ConsentService, maskCpf } from '@core/privacy';
import { zaritTotal } from '@core/rules';
import { generateSeed } from '@core/seed';
import { StorageService } from '@core/storage';

describe('aliases e barris do núcleo (@core/*)', () => {
  it('todos os barris resolvem e exportam o que o README promete', () => {
    expect(typeof AuditLogService).toBe('function');
    expect(typeof AuthService).toBe('function');
    expect(typeof Clock).toBe('function');
    expect(typeof Database).toBe('function');
    expect(typeof ConsentService).toBe('function');
    expect(typeof StorageService).toBe('function');
    expect(FORMAT_PIPES).toHaveLength(8);
    expect(formatMoney(4990)).toBe('R$ 49,90');
    expect(maskCpf('123.456.789-00')).toBe('***.***.***-**');
    expect(addDays('2026-11-04', 1)).toBe('2026-11-05');
    expect(can('partner', 'finance', 'view')).toBe(true);
    expect(menuFor('support').map((m) => m.key)).toContain('dashboard');
    expect(zaritTotal(new Array<number>(22).fill(1))).toBe(22);
    expect(generateSeed('2026-11-04').collections.caregivers).toHaveLength(340);
    const draft: NewEntity<Caregiver> | null = null;
    expect(draft).toBeNull();
  });
});
