import { Injectable, computed, inject } from '@angular/core';
import { Clock } from '../../../../core/clock/clock.service';
import { dateOf, timeOf } from '../../../../core/clock/date-utils';
import { DoseCheckService } from '../../../../core/care/dose-check.service';
import { Database } from '../../../../core/data/database';
import { ID, ISODateTime } from '../../../../core/models';
import { nextOne } from '../../../../core/rules/care-agenda';
import { readingTimeLabel } from '../../../../core/rules/guidance-content';
import { doseProgress } from '../../../../core/rules/medication-doses';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { formatDayLong, relativeDay, relativeDateTime } from '../../state/day-format';
import { CgEventType, EnrolledMeeting, enrolledMeetingsOf, eventWhoText, nextOpenMeetingOf } from '../../state/event-type';
import { canBookSession, eventAccessOf } from '../../state/plan-access';
import { MoodValue, moodLabel } from '../../ui/cg-mood.component';
import { withArticle } from '../../state/people-format';
import { InviteKind, capitalize, greetingFor, inviteKindFor } from './today-rules';
import { WellbeingCheckService, WellbeingError } from '../../../../core/care/wellbeing-check.service';

/** Quantas linhas de remédio Hoje mostra de cara (S-36): o resto fica atrás de "Ver todos". */
export const TODAY_DOSE_ROWS = 4;

/** O próximo compromisso da pessoa idosa, a conversa do próprio cuidador com o psicólogo ou um encontro em que está inscrita. */
export interface NextEvent {
  key: string;
  /** "Fisioterapia, hoje às 14:00" ou "Sua conversa com a Dra. Beatriz, qui, 06/11, às 14:00". */
  text: string;
  /** "Fisioterapia" ou "Sua conversa com a Dra. Beatriz" (o texto sem o quando). */
  title: string;
  /** "Hoje", "Amanhã" ou "Qui, 06/11": o dia, para o destaque. */
  day: string;
  /** "14:00": a hora, em destaque (serifa grande). */
  time: string;
  /** Onde ou com quem (só nos compromissos). */
  support: string | null;
  /** A conversa ou o encontro da própria pessoa (S-27). */
  forYou: boolean;
  /** O tipo do encontro, quando é um encontro (o selo diz o que é). */
  eventType: CgEventType | null;
  /** Para onde o cartão leva. */
  link: string;
  query: Record<string, string> | null;
}

/** Serviço concluído, ainda sem avaliação (RN-ARP-02): leva a Meus pedidos, onde a folha de avaliação abre. */
export interface RateRequest {
  requestId: ID;
  providerName: string;
}

/** O convite do dia (S-11, docs/20): só o que a pessoa pode usar de verdade, sem preço, plano nem bloqueio. */
export interface DailyInvite {
  kind: InviteKind;
  title: string;
  text: string;
  actionLabel: string;
  link: string;
  query: Record<string, string> | null;
  /** O tipo do encontro (roda aberta ou capacitação), para o selo; `null` na conversa e na leitura. */
  eventType: CgEventType | null;
}

/**
 * Tudo o que a tela Hoje mostra, em signals (docs/10-cuidador-ux.md, C4). Lê o contexto do cuidador e as coleções;
 * NUNCA lê pontuação, faixa nem alerta da escala: o contato da equipe vem só de `ctx.staffContact()` (P-03).
 * O plano entra só para decidir o que a pessoa PODE usar (`state/plan-access.ts`), nunca para aparecer na tela.
 */
@Injectable({ providedIn: 'root' })
export class TodayViewService {
  private readonly ctx = inject(CaregiverContextService);
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly doses = inject(DoseCheckService);
  private readonly wellbeing = inject(WellbeingCheckService);

  readonly greeting = computed(() => `${greetingFor(this.clock.now())}, ${this.ctx.firstName()}`);
  readonly dateLabel = computed(() => formatDayLong(this.ctx.today()));

  // ===== Remédios de hoje =====

  readonly slots = computed(() => {
    const elderId = this.ctx.elderId();
    return elderId ? this.doses.forElder(elderId, this.ctx.today()) : [];
  });
  readonly progress = computed(() => doseProgress(this.slots()));
  readonly visibleSlots = computed(() => this.slots().slice(0, TODAY_DOSE_ROWS));
  /** A pessoa idosa tem algum remédio cadastrado (em uso ou em pausa)? */
  readonly hasMedications = computed(() => {
    const elderId = this.ctx.elderId();
    return elderId ? this.db.medications.count((m) => m.elderId === elderId) > 0 : false;
  });

