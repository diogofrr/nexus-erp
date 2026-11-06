import { Injectable, inject } from '@angular/core';
import { CaregiverOwnership } from '../../../../core/auth/caregiver-ownership';
import { Clock } from '../../../../core/clock/clock.service';
import { isValidIsoDate } from '../../../../core/clock/date-utils';
import { Database } from '../../../../core/data/database';
import type { Channel, Dependency, ID, Relationship } from '../../../../core/models';
import { ConsentService } from '../../../../core/privacy/consent.service';
import { whatsappChannelNeedsConsent } from '../../../../core/rules/lgpd';
import { INVALID_DATE_TEXT, NAME_MAX_CHARS, isTooLong, tooLongText } from '../../../../core/rules/text-limits';
import {
  validateAdult,
  validateDailyCareHours,
  validateFictitiousEmail,
  validateFictitiousPhone,
} from '../../../../core/rules/validators';
import { ArbeService } from '../../../zarit/state/arbe.service';

/** Os dados do perfil não puderam ser salvos. A frase é para a tela. */
export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileError';
  }
}

/** Quem escolhe o WhatsApp sem ter autorizado o contato por WhatsApp (RN-LGPD-05 e). A autorização é dada em Privacidade. */
export const WHATSAPP_CONSENT_NEEDED =
  'Para falar pelo WhatsApp, precisamos da sua autorização. Você pode dar em Privacidade.';

export interface YouFields {
  fullName: string;
  birthDate: string;
  phone: string;
  email: string;
  city: string;
}

export interface ElderFields {
  fullName: string;
  birthDate: string;
  relationship: Relationship;
  dependency: Dependency;
}

export interface DailyFields {
  hours: number;
  channel: Channel;
  /** Fica guardado mesmo que o canal preferido deixe de ser o WhatsApp. */
  whatsapp: string;
}

