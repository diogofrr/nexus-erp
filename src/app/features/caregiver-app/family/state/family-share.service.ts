import { Injectable, computed, inject } from '@angular/core';
import { DoseCheckService } from '../../../../core/care/dose-check.service';
import { addDays } from '../../../../core/clock/date-utils';
import { Database } from '../../../../core/data/database';
import { ConsentService } from '../../../../core/privacy/consent.service';
import { betweenDates, onDate } from '../../../../core/rules/care-agenda';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { FamilyShareChoices, FamilyShareData, buildFamilyText } from './family-text';

/** O texto da família não pôde ser feito (sem a autorização de compartilhar). A frase é para a tela. */
export class FamilyShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FamilyShareError';
  }
}

/** "Desta semana" são os próximos 7 dias, sem os de hoje (S-38). */
export const FAMILY_WEEK_DAYS = 7;

/**
 * A rotina da pessoa idosa para a família (UX C20, RN-USR-11, RN-LGPD-05 c): junta o que o cuidador pode compartilhar
 * (compromissos e remédios da pessoa idosa, nunca atendimento, grupo nem escala) e entrega o texto pronto. **Não há
 * envio**: o app só gera o texto. A autorização de compartilhar com a família (consentimento c) é conferida AQUI, na
 * borda do serviço, e não só na tela. Autorizar grava o consentimento com o evento (canal aplicativo, registrado pelo
 * próprio cuidador).
 */
@Injectable({ providedIn: 'root' })
export class FamilyShareService {
  private readonly ctx = inject(CaregiverContextService);
  private readonly db = inject(Database);
  private readonly doses = inject(DoseCheckService);
  private readonly consent = inject(ConsentService);

  /** A pessoa autorizou compartilhar com a família (vigente)? */
  readonly authorized = computed(() => this.ctx.hasConsent('family_sharing'));

  /** Os dados que podem entrar no texto, de hoje. A conversa com o psicólogo NÃO está aqui: é outra coleção. */
  readonly data = computed<FamilyShareData | null>(() => {
    const elder = this.ctx.elder();
    const caregiver = this.ctx.caregiver();
    if (!elder || !caregiver) {
      return null;
    }
    const today = this.ctx.today();
    const appointments = this.db.careAppointments.query((a) => a.elderId === elder.id);
    return {
      elderFirstName: elder.fullName.split(/\s+/)[0] ?? elder.fullName,
      caregiverFirstName: this.ctx.firstName(),
      today,
      appointmentsToday: onDate(appointments, today),
      appointmentsWeek: betweenDates(appointments, addDays(today, 1), addDays(today, FAMILY_WEEK_DAYS)),
      doses: this.doses.forElder(elder.id, today).map((d) => ({ time: d.time, medicationName: d.medicationName })),
    };
  });

  /** O texto para os itens ligados. Sem a autorização, recusa; sem item ligado, devolve `null`. */
  text(choices: FamilyShareChoices): string | null {
    if (!this.authorized()) {
      throw new FamilyShareError('Para compartilhar, precisamos da sua autorização.');
    }
    const data = this.data();
    return data ? buildFamilyText(data, choices) : null;
  }

  /** "Autorizo": grava o consentimento (c) com o evento. */
  authorize(): void {
    const id = this.ctx.requireCaregiverId();
    this.consent.grant(id, 'family_sharing', { channel: 'app', registeredByUserId: id });
  }
}
