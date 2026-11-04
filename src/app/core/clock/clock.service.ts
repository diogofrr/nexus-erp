import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ISODate, ISODateTime, TimeOfDay } from '../models/primitives';
import { STORAGE_KEYS, StorageService } from '../storage/storage.service';
import * as dates from './date-utils';

interface StoredClock {
  demoToday: ISODate;
  /** Hora fixa (`HH:mm`) opcional; sem ela, a simulação usa a hora real do dia. */
  fixedTime?: TimeOfDay;
}

/**
 * Relógio do sistema (E-06, AC-M15). TODA regra de prazo, ciclo, auditoria e SLA usa este serviço:
 * `Date.now()` e `new Date()` não existem fora deste arquivo.
 *
 * - Sem simulação: devolve o momento real, em horário de Brasília.
 * - Com data simulada (M15): `today()` é a data simulada e `now()` é essa data com a hora real do dia
 *   (ou com a hora fixa, se `setSimulated(date, 'HH:mm')`). A data simulada fica em `nexus-erp:clock`.
 *
 * Os instantes são `ISODateTime` sempre com `-03:00`; por isso comparar as strings funciona, mas
 * prefira `compareDateTimes`/`isBefore`.
 */
@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly storage = inject(StorageService);

  private readonly simulatedState = signal<StoredClock | null>(this.restore());
  /** Incrementa a cada tique para a interface reavaliar "agora" (contagens regressivas). */
  private readonly tickCounter = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** `true` enquanto a data de hoje é simulada. */
  readonly isSimulated = computed(() => this.simulatedState() !== null);
  /** Data simulada ou `null` (relógio real). */
  readonly simulatedDate = computed<ISODate | null>(() => this.simulatedState()?.demoToday ?? null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTicker());
  }

  // ===== Leitura =====

  /** Momento atual (real ou simulado) como `ISODateTime` em Brasília. Reativo ao tique e à simulação. */
  now(): ISODateTime {
    this.tickCounter();
    const sim = this.simulatedState();
    const realNow = dates.fromEpochMs(this.realNowMs());
    if (!sim) {
      return realNow;
    }
    const time = sim.fixedTime ?? dates.timeOf(realNow);
    const seconds = sim.fixedTime ? 0 : Number(realNow.slice(17, 19));
    return dates.toIsoDateTime(sim.demoToday, time, seconds);
  }

  /** Momento atual como `Date` do JavaScript (para bibliotecas e exibição). */
  nowDate(): Date {
    return new Date(dates.epochMs(this.now()));
  }

  /** Data de hoje (D0), real ou simulada. */
  today(): ISODate {
    return dates.dateOf(this.now());
  }

  /** Mês atual `YYYY-MM`. */
  currentMonth(): string {
    return this.today().slice(0, 7);
  }

  /**
   * Milissegundos REAIS (ignora a simulação). Só para coisas que dependem do tempo físico, como a
   * inatividade da sessão: avançar o relógio simulado não pode derrubar a sessão.
   */
  realNowMs(): number {
    return Date.now();
  }

  /** Instante REAL em ISO (ignora a simulação). */
  realNow(): ISODateTime {
    return dates.fromEpochMs(this.realNowMs());
  }

  // ===== Aritmética a partir de "hoje" =====

  addDays(days: number, from: ISODate = this.today()): ISODate {
    return dates.addDays(from, days);
  }

  addMonths(months: number, from: ISODate = this.today()): ISODate {
    return dates.addMonths(from, months);
  }

  startOfMonth(from: ISODate = this.today()): ISODate {
    return dates.startOfMonth(from);
  }

  endOfMonth(from: ISODate = this.today()): ISODate {
    return dates.endOfMonth(from);
  }

  daysUntil(date: ISODate): number {
    return dates.daysBetween(this.today(), date);
  }

  /** Data estritamente anterior a hoje. */
  isPast(date: ISODate): boolean {
    return dates.compareDates(date, this.today()) < 0;
  }

  /** Instante anterior a agora. */
  isBeforeNow(instant: ISODateTime): boolean {
    return dates.compareDateTimes(instant, this.now()) < 0;
  }

  // ===== Simulação (M15) =====

  /**
   * Define a data de "hoje". `null` volta ao relógio real. Com `time`, a hora do dia fica fixa
   * (útil em testes e para reproduzir prazos como 23h59).
   */
  setSimulated(date: ISODate | null, time?: TimeOfDay): void {
    if (date === null) {
      this.simulatedState.set(null);
      this.storage.removeLocal(STORAGE_KEYS.clock);
      return;
    }
    if (!dates.isValidIsoDate(date)) {
      throw new RangeError(`Data simulada inválida: "${date}"`);
    }
    const state: StoredClock = time ? { demoToday: date, fixedTime: time } : { demoToday: date };
    this.simulatedState.set(state);
    this.storage.writeLocal(STORAGE_KEYS.clock, state);
  }

  /** Volta ao relógio real. */
  resetToReal(): void {
    this.setSimulated(null);
  }

  /** "+1 dia", "+7 dias": avança a data simulada a partir de hoje. */
  advanceDays(days: number): void {
    this.setSimulated(this.addDays(days), this.simulatedState()?.fixedTime);
  }

  /** "+1 mês". */
  advanceMonths(months: number): void {
    this.setSimulated(this.addMonths(months), this.simulatedState()?.fixedTime);
  }

  // ===== Tique para contagens regressivas =====

  /** Inicia um tique periódico (o app liga uma vez; testes não precisam). */
  startTicker(intervalMs = 30_000): void {
    this.stopTicker();
    this.timer = setInterval(() => this.tickCounter.update((n) => n + 1), intervalMs);
  }

  stopTicker(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Força a reavaliação de quem lê `now()` dentro de `computed`/template. */
  tick(): void {
    this.tickCounter.update((n) => n + 1);
  }

  private restore(): StoredClock | null {
    const stored = this.storage.readLocal<StoredClock | null>(STORAGE_KEYS.clock, null);
    if (stored && typeof stored.demoToday === 'string' && dates.isValidIsoDate(stored.demoToday)) {
      return stored;
    }
    return null;
  }
}
