import { Injectable, inject, signal } from '@angular/core';
import { STORAGE_KEYS, StorageService } from '../../../core/storage/storage.service';

/** Os três níveis de letra do aplicativo do cuidador (decisão 7 do contexto). */
export type FontScale = 'normal' | 'large' | 'xlarge';

export interface FontScaleOption {
  value: FontScale;
  /** Nome na tela. */
  label: string;
  /** Nome para leitor de tela. */
  ariaLabel: string;
  /** Tamanho do "Aa" do botão, fixo (não muda com o nível atual). */
  sample: number;
}

export const FONT_SCALES: readonly FontScaleOption[] = [
  { value: 'normal', label: 'Normal', ariaLabel: 'Letra normal', sample: 18 },
  { value: 'large', label: 'Grande', ariaLabel: 'Letra grande', sample: 20 },
  { value: 'xlarge', label: 'Bem grande', ariaLabel: 'Letra bem grande', sample: 22 },
];

function isFontScale(value: unknown): value is FontScale {
  return value === 'normal' || value === 'large' || value === 'xlarge';
}

/**
 * Tamanho da letra do aplicativo do cuidador. Vale na hora, sem botão Salvar, e fica guardado NO NAVEGADOR (não
 * por pessoa) pelo `StorageService`, na chave `nexus-erp:caregiver-font-scale`: continua depois de recarregar a
 * página e de entrar de novo. O shell lê `scale()` e põe `data-text` na raiz `.cg-app`.
 */
@Injectable({ providedIn: 'root' })
export class FontScaleService {
  private readonly storage = inject(StorageService);

  readonly scale = signal<FontScale>(this.read());

  set(scale: FontScale): void {
    this.scale.set(scale);
    this.storage.writeLocal(STORAGE_KEYS.caregiverFontScale, scale);
  }

  private read(): FontScale {
    const stored = this.storage.readLocal<unknown>(STORAGE_KEYS.caregiverFontScale, 'normal');
    return isFontScale(stored) ? stored : 'normal';
  }
}
