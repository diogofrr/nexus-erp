import { Injectable, inject } from '@angular/core';
import { SessionStore } from '@core/auth';
import { Clock } from '@core/clock';
import { formatDate, formatTime } from '@core/format';
import type { ISODateTime } from '@core/models';
import { StorageService } from '@core/storage';

export interface DraftRecord<T> {
  savedAt: ISODateTime;
  data: T;
}

/**
 * Rascunho automático de formulários longos (UX 5.12). Guarda pelo `StorageService` (nunca direto no
 * navegador) na chave `nexus-erp:draft:<formulário>:<usuário>:<id>`. O rascunho é POR USUÁRIO e fica ao
 * trocar de perfil. Apague ao concluir (`clear`). Sem consentimento de saúde NÃO salve rascunho da Zarit
 * (RN-ZRT-07): quem chama decide.
 */
@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly storage = inject(StorageService);
  private readonly session = inject(SessionStore);
  private readonly clock = inject(Clock);

  /** Nome da chave, sem o prefixo `nexus-erp:`. */
  keyOf(form: string, id = 'novo'): string {
    return `draft:${form}:${this.session.user()?.id ?? 'anon'}:${id}`;
  }

  load<T>(form: string, id = 'novo'): DraftRecord<T> | null {
    return this.storage.readLocal<DraftRecord<T> | null>(this.keyOf(form, id), null);
  }

  save<T>(form: string, id: string, data: T): DraftRecord<T> {
    const record: DraftRecord<T> = { savedAt: this.clock.now(), data };
    this.storage.writeLocal(this.keyOf(form, id), record);
    return record;
  }

  clear(form: string, id = 'novo'): void {
    this.storage.removeLocal(this.keyOf(form, id));
  }

  /** "hoje, 14:32" ou "03/11/2026, 14:32", para a pergunta "Retomar rascunho?". */
  describe(record: DraftRecord<unknown>): string {
    const today = this.clock.today();
    const day = record.savedAt.slice(0, 10);
    return `${day === today ? 'hoje' : formatDate(day)}, ${formatTime(record.savedAt)}`;
  }
}
