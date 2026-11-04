import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Clock } from '../clock/clock.service';
import { Database } from '../data/database';
import { ISODate } from '../models/primitives';
import { STORAGE_KEYS, StorageService, StorageUsage } from '../storage/storage.service';

/** Aviso fixo do rodapé e da entrada (AC-GL-05, RN-LGPD-25). */
export const PROTOTYPE_NOTICE =
  'Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador.';

/** Texto do banner da primeira visita (LP-01): protótipo, dados fictícios, só neste navegador, sem servidor. */
export const FIRST_VISIT_NOTICE = {
  title: 'Antes de começar',
  body: 'Este é um protótipo de demonstração. Os dados são fictícios e ficam apenas neste navegador (armazenamento local e de sessão). Nada é enviado a um servidor.',
  howToErase:
    'Para apagar tudo, use "Meus dados no navegador" no rodapé. Você também pode limpar os dados do site nas configurações do navegador.',
  acknowledge: 'Entendi',
  details: 'Ver detalhes',
} as const;

interface StoredNotice {
  at: ISODate;
}

/**
 * Banner da primeira visita (LP-01): "Entendi" grava `nexus-erp:ui-notice` com a data e o banner não
 * reaparece (o rodapé mantém o aviso de protótipo).
 */
@Injectable({ providedIn: 'root' })
export class UiNoticeService {
  private readonly storage = inject(StorageService);
  private readonly clock = inject(Clock);

  private readonly state = signal<StoredNotice | null>(
    this.storage.readLocal<StoredNotice | null>(STORAGE_KEYS.uiNotice, null),
  );

  /** O usuário já clicou em "Entendi"? */
  readonly acknowledged = computed(() => this.state() !== null);
  /** Mostrar o banner? (primeira visita) */
  readonly bannerVisible = computed(() => this.state() === null);
  /** Data em que o usuário deu ciência. */
  readonly acknowledgedAt = computed(() => this.state()?.at ?? null);

  acknowledge(): void {
    const stored: StoredNotice = { at: this.clock.today() };
    this.state.set(stored);
    this.storage.writeLocal(STORAGE_KEYS.uiNotice, stored);
  }

  /** Volta a mostrar o banner (usado ao apagar tudo). */
  reset(): void {
    this.state.set(null);
    this.storage.removeLocal(STORAGE_KEYS.uiNotice);
  }
}

/**
 * "Meus dados no navegador" (SCR-M12-10, AC-M12-10): mostra o que está guardado, o tamanho e apaga
 * todas as chaves `nexus-erp:` (dados, relógio simulado, aviso da primeira visita e sessão).
 */
@Injectable({ providedIn: 'root' })
export class BrowserDataService {
  private readonly db = inject(Database);
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly notice = inject(UiNoticeService);

  /** O que está guardado e quanto ocupa (por chave). */
  usage(): StorageUsage {
    return this.storage.usage();
  }

  /**
   * Apaga TUDO o que o sistema guardou neste navegador e encerra a sessão. Depois, a interface deve
   * levar à entrada (`/login`); ao recarregar a página o seed é gerado de novo na primeira visita.
   * A interface precisa pedir confirmação com a descrição do efeito antes de chamar (AC-GL-09).
   */
  eraseAll(): void {
    this.auth.logout('user');
    this.db.wipe();
    this.clock.resetToReal();
    this.notice.reset();
    this.storage.clearAll();
  }
}
