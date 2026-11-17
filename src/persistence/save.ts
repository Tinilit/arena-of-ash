import { attributes, createPlayer, type Player } from "../domain/model";
import { item } from "../data/catalog";
import { isPairedWeapon, threshold } from "../domain/progression";
export const SAVE_KEY = "arena-of-ash.v1";
export function serialize(p: Player) {
  return JSON.stringify({ version: 1, player: p });
}
export function deserialize(raw: string | null): Player {
  try {
    const data = JSON.parse(raw ?? "null");
    if (data?.version !== 1) throw Error();
    const p = data.player as Player;
    const integer = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
    if (
      !p ||
      typeof p.id !== "string" ||
      typeof p.name !== "string" ||
      !p.name ||
      !["level", "xp", "gold", "points", "progress"].every((k) =>
        integer(p[k as keyof Player]),
      ) ||
      p.level < 1 ||
      p.xp >= threshold(p.level) ||
      p.progress > 2 ||
      !attributes.every((a) => integer(p.attributes?.[a])) ||
      !Array.isArray(p.inventory) ||
      new Set(p.inventory).size !== p.inventory.length ||
      !p.inventory.every((id) => typeof id === "string" && item(id)) ||
      !p.equipment ||
      Array.isArray(p.equipment) ||
      !Object.entries(p.equipment).every(
        ([slot, id]) =>
          typeof id === "string" &&
          item(id)?.slot === slot &&
          p.inventory.includes(id),
      ) ||
      !Array.isArray(p.rewarded) ||
      !p.rewarded.every((id) => typeof id === "string")
    )
      throw Error();
    if (isPairedWeapon(p)) delete p.equipment.shield;
    return p;
  } catch {
    return createPlayer();
  }
}
export class SaveStore {
  warning = false;
  load() {
    try {
      return deserialize(localStorage.getItem(SAVE_KEY));
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
