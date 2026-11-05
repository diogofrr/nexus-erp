import { Injectable, computed, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import {
  Caregiver,
  GuidanceContent,
  ID,
  ISODate,
  NormReference,
  Occurrence,
  Pop,
  PopReview,
  Referral,
  ReferralCategory,
  RiskItem,
  RiskScale,
  TrainingEvent,
} from '@core/models';
import { rankRisks, validateReferral } from '@core/rules/governance';
import {
  canActOnPop,
  checkRiskEdit,
  newOccurrenceSteps,
  occurrenceClosureStatus,
  occurrenceStatusAfterStep,
  popDisplayState,
  referralVisibility,
} from '@core/rules/governance-access';

export interface ActionResult {
  ok: boolean;
  /** Frase para mostrar quando algo impede a ação (sem culpa, diz como resolver). */
  message?: string;
}

const OK: ActionResult = { ok: true };
const refuse = (message: string): ActionResult => ({ ok: false, message });

export interface ReferralRow {
  referral: Referral;
  code: string;
  /** Nome do usuário que registrou (equipe). */
  byName: string;
}

export interface TrainingStatusRow {
  /** `provider` ou `user`. */
  personType: 'provider' | 'user';
  personId: ID;
  name: string;
  status: 'done' | 'pending';
}

/**
 * Regras de uso e gravações da Governança (M13). Lê e grava SÓ pelo `Database`; cada gravação sensível, a
 * supervisão e o "mostrar" passam pelo `AuditLogService` (sem texto clínico no detalhe). As permissões são
 * conferidas aqui de novo (a tela esconde o botão, mas a regra é esta): ações do RT só o RT, ações da gestão só a
 * gestão (RN-POP-14); psicólogo e atendimento só leem.
 */
@Injectable({ providedIn: 'root' })
export class GovernanceService {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);

  readonly role = this.auth.role;

  // ===== POPs =====

  readonly pops = computed(() =>
    [...this.db.pops.all()]
      .map((pop) => ({ pop, state: popDisplayState(pop, this.clock.today()) }))
      .sort((a, b) => a.pop.code.localeCompare(b.pop.code, 'pt-BR', { numeric: true })),
  );
  readonly popsToReviewCount = computed(
    () => this.pops().filter((p) => p.state === 'due' || p.state === 'revision_triggered').length,
  );

  popByCode(code: string): Pop | undefined {
    return this.db.pops.find((p) => p.code === code);
  }

  /** O usuário atual age neste POP? (RN-POP-14) */
  canActOn(pop: Pick<Pop, 'responsibleRole'>): boolean {
    const role = this.role();
    return role !== null && canActOnPop(role, pop.responsibleRole);
  }

  /** "Registrar revisão": grava a revisão, atualiza a data e volta o POP a "em dia". Devolve o necessário para desfazer. */
  reviewPop(code: string, note: string): ActionResult & { undo?: () => void } {
    const pop = this.popByCode(code);
    if (!pop) {
      return refuse('Esse POP não existe.');
    }
    if (!this.canActOn(pop)) {
      return refuse('As ações deste POP são de outro perfil.');
    }
    if (note.trim().length < 5) {
      return refuse('Escreva o que foi revisado, com ao menos 5 caracteres.');
    }
    const userId = this.auth.user()?.id ?? '';
    const today = this.clock.today();
    const previous = { lastReviewedAt: pop.lastReviewedAt, reviewState: pop.reviewState };
    const review = this.db.popReviews.create({
      popCode: code,
      reviewedAt: today,
      reviewedByUserId: userId,
      note: note.trim(),
    } as Omit<PopReview, 'id' | 'createdAt' | 'updatedAt'>);
    this.db.pops.update(pop.id, { lastReviewedAt: today, reviewState: 'up_to_date' });
    this.audit.write('update', 'pop', pop.id, undefined, `revisão registrada (${code})`);
    return {
      ok: true,
      undo: () => {
        this.db.popReviews.remove(review.id);
        this.db.pops.update(pop.id, previous);
        this.audit.write('update', 'pop', pop.id, undefined, `revisão desfeita (${code})`);
      },
    };
  }

  /** Um incidente apontou lacuna: aciona a revisão (RN-POP-13). O motivo fica no log, sem texto clínico. */
  triggerRevision(code: string, reason: string): ActionResult & { undo?: () => void } {
    const pop = this.popByCode(code);
    if (!pop) {
      return refuse('Esse POP não existe.');
    }
    if (!this.canActOn(pop)) {
      return refuse('As ações deste POP são de outro perfil.');
    }
    if (reason.trim().length < 5) {
      return refuse('Escreva qual lacuna o incidente mostrou, com ao menos 5 caracteres.');
    }
    const previous = pop.reviewState;
    this.db.pops.update(pop.id, { reviewState: 'revision_triggered' });
    this.audit.write('update', 'pop', pop.id, undefined, `revisão acionada (${code}): ${reason.trim()}`);
    return {
      ok: true,
      undo: () => {
        this.db.pops.update(pop.id, { reviewState: previous });
        this.audit.write('update', 'pop', pop.id, undefined, `revisão acionada desfeita (${code})`);
      },
    };
  }

  reviewsOf(code: string): PopReview[] {
    return this.db.popReviews
      .query((r) => r.popCode === code)
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt) || b.createdAt.localeCompare(a.createdAt));
  }

  /** Ciência de quem usa o ERP (a equipe): uma por pessoa e POP. */
  hasOwnAcknowledgement(code: string): boolean {
    const userId = this.auth.user()?.id;
    return this.db.popAcknowledgements
      .all()
      .some((a) => a.popCode === code && a.personType === 'user' && a.personId === userId);
  }

  acknowledge(code: string): ActionResult {
    const user = this.auth.user();
    if (!user || !this.popByCode(code)) {
      return refuse('Esse POP não existe.');
    }
    if (this.hasOwnAcknowledgement(code)) {
      return refuse('Você já registrou a ciência deste POP.');
    }
    this.db.popAcknowledgements.create({
      popCode: code,
      personType: 'user',
      personId: user.id,
      at: this.clock.today(),
    });
    this.audit.write('create', 'pop_acknowledgement', undefined, undefined, `ciência do ${code}`);
    return OK;
  }

  acknowledgementsOf(code: string): { providers: number; users: number } {
    const list = this.db.popAcknowledgements.all().filter((a) => a.popCode === code);
    return {
      providers: list.filter((a) => a.personType === 'provider').length,
      users: list.filter((a) => a.personType === 'user').length,
    };
  }

  // ===== Riscos =====

  readonly risks = computed(() => rankRisks(this.db.risks.all()));
  readonly priorityCount = computed(() => this.risks().filter((r) => r.priority).length);

  /** Quem edita P, I e tratamento: gestão e RT (RN-RISCO-21). */
  readonly canEditRisks = computed(() => this.auth.can('governance', 'update'));

  updateRisk(
    id: ID,
    values: { probability: number; impact: number; treatment: string },
  ): ActionResult & { undo?: () => void } {
    const risk = this.db.risks.get(id);
    if (!risk) {
      return refuse('Esse risco não existe.');
    }
    if (!this.canEditRisks()) {
      return refuse('Só a gestão e o responsável técnico editam os riscos.');
    }
    const check = checkRiskEdit(values);
    if (!check.ok) {
      return refuse(Object.values(check.errors)[0] ?? 'Revise os campos.');
    }
    const previous = { probability: risk.probability, impact: risk.impact, treatment: risk.treatment };
    this.db.risks.update(id, {
      probability: values.probability as RiskScale,
      impact: values.impact as RiskScale,
      treatment: values.treatment.trim(),
    });
    this.audit.write('update', 'risk', id, undefined, `${risk.code}: probabilidade e impacto editados`);
    return {
      ok: true,
      undo: () => {
        this.db.risks.update(id, previous);
        this.audit.write('update', 'risk', id, undefined, `${risk.code}: edição desfeita`);
      },
    };
  }

  // ===== Encaminhamentos =====

  private caregiverOf(id: ID): Caregiver | undefined {
    return this.db.caregivers.get(id);
  }

  /** Nome de quem é da equipe Nexus (para "registrado por"). */
  userName(id: ID): string {
    return this.db.users.get(id)?.displayName ?? 'Equipe';
  }

  private isOwnCase(caregiver: Caregiver | undefined): boolean {
    const mine = this.auth.actor()?.psychologistId;
    return !!mine && caregiver?.assignedPsychologistId === mine;
  }

  /** O que o perfil vê dos encaminhamentos: linhas completas e a contagem das categorias restritas. */
  readonly referrals = computed(() => {
    const role = this.role();
    const rows: ReferralRow[] = [];
    const restrictedCounts = new Map<ReferralCategory, number>();
    if (!role) {
      return { rows, restrictedCounts };
    }
    [...this.db.referrals.all()]
      .sort((a, b) => b.at.localeCompare(a.at) || b.createdAt.localeCompare(a.createdAt))
      .forEach((referral) => {
        const caregiver = this.caregiverOf(referral.caregiverId);
        const visibility = referralVisibility(role, referral.category, this.isOwnCase(caregiver));
        if (visibility === 'full') {
          rows.push({
            referral,
            code: caregiver?.code ?? 'CUI-0000',
            byName: this.userName(referral.byUserId),
          });
        } else if (visibility === 'count_only') {
          restrictedCounts.set(referral.category, (restrictedCounts.get(referral.category) ?? 0) + 1);
        }
      });
    return { rows, restrictedCounts };
  });

  readonly canCreateReferral = computed(() => this.auth.can('governance', 'create'));

  /** Cuidador pelo código `CUI-0000` (a gestão só conhece o código). Só cadastro vivo. */
  caregiverByCode(code: string): Caregiver | undefined {
    const wanted = code.trim().toUpperCase();
    return this.db.caregivers.find(
      (c) => c.code === wanted && c.status !== 'closed' && !c.erasedAt && !c.anonymizedAt,
    );
  }

  createReferral(draft: {
    caregiverCode: string;
    category: ReferralCategory;
    destinations: string[];
    date: ISODate;
    outcome?: string;
    familyCommunicated?: boolean;
  }): ActionResult & { id?: ID } {
    if (!this.canCreateReferral()) {
      return refuse('Só a gestão e o responsável técnico registram encaminhamentos.');
    }
    const caregiver = this.caregiverByCode(draft.caregiverCode);
    if (!caregiver) {
      return refuse('Não encontramos esse código. Confira se ele tem o formato CUI-0000.');
    }
    const check = validateReferral(draft.category, draft.destinations, draft.familyCommunicated);
    if (!check.valid) {
      return refuse(check.errors[0] ?? 'Revise o encaminhamento.');
    }
    const userId = this.auth.user()?.id ?? '';
    const created = this.db.referrals.create({
      caregiverId: caregiver.id,
      category: draft.category,
      destinations: [...draft.destinations],
      at: draft.date,
      byUserId: userId,
      status: 'registered',
      ...(draft.outcome?.trim() ? { outcome: draft.outcome.trim() } : {}),
      ...(draft.familyCommunicated !== undefined ? { familyCommunicated: draft.familyCommunicated } : {}),
    } as Omit<Referral, 'id' | 'createdAt' | 'updatedAt'>);
    this.audit.write('create', 'referral', created.id, caregiver.id, 'encaminhamento registrado');
    return { ok: true, id: created.id };
  }

  /** O destino respondeu: registra o retorno e passa a "retorno recebido". */
  registerReferralReturn(id: ID, outcome: string): ActionResult {
    const referral = this.db.referrals.get(id);
    if (!referral) {
      return refuse('Esse encaminhamento não existe.');
    }
    if (!this.canCreateReferral()) {
      return refuse('Só a gestão e o responsável técnico atualizam encaminhamentos.');
    }
    if (outcome.trim().length < 5) {
      return refuse('Escreva o retorno do destino, com ao menos 5 caracteres.');
    }
    this.db.referrals.update(id, { status: 'acknowledged', outcome: outcome.trim() });
    this.audit.write('update', 'referral', id, referral.caregiverId, 'retorno do destino registrado');
    return OK;
  }

  closeReferral(id: ID): ActionResult {
    const referral = this.db.referrals.get(id);
    if (!referral) {
      return refuse('Esse encaminhamento não existe.');
    }
    if (!this.canCreateReferral()) {
      return refuse('Só a gestão e o responsável técnico encerram encaminhamentos.');
    }
    this.db.referrals.update(id, { status: 'closed' });
    this.audit.write('update', 'referral', id, referral.caregiverId, 'encaminhamento encerrado');
    return OK;
  }

  // ===== Ocorrências =====

  /** Ocorrências que o perfil pode ver: RT e psicólogo do caso (RN-ENC-11); gestão só vê contagem. */
  readonly occurrences = computed(() => {
    const actor = this.auth.actor();
    if (!actor) {
      return [] as Occurrence[];
    }
    if (actor.role === 'technical_lead') {
      return [...this.db.occurrences.all()];
    }
    if (actor.role === 'psychologist') {
      return this.db.occurrences.all().filter((o) => o.restrictedToUserIds.includes(actor.userId));
    }
    return [] as Occurrence[];
  });

  /** Contagens para a gestão (sem caso, sem código): por tipo, abertas e encerradas. */
  readonly occurrenceCounts = computed(() => {
    const all = this.db.occurrences.all();
    return {
      pop05: all.filter((o) => o.kind === 'pop05_risk').length,
      pop07: all.filter((o) => o.kind === 'pop07_violence_suspicion').length,
      open: all.filter((o) => o.status !== 'closed').length,
      closed: all.filter((o) => o.status === 'closed').length,
    };
  });

  occurrence(id: ID): Occurrence | undefined {
    const found = this.db.occurrences.get(id);
    const actor = this.auth.actor();
    if (!found || !actor) {
      return undefined;
    }
    const allowed =
      actor.role === 'technical_lead' ||
      (actor.role === 'psychologist' && found.restrictedToUserIds.includes(actor.userId));
    return allowed ? found : undefined;
  }

  /** Só o RT abre e encerra; o psicólogo do caso conduz os passos (RN-POP-14, matriz). */
  readonly canOpenOrClose = computed(() => this.role() === 'technical_lead');

  private canConduct(occurrence: Occurrence): boolean {
    const actor = this.auth.actor();
    return (
      !!actor &&
      (actor.role === 'technical_lead' || actor.role === 'psychologist') &&
      occurrence.restrictedToUserIds.includes(actor.userId)
    );
  }

  openOccurrence(draft: {
    kind: Occurrence['kind'];
    caregiverCode: string;
  }): ActionResult & { id?: ID } {
    if (!this.canOpenOrClose()) {
      return refuse('Só o responsável técnico abre ocorrências.');
    }
    const caregiver = this.caregiverByCode(draft.caregiverCode);
    if (!caregiver) {
      return refuse('Não encontramos esse código. Confira se ele tem o formato CUI-0000.');
    }
    const actor = this.auth.actor();
    const psychologistUser = caregiver.assignedPsychologistId
      ? this.db.users.find((u) => u.psychologistId === caregiver.assignedPsychologistId)
      : undefined;
    const restricted = [actor?.userId ?? '', ...(psychologistUser ? [psychologistUser.id] : [])].filter(
      (id, i, list) => id && list.indexOf(id) === i,
    );
    const elder = this.db.elders.find((e) => e.caregiverId === caregiver.id);
    const created = this.db.occurrences.create({
      kind: draft.kind,
      caregiverId: caregiver.id,
      ...(elder ? { elderId: elder.id } : {}),
      openedAt: this.clock.now(),
      status: 'open',
      restrictedToUserIds: restricted,
      steps: newOccurrenceSteps(draft.kind),
      authoritiesNotified: [],
    } as Omit<Occurrence, 'id' | 'createdAt' | 'updatedAt'>);
    this.audit.write('create', 'occurrence', created.id, caregiver.id, `ocorrência aberta (${draft.kind})`);
    return { ok: true, id: created.id };
  }

  /** Registra um passo com hora do relógio e responsável (RN-POP-05). */
  registerStep(id: ID, n: number, note: string): ActionResult {
    const occurrence = this.db.occurrences.get(id);
    if (!occurrence || !this.canConduct(occurrence)) {
      return refuse('Você não conduz esta ocorrência.');
    }
    if (occurrence.status === 'closed') {
      return refuse('Esta ocorrência já foi encerrada.');
    }
    const step = occurrence.steps.find((s) => s.n === n);
    if (!step) {
      return refuse('Esse passo não existe.');
    }
    if (step.doneAt) {
      return refuse('Esse passo já foi registrado.');
    }
    const userId = this.auth.user()?.id ?? '';
    const steps = occurrence.steps.map((s) =>
      s.n === n
        ? { ...s, doneAt: this.clock.now(), byUserId: userId, ...(note.trim() ? { note: note.trim() } : {}) }
        : s,
    );
    this.db.occurrences.update(id, { steps, status: occurrenceStatusAfterStep(steps) });
    this.audit.write('update', 'occurrence', id, occurrence.caregiverId, `passo ${n} registrado`);
    return OK;
  }

  /** Comunicação a um órgão (POP-07, RN-ENC-05): órgão da lista, data e protocolo. */
  registerAuthority(id: ID, index: number | null, body: string, date: ISODate, protocol: string): ActionResult {
    const occurrence = this.db.occurrences.get(id);
    if (!occurrence || !this.canConduct(occurrence)) {
      return refuse('Você não conduz esta ocorrência.');
    }
    if (occurrence.status === 'closed') {
      return refuse('Esta ocorrência já foi encerrada.');
    }
    if (!date) {
      return refuse('Informe a data da comunicação.');
    }
    const entry = { body, at: date, ...(protocol.trim() ? { protocol: protocol.trim() } : {}) };
    const list = [...occurrence.authoritiesNotified];
    if (index !== null && list[index]) {
      list[index] = entry;
    } else {
      list.push(entry);
    }
    this.db.occurrences.update(id, { authoritiesNotified: list });
    this.audit.write('update', 'occurrence', id, occurrence.caregiverId, 'comunicação a órgão registrada');
    return OK;
  }

  closeOccurrence(id: ID): ActionResult {
    const occurrence = this.db.occurrences.get(id);
    if (!occurrence || !this.canOpenOrClose()) {
      return refuse('Só o responsável técnico encerra ocorrências.');
    }
    const status = occurrenceClosureStatus(occurrence);
    if (!status.ok) {
      return refuse('Ainda faltam passos ou a comunicação aos órgãos para encerrar.');
    }
    this.db.occurrences.update(id, { status: 'closed' });
    this.audit.write('update', 'occurrence', id, occurrence.caregiverId, 'ocorrência encerrada');
    return OK;
  }

  // ===== Formação =====

  readonly trainingEvents = computed(() =>
    [...this.db.trainingEvents.all()].sort((a, b) => b.date.localeCompare(a.date)),
  );
  readonly canEditTraining = computed(() => this.auth.can('governance', 'update'));

  /** Nome de quem participa: prestador pelo nome da rede, equipe pelo nome de usuário. */
  personName(type: 'provider' | 'user', id: ID): string {
    return type === 'provider'
      ? (this.db.providers.get(id)?.name ?? 'Prestador')
      : (this.db.users.get(id)?.displayName ?? 'Equipe');
  }

  /** Status de integração de cada prestador credenciado ou candidato (RN-CAP-02, 07). */
  readonly integrationStatus = computed<TrainingStatusRow[]>(() =>
    this.db.providers
      .all()
      .filter((p) => p.status !== 'rejected' && p.status !== 'deaccredited')
      .map((p) => ({
        personType: 'provider' as const,
        personId: p.id,
        name: p.name,
        status: p.integrationDoneAt ? ('done' as const) : ('pending' as const),
      }))
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.name.localeCompare(b.name, 'pt-BR')),
  );

  /** Status de formação da equipe: fez a formação da gestão (ou dos grupos, para psicólogos)? */
  readonly teamStatus = computed<TrainingStatusRow[]>(() => {
    const events = this.db.trainingEvents.all();
    const present = (userId: ID, fronts: TrainingEvent['front'][]): boolean =>
      events.some(
        (e) =>
          fronts.includes(e.front) &&
          e.attendees.some((a) => a.personType === 'user' && a.personId === userId && a.present),
      );
    return this.db.users
      .all()
      .filter((u) => u.role !== 'provider' && u.active)
      .map((u) => ({
        personType: 'user' as const,
        personId: u.id,
        name: u.displayName,
        status: present(u.id, u.role === 'psychologist' ? ['group_professionals', 'management'] : ['management'])
          ? ('done' as const)
          : ('pending' as const),
      }));
  });

  createTrainingEvent(draft: {
    front: TrainingEvent['front'];
    title: string;
    date: ISODate;
    attendees: { personType: 'provider' | 'user'; personId: ID }[];
  }): ActionResult & { id?: ID } {
    if (!this.canEditTraining()) {
      return refuse('Só a gestão e o responsável técnico criam eventos de formação.');
    }
    if (draft.title.trim().length < 3) {
      return refuse('Informe o título do evento.');
    }
    if (draft.attendees.length === 0) {
      return refuse('Escolha ao menos uma pessoa para convidar.');
    }
    const created = this.db.trainingEvents.create({
      front: draft.front,
      title: draft.title.trim(),
      date: draft.date,
      attendees: draft.attendees.map((a) => ({ ...a, present: false })),
    } as Omit<TrainingEvent, 'id' | 'createdAt' | 'updatedAt'>);
    this.audit.write('create', 'training_event', created.id, undefined, 'evento de formação criado');
    return { ok: true, id: created.id };
  }

  /**
   * Marca presença. Só em evento que já aconteceu (data de hoje ou antes). Presente em integração de credenciados
   * conclui a integração do prestador (RN-CAP-02, RN-REDE-24).
   */
  setAttendance(eventId: ID, index: number, present: boolean): ActionResult {
    const event = this.db.trainingEvents.get(eventId);
    if (!event || !this.canEditTraining()) {
      return refuse('Só a gestão e o responsável técnico registram presença.');
    }
    if (event.date > this.clock.today()) {
      return refuse('A presença só pode ser registrada a partir do dia do evento.');
    }
    const attendee = event.attendees[index];
    if (!attendee) {
      return refuse('Essa pessoa não está na lista do evento.');
    }
    const attendees = event.attendees.map((a, i) => (i === index ? { ...a, present } : a));
    this.db.trainingEvents.update(eventId, { attendees });
    if (event.front === 'provider_integration' && attendee.personType === 'provider') {
      const provider = this.db.providers.get(attendee.personId);
      if (provider && present && !provider.integrationDoneAt) {
        this.db.providers.update(provider.id, { integrationDoneAt: event.date });
      }
    }
    this.audit.write('update', 'training_event', eventId, undefined, 'presença registrada');
    return OK;
  }

  // ===== Conteúdos de orientação (POP-09) =====

  readonly contents = computed(() =>
    [...this.db.guidanceContents.all()].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
  );
  readonly contentsInReviewCount = computed(
    () => this.db.guidanceContents.all().filter((c) => c.status === 'in_review').length,
  );
  readonly canEditContents = computed(() => this.auth.can('governance', 'update'));
  /** Só o RT publica (RN-POP-09). */
  readonly canPublishContents = computed(() => this.role() === 'technical_lead');

  saveContent(
    id: ID | null,
    values: { title: string; body: string; exclusive: boolean },
  ): ActionResult & { id?: ID } {
    if (!this.canEditContents()) {
      return refuse('Só a gestão e o responsável técnico editam os conteúdos.');
    }
    if (values.title.trim().length < 3) {
      return refuse('Informe o título do conteúdo.');
    }
    if (values.body.trim().length < 10) {
      return refuse('Escreva o texto do conteúdo, com ao menos 10 caracteres.');
    }
    if (id) {
      const current = this.db.guidanceContents.get(id);
      if (!current) {
        return refuse('Esse conteúdo não existe.');
      }
      if (current.status === 'published') {
        return refuse('Conteúdo publicado só muda depois de voltar a rascunho.');
      }
      this.db.guidanceContents.update(id, {
        title: values.title.trim(),
        body: values.body.trim(),
        exclusive: values.exclusive,
      });
      this.audit.write('update', 'guidance_content', id, undefined, 'conteúdo editado');
      return { ok: true, id };
    }
    const created = this.db.guidanceContents.create({
      title: values.title.trim(),
      body: values.body.trim(),
      exclusive: values.exclusive,
      status: 'draft',
    } as Omit<GuidanceContent, 'id' | 'createdAt' | 'updatedAt'>);
    this.audit.write('create', 'guidance_content', created.id, undefined, 'conteúdo criado');
    return { ok: true, id: created.id };
  }

  sendToReview(id: ID): ActionResult {
    const content = this.db.guidanceContents.get(id);
    if (!content || !this.canEditContents()) {
      return refuse('Só a gestão e o responsável técnico enviam conteúdo para revisão.');
    }
    if (content.status !== 'draft') {
      return refuse('Só rascunho vai para revisão.');
    }
    this.db.guidanceContents.update(id, { status: 'in_review' });
    this.audit.write('update', 'guidance_content', id, undefined, 'enviado para revisão');
    return OK;
  }

  /** Publica com a aprovação do RT e a data (RN-POP-09). `partner` nunca publica (AC-M13-11). */
  approve(id: ID): ActionResult {
    const content = this.db.guidanceContents.get(id);
    if (!content) {
      return refuse('Esse conteúdo não existe.');
    }
    if (!this.canPublishContents()) {
      return refuse('Só o responsável técnico aprova e publica conteúdos.');
    }
    if (content.status !== 'in_review') {
      return refuse('Só conteúdo em revisão pode ser publicado.');
    }
    this.db.guidanceContents.update(id, {
      status: 'published',
      approvedByUserId: this.auth.user()?.id ?? '',
      approvedAt: this.clock.today(),
    });
    this.audit.write('update', 'guidance_content', id, undefined, 'conteúdo aprovado e publicado');
    return OK;
  }

  backToDraft(id: ID): ActionResult {
    const content = this.db.guidanceContents.get(id);
    if (!content) {
      return refuse('Esse conteúdo não existe.');
    }
    if (!this.canPublishContents()) {
      return refuse('Só o responsável técnico devolve conteúdo a rascunho.');
    }
    this.db.guidanceContents.update(id, {
      status: 'draft',
      approvedByUserId: undefined,
      approvedAt: undefined,
    });
    this.audit.write('update', 'guidance_content', id, undefined, 'devolvido a rascunho');
    return OK;
  }

  // ===== Normas =====

  readonly norms = computed(() => [...this.db.norms.all()]);

  /** "Vigência confirmada em": data em que alguém conferiu no site do CFP (RN-ETICA-17). */
  confirmNorm(id: ID, date: ISODate | null): ActionResult & { undo?: () => void } {
    const norm = this.db.norms.get(id);
    if (!norm) {
      return refuse('Essa norma não existe.');
    }
    if (!this.auth.can('governance', 'update')) {
      return refuse('Só a gestão e o responsável técnico confirmam a vigência.');
    }
    if (date && date > this.clock.today()) {
      return refuse('A data da conferência não pode ser no futuro.');
    }
    const previous: ISODate | undefined = norm.confirmedInForceAt;
    const patch: Partial<NormReference> = date ? { confirmedInForceAt: date } : {};
    if (date) {
      this.db.norms.update(id, patch);
    } else {
      // Limpar a confirmação: regrava a norma sem o campo.
      const { confirmedInForceAt: _removed, ...rest } = norm;
      void _removed;
      this.db.norms.upsert(rest as NormReference);
    }
    this.audit.write('update', 'norm', id, undefined, date ? 'vigência confirmada' : 'confirmação removida');
    return {
      ok: true,
      undo: () => {
        if (previous) {
          this.db.norms.update(id, { confirmedInForceAt: previous });
        } else {
          const current = this.db.norms.get(id) as NormReference;
          const { confirmedInForceAt: _gone, ...rest } = current;
          void _gone;
          this.db.norms.upsert(rest as NormReference);
        }
        this.audit.write('update', 'norm', id, undefined, 'confirmação desfeita');
      },
    };
  }

  // ===== Resumo para a visão geral =====

  readonly summary = computed(() => ({
    popsToReview: this.popsToReviewCount(),
    priorityRisks: this.priorityCount(),
    referrals: this.db.referrals.size(),
    contentsInReview: this.contentsInReviewCount(),
  }));

  riskByCode(code: string): RiskItem | undefined {
    return this.db.risks.find((r) => r.code === code);
  }
}
