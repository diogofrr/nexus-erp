import { Injectable, computed, inject } from '@angular/core';
import { Clock } from '../../../../core/clock/clock.service';
import { compareDateTimes, dateOf, timeOf } from '../../../../core/clock/date-utils';
import { DoseCheckService } from '../../../../core/care/dose-check.service';
import { Database } from '../../../../core/data/database';
import { ID, ISODateTime } from '../../../../core/models';
import { nextOne } from '../../../../core/rules/care-agenda';
import { doseProgress } from '../../../../core/rules/medication-doses';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { formatDayLong, relativeDay, relativeDateTime } from '../../state/day-format';
import { MoodValue, moodLabel } from '../../ui/cg-mood.component';
import { withArticle } from '../../state/people-format';
import { InviteKind, capitalize, greetingFor, inviteKindFor } from './today-rules';
import { WellbeingCheckService, WellbeingError } from './wellbeing-check.service';

/** Quantas linhas de remédio Hoje mostra de cara (S-36): o resto fica atrás de "Ver todos". */
export const TODAY_DOSE_ROWS = 4;

/** O próximo compromisso da pessoa idosa ou a conversa do próprio cuidador com o psicólogo. */
export interface NextEvent {
  key: string;
  /** "Fisioterapia, hoje às 14:00" ou "Sua conversa com a Dra. Beatriz, qui, 06/11, às 14:00". */
  text: string;
  /** Onde ou com quem (só nos compromissos). */
  support: string | null;
  /** A conversa da própria pessoa leva a etiqueta "Para você" (S-27). */
  forYou: boolean;
}

/** Serviço concluído, ainda sem avaliação (RN-ARP-02): leva a Meus pedidos, onde a folha de avaliação abre. */
export interface RateRequest {
  requestId: ID;
  providerName: string;
}

/** O convite do dia (S-11): só itens abertos a todos os planos, sem preço, plano nem bloqueio. */
export interface DailyInvite {
  kind: InviteKind;
  title: string;
  text: string;
  actionLabel: string;
  link: string;
  query: Record<string, string> | null;
}

/**
 * Tudo o que a tela Hoje mostra, em signals (docs/10-cuidador-ux.md, C4). Lê o contexto do cuidador e as coleções;
 * NUNCA lê pontuação, faixa nem alerta da escala: o contato da equipe vem só de `ctx.staffContact()` (P-03).
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
            support: a.place?.trim() ? a.place.trim() : null,
            forYou: false,
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
            support: null,
            forYou: true,
          });
        });
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
   * (S-11). Essa ocultação usa o estado do contato só para CUIDAR, nunca para vender (RN-PLN-19, RN-LGPD-17).
   */
  readonly invite = computed<DailyInvite | null>(() => {
    if (this.ctx.staffContact() !== 'none') {
      return null;
    }
    const today = this.ctx.today();
    const now = this.clock.now();
    const circle = this.nextOpenCircle(now);
    const reading = this.readingOfTheDay();
    const available: InviteKind[] = [];
    if (circle) {
      available.push('circle');
    }
    if (reading) {
      available.push('reading');
    }
    const kind = inviteKindFor(today, available);
    if (kind === 'circle' && circle) {
      const invite: DailyInvite = {
        kind,
        title: 'Roda de conversa aberta',
        text: `${this.when(circle.startAt, today)}. Aberta a todos.`,
        actionLabel: 'Ver detalhes',
        link: '/cuidador/cuidar-de-mim/grupos',
        query: { atividade: circle.activityId },
      };
      return invite;
    }
    if (kind === 'reading' && reading) {
      const invite: DailyInvite = {
        kind,
        title: 'Leitura de 3 minutos',
        text: reading.title,
        actionLabel: 'Ler agora',
        link: '/cuidador/cuidar-de-mim/conteudos',
        query: { conteudo: reading.id },
      };
      return invite;
    }
    return {
      kind: 'conversation',
      title: 'Uma conversa só para você',
      text: 'Reserve um horário com um psicólogo da Nexus. Você escolhe o formato.',
      actionLabel: 'Ver horários',
      link: '/cuidador/cuidar-de-mim/atendimento',
      query: null,
    };
  });

  /** A próxima roda de conversa aberta (aberta a todos os planos, RN-GRP-02). */
  private nextOpenCircle(now: ISODateTime): { activityId: ID; startAt: ISODateTime } | null {
    const meetings: { activityId: ID; startAt: ISODateTime }[] = [];
    for (const activity of this.db.activities.query((a) => a.kind === 'open_conversation_circle' && a.status === 'open')) {
      for (const meeting of activity.meetings) {
        if (!meeting.done && compareDateTimes(meeting.startAt, now) >= 0) {
          meetings.push({ activityId: activity.id, startAt: meeting.startAt });
        }
      }
    }
    meetings.sort((a, b) => compareDateTimes(a.startAt, b.startAt));
    return meetings[0] ?? null;
  }

  /** Um conteúdo livre (publicado e não exclusivo), escolhido pelo dia. */
  private readingOfTheDay(): { id: ID; title: string } | null {
    const free = this.db.guidanceContents.query((c) => c.status === 'published' && !c.exclusive);
    if (free.length === 0) {
      return null;
    }
    const day = Number(this.ctx.today().replace(/-/g, ''));
    const content = free[day % free.length];
    return content ? { id: content.id, title: content.title } : null;
  }

  /** "Quinta-feira, 12/11, às 19:00" (ou "Hoje, às 19:00", "Amanhã, às 19:00"). */
  private when(at: ISODateTime, today: string): string {
    const relative = relativeDay(dateOf(at), today);
    const day = relative === 'hoje' || relative === 'amanhã' ? capitalize(relative) : capitalize(formatDayLong(dateOf(at)));
    return `${day}, às ${timeOf(at)}`;
  }
}
