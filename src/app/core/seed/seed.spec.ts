import { describe, expect, it } from 'vitest';
import { ROLES } from '../auth/permissions';
import {
  addDays,
  compareDates,
  dateOf,
  endOfDay,
  toIsoDateTime,
  weekday,
} from '../clock/date-utils';
import { ArpBand, Caregiver, ConsentKey, ID, Provider, ZaritAssessment } from '../models';
import { caregiverCode } from '../privacy/pseudonym';
import { countSupportRequests, evaluateArbe } from '../rules/arbe';
import {
  availabilityDropSignal,
  providerAverage,
  arpBand,
  refusalStats,
  searchProviders,
} from '../rules/arp';
import { hasOverloadAlert } from '../rules/eqp';
import { realizedFinance } from '../rules/finance';
import { dsrDeadlineState } from '../rules/lgpd';
import { sameDayContactRate } from '../rules/pop05';
import { isMessageOverdue } from '../rules/sla';
import {
  isCpfChecksumValid,
  validateFictitiousEmail,
  validateFictitiousPhone,
} from '../rules/validators';
import { zaritBand } from '../rules/zarit';
import { SeedContext } from './context';
import { FIRST_NAMES, LAST_NAMES } from './names';
import { OCCURRENCE, ZARIT_ALERT, caregiverId, providerId } from './refs';
import { SCENARIOS } from './scenarios';
import { SeedDataset, generateSeed } from './seed';

const TODAY = '2026-11-04';
const data: SeedDataset = generateSeed(TODAY);
const c = data.collections;

function byId<T extends { id: string }>(list: readonly T[]): Map<string, T> {
  return new Map(list.map((e) => [e.id, e] as const));
}

function lastZarit(id: ID): number | undefined {
  const done = c.zaritAssessments.filter((z) => z.caregiverId === id && z.status === 'completed');
  return done.sort((a, b) => ((a.appliedAt as string) < (b.appliedAt as string) ? -1 : 1)).pop()
    ?.total;
}

function providerStats(n: number): { average: number | null; count: number; graves: number } {
  const id = providerId(n);
  const evals = c.providerEvaluations.filter((e) => e.providerId === id);
  const graves =
    evals.filter((e) => e.grave).length +
    c.complaints.filter((r) => r.severity === 'grave' && r.target.providerId === id).length;
  return { average: providerAverage(evals), count: evals.length, graves };
}

describe('seed: contagens da seção 5.15', () => {
  it('gera as quantidades esperadas', () => {
    expect(c.users).toHaveLength(8);
    expect(c.psychologists).toHaveLength(4);
    expect(c.rooms).toHaveLength(3);
    expect(c.caregivers).toHaveLength(340);
    expect(c.elders).toHaveLength(340);
    expect(c.subscriptions).toHaveLength(340);
    expect(c.benefitCards.filter((x) => x.status === 'active')).toHaveLength(17);
    expect(c.benefitCards.filter((x) => x.status === 'inactive')).toHaveLength(1);
    expect(c.zaritAssessments.filter((z) => z.status === 'completed')).toHaveLength(158);
    expect(c.providers).toHaveLength(20);
    expect(c.accreditations).toHaveLength(20);
    expect(c.serviceRequests).toHaveLength(213);
    expect(c.serviceRequests.filter((r) => r.status === 'evaluated')).toHaveLength(124);
    expect(c.providerEvaluations).toHaveLength(124);
    // docs/20: 11 encontros (2 rodas abertas, 5 capacitações e 4 terapias de grupo, com os estados de antes).
    expect(c.activities).toHaveLength(11);
    expect(c.partners).toHaveLength(9);
    expect(c.corporateAccounts).toHaveLength(3);
    expect(c.messages).toHaveLength(28);
    expect(c.complaints).toHaveLength(5);
    expect(c.dataSubjectRequests).toHaveLength(5);
    expect(c.accessLog).toHaveLength(80);
    expect(c.pops).toHaveLength(10);
    expect(c.risks).toHaveLength(12);
    expect(c.referrals).toHaveLength(10);
    expect(c.occurrences).toHaveLength(3);
    expect(c.cardUsages).toHaveLength(25);
    // 60 do seed original + 3 conversas futuras de demonstração (Ana, Lourdes e Elza, build-caregiver-app.ts; a de Elza
    // entrou com o docs/20, para o Sustenta mostrar a cota do mês em uso).
    expect(c.careSessions).toHaveLength(63);
    expect(c.consents).toHaveLength(340 * 6);
    expect(c.consentTerms).toHaveLength(6);
    expect(c.privacyDocuments.map((d) => d.kind).sort()).toEqual([
      'privacy_policy',
      'ripd',
      'service_contract',
    ]);
    expect(c.messageTemplates).toHaveLength(6);
    expect(c.incidents).toHaveLength(2);
    expect(c.trainingEvents).toHaveLength(6);
    // docs/20: 2 conteúdos publicados a mais, para cada categoria ter leitura.
    expect(c.guidanceContents).toHaveLength(10);
    expect(c.norms).toHaveLength(6);
    expect(c.pilotEnrollments).toHaveLength(15);
    expect(FIRST_NAMES).toHaveLength(60);
    expect(LAST_NAMES).toHaveLength(60);
  });

  it('distribui as assinaturas pagas: 17 (7 Essencial, 5 Cuida com 3 pagas pela empresa, 5 Sustenta)', () => {
    const paid = c.subscriptions.filter((s) => s.planId !== 'livre');
    expect(paid).toHaveLength(17);
    expect(paid.filter((s) => s.planId === 'essencial')).toHaveLength(7);
    expect(paid.filter((s) => s.planId === 'cuida')).toHaveLength(5);
    expect(paid.filter((s) => s.planId === 'cuida' && s.payer === 'corporate')).toHaveLength(3);
    expect(paid.filter((s) => s.planId === 'sustenta')).toHaveLength(5);
    const scenarioPlans = SCENARIOS.map((d) => d.plan);
    expect(scenarioPlans.filter((p) => p === 'livre')).toHaveLength(12);
  });

  it('traz 1 cartão inativo (C120, de volta ao Livre) e 1 incidente de dados aberto, além do encerrado', () => {
    const inactive = c.benefitCards.filter((x) => x.status === 'inactive');
    expect(inactive).toHaveLength(1);
    const card = inactive[0]!;
    expect(card.caregiverId).toBe(caregiverId(120));
    expect(card.inactivatedAt).toBeDefined();
    expect(c.subscriptions.find((s) => s.caregiverId === card.caregiverId)?.planId).toBe('livre');
    const history = c.planChanges.filter(
      (p) => p.subscriptionId === c.subscriptions.find((s) => s.caregiverId === card.caregiverId)?.id,
    );
    expect(history.map((p) => p.kind)).toEqual(['upgrade', 'cancel']);
    expect(new Set(c.benefitCards.map((x) => x.number)).size).toBe(c.benefitCards.length);
    expect(c.incidents.map((i) => i.status).sort()).toEqual(['closed', 'open']);
    const open = c.incidents.find((i) => i.status === 'open')!;
    expect(open.communications).toEqual([]);
    expect(open.affectedSubjects).toBeGreaterThan(0);
  });

  it('o realizado do seed reproduz o escopo: R$ 1.698,30, R$ 1.511,49, -R$ 843,51 e faltam 10', () => {
    const subs = c.subscriptions.filter((s) => s.planId !== 'livre' && s.status !== 'cancelled');
    const byPlan = {
      essencial: subs.filter((s) => s.planId === 'essencial').length,
      cuida: subs.filter((s) => s.planId === 'cuida').length,
      sustenta: subs.filter((s) => s.planId === 'sustenta').length,
    };
    const r = realizedFinance(data.singletons.financialParams, byPlan);
    expect(r.subscribers).toBe(17);
    expect(r.grossRevenueCents).toBe(169_830);
    expect(r.netRevenueCents).toBe(151_149);
    expect(r.costsCents).toBe(235_500);
    expect(r.resultCents).toBe(-84_351);
    expect(r.missing).toBe(10);
    expect((17 / 340) * 100).toBe(5);
  });
});

