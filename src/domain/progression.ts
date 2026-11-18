import { item, rewards } from "../data/catalog";
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
    attack: 12 + gear.reduce((sum, entry) => sum + (entry?.attack ?? 0), 0),
    armor: gear.reduce((n, i) => n + (i?.armor ?? 0), 0),
  };
}
export function purchase(p: Player, id: string) {
  const i = item(id);
  if (!i || p.inventory.includes(id) || p.gold < i.price) return false;
  p.gold -= i.price;
  p.inventory.push(id);
  return true;
}
/** A released throwable is lost even on a miss or an abandoned battle. */
export function consumeItem(p: Player, id: string) {
  if (!p.inventory.includes(id)) return false;
  p.inventory = p.inventory.filter((owned) => owned !== id);
  for (const slot of Object.keys(p.equipment) as EquipmentSlot[])
    if (p.equipment[slot] === id) delete p.equipment[slot];
  return true;
}
export function canEquip(p: Player, id: string, slot: EquipmentSlot) {
  const i = item(id);
  return Boolean(
    i && i.slot === slotCategory[slot] && p.inventory.includes(id),
  );
}
export function equip(p: Player, id: string, slot: EquipmentSlot) {
  const i = item(id);
  if (!i || !canEquip(p, id, slot)) return false;
  for (const [position, worn] of Object.entries(p.equipment))
    if (worn === id) delete p.equipment[position as EquipmentSlot];
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
