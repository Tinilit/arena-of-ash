import { equipmentAllowed, type SkillId } from "./skills";
import { item, items } from "../data/catalog";
import {
  createPlayer,
  slotCategory,
  type Player,
  type EquipmentSlot,
} from "./model";

export interface Boss {
  id: string;
  name: string;
  title: string;
  specialty: string;
  equipment: Player["equipment"];
  profile: NonNullable<Player["combatProfile"]>;
}
export const bosses: readonly Boss[] = [
  {
    id: "cassian",
    name: "Cassian the Red",
    title: "The Crimson Duelist",
    specialty: "Fast strikes · 125 HP · 120% size",
    equipment: {
      rightHand: "iron",
      leftHand: "rust",
      body: "chainmail",
      helmet: "closed-helm",
      belt1: "throwing-knife",
      belt2: "healing-potion",
    },
    profile: {
      bossId: "cassian",
      size: 1.2,
      movement: 1,
      attackSpeed: 1.25,
      maxHealth: 125,
    },
  },
  {
    id: "brakka",
    name: "Brakka Stonefist",
    title: "The Iron Colossus",
    specialty: "Heavy armor · 160 HP · 130% size",
    equipment: {
      rightHand: "war-hammer",
      body: "cuirass",
      helmet: "viking",
      belt1: "throwing-axe",
      belt2: "healing-potion",
    },
    profile: {
      bossId: "brakka",
      size: 1.3,
      movement: 0.9,
      attackSpeed: 0.9,
      maxHealth: 160,
    },
  },
  {
    id: "vesper",
    name: "Vesper Ashwind",
    title: "The Ash Huntress",
    specialty: "Fast movement · 140 HP · 125% size",
    equipment: {
      rightHand: "crossbow",
      body: "chainmail",
      helmet: "legionary-helm",
      belt1: "speed-potion",
      belt2: "throwing-knife",
    },
    profile: {
      bossId: "vesper",
      size: 1.25,
      movement: 1.3,
      attackSpeed: 1.1,
      maxHealth: 140,
    },
  },
];
export const ladderLength = 18;
export const bossAt = (wins: number) =>
  wins < ladderLength && wins % 6 === 5
    ? bosses[Math.floor(wins / 6)]
    : undefined;
export function ladderEntries(wins: number) {
  return Array.from({ length: ladderLength }, (_, index) => ({
    index,
    stage: Math.floor(index / 6) + 1,
    boss: bossAt(index),
    name: bossAt(index)?.name ?? `Challenger ${(index % 6) + 1}`,
    state: index < wins ? "defeated" : index === wins ? "current" : "upcoming",
  }));
}
/** Fixed encounters; catalog fallbacks keep custom runtime catalogs playable. */
export function createBoss(
  definition: Boss,
  progress: number,
  learned: SkillId[] = [],
): Player {
  const equipment: Player["equipment"] = {};
  const fallback: Record<string, string> = {
    chainmail: "plate",
    "closed-helm": "cap",
    cuirass: "plate",
    "legionary-helm": "viking",
  };
  for (const [slot, id] of Object.entries(definition.equipment)) {
    const position = slot as EquipmentSlot;
    const chosen =
      item(id!) ??
      item(fallback[id!] ?? "") ??
      items.find(
        (i) =>
          i.slot === slotCategory[position] &&
          (position !== "leftHand" || i.hands !== 2),
      );
    const profile = { ...createPlayer(), equipment, skills: learned };
    const compatible =
      chosen && equipmentAllowed(profile, chosen, position)
        ? chosen
        : items.find(
            (i) =>
              i.slot === slotCategory[position] &&
              (position !== "leftHand" || i.hands !== 2) &&
              equipmentAllowed(profile, i, position),
          );
    if (compatible) equipment[position] = compatible.id;
  }
  if (item(equipment.rightHand ?? "")?.hands === 2) delete equipment.leftHand;
  const quantities: Record<string, number> = {};
  for (const id of Object.values(equipment))
    if (id) quantities[id] = (quantities[id] ?? 0) + 1;
  return {
    ...createPlayer(),
    skills: [...learned],
    quantities,
    id: "enemy",
    name: definition.name,
    gold: 0,
    progress,
    inventory: [...new Set(Object.values(equipment))] as string[],
    equipment,
    combatProfile: { ...definition.profile },
  };
}