describe('seed: os 29 cenários de cuidadores', () => {
  it('existem C01 a C29 com id, código e nome', () => {
    expect(SCENARIOS).toHaveLength(29);
    SCENARIOS.forEach((def) => {
      const cg = c.caregivers.find((x) => x.id === caregiverId(def.n)) as Caregiver;
      expect(cg, `C${def.n}`).toBeDefined();
      expect(cg.code).toBe(caregiverCode(def.n));
      expect(cg.fullName).toBe(def.fullName);
      expect(c.elders.some((e) => e.caregiverId === cg.id)).toBe(true);
    });
  });

  it('as aplicações da Zarit seguem a tabela e cobrem os limites 0, 20, 21, 40, 41, 60, 61 e 88', () => {
    const latest = new Set<number>();
    SCENARIOS.forEach((def) => {
      const totals = c.zaritAssessments
        .filter((z) => z.caregiverId === caregiverId(def.n) && z.status === 'completed')
        .sort((a, b) => ((a.appliedAt as string) < (b.appliedAt as string) ? -1 : 1))
        .map((z) => z.total);
      expect(totals, `C${def.n}`).toEqual(
        def.zarit(new SeedContext(TODAY)).map((point) => point.total),
      );
      latest.add(totals[totals.length - 1] as number);
    });
    [0, 20, 21, 40, 41, 60, 61, 88].forEach((limit) =>
      expect(latest.has(limit), `limite ${limit}`).toBe(true),
    );
    expect(lastZarit(caregiverId(1))).toBe(63);
    expect(lastZarit(caregiverId(2))).toBe(79);
    expect(lastZarit(caregiverId(11))).toBe(88);
    expect(lastZarit(caregiverId(12))).toBe(18);
  });

  it('cada Zarit tem 22 respostas de 0 a 4 que somam o total e a faixa certa', () => {
    c.zaritAssessments
      .filter((z: ZaritAssessment) => z.status === 'completed')
      .forEach((z) => {
        const answers = z.answers as number[];
        expect(answers).toHaveLength(22);
        expect(answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 4)).toBe(true);
        expect(answers.reduce((s, a) => s + a, 0)).toBe(z.total);
        expect(z.band).toBe(zaritBand(z.total as number));
      });
  });

  it('os 311 cuidadores de volume seguem 24, 46, 36 e 14 por faixa e consentimento de saúde em 85%', () => {
    const volumeIds = new Set(c.caregivers.slice(29).map((x) => x.id));
    const adesao = c.zaritAssessments.filter(
      (z) => volumeIds.has(z.caregiverId) && z.status === 'completed',
    );
    expect(adesao).toHaveLength(120);
    const count = (band: string): number => adesao.filter((z) => z.band === band).length;
    expect([
      count('absent_or_small'),
      count('moderate'),
      count('moderate_to_severe'),
      count('severe'),
    ]).toEqual([24, 46, 36, 14]);
    adesao.forEach((z) => {
      const age = compareDates(TODAY, z.appliedAt as string);
      expect(age).toBeGreaterThanOrEqual(60);
      expect(age).toBeLessThanOrEqual(170);
    });
    const granted = c.consents.filter(
      (x) => volumeIds.has(x.caregiverId) && x.key === 'health_data' && x.status === 'granted',
    );
    expect(granted).toHaveLength(264);
    expect(
      c.caregivers
        .slice(29)
        .every((x) => c.subscriptions.find((s) => s.caregiverId === x.id)?.planId === 'livre'),
    ).toBe(true);
  });

  it('alertas nomeados Z-a a Z-i e o contato no mesmo dia de 66,7%', () => {
    const alerts = byId(c.zaritAlerts);
    const a = alerts.get(ZARIT_ALERT.a)!;
    expect(a.level).toBe('red');
    expect(a.status).toBe('open');
    expect(a.deadlineAt).toBe(endOfDay(TODAY));
    expect(a.contact).toBeUndefined();
    const b = alerts.get(ZARIT_ALERT.b)!;
    expect(b.deadlineAt).toBe(endOfDay(addDays(TODAY, -1)));
    expect(alerts.get(ZARIT_ALERT.c)!.status).toBe('closed');
    expect(alerts.get(ZARIT_ALERT.d)!.level).toBe('yellow');
    expect(alerts.get(ZARIT_ALERT.e)!.supportNetworkReviewDone).toBe(false);
    expect(alerts.get(ZARIT_ALERT.f)!.status).toBe('contacted');
    expect(alerts.get(ZARIT_ALERT.g)!.riskAssessment?.level).toBe('low');
    expect(alerts.get(ZARIT_ALERT.h)!.riskAssessment?.level).toBe('high');
    expect(alerts.get(ZARIT_ALERT.i)!.occurrenceId).toBe(OCCURRENCE.o3);
    const assessments = byId(c.zaritAssessments);
    const now = toIsoDateTime(TODAY, '12:00');
    const stat = sameDayContactRate(
      c.zaritAlerts,
      (al) => assessments.get(al.assessmentId)?.appliedAt,
      now,
    );
    expect(stat.numerator).toBe(2);
    expect(stat.denominator).toBe(3);
    expect(stat.percent).toBe(66.7);
    const open = c.zaritAlerts.filter((x) => x.status === 'open');
    expect(open.filter((x) => x.level === 'yellow')).toHaveLength(2);
    expect(open.filter((x) => x.level === 'red')).toHaveLength(2);
  });

  it('a ARBE da regra gera critical para Ana e attention para o caso de 9 h', () => {
    const settings = data.singletons.settings.arbe;
    const evaluate = (n: number) => {
      const cg = c.caregivers.find((x) => x.id === caregiverId(n)) as Caregiver;
      return evaluateArbe(
        {
          dailyCareHours: cg.dailyCareHours,
          supportRequestsInWindow: countSupportRequests(
            c.messages,
            cg.id,
            TODAY,
            settings.windowDays,
          ),
          lastZarit: lastZarit(cg.id) ?? null,
        },
        settings,
      );
    };
    expect(evaluate(1)?.level).toBe('critical');
    expect(evaluate(29)?.level).toBe('attention');
    const stored = c.arbeAlerts.filter((x) => x.status !== 'closed' && x.status !== 'discarded');
    expect(stored.some((x) => x.caregiverId === caregiverId(1) && x.level === 'critical')).toBe(
      true,
    );
    expect(stored.some((x) => x.caregiverId === caregiverId(29) && x.level === 'attention')).toBe(
      true,
    );
    expect(c.arbeAlerts.some((x) => x.caregiverId === caregiverId(16))).toBe(false);
  });

  it('consentimentos: C16 revogado, C17 parcial, TCLE em 15, histórico append-only coerente', () => {
    const status = (n: number, key: ConsentKey): string =>
      c.consents.find((x) => x.caregiverId === caregiverId(n) && x.key === key)?.status as string;
    expect(status(16, 'health_data')).toBe('revoked');
    expect(c.caregivers.find((x) => x.id === caregiverId(16))?.status).toBe(
      'paused_by_consent_revocation',
    );
    expect(status(17, 'image_testimony')).toBe('refused');
    expect(status(17, 'people_analytics')).toBe('refused');
    expect(status(17, 'health_data')).toBe('granted');
    expect(c.consents.filter((x) => x.key === 'pilot_tcle' && x.status === 'granted')).toHaveLength(
      15,
    );
    const events16 = c.consentEvents.filter(
      (e) => e.caregiverId === caregiverId(16) && e.key === 'health_data',
    );
    expect(events16.map((e) => e.status)).toEqual(['granted', 'revoked']);
    c.consents.forEach((cons) => {
      const events = c.consentEvents.filter(
        (e) => e.caregiverId === cons.caregiverId && e.key === cons.key,
      );
      const last = events[events.length - 1];
      expect(last ? last.status : 'pending').toBe(cons.status);
    });
  });

  it('solicitações do titular: C18 vence em 5 dias, C20 em 2 (vence em breve), C19 e C16 concluídas', () => {
    const find = (n: number) =>
      c.dataSubjectRequests.find((r) => r.caregiverId === caregiverId(n))!;
    expect(find(18).type).toBe('erasure');
    expect(find(18).dueAt).toBe(addDays(TODAY, 5));
    expect(dsrDeadlineState(find(18), TODAY)).toBe('on_time');
    expect(find(20).dueAt).toBe(addDays(TODAY, 2));
    expect(dsrDeadlineState(find(20), TODAY)).toBe('due_soon');
    expect(find(19).status).toBe('completed');
    expect(find(16).status).toBe('completed');
    expect(find(2).type).toBe('decision_review');
    expect(dsrDeadlineState(find(18), addDays(TODAY, 8))).toBe('overdue');
  });

  it('ocorrências: O-1 encerrada com 7 passos, O-2 só com o acolhimento feito (o contato fica pendente), O-3 POP-07 sem notificação comunicada', () => {
    const occ = byId(c.occurrences);
    expect(occ.get(OCCURRENCE.o1)!.status).toBe('closed');
    expect(occ.get(OCCURRENCE.o1)!.steps.filter((s) => s.doneAt)).toHaveLength(7);
    expect(occ.get(OCCURRENCE.o2)!.steps.filter((s) => s.doneAt).map((s) => s.n)).toEqual([1]);
    expect(occ.get(OCCURRENCE.o2)!.steps[1]?.doneAt).toBeUndefined();
    expect(occ.get(OCCURRENCE.o2)!.steps[1]?.note).toContain('contato efetivo pendente');
    expect(occ.get(OCCURRENCE.o2)!.steps).toHaveLength(7);
    expect(occ.get(OCCURRENCE.o3)!.kind).toBe('pop07_violence_suspicion');
    expect(occ.get(OCCURRENCE.o3)!.authoritiesNotified.every((a) => a.at === undefined)).toBe(true);
  });
});

