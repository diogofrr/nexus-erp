import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthService, TWO_FACTOR_CODE } from '../auth/auth.service';
import { configureCoreTest } from '../testing/test-helpers';
import { AuditLogService, JustificationRequiredError, csvCell } from './audit-log.service';

function setup(): {
  audit: AuditLogService;
  auth: AuthService;
  env: ReturnType<typeof configureCoreTest>;
} {
  const env = configureCoreTest({ seed: true, time: '10:15' });
  return { env, audit: TestBed.inject(AuditLogService), auth: TestBed.inject(AuthService) };
}

function login(auth: AuthService, userId: string): void {
  if (auth.selectProfile(userId).status === 'needs_two_factor') {
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
  }
}

describe('AuditLogService: gravação (AC-GL-10, RN-LGPD-12)', () => {
  it('grava usuário, perfil, ação, entidade, id e horário do Clock', () => {
    const { audit, auth, env } = setup();
    login(auth, 'u3');
    const before = env.db.accessLog.size();
    const entry = audit.view('zarit_assessment', 'zar_0001', 'cg_0001', 'abertura da aba');
    expect(env.db.accessLog.size()).toBe(before + 2 - 1); // login do seed já estava contado
    expect(entry).toMatchObject({
      userId: 'u3',
      role: 'psychologist',
      action: 'view',
      entity: 'zarit_assessment',
      entityId: 'zar_0001',
      subjectCaregiverId: 'cg_0001',
      detail: 'abertura da aba',
      at: '2026-11-04T10:15:00-03:00',
    });
    expect(entry?.id).toMatch(/^log_\d{4}$/);
  });

  it('sem ator (ninguém logado) não grava', () => {
    const { audit } = setup();
    expect(audit.record({ action: 'view', entity: 'x' })).toBeNull();
    expect(audit.denied('route', '/app')).toBeNull();
  });

  it('com ator explícito grava mesmo sem sessão (login, negações)', () => {
    const { audit } = setup();
    expect(audit.login({ userId: 'u1', role: 'partner' })?.action).toBe('login');
    expect(audit.logout({ userId: 'u1', role: 'partner' }, 'saída pelo usuário')?.detail).toBe(
      'saída pelo usuário',
    );
    expect(audit.denied('route', 'sem permissão', { userId: 'u8', role: 'support' })?.role).toBe(
      'support',
    );
  });

  it('supervisão exige justificativa (LP-14, AC-M03-08)', () => {
    const { audit, auth } = setup();
    login(auth, 'u2');
    expect(() => audit.supervise('zarit_alert', 'zal_0002', 'cg_0002', '')).toThrow(
      JustificationRequiredError,
    );
    expect(() => audit.supervise('zarit_alert', 'zal_0002', 'cg_0002', '  ')).toThrow(
      JustificationRequiredError,
    );
    const entry = audit.supervise(
      'zarit_alert',
      'zal_0002',
      'cg_0002',
      '  Alerta vencido sem contato  ',
    );
    expect(entry).toMatchObject({
      action: 'supervise',
      role: 'technical_lead',
      justification: 'Alerta vencido sem contato',
    });
  });

  it('"mostrar" um dado mascarado exige justificativa e registra o campo (LP-07)', () => {
    const { audit, auth } = setup();
    login(auth, 'u7');
    expect(() => audit.reveal('caregiver', 'cg_0001', 'cpf', 'cg_0001', '')).toThrow(
      JustificationRequiredError,
    );
    expect(
      audit.reveal('caregiver', 'cg_0001', 'cpf', 'cg_0001', 'Confirmar cadastro'),
    ).toMatchObject({
      action: 'reveal',
      detail: 'campo: cpf',
      justification: 'Confirmar cadastro',
    });
  });

  it('gravações sensíveis, exportação e impressão', () => {
    const { audit, auth } = setup();
    login(auth, 'u3');
    expect(audit.write('update', 'session_note', 'note_0001', 'cg_0003')?.action).toBe('update');
    expect(audit.write('create', 'zarit_assessment')?.entityId).toBeUndefined();
    expect(audit.exported('subject_portability', 'cg_0019')?.action).toBe('export');
    expect(audit.printed('zarit_assessment', 'zar_0001', 'cg_0001')?.action).toBe('print');
  });

  it('o log é append-only: o repositório não tem update nem remove (LP-15)', () => {
    const { env } = setup();
    expect('update' in env.db.accessLog).toBe(false);
    expect('remove' in env.db.accessLog).toBe(false);
    expect('clear' in env.db.accessLog).toBe(true); // só pelo reset da demonstração (administração)
  });
});

describe('AuditLogService: consulta com filtros (AC-M12-06)', () => {
  it('o seed tem login, view, supervise, reveal, export e denied; mais recentes primeiro', () => {
    const { audit } = setup();
    const counts = audit.countByAction();
    expect([
      counts.login,
      counts.view,
      counts.supervise,
      counts.reveal,
      counts.export,
      counts.denied,
    ]).toEqual([14, 40, 12, 5, 3, 6]);
    const all = audit.query();
    expect(all).toHaveLength(80);
    expect(all[0]!.at >= all[79]!.at).toBe(true);
  });

  it('filtra por usuário, perfil, ação, entidade, titular, período e texto', () => {
    const { audit } = setup();
    expect(audit.query({ userId: 'u2', action: 'supervise' })).toHaveLength(12);
    expect(audit.query({ role: 'support', action: 'denied' })).toHaveLength(2);
    expect(audit.query({ action: 'denied' })).toHaveLength(6);
    expect(audit.query({ entity: 'occurrence' })).toHaveLength(4);
    expect(audit.query({ subjectCaregiverId: 'cg_0001' }).length).toBeGreaterThan(2);
    audit
      .query({ subjectCaregiverId: 'cg_0001' })
      .forEach((e) => expect(e.subjectCaregiverId).toBe('cg_0001'));
    expect(audit.query({ text: 'financeiro' }).length).toBeGreaterThanOrEqual(2);
    expect(audit.query({ text: 'ALERTA VERMELHO' }).length).toBeGreaterThan(0);
    const range = audit.query({ from: '2026-10-20', to: '2026-10-25' });
    range.forEach((e) => {
      expect(e.at.slice(0, 10) >= '2026-10-20' && e.at.slice(0, 10) <= '2026-10-25').toBe(true);
    });
    expect(audit.query({ from: '2030-01-01' })).toHaveLength(0);
  });
});

describe('AuditLogService: CSV sem conteúdo clínico (LP-16)', () => {
  it('o titular aparece pelo código e as colunas vêm com cabeçalho', () => {
    const { audit } = setup();
    const csv = audit.toCsv(audit.query({ action: 'reveal' }));
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'data_hora;usuario;perfil;acao;entidade;id;titular;justificativa;detalhe',
    );
    expect(lines).toHaveLength(6);
    expect(csv).toMatch(/CUI-\d{4}/);
    expect(csv).not.toContain('cg_00');
    expect(csv).not.toMatch(/Ana Paula|Maria Aparecida/);
  });

  it('escapa aspas, separador e neutraliza fórmulas de planilha', () => {
    expect(csvCell('simples')).toBe('simples');
    expect(csvCell('com;ponto e vírgula')).toBe('"com;ponto e vírgula"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell('=SOMA(A1)')).toBe("'=SOMA(A1)");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('linha\nnova')).toBe('"linha\nnova"');
  });
});
