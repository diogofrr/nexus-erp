import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { CaregiverSessionService } from '../../../core/auth/caregiver-session.service';
import { DEMO_CAREGIVER_NUMBERS } from '../../../core/seed';
import { FakeStorage, configureCoreTest } from '../../../core/testing/test-helpers';
import { CaregiverContextService } from './caregiver-context.service';
import { DEMO_CAREGIVERS } from './demo-caregivers';
import { dayMonth, formatDayLong, formatDayShort, relativeDateTime, relativeDay } from './day-format';
import { FONT_SCALES, FontScaleService } from './font-scale.service';
import {
  contactChannels,
  isWithinBusinessHours,
  phoneClosedNote,
  NEXUS_PHONE,
} from './nexus-contact';

function boot(caregiverId: string | null, options: Parameters<typeof configureCoreTest>[0] = {}) {
  const env = configureCoreTest({ seed: true, providers: [provideRouter([])], ...options });
  if (caregiverId) {
    TestBed.inject(CaregiverSessionService).signIn(caregiverId);
  }
  return { ...env, ctx: TestBed.inject(CaregiverContextService) };
}

describe('CaregiverContextService (o cuidador atual em signals)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('Ana: cadastro, pessoa idosa, assinatura e plano', () => {
    const { ctx, db } = boot('cg_0001');
    expect(ctx.isSignedIn()).toBe(true);
    expect(ctx.caregiverId()).toBe('cg_0001');
    expect(ctx.firstName()).toBe('Ana');
    expect(ctx.caregiver()?.fullName).toBe('Ana Paula Ferraz');
    expect(ctx.elder()?.id).toBe('el_0001');
    expect(ctx.elderId()).toBe('el_0001');
    expect(ctx.subscription()?.planId).toBe('cuida');
    expect(ctx.planId()).toBe('cuida');
    expect(ctx.planName()).toBe('Cuida');
    expect(ctx.plan()?.monthlyPriceCents).toBe(11990);
    expect(ctx.scheduledChange()).toBeNull();
    expect(ctx.preferredChannel()).toBe(db.caregivers.get('cg_0001')?.preferredChannel);
    expect(ctx.requireCaregiverId()).toBe('cg_0001');
    expect(ctx.requireCaregiver().fullName).toBe('Ana Paula Ferraz');
  });

  it('é reativo: trocar o plano pela assinatura muda o plano e o acesso na hora', () => {
    const { ctx, db } = boot('cg_0003');
    expect(ctx.planId()).toBe('livre');
    expect(ctx.canUse('card')).toBe(false);
    const sub = db.subscriptions.find((s) => s.caregiverId === 'cg_0003');
    db.subscriptions.update(sub?.id ?? '', { planId: 'essencial' });
    expect(ctx.planId()).toBe('essencial');
    expect(ctx.canUse('card')).toBe(true);
  });

  it('acesso por plano: Livre, Essencial, Cuida e Sustenta (RN-PLN-01 a 08, 10)', () => {
    const maria = boot('cg_0002').ctx;
    expect(maria.planName()).toBe('Essencial');
    expect(maria.canUse('card')).toBe(true);
    expect(maria.canUse('exclusive_content')).toBe(true);
    expect(maria.canUse('network_conditions')).toBe(true);
    expect(maria.canUse('groups')).toBe(false);
    expect(maria.access('groups')).toEqual({
      allowed: false,
      minPlan: 'cuida',
      reason: 'Disponível a partir do plano Cuida.',
    });
    TestBed.resetTestingModule();
    const joao = boot('cg_0003').ctx;
    expect(joao.canUse('agenda_reminders')).toBe(true);
    expect(joao.canUse('request_service')).toBe(true);
    expect(joao.canUse('network_conditions')).toBe(false);
    expect(joao.canUse('card')).toBe(false);
    TestBed.resetTestingModule();
    const ana = boot('cg_0001').ctx;
    expect(ana.canUse('groups')).toBe(true);
    expect(ana.canUse('network_benefits')).toBe(false);
    TestBed.resetTestingModule();
    expect(boot('cg_0027').ctx.canUse('network_benefits')).toBe(true);
  });

  it('mudança de plano agendada (Marcos): o plano vigente segue e a frase pronta vem do núcleo', () => {
    const { ctx } = boot('cg_0026');
    expect(ctx.planId()).toBe('essencial');
    expect(ctx.scheduledChange()).toMatchObject({ kind: 'cancel', to: 'livre', at: '2026-11-13' });
    expect(ctx.scheduledChange()?.label).toBe('Cancelamento agendado para 13/11/2026');
  });

  it('consentimentos: os 6 na ordem e o de saúde vigente ou não (Sônia revogou)', () => {
    const ana = boot('cg_0001').ctx;
    expect(ana.consents().map((c) => c.key)).toEqual([
      'health_data',
      'people_analytics',
      'family_sharing',
      'image_testimony',
      'whatsapp_contact',
      'pilot_tcle',
    ]);
    expect(ana.hasConsent('health_data')).toBe(true);
    expect(ana.healthConsent()).toBe(true);
    expect(ana.consentStatus('family_sharing')).toBe('granted');
    TestBed.resetTestingModule();
    const sonia = boot('cg_0016').ctx;
    expect(sonia.consentStatus('health_data')).toBe('revoked');
    expect(sonia.healthConsent()).toBe(false);
    TestBed.resetTestingModule();
    const joao = boot('cg_0003').ctx;
    expect(joao.hasConsent('family_sharing')).toBe(false);
  });

  it('contato da equipe (P-03): só três valores e nenhuma pontuação (Ana hoje, Maria ainda não, os outros nada)', () => {
    const expected: Record<string, string> = {
      cg_0001: 'today',
      cg_0002: 'not_yet',
      cg_0003: 'none',
      cg_0008: 'none',
      cg_0016: 'none',
      cg_0026: 'none',
    };
    Object.entries(expected).forEach(([id, state]) => {
      TestBed.resetTestingModule();
      expect(boot(id).ctx.staffContact(), id).toBe(state);
    });
  });

  it('o contato da equipe some quando a equipe registra o contato e some quando a saúde é retirada', () => {
    const { ctx, db } = boot('cg_0001');
    expect(ctx.staffContact()).toBe('today');
    const alert = db.zaritAlerts.find((a) => a.caregiverId === 'cg_0001' && a.level === 'red');
    db.zaritAlerts.update(alert?.id ?? '', {
      status: 'contacted',
      contact: { at: db.zaritAlerts.list()[0]?.createdAt ?? '', byUserId: 'u3', channel: 'phone' },
    });
    expect(ctx.staffContact()).toBe('none');
  });

  it('"hoje" vem do Clock e acompanha o relógio simulado', () => {
    const { ctx, clock } = boot('cg_0001');
    expect(ctx.today()).toBe('2026-11-04');
    clock.setSimulated('2026-11-10', '09:00');
    expect(ctx.today()).toBe('2026-11-10');
  });

  it('sem sessão tudo é vazio, o plano é Livre e as ações que exigem sessão falham', () => {
    const { ctx } = boot(null);
    expect(ctx.isSignedIn()).toBe(false);
    expect(ctx.caregiver()).toBeNull();
    expect(ctx.elder()).toBeNull();
    expect(ctx.subscription()).toBeNull();
    expect(ctx.planId()).toBe('livre');
    expect(ctx.consents()).toEqual([]);
    expect(ctx.firstName()).toBe('');
    expect(ctx.preferredChannel()).toBe('app');
    expect(ctx.staffContact()).toBe('none');
    expect(() => ctx.requireCaregiverId()).toThrow();
    expect(() => ctx.requireCaregiver()).toThrow();
  });
});

