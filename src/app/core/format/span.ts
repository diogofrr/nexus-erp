/**
 * Prazo legível conforme a grandeza (QA-018): minutos até 1 hora, horas e minutos até 1 dia, dias e horas até
 * 3 dias e só dias depois disso. Serve para "Vencido há 15 dias" em vez de "Vencido há 370 h 24 min".
 *
 * `formatSpan(150)` resulta `2 h 30 min`; `formatSpan(1500)` resulta `1 dia 1 h`; `formatSpan(21_624)` resulta
 * `15 dias`. O sinal é ignorado: o chamador escolhe "há" ou "faltam".
 */
export function formatSpan(totalMinutes: number): string {
  const abs = Math.round(Math.abs(totalMinutes));
  if (abs < 60) {
    return `${abs} min`;
  }
  const days = Math.floor(abs / (60 * 24));
  const hours = Math.floor((abs % (60 * 24)) / 60);
  const minutes = abs % 60;
  if (days === 0) {
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
  }
  const dayText = `${days} ${days === 1 ? 'dia' : 'dias'}`;
  return days < 3 && hours > 0 ? `${dayText} ${hours} h` : dayText;
}
