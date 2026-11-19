import type { Clip, Pose } from "./animation";
import { combatRest } from "./locomotion";
export type ShootingKind = "crossbow" | "rifle";
/** Two-handed aim, release/recoil and controlled lowering; no combat projectile. */
export function shootClip(kind: ShootingKind): Clip {
  const rifle = kind === "rifle",
    mode = rifle ? 2 : 1;
  const p = (extra: Pose): Pose => ({
    ...combatRest,
    shootPreview: mode,
    ...extra,
  });
  const aim: Pose = {
    farHandX: 52,
    farHandY: -6,
    farWrist: 0.15,
    nearHandX: 48,
    nearHandY: -1,
    nearWrist: 0.1,
  };
  return {
    duration: rifle ? 1850 : 2050,
    blendIn: 140,
    discrete: ["shootPreview", "shotFlash"],
    sample: (phase) => ({
      shootPreview: phase < 0.95 ? mode : 0,
      shotFlash: phase >= 0.52 && phase < (rifle ? 0.56 : 0.61) ? mode : 0,
    }),
    frames: [
      { time: 0, pose: p({}) },
      {
        time: 0.18,
        pose: p({
          farHandX: 36,
          farHandY: 35,
          farWrist: 0.1,
          nearHandX: 14,
          nearHandY: 50,
          nearWrist: 0.1,
        }),
      },
      { time: 0.36, pose: p({ ...aim, torso: 0.01, head: 0.02 }) },
      {
        time: 0.52,
        impact: true,
        pose: p({ ...aim, torso: 0.01, head: 0.02 }),
      },
      {
        time: 0.57,
        pose: p({
          ...aim,
          farHandX: rifle ? 47 : 50,
          farHandY: rifle ? -9 : -6,
          nearHandX: rifle ? 43 : 46,
          nearHandY: rifle ? -4 : -1,
          torso: rifle ? -0.055 : -0.01,
          rootX: rifle ? -3 : -1,
        }),
      },
      { time: 0.7, pose: p({ ...aim, torso: 0.01 }) },
      {
        time: 0.86,
        pose: p({
          farHandX: 35,
          farHandY: 42,
          nearHandX: 14,
          nearHandY: 55,
          farWrist: 0.1,
          nearWrist: 0.05,
        }),
      },
      { time: 1, pose: p({ shootPreview: 0 }) },
    ],
  };
}
