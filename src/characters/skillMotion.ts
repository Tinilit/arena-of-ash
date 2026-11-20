import type { Pose } from "./animation";
import type { Hand } from "../domain/model";
import { knockdownPose } from "./knockdownMotion";
import { knockdownTiming } from "../combat/realtime";
import { skillBalance } from "../domain/skills";
/** A compact tuck, supported spring and soft landing using the original fixed bones. */
export function kipUpPose(elapsed: number, from: Pose, hand: Hand): Pose {
  const t = Math.min(1, elapsed / skillBalance.kipUpDuration);
  const p = knockdownPose(
    { phase: "getUp", elapsed: t * knockdownTiming.getUp },
    from,
    hand,
  );
  if (t > 0.22 && t < 0.85) {
    const air = Math.sin((Math.PI * (t - 0.22)) / 0.63);
    p.rootY = (p.rootY ?? 0) - air * 55;
    p.bodyFloor = 0;
    p.plant = 0;
    p.nearThigh = -0.8 * (1 - t);
    p.nearShin = 1.6 * (1 - t);
    p.farThigh = -0.6 * (1 - t);
    p.farShin = 1.4 * (1 - t);
  }
  return p;
}
