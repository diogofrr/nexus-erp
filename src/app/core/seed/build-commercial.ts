/**
 * Assinaturas (340: todo cadastro tem uma, o Livre sem cobrança), cartões (17 ativos), usos do cartão (25,
 * 8 de C27), trocas de plano, parceiros (9) e canal corporativo (3 empresas, 5 vagas na Exemplo Logística).
 */
import { addMonths, compareDates } from '../clock/date-utils';
import {
  BenefitCard,
  CardUsage,
  CorporateAccount,
  CorporateSeat,
  ID,
  ISODate,
  Partner,
  PlanChange,
  PlanId,
  Subscription,
} from '../models';
import { cardDiscountCents, formatCardNumber } from '../rules/plans';
import { generateFictitiousCnpj } from '../rules/validators';
import { CORPORATE, PARTNER, USER, caregiverId } from './refs';
import { SCENARIOS } from './scenarios';
import { SeedState } from './state';

/** Próxima data de cobrança: aniversário mensal do início, a partir de amanhã. */
function nextCycle(startedAt: ISODate, today: ISODate): ISODate {
  let k = 1;
  let date = addMonths(startedAt, k);
  while (compareDates(date, today) <= 0 && k < 600) {
    k += 1;
    date = addMonths(startedAt, k);
  }
  return date;
}

