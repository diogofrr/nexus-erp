/**
 * Testes de regressão do QA (`docs/05-qa.md`). Cada teste leva o ID do bug no nome. Os que o Fix-1 corrigiu
 * (QA-001, 002, 006, 010 e 011) estão ativos; um `it.skip` seria um bug ainda aberto. Os testes sem ID guardam
 * comportamentos verificados pelo QA que não podem regredir.
 */
import { TestBed } from '@angular/core/testing';
import { Routes } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { createRoutes } from '../app.routes';
import { AuthService, TWO_FACTOR_CODE } from '../core/auth/auth.service';
import { parseImport, validateImport } from '../core/data/import-export';
import { ERASED_DATE, RetentionService } from '../core/privacy/retention.service';
import { SearchService } from '../core/search/search.service';
import { configureCoreTest } from '../core/testing/test-helpers';
import { KIT_PEOPLE } from '../features/kit/kit.data';
import { bootApp } from '../layout/testing';

function loginAs(userId: string): void {
  const auth = TestBed.inject(AuthService);
  if (auth.selectProfile(userId).status === 'needs_two_factor') {
    auth.verifyTwoFactor(TWO_FACTOR_CODE);
  }
}

describe('QA: bugs corrigidos pelo Fix-1', () => {
  const kitRoute = (list: Routes) => list.find((r) => r.path === 'app')?.children?.find((r) => r.path === '_kit');

  it('QA-001: o catálogo de componentes (_kit) não existe em produção e, em desenvolvimento, não usa nomes do seed', () => {
    // Em produção a rota some para todos os perfis (cai no 404); só o modo de desenvolvimento a registra.
    expect(kitRoute(createRoutes(false))).toBeUndefined();
    expect(kitRoute(createRoutes(true))).toBeDefined();
    const { db } = configureCoreTest({ seed: true, time: '10:00' });
    const seedNames = new Set([...db.caregivers.list().map((c) => c.fullName), ...db.elders.list().map((e) => e.fullName)]);
    KIT_PEOPLE.forEach((person) => expect(seedNames.has(person.name), person.name).toBe(false));
    expect(KIT_PEOPLE[0]?.name).toBe('Pessoa Exemplo 01');
  });

  it('QA-002: a raiz do M06 leva a sócia ao painel agregado sem gravar "denied" falso', async () => {
    const app = await bootApp({ userId: 'u1', url: '/app/painel' });
    const denied = (): number => app.db.accessLog.list().filter((entry) => entry.action === 'denied').length;
    const before = denied();
    await app.router.navigateByUrl('/app/acompanhamento');
    await app.fixture.whenStable();
    expect(app.router.url).toBe('/app/acompanhamento/agregado');
    expect(denied()).toBe(before);
  });

  it('QA-006: eliminar o titular não deixa aplicação da Zarit agendada, elegibilidade ao piloto nem dados cadastrais', () => {
    const { db } = configureCoreTest({ seed: true, time: '10:00' });
    loginAs('u7');
    const before = db.zaritAssessments.count((z) => z.caregiverId === 'cg_0018' && z.status !== 'completed');
    expect(before).toBeGreaterThan(0);
    const retention = TestBed.inject(RetentionService);
    // A lista "será eliminado" cita os dados cadastrais e as aplicações agendadas.
    const plan = retention.plan('cg_0018');
    expect(plan.willErase.map((i) => i.label).join(' ')).toContain('nascimento, sexo, cidade e horas de cuidado');
    expect(plan.willErase.map((i) => i.label)).toContain('Aplicações da escala ainda não feitas (agendadas)');
    retention.erase('cg_0018');
    const after = db.zaritAssessments.query((z) => z.caregiverId === 'cg_0018' && z.status !== 'completed');
    expect(after).toEqual([]);
    // As aplicações concluídas continuam, bloqueadas por registro documental.
    expect(db.zaritAssessments.count((z) => z.caregiverId === 'cg_0018' && z.status === 'completed')).toBeGreaterThan(0);
    const caregiver = db.caregivers.require('cg_0018');
    expect(caregiver).toMatchObject({ birthDate: ERASED_DATE, city: '', dailyCareHours: 0, isPilot: false, status: 'closed' });
    expect(db.elders.find((e) => e.caregiverId === 'cg_0018')?.birthDate).toBe(ERASED_DATE);
  });

  it('QA-006: a ficha do titular eliminado não mostra nascimento, sexo, cidade, horas nem a elegibilidade ao piloto', async () => {
    const app = await bootApp({ userId: 'u7', url: '/app/painel' });
    TestBed.inject(RetentionService).erase('cg_0018');
    await app.router.navigateByUrl('/app/cuidadores/cg_0018');
    await app.fixture.whenStable();
    await app.fixture.whenStable();
    const page = (app.root.querySelector('app-caregiver-summary-tab')?.textContent ?? '').replace(/\s+/g, ' ');
    expect(page).toContain('Cadastro encerrado');
    expect(page).not.toMatch(/Nascimento|Sexo|Cidade|Horas de cuidado|critérios atendidos|Elegibilidade|Aplicação da escala/);
  });

  it('QA-010: a mensagem de arquivo de importação inválido é em português simples, sem "undefined" nem nome de campo', () => {
    const result = validateImport({ foo: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const message = result.errors.join(' ');
      expect(message).not.toContain('undefined');
      expect(message).not.toMatch(/esquema|schema|collections|singletons/i);
      expect(message).toBe('Este arquivo não é uma cópia do Nexus ERP. Use um arquivo baixado em "Baixar cópia (JSON)".');
    }
  });

  it('QA-011: a busca do responsável técnico só devolve prestadores que ele pode abrir (psicologia)', () => {
    const env = configureCoreTest({ seed: true, time: '10:00' });
    loginAs('u2');
    const response = TestBed.inject(SearchService).search('fisio');
    const providers = response.groups.find((g) => g.key === 'providers')?.results ?? [];
    providers.forEach((r) => {
      const provider = env.db.providers.get(r.id.replace('provider:', ''));
      expect(provider?.category, r.title).toBe('psychology');
    });
    // Antes da correção a busca listava 7 prestadores de fisioterapia; a gestão continua vendo todos.
    expect(providers).toEqual([]);
    expect(env.db.providers.count((p) => /fisio/i.test(`${p.name} ${p.specialtyLabel}`))).toBeGreaterThan(0);
    TestBed.inject(AuthService).logout('user');
    loginAs('u1');
    const forPartner = TestBed.inject(SearchService).search('fisio').groups.find((g) => g.key === 'providers')?.results ?? [];
    expect(forPartner.length).toBeGreaterThan(0);
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