describe('seed: rede credenciada (5.8 e 5.9)', () => {
  const expected: [number, number | null, number, number, ArpBand][] = [
    // n, média, avaliações, graves, faixa
    [1, 4.83, 12, 0, 'excellence'],
    [2, 4.61, 9, 0, 'excellence'],
    [3, 4.25, 8, 0, 'alert'],
    [4, 4.14, 7, 1, 'alert'],
    [5, 4.7, 10, 0, 'excellence'],
    [6, 4.42, 6, 0, 'alert'],
    [7, 4.89, 14, 0, 'excellence'],
    [8, 4.5, 6, 0, 'excellence'],
    [9, 4, 5, 0, 'alert'],
    [10, 3.57, 7, 1, 'deaccreditation'],
    [11, 4.7, 10, 0, 'excellence'],
    [12, 4.33, 6, 0, 'alert'],
    [13, null, 3, 0, 'no_average'],
    [14, 4.31, 8, 3, 'deaccreditation'],
    [15, 4.6, 5, 0, 'excellence'],
    [19, 3, 6, 3, 'deaccreditation'],
    [20, null, 2, 0, 'no_average'],
  ];

  it('as médias, o número de avaliações e as reclamações graves batem com a tabela', () => {
    expected.forEach(([n, average, count, graves, band]) => {
      const stats = providerStats(n);
      expect(stats.count, `P${n} avaliações`).toBe(count);
      expect(stats.average, `P${n} média`).toBe(average);
      expect(stats.graves, `P${n} graves`).toBe(graves);
      expect(arpBand(stats.average, stats.graves), `P${n} faixa`).toBe(band);
    });
  });

  it('cada avaliação tem duas notas inteiras de 1 a 5 e nenhum prestador sem solicitação aceita-concluída fica sem vínculo', () => {
    c.providerEvaluations.forEach((e) => {
      [e.technicalQuality, e.punctualityCourtesy].forEach((n) =>
        expect(Number.isInteger(n) && n >= 1 && n <= 5).toBe(true),
      );
      expect(e.score).toBe((e.technicalQuality + e.punctualityCourtesy) / 2);
    });
    const requests = byId(c.serviceRequests);
    c.providerEvaluations.forEach((e) =>
      expect(requests.get(e.serviceRequestId)?.status).toBe('evaluated'),
    );
  });

  it('taxa de recusa: P04 62,5% com selo, P06 30,0% com selo (limiar exato), P03 28,6% sem selo', () => {
    const now = toIsoDateTime(TODAY, '12:00');
    const stat = (n: number) => refusalStats(c.serviceRequests, providerId(n), now);
    expect(stat(4)).toMatchObject({
      received: 8,
      refusedOrCancelledByProvider: 5,
      percent: 62.5,
      exitRisk: true,
    });
    expect(stat(6)).toMatchObject({
      received: 10,
      refusedOrCancelledByProvider: 3,
      percent: 30,
      exitRisk: true,
    });
    expect(stat(3)).toMatchObject({
      received: 7,
      refusedOrCancelledByProvider: 2,
      percent: 28.6,
      exitRisk: false,
    });
    expect(stat(1).percent).toBe(10);
    expect(stat(10).exitRisk).toBe(false);
    const recent = c.serviceRequests.filter((r) => r.status !== 'evaluated');
    expect(recent).toHaveLength(89);
  });

  it('a queda de disponibilidade de P04 passa de 50% e a dos demais não', () => {
    const p04 = c.providers.find((p) => p.id === providerId(4)) as Provider;
    expect(availabilityDropSignal(p04.availability)).toMatchObject({
      current: 4,
      dropPercent: 60,
      signal: true,
    });
    const others = c.providers.filter((p) => p.id !== providerId(4) && p.availability.length > 0);
    others.forEach((p) => expect(availabilityDropSignal(p.availability).signal).toBe(false));
  });

  it('a busca como o usuário vê: opções por especialidade, única opção e nenhuma opção', () => {
    const n = (category: Provider['category']) =>
      searchProviders(c.providers, category).options.length;
    expect(n('physiotherapy')).toBe(5);
    expect(n('professional_caregiver')).toBe(3);
    expect(n('pharmacy')).toBe(2);
    (['home_care', 'nursing', 'psychology', 'legal'] as const).forEach((cat) =>
      expect(searchProviders(c.providers, cat).availability).toBe('single_option'),
    );
    (['clinic', 'nutrition', 'specialized_service'] as const).forEach((cat) =>
      expect(searchProviders(c.providers, cat).availability).toBe('none'),
    );
    const physio = searchProviders(c.providers, 'physiotherapy').options;
    const names = physio.map((p) => p.name);
    expect(names).toContain('Dr. Eduardo Falcão');
    expect(names).toContain('Dra. Sônia Peixoto');
    expect(physio[0]?.highlight).toBe(true);
  });

  it('P11 (fisioterapeuta, CREFITO) é um prestador ativo com 2 solicitações novas e cláusula assinada; ninguém da rede tem login', () => {
    const physio = c.providers.find((p) => p.id === providerId(11)) as Provider;
    expect(physio.category).toBe('physiotherapy');
    expect(physio.council.body).toBe('CREFITO');
    expect(physio.status).toBe('active');
    expect(physio.dataProtectionClauseSignedAt).toBeDefined();
    expect(c.users.every((u) => ROLES.includes(u.role))).toBe(true);
    expect(c.users.some((u) => 'providerId' in u)).toBe(false);
    const recent = c.serviceRequests.filter(
      (r) => r.providerId === physio.id && r.status !== 'evaluated',
    );
    expect(recent.filter((r) => r.status === 'requested')).toHaveLength(2);
    expect(recent.filter((r) => r.status === 'accepted')).toHaveLength(1);
    expect(recent.filter((r) => r.status === 'completed')).toHaveLength(1);
  });

  it('credenciamentos: P16 pendente com CREFITO vencido, P17 em análise, P18 reprovado, P19 descredenciado com e-mail, P20 sem cláusula', () => {
    const acc = (n: number) => c.accreditations.find((a) => a.providerId === providerId(n))!;
    expect(acc(16).status).toBe('pending_documents');
    const doc = c.providerDocuments.find(
      (d) => d.providerId === providerId(16) && d.kind === 'council_registry',
    )!;
    expect(doc.validUntil).toBe(addDays(TODAY, -12));
    expect(acc(17).status).toBe('in_review');
    expect(c.providers.find((p) => p.id === providerId(17))?.integrationDoneAt).toBeUndefined();
    expect(acc(18).status).toBe('rejected');
    expect(acc(18).rejectionReason).toBeTruthy();
    const p19 = c.providers.find((p) => p.id === providerId(19))!;
    expect(p19.status).toBe('deaccredited');
    expect(c.internalReviews.find((r) => r.providerId === p19.id)?.closureEmail?.sentAt).toBe(
      toIsoDateTime(addDays(TODAY, -60), '10:30'),
    );
    const p20 = c.providers.find((p) => p.id === providerId(20))!;
    expect(p20.dataProtectionClauseSignedAt).toBeUndefined();
    expect(p20.integrationDoneAt).toBeDefined();
    expect(c.providers.find((p) => p.id === providerId(10))?.status).toBe('suspended');
    expect(
      c.internalReviews.find((r) => r.providerId === providerId(10))?.justification,
    ).toBeTruthy();
    expect(c.providers.find((p) => p.id === providerId(14))?.status).toBe('suspended');
    expect(
      c.internalReviews.find((r) => r.providerId === providerId(14))?.justification,
    ).toBeUndefined();
  });

  it('as duas auditorias anteriores (D-28 e D-14) existem e a próxima vence em D+1', () => {
    const dates = [...new Set(c.arpSnapshots.map((s) => s.auditDate))].sort();
    expect(dates).toEqual([addDays(TODAY, -28), addDays(TODAY, -14)]);
    expect(addDays(dates[1] as string, 15)).toBe(addDays(TODAY, 1));
  });
});