export function buildCommercial(s: SeedState): void {
  const { ctx, c } = s;
  const rng = ctx.rng;

  // ===== Assinaturas e cartões =====
  const subscriptionByCaregiver = new Map<ID, Subscription>();
  const cardByCaregiver = new Map<ID, BenefitCard>();
  let cardSeq = 0;

  c.caregivers.forEach((cg) => {
    const scenario = SCENARIOS.find((d) => caregiverId(d.n) === cg.id);
    const plan: PlanId = scenario?.plan ?? 'livre';
    const corporate = scenario?.corporate === true;
    const subId = ctx.nextId('sub');

    let startedAt: ISODate = cg.enrolledAt;
    if (plan !== 'livre') {
      const fixedStart: Record<number, number> = { 1: -90, 8: -30, 9: -200, 12: -185, 27: -300 };
      const fixed = scenario ? fixedStart[scenario.n] : undefined;
      startedAt = scenario?.n === 26 ? addMonths(ctx.d(9), -5) : ctx.d(fixed ?? -rng.int(40, 200));
    }
    const isCancelScheduled = scenario?.n === 26;
    const subscription: Subscription = ctx.entity<Subscription>(subId, ctx.at(startedAt), {
      caregiverId: cg.id,
      planId: plan,
      status: isCancelScheduled ? 'cancel_scheduled' : 'active',
      payer: corporate ? 'corporate' : 'self',
      ...(corporate ? { corporateAccountId: CORPORATE.exemploLogistica } : {}),
      startedAt,
      ...(plan !== 'livre'
        ? { nextCycleAt: isCancelScheduled ? ctx.d(9) : nextCycle(startedAt, ctx.today) }
        : {}),
      ...(isCancelScheduled
        ? { scheduledChangeAt: ctx.d(9), scheduledPlanId: 'livre' as PlanId }
        : {}),
    });
    c.subscriptions.push(subscription);
    subscriptionByCaregiver.set(cg.id, subscription);

    if (plan !== 'livre') {
      cardSeq += 1;
      const card = ctx.entity<BenefitCard>(ctx.nextId('crd'), ctx.at(startedAt), {
        caregiverId: cg.id,
        number: formatCardNumber(1000 + cardSeq * 7),
        status: 'active',
        issuedAt: startedAt,
      });
      c.benefitCards.push(card);
      cardByCaregiver.set(cg.id, card);
    }
  });

  // ===== Trocas de plano (histórico) =====
  const change = (
    n: number,
    from: PlanId,
    to: PlanId,
    kind: PlanChange['kind'],
    effectiveAt: ISODate,
    by: string,
  ): void => {
    const sub = subscriptionByCaregiver.get(caregiverId(n)) as Subscription;
    c.planChanges.push(
      ctx.entity<PlanChange>(ctx.nextId('pch'), ctx.at(effectiveAt), {
        subscriptionId: sub.id,
        from,
        to,
        kind,
        effectiveAt,
        byUserId: by,
      }),
    );
  };
  change(12, 'livre', 'essencial', 'upgrade', ctx.d(-185), USER.camila);
  change(27, 'essencial', 'sustenta', 'upgrade', ctx.d(-120), USER.camila);
  change(1, 'livre', 'cuida', 'upgrade', ctx.d(-90), USER.wesley);
  change(9, 'essencial', 'sustenta', 'upgrade', ctx.d(-60), USER.camila);
  change(8, 'livre', 'cuida', 'upgrade', ctx.d(-30), USER.wesley);
  change(26, 'livre', 'cuida', 'upgrade', addMonths(ctx.d(9), -5), USER.camila);
  change(26, 'cuida', 'essencial', 'downgrade', addMonths(ctx.d(9), -2), USER.camila);
  change(26, 'essencial', 'livre', 'cancel', ctx.d(9), USER.camila);

  // ===== Parceiros (9) =====
  const partner = (
    id: string,
    name: string,
    category: Partner['category'],
    status: Partner['status'],
    discountPercent: number,
    contact: string,
    remuneration: Partner['remuneration'],
    daysAgo: number,
  ): void => {
    c.partners.push(
      ctx.entity<Partner>(id, ctx.dt(-daysAgo), {
        name,
        category,
        status,
        discountPercent,
        contactName: contact,
        contactEmail: `${contact
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z]+/g, '.')}@exemplo.com.br`,
        city: 'Uberlândia',
        remuneration,
      }),
    );
  };
  const validated = (model: Partner['remuneration']['model']): Partner['remuneration'] => ({
    model,
    legalValidatedAt: ctx.d(-120),
    ethicsValidatedAt: ctx.d(-118),
  });
  partner(
    PARTNER.farmaciaBemEstar,
    'Farmácia Bem-Estar',
    'pharmacy',
    'active',
    10,
    'Paulo Henrique Duarte',
    { model: 'none' },
    300,
  );
  partner(
    PARTNER.drogariaCuidar,
    'Drogaria Cuidar',
    'pharmacy',
    'active',
    12,
    'Sandra Regina Costa',
    validated('commission_non_psychological'),
    280,
  );
  partner(
    PARTNER.oticaVisaoClara,
    'Ótica Visão Clara',
    'optical',
    'active',
    15,
    'Ricardo Alves Pinto',
    { model: 'none' },
    250,
  );
  partner(
    PARTNER.laboratorioAnalise,
    'Laboratório Análise Exemplo',
    'laboratory',
    'active',
    8,
    'Teresa Cristina Lopes',
    { model: 'none' },
    220,
  );
  partner(
    PARTNER.mercadoVida,
    'Mercado Vida Saudável',
    'market',
    'active',
    5,
    'Joaquim Neto Bastos',
    { model: 'none' },
    200,
  );
  partner(
    PARTNER.clinicaImagemDelta,
    'Clínica de Imagem Delta',
    'clinic',
    'legal_ethics_review',
    10,
    'Marta Helena Rocha',
    {
      model: 'fixed_fee',
      notes: 'Valor fixo mensal em negociação; aguarda validação jurídica e ética.',
    },
    60,
  );
  partner(
    PARTNER.ortopediaPassoFirme,
    'Loja de Ortopedia Passo Firme',
    'other',
    'prospect',
    0,
    'Alberto Silveira Reis',
    { model: 'none' },
    20,
  );
  partner(
    PARTNER.drogariaPopularCentral,
    'Drogaria Popular Central',
    'pharmacy',
    'suspended',
    7,
    'Cláudio Roberto Maia',
    { model: 'none' },
    260,
  );
  partner(
    PARTNER.academiaMexaSe,
    'Academia Mexa-se',
    'gym',
    'ended',
    10,
    'Luciana Prado Teles',
    { model: 'none' },
    330,
  );

  // ===== Usos do cartão (25: 8 de C27) =====
  const activePartners = [
    PARTNER.farmaciaBemEstar,
    PARTNER.drogariaCuidar,
    PARTNER.oticaVisaoClara,
    PARTNER.laboratorioAnalise,
    PARTNER.mercadoVida,
  ];
  const percentOf = (id: string): number =>
    (c.partners.find((p) => p.id === id) as Partner).discountPercent;
  const use = (cardId: string, daysAgo: number): void => {
    const partnerId = rng.pick(activePartners);
    const amount = rng.int(30, 320) * 100;
    c.cardUsages.push(
      ctx.entity<CardUsage>(ctx.nextId('cus'), ctx.dt(-daysAgo, '15:00'), {
        cardId,
        partnerId,
        date: ctx.d(-daysAgo),
        amountCents: amount,
        discountCents: cardDiscountCents(amount, percentOf(partnerId)),
      }),
    );
  };
  const c27Card = cardByCaregiver.get(caregiverId(27)) as BenefitCard;
  for (let k = 0; k < 8; k += 1) {
    use(c27Card.id, 4 + k * 9);
  }
  const otherCards = c.benefitCards.filter((card) => card.id !== c27Card.id);
  for (let k = 0; k < 17; k += 1) {
    use((otherCards[k % otherCards.length] as BenefitCard).id, rng.int(1, 80));
  }

  // ===== Cartão inativo (1): quem foi pago e voltou ao Livre =====
  // Criado DEPOIS dos usos para não entrar no sorteio deles e sem consumir o gerador (a sequência do resto do
  // seed não muda). O cuidador de volume C120 teve o Essencial por 5 meses e cancelou há 40 dias.
  c.benefitCards.push(
    ctx.entity<BenefitCard>(ctx.nextId('crd'), ctx.at(ctx.d(-190)), {
      caregiverId: caregiverId(120),
      number: formatCardNumber(1000 + (cardSeq + 1) * 7),
      status: 'inactive',
      issuedAt: ctx.d(-190),
      inactivatedAt: ctx.d(-40),
    }),
  );
  change(120, 'livre', 'essencial', 'upgrade', ctx.d(-190), USER.camila);
  change(120, 'essencial', 'livre', 'cancel', ctx.d(-40), USER.camila);

  // ===== Canal corporativo (3 empresas) =====
  const account = (
    id: string,
    companyName: string,
    hr: string,
    status: CorporateAccount['status'],
    plan: CorporateAccount['planId'],
    seats: number,
    daysAgo: number,
    cnpjN: number,
    start?: ISODate,
  ): void => {
    c.corporateAccounts.push(
      ctx.entity<CorporateAccount>(id, ctx.dt(-daysAgo), {
        companyName,
        cnpj: generateFictitiousCnpj(cnpjN),
        hrContactName: hr,
        hrContactEmail: `rh.${id.replace('corp_', 'empresa')}@exemplo.com.br`,
        status,
        planId: plan,
        seats,
        seatPriceCents: plan === 'cuida' ? 9900 : 12900,
        ...(start ? { startDate: start } : {}),
      }),
    );
  };
  account(
    CORPORATE.exemploLogistica,
    'Exemplo Logística Ltda.',
    'Fabiana Guedes',
    'active',
    'cuida',
    5,
    120,
    1,
    ctx.d(-90),
  );
  account(
    CORPORATE.industriaModelo,
    'Indústria Modelo S.A.',
    'Gilberto Amaral',
    'negotiation',
    'sustenta',
    20,
    45,
    2,
  );
  account(
    CORPORATE.comercioAlfa,
    'Comércio Varejista Alfa',
    'Heloísa Barros',
    'prospect',
    'essencial',
    10,
    15,
    3,
  );

  [21, 22, 23].forEach((n) => {
    c.corporateSeats.push(
      ctx.entity<CorporateSeat>(ctx.nextId('seat'), ctx.dt(-90), {
        corporateAccountId: CORPORATE.exemploLogistica,
        caregiverId: caregiverId(n),
        invitedEmail: (c.caregivers.find((cg) => cg.id === caregiverId(n)) as { email: string })
          .email,
        status: 'active',
      }),
    );
  });
  ['colaborador.convidado1@exemplo.com.br', 'colaborador.convidado2@exemplo.com.br'].forEach(
    (email) => {
      c.corporateSeats.push(
        ctx.entity<CorporateSeat>(ctx.nextId('seat'), ctx.dt(-10), {
          corporateAccountId: CORPORATE.exemploLogistica,
          invitedEmail: email,
          status: 'invited',
        }),
      );
    },
  );
}
