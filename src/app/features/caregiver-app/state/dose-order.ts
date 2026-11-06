import { DoseSlot } from '../../../core/rules/medication-doses';
import { ISODateTime } from '../../../core/models';
import { doseStateOf } from '../ui/cg-dose.component';

/** Nas doses que faltam vêm antes das dadas; dentro de cada grupo, a ordem do horário e do nome. */
function pendingFirst(a: DoseSlot, b: DoseSlot): number {
  return (
    Number(a.given) - Number(b.given) ||
    a.time.localeCompare(b.time) ||
    a.medicationName.localeCompare(b.medicationName, 'pt-BR')
  );
}

const UNRANKED = 1_000_000;

/**
 * A ordem das doses numa tela de remédios (CXC-005): **o que falta aparece primeiro**, as dadas depois. A ordem é
 * **fixada quando a tela abre**: marcar "Dei" não muda a linha de lugar (sem pulo de layout, e o segundo toque de quem
 * dá dois toques não cai no "Dei" de outro remédio). Dose que aparece depois (remédio novo) entra pela mesma regra.
 *
 * ```ts
 * private readonly order = freezeDoseOrder(this.view.slots());
 * protected readonly slots = computed(() => this.order(this.view.slots()));
 * ```
 */
export function freezeDoseOrder(initial: readonly DoseSlot[]): (slots: readonly DoseSlot[]) => DoseSlot[] {
  const rank = new Map<string, number>();
  [...initial].sort(pendingFirst).forEach((slot, index) => rank.set(slot.key, index));
  return (slots) =>
    [...slots].sort(
      (a, b) => (rank.get(a.key) ?? UNRANKED) - (rank.get(b.key) ?? UNRANKED) || pendingFirst(a, b),
    );
}

/**
 * A primeira dose que passou do horário sem marca: só ela leva o âmbar suave; as outras ficam neutras (CXC-005,
 * "âmbar no máximo uma vez"). `null` quando nenhuma passou.
 */
export function firstLateKey(slots: readonly DoseSlot[], now: ISODateTime): string | null {
  const late = slots.find((slot) => doseStateOf(slot, now) === 'late');
  return late ? late.key : null;
}
