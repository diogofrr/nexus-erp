import { Injectable, computed, inject } from '@angular/core';
import { StorageService } from '../../../core/storage/storage.service';

/** O que a pessoa lê quando o navegador não está guardando o que ela faz (QAC-010): calmo, e diz o que fazer. */
export const STORAGE_NOT_SAVING_TEXT =
  'O navegador não está guardando o que você faz. Libere espaço ou o armazenamento do site e recarregue.';

/** O que o "Dei" diz quando a marca existe só na tela: nunca "anotado" sem avisar que não foi guardado (QAC-010). */
export function doseNotSavedText(time: string): string {
  return `Anotado às ${time}, mas não foi guardado: o navegador está sem espaço. Ao recarregar, esta marca some.`;
}

/**
 * O navegador está guardando o que o cuidador faz? A fonte é a MESMA do shell da equipe (`StorageService.notices`, UX 5.15):
 * cota cheia ou armazenamento bloqueado. Sem sinal novo no núcleo. O shell do cuidador mostra a faixa calma
 * `STORAGE_NOT_SAVING_TEXT` enquanto `failing()` for verdade, e as telas que gravam algo importante (o "Dei") não dizem
 * "anotado" como se estivesse guardado.
 */
@Injectable({ providedIn: 'root' })
export class StorageStatusService {
  private readonly storage = inject(StorageService);

  /** `true` quando a cota está cheia ou o armazenamento está bloqueado (o dado vive só em memória). */
  readonly failing = computed(() =>
    this.storage.notices().some((notice) => notice.kind === 'quota_exceeded' || notice.kind === 'unavailable'),
  );
}
