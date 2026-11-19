import { item, rewards } from "../data/catalog";
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
  const armor = [p.equipment.helmet, p.equipment.body].map((id) =>
    item(id ?? ""),
  );
  const weapon = hand ? weaponForHand(p, hand) : primaryWeapon(p);
  const gear = [weapon, ...armor];
  return {
    hp: 100,
    attack: weapon
      ? 12 + gear.reduce((sum, entry) => sum + (entry?.attack ?? 0), 0)
      : 1,
    armor: gear.reduce((n, i) => n + (i?.armor ?? 0), 0),
  };
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
    i.slot === slotCategory[slot] &&
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
  return item(p.equipment.rightHand ?? p.equipment.leftHand ?? "");
}
export function primaryHand(p: Player): "rear" | "front" {
  return p.equipment.rightHand || !p.equipment.leftHand ? "rear" : "front";
}

export function weaponForHand(p: Player, hand: Hand) {
  return item(p.equipment[handSlots[hand]] ?? "");
}

/** A two-handed item is owned once and reserves the opposite hand. */
export function twoHandWeapon(p: Player) {
  const weapon = item(p.equipment.rightHand ?? "");
  return weapon?.hands === 2 ? weapon : undefined;
}
