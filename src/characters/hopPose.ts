import type { Pose } from "./animation";
import { hopDefinitions, type Hop } from "../combat/hops";
import { arenaRules } from "../combat/realtime";

const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
/** Plant and compress before launch; release/fold legs in flight; absorb landing. */
export function hopPose(base: Pose, hop: Hop): Pose {
  const forward = hop.kind === "forwardHop",
    definition = hopDefinitions[hop.kind];
  if (hop.phase === "anticipation") {
    const t = ease(hop.elapsed / definition.anticipation);
    return {
      ...base,
      rootY: (base.rootY ?? 0) + 12 * t,
      torso: (base.torso ?? 0) + (forward ? 0.08 : -0.06) * t,
      plant: 1,
    };
  }
  if (hop.phase === "landing") {
    const t = ease(hop.elapsed / definition.landing);
    return {
      ...base,
      rootY: (base.rootY ?? 0) + 12 * (1 - t),
      torso: (base.torso ?? 0) + (forward ? 0.07 : -0.04) * (1 - t),
      plant: 1,
    };
  }
  const flight = (2 * definition.jumpSpeed * 1000) / arenaRules.gravity;
  const fold = ease(hop.elapsed / 65) * ease((flight - hop.elapsed) / 65);
  const folded: Pose = {
    ...base,
    rootY: 0,
    torso: forward ? 0.08 : -0.05,
    plant: 0,
    nearThigh: forward ? -0.85 : -0.15,
    nearShin: forward ? 1.2 : 0.65,
    farThigh: forward ? 0.2 : 0.1,
    farShin: 0.75,
    nearFootAngle: forward ? -0.25 : -0.45,
    farFootAngle: -0.65,
  };
  const support: Pose = {
    ...base,
    rootY: (base.rootY ?? 0) + 12,
    torso: (base.torso ?? 0) + (forward ? 0.08 : -0.05),
    plant: 1,
  };
  const result: Pose = {};
  for (const key of Object.keys(folded))
    result[key] =
      (support[key] ?? 0) + ((folded[key] ?? 0) - (support[key] ?? 0)) * fold;
  return result;
}
