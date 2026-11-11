import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { AuthService, canUseSubArea } from '@core/auth';
import { Clock, compareDateTimes, toIsoDateTime } from '@core/clock';
import { Database } from '@core/data';
import { planIdOfCaregiver } from '@core/data/plan-lookup';
import { GroupMembershipService } from '@core/groups';
import {
  Activity,
  ActivityEnrollment,
  ActivityKind,
  ActivityMeeting,
  ID,
  ISODate,
  PlanId,
} from '@core/models';
import { EnrollmentOffer, activityMinPlan, canAccessActivity, formatCentsBr, percentOf } from '@core/rules';
import { isRoomBookable, roomBlockReason } from '@core/rules/rooms';
import { DEFAULT_CONFIDENTIALITY, PROMISE_PATTERN, isThemeAllowed } from './groups-labels';

export interface FieldError {
  field: string;
  message: string;
}
export type OpResult<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

function fail<T>(field: string, message: string): OpResult<T> {
  return { ok: false, errors: [{ field, message }] };
}

export type CheckState = 'ok' | 'pending' | 'fail' | 'na';

/** Linha da lista de checagens do diálogo de inscrição (A-31, F11): todas à vista de uma vez. */
export interface EnrollCheck {
  id: 'status' | 'plan' | 'eligibility' | 'room' | 'seats' | 'duplicate';
  title: string;
  text: string;
  state: CheckState;
}

export interface ActivityForm {
  id?: ID;
  kind: ActivityKind | null;
  title: string;
  theme: string;
  leaderType: 'psychologist' | 'provider' | 'guest';
  leaderId: ID;
  guestName: string;
  guestRegistration: string;
  mode: Activity['mode'] | null;
  roomId: ID;
  partnerOrg: string;
  capacity: number | null;
  meetings: { date: ISODate; start: string; end: string }[];
  confidentialityText: string;
}

export interface ActivityStats {
  holders: number;
  waitlisted: number;
  capacity: number;
  /** Inscritos ÷ vagas x 100 (RN-KPI-08, K28). */
  fillPercent: number | null;
  doneMeetings: number;
  presences: number;
  /** Presenças ÷ (inscritos x encontros realizados) x 100. `null` sem encontro realizado. */
  presencePercent: number | null;
}

export interface EnrollInput {
  activityId: ID;
  caregiverId?: ID;
  external?: { name: string; email: string };
  /** O participante leu e aceitou o contrato de sigilo (RN-GRP-09). */
  contractAccepted: boolean;
  /** Instante em que a caixa foi marcada (data e hora gravadas). */
  acceptedAt?: string;
  /** Terapia de grupo: o psicólogo do caso marcou o cuidador como elegível (RN-GRP-14). */
  eligible?: boolean;
}

export const EMAIL_DOMAIN = '@exemplo.com.br';

/**
 * Grupos e capacitações (M07, RN-GRP-01 a 17). Regras de acesso por plano (RN-GRP-02), sigilo com aceite
 * carimbado (RN-GRP-09), capacidade com lista de espera e promoção automática (RN-GRP-13), presença e
 * indicadores (RN-KPI-08). As vagas e a lista de espera ficam no núcleo (`GroupMembershipService`), para a
 * mudança de plano (M04) usar a mesma regra.
 */
