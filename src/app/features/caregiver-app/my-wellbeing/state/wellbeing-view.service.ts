import { Injectable, computed, inject } from '@angular/core';
import { CaregiverMessagesService } from '@core/care/caregiver-messages.service';
import { ReviewRequestService } from '@core/care/review-request.service';
import { addDays, dateOf } from '@core/clock';
import { Database } from '@core/data';
import { ConsentStatus, ID, ISODate, ReviewRequest, WellbeingCheck, ZaritBand } from '@core/models';
import { ConsentService } from '@core/privacy';
import { FREE_TEXT_MAX_CHARS, tooLongText } from '@core/rules/text-limits';
import { ZARIT_BANDS, zaritBandInfo } from '@core/rules/zarit';
import { MessagesService } from '../../../messages/state/messages.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { dayMonth, dayMonthOrYear } from '../../state/day-format';
import { shortName, withArticle, withArticleOf } from '../../state/people-format';
import { WellbeingCheckService } from '@core/care/wellbeing-check.service';
import { CgTrendItem } from '../../ui/cg-trend.component';
import { MoodValue, moodLabel } from '../../ui/cg-mood.component';
import {
  ARRANGE_PERIODS,
  ARRANGE_SUBJECT,
  BAND_MEANING,
  NEXT_UNKNOWN,
  REVIEW_EMPTY_ERROR,
  REVIEW_ERROR,
} from './wellbeing-copy';

/** Quantos pontos a linha do tempo mostra de cara; o resto fica atrás de "Ver todas" (UX C9). */
export const TIMELINE_VISIBLE = 4;