  // ===== Próximo compromisso =====

  /** Os encontros futuros em que a pessoa está inscrita (entram no próximo compromisso e saem do convite). */
  private readonly enrolled = computed<EnrolledMeeting[]>(() => {
    const id = this.ctx.caregiverId();
    return id ? enrolledMeetingsOf(this.db.activities.list(), this.db.activityEnrollments.list(), id, this.clock.now()) : [];
  });

  private readonly agenda = computed(() => {
    const elderId = this.ctx.elderId();
    const today = this.ctx.today();
    const items: (NextEvent & { at: ISODateTime })[] = [];
    if (elderId) {
      this.db.careAppointments
        .query((a) => a.elderId === elderId)
        .forEach((a) =>
          items.push({
            key: a.id,
            at: a.at,
            text: `${a.title}, ${relativeDateTime(a.at, today)}`,
            title: a.title,
            day: capitalize(relativeDay(dateOf(a.at), today)),
            time: timeOf(a.at),
            support: a.place?.trim() ? a.place.trim() : null,
            forYou: false,
            eventType: null,
            link: '/cuidador/rotina/agenda',
            query: null,
          }),
        );
    }
    const caregiverId = this.ctx.caregiverId();
    if (caregiverId) {
      this.db.careSessions
        .query((s) => s.caregiverId === caregiverId && (s.status === 'scheduled' || s.status === 'confirmed'))
        .forEach((s) => {
          const psychologist = this.db.psychologists.find((p) => p.id === s.psychologistId);
          const who = psychologist ? withArticle(psychologist.displayName) : 'o psicólogo';
          items.push({
            key: s.id,
            at: s.startAt,
            text: `Sua conversa com ${who}, ${relativeDateTime(s.startAt, today)}`,
            title: `Sua conversa com ${who}`,
            day: capitalize(relativeDay(dateOf(s.startAt), today)),
            time: timeOf(s.startAt),
            support: null,
            forYou: true,
            eventType: null,
            link: '/cuidador/cuidar-de-mim/atendimento',
            query: null,
          });
        });
      this.enrolled().forEach((m) =>
        items.push({
          key: m.meetingId,
          at: m.startAt,
          text: `${m.title}, ${relativeDateTime(m.startAt, today)}`,
          title: m.title,
          day: capitalize(relativeDay(dateOf(m.startAt), today)),
          time: timeOf(m.startAt),
          support: null,
          forYou: true,
          eventType: m.type,
          link: '/cuidador/cuidar-de-mim/grupos',
          query: { atividade: m.activityId },
        }),
      );
    }
    return items;
  });

  readonly next = computed<NextEvent | null>(() => nextOne(this.agenda(), this.clock.now()) ?? null);
  /** A pessoa idosa já teve algum compromisso cadastrado (para dizer "conta nova sem nada")? */
  readonly hasAnyAppointment = computed(() => this.agenda().length > 0);
  /** Conta nova sem nada: nem remédio nem compromisso (UX C4, estados). */
  readonly empty = computed(() => !this.hasMedications() && !this.hasAnyAppointment());

  // ===== Humor do dia =====

  /** O humor só existe com a autorização de saúde (S-29): sem ela o bloco some. */
  readonly moodEnabled = this.ctx.healthConsent;
  /** A pessoa retirou a autorização de saúde: o humor some e Hoje diz isso em uma linha (CXC-028). Quem nunca respondeu não vê nada. */
  readonly moodPaused = computed(() => !this.ctx.healthConsent() && this.ctx.consentStatus('health_data') === 'revoked');
  readonly todayMood = computed(() => {
    const id = this.ctx.caregiverId();
    return id ? this.wellbeing.forDay(id, this.ctx.today()) : undefined;
  });
  readonly todayMoodLabel = computed(() => moodLabel(this.todayMood()?.mood));

  /** Anota ou troca o humor de hoje. Devolve `null` se deu certo, ou a frase do problema. */
  saveMood(mood: MoodValue): string | null {
    try {
      this.wellbeing.record(this.ctx.requireCaregiverId(), mood);
      return null;
    } catch (error) {
      return error instanceof WellbeingError ? error.message : 'Não foi possível salvar. Tente de novo; se continuar, fale com a gente.';
    }
  }

