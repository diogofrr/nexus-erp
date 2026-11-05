import { Injectable, inject } from '@angular/core';
import { Database } from '../../../../core/data/database';
import type { Channel, Dependency, ID, Relationship } from '../../../../core/models';
import {
  validateAdult,
  validateDailyCareHours,
  validateFictitiousEmail,
  validateFictitiousPhone,
} from '../../../../core/rules/validators';
import { Clock } from '../../../../core/clock/clock.service';

/** Os dados do perfil não puderam ser salvos. A frase é para a tela. */
export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileError';
  }
}

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
 * mudou." Valida na borda com as regras do núcleo (18 anos, formatos fictícios, horas de 0 a 24). Trocar o canal de
 * WhatsApp para telefone NÃO apaga o número. Mudar as horas por dia salva sem aviso e sem mencionar avaliação de risco
 * (S-25, RN-ARBE-10). O cuidador não gera linha de log do próprio dado.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);

  updateYou(caregiverId: ID, fields: YouFields): boolean {
    const current = this.db.caregivers.require(caregiverId);
    if (fields.fullName.trim().length < 3) {
      throw new ProfileError('Informe o nome completo.');
    }
    const adult = validateAdult(fields.birthDate, this.clock.today());
    if (!adult.valid) {
      throw new ProfileError(adult.code === 'minor' ? 'Você precisa ter 18 anos ou mais.' : adult.message);
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
    const caregiver = this.db.caregivers.require(caregiverId);
    const elder = this.db.elders.find((e) => e.caregiverId === caregiverId);
    if (!elder) {
      throw new ProfileError('Não encontramos a pessoa que você cuida.');
    }
    if (fields.fullName.trim().length < 3) {
      throw new ProfileError('Informe o nome da pessoa.');
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
    const keptWhatsapp = fields.channel === 'whatsapp' || whatsapp !== '' ? whatsapp : (current.whatsapp ?? '');
    const changed =
      current.dailyCareHours !== fields.hours ||
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
    return true;
  }
}
