import { item } from "../data/catalog";
import type { Player, EquipmentSlot } from "./model";

export function quantity(p: Player, id: string) {
  return p.inventory.includes(id)
    ? p.quantities && Object.hasOwn(p.quantities, id)
      ? p.quantities[id]
      : 1
    : 0;
}
export function equippedCount(p: Player, id: string) {
  return Object.values(p.equipment).filter((worn) => worn === id).length;
}
export function availableQuantity(p: Player, id: string) {
  return Math.max(0, quantity(p, id) - equippedCount(p, id));
}
export const backpack = (p: Player) =>
  p.inventory.filter((id) => availableQuantity(p, id) > 0);
export function addItem(p: Player, id: string, amount = 1) {
  const next = quantity(p, id) + amount;
  if (
    !item(id) ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    next > 1000000
  )
    return false;
  if (!p.inventory.includes(id)) p.inventory.push(id);
  (p.quantities ??= {})[id] = next;
  return true;
}
/** Consume exactly one copy from its occupied slot, preserving all reserves. */
export function consumeItem(p: Player, id: string, source?: EquipmentSlot) {
  const owned = quantity(p, id);
  if (!owned) return false;
  const slot =
    source ??
    (Object.keys(p.equipment) as EquipmentSlot[]).find(
      (s) => p.equipment[s] === id,
    );
  if (source && p.equipment[source] !== id) return false;
  if (slot) delete p.equipment[slot];
  if (p.armorWear && (slot === "helmet" || slot === "body" || owned === 1))
    delete p.armorWear[id];
  if (owned === 1) {
    p.inventory = p.inventory.filter((entry) => entry !== id);
    if (p.quantities) delete p.quantities[id];
  } else (p.quantities ??= {})[id] = owned - 1;
  return true;
}
