import { item, enemies, rewards } from "../data/catalog";
import {
  slotCategory,
  type Player,
  type EquipmentSlot,
  type Attribute,
} from "./model";
export function stats(p: Player) {
  const armor = [p.equipment.helmet, p.equipment.body].map((id) =>
    item(id ?? ""),
  );
  const weapon = primaryWeapon(p);
  const gear = [weapon, ...armor];
  return {
    hp: 60 + p.attributes.vitality * 4,
    stamina: 50 + p.attributes.endurance * 5,
    attack:
      6 +
      p.attributes.strength * 0.9 +
      gear.reduce((sum, entry) => sum + (entry?.attack ?? 0), 0),
    armor: gear.reduce((n, i) => n + (i?.armor ?? 0), 0),
    defense: p.attributes.defense,
  };
}
export function purchase(p: Player, id: string) {
  const i = item(id);
  if (!i || p.inventory.includes(id) || p.gold < i.price) return false;
  p.gold -= i.price;
  p.inventory.push(id);
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
export const threshold = (level: number) => 100 + 50 * (level - 1);
export function experience(p: Player, amount: number) {
  p.xp += amount;
  let levels = 0;
  while (p.xp >= threshold(p.level)) {
    p.xp -= threshold(p.level);
    p.level++;
    p.points += 2;
    levels++;
  }
  return levels;
}
export function allocate(p: Player, a: Attribute) {
  if (p.points < 1) return false;
  p.points--;
  p.attributes[a]++;
  return true;
}
export function reward(p: Player, battleId: string, win: boolean) {
  if (p.rewarded.includes(battleId)) return null;
  const r = win ? rewards.victory : rewards.defeat;
  p.rewarded.push(battleId);
  p.gold += r.gold;
  const levels = experience(p, r.xp);
  if (win) p.progress = Math.min(enemies.length - 1, p.progress + 1);
  return { ...r, levels };
}
export function opponent(p: Player): Player {
  const e = enemies[Math.min(p.progress, enemies.length - 1)];
  return {
    ...structuredClone(p),
    id: "enemy",
    name: e.name,
    attributes: { ...e.attributes },
    equipment: { ...e.equipment },
  };
}

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
