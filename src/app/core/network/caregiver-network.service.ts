import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { CaregiverOwnership, NOT_OWNER_TEXT } from '../auth/caregiver-ownership';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import {
  ID,
  ISODate,
  Provider,
  ProviderCategory,
  ProviderEvaluation,
  Rating,
  ServiceRequest,
} from '../models';
import {
  ARP_MIN_EVALUATIONS,
  evaluationEditableUntil,
  evaluationScore,
  isSearchable,
  providerAverage,
} from '../rules/arp';
import { FREE_TEXT_MAX_CHARS, isTooLong, tooLongText } from '../rules/text-limits';
import {
  evaluationProblem,
  isEvaluationEditable,
  isRequestOpen,
  providerAcceptsAppRequests,
  serviceRequestProblem,
} from '../rules/service-requests';

export type CaregiverResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: 'need' | 'modality' | 'technical' | 'punctuality' };

/**
 * O profissional como o CUIDADOR o vê (RN-REDE-19, 30, RN-ARP-04, RN-ARP-18): nome, especialidade, cidade, registro,
 * se atende em casa, as condições para quem é da Nexus, o telefone, "em destaque" e a nota (só com 5 avaliações ou mais).
 * NÃO existe aqui faixa de monitoramento, taxa de recusa, comissão, disponibilidade, reclamação grave nem documento:
 * quem monta a tela não consegue vazar o que o tipo não carrega.
 */
export interface ProviderPublicView {
  id: ID;
  name: string;
  category: ProviderCategory;
  specialtyLabel: string;
  city: string;
  homeCare: boolean;
  /** Zona de excelência: aparece primeiro, mas nunca tira os outros da lista (RN-REDE-19). */
  highlight: boolean;
  /** Texto do prestador sobre as condições para quem é da Nexus (só se mostra do Essencial em diante). */
  conditions: string;
  /** "CREFITO-MG 00001-F (fictício)"; `null` quando não há conselho. */
  councilLabel: string | null;
  phone: string;
  /** Média das duas notas; `null` com menos de 5 avaliações. */
  average: number | null;
  evaluationCount: number;
  /** O pedido pode sair pelo aplicativo (cláusula de proteção de dados assinada, S-19). */
  canRequest: boolean;
}

/** A avaliação do próprio cuidador, para mostrar e corrigir. Nunca traz avaliação de outra pessoa. */
export interface OwnEvaluationView {
  id: ID;
  technical: Rating;
  punctuality: Rating;
  comment?: string;
  /** Último dia para corrigir (7 dias depois de enviar, RN-ARP-16). */
  editableUntil: ISODate;
  canEdit: boolean;
}

/** Um pedido do cuidador com o que a tela precisa para mostrá-lo. */
export interface OrderView {
  request: ServiceRequest;
  providerName: string;
  /** O profissional ainda aparece na busca (se não, a tela mostra o nome mas não leva à ficha). */
  providerSearchable: boolean;
  evaluation?: OwnEvaluationView;
}

export interface SearchOptions {
  category?: ProviderCategory | null;
  /** Texto do nome (sem acento e sem diferenciar maiúscula). */
  name?: string;
  homeOnly?: boolean;
}

export interface RequestInput {
  providerId: ID;
  need: string;
  modality: ServiceRequest['modality'] | null;
}

export interface EvaluationInput {
  technical: number | null;
  punctuality: number | null;
  comment?: string;
}

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function fail<T>(error: string, field?: 'need' | 'modality' | 'technical' | 'punctuality'): CaregiverResult<T> {
  return { ok: false, error, ...(field ? { field } : {}) };
}

/**
 * A rede credenciada vista pelo cuidador: busca, ficha, pedidos e avaliação (RN-REDE-10, 17, 18, 19, 25, 26, 30,
 * RN-ARP-02, 04, 16, RN-LGPD-13). Usa as mesmas regras puras da equipe (`rules/service-requests.ts`, `rules/arp.ts`),
 * mas as respostas vão na voz do cuidador e a checagem de perfil é a de dono do próprio pedido, não a da equipe.
 *
 * - Só prestador ativo ou em monitoramento aparece (RN-REDE-18). O de monitoramento aparece como qualquer outro.
 * - A ordem é "em destaque primeiro, depois alfabética" (S-08): a Nexus não indica "o melhor" (RN-ATD-13).
 * - Ao prestador só vão nome, contato e o que a pessoa precisa: o pedido não carrega dado de saúde (RN-LGPD-13).
 * - A resposta do prestador é registrada pela equipe (ele não tem login).
 */