describe('FontScaleService (tamanho da letra)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('três níveis, o padrão é Normal, vale na hora e fica na chave nexus-erp:caregiver-font-scale', () => {
    expect(FONT_SCALES.map((o) => o.label)).toEqual(['Normal', 'Grande', 'Bem grande']);
    expect(FONT_SCALES.map((o) => o.sample)).toEqual([18, 20, 22]);
    const { local } = boot(null);
    const service = TestBed.inject(FontScaleService);
    expect(service.scale()).toBe('normal');
    service.set('xlarge');
    expect(service.scale()).toBe('xlarge');
    expect(local.getItem('nexus-erp:caregiver-font-scale')).toBe('"xlarge"');
  });

  it('lê o que estava guardado e ignora valor inválido', () => {
    const local = new FakeStorage();
    local.setItem('nexus-erp:caregiver-font-scale', '"large"');
    boot(null, { local });
    expect(TestBed.inject(FontScaleService).scale()).toBe('large');
    TestBed.resetTestingModule();
    const broken = new FakeStorage();
    broken.setItem('nexus-erp:caregiver-font-scale', '"gigante"');
    boot(null, { local: broken });
    expect(TestBed.inject(FontScaleService).scale()).toBe('normal');
  });
});

describe('Como falar com a gente (decisão 6, RN-CAN-02 e 03)', () => {
  const WED_NOON = '2026-11-04T12:00:00-03:00';

  it('o canal preferido vem primeiro; os outros seguem a ordem fixa', () => {
    expect(contactChannels('phone', WED_NOON).map((c) => c.channel)).toEqual([
      'phone',
      'whatsapp',
      'app',
      'email',
    ]);
    expect(contactChannels('whatsapp', WED_NOON).map((c) => c.channel)).toEqual([
      'whatsapp',
      'phone',
      'app',
      'email',
    ]);
    expect(contactChannels('email', WED_NOON).map((c) => c.channel)).toEqual([
      'email',
      'phone',
      'whatsapp',
      'app',
    ]);
  });

  it('prazos de resposta, ação de cada canal e número fictício (nunca tel: nem wa.me)', () => {
    const channels = contactChannels('app', WED_NOON);
    const by = (name: string) => channels.find((c) => c.channel === name);
    expect(by('phone')?.answer).toBe('Na hora, em horário comercial (segunda a sexta, 8h às 18h)');
    expect(by('whatsapp')?.answer).toBe('Até 4 horas úteis');
    expect(by('app')?.answer).toBe('Até 24 horas úteis');
    expect(by('email')?.answer).toBe('Até 48 horas úteis');
    expect(by('phone')?.value).toBe('(34) 90000-0000');
    expect(NEXUS_PHONE).toBe('(34) 90000-0000');
    expect(by('app')?.action).toBe('write_message');
    expect(by('app')?.value).toBeNull();
    expect(by('email')?.value?.endsWith('@exemplo.com.br')).toBe(true);
    channels.forEach((c) => expect(JSON.stringify(c)).not.toMatch(/tel:|wa\.me/));
  });

  it('expediente de segunda a sexta, das 8h às 18h, sem feriado nacional (RN-CAN-03)', () => {
    expect(isWithinBusinessHours('2026-11-04T08:00:00-03:00')).toBe(true);
    expect(isWithinBusinessHours('2026-11-04T17:59:00-03:00')).toBe(true);
    expect(isWithinBusinessHours('2026-11-04T18:00:00-03:00')).toBe(false);
    expect(isWithinBusinessHours('2026-11-04T07:59:00-03:00')).toBe(false);
    expect(isWithinBusinessHours('2026-11-07T10:00:00-03:00')).toBe(false); // sábado
    expect(isWithinBusinessHours('2026-11-02T10:00:00-03:00')).toBe(false); // Finados
  });

  it('fora do horário o telefone avisa quando abre', () => {
    expect(phoneClosedNote(WED_NOON)).toBeUndefined();
    expect(phoneClosedNote('2026-11-04T20:00:00-03:00')).toBe('Fechado agora. Abrimos amanhã às 8h.');
    expect(phoneClosedNote('2026-11-04T06:00:00-03:00')).toBe('Fechado agora. Abrimos hoje às 8h.');
    expect(phoneClosedNote('2026-11-06T19:00:00-03:00')).toBe(
      'Fechado agora. Abrimos na segunda às 8h.',
    );
    const phone = contactChannels('app', '2026-11-04T20:00:00-03:00').find((c) => c.channel === 'phone');
    expect(phone?.closedNote).toBe('Fechado agora. Abrimos amanhã às 8h.');
  });
});

