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

/** Brace, pull the chest up into a roar, then settle without moving equipment grips. */
export function ragePose(base: Pose, elapsed: number): Pose {
  const t = Math.max(0, Math.min(1, elapsed / skillBalance.rageActivation));
  const beats = [
    [0, 0, 0, 0],
    [0.22, 5, 0.05, 0.05],
    [0.5, -3, -0.16, -0.2],
    [0.78, -1, -0.07, -0.09],
    [1, 0, 0, 0],
  ];
  const end = beats.findIndex((beat, i) => i > 0 && t <= beat[0]);
  const a = beats[Math.max(0, end - 1)],
    b = beats[end < 0 ? beats.length - 1 : end];
  const phase = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
  const blend = phase * phase * (3 - 2 * phase);
  return {
    ...base,
    rootY: (base.rootY ?? 0) + a[1] + (b[1] - a[1]) * blend,
    torso: (base.torso ?? 0) + a[2] + (b[2] - a[2]) * blend,
    head: (base.head ?? 0) + a[3] + (b[3] - a[3]) * blend,
  };
}
