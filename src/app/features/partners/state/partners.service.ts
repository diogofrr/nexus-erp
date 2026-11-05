import { Injectable, computed, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import type {
  AccessLogEntry,
  CardUsage,
  ID,
  Partner,
  PartnerCategory,
  PartnerRemuneration,
  PartnerStatus,
} from '@core/models';
import { validateDiscountPercent, validateFictitiousEmail } from '@core/rules';
import {
  PARTNER_CATEGORY_LABEL,
  PARTNER_STATUS_LABEL,
  REMUNERATION_LABEL,
} from './partner-labels';
import {
  MoveCheck,
  ValidationKind,
  checkPartnerMove,
  modelChangeSendsBackToReview,
  remunerationNeedsValidation,
} from './partner-rules';

export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; message: string };

/** Dados do formulário de parceiro (criar e editar). */
export interface PartnerInput {
  name: string;
  category: PartnerCategory;
  city: string;
  contactName: string;
  contactEmail: string;
  /** 0 a 100, uma casa decimal. */
  discountPercent: number;
  model: PartnerRemuneration['model'];
  notes: string;
}

export interface UsageTotals {
  uses: number;
  amountCents: number;
  discountCents: number;
}

export interface OverallUsage extends UsageTotals {
  /** Quem mais usa o cartão, só pelo código pseudonimizado. */
  top: { code: string; uses: number }[];
}

export interface PartnerHistoryEntry {
  id: string;
  at: string;
  title: string;
  text?: string;
}

/**
 * Parceiros do Cartão Nexus (M09, POP-03): cria, edita, move no funil e registra a validação jurídica e
 * ética. Tudo grava pelo `Database`, e cada mudança vai ao log (o histórico da ficha lê dele).
 * Só quem pode escrever em `partners_corporate` (a gestão) usa os métodos de escrita; o atendimento só lê.
 */
