import type { Hand, Player } from "../domain/model";
import { item } from "../data/catalog";
import {
  hasSkill,
  itemUsable,
  skill,
  skillBalance,
  type SkillId,
} from "../domain/skills";
import { weaponForHand, stats, twoHandWeapon } from "../domain/progression";
import type { ArenaFighter, ArenaInput } from "./realtime";
export function actionRequirement(
  p: Player,
  action: string,
  hand: Hand = "rear",
): SkillId | undefined {
  if (action === "shoot") return skill.ranged;
  if (action === "quick") {
    const w = weaponForHand(p, hand);
    return w?.weaponType === "crossbow"
      ? skill.ranged
      : w?.hands === 2
        ? skill.heavy
        : undefined;
  }
  return (
    {
      kick: skill.kick,
      grapple: skill.wrestling,
      finish: skill.execution,
      parry: skill.parry,
      throw: skill.throwing,
      drink: skill.alchemy,
      guard: skill.shield,
      shove: skill.heavy,
      rage: skill.rage,
      superman: skill.superman,
      bash: skill.bash,
      counter: skill.counter,
    } as Record<string, SkillId>
  )[action];
}
export function actionAllowed(p: Player, action: string, hand: Hand = "rear") {
  const required = actionRequirement(p, action, hand);
  if (required && !hasSkill(p, required)) return false;
  const weapon = weaponForHand(p, hand);
  if (action === "shoot" && weapon?.weaponType !== "crossbow") return false;
  if (
    ["quick", "shoot", "superman", "counter", "finish"].includes(action) &&
    (!weapon || !itemUsable(p, weapon))
  )
    return false;
  if (
    action === "superman" &&
    (weapon?.hands === 2 || weapon?.weaponType === "crossbow")
  )
    return false;
  if (
    (action === "guard" || action === "bash") &&
    item(p.equipment.leftHand ?? "")?.slot !== "shield"
  )
    return false;
  if (
    hand === "front" &&
    weaponForHand(p, "rear") &&
    weapon &&
    !hasSkill(p, skill.dual)
  )
    return false;
  return true;
}
export function permittedInput(p: Player, input: ArenaInput): ArenaInput {
  const c = { ...input };
  if (c.attack === "counter") delete c.attack;
  if (twoHandWeapon(p)) {
    if (c.attack === "quick") c.hand = "rear";
    if (c.attacks?.length) c.attacks = ["rear"];
  }
  if (c.attack && !actionAllowed(p, c.attack, c.hand)) delete c.attack;
  c.attacks = c.attacks?.filter((h) => actionAllowed(p, "quick", h));
  c.throws = c.throws?.filter((h) => actionAllowed(p, "throw", h));
  for (const key of ["grapple", "parry", "guard", "rage"] as const)
    if (c[key] && !actionAllowed(p, key)) delete c[key];
  if (c.belt) {
    const def = item(p.equipment[c.belt] ?? "");
    if (!def || !itemUsable(p, def)) delete c.belt;
  }
  return c;
}
export const berserkerIntensity = (f: ArenaFighter) =>
  hasSkill(f.model, skill.berserker)
    ? Math.max(0, Math.min(1, 1 - f.hp / (stats(f.model).hp * 0.5)))
    : 0;
export const attackRate = (f: ArenaFighter) =>
  ((f.rageRemaining ?? 0) > 0 ? skillBalance.rageSpeed : 1) *
  (1 + berserkerIntensity(f) * skillBalance.berserkerSpeed);
export const damageMultiplier = (f: ArenaFighter) =>
  ((f.rageRemaining ?? 0) > 0 ? skillBalance.rageDamage : 1) *
  (1 + berserkerIntensity(f) * skillBalance.berserkerDamage);
export const resolvedDamage = (raw: number, d: ArenaFighter) =>
  Math.max(
    0,
    Math.round(
      raw -
        stats(d.model).armor *
          ((d.rageRemaining ?? 0) > 0 ? skillBalance.rageArmor : 1),
    ),
  );
