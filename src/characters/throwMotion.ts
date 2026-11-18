import type { Clip, Pose } from "./animation";
import { combatRest } from "./locomotion";
export const throwTiming = { duration: 1700, release: 0.62 } as const;
/** Plant, turn the trunk, lead with the elbow, then extend and decelerate.
 * Keep the hand on one continuous overarm arc, away from the IK branch cut.
 */
export function throwClip(): Clip {
  const pose = (extra: Pose): Pose => ({
    ...combatRest,
    throwPreview: 1,
    throwReleased: 0,
    throwHeadFront: 0,
    ...extra,
  });
  return {
    duration: throwTiming.duration,
    blendIn: 140,
    discrete: ["throwPreview", "throwReleased", "throwHeadFront"],
    sample: (phase) => ({
      throwPreview: phase < 0.96 ? 1 : 0,
      throwReleased: phase >= throwTiming.release ? 1 : 0,
      throwHeadFront: phase >= 0.25 && phase < 0.58 ? 1 : 0,
    }),
    frames: [
      { time: 0, pose: pose({}) },
      {
        time: 0.18,
        pose: pose({
          rootX: -4,
          rootY: 7,
          torso: -0.1,
          farHandX: 48,
          farHandY: 18,
          farWrist: 0.15,
        }),
      },
      {
        time: 0.34,
        pose: pose({
          rootX: -7,
          rootY: 8,
          torso: -0.17,
          farHandX: 30,
          farHandY: -50,
          farWrist: 0.05,
          nearFootX: 42,
          nearFootY: -7,
        }),
      },
      {
        time: 0.46,
        pose: pose({
          rootX: -3,
          rootY: 7,
          torso: -0.1,
          farHandX: 12,
          farHandY: -64,
          farWrist: 0.08,
          nearFootX: 55,
          nearFootY: 0,
        }),
      },
      {
        time: 0.54,
        pose: pose({
          rootX: 5,
          rootY: 10,
          torso: 0.08,
          farHandX: 42,
          farHandY: -48,
          farWrist: 0.12,
          nearFootX: 55,
        }),
      },
      {
        time: throwTiming.release,
        impact: true,
        pose: pose({
          rootX: 11,
          rootY: 12,
          torso: 0.16,
          farHandX: 70,
          farHandY: -19,
          farWrist: 0.2,
          nearFootX: 55,
        }),
      },
      {
        time: 0.73,
        pose: pose({
          rootX: 13,
          rootY: 11,
          torso: 0.18,
          farHandX: 63,
          farHandY: 31,
          farWrist: 0.25,
          nearFootX: 55,
        }),
      },
      {
        time: 0.88,
        pose: pose({
          rootX: 5,
          rootY: 7,
          torso: 0.07,
          farHandX: 43,
          farHandY: 56,
          farWrist: 0.3,
          nearFootX: 43,
        }),
      },
      { time: 1, pose: pose({ throwPreview: 0 }) },
    ],
  };
}