@Injectable({ providedIn: 'root' })
export class PartnersService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);

  readonly partners = this.db.partners.all;
  readonly canWrite = computed(() => this.auth.can('partners_corporate', 'update'));
  readonly activeCount = computed(
    () => this.db.partners.all().filter((p) => p.status === 'active').length,
  );

  // ===== Leitura =====

  /** Data de hoje (do `Clock`). */
  today(): string {
    return this.clock.today();
  }

  get(id: ID): Partner | undefined {
    return this.db.partners.get(id);
  }

  /** Usos do cartão no parceiro, do mais recente para o mais antigo. */
  usagesOf(partnerId: ID): CardUsage[] {
    return this.db.cardUsages
      .all()
      .filter((u) => u.partnerId === partnerId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  totalsOf(partnerId: ID): UsageTotals {
    const usages = this.usagesOf(partnerId);
    return {
      uses: usages.length,
      amountCents: usages.reduce((s, u) => s + u.amountCents, 0),
      discountCents: usages.reduce((s, u) => s + u.discountCents, 0),
    };
  }

  /** Uso do cartão em todos os parceiros (RN-CRT-11): totais e os códigos que mais usam. */
  overallUsage(): OverallUsage {
    const usages = this.db.cardUsages.all();
    const byCode = new Map<string, number>();
    usages.forEach((u) => {
      const code = this.codeOfCard(u.cardId);
      byCode.set(code, (byCode.get(code) ?? 0) + 1);
    });
    const top = [...byCode.entries()]
      .map(([code, uses]) => ({ code, uses }))
      .sort((a, b) => b.uses - a.uses || a.code.localeCompare(b.code))
      .slice(0, 3);
    return {
      uses: usages.length,
      amountCents: usages.reduce((s, u) => s + u.amountCents, 0),
      discountCents: usages.reduce((s, u) => s + u.discountCents, 0),
      top,
    };
  }

  /** Código pseudonimizado de quem usou o cartão (a gestão e o atendimento veem só o código, LP-08). */
  codeOfCard(cardId: ID): string {
    const card = this.db.benefitCards.get(cardId);
    const caregiver = card ? this.db.caregivers.get(card.caregiverId) : undefined;
    return caregiver?.code ?? 'CUI-0000';
  }

  /** Eventos da ficha: o que está nos registros mais o que foi feito aqui (log). */
  historyOf(partnerId: ID): PartnerHistoryEntry[] {
    const partner = this.db.partners.get(partnerId);
    if (!partner) {
      return [];
    }
    const entries: PartnerHistoryEntry[] = [
      { id: 'created', at: partner.createdAt, title: 'Parceiro cadastrado' },
    ];
    if (partner.remuneration.legalValidatedAt) {
      entries.push({
        id: 'legal',
        at: `${partner.remuneration.legalValidatedAt}T09:00:00-03:00`,
        title: 'Validação jurídica registrada',
      });
    }
    if (partner.remuneration.ethicsValidatedAt) {
      entries.push({
        id: 'ethics',
        at: `${partner.remuneration.ethicsValidatedAt}T09:00:00-03:00`,
        title: 'Validação ética registrada',
      });
    }
    this.db.accessLog
      .all()
      .filter(
        (e: AccessLogEntry) =>
          e.entity === 'partner' && e.entityId === partnerId && e.action === 'update',
      )
      .forEach((e) => {
        entries.push({
          id: e.id,
          at: e.at,
          title: 'Alteração registrada',
          ...(e.detail ? { text: e.detail } : {}),
        });
      });
    return entries.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  }

  /** O que falta (ou pode) para cada passo, para o texto ao lado do botão. */
  moveCheck(partner: Partner, to: PartnerStatus): MoveCheck {
    return checkPartnerMove(partner, to);
  }

  nameTaken(name: string, exceptId?: ID): boolean {
    const wanted = name.trim().toLowerCase();
    return this.db.partners
      .all()
      .some((p) => p.id !== exceptId && p.name.trim().toLowerCase() === wanted);
  }

  // ===== Escrita =====

  create(input: PartnerInput): ActionResult<Partner> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const invalid = this.validate(input);
    if (invalid) {
      return { ok: false, message: invalid };
    }
    if (this.nameTaken(input.name)) {
      return { ok: false, message: 'Já existe um parceiro com este nome.' };
    }
    const partner = this.db.partners.create({
      name: input.name.trim(),
      category: input.category,
      status: 'prospect',
      discountPercent: input.discountPercent,
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim(),
      city: input.city.trim(),
      remuneration: this.remunerationOf(input.model, input.notes),
    });
    this.audit.write('create', 'partner', partner.id, undefined, 'parceiro cadastrado em Prospecção');
    return { ok: true, value: partner };
  }

  /**
   * Edita os dados. Trocar o modelo de remuneração apaga as validações do modelo anterior e, num parceiro
   * ativo ou suspenso, devolve-o à validação jurídica e ética (RN-CRT-06). Devolve `movedBack` nesse caso.
   */
  update(id: ID, input: PartnerInput): ActionResult<{ partner: Partner; movedBack: boolean }> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const current = this.db.partners.get(id);
    if (!current) {
      return { ok: false, message: 'Não encontramos este parceiro.' };
    }
    if (current.status === 'ended') {
      return { ok: false, message: 'Parceria encerrada não recebe alterações.' };
    }
    const invalid = this.validate(input);
    if (invalid) {
      return { ok: false, message: invalid };
    }
    if (this.nameTaken(input.name, id)) {
      return { ok: false, message: 'Já existe um parceiro com este nome.' };
    }
    const modelChanged = current.remuneration.model !== input.model;
    const movedBack = modelChangeSendsBackToReview(
      current.status,
      current.remuneration.model,
      input.model,
    );
    const remuneration = modelChanged
      ? this.remunerationOf(input.model, input.notes)
      : this.remunerationOf(input.model, input.notes, current.remuneration);
    const partner = this.db.partners.update(id, {
      name: input.name.trim(),
      category: input.category,
      city: input.city.trim(),
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim(),
      discountPercent: input.discountPercent,
      remuneration,
      ...(movedBack ? { status: 'legal_ethics_review' as PartnerStatus } : {}),
    });
    const changes: string[] = ['dados atualizados'];
    if (modelChanged) {
      changes.push(`remuneração: ${REMUNERATION_LABEL[input.model].toLowerCase()}`);
    }
    if (movedBack) {
      changes.push('voltou à validação jurídica e ética');
    }
    if (current.discountPercent !== input.discountPercent) {
      changes.push(`desconto: ${String(input.discountPercent).replace('.', ',')}%`);
    }
    this.audit.write('update', 'partner', id, undefined, changes.join('; '));
    return { ok: true, value: { partner, movedBack } };
  }

  /** Move no funil. Ativar exige "sem remuneração" ou as duas validações (RN-CRT-06). */
  moveTo(id: ID, to: PartnerStatus): ActionResult<Partner> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const current = this.db.partners.get(id);
    if (!current) {
      return { ok: false, message: 'Não encontramos este parceiro.' };
    }
    const check = checkPartnerMove(current, to);
    if (!check.ok) {
      return { ok: false, message: check.message };
    }
    const partner = this.db.partners.update(id, { status: to });
    this.audit.write(
      'update',
      'partner',
      id,
      undefined,
      `de ${PARTNER_STATUS_LABEL[current.status]} para ${PARTNER_STATUS_LABEL[to]}`,
    );
    return { ok: true, value: partner };
  }

  /** Marca ou desmarca a validação jurídica ou ética. A data vem do `Clock`. */
  setValidation(id: ID, kind: ValidationKind, done: boolean): ActionResult<Partner> {
    const denied = this.deny();
    if (denied) {
      return denied;
    }
    const current = this.db.partners.get(id);
    if (!current) {
      return { ok: false, message: 'Não encontramos este parceiro.' };
    }
    if (current.status === 'ended') {
      return { ok: false, message: 'Parceria encerrada não recebe alterações.' };
    }
    if (!remunerationNeedsValidation(current.remuneration.model)) {
      return { ok: false, message: 'Sem remuneração não precisa de validação.' };
    }
    const key = kind === 'legal' ? 'legalValidatedAt' : 'ethicsValidatedAt';
    const next: PartnerRemuneration = { ...current.remuneration };
    if (done) {
      next[key] = this.clock.today();
    } else {
      delete next[key];
    }
    const partner = this.db.partners.update(id, { remuneration: next });
    this.audit.write(
      'update',
      'partner',
      id,
      undefined,
      `${done ? 'registrou' : 'desfez'} a ${kind === 'legal' ? 'validação jurídica' : 'validação ética'}`,
    );
    return { ok: true, value: partner };
  }

  // ===== Internos =====

  private deny(): { ok: false; message: string } | null {
    return this.canWrite()
      ? null
      : { ok: false, message: 'O seu perfil só pode consultar os parceiros.' };
  }

  private remunerationOf(
    model: PartnerRemuneration['model'],
    notes: string,
    keep?: PartnerRemuneration,
  ): PartnerRemuneration {
    const text = notes.trim();
    return {
      model,
      ...(text ? { notes: text } : {}),
      ...(keep?.legalValidatedAt ? { legalValidatedAt: keep.legalValidatedAt } : {}),
      ...(keep?.ethicsValidatedAt ? { ethicsValidatedAt: keep.ethicsValidatedAt } : {}),
    };
  }

  private validate(input: PartnerInput): string | null {
    if (!input.name.trim()) {
      return 'Informe o nome do parceiro.';
    }
    const discount = validateDiscountPercent(input.discountPercent);
    if (!discount.valid) {
      return discount.message;
    }
    const email = validateFictitiousEmail(input.contactEmail.trim());
    if (!email.valid) {
      return email.message;
    }
    return null;
  }

  /** Rótulo da categoria (usado em listas e fichas). */
  categoryLabel(category: PartnerCategory): string {
    return PARTNER_CATEGORY_LABEL[category];
  }
}
