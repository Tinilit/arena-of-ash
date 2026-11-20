import type { Pose } from "./animation";
import { combatRest } from "./locomotion";
import { dodgeRules, type Dodge } from "../combat/dodge";

const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
/** The front ankle stays planted while weight moves onto the stepping rear leg. */
export function dodgePose(
  base: Pose,
  d: Dodge,
  from: Pose,
  returning?: Pose,
): Pose {
  const lean: Pose = {
    ...base,
    rootX: -14,
    rootY: 12,
    rootR: 0,
    torso: -0.36,
    head: 0.08,
    plant: 1,
    nearFootX: from.nearFootX ?? 32,
    nearFootY: 0,
    nearFootRoll: 0,
    farFootX: -65,
    farFootY: 0,
    farFootRoll: 0,
  };
  let target: Pose = lean;
  let source = from;
  let t = smooth(d.elapsed / dodgeRules.enter);
  if (d.phase === "recover" || d.phase === "attackReturn") {
    source = returning ?? lean;
    target = { ...base, ...combatRest };
    t = smooth(d.elapsed / dodgeRules[d.phase]);
  } else if (d.phase === "retreat") {
    t = smooth(d.elapsed / dodgeRules.retreat);
    const step = Math.sin(Math.PI * t);
    return {
      ...lean,
      rootX: -14 * (1 - t),
      rootY: 3 + 9 * (1 - t) + 5 * step,
      torso: -0.36 * (1 - t) - 0.1 * step,
      head: 0.08 * (1 - t),
      nearFootX: (from.nearFootX ?? 32) * (1 - t) + 32 * t - 34 * step,
      nearFootY: -9 * step,
      farFootX: -65 + 37 * t,
      farFootY: -5 * step,
    };
  }
  const result: Pose = { ...base };
  for (const key of [
    "rootX",
    "rootY",
    "rootR",
    "torso",
    "head",
    "plant",
    "nearFootX",
    "nearFootY",
    "nearFootRoll",
    "farFootX",
    "farFootY",
    "farFootRoll",
  ])
    result[key] =
      (source[key] ?? base[key] ?? 0) * (1 - t) + (target[key] ?? 0) * t;
  if (d.phase === "lean" && d.elapsed < dodgeRules.enter)
    result.farFootY = -10 * Math.sin((Math.PI * d.elapsed) / dodgeRules.enter);
  return result;
}
