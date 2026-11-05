import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '@core/audit';
import { Clock, addMonths } from '@core/clock';
import { SubscriptionService } from '@core/commerce/subscription.service';
import { Database } from '@core/data';
import { buildCsv } from '@core/export/file-download';
import type {
  Caregiver,
  Channel,
  ConsentKey,
  DataSubjectRequest,
  Dependency,
  Elder,
  ID,
  PlanId,
  Relationship,
  Sex,
} from '@core/models';
import { ConsentService, DataSubjectRequestService } from '@core/privacy';
import { caregiverCode } from '@core/privacy';
import { PilotEligibility, evaluatePilotEligibility } from '@core/rules/pilot-eligibility';
import type { CaregiverRow } from './caregiver-directory.service';
import { STATUS_SHORT_LABELS } from './caregiver-labels';

export interface CaregiverFields {
  fullName: string;
  birthDate: string;
  email: string;
  phone: string;
  whatsapp?: string;
  relationship: Relationship;
  sex: Sex;
  city: string;
  dailyCareHours: number;
  preferredChannel: Channel;
  digitalLiteracy: 'low' | 'medium' | 'high';
}

export interface NewCaregiverInput extends CaregiverFields {
  cpf: string;
  elder: { fullName: string; birthDate: string; dependency: Dependency };
  /** Quem não aparece aqui fica "pendente" (Decidir depois): nada vem pré-marcado. */
  consents: Partial<Record<ConsentKey, 'granted' | 'refused'>>;
  consentChannel: Channel | 'in_person';
  evidence?: string;
  planId: PlanId;
}

export class CaregiverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaregiverError';
  }
}

const PLACEHOLDER_CPF = '000.000.000-00';

/**
 * Gravações do cadastro do cuidador (M03): criar com consentimento granular e plano, editar, atribuir
 * psicólogo (RT), marcar o piloto e pedir o encerramento (POP-10). Toda gravação gera log (AC-GL-10).
 */
