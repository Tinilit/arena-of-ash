import { item, enemies, rewards } from "../data/catalog";
import type { Player, Slot, Attribute } from "./model";
export function stats(p: Player) {
  const gear = Object.values(p.equipment).map((id) => item(id!));
  return {
    hp: 60 + p.attributes.vitality * 4,
    stamina: 50 + p.attributes.endurance * 5,
    attack:
      6 +
      p.attributes.strength * 0.9 +
      gear.reduce((n, i) => n + (i?.attack ?? 0), 0),
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
export function equip(p: Player, id: string, slot: Slot) {
  const i = item(id);
  if (!i || i.slot !== slot || !p.inventory.includes(id)) return false;
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