describe('seed: agenda e equipe (5.2)', () => {
  it('as 63 sessões (60 do seed e 3 de demonstração do aplicativo) seguem a distribuição de estados, modalidades e classificação', () => {
    const s = c.careSessions;
    const count = (status: string): number => s.filter((x) => x.status === status).length;
    // As 3 conversas de demonstração (Ana e Elza, agendadas, on-line; Lourdes, confirmada, coworking) somam nas colunas.
    expect([
      count('done'),
      count('no_show'),
      count('cancelled_by_user'),
      count('cancelled_by_psychologist'),
      count('confirmed'),
      count('scheduled'),
    ]).toEqual([24, 3, 2, 2, 9, 23]);
    expect(s.filter((x) => x.modality === 'online')).toHaveLength(32);
    expect(s.filter((x) => x.modality === 'in_person_coworking')).toHaveLength(22);
    expect(s.filter((x) => x.modality === 'in_person_home')).toHaveLength(9);
    expect(s.filter((x) => x.kind === 'psychotherapy')).toHaveLength(54);
    expect(
      s
        .filter((x) => x.modality === 'online' && x.status === 'done')
        .every((x) => x.remoteFormatConfirmedPertinent === true),
    ).toBe(true);
    const rooms = byId(c.rooms);
    s.filter((x) => x.modality === 'in_person_coworking').forEach((x) => {
      const room = rooms.get(x.roomId as string)!;
      expect(Object.values(room.accessibility).every(Boolean)).toBe(true);
    });
    s.filter(
      (x) => x.modality === 'in_person_home' && (x.status === 'done' || x.status === 'confirmed'),
    ).forEach((x) => expect(x.homeVisitConfirmedSafe).toBe(true));
    s.forEach((x) => {
      expect(weekday(dateOf(x.startAt))).toBeGreaterThanOrEqual(1);
      expect(weekday(dateOf(x.startAt))).toBeLessThanOrEqual(5);
    });
  });

  it('20 anotações assinadas e 4 em rascunho; vagas: 12 abertas (4 prioritárias) e 3 bloqueadas', () => {
    expect(c.sessionNotes.filter((n) => n.status === 'signed')).toHaveLength(20);
    expect(c.sessionNotes.filter((n) => n.status === 'draft')).toHaveLength(4);
    const open = c.availabilitySlots.filter((x) => x.status === 'open');
    expect(open).toHaveLength(12);
    expect(open.filter((x) => x.priorityOnly)).toHaveLength(4);
    expect(c.availabilitySlots.filter((x) => x.status === 'blocked')).toHaveLength(3);
    open.forEach((x) => expect(compareDates(x.date, TODAY)).toBeGreaterThan(0));
    const sessionSlots = new Set(c.careSessions.map((x) => x.slotId));
    expect(sessionSlots.size).toBe(63);
  });

  it('a ocupação reproduz Rafael 86,3% e 91,3% (alerta), Beatriz sem alerta, Letícia 80% sem alerta e Tiago n/d', () => {
    const rows = (key: string) =>
      c.monthSummaries
        .filter((m) => m.psychologistId === key)
        .sort((a, b) => (a.month < b.month ? -1 : 1));
    const current = TODAY.slice(0, 7);
    expect(hasOverloadAlert(rows('psy_0001'), current)).toBe(true);
    expect(hasOverloadAlert(rows('psy_0002'), current)).toBe(false);
    expect(hasOverloadAlert(rows('psy_0003'), current)).toBe(false);
    expect(hasOverloadAlert(rows('psy_0004'), current)).toBe(false);
    expect(rows('psy_0004')[0]).toMatchObject({ availableHours: 0, doneHours: 0 });
    expect(rows('psy_0001').map((m) => [m.availableHours, m.doneHours])).toEqual([
      [160, 138],
      [160, 146],
    ]);
  });
});