@Injectable({ providedIn: 'root' })
export class CaregiverService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly consent = inject(ConsentService);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly dsr = inject(DataSubjectRequestService);

  /** Cuidador que já usa este CPF fictício (para "Já existe um cuidador com este CPF"). */
  findByCpf(cpf: string, exceptId?: ID): Caregiver | undefined {
    if (!cpf || cpf === PLACEHOLDER_CPF) {
      return undefined;
    }
    return this.db.caregivers.find((c) => c.cpf === cpf && c.id !== exceptId);
  }

  /** Próximo código e id: `CUI-0341` e `cg_0341`. */
  nextIdentity(): { id: ID; code: string; elderId: ID } {
    const highest = this.db.caregivers
      .all()
      .reduce((max, c) => Math.max(max, Number(/(\d+)$/.exec(c.id)?.[1] ?? 0)), 0);
    const n = highest + 1;
    const padded = String(n).padStart(4, '0');
    return { id: `cg_${padded}`, code: caregiverCode(n), elderId: `el_${padded}` };
  }

  create(input: NewCaregiverInput): { caregiver: Caregiver; elder: Elder } {
    if (this.findByCpf(input.cpf)) {
      throw new CaregiverError('Já existe um cuidador com este CPF fictício.');
    }
    const identity = this.nextIdentity();
    const today = this.clock.today();
    const caregiver = this.db.caregivers.create({
      id: identity.id,
      code: identity.code,
      fullName: input.fullName.trim(),
      cpf: input.cpf,
      cpfIsFictitious: true,
      email: input.email.trim(),
      phone: input.phone,
      ...(input.whatsapp ? { whatsapp: input.whatsapp } : {}),
      birthDate: input.birthDate,
      sex: input.sex,
      relationship: input.relationship,
      city: input.city.trim(),
      dailyCareHours: input.dailyCareHours,
      preferredChannel: input.preferredChannel,
      digitalLiteracy: input.digitalLiteracy,
      status: 'active',
      enrolledAt: today,
      isPilot: false,
    });
    const elder = this.db.elders.create({
      id: identity.elderId,
      caregiverId: caregiver.id,
      fullName: input.elder.fullName.trim(),
      birthDate: input.elder.birthDate,
      dependency: input.elder.dependency,
    });
    // Os seis consentimentos nascem "pendente"; só o que a pessoa decidiu vira evento (AC-M03-02).
    this.consent.initializeForNewCaregiver(caregiver.id);
    const options = {
      channel: input.consentChannel,
      ...(input.evidence?.trim() ? { evidence: input.evidence.trim() } : {}),
    };
    (Object.entries(input.consents) as [ConsentKey, 'granted' | 'refused'][]).forEach(([key, decision]) => {
      if (decision === 'granted') {
        this.consent.grant(caregiver.id, key, options);
      } else {
        this.consent.refuse(caregiver.id, key, options);
      }
    });
    this.subscriptions.startSubscription(caregiver.id, input.planId);
    this.audit.write('create', 'caregiver', caregiver.id, caregiver.id, 'cadastro criado');
    return { caregiver: this.db.caregivers.require(caregiver.id), elder };
  }

  update(id: ID, fields: CaregiverFields): Caregiver {
    const updated = this.db.caregivers.update(id, {
      ...fields,
      fullName: fields.fullName.trim(),
      email: fields.email.trim(),
      city: fields.city.trim(),
      whatsapp: fields.whatsapp || undefined,
    });
    this.audit.write('update', 'caregiver', id, id, 'cadastro editado');
    return updated;
  }

  updateElder(caregiverId: ID, fields: { fullName: string; birthDate: string; dependency: Dependency }): Elder {
    const elder = this.db.elders.find((e) => e.caregiverId === caregiverId);
    if (!elder) {
      throw new CaregiverError('A pessoa idosa não foi encontrada.');
    }
    const updated = this.db.elders.update(elder.id, { ...fields, fullName: fields.fullName.trim() });
    this.audit.write('update', 'elder', elder.id, caregiverId, 'dados da pessoa idosa editados');
    return updated;
  }

  /** Atribui (ou tira) o psicólogo responsável. Devolve o estado anterior para o "Desfazer". */
  assignPsychologist(ids: readonly ID[], psychologistId: ID | null): Map<ID, ID | undefined> {
    const previous = new Map<ID, ID | undefined>();
    ids.forEach((id) => {
      const current = this.db.caregivers.get(id);
      if (!current) {
        return;
      }
      previous.set(id, current.assignedPsychologistId);
      this.db.caregivers.update(id, { assignedPsychologistId: psychologistId ?? undefined });
      this.audit.write(
        'update',
        'caregiver',
        id,
        id,
        psychologistId ? 'psicólogo responsável atribuído' : 'psicólogo responsável retirado',
      );
    });
    return previous;
  }

  restoreAssignments(previous: ReadonlyMap<ID, ID | undefined>): void {
    previous.forEach((psychologistId, id) => {
      this.db.caregivers.update(id, { assignedPsychologistId: psychologistId });
      this.audit.write('update', 'caregiver', id, id, 'atribuição desfeita');
    });
  }

  // ===== Piloto (SCR-M03-06) =====

  pilotEligibility(caregiverId: ID): PilotEligibility {
    const caregiver = this.db.caregivers.require(caregiverId);
    const elder = this.db.elders.find((e) => e.caregiverId === caregiverId);
    return evaluatePilotEligibility({
      hasElder: !!elder,
      dependency: elder?.dependency,
      city: caregiver.city,
      tcleActive: this.consent.isActive(caregiverId, 'pilot_tcle'),
    });
  }

  /** Marca no piloto: exige os três critérios e o TCLE ativo (AC-M03-09). Cria a coorte com as 3 janelas. */
  enrollInPilot(caregiverId: ID): void {
    const eligibility = this.pilotEligibility(caregiverId);
    if (!eligibility.canEnroll) {
      throw new CaregiverError(`Faltam critérios para o piloto: ${eligibility.missing.join('; ')}.`);
    }
    const today = this.clock.today();
    const tcle = this.consent
      .history(caregiverId, 'pilot_tcle')
      .filter((e) => e.status === 'granted')
      .pop();
    this.db.caregivers.update(caregiverId, { isPilot: true });
    this.db.pilotEnrollments.create({
      caregiverId,
      enrolledAt: today,
      tcleConsentEventId: tcle?.id ?? '',
      windows: [
        { name: 'enrollment', dueDate: today, status: 'pending' },
        { name: 'month3', dueDate: addMonths(today, 3), status: 'pending' },
        { name: 'month6', dueDate: addMonths(today, 6), status: 'pending' },
      ],
    });
    this.audit.write('update', 'caregiver', caregiverId, caregiverId, 'marcado no piloto');
  }

  /** Retira do piloto. Os dados já coletados seguem as regras de retenção. */
  leavePilot(caregiverId: ID): void {
    this.db.caregivers.update(caregiverId, { isPilot: false });
    this.db.pilotEnrollments.updateWhere((p) => p.caregiverId === caregiverId && !p.exitedAt, {
      exitedAt: this.clock.today(),
    });
    this.audit.write('update', 'caregiver', caregiverId, caregiverId, 'retirado do piloto');
  }

  // ===== Encerramento (SCR-M03-05, POP-10) =====

  /**
   * Pede o encerramento: o cadastro vai a `closure_requested` e a solicitação de eliminação (POP-10)
   * entra na fila do titular. Se já há uma eliminação aberta, ela é reaproveitada.
   */
  requestClosure(caregiverId: ID, reason: string): DataSubjectRequest {
    const caregiver = this.db.caregivers.require(caregiverId);
    if (caregiver.status === 'closed' || caregiver.status === 'closure_requested') {
      throw new CaregiverError('Este cadastro já está com encerramento pedido ou encerrado.');
    }
    this.db.caregivers.update(caregiverId, {
      status: 'closure_requested',
      closureRequestedAt: this.clock.today(),
    });
    const open = this.db.dataSubjectRequests.find(
      (r) =>
        r.caregiverId === caregiverId &&
        r.type === 'erasure' &&
        (r.status === 'open' || r.status === 'in_progress'),
    );
    const request =
      open ??
      this.db.dataSubjectRequests.update(
        this.dsr.open({ caregiverId, type: 'erasure' }).id,
        { channel: 'in_person', description: `Encerramento do cadastro (POP-10). Motivo: ${reason}` },
      );
    this.audit.write('update', 'caregiver', caregiverId, caregiverId, 'encerramento pedido (POP-10)');
    return request;
  }

  // ===== Exportação da lista (SCR-M03-01) =====

  /** CSV da lista visível, sem CPF, telefone, e-mail, nome nem dado de saúde (LP-12, A-16). */
  listCsv(rows: readonly CaregiverRow[], planNames: Record<string, string>): string {
    this.audit.exported('caregiver_list_csv', undefined, 'lista sem dados sensíveis');
    return buildCsv(
      ['codigo', 'plano', 'situacao', 'piloto', 'adesao'],
      rows.map((r) => [
        r.code,
        planNames[r.planId] ?? r.planId,
        STATUS_SHORT_LABELS[r.status],
        r.isPilot ? 'sim' : 'nao',
        r.enrolledAt,
      ]),
    );
  }
}