/** A frase da faixa para a linha do tempo, sem o ponto final e com a inicial maiúscula ("O cuidado está pesando muito"). */
function bandMeaningText(band: ZaritBand): string {
  const phrase = BAND_MEANING[band].replace(/\.$/, '');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export interface MoodWeekEntry {
  id: string;
  dateLabel: string;
  label: string;
}

export interface ReviewView {
  id: ID;
  /** Resposta dada? */
  answered: boolean;
  /** "a Dra. Beatriz" ou "a equipe de psicologia" (depois de "está com"). */
  who: string;
  /** "da Dra. Beatriz" ou "da equipe de psicologia" (depois de "Resposta"). */
  whoOf: string;
  /** "10/11" (prazo) ou a data da resposta. */
  dateLabel: string;
  answer: string | null;
}

export interface PausedView {
  /** O que a pessoa já decidiu sobre a autorização de saúde. */
  status: ConsentStatus;
  /** Quando retirou ("20/10"), se retirou. */
  since: string | null;
}

export type StepResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * Como estou (UX C9, B5; RN-ZRT-04, 05, 08, 18 a 20, 22 e 23, RN-LGPD-14 e 16, RN-PLN-19, RN-USR-05). Lê as aplicações
 * CONCLUÍDAS da escala só para mostrar a evolução da própria pessoa com cuidado: a faixa por extenso, a pontuação só como
 * legenda pequena, sem percentual de evolução, sem "melhorou" ou "piorou". A pessoa NUNCA preenche a escala (quem
 * aplica é a equipe). Sem a autorização de saúde vigente nada de saúde aparece (o tratamento cessa, S-28), e o
 * contato da equipe vem só do `CaregiverContextService.staffContact()`: aqui ninguém lê alerta.
 *
 * Grava só o que é da pessoa: o humor do dia (pelo serviço do humor, que confere a autorização na borda), o pedido de
 * revisão (núcleo, RN-ZRT-20) e "Combinar um horário" (uma mensagem do aplicativo marcada como pedido de apoio, S-16).
 */
@Injectable({ providedIn: 'root' })
export class WellbeingViewService {
  private readonly ctx = inject(CaregiverContextService);
  private readonly db = inject(Database);
  private readonly consents = inject(ConsentService);
  private readonly reviews = inject(ReviewRequestService);
  private readonly caregiverMessages = inject(CaregiverMessagesService);
  private readonly staffMessages = inject(MessagesService);
  private readonly moods = inject(WellbeingCheckService);

  // ===== Conversas de acompanhamento =====

  /**
   * Aplicações concluídas, da mais recente para a mais antiga. Sem a autorização de saúde vigente a leitura da escala cessa AQUI,
   * na borda do serviço, e não só na tela (RN-LGPD-14, S-28; QAC-002). Reconceder religa.
   */
  private readonly completed = computed(() => {
    const id = this.ctx.caregiverId();
    if (!id || !this.consents.isActive(id, 'health_data')) {
      return [];
    }
    return this.db.zaritAssessments
      .query((a) => a.caregiverId === id && a.status === 'completed' && a.total !== undefined && a.appliedAt !== undefined)
      .sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? '') || b.sequence - a.sequence);
  });

  readonly hasConversations = computed(() => this.completed().length > 0);

  /** Todos os pontos da linha do tempo (a tela mostra os 4 primeiros e "Ver todas"). */
  readonly timeline = computed<CgTrendItem[]>(() =>
    this.completed().map((a, index) => {
      const total = a.total as number;
      const info = zaritBandInfo(total);
      return {
        id: a.id,
        dateLabel: this.dateLabel(a.appliedAt as ISODate),
        bandLabel: info.label,
        meaning: bandMeaningText(info.band),
        band: (ZARIT_BANDS.findIndex((b) => b.band === info.band) + 1) as 1 | 2 | 3 | 4,
        scoreText: `${total} pontos`,
        latest: index === 0,
      };
    }),
  );

  /** "Sua última conversa foi em 04/11." */
  readonly lastText = computed(() => {
    const last = this.completed()[0];
    return last?.appliedAt ? `Sua última conversa foi em ${this.dateLabel(last.appliedAt)}.` : null;
  });

  /**
   * A próxima conversa: só mostra a data quando ela é FUTURA (S-33); vencida, a frase é a de a equipe combinar com a
   * pessoa. Nunca diz "atrasada" nem "vencida".
   */
  readonly nextText = computed(() => {
    const id = this.ctx.caregiverId();
    if (!id || !this.consents.isActive(id, 'health_data')) {
      return null;
    }
    const pending = this.db.zaritAssessments
      .query((a) => a.caregiverId === id && a.status === 'scheduled')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (!pending) {
      return this.hasConversations() ? NEXT_UNKNOWN : null;
    }
    return pending.dueDate > this.ctx.today()
      ? `A próxima conversa de acompanhamento deve acontecer até ${this.dateLabel(pending.dueDate)}.`
      : NEXT_UNKNOWN;
  });

  // ===== Autorização de saúde =====

  /** Só quando a autorização de saúde NÃO está vigente: o que a pessoa decidiu e quando. */
  readonly paused = computed<PausedView | null>(() => {
    if (this.ctx.healthConsent()) {
      return null;
    }
    const id = this.ctx.caregiverId();
    const status = this.ctx.consentStatus('health_data');
    const revoked = id
      ? this.consents
          .history(id, 'health_data')
          .filter((e) => e.status === 'revoked')
          .at(-1)
      : undefined;
    return { status, since: revoked ? dayMonth(dateOf(revoked.at)) : null };
  });

  /** "Autorizar de novo": o mesmo evento da tela de Privacidade (canal aplicativo, quem registra é a própria pessoa). */
  authorizeAgain(): { ok: boolean } {
    try {
      const id = this.ctx.requireCaregiverId();
      this.consents.grant(id, 'health_data', { channel: 'app', registeredByUserId: id });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  // ===== Humor =====

  readonly todayMood = computed<WellbeingCheck | undefined>(() => {
    const id = this.ctx.caregiverId();
    return id ? this.moods.forDay(id, this.ctx.today()) : undefined;
  });

  /** O humor dos últimos 7 dias (hoje e os 6 de trás), do mais recente. */
  readonly week = computed<MoodWeekEntry[]>(() => {
    const id = this.ctx.caregiverId();
    if (!id) {
      return [];
    }
    const today = this.ctx.today();
    const first = addDays(today, -6);
    // A leitura do humor passa pelo serviço do núcleo, que a barra sem a autorização de saúde (QAC-002).
    return this.moods
      .range(id, first, today)
      .map((w) => ({ id: w.id, dateLabel: dayMonth(w.date), label: moodLabel(w.mood) }));
  });

  /** Anota o humor de hoje (a autorização é conferida na borda do serviço do humor). */
  recordMood(mood: MoodValue): { ok: true } | { ok: false; error: string } {
    try {
      this.moods.record(this.ctx.requireCaregiverId(), mood);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível anotar agora.' };
    }
  }

  // ===== Pedido de revisão =====

  /** O pedido mais recente da pessoa: com o psicólogo, até quando, ou a resposta. */
  readonly review = computed<ReviewView | null>(() => {
    const id = this.ctx.caregiverId();
    const latest = id ? this.reviews.forCaregiver(id)[0] : undefined;
    return latest ? this.toReview(latest) : null;
  });

  /** Registra o pedido. Texto em branco não grava e devolve a frase do erro. */
  requestReview(text: string): StepResult {
    if (!text.trim()) {
      return { ok: false, error: REVIEW_EMPTY_ERROR };
    }
    const result = this.reviews.register(this.ctx.requireCaregiverId(), 'zarit_decision', text);
    if (!result.ok) {
      return {
        ok: false,
        error:
          result.reason === 'text_too_short'
            ? REVIEW_EMPTY_ERROR
            : result.reason === 'text_too_long'
              ? tooLongText(FREE_TEXT_MAX_CHARS)
              : REVIEW_ERROR,
      };
    }
    return { ok: true, text: `Pedido enviado. O psicólogo responde até ${this.dateLabel(result.request.dueAt)}.` };
  }

  // ===== Combinar um horário =====

  /**
   * Para quem a equipe ainda não alcançou: uma mensagem do aplicativo marcada como pedido de apoio (S-16), para a equipe
   * ligar no período escolhido. O aplicativo não classifica risco no texto (S-24).
   */
  arrange(period: (typeof ARRANGE_PERIODS)[number]['value']): StepResult {
    const choice = ARRANGE_PERIODS.find((p) => p.value === period);
    if (!choice) {
      return { ok: false, error: 'Escolha o período em que a equipe pode falar com você.' };
    }
    const result = this.caregiverMessages.send(this.ctx.requireCaregiverId(), {
      subject: ARRANGE_SUBJECT,
      body: `Prefiro que falem comigo ${choice.phrase}.`,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    this.staffMessages.setSupportRequest(result.message.id, true);
    return { ok: true, text: `Recebemos o seu pedido. A equipe procura você ${choice.phrase}.` };
  }

  // ===== Internos =====

  /** "04/11"; com o ano quando não é o corrente ("04/11/2025"). */
  private dateLabel(date: ISODate): string {
    return dayMonthOrYear(date, this.ctx.today());
  }

  private toReview(request: ReviewRequest): ReviewView {
    const psychologist = this.db.psychologists.get(request.psychologistId);
    const short = psychologist ? shortName(psychologist.displayName) : '';
    const who = short ? withArticle(short) : 'a equipe de psicologia';
    const whoOf = short ? withArticleOf(short) : 'da equipe de psicologia';
    return {
      id: request.id,
      answered: !!request.answeredAt,
      who,
      whoOf,
      dateLabel: request.answeredAt ? this.dateLabel(dateOf(request.answeredAt)) : this.dateLabel(request.dueAt),
      answer: request.answer ?? null,
    };
  }
}
