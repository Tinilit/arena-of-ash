import { item, rewards } from "../data/catalog";
import { equipmentAllowed } from "./skills";
import { quantity, availableQuantity, addItem } from "./inventory";
export {
  consumeItem,
  quantity,
  availableQuantity,
  backpack,
  addItem,
} from "./inventory";
import {
  slotCategory,
  handSlots,
  type Hand,
  type Player,
  type EquipmentSlot,
} from "./model";
export function stats(p: Player, hand?: Hand) {
  const armor = [
    p.equipment.helmet,
    p.equipment.body,
    ...(item(p.equipment.rightHand ?? "")?.slot === "shield"
      ? [p.equipment.rightHand]
      : []),
  ].map((id) => item(id ?? ""));
  const weapon = hand ? weaponForHand(p, hand) : primaryWeapon(p);
  return {
    hp: p.combatProfile?.maxHealth ?? 100,
    attack: weapon?.attack ?? 0,
    armor: armor.reduce((n, i) => n + (i?.armor ?? 0), 0),
  };
}
export const salePrice = (id: string) => Math.floor((item(id)?.price ?? 0) / 2);
/** Sell a single backpack copy, never a worn copy or a reserved support grip. */
export function sell(p: Player, id: string) {
  if (
    !item(id) ||
    availableQuantity(p, id) < 1 ||
    !Number.isSafeInteger(p.gold + salePrice(id))
  )
    return false;
  const owned = quantity(p, id);
  if (owned === 1) {
    p.inventory = p.inventory.filter((entry) => entry !== id);
    if (p.quantities) delete p.quantities[id];
    if (p.armorWear) delete p.armorWear[id];
  } else (p.quantities ??= {})[id] = owned - 1;
  p.gold += salePrice(id);
  return true;
}
export function purchase(p: Player, id: string, amount = 1) {
  const i = item(id);
  if (
    !i ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > 1000 ||
    (!i.use && (quantity(p, id) > 0 || amount !== 1)) ||
    p.gold < i.price * amount
  )
    return false;
  if (!addItem(p, id, amount)) return false;
  p.gold -= i.price * amount;
  return true;
}
export function canEquip(p: Player, id: string, slot: EquipmentSlot) {
  const i = item(id);
  return Boolean(
    i &&
    (i.slot === slotCategory[slot] ||
      (i.slot === "shield" && slot === "rightHand")) &&
    equipmentAllowed(p, i, slot) &&
    p.inventory.includes(id) &&
    (i.hands !== 2 || slot === "rightHand"),
  );
}
/** Empty compatible slots take priority; a two-handed grip reserves both hands. */
export function freeEquipmentSlot(
  p: Player,
  id: string,
  preferred?: EquipmentSlot,
) {
  const definition = item(id);
  if (!definition) return undefined;
  const slots: EquipmentSlot[] =
    definition.slot === "weapon"
      ? ["rightHand", "leftHand"]
      : definition.slot === "shield"
        ? ["rightHand"]
        : definition.slot === "utility"
          ? ["belt1", "belt2"]
          : definition.slot === "helmet"
            ? ["helmet"]
            : definition.slot === "chest"
              ? ["body"]
              : [];
  if (preferred && slots.includes(preferred)) slots.unshift(preferred);
  return slots.find(
    (slot) =>
      !p.equipment[slot] &&
      equipmentAllowed(p, definition, slot) &&
      (definition.hands !== 2 ||
        (slot === "rightHand" && !p.equipment.leftHand)) &&
      (slot !== "leftHand" || !twoHandWeapon(p)),
  );
}
/** Backpack Equip fills a free slot before replacing the selected occupied slot. */
export function equipmentTarget(
  p: Player,
  id: string,
  preferred: EquipmentSlot,
): EquipmentSlot {
  const definition = item(id);
  if (definition?.slot === "weapon" && definition.hands !== 2) {
    const existing = (["rightHand", "leftHand"] as const).find(
      (s) => item(p.equipment[s] ?? "")?.slot === "weapon",
    );
    if (
      existing &&
      !equipmentAllowed(
        p,
        definition,
        existing === "rightHand" ? "leftHand" : "rightHand",
      )
    )
      return existing;
  }
  if (definition?.slot === "shield") return "rightHand";
  return (
    freeEquipmentSlot(p, id, preferred) ??
    (definition?.hands === 2
      ? "rightHand"
      : definition?.slot === slotCategory[preferred]
        ? preferred
        : definition?.slot === "helmet"
          ? "helmet"
          : definition?.slot === "chest"
            ? "body"
            : definition?.slot === "utility"
              ? "belt1"
              : "rightHand")
  );
}
export function equip(p: Player, id: string, slot: EquipmentSlot) {
  const i = item(id);
  if (!i || !canEquip(p, id, slot)) return false;
  if (p.equipment[slot] === id) return true;
  if (!availableQuantity(p, id)) {
    const worn = (Object.keys(p.equipment) as EquipmentSlot[]).find(
      (position) => p.equipment[position] === id,
    );
    if (worn) delete p.equipment[worn];
  }
  if (i.hands === 2) delete p.equipment.leftHand;
  else if (slot === "leftHand" && twoHandWeapon(p))
    delete p.equipment.rightHand;
  p.equipment[slot] = id;
  return true;
}
export function reward(p: Player, battleId: string, win: boolean) {
  if (p.rewarded.includes(battleId)) return null;
  const r = win ? rewards.victory : rewards.defeat;
  p.rewarded.push(battleId);
  p.gold += r.gold;
  if (win) p.progress++;
  return { ...r };
}
export { opponent, opponentName, opponentTier } from "./opponents";

export function unequip(p: Player, slot: EquipmentSlot) {
  if (!p.equipment[slot]) return false;
  delete p.equipment[slot];
  return true;
}
export function primaryWeapon(p: Player) {
  return weaponForHand(p, "rear") ?? weaponForHand(p, "front");
}
export function primaryHand(p: Player): "rear" | "front" {
  return weaponForHand(p, "rear") || !weaponForHand(p, "front")
    ? "rear"
    : "front";
}

export function weaponForHand(p: Player, hand: Hand) {
  const def = item(p.equipment[handSlots[hand]] ?? "");
  return def?.slot === "weapon" ? def : undefined;
}

/** A two-handed item is owned once and reserves the opposite hand. */
export function twoHandWeapon(p: Player) {
  const weapon = item(p.equipment.rightHand ?? "");
  return weapon?.hands === 2 ? weapon : undefined;
}
