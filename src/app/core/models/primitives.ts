/**
 * Primitivos compartilhados por todo o modelo de dados (escopo, seção 4).
 *
 * Convenções:
 * - dinheiro SEMPRE em centavos inteiros (`Cents`);
 * - IDs são strings com prefixo por entidade (`cg_0001`, `prv_01`...);
 * - datas em ISO: `ISODate` (`2026-11-04`) e `ISODateTime` (`2026-11-04T09:30:00-03:00`).
 */

/** Identificador de registro. Prefixo por entidade: `cg_`, `el_`, `sub_`, `prv_`... */
export type ID = string;

/** Data civil no formato `YYYY-MM-DD` (calendário de Brasília). */
export type ISODate = string;

/** Instante no formato ISO 8601 completo, com deslocamento (`-03:00` para Brasília). */
export type ISODateTime = string;

/** Dinheiro em centavos inteiros (R$ 49,90 = 4990). */
export type Cents = number;

/** Mês no formato `YYYY-MM`. */
export type YearMonth = string;

/** Hora do dia no formato `HH:mm`. */
export type TimeOfDay = string;

/** Todo registro persistido tem id e carimbos de criação e atualização (feitos pelo `Clock`). */
export interface Audited {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Canais de contato (RN-CAN-01). */
export type Channel = 'app' | 'whatsapp' | 'phone' | 'email';

/** Nota inteira de 1 a 5 (ARP, satisfação). */
export type Rating = 1 | 2 | 3 | 4 | 5;
