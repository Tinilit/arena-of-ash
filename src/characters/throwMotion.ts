import type { Clip, Pose } from "./animation";
import { combatRest } from "./locomotion";
export const throwTiming = { duration: 1500, release: 0.64 } as const;
/** A staged overarm preview: load, cock, lead with the elbow, release, follow through. */
export function throwClip(): Clip {
  const pose = (extra: Pose): Pose => {
    const p: Pose = {
      ...combatRest,
      throwPreview: 1,
      throwReleased: 0,
      throwHeadFront: 0,
      ...extra,
    };
    return p;
  };
  return {
    duration: throwTiming.duration,
    blendIn: 120,
    discrete: ["throwPreview", "throwReleased", "throwHeadFront"],
    sample: (phase) => ({
      throwPreview: phase < 0.94 ? 1 : 0,
      throwReleased: phase >= throwTiming.release ? 1 : 0,
      throwHeadFront: phase >= 0.32 && phase < 0.62 ? 1 : 0,
    }),
    frames: [
      { time: 0, pose: pose({}) },
      {
        time: 0.18,
        pose: pose({
          rootX: -5,
          rootY: 7,
          torso: -0.11,
          farHandX: -10,
          farHandY: 65,
        }),
      },
      {
        time: 0.28,
        pose: pose({
          rootX: -4,
          rootY: 7,
          torso: -0.1,
          farHandX: 50,
          farHandY: 40,
          nearFootX: 40,
          nearFootY: -5,
        }),
      },
      {
        time: 0.36,
        pose: pose({
          rootX: -3,
          rootY: 5,
          torso: -0.08,
          farHandX: 60,
          farHandY: -25,
          farWrist: 0.1,
          nearFootX: 44,
          nearFootY: -9,
        }),
      },
      {
        time: 0.48,
        pose: pose({
          rootX: 5,
          rootY: 8,
          torso: 0.025,
          farHandX: -30,
          farHandY: -55,
          farWrist: 0.15,
          nearFootX: 54,
          nearFootY: -5,
        }),
      },
      {
        time: throwTiming.release,
        impact: true,
        pose: pose({
          rootX: 12,
          rootY: 12,
          torso: 0.12,
          farHandX: 72,
          farHandY: -8,
          farWrist: 0.2,
          nearFootX: 58,
        }),
      },
      {
        time: 0.72,
        pose: pose({
          rootX: 14,
          rootY: 11,
          torso: 0.14,
          farHandX: 69,
          farHandY: 22,
          farWrist: 0.3,
          nearFootX: 54,
        }),
      },
      {
        time: 0.9,
        pose: pose({
          rootX: 5,
          rootY: 6,
          torso: 0.05,
          farHandX: 60,
          farHandY: 36,
          nearFootX: 39,
        }),
      },
      { time: 1, pose: pose({ throwPreview: 0 }) },
    ],
  };
}
