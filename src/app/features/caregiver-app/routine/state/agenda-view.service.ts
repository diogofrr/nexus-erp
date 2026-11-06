import { Injectable, inject, signal } from '@angular/core';
import { STORAGE_KEYS, StorageService } from '../../../../core/storage/storage.service';

/** Os dois jeitos de ver a Agenda: o calendário (padrão) e a lista dos próximos compromissos agrupados por dia. */
export type AgendaView = 'calendar' | 'list';

function isAgendaView(value: unknown): value is AgendaView {
  return value === 'calendar' || value === 'list';
}

/**
 * O jeito de ver a Agenda ("Calendário" ou "Lista"). Vale na hora e fica guardado NO NAVEGADOR (não por pessoa) pelo
 * `StorageService`, na chave `nexus-erp:caregiver-agenda-view`, como o tamanho da letra. Sem nada guardado, ou com um
 * valor que não é um dos dois, vale o calendário.
 */
@Injectable({ providedIn: 'root' })
export class AgendaViewService {
  private readonly storage = inject(StorageService);

  readonly view = signal<AgendaView>(this.read());

  set(view: AgendaView): void {
    this.view.set(view);
    this.storage.writeLocal(STORAGE_KEYS.caregiverAgendaView, view);
  }

  private read(): AgendaView {
    const stored = this.storage.readLocal<unknown>(STORAGE_KEYS.caregiverAgendaView, 'calendar');
    return isAgendaView(stored) ? stored : 'calendar';
  }
}
