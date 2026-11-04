import { addDays, weekday } from '@core/clock';
import type { ISODate, PlanId } from '@core/models';
import type { AgendaSlot } from '@shared/ui';

/** Dados de exemplo da página do kit. 100% fictícios; nenhum nome vem do documento-fonte. */
export interface KitPerson {
  id: string;
  name: string;
  code: string;
  plan: PlanId;
  /** Pontuação do Zarit (só para quem pode ver o resultado individual). */
  zarit: number | null;
  hoursPerDay: number;
  /** Prazo da próxima aplicação. */
  dueDate: string;
}

const NAMES = [
  'Ana Paula Ferraz', 'Maria Aparecida Lemos', 'João Batista Carneiro', 'Marlene Cardoso', 'Sueli Prado',
  'Débora Gontijo', 'Vera Lúcia Teixeira', 'Rita de Cássia Moura', 'Neusa Aparecida Borges', 'Lúcia Helena Freitas',
  'Eliane Costa Rezende', 'Terezinha Alves', 'Cláudia Mendes', 'Ivone Barros', 'Fátima Ribeiro',
  'Sônia Maria Dutra', 'Aparecida Neves', 'Raimunda Siqueira', 'Luciana Ornelas', 'Patrícia Vilela',
  'Gisele Marques', 'Rogério Peixoto', 'Simone Arantes', 'Lourdes Campos', 'Osvaldo Pimentel',
  'Marcos Vinícius Leal', 'Elza Guimarães', 'Vanessa Torres', 'Adriana Fonseca', 'Heloísa Duarte',
  'Cecília Braga', 'Dalva Nogueira', 'Irene Machado', 'Joana Teles',
];
const PLANS: readonly PlanId[] = ['livre', 'essencial', 'cuida', 'sustenta'];

export const KIT_PEOPLE: readonly KitPerson[] = NAMES.map((name, i) => ({
  id: `kit_${String(i + 1).padStart(4, '0')}`,
  name,
  code: `CUI-${String(i + 1).padStart(4, '0')}`,
  plan: PLANS[i % 4] as PlanId,
  zarit: i % 5 === 4 ? null : (i * 11) % 89,
  hoursPerDay: (i * 7) % 13,
  dueDate: `2026-11-${String(((i * 3) % 27) + 1).padStart(2, '0')}`,
}));

/** Segunda a sexta da semana de `today`. */
export function weekDays(today: ISODate): ISODate[] {
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  return [0, 1, 2, 3, 4].map((n) => addDays(monday, n));
}

/** Vagas de exemplo para a semana, uma para cada estado. */
export function sampleSlots(days: readonly ISODate[]): AgendaSlot[] {
  const at = (day: number, time: string, status: AgendaSlot['status'], label?: string, detail?: string): AgendaSlot => ({
    id: `slot-${day}-${time}`,
    date: days[day] as ISODate,
    time,
    status,
    ...(label ? { label } : {}),
    ...(detail ? { detail } : {}),
  });
  return [
    at(0, '08:00', 'open'),
    at(0, '09:00', 'booked', 'CUI-0042', 'On-line'),
    at(0, '10:00', 'confirmed', 'CUI-0051', 'Coworking, sala Ipê'),
    at(0, '14:00', 'done', 'CUI-0044'),
    at(1, '08:00', 'priority'),
    at(1, '09:00', 'open'),
    at(1, '11:00', 'blocked'),
    at(1, '15:00', 'noshow', 'CUI-0031', 'On-line'),
    at(2, '08:00', 'booked', 'CUI-0012', 'Domicílio'),
    at(2, '10:00', 'open'),
    at(2, '12:00', 'confirmed', 'CUI-0020'),
    at(2, '16:00', 'priority'),
    at(3, '09:00', 'booked', 'CUI-0007'),
    at(3, '13:00', 'open'),
    at(3, '17:00', 'open'),
    at(4, '08:00', 'confirmed', 'CUI-0003', 'On-line'),
    at(4, '11:00', 'open'),
    at(4, '14:00', 'blocked'),
  ];
}
