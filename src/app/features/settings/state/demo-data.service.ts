import { Injectable, computed, inject } from '@angular/core';
import { AuditLogService } from '../../../core/audit/audit-log.service';
import { Clock } from '../../../core/clock/clock.service';
import { Database, ImportResult } from '../../../core/data/database';
import { ExportEnvelope, parseImport } from '../../../core/data/import-export';
import { toManagementCopy } from '../../../core/data/management-copy';
import { dateOf } from '../../../core/clock/date-utils';
import { formatDate, formatNumber } from '../../../core/format/format';

/** Uma linha das contagens da demonstração (AC-M15-01: conferir contra o seed). */
export interface DemoCount {
  label: string;
  value: number;
}

export type ImportPreview =
  | {
      ok: true;
      text: string;
      exportedAt: string;
      counts: DemoCount[];
      clockDate: string | null;
      /** Cópia da visão da gestão: traz códigos no lugar de nomes e não traz dado clínico. */
      management: boolean;
    }
  | { ok: false; reasons: string[] };

/** Texto de recusa de arquivo errado (F15, AC-M15-03): nada é alterado. */
export const IMPORT_REFUSED_TEXT = 'Este arquivo não é uma cópia do Nexus ERP. Nada foi alterado.';

/**
 * Operações de "Dados de demonstração" (M15, SCR-M15-01, F15): contagens, reset, cópia e importação. As telas
 * pedem a confirmação com o efeito descrito (AC-GL-09) ANTES de chamar `reset()` e `import()`; este serviço só
 * faz o trabalho e grava o log.
 *
 * Resetar mantém a sessão e o relógio simulado (U-12): os usuários do seed têm os mesmos ids, então quem está
 * conectado continua conectado, e o seed é gerado para a data de "hoje" do relógio.
 */
@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);

  /** Contagens do que está no banco agora: depois do reset devem bater com o seed (340, 20, 60...). */
  readonly counts = computed<DemoCount[]>(() => [
    { label: 'cuidadores', value: this.db.caregivers.size() },
    { label: 'prestadores', value: this.db.providers.size() },
    { label: 'sessões de atendimento', value: this.db.careSessions.size() },
    { label: 'aplicações da escala', value: this.db.zaritAssessments.size() },
    { label: 'solicitações de serviço', value: this.db.serviceRequests.size() },
    { label: 'mensagens', value: this.db.messages.size() },
    { label: 'linhas no log de acessos', value: this.db.accessLog.size() },
  ]);

  /** "340 cuidadores, 20 prestadores, 60 sessões de atendimento" (as três primeiras). */
  summary(counts: readonly DemoCount[] = this.counts()): string {
    return counts
      .slice(0, 3)
      .map((c) => `${formatNumber(c.value)} ${c.label}`)
      .join(', ');
  }

  /** Quando os dados atuais foram gerados (`DemoState.seededForToday`). */
  readonly seededFor = computed(() => this.db.demoState()?.seededForToday ?? null);

  /** Apaga tudo e gera o seed de novo, para a data de hoje do relógio. Mantém sessão e relógio (U-12). */
  reset(): void {
    this.db.reset();
    this.audit.write(
      'update',
      'demo_data',
      undefined,
      undefined,
      'dados de demonstração restaurados',
    );
  }

  /**
   * O arquivo da cópia e o nome sugerido (AC-M15-02). É a cópia da visão da gestão (QA-007): a tela é da sócia,
   * que só vê códigos e agregados, então o arquivo troca nomes por código e deixa de fora escala, notas,
   * mensagens e dados de saúde. A cópia completa só existe no núcleo (`Database.exportJson`), sem tela.
   */
  buildCopy(): { fileName: string; text: string } {
    this.audit.exported('demo_data', undefined, 'cópia dos dados de demonstração (visão da gestão)');
    return {
      fileName: `nexus-erp-copia-${this.clock.today()}.json`,
      text: JSON.stringify(toManagementCopy(this.db.buildExport()), null, 2),
    };
  }

  /** Valida o arquivo SEM gravar nada e resume o que seria substituído (prévia antes da confirmação). */
  preview(text: string): ImportPreview {
    const parsed = parseImport(text);
    if (!parsed.ok) {
      return { ok: false, reasons: parsed.errors };
    }
    const envelope: ExportEnvelope = parsed.envelope;
    const c = envelope.collections;
    return {
      ok: true,
      text,
      exportedAt: formatDate(dateOf(envelope.exportedAt)),
      clockDate: envelope.clock.demoToday ? formatDate(envelope.clock.demoToday) : null,
      management: envelope.scope === 'management',
      counts: [
        { label: 'cuidadores', value: c.caregivers.length },
        { label: 'prestadores', value: c.providers.length },
        { label: 'sessões de atendimento', value: c.careSessions.length },
      ],
    };
  }

  /** Importa a cópia. Arquivo inválido é recusado sem alterar nada (AC-M15-03). */
  importCopy(text: string): ImportResult {
    const result = this.db.importJson(text);
    if (result.ok) {
      this.audit.write('create', 'demo_data', undefined, undefined, 'cópia importada');
    }
    return result;
  }
}