describe('seed: comunicação, grupos, parceiros e governança', () => {
  it('28 mensagens (app 9, WhatsApp 8, telefone 4, e-mail 7) com 5 atrasadas em qualquer hora do dia', () => {
    const by = (channel: string): number => c.messages.filter((m) => m.channel === channel).length;
    expect([by('app'), by('whatsapp'), by('phone'), by('email')]).toEqual([9, 8, 4, 7]);
    ['00:30', '07:00', '12:00', '23:30'].forEach((time) => {
      const now = toIsoDateTime(TODAY, time);
      expect(
        c.messages.filter((m) => isMessageOverdue(m, now)),
        `às ${time}`,
      ).toHaveLength(5);
    });
    expect(c.messages.filter((m) => m.riskFlag)).toHaveLength(1);
    const support = (n: number) => countSupportRequests(c.messages, caregiverId(n), TODAY, 30);
    expect([support(1), support(29), support(2), support(3)]).toEqual([4, 3, 3, 2]);
    expect(c.messages.some((m) => m.caregiverId === caregiverId(26))).toBe(false);
  });

  it('reclamações REC-0001 a REC-0005 nos estados esperados', () => {
    const rec = (n: number) => c.complaints.find((x) => x.protocol === `REC-000${n}`)!;
    expect(rec(1)).toMatchObject({
      severity: 'grave',
      graveCategory: 'confidentiality_breach',
      status: 'in_progress',
    });
    expect(rec(1).target.providerId).toBe(providerId(14));
    expect(rec(2)).toMatchObject({
      severity: 'grave',
      graveCategory: 'unjustified_absence',
      status: 'open',
    });
    expect(rec(3).status).toBe('closed');
    expect(rec(4).suspectedElderAbuse).toBe(true);
    expect(rec(4).occurrenceId).toBe(OCCURRENCE.o3);
    expect(rec(5).status).toBe('open');
    expect(compareDates(dateOf(rec(5).dueAt), TODAY)).toBeLessThan(0);
  });

  it('encontros G1 a G11 (docs/20): só três tipos, lotado com lista de espera, terapia em andamento, rascunho, cancelado e cotas coerentes', () => {
    const act = (n: number) => c.activities.find((a) => a.id === `act_${String(n).padStart(4, '0')}`)!;
    const enr = (n: number, status?: string) =>
      c.activityEnrollments.filter(
        (e) => e.activityId === act(n).id && (status === undefined || e.status === status),
      );
    const kinds = c.activities.map((a) => a.kind);
    expect(new Set(kinds)).toEqual(new Set(['open_circle', 'training', 'group_therapy']));
    expect(kinds.filter((k) => k === 'open_circle')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'training')).toHaveLength(5);
    expect(kinds.filter((k) => k === 'group_therapy')).toHaveLength(4);
    const live = (kind: string) => c.activities.filter((a) => a.kind === kind && ['open', 'full', 'in_progress'].includes(a.status));
    expect(live('open_circle').length).toBeGreaterThanOrEqual(2);
    expect(live('training').length).toBeGreaterThanOrEqual(3);
    expect(live('group_therapy').length).toBeGreaterThanOrEqual(3);
    c.activities.forEach((a) => {
      expect(a.minPlan).toBe(a.kind === 'group_therapy' ? 'cuida' : null);
      expect(a.requiresEligibility).toBe(false);
    });
    expect(act(1)).toMatchObject({ kind: 'group_therapy', status: 'full', capacity: 6 });
    expect(enr(1, 'enrolled')).toHaveLength(6);
    expect(enr(1, 'waitlist').map((e) => e.waitlistPosition)).toEqual([1, 2]);
    expect(act(2)).toMatchObject({ kind: 'training', status: 'open' });
    expect(enr(2)).toHaveLength(8);
    expect(act(3)).toMatchObject({ kind: 'group_therapy', character: 'psychotherapy', status: 'in_progress' });
    expect(act(3).meetings.filter((m) => m.done)).toHaveLength(2);
    expect(act(4).kind).toBe('open_circle');
    expect(enr(4)).toHaveLength(11);
    expect(enr(4).filter((e) => e.external)).toHaveLength(4);
    expect(enr(5, 'attended')).toHaveLength(9);
    expect(enr(5, 'absent')).toHaveLength(2);
    expect(act(6).status).toBe('cancelled');
    expect(act(7).status).toBe('draft');
    expect(act(10)).toMatchObject({ kind: 'training', status: 'full' });
    expect(enr(10, 'waitlist')).toHaveLength(2);
    expect(enr(10).every((e) => e.paid === true && e.priceCents === 8000)).toBe(true);
    // Terapia de grupo só com Cuida e Sustenta; Ana e Lourdes em terapia de grupo; João só em roda aberta; Maria em capacitação incluída.
    const plans = new Map(c.subscriptions.map((s) => [s.caregiverId, s.planId] as const));
    c.activityEnrollments
      .filter((e) => e.caregiverId && act(Number(e.activityId.slice(4))).kind === 'group_therapy')
      .forEach((e) => expect(['cuida', 'sustenta']).toContain(plans.get(e.caregiverId as string)));
    expect(c.activityEnrollments.some((e) => e.caregiverId === caregiverId(1) && e.activityId === act(1).id && e.status === 'enrolled')).toBe(true);
    expect(c.activityEnrollments.some((e) => e.caregiverId === caregiverId(24) && e.activityId === act(3).id && e.status === 'enrolled')).toBe(true);
    const joao = c.activityEnrollments.filter((e) => e.caregiverId === caregiverId(3));
    expect(joao.every((e) => act(Number(e.activityId.slice(4))).kind === 'open_circle')).toBe(true);
    expect(c.activityEnrollments.find((e) => e.caregiverId === caregiverId(2) && e.activityId === act(2).id)).toMatchObject({
      includedInPlan: true,
      paid: false,
    });
  });

  it('sessões pela cota do plano (docs/20): incluídas só em Cuida e Sustenta, dentro do limite do mês', () => {
    const plans = new Map(c.subscriptions.map((s) => [s.caregiverId, s.planId] as const));
    const limit: Record<string, number> = { livre: 0, essencial: 0, cuida: 2, sustenta: 4 };
    const used = new Map<string, number>();
    c.careSessions.forEach((s) => {
      expect(s.priceCents).toBe(s.includedInPlan ? 0 : 12000);
      expect(s.discountPercent).toBe(0);
      if (s.includedInPlan) {
        const key = `${s.caregiverId}|${s.startAt.slice(0, 7)}`;
        used.set(key, (used.get(key) ?? 0) + 1);
      }
    });
    used.forEach((n, key) => expect(n).toBeLessThanOrEqual(limit[plans.get(key.split('|')[0] as string) ?? 'livre'] ?? 0));
    [1, 27].forEach((n) => {
      const mine = c.careSessions.filter((s) => s.caregiverId === caregiverId(n) && s.startAt.slice(0, 7) === TODAY.slice(0, 7));
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((s) => s.includedInPlan)).toBe(true);
    });
  });

  it('parceiros: 5 ativos, 1 em validação, 1 prospecção, 1 suspenso, 1 encerrado; empresa com 5 vagas e 3 ativas', () => {
    const count = (status: string): number => c.partners.filter((p) => p.status === status).length;
    expect([
      count('active'),
      count('legal_ethics_review'),
      count('prospect'),
      count('suspended'),
      count('ended'),
    ]).toEqual([5, 1, 1, 1, 1]);
    const delta = c.partners.find((p) => p.status === 'legal_ethics_review')!;
    expect(delta.remuneration.legalValidatedAt).toBeUndefined();
    expect(delta.remuneration.ethicsValidatedAt).toBeUndefined();
    const account = c.corporateAccounts.find((a) => a.id === 'corp_0001')!;
    expect(account).toMatchObject({ seats: 5, status: 'active' });
    expect(
      c.corporateSeats.filter((s) => s.corporateAccountId === account.id && s.status === 'active'),
    ).toHaveLength(3);
    expect(c.corporateAccounts.map((a) => a.status).sort()).toEqual([
      'active',
      'negotiation',
      'prospect',
    ]);
    const c27Card = c.benefitCards.find((x) => x.caregiverId === caregiverId(27))!;
    expect(c.cardUsages.filter((u) => u.cardId === c27Card.id)).toHaveLength(8);
    const active = new Set(c.partners.filter((p) => p.status === 'active').map((p) => p.id));
    c.cardUsages.forEach((u) => expect(active.has(u.partnerId)).toBe(true));
  });

  it('POPs, riscos, encaminhamentos, normas e conteúdos', () => {
    const state = (code: string): string => c.pops.find((p) => p.code === code)!.reviewState;
    expect(['POP-02', 'POP-06'].map(state)).toEqual(['due', 'due']);
    expect(state('POP-08')).toBe('revision_triggered');
    expect(c.pops.filter((p) => p.reviewState === 'up_to_date')).toHaveLength(7);
    c.pops.forEach((p) => {
      expect(
        p.objective && p.responsible && p.materials && p.requiredRecord && p.indicators,
      ).toBeTruthy();
      expect(p.steps.length).toBeGreaterThan(0);
    });
    const priority = c.risks.filter((r) => r.probability * r.impact >= 12);
    expect(priority).toHaveLength(8);
    expect(c.risks.find((r) => r.code === 'R1')).toMatchObject({ probability: 4, impact: 5 });
    expect(new Set(c.referrals.map((r) => r.category)).size).toBe(7);
    expect(c.guidanceContents.map((g) => g.status).sort()).toEqual([
      'draft',
      'in_review',
      'in_review',
      'published',
      'published',
      'published',
      'published',
      'published',
      'published',
      'published',
    ]);
    // docs/20: cada conteúdo tem uma categoria; as 5 categorias têm leitura publicada.
    expect(new Set(c.guidanceContents.filter((g) => g.status === 'published').map((g) => g.category)).size).toBe(5);
    expect(c.guidanceContents.filter((g) => g.exclusive)).toHaveLength(1);
    expect(c.norms.every((n) => n.confirmedInForceAt === undefined)).toBe(true);
    expect(
      c.referrals.find((r) => r.category === 'elder_clinical_worsening')?.familyCommunicated,
    ).toBe(true);
  });

  it('piloto: 15 cuidadores com TCLE; C12 concluiu; 1 janela perdida; metas travadas', () => {
    expect(c.pilotEnrollments).toHaveLength(15);
    const ids = new Set(c.pilotEnrollments.map((p) => p.caregiverId));
    [3, 6, 7, 8, 9, 12, 13, 24].forEach((n) => expect(ids.has(caregiverId(n))).toBe(true));
    [25, 1, 16].forEach((n) => expect(ids.has(caregiverId(n))).toBe(false));
    expect(c.caregivers.filter((x) => x.isPilot)).toHaveLength(15);
    const c12 = c.pilotEnrollments.find((p) => p.caregiverId === caregiverId(12))!;
    expect(c12.windows.every((w) => w.status === 'done')).toBe(true);
    const windows = c.pilotEnrollments.flatMap((p) => p.windows);
    expect(windows.filter((w) => w.status === 'missed')).toHaveLength(1);
    expect(data.singletons.pilotConfig.goalsLocked).toBe(true);
    c.pilotEnrollments.forEach((p) =>
      expect(
        c.consentEvents.some((e) => e.id === p.tcleConsentEventId && e.key === 'pilot_tcle'),
      ).toBe(true),
    );
    const c25 = c.caregivers.find((x) => x.id === caregiverId(25))!;
    expect(c25.city).toBe('Uberaba');
    expect(c.elders.find((e) => e.caregiverId === c25.id)?.dependency).toBe('independent');
  });

  it('log de auditoria: 80 entradas nos últimos 30 dias com a distribuição esperada', () => {
    const count = (action: string): number => c.accessLog.filter((e) => e.action === action).length;
    expect([
      count('login'),
      count('view'),
      count('supervise'),
      count('reveal'),
      count('export'),
      count('denied'),
    ]).toEqual([14, 40, 12, 5, 3, 6]);
    c.accessLog.forEach((e) => {
      const days = compareDates(dateOf(e.at), TODAY);
      expect(days).toBeGreaterThanOrEqual(-30);
      expect(days).toBeLessThanOrEqual(0);
      if (e.action === 'supervise' || e.action === 'reveal') {
        expect(e.justification).toBeTruthy();
      }
    });
    const sorted = [...c.accessLog].map((e) => e.at);
    expect(sorted).toEqual([...sorted].sort());
  });
});