@Injectable({ providedIn: 'root' })
export class GroupsService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly auth = inject(AuthService);
  private readonly membership = inject(GroupMembershipService);

  // ===== Permissões =====

  private myPsychologistId(): ID | null {
    return this.auth.actor()?.psychologistId ?? null;
  }

  /** O psicólogo conduz a atividade? */
  leads(activity: Pick<Activity, 'leaders'>): boolean {
    const mine = this.myPsychologistId();
    return mine !== null && activity.leaders.some((l) => l.type === 'psychologist' && l.id === mine);
  }

  canCreate(): boolean {
    const role = this.auth.role();
    return role === 'partner' || role === 'psychologist';
  }

  /** Publicar, cancelar, encerrar e marcar presença: a sócia em tudo, o psicólogo nos seus grupos. */
  canManage(activity: Pick<Activity, 'leaders'>): boolean {
    const role = this.auth.role();
    return role === 'partner' || (role === 'psychologist' && this.leads(activity));
  }

  /** Inscrever e cancelar inscrição: sócia, atendimento (inscrições) e o psicólogo nos seus grupos. */
  canEnroll(activity: Pick<Activity, 'leaders' | 'kind'>): boolean {
    const role = this.auth.role();
    if (role === 'partner') {
      return true;
    }
    if (role === 'support') {
      return canUseSubArea('support', 'groups', 'enrollments');
    }
    return role === 'psychologist' && (this.leads(activity) || activity.kind === 'group_therapy');
  }

  /** O RT valida o enquadramento (orientação ou psicoterapia) das atividades (POP-04). */
  canValidateFraming(): boolean {
    return this.auth.role() === 'technical_lead' && canUseSubArea('technical_lead', 'groups', 'framing_validation');
  }

  /** Quem pode marcar a elegibilidade para terapia de grupo: o psicólogo do caso (RN-GRP-14). */
  canMarkEligible(caregiverId: ID | undefined): boolean {
    const mine = this.myPsychologistId();
    const caregiver = caregiverId ? this.db.caregivers.get(caregiverId) : undefined;
    return this.auth.role() === 'psychologist' && mine !== null && caregiver?.assignedPsychologistId === mine;
  }

  /**
   * Nomes dos participantes: a gestão só vê código (LP-08); o atendimento não vê quem está em terapia de grupo;
   * o psicólogo só nos grupos que conduz; o RT vê (supervisão).
   */
  canSeeNames(activity: Pick<Activity, 'leaders' | 'kind'>): boolean {
    switch (this.auth.role()) {
      case 'technical_lead':
        return true;
      case 'psychologist':
        return this.leads(activity);
      case 'support':
        return activity.kind !== 'group_therapy';
      default:
        return false;
    }
  }

  // ===== Leitura =====

  enrollmentsOf(activityId: ID): ActivityEnrollment[] {
    return this.db.activityEnrollments.query((e) => e.activityId === activityId);
  }

  holders(activityId: ID): ActivityEnrollment[] {
    return this.enrollmentsOf(activityId).filter((e) => e.status === 'enrolled' || e.status === 'attended' || e.status === 'absent');
  }

  statsOf(activity: Activity): ActivityStats {
    const holders = this.holders(activity.id);
    const done = activity.meetings.filter((m) => m.done);
    const doneIds = new Set(done.map((m) => m.id));
    const presences = holders.reduce(
      (sum, e) => sum + e.attendance.filter((a) => a.present && doneIds.has(a.meetingId)).length,
      0,
    );
    return {
      holders: holders.length,
      waitlisted: this.membership.waitlist(activity.id).length,
      capacity: activity.capacity,
      fillPercent: percentOf(holders.length, activity.capacity, 1),
      doneMeetings: done.length,
      presences,
      presencePercent: percentOf(presences, holders.length * done.length, 1),
    };
  }

  nextMeeting(activity: Activity): ActivityMeeting | undefined {
    const now = this.clock.now();
    return [...activity.meetings]
      .filter((m) => !m.done && compareDateTimes(m.startAt, now) >= 0)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  }

  /** O RT validou o enquadramento? Lê o último registro no log (sem conteúdo clínico). */
  framingValidation(activityId: ID): { at: string; userId: ID } | null {
    const found = this.audit
      .query({ entity: 'activity_framing' })
      .find((e) => e.entityId === activityId);
    return found ? { at: found.at, userId: found.userId } : null;
  }

  // ===== Checagens da inscrição (A-31) =====

  checksFor(activity: Activity, who: { caregiverId?: ID; external?: boolean }, eligible = false): EnrollCheck[] {
    const checks: EnrollCheck[] = [];
    const accepting = this.membership.acceptsEnrollment(activity);
    checks.push({
      id: 'status',
      title: 'Situação da atividade',
      state: accepting ? 'ok' : 'fail',
      text: accepting
        ? 'Aceita inscrições.'
        : activity.status === 'draft'
          ? 'Ainda é rascunho: publique a atividade para abrir as inscrições.'
          : activity.status === 'cancelled'
            ? 'A atividade foi cancelada.'
            : 'A atividade já começou ou terminou.',
    });
    if (who.external) {
      checks.push({
        id: 'plan',
        title: 'Plano',
        state: activity.kind === 'open_circle' ? 'ok' : 'fail',
        text:
          activity.kind === 'open_circle'
            ? 'Roda aberta: aceita qualquer plano e participante externo.'
            : 'Só a roda de conversa aberta aceita participante externo.',
      });
    } else if (who.caregiverId) {
      const plan = planIdOfCaregiver(this.db, who.caregiverId);
      const access = canAccessActivity(plan, activity.kind);
      // docs/20: roda aberta sem cota; capacitação incluída conforme o plano, senão avulsa; terapia de grupo só Cuida e Sustenta.
      const offer = access.allowed ? this.membership.offerFor(activity, who.caregiverId) : null;
      checks.push({
        id: 'plan',
        title: 'Plano',
        state: access.allowed ? 'ok' : 'fail',
        text: access.allowed
          ? `${this.planName(plan)}: ${offer ? offerText(offer) : 'ok.'}`
          : `${this.planName(plan)}: a terapia de grupo é dos planos Cuida e Sustenta.`,
      });
    } else {
      checks.push({ id: 'plan', title: 'Plano', state: 'pending', text: 'Escolha o participante para conferir o plano.' });
    }
    if (activity.kind === 'group_therapy') {
      // docs/20: a indicação do psicólogo deixou de ser exigida; marcar continua possível e fica registrado.
      const ok = eligible && this.canMarkEligible(who.caregiverId);
      checks.push({
        id: 'eligibility',
        title: 'Indicação do psicólogo',
        state: ok ? 'ok' : 'na',
        text: ok ? 'Indicado pelo psicólogo do caso.' : 'Não é exigida: a terapia de grupo vale para os planos Cuida e Sustenta.',
      });
    } else {
      checks.push({ id: 'eligibility', title: 'Elegibilidade', state: 'na', text: 'Não se aplica a este tipo de atividade.' });
    }
    if (activity.mode === 'in_person') {
      const room = this.db.rooms.get(activity.roomId ?? '');
      const bookable = !!room && isRoomBookable(room);
      checks.push({
        id: 'room',
        title: 'Sala acessível',
        state: bookable ? 'ok' : 'fail',
        text: bookable ? `${room?.name}: os 4 itens de acessibilidade.` : (room ? roomBlockReason(room) : null) ?? 'Sala a definir.',
      });
    } else {
      checks.push({ id: 'room', title: 'Sala acessível', state: 'na', text: 'Atividade on-line.' });
    }
    const free = this.membership.seatsFree(activity);
    checks.push({
      id: 'seats',
      title: 'Vaga',
      state: 'ok',
      text:
        free > 0
          ? `${free} ${free === 1 ? 'vaga' : 'vagas'}.`
          : `Lotado: a pessoa entra na posição ${this.membership.nextWaitlistPosition(activity.id)} da lista de espera. Se uma vaga abrir, a promoção é automática.`,
    });
    const duplicate = this.isEnrolled(activity.id, who);
    checks.push({
      id: 'duplicate',
      title: 'Inscrição existente',
      state: duplicate ? 'fail' : 'ok',
      text: duplicate ? 'Esta pessoa já está inscrita ou na lista de espera.' : 'Sem inscrição anterior.',
    });
    return checks;
  }

  private planName(plan: PlanId): string {
    return this.db.plans.get(plan)?.name.replace('Nexus ', '') ?? plan;
  }

  private isEnrolled(activityId: ID, who: { caregiverId?: ID; external?: boolean }): boolean {
    return (
      !!who.caregiverId &&
      this.db.activityEnrollments.count(
        (e) =>
          e.activityId === activityId &&
          e.caregiverId === who.caregiverId &&
          (e.status === 'enrolled' || e.status === 'waitlist'),
      ) > 0
    );
  }

  // ===== Inscrever e cancelar =====

  enroll(input: EnrollInput): OpResult<{ enrollment: ActivityEnrollment; waitlisted: boolean }> {
    const activity = this.db.activities.get(input.activityId);
    if (!activity) {
      return fail('activity', 'Atividade não encontrada.');
    }
    if (!this.canEnroll(activity)) {
      return fail('activity', 'Seu perfil não inscreve participantes nesta atividade.');
    }
    const who = input.external ? { external: true } : { caregiverId: input.caregiverId };
    const errors: FieldError[] = [];
    this.checksFor(activity, who, input.eligible === true)
      .filter((c) => c.state === 'fail')
      .forEach((c) => errors.push({ field: c.id, message: c.text }));
    if (input.external) {
      if (input.external.name.trim().length < 3) {
        errors.push({ field: 'externalName', message: 'Informe o nome do participante externo.' });
      }
      if (!input.external.email.trim().toLowerCase().endsWith(EMAIL_DOMAIN)) {
        errors.push({ field: 'externalEmail', message: `Use um e-mail que termine em ${EMAIL_DOMAIN}.` });
      }
    } else {
      const caregiver = input.caregiverId ? this.db.caregivers.get(input.caregiverId) : undefined;
      if (!caregiver || caregiver.status === 'closed') {
        errors.push({ field: 'caregiver', message: 'Escolha o participante.' });
      }
    }
    if (!input.contractAccepted) {
      errors.push({ field: 'contract', message: 'O participante precisa aceitar o contrato de sigilo para entrar.' });
    }
    if (errors.length > 0) {
      const seen = new Set<string>();
      const unique = errors.filter((e) => {
        const key = e.field + e.message;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      return { ok: false, errors: unique };
    }
    const full = this.membership.seatsFree(activity) === 0;
    const offer = input.caregiverId && !input.external ? this.membership.offerFor(activity, input.caregiverId) : null;
    const enrollment = this.db.activityEnrollments.create({
      activityId: activity.id,
      ...(input.external ? { external: { name: input.external.name.trim(), email: input.external.email.trim() } } : { caregiverId: input.caregiverId as ID }),
      status: full ? 'waitlist' : 'enrolled',
      ...(full ? { waitlistPosition: this.membership.nextWaitlistPosition(activity.id) } : {}),
      confidentialityAcceptedAt: input.acceptedAt ?? this.clock.now(),
      ...(activity.kind === 'group_therapy' && input.eligible && this.canMarkEligible(input.caregiverId) ? { eligibleForGroupTherapy: true } : {}),
      ...(offer ? { includedInPlan: offer.kind === 'included', paid: offer.kind === 'paid', priceCents: offer.priceCents } : { includedInPlan: false, paid: false, priceCents: 0 }),
      attendance: [],
    });
    this.membership.syncStatus(activity.id);
    this.audit.write(
      'create',
      'activity_enrollment',
      enrollment.id,
      input.caregiverId,
      full ? 'entrada na lista de espera' : 'inscrição em atividade',
    );
    return { ok: true, value: { enrollment, waitlisted: full } };
  }

  /** Cancela a inscrição e promove o primeiro da fila (AC-M07-04). */
  cancelEnrollment(enrollmentId: ID): OpResult<{ promoted: ActivityEnrollment[] }> {
    const enrollment = this.db.activityEnrollments.get(enrollmentId);
    const activity = enrollment ? this.db.activities.get(enrollment.activityId) : undefined;
    if (!enrollment || !activity || !this.canEnroll(activity)) {
      return fail('enrollment', 'Seu perfil não cancela esta inscrição.');
    }
    if (enrollment.status !== 'enrolled' && enrollment.status !== 'waitlist') {
      return fail('enrollment', 'Só uma inscrição ativa ou na lista de espera pode ser cancelada.');
    }
    const change = this.membership.cancelEnrollment(enrollmentId);
    return { ok: true, value: { promoted: change.promoted } };
  }

  /** Quem seria promovido se esta inscrição fosse cancelada (para o diálogo de efeito). */
  promotionPreview(enrollmentId: ID): ActivityEnrollment | undefined {
    const enrollment = this.db.activityEnrollments.get(enrollmentId);
    if (!enrollment || enrollment.status !== 'enrolled') {
      return undefined;
    }
    return this.membership.waitlist(enrollment.activityId)[0];
  }

  // ===== Criar, editar, publicar =====

  /** Formulário vazio. */
  emptyForm(): ActivityForm {
    return {
      kind: null,
      title: '',
      theme: '',
      leaderType: 'psychologist',
      leaderId: this.myPsychologistId() ?? '',
      guestName: '',
      guestRegistration: '',
      mode: null,
      roomId: '',
      partnerOrg: '',
      capacity: this.db.settings.get().groupDefaultCapacity,
      meetings: [],
      confidentialityText: DEFAULT_CONFIDENTIALITY,
    };
  }

  formOf(activity: Activity): ActivityForm {
    const leader = activity.leaders[0];
    return {
      id: activity.id,
      kind: activity.kind,
      title: activity.title,
      theme: activity.theme,
      leaderType: leader?.type ?? 'guest',
      leaderId: leader?.id ?? '',
      guestName: leader?.type === 'guest' ? leader.name : '',
      guestRegistration: leader?.type === 'guest' ? (leader.professionalRegistration ?? '') : '',
      mode: activity.mode,
      roomId: activity.roomId ?? '',
      partnerOrg: activity.partnerOrg ?? '',
      capacity: activity.capacity,
      meetings: activity.meetings.map((m) => ({ date: m.startAt.slice(0, 10), start: m.startAt.slice(11, 16), end: m.endAt.slice(11, 16) })),
      confidentialityText: activity.confidentialityText,
    };
  }

  /** Salva como rascunho ou publica (`open`). Todas as validações do escopo (M07-02). */
  save(form: ActivityForm, publish: boolean): OpResult<Activity> {
    if (!this.canCreate()) {
      return fail('activity', 'Seu perfil não cria atividades.');
    }
    const errors: FieldError[] = [];
    if (!form.kind) {
      errors.push({ field: 'kind', message: 'Escolha o tipo da atividade.' });
    }
    if (form.title.trim().length < 3) {
      errors.push({ field: 'title', message: 'Informe o título da atividade.' });
    } else if (PROMISE_PATTERN.test(form.title)) {
      errors.push({ field: 'title', message: 'A divulgação não pode prometer resultado terapêutico. Reescreva o título.' });
    }
    if (form.kind && !isThemeAllowed(form.kind, form.theme)) {
      errors.push({ field: 'theme', message: 'Escolha um dos temas da lista.' });
    }
    const leader = this.buildLeader(form, errors);
    if (!form.mode) {
      errors.push({ field: 'mode', message: 'Escolha a modalidade.' });
    }
    if (form.mode === 'in_person') {
      const room = this.db.rooms.get(form.roomId);
      if (!room) {
        errors.push({ field: 'room', message: 'Escolha a sala do coworking.' });
      } else if (!isRoomBookable(room)) {
        errors.push({ field: 'room', message: roomBlockReason(room) ?? 'Sala indisponível.' });
      }
    }
    if (form.capacity === null || !Number.isInteger(form.capacity) || form.capacity < 1 || form.capacity > 60) {
      errors.push({ field: 'capacity', message: 'A capacidade deve ser de 1 a 60 vagas.' });
    }
    if (form.meetings.length === 0) {
      errors.push({ field: 'meetings', message: 'Informe ao menos um encontro, com data e horário.' });
    }
    form.meetings.forEach((m, i) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !/^\d{2}:\d{2}$/.test(m.start) || !/^\d{2}:\d{2}$/.test(m.end)) {
        errors.push({ field: 'meetings', message: `Confira a data e o horário do encontro ${i + 1}.` });
      } else if (m.end <= m.start) {
        errors.push({ field: 'meetings', message: `O encontro ${i + 1} precisa terminar depois de começar.` });
      }
    });
    if (form.confidentialityText.trim().length < 20) {
      errors.push({ field: 'confidentiality', message: 'Escreva o texto do contrato de sigilo.' });
    }
    const role = this.auth.role();
    const mine = this.myPsychologistId();
    if (role === 'psychologist' && !(form.leaderType === 'psychologist' && form.leaderId === mine)) {
      errors.push({ field: 'leader', message: 'O psicólogo cria atividades que ele mesmo conduz.' });
    }
    if (errors.length > 0 || !form.kind || !form.mode || !leader) {
      return { ok: false, errors };
    }
    const kind = form.kind;
    const base = {
      kind,
      title: form.title.trim(),
      theme: form.theme as Activity['theme'],
      character: kind === 'group_therapy' ? ('psychotherapy' as const) : ('guidance' as const),
      leaders: [leader],
      mode: form.mode,
      capacity: form.capacity as number,
      minPlan: activityMinPlan(kind),
      // docs/20: a terapia de grupo não exige mais a indicação do psicólogo (o plano decide).
      requiresEligibility: false,
      confidentialityText: form.confidentialityText.trim(),
      ...(form.mode === 'in_person' ? { roomId: form.roomId } : {}),
      ...(form.partnerOrg.trim() ? { partnerOrg: form.partnerOrg.trim() } : {}),
    };
    const toMeetings = (activityId: ID, previous: readonly ActivityMeeting[]): ActivityMeeting[] =>
      form.meetings.map((m, i) => ({
        id: previous[i]?.id ?? `${activityId}_m${i + 1}`,
        startAt: toIsoDateTime(m.date, m.start),
        endAt: toIsoDateTime(m.date, m.end),
        done: previous[i]?.done ?? false,
      }));
    const existing = form.id ? this.db.activities.get(form.id) : undefined;
    let activity: Activity;
    if (existing) {
      if (!this.canManage(existing)) {
        return fail('activity', 'Seu perfil não edita esta atividade.');
      }
      activity = this.db.activities.update(existing.id, {
        ...base,
        ...(form.mode === 'online' ? { roomId: undefined } : {}),
        meetings: toMeetings(existing.id, existing.meetings),
        ...(publish && existing.status === 'draft' ? { status: 'open' as const } : {}),
      });
      this.audit.write('update', 'activity', activity.id, undefined, 'atividade editada');
    } else {
      activity = this.db.activities.create({ ...base, meetings: [], status: publish ? 'open' : 'draft' });
      activity = this.db.activities.update(activity.id, { meetings: toMeetings(activity.id, []) });
      this.audit.write('create', 'activity', activity.id, undefined, publish ? 'atividade publicada' : 'rascunho de atividade');
    }
    this.membership.syncStatus(activity.id);
    return { ok: true, value: this.db.activities.require(activity.id) };
  }

  private buildLeader(form: ActivityForm, errors: FieldError[]): Activity['leaders'][number] | null {
    if (form.leaderType === 'psychologist') {
      const psy = this.db.psychologists.get(form.leaderId);
      if (!psy) {
        errors.push({ field: 'leader', message: 'Escolha o psicólogo da Nexus que conduz.' });
        return null;
      }
      if (psy.crpStatus !== 'active') {
        errors.push({ field: 'leader', message: 'O psicólogo precisa ter CRP ativo.' });
        return null;
      }
      return { type: 'psychologist', id: psy.id, name: psy.displayName, professionalRegistration: `${psy.crp} (fictício)` };
    }
    if (form.kind === 'group_therapy') {
      errors.push({ field: 'leader', message: 'A terapia de grupo é conduzida por psicólogo da Nexus com CRP ativo.' });
      return null;
    }
    if (form.leaderType === 'provider') {
      const provider = this.db.providers.get(form.leaderId);
      if (!provider) {
        errors.push({ field: 'leader', message: 'Escolha o profissional credenciado que conduz.' });
        return null;
      }
      return { type: 'provider', id: provider.id, name: provider.name };
    }
    if (form.guestName.trim().length < 3) {
      errors.push({ field: 'leader', message: 'Informe o nome do convidado que conduz.' });
      return null;
    }
    return {
      type: 'guest',
      name: form.guestName.trim(),
      ...(form.guestRegistration.trim() ? { professionalRegistration: form.guestRegistration.trim() } : {}),
    };
  }

  publish(activityId: ID): OpResult<Activity> {
    const activity = this.db.activities.get(activityId);
    if (!activity || !this.canManage(activity)) {
      return fail('activity', 'Seu perfil não publica esta atividade.');
    }
    if (activity.status !== 'draft') {
      return fail('activity', 'Só um rascunho pode ser publicado.');
    }
    const updated = this.db.activities.update(activityId, { status: 'open' });
    this.membership.syncStatus(activityId);
    this.audit.write('update', 'activity', activityId, undefined, 'atividade publicada');
    return { ok: true, value: this.db.activities.require(updated.id) };
  }

  /** Cancela a atividade (de rascunho a em andamento). As inscrições e a lista de espera são canceladas junto. */
  cancelActivity(activityId: ID): OpResult<{ affected: number }> {
    const activity = this.db.activities.get(activityId);
    if (!activity || !this.canManage(activity)) {
      return fail('activity', 'Seu perfil não cancela esta atividade.');
    }
    if (activity.status === 'finished' || activity.status === 'cancelled') {
      return fail('activity', 'Esta atividade já terminou ou foi cancelada.');
    }
    this.db.activities.update(activityId, { status: 'cancelled' });
    const affected = this.db.activityEnrollments.updateWhere(
      (e) => e.activityId === activityId && (e.status === 'enrolled' || e.status === 'waitlist'),
      { status: 'cancelled', waitlistPosition: undefined },
    );
    this.audit.write('update', 'activity', activityId, undefined, 'atividade cancelada');
    return { ok: true, value: { affected } };
  }

  /** Encerra a atividade em andamento: quem esteve em algum encontro participou; quem faltou a todos, ausente. */
  finishActivity(activityId: ID): OpResult<Activity> {
    const activity = this.db.activities.get(activityId);
    if (!activity || !this.canManage(activity)) {
      return fail('activity', 'Seu perfil não encerra esta atividade.');
    }
    if (activity.status !== 'in_progress') {
      return fail('activity', 'Só uma atividade em andamento pode ser encerrada.');
    }
    this.holders(activityId)
      .filter((e) => e.status === 'enrolled')
      .forEach((e) =>
        this.db.activityEnrollments.update(e.id, { status: e.attendance.some((a) => a.present) ? 'attended' : 'absent' }),
      );
    const updated = this.db.activities.update(activityId, { status: 'finished' });
    this.audit.write('update', 'activity', activityId, undefined, 'atividade encerrada');
    return { ok: true, value: updated };
  }

  // ===== Presença =====

  private meetingStarted(meeting: ActivityMeeting): boolean {
    return meeting.done || compareDateTimes(meeting.startAt, this.clock.now()) <= 0;
  }

  /** Marca presente ou ausente. Só vale para encontro que já começou ou foi realizado. */
  setAttendance(enrollmentId: ID, meetingId: ID, present: boolean): OpResult<ActivityEnrollment> {
    const enrollment = this.db.activityEnrollments.get(enrollmentId);
    const activity = enrollment ? this.db.activities.get(enrollment.activityId) : undefined;
    const meeting = activity?.meetings.find((m) => m.id === meetingId);
    if (!enrollment || !activity || !meeting || !this.canManage(activity)) {
      return fail('attendance', 'Seu perfil não registra presença nesta atividade.');
    }
    if (activity.status === 'cancelled' || activity.status === 'draft') {
      return fail('attendance', 'Esta atividade não tem encontros em andamento.');
    }
    if (!this.meetingStarted(meeting)) {
      return fail('attendance', 'O encontro ainda não começou.');
    }
    if (enrollment.status !== 'enrolled' && enrollment.status !== 'attended' && enrollment.status !== 'absent') {
      return fail('attendance', 'Só quem está inscrito tem presença.');
    }
    const others = enrollment.attendance.filter((a) => a.meetingId !== meetingId);
    const updated = this.db.activityEnrollments.update(enrollmentId, {
      attendance: [...others, { meetingId, present }],
    });
    this.audit.write('update', 'activity_attendance', enrollmentId, enrollment.caregiverId, 'presença registrada');
    return { ok: true, value: updated };
  }

  /** Marca o encontro como realizado; a atividade `open` ou `full` passa a `in_progress`. */
  markMeetingDone(activityId: ID, meetingId: ID): OpResult<Activity> {
    const activity = this.db.activities.get(activityId);
    const meeting = activity?.meetings.find((m) => m.id === meetingId);
    if (!activity || !meeting || !this.canManage(activity)) {
      return fail('meeting', 'Seu perfil não registra encontros desta atividade.');
    }
    if (meeting.done) {
      return { ok: true, value: activity };
    }
    if (!this.meetingStarted(meeting)) {
      return fail('meeting', 'O encontro ainda não começou.');
    }
    if (activity.status !== 'open' && activity.status !== 'full' && activity.status !== 'in_progress') {
      return fail('meeting', 'Esta atividade não está recebendo encontros.');
    }
    const meetings = activity.meetings.map((m) => (m.id === meetingId ? { ...m, done: true } : m));
    const updated = this.db.activities.update(activityId, {
      meetings,
      ...(activity.status === 'open' || activity.status === 'full' ? { status: 'in_progress' as const } : {}),
    });
    this.audit.write('update', 'activity', activityId, undefined, 'encontro realizado');
    return { ok: true, value: updated };
  }

  // ===== Enquadramento (RT, POP-04) =====

  validateFraming(activityId: ID): OpResult<Activity> {
    const activity = this.db.activities.get(activityId);
    if (!activity || !this.canValidateFraming()) {
      return fail('framing', 'Só o responsável técnico valida o enquadramento.');
    }
    this.audit.write('update', 'activity_framing', activityId, undefined, `enquadramento validado: ${activity.character === 'psychotherapy' ? 'psicoterapia' : 'orientação e psicoeducação'}`);
    return { ok: true, value: activity };
  }

  /** Cuidadores que podem ser inscritos (ativos), pelo plano e perfil. */
  eligibleCaregivers(): { id: ID; fullName: string; code: string; planId: PlanId }[] {
    const mine = this.myPsychologistId();
    return this.db.caregivers
      .all()
      .filter((c) => c.status !== 'closed' && (this.auth.role() !== 'psychologist' || c.assignedPsychologistId === mine))
      .map((c) => ({ id: c.id, fullName: c.fullName, code: c.code, planId: planIdOfCaregiver(this.db, c.id) }));
  }
}

/** "incluída na cota do plano (2 de 2 encontros no mês)." ou "avulsa, R$ 80,00 (2 encontros)." ou "roda aberta, sem cota." */
function offerText(offer: EnrollmentOffer): string {
  switch (offer.kind) {
    case 'free':
      return 'roda aberta, sem cota.';
    case 'included':
      return offer.usage && offer.usage.limit !== 'all'
        ? `incluída na cota do plano (${Math.min(offer.usage.limit, offer.usage.used + offer.meetings)} de ${offer.usage.limit} encontros no mês).`
        : 'incluída no plano.';
    case 'paid':
      return `avulsa, ${formatCentsBr(offer.priceCents)} (${offer.meetings} ${offer.meetings === 1 ? 'encontro' : 'encontros'} no mês, pagamento simulado).`;
    default:
      return 'ok.';
  }
}
