import type { Pose } from "./animation";
import type { Hand } from "../domain/model";
import { parryRules } from "../combat/parry";
const smooth = (v: number) => {
  const n = Math.max(0, Math.min(1, v));
  return n * n * (3 - 2 * n);
};
/** A compact weapon deflection followed by a controlled recovery. */
export function parryPose(
  base: Pose,
  age: number,
  hand: Hand,
  shoveAge?: number,
): Pose {
  const weight = smooth(age / 60) * smooth((parryRules.duration - age) / 150);
  const prefix = hand === "rear" ? "far" : "near";
  const p = { ...base };
  for (const [suffix, target] of [
    ["HandX", 62],
    ["HandY", 18],
    ["Wrist", 0.4],
    ["WeaponGrip", Math.PI / 2],
  ] as const) {
    const key = prefix + suffix;
    p[key] = (base[key] ?? 0) * (1 - weight) + target * weight;
  }
  p.torso = (base.torso ?? 0) - 0.08 * weight;
  p.head = (base.head ?? 0) - 0.03 * weight;
  if (shoveAge !== undefined) {
    const other = hand === "rear" ? "near" : "far";
    const reach =
      smooth(shoveAge / parryRules.shoveImpact) *
      smooth((parryRules.shoveDuration - shoveAge) / 190);
    p[other + "HandX"] =
      (base[other + "HandX"] ?? 14) * (1 - reach) + 70 * reach;
    p[other + "HandY"] =
      (base[other + "HandY"] ?? 69) * (1 - reach) + 12 * reach;
    p[other + "Wrist"] = 0.1;
    p[other + "Shove"] = reach > 0.01 ? 1 : 0;
    p.torso = (base.torso ?? 0) + 0.13 * reach;
  }
  return p;
}
