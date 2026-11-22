import { Injectable, computed, inject, signal } from '@angular/core';
import { daysBetween, dateOf } from '../../../../core/clock/date-utils';
import { StorageService } from '../../../../core/storage/storage.service';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { GUIDE_STEPS } from './guide-content';

/** Chave no navegador (com o prefixo `nexus-erp:` do StorageService): o progresso do guia de cada pessoa. */
export const GUIDE_STORAGE_KEY = 'caregiver-guide';

/** Por quantos dias depois do cadastro Hoje lembra do guia (quem acabou de virar cuidador). */
export const GUIDE_NEW_ACCOUNT_DAYS = 30;

interface GuideRecord {
  done: string[];
  /** A pessoa tocou em "Não mostrar mais" no cartão de Hoje (o guia continua em Mais). */
  hidden: boolean;
}

type GuideStore = Record<string, GuideRecord>;

function isStore(value: unknown): value is GuideStore {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Progresso do "Começando a cuidar": quais passos a pessoa marcou como feitos e se escondeu o lembrete de Hoje. Fica no
 * navegador, por pessoa (chave `nexus-erp:caregiver-guide`, um registro por cuidador). As dicas em si são fixas
 * (`guide-content.ts`) e estão sempre no aplicativo.
 */
@Injectable({ providedIn: 'root' })
export class GuideProgressService {
  private readonly storage = inject(StorageService);
  private readonly ctx = inject(CaregiverContextService);

  private readonly store = signal<GuideStore>(this.read());

  private readonly record = computed<GuideRecord>(() => {
    const id = this.ctx.caregiverId();
    return (id && this.store()[id]) || { done: [], hidden: false };
  });

  /** Ids dos passos feitos (só os que existem no guia). */
  readonly done = computed<ReadonlySet<string>>(() => {
    const valid = new Set(GUIDE_STEPS.map((s) => s.id));
    return new Set(this.record().done.filter((id) => valid.has(id)));
  });

  readonly total = GUIDE_STEPS.length;
  readonly doneCount = computed(() => this.done().size);
  readonly finished = computed(() => this.doneCount() >= this.total);

  /** "3 de 9 passos feitos" ou "Todos os passos feitos". */
  readonly progressText = computed(() =>
    this.finished() ? 'Todos os passos feitos' : `${this.doneCount()} de ${this.total} passos feitos`,
  );

  /**
   * Hoje lembra do guia para quem se cadastrou há pouco (até 30 dias), enquanto faltar passo e a pessoa não tiver
   * escondido o lembrete.
   */
  readonly showOnToday = computed(() => {
    const caregiver = this.ctx.caregiver();
    if (!caregiver || this.record().hidden || this.finished()) {
      return false;
    }
    return daysBetween(dateOf(caregiver.createdAt), this.ctx.today()) <= GUIDE_NEW_ACCOUNT_DAYS;
  });

  isDone(stepId: string): boolean {
    return this.done().has(stepId);
  }

  toggle(stepId: string): void {
    const current = this.record();
    const done = current.done.includes(stepId) ? current.done.filter((id) => id !== stepId) : [...current.done, stepId];
    this.save({ ...current, done });
  }

  hideOnToday(): void {
    this.save({ ...this.record(), hidden: true });
  }

  private save(record: GuideRecord): void {
    const id = this.ctx.caregiverId();
    if (!id) {
      return;
    }
    const next = { ...this.store(), [id]: record };
    this.store.set(next);
    this.storage.writeLocal(GUIDE_STORAGE_KEY, next);
  }

  private read(): GuideStore {
    const stored = this.storage.readLocal<unknown>(GUIDE_STORAGE_KEY, {});
    return isStore(stored) ? stored : {};
  }
}
