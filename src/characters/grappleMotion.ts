import type { Pose } from "./animation";
import type { GrapplePoseState } from "../combat/grapples";
import { grappleRules } from "../combat/grapples";
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const blend = (a: number, b: number, t: number) => a + (b - a) * t;
export function grapplePose(base: Pose, state: GrapplePoseState): Pose {
  const p: Pose = { ...base, grappling: 1 };
  if (state.role === "target") {
    const t =
      state.phase === "lift" ? ease(state.elapsed / grappleRules.lift) : 1;
    return {
      ...p,
      carried: 1,
      held: state.phase === "air" ? 0 : 1,
      plant: 0,
      rootY: 0,
      rootX: 0,
      rootR:
        state.phase === "air"
          ? -Math.PI / 2 + 0.65 * ease(state.elapsed / 850)
          : (-Math.PI / 2) * t,
      torso: 0,
      head: -0.12 * t,
      nearThigh: blend(base.nearThigh ?? 0, -0.45, t),
      nearShin: blend(base.nearShin ?? 0, 1.05, t),
      farThigh: blend(base.farThigh ?? 0, 0.15, t),
      farShin: blend(base.farShin ?? 0, 0.95, t),
      nearHandX: blend(base.nearHandX ?? 14, 28, t),
      nearHandY: blend(base.nearHandY ?? 69, 45, t),
      nearWrist: 0.1,
      farHandX: blend(base.farHandX ?? 58, 32, t),
      farHandY: blend(base.farHandY ?? 25, 42, t),
      farWrist: 0.1,
    };
  }
  let t =
    state.phase === "reach"
      ? 0
      : state.phase === "lift"
        ? ease(state.elapsed / grappleRules.lift)
        : 1;
  if (state.phase === "throw")
    t =
      1 -
      ease(
        Math.max(0, state.elapsed - grappleRules.release) /
          (grappleRules.throwDuration - grappleRules.release),
      );
  const high = ease(Math.max(0, t - 0.5) * 2),
    low = ease(Math.min(1, t * 2));
  p.farHandX = blend(blend(60, 50, low), -12, high);
  p.farHandY = blend(blend(18, -35, low), -66, high);
  p.nearHandX = blend(blend(50, 45, low), -8, high);
  p.nearHandY = blend(blend(25, -40, low), -70, high);
  p.farWrist = p.nearWrist = 0.1;
  p.torso = -0.025;
  p.head = 0.06;
  p.rootY = (base.rootY ?? 0) + 18 * (1 - t);
  p.plant = 1;
  return p;
}
