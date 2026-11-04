import { Pipe, PipeTransform, inject } from '@angular/core';
import { Clock } from '../clock/clock.service';
import { Cents, ISODate, ISODateTime } from '../models/primitives';
import { maskCpf } from '../privacy/masks';
import {
  PercentOptions,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
} from './format';

/** `{{ 123456 | money }}` resulta `R$ 1.234,56`. Recebe centavos. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(cents: Cents | null | undefined): string {
    return formatMoney(cents);
  }
}

/** `{{ '2026-11-04' | dateBr }}` resulta `04/11/2026`. */
@Pipe({ name: 'dateBr' })
export class DateBrPipe implements PipeTransform {
  transform(value: ISODate | ISODateTime | null | undefined): string {
    return formatDate(value);
  }
}

/** `{{ instante | timeBr }}` resulta `09:30`. */
@Pipe({ name: 'timeBr' })
export class TimeBrPipe implements PipeTransform {
  transform(value: ISODateTime | string | null | undefined): string {
    return formatTime(value);
  }
}

/** `{{ instante | dateTimeBr }}` resulta `04/11/2026 09:30`. */
@Pipe({ name: 'dateTimeBr' })
export class DateTimeBrPipe implements PipeTransform {
  transform(value: ISODateTime | null | undefined): string {
    return formatDateTime(value);
  }
}

/** `{{ 86.25 | percentBr }}` resulta `86,3%`. Opções: `{ decimals, signed }`. */
@Pipe({ name: 'percentBr' })
export class PercentBrPipe implements PipeTransform {
  transform(value: number | null | undefined, options?: PercentOptions): string {
    return formatPercent(value, options);
  }
}

/** `{{ 1234.5 | numberBr: 1 }}` resulta `1.234,5`. */
@Pipe({ name: 'numberBr' })
export class NumberBrPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 0): string {
    return formatNumber(value, decimals);
  }
}

/** `{{ cuidador.cpf | cpfMask }}` resulta `***.***.***-**`. */
@Pipe({ name: 'cpfMask' })
export class CpfMaskPipe implements PipeTransform {
  transform(cpf: string | null | undefined): string {
    return maskCpf(cpf);
  }
}

/**
 * `{{ prazo | relativeTime }}` resulta "em 5 dias" ou "há 2 horas", relativo ao `Clock` (real ou simulado).
 * Impuro de propósito: reavalia a cada detecção de mudanças para acompanhar o relógio.
 */
@Pipe({ name: 'relativeTime', pure: false })
export class RelativeTimePipe implements PipeTransform {
  private readonly clock = inject(Clock);

  transform(value: ISODate | ISODateTime | null | undefined): string {
    return formatRelativeTime(value, this.clock.now());
  }
}

/** Todos os pipes, para `imports` de componentes standalone. */
export const FORMAT_PIPES = [
  MoneyPipe,
  DateBrPipe,
  TimeBrPipe,
  DateTimeBrPipe,
  PercentBrPipe,
  NumberBrPipe,
  CpfMaskPipe,
  RelativeTimePipe,
] as const;