  // ===== Para você =====

  /** O serviço concluído mais recente que ainda não foi avaliado (RN-ARP-02). */
  readonly rate = computed<RateRequest | null>(() => {
    const id = this.ctx.caregiverId();
    if (!id) {
      return null;
    }
    const pending = this.db.serviceRequests
      .query((r) => r.caregiverId === id && r.status === 'completed' && !r.evaluationId)
      .sort((a, b) => (b.completedAt ?? b.requestedAt).localeCompare(a.completedAt ?? a.requestedAt));
    const request = pending[0];
    if (!request) {
      return null;
    }
    const provider = this.db.providers.get(request.providerId);
    return { requestId: request.id, providerName: provider?.name ?? 'este profissional' };
  });

  /**
   * O convite do dia. Não aparece quando há nota de cuidado (contato da equipe): a oferta não fica ao lado do contato
   * (S-11). Essa ocultação usa o estado do contato só para CUIDAR, nunca para vender (RN-PLN-19, RN-LGPD-17). Só entra o
   * que a pessoa pode usar de verdade (docs/20): a conversa só para Cuida e Sustenta, a capacitação só quando incluída, a
   * roda aberta e a leitura aberta para todos. Encontro em que a pessoa já está inscrita não é convite (já é dela).
   */
  readonly invite = computed<DailyInvite | null>(() => {
    if (this.ctx.staffContact() !== 'none') {
      return null;
    }
    const today = this.ctx.today();
    const now = this.clock.now();
    const access = eventAccessOf(this.ctx);
    const mine = new Set(this.enrolled().map((m) => m.activityId));
    const activities = this.db.activities.list();
    const circle = nextOpenMeetingOf('open_circle', activities, now, mine);
    const training = access.trainingIncluded ? nextOpenMeetingOf('training', activities, now, mine) : null;
    const reading = this.readingOfTheDay();
    const available: InviteKind[] = [];
    if (canBookSession(this.ctx)) {
      available.push('conversation');
    }
    if (circle) {
      available.push('circle');
    }
    if (training) {
      available.push('training');
    }
    if (reading) {
      available.push('reading');
    }
    const kind = inviteKindFor(today, available);
    const meeting = kind === 'circle' ? circle : kind === 'training' ? training : null;
    if ((kind === 'circle' || kind === 'training') && meeting) {
      const invite: DailyInvite = {
        kind,
        title: meeting.title,
        text: `${this.when(meeting.startAt, today)}. ${eventWhoText(meeting.type, access)}`,
        actionLabel: 'Ver detalhes',
        link: '/cuidador/cuidar-de-mim/grupos',
        query: { atividade: meeting.activityId },
        eventType: meeting.type,
      };
      return invite;
    }
    if (kind === 'reading' && reading) {
      return {
        kind,
        title: readingTimeLabel(reading.body),
        text: reading.title,
        actionLabel: 'Ler agora',
        link: '/cuidador/cuidar-de-mim/conteudos',
        query: { conteudo: reading.id },
        eventType: null,
      };
    }
    if (kind === 'conversation') {
      return {
        kind,
        title: 'Uma conversa só para você',
        text: 'Reserve um horário com um psicólogo da Nexus. Você escolhe o formato.',
        actionLabel: 'Ver horários',
        link: '/cuidador/cuidar-de-mim/atendimento',
        query: null,
        eventType: null,
      };
    }
    return null;
  });

  /** Um conteúdo livre (publicado e não exclusivo), escolhido pelo dia. */
  private readingOfTheDay(): { id: ID; title: string; body: string } | null {
    const free = this.db.guidanceContents.query((c) => c.status === 'published' && !c.exclusive);
    if (free.length === 0) {
      return null;
    }
    const day = Number(this.ctx.today().replace(/-/g, ''));
    const content = free[day % free.length];
    return content ? { id: content.id, title: content.title, body: content.body } : null;
  }

  /** "Quinta-feira, 12/11, às 19:00" (ou "Hoje, às 19:00", "Amanhã, às 19:00"). */
  private when(at: ISODateTime, today: string): string {
    const relative = relativeDay(dateOf(at), today);
    const day = relative === 'hoje' || relative === 'amanhã' ? capitalize(relative) : capitalize(formatDayLong(dateOf(at)));
    return `${day}, às ${timeOf(at)}`;
  }
}

