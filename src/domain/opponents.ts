import { items, enemies } from "../data/catalog";
import {
  createPlayer,
  type Item,
  type Player,
  type EquipmentSlot,
} from "./model";
import type { Random } from "../utils/random";
import { bossAt, createBoss } from "./ladder";
export const opponentTier = (wins: number) => Math.min(2, Math.floor(wins / 3));
export const opponentName = (wins: number) =>
  bossAt(wins)?.name ?? enemies[opponentTier(wins)].name;
/** Equipment quality rises with victories; randomness has its own injected stream. */
export function opponent(player: Player, random: Random = Math.random): Player {
  const boss = bossAt(player.progress);
  if (boss) return createBoss(boss, player.progress);
  const tier = opponentTier(player.progress);
  const pick = (pool: Item[]) =>
    pool.length
      ? pool[
          Math.min(
            pool.length - 1,
            Math.floor(Math.max(0, random()) * pool.length),
          )
        ]
      : undefined;
  const weapons = items
    .filter((i) => i.slot === "weapon")
    .sort((a, b) => a.attack - b.attack || a.id.localeCompare(b.id));
  const minimum = [0, 16, 21][tier],
    maximum = [16, 21, Infinity][tier];
  let pool = weapons.filter((i) => i.attack >= minimum && i.attack <= maximum);
  if (!pool.length) {
    const affordable = weapons.filter((i) => i.attack <= maximum);
    pool = affordable.length ? affordable.slice(-2) : weapons.slice(0, 1);
  }
  const equipment: Player["equipment"] = {};
  const main = pick(pool);
  if (main) equipment.rightHand = main.id;
  if (
    random() < Math.min(0.75, 0.2 + tier * 0.2 + player.progress * 0.01) &&
    main?.hands !== 2
  ) {
    const others = pool.filter((i) => i.id !== main?.id && i.hands !== 2);
    const fallback = weapons.filter(
      (i) => i.id !== main?.id && i.hands !== 2 && i.attack <= maximum,
    );
    const offhand = pick(others.length ? others : fallback.slice(-1));
    if (offhand) equipment.leftHand = offhand.id;
  }
  for (const [slot, category] of [
    ["body", "chest"],
    ["helmet", "helmet"],
  ] as const) {
    if (!tier) continue;
    const armor = items
      .filter((i) => i.slot === category)
      .sort((a, b) => a.armor - b.armor || a.id.localeCompare(b.id));
    const chosen =
      tier === 1
        ? armor[0]
        : pick(armor.filter((i) => i.armor === armor.at(-1)?.armor));
    if (chosen) equipment[slot as EquipmentSlot] = chosen.id;
  }
  return {
    ...createPlayer(),
    id: "enemy",
    name: opponentName(player.progress),
    gold: 0,
    inventory: [...new Set(Object.values(equipment))] as string[],
    equipment,
    progress: player.progress,
  };
}
