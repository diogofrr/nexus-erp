import { Injectable, inject } from '@angular/core';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { ID, Role } from '../models';
import { DataSubjectRequestService } from './data-subject-request.service';

/**
 * Como o perfil recebe o arquivo do titular (A-17, AC-M03-13):
 * - `full`: psicólogo do caso ou responsável técnico geram o JSON completo (com a escala);
 * - `sealed`: atendimento e gestão só disparam o "pacote selado": a parte clínica vai codificada dentro
 *   do arquivo e NUNCA aparece na tela. Quem dispara entrega o arquivo ao titular sem abrir;
 * - `none`: o perfil não gera o arquivo.
 */
export type SubjectExportMode = 'full' | 'sealed' | 'none';

export interface SubjectExportFile {
  fileName: string;
  json: string;
  mode: Exclude<SubjectExportMode, 'none'>;
}

export const SEALED_NOTE =
  'Pacote selado (simulado): a parte clínica segue codificada em base64 e não é lida pela equipe de atendimento nem pela gestão. Entregue o arquivo ao titular sem abrir.';

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/** Portabilidade e acesso do titular: JSON só com os dados dele, com log `export` (LP-12, RN-USR-15). */
@Injectable({ providedIn: 'root' })
export class SubjectExportService {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditLogService);
  private readonly clock = inject(Clock);
  private readonly dsr = inject(DataSubjectRequestService);

  modeFor(role: Role | null): SubjectExportMode {
    switch (role) {
      case 'technical_lead':
      case 'psychologist':
        return 'full';
      case 'support':
      case 'partner':
        return 'sealed';
      default:
        return 'none';
    }
  }

  /**
   * Gera o arquivo do titular. O responsável técnico gera fora do próprio caso: isso vale como supervisão
   * e grava `supervise` com o motivo informado (o padrão é o atendimento do pedido do titular).
   */
  build(caregiverId: ID, reason = 'Atender o pedido do titular'): SubjectExportFile {
    const role = this.auth.role();
    const mode = this.modeFor(role);
    if (mode === 'none') {
      throw new Error('Este perfil não gera o arquivo do titular.');
    }
    const caregiver = this.db.caregivers.require(caregiverId);
    if (role === 'technical_lead') {
      this.audit.supervise('subject_export', caregiverId, caregiverId, reason);
    }
    const data = this.dsr.exportSubject(caregiverId);
    let payload: unknown = data;
    if (mode === 'sealed') {
      const clinical = { zaritAssessments: data.subject.zaritAssessments };
      payload = {
        ...data,
        subject: {
          ...data.subject,
          zaritAssessments: [],
          clinicalSealed: {
            sealed: true,
            encoding: 'base64',
            note: SEALED_NOTE,
            payload: toBase64(JSON.stringify(clinical)),
          },
        },
      };
    }
    return {
      fileName: `titular-${caregiver.code}-${this.clock.today()}.json`,
      json: JSON.stringify(payload, null, 2),
      mode,
    };
  }
}