describe('Datas em linguagem de todo dia', () => {
  it('hoje, amanhã, ontem e "qui, 06/11"; o ano só quando não é o corrente', () => {
    const today = '2026-11-04';
    expect(relativeDay('2026-11-04', today)).toBe('hoje');
    expect(relativeDay('2026-11-05', today)).toBe('amanhã');
    expect(relativeDay('2026-11-03', today)).toBe('ontem');
    expect(relativeDay('2026-11-06', today)).toBe('sex, 06/11');
    expect(formatDayShort('2027-01-05', today)).toBe('ter, 05/01/2027');
    expect(formatDayLong(today)).toBe('quarta-feira, 04/11');
    expect(dayMonth('2026-11-13')).toBe('13/11');
    expect(relativeDateTime('2026-11-04T14:00:00-03:00', today)).toBe('hoje às 14:00');
    expect(relativeDateTime('2026-11-06T14:00:00-03:00', today)).toBe('sex, 06/11, às 14:00');
  });
});

describe('Pessoas de demonstração da entrada', () => {
  it('a lista da entrada e a do seed são as mesmas, na mesma ordem: 6 em destaque e mais 5', () => {
    expect(DEMO_CAREGIVERS.map((d) => d.id)).toEqual(
      DEMO_CAREGIVER_NUMBERS.map((n) => `cg_${String(n).padStart(4, '0')}`),
    );
    expect(DEMO_CAREGIVERS.filter((d) => d.featured)).toHaveLength(6);
    expect(DEMO_CAREGIVERS.filter((d) => !d.featured)).toHaveLength(5);
    expect(DEMO_CAREGIVERS.slice(0, 6).every((d) => d.featured)).toBe(true);
  });

  it('todas existem no seed e nenhuma frase é longa demais', () => {
    const { db } = boot(null);
    DEMO_CAREGIVERS.forEach((d) => {
      expect(db.caregivers.get(d.id), d.id).toBeDefined();
      expect(d.blurb.length).toBeLessThan(70);
    });
    TestBed.resetTestingModule();
  });
});
