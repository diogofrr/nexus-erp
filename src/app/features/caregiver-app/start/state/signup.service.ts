import { Injectable, inject } from '@angular/core';
import { CaregiverOwnership } from '../../../../core/auth/caregiver-ownership';
import { CaregiverSessionService } from '../../../../core/auth/caregiver-session.service';
import {
  CaregiverRegistration,
  CaregiverRegistrationService,
} from '../../../../core/care/caregiver-registration.service';
import { Clock } from '../../../../core/clock/clock.service';
import { addYears } from '../../../../core/clock/date-utils';
import type { Caregiver, Channel, ConsentKey, Dependency, ID, Relationship } from '../../../../core/models';
import { generateFictitiousCpf, generateFictitiousPhone } from '../../../../core/rules/validators';
import { DEFAULT_CITY } from './start-fields';

export type ConsentChoice = 'granted' | 'refused' | 'pending';

/**
 * Os 5 consentimentos que o Começar oferece, na ordem da tela: saúde primeiro (em destaque), depois os 4 recolhidos.
 * O do piloto (TCLE) NÃO é oferecido aqui: a equipe o inclui no piloto (S-12).
 */
export const SIGNUP_CONSENTS: readonly ConsentKey[] = [
  'health_data',
  'people_analytics',
  'family_sharing',
  'image_testimony',
  'whatsapp_contact',
];

/** O que as 5 etapas juntam. Tudo texto ou escolha da pessoa; nada de saúde nem de remédio (RN-USR-09). */
export interface SignupData {
  fullName: string;
  birthDate: string;
  cpf: string;
  phone: string;
  email: string;
  city: string;
  elderName: string;
  elderBirthDate: string;
  relationship: Relationship;
  dependency: Dependency;
  hours: number;
  channel: Channel;
  whatsapp: string;
  /** Quem não escolheu fica "decidir depois" (`pending`). */
  choices: Partial<Record<ConsentKey, ConsentChoice>>;
}

/** Dados de exemplo do botão "Preencher com dados de exemplo" (S-03): fictícios e únicos a cada toque. */
export interface SignupExample {
  fullName: string;
  birthDate: string;
  cpf: string;
  phone: string;
  email: string;
  city: string;
  elderName: string;
  elderBirthDate: string;
  relationship: Relationship;
  dependency: Dependency;
  hours: number;
  channel: Channel;
}

/**
 * Cadastro de quem é novo (UX C2, RN-USR-02 a 04, 09, 10, 14, 18, RN-LGPD-04 e 05, RN-PLN-02). O miolo é o do núcleo
 * (`CaregiverRegistrationService`, o mesmo do "Novo cuidador" da equipe): código `CUI-xxxx`, pessoa idosa vinculada,
 * os 6 consentimentos e a assinatura Livre. O novo cuidador aparece na lista do ERP. Aqui ficam só o que é do
 * aplicativo: montar o cadastro a partir das etapas, entrar com a conta nova e os dados de exemplo.
 */
@Injectable({ providedIn: 'root' })
export class SignupService {
  private readonly registration = inject(CaregiverRegistrationService);
  private readonly session = inject(CaregiverSessionService);
  private readonly ownership = inject(CaregiverOwnership);
  private readonly clock = inject(Clock);

  /** Já existe um cuidador com este CPF fictício? */
  cpfTaken(cpf: string): Caregiver | undefined {
    return this.registration.findByCpf(cpf);
  }

  /** Um CPF fictício que ninguém usa (o botão "Gerar CPF fictício"). */
  freeCpf(): string {
    let n = Number(this.registration.nextIdentity().code.slice(4)) + 500;
    while (this.registration.findByCpf(generateFictitiousCpf(n))) {
      n += 1;
    }
    return generateFictitiousCpf(n);
  }

  /** Dados de exemplo, todos fictícios. */
  example(): SignupExample {
    const n = Number(this.registration.nextIdentity().code.slice(4));
    const today = this.clock.today();
    return {
      fullName: `Marta Exemplo Souza ${n}`,
      birthDate: addYears(today, -50),
      cpf: this.freeCpf(),
      phone: generateFictitiousPhone(n + 500),
      email: `marta.${n}@exemplo.com.br`,
      city: DEFAULT_CITY,
      elderName: `Alice Exemplo Souza ${n}`,
      elderBirthDate: addYears(today, -80),
      relationship: 'daughter',
      dependency: 'partial',
      hours: 4,
      channel: 'app',
    };
  }

  /**
   * Cria a conta (plano Livre) e entra com ela. O canal preferido WhatsApp só vale se a pessoa também autorizou o contato
   * por WhatsApp (RN-LGPD-05 e): sem isso a conta nasce com o aplicativo, como a regra de revogação (S-40).
   */
  create(data: SignupData, noticeAcceptedAt: string): { caregiverId: ID; caregiver: Caregiver } {
    const consents: CaregiverRegistration['consents'] = {};
    SIGNUP_CONSENTS.forEach((key) => {
      const choice = data.choices[key];
      if (choice === 'granted' || choice === 'refused') {
        consents[key] = choice;
      }
    });
    const channel: Channel = data.channel === 'whatsapp' && consents.whatsapp_contact !== 'granted' ? 'app' : data.channel;
    const whatsapp = data.whatsapp.trim();
    const input: CaregiverRegistration = {
      fullName: data.fullName,
      birthDate: data.birthDate,
      cpf: data.cpf,
      email: data.email,
      phone: data.phone,
      ...(whatsapp ? { whatsapp } : {}),
      // O aplicativo não pergunta o sexo nem a familiaridade digital (minimização, S-12).
      sex: 'undisclosed',
      relationship: data.relationship,
      city: data.city,
      dailyCareHours: data.hours,
      preferredChannel: channel,
      digitalLiteracy: 'medium',
      elder: { fullName: data.elderName, birthDate: data.elderBirthDate, dependency: data.dependency },
      consents,
      consentChannel: 'app',
      planId: 'livre',
      registeredByUserId: 'self',
      emergencyNoticeAcceptedAt: noticeAcceptedAt,
    };
    // Criar uma conta nova encerra a sessão de quem estava dentro de outra (o aplicativo nunca cria o cadastro de uma pessoa
    // dentro da sessão de outra: a posse é conferida na borda dos serviços, QAC-001). Se o cadastro falhar, a sessão volta.
    const previous = this.ownership.actorId();
    if (previous !== null) {
      this.session.signOut();
    }
    let caregiver: Caregiver;
    try {
      ({ caregiver } = this.registration.register(input));
    } catch (error) {
      if (previous !== null) {
        this.session.signIn(previous);
      }
      throw error;
    }
    this.session.signIn(caregiver.id);
    return { caregiverId: caregiver.id, caregiver };
  }
}
