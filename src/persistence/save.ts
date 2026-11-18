import {
  createPlayer,
  slotCategory,
  type EquipmentSlot,
  type Player,
} from "../domain/model";
import { item } from "../data/catalog";
export const SAVE_KEY = "arena-of-ash.v3";
export function serialize(p: Player) {
  return JSON.stringify({ version: 3, player: p });
}
export function deserialize(raw: string | null): Player {
  try {
    const data = JSON.parse(raw ?? "null");
    if (data?.version !== 3 && data?.version !== 2) throw Error();
    const p = data.player as Player;
    if (Array.isArray(p?.inventory))
      p.inventory = p.inventory.filter((id) => !["net", "flask"].includes(id));
    if (p?.equipment && typeof p.equipment === "object")
      for (const [slot, id] of Object.entries(p.equipment))
        if (["net", "flask"].includes(id))
          delete p.equipment[slot as EquipmentSlot];
    const integer = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
    if (
      !p ||
      typeof p.id !== "string" ||
      typeof p.name !== "string" ||
      !p.name ||
      !["gold", "progress"].every((k) => integer(p[k as keyof Player])) ||
      !Array.isArray(p.inventory) ||
      new Set(p.inventory).size !== p.inventory.length ||
      !p.inventory.every((id) => typeof id === "string" && item(id)) ||
      !p.equipment ||
      Array.isArray(p.equipment) ||
      new Set(Object.values(p.equipment)).size !==
        Object.values(p.equipment).length ||
      !Object.entries(p.equipment).every(
        ([slot, id]) =>
          typeof id === "string" &&
          Object.hasOwn(slotCategory, slot) &&
          item(id)?.slot === slotCategory[slot as EquipmentSlot] &&
          p.inventory.includes(id),
      ) ||
      !Array.isArray(p.rewarded) ||
      !p.rewarded.every((id) => typeof id === "string")
    )
      throw Error();
    return {
      id: p.id,
      name: p.name,
      gold: p.gold,
      inventory: p.inventory,
      equipment: p.equipment,
      progress: p.progress,
      rewarded: p.rewarded,
    };
  } catch {
    return createPlayer();
  }
}
export class SaveStore {
  warning = false;
  load() {
    try {
      return deserialize(
        localStorage.getItem(SAVE_KEY) ??
          localStorage.getItem("arena-of-ash.v2"),
      );
    } catch {
      this.warning = true;
      return createPlayer();
    }
  }
  save(p: Player) {
    try {
      localStorage.setItem(SAVE_KEY, serialize(p));
      return true;
    } catch {
      this.warning = true;
      return false;
    }
  }
}
