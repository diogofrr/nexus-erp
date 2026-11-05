/**
 * Testes de regressão do QA (`docs/05-qa.md`). Cada `it.skip` reproduz um bug ABERTO, sem navegador, e leva o
 * ID do bug no nome. Quando o bug for corrigido, trocar `it.skip` por `it` (o teste deve passar). Os testes
 * sem `skip` guardam comportamentos verificados pelo QA que não podem regredir.
 */
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { routes } from '../app.routes';
import { AuthService, TWO_FACTOR_CODE } from '../core/auth/auth.service';
import { parseImport, validateImport } from '../core/data/import-export';
import { RetentionService } from '../core/privacy/retention.service';
import { SearchService } from '../core/search/search.service';
import { configureCoreTest } from '../core/testing/test-helpers';

function loginAs(userId: string): void {
  const auth = TestBed.inject(AuthService);
  if (auth.selectProfile(userId).status === 'needs_two_factor') {
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
  }
}

describe('QA: bugs abertos', () => {
  it.skip('QA-001: o catálogo de componentes (_kit) não é uma rota de produção aberta aos 4 perfis', () => {
    const app = routes.find((r) => r.path === 'app');
    const kit = app?.children?.find((r) => r.path === '_kit');
    // O catálogo lista nomes completos de cuidadores do seed (features/kit/kit.data.ts) e a sócia abre por URL.
    expect(kit).toBeUndefined();
  });

  it.skip('QA-006: eliminar o titular não deixa aplicação da Zarit agendada nem "próxima aplicação"', () => {
    const { db } = configureCoreTest({ seed: true, time: '10:00' });
    loginAs('u7');
    const before = db.zaritAssessments.count((z) => z.caregiverId === 'cg_0018' && z.status !== 'completed');
    expect(before).toBeGreaterThan(0);
    TestBed.inject(RetentionService).erase('cg_0018');
    const after = db.zaritAssessments.query((z) => z.caregiverId === 'cg_0018' && z.status !== 'completed');
    expect(after).toEqual([]);
  });

  it.skip('QA-010: a mensagem de arquivo de importação inválido não mostra "undefined"', () => {
    const result = validateImport({ foo: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).not.toContain('undefined');
    }
  });

  it.skip('QA-011: a busca do responsável técnico só devolve prestadores que ele pode abrir (psicologia)', () => {
    const env = configureCoreTest({ seed: true, time: '10:00' });
    loginAs('u2');
    const response = TestBed.inject(SearchService).search('fisio');
    const providers = response.groups.find((g) => g.key === 'providers')?.results ?? [];
    providers.forEach((r) => {
      const provider = env.db.providers.get(r.id.replace('provider:', ''));
      expect(provider?.category, r.title).toBe('psychology');
    });
  });
});

describe('QA: comportamentos verificados (não podem regredir)', () => {
  it('importar arquivo que não é JSON é recusado sem exceção', () => {
    const result = parseImport('isto nao e json {');
    expect(result.ok).toBe(false);
  });

  it('importar cópia com CPF válido (real) é recusado', () => {
    const env = configureCoreTest({ seed: true, time: '10:00' });
    const raw = JSON.parse(env.db.exportJson()) as {
      collections: { caregivers: { cpf: string }[] };
    };
    raw.collections.caregivers[0]!.cpf = '529.982.247-25';
    const result = validateImport(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('CPF');
    }
  });
});
