import { Injectable, inject } from '@angular/core';
import { CaregiverOwnership } from '../auth/caregiver-ownership';
import { Clock } from '../clock/clock.service';
import { isValidIsoDate } from '../clock/date-utils';
import { SubscriptionService } from '../commerce/subscription.service';
import { Database } from '../data/database';
import type {
  Caregiver,
  Channel,
  ConsentKey,
  Dependency,
  Elder,
  ID,
  ISODateTime,
  PlanId,
  Relationship,
  Sex,
} from '../models';
import { ConsentService } from '../privacy/consent.service';
import { caregiverCode } from '../privacy/pseudonym';
import { INVALID_DATE_TEXT, NAME_MAX_CHARS, isTooLong, tooLongText } from '../rules/text-limits';

/** Cadastro que não pôde ser feito (por exemplo, CPF fictício já em uso). A frase é para a tela. */
export class CaregiverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaregiverError';
  }
}

/** Dados do cadastro de um cuidador novo e da pessoa idosa que ele cuida (RN-USR-02 a 04, 10, 14, 18). */
export interface CaregiverRegistration {
  fullName: string;
  birthDate: string;
  cpf: string;
  email: string;
  phone: string;
  whatsapp?: string;
  relationship: Relationship;
  sex: Sex;
  city: string;
  /** Horas por dia de cuidado direto, de 0 a 24 (RN-USR-04). */
  dailyCareHours: number;
  preferredChannel: Channel;
  digitalLiteracy: 'low' | 'medium' | 'high';
  elder: { fullName: string; birthDate: string; dependency: Dependency };
  /** Quem não aparece aqui fica "pendente" (Decidir depois): nada vem pré-marcado (RN-LGPD-04 e 05). */
  consents: Partial<Record<ConsentKey, 'granted' | 'refused'>>;
  consentChannel: Channel | 'in_person';
  evidence?: string;
  planId: PlanId;
  /**
   * Quem registrou os consentimentos. Sem isto vale o usuário da equipe com sessão; `'self'` é o próprio cuidador
   * se cadastrando pelo aplicativo (o histórico de consentimentos mostra "usuário").
   */
  registeredByUserId?: ID | 'self';
  /** Aceite do aviso de emergência e dos canais, com data e hora (RN-ATD-11, RN-CAN-06). */
  emergencyNoticeAcceptedAt?: ISODateTime;
}

const PLACEHOLDER_CPF = '000.000.000-00';

/**
 * Miolo do cadastro de um cuidador (RN-USR-02 a 04, 10, 14 e 18): atribui o código `CUI-xxxx` e o id, cria o cuidador
 * e a pessoa idosa, os seis consentimentos (cada um aceito, recusado ou pendente, sem pré-marcar) e a assinatura.
 * É o que a equipe (M03, "Novo cuidador") e o próprio cuidador (aplicativo, "Começar") usam. A checagem de PERFIL e o
 * log de auditoria ficam na borda de quem chama: o serviço da equipe grava o log; o cuidador não gera linha do
 * próprio dado (docs/10-cuidador-contexto.md, decisão 2). Todo cadastro novo do aplicativo nasce no plano Livre.
 */
@Injectable({ providedIn: 'root' })
export class CaregiverRegistrationService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly consent = inject(ConsentService);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly ownership = inject(CaregiverOwnership);

  /** Cuidador que já usa este CPF fictício (para "Já existe um cuidador com este CPF"). */
  findByCpf(cpf: string, exceptId?: ID): Caregiver | undefined {
    if (!cpf || cpf === PLACEHOLDER_CPF) {
      return undefined;
    }
    return this.db.caregivers.find((c) => c.cpf === cpf && c.id !== exceptId);
  }

  /** Próximo código e id: `CUI-0341` e `cg_0341`. */
  nextIdentity(): { id: ID; code: string; elderId: ID } {
    const highest = this.db.caregivers
      .all()
      .reduce((max, c) => Math.max(max, Number(/(\d+)$/.exec(c.id)?.[1] ?? 0)), 0);
    const n = highest + 1;
    const padded = String(n).padStart(4, '0');
    return { id: `cg_${padded}`, code: caregiverCode(n), elderId: `el_${padded}` };
  }

  register(input: CaregiverRegistration): { caregiver: Caregiver; elder: Elder } {
    // O cadastro novo nasce fora de qualquer sessão de cuidador: quem está dentro da própria conta não cria a de outra
    // pessoa (os serviços de consentimento e de assinatura só agem sobre quem está na sessão, QAC-001).
    if (this.ownership.actorId() !== null) {
      throw new CaregiverError('Saia da sua conta para criar outro cadastro.');
    }
    // Datas que existem e textos com tamanho de nome (QAC-015): a tela confere, o serviço também.
    if (!isValidIsoDate(input.birthDate) || !isValidIsoDate(input.elder.birthDate)) {
      throw new CaregiverError(INVALID_DATE_TEXT);
    }
    if (input.birthDate > this.clock.today() || input.elder.birthDate > this.clock.today()) {
      throw new CaregiverError('A data de nascimento não pode ser no futuro.');
    }
    if ([input.fullName, input.city, input.elder.fullName].some((text) => isTooLong(text, NAME_MAX_CHARS))) {
      throw new CaregiverError(tooLongText(NAME_MAX_CHARS));
    }
    if (this.findByCpf(input.cpf)) {
      throw new CaregiverError('Já existe um cuidador com este CPF fictício.');
    }
    const identity = this.nextIdentity();
    const today = this.clock.today();
    const caregiver = this.db.caregivers.create({
      id: identity.id,
      code: identity.code,
      fullName: input.fullName.trim(),
      cpf: input.cpf,
      cpfIsFictitious: true,
      email: input.email.trim(),
      phone: input.phone,
      ...(input.whatsapp ? { whatsapp: input.whatsapp } : {}),
      birthDate: input.birthDate,
      sex: input.sex,
      relationship: input.relationship,
      city: input.city.trim(),
      dailyCareHours: input.dailyCareHours,
      preferredChannel: input.preferredChannel,
      digitalLiteracy: input.digitalLiteracy,
      status: 'active',
      enrolledAt: today,
      isPilot: false,
      ...(input.emergencyNoticeAcceptedAt ? { emergencyNoticeAcceptedAt: input.emergencyNoticeAcceptedAt } : {}),
    });
    const elder = this.db.elders.create({
      id: identity.elderId,
      caregiverId: caregiver.id,
      fullName: input.elder.fullName.trim(),
      birthDate: input.elder.birthDate,
      dependency: input.elder.dependency,
    });
    // Os seis consentimentos nascem "pendente"; só o que a pessoa decidiu vira evento (AC-M03-02).
    this.consent.initializeForNewCaregiver(caregiver.id);
    const registeredBy = input.registeredByUserId === 'self' ? caregiver.id : input.registeredByUserId;
    const options = {
      channel: input.consentChannel,
      ...(input.evidence?.trim() ? { evidence: input.evidence.trim() } : {}),
      ...(registeredBy ? { registeredByUserId: registeredBy } : {}),
    };
    (Object.entries(input.consents) as [ConsentKey, 'granted' | 'refused'][]).forEach(([key, decision]) => {
      if (decision === 'granted') {
        this.consent.grant(caregiver.id, key, options);
      } else {
        this.consent.refuse(caregiver.id, key, options);
      }
    });
    this.subscriptions.startSubscription(caregiver.id, input.planId);
    return { caregiver: this.db.caregivers.require(caregiver.id), elder };
  }
}