describe('seed: integridade, dados fictícios e determinismo', () => {
  it('toda referência aponta para um registro existente', () => {
    const ids = {
      caregivers: new Set(c.caregivers.map((x) => x.id)),
      providers: new Set(c.providers.map((x) => x.id)),
      users: new Set(c.users.map((x) => x.id)),
      psychologists: new Set(c.psychologists.map((x) => x.id)),
      requests: new Set(c.serviceRequests.map((x) => x.id)),
      slots: new Set(c.availabilitySlots.map((x) => x.id)),
      sessions: new Set(c.careSessions.map((x) => x.id)),
      assessments: new Set(c.zaritAssessments.map((x) => x.id)),
      subscriptions: new Set(c.subscriptions.map((x) => x.id)),
      elders: new Set(c.elders.map((x) => x.id)),
      activities: new Set(c.activities.map((x) => x.id)),
      partners: new Set(c.partners.map((x) => x.id)),
      cards: new Set(c.benefitCards.map((x) => x.id)),
      corporates: new Set(c.corporateAccounts.map((x) => x.id)),
      occurrences: new Set(c.occurrences.map((x) => x.id)),
      alerts: new Set(c.zaritAlerts.map((x) => x.id)),
      referrals: new Set(c.referrals.map((x) => x.id)),
      rooms: new Set(c.rooms.map((x) => x.id)),
      consentEvents: new Set(c.consentEvents.map((x) => x.id)),
    };
    const ok = (set: Set<string>, value: string | undefined, what: string): void => {
      if (value !== undefined) {
        expect(set.has(value), `${what}: ${value}`).toBe(true);
      }
    };
    c.elders.forEach((e) => ok(ids.caregivers, e.caregiverId, 'elder.caregiverId'));
    c.caregivers.forEach((x) => {
      ok(ids.psychologists, x.assignedPsychologistId, 'caregiver.assignedPsychologistId');
      ok(ids.corporates, x.corporateAccountId, 'caregiver.corporateAccountId');
    });
    c.users.forEach((u) => {
      ok(ids.psychologists, u.psychologistId, 'user.psychologistId');
    });
    c.psychologists.forEach((p) => ok(ids.users, p.userId, 'psychologist.userId'));
    c.subscriptions.forEach((x) => {
      ok(ids.caregivers, x.caregiverId, 'subscription.caregiverId');
      ok(ids.corporates, x.corporateAccountId, 'subscription.corporateAccountId');
    });
    c.planChanges.forEach((x) =>
      ok(ids.subscriptions, x.subscriptionId, 'planChange.subscriptionId'),
    );
    c.benefitCards.forEach((x) => ok(ids.caregivers, x.caregiverId, 'card.caregiverId'));
    c.cardUsages.forEach((x) => {
      ok(ids.cards, x.cardId, 'usage.cardId');
      ok(ids.partners, x.partnerId, 'usage.partnerId');
    });
    c.careSessions.forEach((x) => {
      ok(ids.caregivers, x.caregiverId, 'session.caregiverId');
      ok(ids.psychologists, x.psychologistId, 'session.psychologistId');
      ok(ids.slots, x.slotId, 'session.slotId');
      ok(ids.rooms, x.roomId, 'session.roomId');
    });
    c.sessionNotes.forEach((x) => {
      ok(ids.sessions, x.sessionId, 'note.sessionId');
      ok(ids.psychologists, x.authorPsychologistId, 'note.author');
    });
    c.zaritAssessments.forEach((x) => {
      ok(ids.caregivers, x.caregiverId, 'zarit.caregiverId');
      ok(ids.psychologists, x.psychologistId, 'zarit.psychologistId');
    });
    c.zaritAlerts.forEach((x) => {
      ok(ids.assessments, x.assessmentId, 'alert.assessmentId');
      ok(ids.occurrences, x.occurrenceId, 'alert.occurrenceId');
      x.referralIds.forEach((r) => ok(ids.referrals, r, 'alert.referralIds'));
    });
    c.arbeAlerts.forEach((x) => ok(ids.caregivers, x.caregiverId, 'arbe.caregiverId'));
    c.reviewRequests.forEach((x) =>
      ok(ids.psychologists, x.psychologistId, 'review.psychologistId'),
    );
    c.activityEnrollments.forEach((x) => {
      ok(ids.activities, x.activityId, 'enrollment.activityId');
      ok(ids.caregivers, x.caregiverId, 'enrollment.caregiverId');
    });
    c.activities.forEach((x) => ok(ids.rooms, x.roomId, 'activity.roomId'));
    c.providers.forEach((x) =>
      expect(
        c.accreditations.some((a) => a.id === x.accreditationId && a.providerId === x.id),
      ).toBe(true),
    );
    c.providerDocuments.forEach((x) => ok(ids.providers, x.providerId, 'doc.providerId'));
    c.serviceRequests.forEach((x) => {
      ok(ids.caregivers, x.caregiverId, 'request.caregiverId');
      ok(ids.providers, x.providerId, 'request.providerId');
    });
    c.providerEvaluations.forEach((x) => {
      ok(ids.requests, x.serviceRequestId, 'evaluation.serviceRequestId');
      ok(ids.providers, x.providerId, 'evaluation.providerId');
      ok(ids.caregivers, x.caregiverId, 'evaluation.caregiverId');
    });
    c.arpSnapshots.forEach((x) => ok(ids.providers, x.providerId, 'snapshot.providerId'));
    c.internalReviews.forEach((x) => ok(ids.providers, x.providerId, 'review.providerId'));
    c.providerStatusEvents.forEach((x) =>
      ok(ids.providers, x.providerId, 'statusEvent.providerId'),
    );
    c.corporateSeats.forEach((x) => {
      ok(ids.corporates, x.corporateAccountId, 'seat.corporateAccountId');
      ok(ids.caregivers, x.caregiverId, 'seat.caregiverId');
    });
    c.messages.forEach((x) => {
      ok(ids.caregivers, x.caregiverId, 'message.caregiverId');
      ok(ids.providers, x.providerId, 'message.providerId');
    });
    c.complaints.forEach((x) => {
      ok(ids.caregivers, x.caregiverId, 'complaint.caregiverId');
      ok(ids.providers, x.target.providerId, 'complaint.target.providerId');
      ok(ids.occurrences, x.occurrenceId, 'complaint.occurrenceId');
    });
    c.consents.forEach((x) => ok(ids.caregivers, x.caregiverId, 'consent.caregiverId'));
    c.consentEvents.forEach((x) => {
      ok(ids.caregivers, x.caregiverId, 'consentEvent.caregiverId');
      ok(ids.users, x.registeredByUserId, 'consentEvent.registeredByUserId');
    });
    c.dataSubjectRequests.forEach((x) => ok(ids.caregivers, x.caregiverId, 'dsr.caregiverId'));
    c.accessLog.forEach((x) => {
      ok(ids.users, x.userId, 'log.userId');
      ok(ids.caregivers, x.subjectCaregiverId, 'log.subjectCaregiverId');
    });
    c.referrals.forEach((x) => {
      ok(ids.caregivers, x.caregiverId, 'referral.caregiverId');
      ok(ids.users, x.byUserId, 'referral.byUserId');
      ok(ids.occurrences, x.occurrenceId, 'referral.occurrenceId');
    });
    c.occurrences.forEach((x) => {
      ok(ids.caregivers, x.caregiverId, 'occurrence.caregiverId');
      ok(ids.elders, x.elderId, 'occurrence.elderId');
      ok(ids.alerts, x.sourceAlertId, 'occurrence.sourceAlertId');
      x.restrictedToUserIds.forEach((u) => ok(ids.users, u, 'occurrence.restrictedToUserIds'));
    });
    c.pilotEnrollments.forEach((x) =>
      ok(ids.consentEvents, x.tcleConsentEventId, 'pilot.tcleConsentEventId'),
    );
    c.appUsage.forEach((x) => ok(ids.caregivers, x.caregiverId, 'usage.caregiverId'));
    // Ids únicos em cada coleção.
    Object.entries(c).forEach(([name, list]) => {
      const all = (list as { id: string }[]).map((e) => e.id);
      expect(new Set(all).size, `ids repetidos em ${name}`).toBe(all.length);
    });
  });

  it('só dados fictícios: CPF inválido e marcado, e-mails @exemplo.com.br, telefones (34) 90000-0000 a 0999', () => {
    c.caregivers.forEach((x) => {
      expect(x.cpfIsFictitious).toBe(true);
      expect(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(x.cpf)).toBe(true);
      expect(isCpfChecksumValid(x.cpf), x.cpf).toBe(false);
      expect(validateFictitiousEmail(x.email).valid, x.email).toBe(true);
      expect(validateFictitiousPhone(x.phone).valid, x.phone).toBe(true);
      if (x.whatsapp) {
        expect(validateFictitiousPhone(x.whatsapp).valid).toBe(true);
      }
    });
    [...c.users, ...c.providers].forEach((x) => {
      expect(validateFictitiousEmail(x.email).valid, x.email).toBe(true);
    });
    c.providers.forEach((p) => expect(validateFictitiousPhone(p.phone).valid, p.phone).toBe(true));
    c.corporateAccounts.forEach((a) =>
      expect(a.cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
    );
    const text = JSON.stringify(data);
    const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
    expect(emails.length).toBeGreaterThan(300);
    emails.forEach((e) => expect(e.endsWith('@exemplo.com.br'), e).toBe(true));
    const phones = text.match(/\(\d{2}\) \d{4,5}-\d{4}/g) ?? [];
    phones.forEach((p) => expect(/^\(34\) 90000-0\d{3}$/.test(p), p).toBe(true));
  });

  it('nenhum travessão, promessa de resultado ou termo proibido nos textos', () => {
    const text = JSON.stringify(data);
    expect(text).not.toMatch(new RegExp('[\u2013\u2014]'));
    ['guerreira', 'anjo', 'eficácia', 'diagnóstico'].forEach((word) =>
      expect(text.toLowerCase(), word).not.toContain(word),
    );
    expect(text).not.toContain('R$ 169,90');
    expect(c.plans.map((plan) => plan.name)).toEqual([
      'Nexus Livre',
      'Nexus Essencial',
      'Nexus Cuida',
      'Nexus Sustenta',
    ]);
    expect(text).not.toContain('Nexus Integral');
    expect(text.toLowerCase()).not.toMatch(/comiss/);
  });

  it('é determinístico: mesma data, mesmo resultado', () => {
    expect(JSON.stringify(generateSeed(TODAY))).toBe(JSON.stringify(data));
  });

  it('é relativo a hoje e mantém as contagens em qualquer dia (inclusive fim de semana e feriado)', () => {
    ['2026-11-02', '2026-11-07', '2026-11-08', '2027-01-01', '2028-02-29'].forEach((today) => {
      const other = generateSeed(today);
      const oc = other.collections;
      expect(oc.caregivers).toHaveLength(340);
      expect(oc.careSessions).toHaveLength(63);
      expect(oc.messages).toHaveLength(28);
      expect(oc.accessLog).toHaveLength(80);
      expect(oc.zaritAssessments.filter((z) => z.status === 'completed')).toHaveLength(158);
      expect(oc.availabilitySlots.filter((x) => x.status === 'open')).toHaveLength(12);
      const a = oc.zaritAlerts.find((x) => x.id === ZARIT_ALERT.a)!;
      expect(a.deadlineAt).toBe(endOfDay(today));
      const now = toIsoDateTime(today, '09:00');
      expect(oc.messages.filter((m) => isMessageOverdue(m, now))).toHaveLength(5);
      expect(oc.dataSubjectRequests.find((r) => r.caregiverId === caregiverId(20))?.dueAt).toBe(
        addDays(today, 2),
      );
    });
    const shifted = generateSeed('2026-12-15');
    expect(shifted.collections.caregivers.map((x) => x.id)).toEqual(c.caregivers.map((x) => x.id));
  });

  it('o estado de demonstração registra semente e data', () => {
    expect(data.demoState).toMatchObject({ seedName: 'nexus-seed-1', seededForToday: TODAY });
  });

  it('tamanho do seed cabe com folga na cota do navegador (cerca de 5 milhões de caracteres)', () => {
    const chars = JSON.stringify(data.collections).length;
    expect(chars).toBeLessThan(2_500_000);
  });
});
