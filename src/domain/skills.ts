import type { EquipmentSlot, Item, Player } from "./model";
import { item } from "../data/catalog";
export type SkillId =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18;
export const skill = {
  dual: 1,
  heavy: 2,
  kick: 3,
  wrestling: 4,
  execution: 5,
  parry: 6,
  throwing: 7,
  ranged: 8,
  alchemy: 9,
  shield: 10,
  rage: 11,
  kipUp: 12,
  superman: 13,
  bash: 14,
  berserker: 15,
  counter: 16,
  secondWind: 17,
  heavyArmor: 18,
} as const;
export interface Skill {
  id: SkillId;
  name: string;
  description: string;
  enables: string;
  requires?: SkillId;
  key?: string;
}
export const skills: readonly Skill[] = [
  {
    id: 1,
    name: "Dual Wielding",
    description: "Fight with two independent one-handed weapons.",
    enables: "Two weapons · LMB/J and RMB/K",
  },
  {
    id: 2,
    name: "Heavy Weapons",
    description: "Wield two-handed melee weapons and shove with the shaft.",
    enables: "Greatswords, axes, hammers, polearms · V",
    key: "V",
  },
  {
    id: 3,
    name: "Kicking",
    description: "Push, stagger and sometimes knock an opponent down.",
    enables: "Ground and airborne kicks",
    key: "F",
  },
  {
    id: 4,
    name: "Wrestling",
    description: "Lift, carry, turn and throw a nearby opponent.",
    enables: "Grab · A/D: carry · H: throw",
    key: "H",
  },
  {
    id: 5,
    name: "Execution",
    description: "Finish a nearby grounded opponent with your weapon.",
    enables: "Armed grounded execution",
    key: "X",
  },
  {
    id: 6,
    name: "Parrying",
    description: "Time a parry to stun, shove and sometimes disarm.",
    enables: "Weapon parries and bolt deflections",
    key: "C",
  },
  {
    id: 7,
    name: "Throwing Weapons",
    description: "Throw hand weapons or a knife or axe from your belt.",
    enables: "Ctrl+hand attack · Q/E: belt throwables",
  },
  {
    id: 8,
    name: "Marksmanship",
    description: "Aim, fire and reload ranged weapons.",
    enables: "Crossbows · Mouse aim · Hand attack",
  },
  {
    id: 9,
    name: "Alchemy",
    description: "Drink healing, haste and future potions.",
    enables: "All belt potions · Q/E",
  },
  {
    id: 10,
    name: "Shield Mastery",
    description: "Carry a passive shield in the rear hand for extra armor.",
    enables: "Rear-hand shields · Passive armor",
  },
  {
    id: 11,
    name: "Battle Rage",
    description:
      "8s: +30% attack speed, +20% damage, -25% armor. Once per fight.",
    enables: "Temporary offensive stance",
    key: "Z",
  },
  {
    id: 12,
    name: "Kip-Up",
    description: "Spring to your feet with a half-second jumping recovery.",
    enables: "Automatic fast get-up",
  },
  {
    id: 13,
    name: "Superman Punch",
    description: "Leap forward with a one-handed melee weapon for +40% damage.",
    enables: "Requires a held one-handed melee weapon",
    key: "T",
  },
  {
    id: 14,
    name: "Shield Bash",
    description: "Strike with your shield to damage, stun and push.",
    enables: "Equipped shield · 2.5s cooldown",
    requires: 10,
    key: "V",
  },
  {
    id: 15,
    name: "Berserker",
    description: "Below half health: up to +30% damage and +25% attack speed.",
    enables: "Passive low-health scaling",
  },
  {
    id: 16,
    name: "Counterstrike",
    description:
      "Follow a successful parry with a quick physical counterattack.",
    enables: "Automatic armed riposte",
    requires: 6,
  },
  {
    id: 17,
    name: "Second Wind",
    description: "Recover 30 HP below 20% health, once per fight.",
    enables: "Automatic emergency healing",
  },
  {
    id: 18,
    name: "Heavy Armor",
    description: "Wear heavy helmets, body armor and shields.",
    enables: "Heavy armor equipment",
  },
];
export const equipmentClass = (i: Item): "light" | "heavy" =>
  i.equipmentClass ??
  (i.slot === "weapon" && i.hands === 2 && i.weaponType !== "crossbow"
    ? "heavy"
    : "light");
