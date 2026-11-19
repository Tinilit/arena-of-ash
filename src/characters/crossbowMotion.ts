import type { Pose } from "./animation";
import { rotate } from "./kinematics";
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
/** Rear hand on the trigger, front hand underneath the fore-end. */
export function crossbowPose(base: Pose, phase?: number, ready = true): Pose {
  const relaxed = Math.max(
    0,
    Math.min(
      1,
      ((base.weaponGrip ?? Math.PI / 2) - Math.PI / 2) / (Math.PI / 4),
    ),
  );
  let x = 50 - 6 * relaxed,
    y = 32 * relaxed,
    angle = 1.5 + 0.6 * relaxed;
  let loaded = ready ? 1 : 0,
    draw = ready ? 1 : 0;
  if (phase !== undefined) {
    const aim = smooth(phase / 0.13),
      reload =
        smooth((phase - 0.3) / 0.12) * (1 - smooth((phase - 0.84) / 0.12));
    x = x + (52 - x) * aim - 14 * reload;
    y = y + (-6 - y) * aim + 50 * reload;
    angle = angle + (Math.PI / 2 - angle) * aim + 0.23 * reload;
    loaded = phase < 0.2 || phase >= 0.84 ? 1 : 0;
    draw = phase < 0.2 ? 1 : phase < 0.4 ? 0 : smooth((phase - 0.4) / 0.35);
  }
  const support = rotate({ x: 5, y: -44 }, angle);
  return {
    ...base,
    rangedHold: 1,
    nearStrike: 1,
    farHandX: x,
    farHandY: y,
    farWrist: 0.1,
    nearHandX: x - 48 + support.x,
    nearHandY: y + support.y,
    nearWrist: 0.1,
    farWeaponAim: 1,
    farWeaponAngle: angle,
    crossbowLoaded: loaded,
    crossbowDraw: draw,
  };
}
export const crossbowTiming = { duration: 2600, release: 0.2, reload: 2080 };