@Injectable({ providedIn: 'root' })
export class CaregiverNetworkService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly ownership = inject(CaregiverOwnership);

  // ===== Busca e ficha =====

  /** Todos os profissionais que aparecem na busca, em destaque primeiro e depois por nome. */
  searchable(): ProviderPublicView[] {
    return this.db.providers
      .query((p) => isSearchable(p.status))
      .map((p) => this.toView(p))
      .sort((a, b) => (a.highlight === b.highlight ? 0 : a.highlight ? -1 : 1) || a.name.localeCompare(b.name, 'pt-BR'));
  }

  /** Resultado da busca por necessidade e/ou nome; sem filtro nenhum devolve vazio (a tela pede a necessidade). */
  search(options: SearchOptions): ProviderPublicView[] {
    const name = plain(options.name ?? '');
    if (!options.category && !name) {
      return [];
    }
    return this.searchable().filter(
      (p) =>
        (!options.category || p.category === options.category) &&
        (!name || plain(p.name).includes(name)) &&
        (!options.homeOnly || p.homeCare),
    );
  }

  /** Quantos aparecem em cada necessidade (a contagem do cabeçalho da lista). */
  countIn(category: ProviderCategory): number {
    return this.db.providers.count((p) => p.category === category && isSearchable(p.status));
  }

  /** A ficha; `undefined` para quem não existe ou não aparece na busca (a tela não diz qual dos dois, RN-REDE-18). */
  viewOf(providerId: ID): ProviderPublicView | undefined {
    const provider = this.db.providers.get(providerId);
    return provider && isSearchable(provider.status) ? this.toView(provider) : undefined;
  }

  private toView(provider: Provider): ProviderPublicView {
    const evaluations = this.db.providerEvaluations.query((e) => e.providerId === provider.id);
    const council = provider.council;
    const councilLabel =
      council.body === 'NONE' || !council.number
        ? null
        : `${council.body}${council.state ? `-${council.state}` : ''} ${council.number}${council.fictitious ? ' (fictício)' : ''}`;
    return {
      id: provider.id,
      name: provider.name,
      category: provider.category,
      specialtyLabel: provider.specialtyLabel,
      city: provider.city,
      homeCare: provider.homeCare,
      highlight: provider.highlight,
      conditions: provider.conditionsForNexusUsers,
      councilLabel,
      phone: provider.phone,
      average: evaluations.length >= ARP_MIN_EVALUATIONS ? providerAverage(evaluations) : null,
      evaluationCount: evaluations.length,
      canRequest: providerAcceptsAppRequests(provider),
    };
  }

  // ===== Pedidos =====

  /** Os pedidos do cuidador, do mais recente para o mais antigo. */
  requestsOf(caregiverId: ID): ServiceRequest[] {
    if (!this.ownership.ownsCaregiver(caregiverId)) {
      return [];
    }
    return this.db.serviceRequests
      .query((r) => r.caregiverId === caregiverId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id.localeCompare(a.id));
  }

  /** Os pedidos com o nome do profissional e a avaliação do próprio cuidador. */
  ordersOf(caregiverId: ID): OrderView[] {
    return this.requestsOf(caregiverId).map((request) => {
      const provider = this.db.providers.get(request.providerId);
      const evaluation = request.evaluationId ? this.db.providerEvaluations.get(request.evaluationId) : undefined;
      return {
        request,
        providerName: provider?.name ?? 'Profissional da rede',
        providerSearchable: !!provider && isSearchable(provider.status),
        ...(evaluation ? { evaluation: this.toOwnEvaluation(evaluation) } : {}),
      };
    });
  }

  /** O pedido em andamento (enviado ou aceito) com este profissional, se houver. */
  openRequestWith(caregiverId: ID, providerId: ID): ServiceRequest | undefined {
    return this.requestsOf(caregiverId).find((r) => r.providerId === providerId && isRequestOpen(r.status));
  }

  /** Pedidos que esperam a resposta do profissional (a frase da porta de Rede). */
  awaitingCount(caregiverId: ID): number {
    return this.requestsOf(caregiverId).filter((r) => r.status === 'requested').length;
  }

  /** Serviços concluídos que ainda esperam a avaliação do cuidador. */
  toEvaluateCount(caregiverId: ID): number {
    return this.requestsOf(caregiverId).filter((r) => r.status === 'completed' && !r.evaluationId).length;
  }

  /**
   * Cria o pedido (`requested`). Confere o profissional, a cláusula de proteção de dados (S-19), a necessidade, o
   * local e se já não há um pedido em andamento com ele. NADA de saúde, pontuação, atendimento ou grupo vai no pedido.
   */
  createRequest(caregiverId: ID, input: RequestInput): CaregiverResult<ServiceRequest> {
    if (!this.ownership.ownsCaregiver(caregiverId)) {
      return fail(NOT_OWNER_TEXT);
    }
    const caregiver = this.db.caregivers.get(caregiverId);
    if (!caregiver || caregiver.status === 'closed') {
      return fail('Entre no aplicativo para pedir um serviço.');
    }
    const provider = this.db.providers.get(input.providerId);
    const problem = serviceRequestProblem(provider, input.need, input.modality);
    if (problem === 'no_provider' || problem === 'not_searchable' || !provider) {
      return fail('Não encontramos este profissional.');
    }
    if (!providerAcceptsAppRequests(provider)) {
      return fail('No momento não é possível pedir este profissional pelo app. A equipe pode ajudar.');
    }
    if (problem === 'no_need') {
      return fail('Conte em uma frase o que você precisa.', 'need');
    }
    if (isTooLong(input.need, FREE_TEXT_MAX_CHARS)) {
      return fail(tooLongText(FREE_TEXT_MAX_CHARS), 'need');
    }
    if (!input.modality) {
      return fail('Escolha onde você quer ser atendido.', 'modality');
    }
    if (problem === 'home_not_offered') {
      return fail('Este profissional não atende em casa. Escolha o atendimento no local do profissional.', 'modality');
    }
    if (this.openRequestWith(caregiverId, provider.id)) {
      return fail('Você já tem um pedido em andamento com este profissional.');
    }
    const created = this.db.serviceRequests.create({
      caregiverId,
      providerId: provider.id,
      specialty: provider.category,
      need: input.need.trim(),
      modality: input.modality,
      status: 'requested',
      requestedAt: this.clock.now(),
    });
    this.audit.write('create', 'service_request', created.id, caregiverId, 'pedido feito pelo cuidador no aplicativo');
    return { ok: true, value: created };
  }

  /** O cuidador cancela o pedido enquanto estiver enviado ou aceito (RN-REDE-26). */
  cancelRequest(caregiverId: ID, requestId: ID): CaregiverResult<ServiceRequest> {
    const request = this.db.serviceRequests.get(requestId);
    if (!request || request.caregiverId !== caregiverId || !this.ownership.ownsCaregiver(caregiverId)) {
      return fail('Não encontramos este pedido.');
    }
    if (!isRequestOpen(request.status)) {
      return fail('Este pedido não pode mais ser cancelado.');
    }
    const updated = this.db.serviceRequests.update(requestId, {
      status: 'cancelled_by_user',
      reason: 'Cancelado pelo cuidador no aplicativo.',
      respondedAt: request.respondedAt ?? this.clock.now(),
    });
    this.audit.write('update', 'service_request', requestId, caregiverId, 'pedido cancelado pelo cuidador');
    return { ok: true, value: updated };
  }

  // ===== Avaliação =====

  /** Duas notas de 1 a 5, comentário opcional, uma avaliação por serviço concluído (RN-ARP-02). */
  evaluate(caregiverId: ID, requestId: ID, input: EvaluationInput): CaregiverResult<OwnEvaluationView> {
    const request = this.db.serviceRequests.get(requestId);
    if (!request || request.caregiverId !== caregiverId || !this.ownership.ownsCaregiver(caregiverId)) {
      return fail('Não encontramos este serviço.');
    }
    const problem = evaluationProblem(request, input.technical, input.punctuality);
    if (problem === 'bad_technical') {
      return fail('Escolha a nota do serviço.', 'technical');
    }
    if (problem === 'bad_punctuality') {
      return fail('Escolha a nota da pontualidade e do atendimento.', 'punctuality');
    }
    if (problem === 'already_evaluated') {
      return fail('Este serviço já foi avaliado. Você pode corrigir a avaliação em até 7 dias.');
    }
    if (problem === 'not_completed') {
      return fail('Só dá para avaliar um serviço concluído.');
    }
    if (isTooLong(input.comment ?? '', FREE_TEXT_MAX_CHARS)) {
      return fail(tooLongText(FREE_TEXT_MAX_CHARS));
    }
    const technical = input.technical as Rating;
    const punctuality = input.punctuality as Rating;
    const comment = input.comment?.trim();
    const evaluation = this.db.providerEvaluations.create({
      serviceRequestId: request.id,
      providerId: request.providerId,
      caregiverId,
      technicalQuality: technical,
      punctualityCourtesy: punctuality,
      ...(comment ? { comment } : {}),
      score: evaluationScore(technical, punctuality),
      editableUntil: evaluationEditableUntil(this.clock.today()),
    });
    this.db.serviceRequests.update(request.id, { status: 'evaluated', evaluationId: evaluation.id });
    this.audit.write('create', 'provider_evaluation', evaluation.id, caregiverId, 'avaliação enviada pelo cuidador');
    return { ok: true, value: this.toOwnEvaluation(evaluation) };
  }

  /** O cuidador corrige a própria avaliação em até 7 dias (RN-ARP-16). */
  correctEvaluation(caregiverId: ID, requestId: ID, input: EvaluationInput): CaregiverResult<OwnEvaluationView> {
    const request = this.db.serviceRequests.get(requestId);
    const evaluation = request?.evaluationId ? this.db.providerEvaluations.get(request.evaluationId) : undefined;
    if (!request || request.caregiverId !== caregiverId || !evaluation || !this.ownership.ownsCaregiver(caregiverId)) {
      return fail('Não encontramos esta avaliação.');
    }
    if (!isEvaluationEditable(evaluation, this.clock.today())) {
      return fail('Prazo de correção encerrado.');
    }
    // Reaproveita a conferência das notas: como já foi avaliado, só as duas primeiras respostas interessam aqui.
    const problem = evaluationProblem({ status: 'completed' }, input.technical, input.punctuality);
    if (problem === 'bad_technical') {
      return fail('Escolha a nota do serviço.', 'technical');
    }
    if (problem === 'bad_punctuality') {
      return fail('Escolha a nota da pontualidade e do atendimento.', 'punctuality');
    }
    if (isTooLong(input.comment ?? '', FREE_TEXT_MAX_CHARS)) {
      return fail(tooLongText(FREE_TEXT_MAX_CHARS));
    }
    const technical = input.technical as Rating;
    const punctuality = input.punctuality as Rating;
    const comment = input.comment?.trim();
    const updated = this.db.providerEvaluations.update(evaluation.id, {
      technicalQuality: technical,
      punctualityCourtesy: punctuality,
      comment: comment ? comment : undefined,
      score: evaluationScore(technical, punctuality),
    });
    this.audit.write('update', 'provider_evaluation', evaluation.id, caregiverId, 'avaliação corrigida pelo cuidador');
    return { ok: true, value: this.toOwnEvaluation(updated) };
  }

  private toOwnEvaluation(evaluation: ProviderEvaluation): OwnEvaluationView {
    return {
      id: evaluation.id,
      technical: evaluation.technicalQuality,
      punctuality: evaluation.punctualityCourtesy,
      ...(evaluation.comment ? { comment: evaluation.comment } : {}),
      editableUntil: evaluation.editableUntil,
      canEdit: isEvaluationEditable(evaluation, this.clock.today()),
    };
  }
}