export const activeSkills = () => skills.filter((s) => s.id !== skill.bash);
export function randomSkills(
  p: Player,
  count: number,
  random = Math.random,
): SkillId[] {
  const result: Player = { ...p, skills: [] };
  while (result.skills!.length < count) {
    const pool = (
      result.skills!.length >= activeSkills().length ? skills : activeSkills()
    ).filter((s) => canLearn(result, s.id));
    if (!pool.length) break;
    result.skills!.push(
      pool[
        Math.min(
          pool.length - 1,
          Math.floor(Math.max(0, random()) * pool.length),
        )
      ].id,
    );
  }
  return result.skills!;
}
export const allSkillIds = skills.map((s) => s.id);
export const enemySkills = allSkillIds.filter((id) => id <= 10);
export const hasSkill = (p: Player, id: SkillId) =>
  p.skills?.includes(id) === true;
export const prerequisitesMet = (p: Player, id: SkillId) => {
  const s = skills.find((s) => s.id === id);
  return Boolean(s && (!s.requires || hasSkill(p, s.requires)));
};
export const canLearn = (p: Player, id: SkillId) =>
  !hasSkill(p, id) && prerequisitesMet(p, id);
export function itemRequirements(i: Item): SkillId[] {
  if (i.slot === "shield")
    return equipmentClass(i) === "heavy"
      ? [skill.shield, skill.heavyArmor]
      : [skill.shield];
  if (["helmet", "chest"].includes(i.slot) && equipmentClass(i) === "heavy")
    return [skill.heavyArmor];
  if (i.use === "drink") return [skill.alchemy];
  if (i.use === "throw") return [skill.throwing];
  if (i.weaponType === "crossbow") return [skill.ranged];
  if (i.slot === "weapon" && equipmentClass(i) === "heavy")
    return [skill.heavy];
  return [];
}
export const itemUsable = (p: Player, i: Item) =>
  itemRequirements(i).every((id) => hasSkill(p, id));
export function equipmentAllowed(p: Player, i: Item, slot: EquipmentSlot) {
  if (!itemUsable(p, i) || (i.slot === "shield" && slot !== "rightHand"))
    return false;
  if (i.slot === "weapon" && i.hands !== 2) {
    const held = item(
      p.equipment[slot === "leftHand" ? "rightHand" : "leftHand"] ?? "",
    );
    if (held?.slot === "weapon" && held.hands !== 2 && !hasSkill(p, skill.dual))
      return false;
  }
  return true;
}
export function sanitizeEquipment(p: Player) {
  for (const slot of [
    "rightHand",
    "leftHand",
    "helmet",
    "body",
    "belt1",
    "belt2",
  ] as const) {
    const def = item(p.equipment[slot] ?? "");
    if (def && !itemUsable(p, def)) delete p.equipment[slot];
  }
  if (
    !hasSkill(p, skill.dual) &&
    item(p.equipment.rightHand ?? "")?.slot === "weapon" &&
    item(p.equipment.leftHand ?? "")?.slot === "weapon"
  )
    delete p.equipment.leftHand;
}
export const skillBalance = {
  rageDuration: 8000,
  rageSpeed: 1.3,
  rageDamage: 1.2,
  rageArmor: 0.75,
  kipUpDuration: 500,
  supermanDuration: 1200,
  supermanMinDistance: 175,
  bashDuration: 700,
  counterSpeed: 300,
  supermanDamage: 1.4,
  supermanSpeed: 380,
  supermanJump: 390,
  supermanRecovery: 650,
  bashDamage: 12,
  bashStun: 700,
  bashCooldown: 2500,
  berserkerDamage: 0.3,
  berserkerSpeed: 0.25,
  counterDamage: 1.15,
  counterDuration: 480,
  secondWindHealth: 30,
  secondWindThreshold: 0.2,
} as const;
