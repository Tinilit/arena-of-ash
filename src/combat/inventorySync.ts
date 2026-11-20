import type { Player } from "../domain/model";

/** Combat owns equipment mutations; persist its resulting state, not event replays. */
export function syncBattleInventory(saved: Player, fighting: Player) {
  if (saved.id !== fighting.id) return false;
  const state = (p: Player) => ({
    inventory: p.inventory,
    equipment: p.equipment,
    quantities: p.quantities ?? {},
    armorWear: p.armorWear ?? {},
  });
  if (JSON.stringify(state(saved)) === JSON.stringify(state(fighting)))
    return false;
  Object.assign(saved, structuredClone(state(fighting)));
  return true;
}