/**
 * Meu perfil (UX C22, RN-USR-02 a 04, 09, 14, 18, RN-LGPD-20): corrige os dados do cuidador e da pessoa idosa. O CPF
 * NÃO muda por aqui (S-31: a correção é pela equipe). Cada gravação devolve `true` se algo mudou e `false` para "Nada
 * mudou." Valida na borda com as regras do núcleo (18 anos, datas que existem, nomes de até 120 caracteres, formatos
 * fictícios, horas de 0 a 24) e só grava o cadastro de quem está na sessão (`CaregiverOwnership`). Trocar o canal de
 * WhatsApp para telefone NÃO apaga o número, e escolher o WhatsApp sem a autorização de contato por WhatsApp é recusado
 * com a frase que diz o que falta (RN-LGPD-05 e, QAC-005).
 *
 * Mudar as horas por dia salva sem aviso e sem mencionar avaliação de risco (S-25), mas GERA a nova avaliação da ARBE
 * (RN-ARBE-10, AC-CG-190, QAC-006): a avaliação respeita a autorização de saúde e não duplica alerta aberto do mesmo nível
 * (RN-ARBE-08 e 09, `ArbeService.evaluateCaregiver`). O cuidador não gera linha de log do próprio dado.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly ownership = inject(CaregiverOwnership);
  private readonly consents = inject(ConsentService);
  private readonly arbe = inject(ArbeService);

  updateYou(caregiverId: ID, fields: YouFields): boolean {
    this.ownership.assertCaregiver(caregiverId);
    const current = this.db.caregivers.require(caregiverId);
    if (fields.fullName.trim().length < 3) {
      throw new ProfileError('Informe o nome completo.');
    }
    if (isTooLong(fields.fullName, NAME_MAX_CHARS) || isTooLong(fields.city, NAME_MAX_CHARS)) {
      throw new ProfileError(tooLongText(NAME_MAX_CHARS));
    }
    const adult = validateAdult(fields.birthDate, this.clock.today());
    if (!adult.valid) {
      throw new ProfileError(
        adult.code === 'minor'
          ? 'Você precisa ter 18 anos ou mais.'
          : adult.code === 'birth_invalid'
            ? INVALID_DATE_TEXT
            : adult.message,
      );
    }
    if (!validateFictitiousPhone(fields.phone).valid) {
      throw new ProfileError('O telefone deve ter o formato (34) 90000-0000.');
    }
    if (!validateFictitiousEmail(fields.email.trim()).valid) {
      throw new ProfileError('Use um e-mail que termine em @exemplo.com.br.');
    }
    if (fields.city.trim() === '') {
      throw new ProfileError('Informe a cidade.');
    }
    const next = {
      fullName: fields.fullName.trim(),
      birthDate: fields.birthDate,
      phone: fields.phone,
      email: fields.email.trim(),
      city: fields.city.trim(),
    };
    if (
      current.fullName === next.fullName &&
      current.birthDate === next.birthDate &&
      current.phone === next.phone &&
      current.email === next.email &&
      current.city === next.city
    ) {
      return false;
    }
    this.db.caregivers.update(caregiverId, next);
    return true;
  }

  /** O parentesco fica no cadastro do cuidador (`relationship`); o resto é da pessoa idosa. */
  updateElder(caregiverId: ID, fields: ElderFields): boolean {
    this.ownership.assertCaregiver(caregiverId);
    const caregiver = this.db.caregivers.require(caregiverId);
    const elder = this.db.elders.find((e) => e.caregiverId === caregiverId);
    if (!elder) {
      throw new ProfileError('Não encontramos a pessoa que você cuida.');
    }
    if (fields.fullName.trim().length < 3) {
      throw new ProfileError('Informe o nome da pessoa.');
    }
    if (isTooLong(fields.fullName, NAME_MAX_CHARS)) {
      throw new ProfileError(tooLongText(NAME_MAX_CHARS));
    }
    if (!isValidIsoDate(fields.birthDate)) {
      throw new ProfileError(INVALID_DATE_TEXT);
    }
    if (fields.birthDate > this.clock.today()) {
      throw new ProfileError('A data de nascimento dela não pode ser no futuro.');
    }
    const name = fields.fullName.trim();
    const changed =
      elder.fullName !== name ||
      elder.birthDate !== fields.birthDate ||
      elder.dependency !== fields.dependency ||
      caregiver.relationship !== fields.relationship;
    if (!changed) {
      return false;
    }
    this.db.elders.update(elder.id, { fullName: name, birthDate: fields.birthDate, dependency: fields.dependency });
    this.db.caregivers.update(caregiverId, { relationship: fields.relationship });
    return true;
  }

  updateDaily(caregiverId: ID, fields: DailyFields): boolean {
    this.ownership.assertCaregiver(caregiverId);
    const current = this.db.caregivers.require(caregiverId);
    if (!validateDailyCareHours(fields.hours).valid) {
      throw new ProfileError('As horas por dia devem ser de 0 a 24.');
    }
    const whatsapp = fields.whatsapp.trim();
    if (fields.channel === 'whatsapp') {
      if (whatsapp === '') {
        throw new ProfileError('Informe o número do WhatsApp.');
      }
      if (!validateFictitiousPhone(whatsapp).valid) {
        throw new ProfileError('O telefone deve ter o formato (34) 90000-0000.');
      }
    }
    // Escolher o WhatsApp sem a autorização é recusado. Cadastro antigo que já estava com o WhatsApp (dado de antes desta
    // regra) segue como está até a pessoa trocar o canal: salvar só as horas não deve travar por isso.
    const choosingWhatsapp = fields.channel === 'whatsapp' && current.preferredChannel !== 'whatsapp';
    if (choosingWhatsapp && whatsappChannelNeedsConsent(fields.channel, this.consents.isActive(caregiverId, 'whatsapp_contact'))) {
      throw new ProfileError(WHATSAPP_CONSENT_NEEDED);
    }
    const keptWhatsapp = fields.channel === 'whatsapp' || whatsapp !== '' ? whatsapp : (current.whatsapp ?? '');
    const hoursChanged = current.dailyCareHours !== fields.hours;
    const changed =
      hoursChanged ||
      current.preferredChannel !== fields.channel ||
      (current.whatsapp ?? '') !== keptWhatsapp;
    if (!changed) {
      return false;
    }
    this.db.caregivers.update(caregiverId, {
      dailyCareHours: fields.hours,
      preferredChannel: fields.channel,
      whatsapp: keptWhatsapp === '' ? undefined : keptWhatsapp,
    });
    if (hoursChanged) {
      // RN-ARBE-10: a correção das horas gera nova avaliação, sem avisar a pessoa (S-25, AC-CG-190).
      this.arbe.evaluateCaregiver(caregiverId);
    }
    return true;
  }
}
