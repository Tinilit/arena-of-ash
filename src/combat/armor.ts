import type { Item, Player } from "../domain/model";
import { item } from "../data/catalog";
import { consumeItem } from "../domain/inventory";

export const armorSlots = ["helmet", "body"] as const;
export type ArmorSlot = (typeof armorSlots)[number];
/** Impact fatigue is internal; even a fully absorbed hit wears protection. */
export function armorDurability(definition: Item) {
  return definition.slot === "helmet"
    ? Math.max(30, 20 + definition.armor * 10)
    : Math.max(50, 30 + definition.armor * 14);
}
export function wearArmor(
  player: Player,
  rawDamage: number,
  region?: ArmorSlot,
) {
  const broken: { slot: ArmorSlot; itemId: string }[] = [];
  if (rawDamage <= 0) return broken;
  for (const slot of region ? [region] : armorSlots) {
    const id = player.equipment[slot],
      definition = item(id ?? "");
    if (!id || !definition) continue;
    const wear = (player.armorWear ??= {});
    wear[id] = (wear[id] ?? 0) + rawDamage;
    if (wear[id] >= armorDurability(definition)) {
      consumeItem(player, id, slot);
      delete wear[id];
      broken.push({ slot, itemId: id });
    }
  }
  return broken;
}

/** Surviving equipment is repaired; consumed/broken copies are never restored. */
export function repairArmor(player: Player) {
  const damaged = Object.keys(player.armorWear ?? {}).length > 0;
  if (player.armorWear) player.armorWear = {};
  return damaged;
}
export function armorDamage(player: Player, slot: ArmorSlot) {
  const id = player.equipment[slot],
    definition = item(id ?? "");
  return definition
    ? Math.min(1, (player.armorWear?.[id!] ?? 0) / armorDurability(definition))
    : 0;
}
