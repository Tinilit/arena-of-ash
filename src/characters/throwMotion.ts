import type { Clip, Pose } from "./animation";
import { combatRest } from "./locomotion";
export const throwTiming = { duration: 1700, release: 0.62 } as const;
/** Draw the rear hand behind the hip, plant the step, then swing forward/up.
 * This low backswing keeps the elbow on one continuous anatomical IK branch.
 */
export function throwClip(): Clip {
  const pose = (extra: Pose): Pose => ({
    ...combatRest,
    throwPreview: 1,
    throwReleased: 0,
    ...extra,
  });
  return {
    duration: throwTiming.duration,
    blendIn: 140,
    discrete: ["throwPreview", "throwReleased"],
    sample: (phase) => ({
      throwPreview: phase < 0.96 ? 1 : 0,
      throwReleased: phase >= throwTiming.release ? 1 : 0,
    }),
    frames: [
      { time: 0, pose: pose({}) },
      {
        time: 0.16,
        pose: pose({
          rootX: -4,
          rootY: 7,
          torso: -0.04,
          farHandX: -4,
          farHandY: 70,
          farWrist: 0.15,
        }),
      },
      {
        time: 0.34,
        pose: pose({
          rootX: -7,
          rootY: 8,
          torso: -0.12,
          farHandX: -36,
          farHandY: 64,
          farWrist: 0.05,
          nearFootX: 42,
          nearFootY: -7,
        }),
      },
      {
        time: 0.44,
        pose: pose({
          rootX: -3,
          rootY: 7,
          torso: -0.1,
          farHandX: -36,
          farHandY: 64,
          farWrist: 0.08,
          nearFootX: 55,
          nearFootY: 0,
        }),
      },
      {
        time: 0.52,
        pose: pose({
          rootX: 5,
          rootY: 10,
          torso: 0.08,
          farHandX: 20,
          farHandY: 64,
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
          farHandY: -8,
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

export const overhandThrowTiming = { duration: 1850, release: 0.6 } as const;
/** Volleyball-style arm cock, upward extension, high release and follow-through. */
export function overhandThrowClip(hand: "front" | "rear" = "rear"): Clip {
  const pose = (extra: Pose): Pose => ({
    ...combatRest,
    throwPreview: 1,
    throwReleased: 0,
    ...extra,
  });
  const clip: Clip = {
    duration: overhandThrowTiming.duration,
    blendIn: 140,
    discrete: ["throwPreview", "throwReleased"],
    sample: (phase) => ({
      throwPreview: phase < 0.96 ? 1 : 0,
      throwReleased: phase >= overhandThrowTiming.release ? 1 : 0,
    }),
    frames: [
      { time: 0, pose: pose({}) },
      {
        time: 0.16,
        pose: pose({
          rootX: -4,
          rootY: 7,
          torso: -0.08,
          farHandX: -4,
          farHandY: 70,
        }),
      },
      {
        time: 0.29,
        pose: pose({
          rootX: -6,
          rootY: 8,
          torso: -0.14,
          farHandX: 48,
          farHandY: 18,
          nearFootX: 40,
          nearFootY: -6,
        }),
      },
      {
        time: 0.4,
        pose: pose({
          rootX: -4,
          rootY: 7,
          torso: -0.13,
          farHandX: 30,
          farHandY: -50,
          farWrist: 0.1,
          nearFootX: 48,
          nearFootY: -5,
        }),
      },
      {
        time: 0.49,
        pose: pose({
          rootX: 1,
          rootY: 6,
          torso: -0.06,
          farHandX: -12,
          farHandY: -55,
          farWrist: 0.12,
          nearFootX: 54,
        }),
      },
      {
        time: overhandThrowTiming.release,
        impact: true,
        pose: pose({
          rootX: 10,
          rootY: 4,
          torso: 0.13,
          farHandX: 12,
          farHandY: -72.9,
          farWrist: 0.2,
          nearFootX: 54,
        }),
      },
      {
        time: 0.68,
        pose: pose({
          rootX: 14,
          rootY: 9,
          torso: 0.18,
          farHandX: 68,
          farHandY: -19,
          farWrist: 0.25,
          nearFootX: 54,
        }),
      },
      {
        time: 0.8,
        pose: pose({
          rootX: 10,
          rootY: 9,
          torso: 0.12,
          farHandX: 60,
          farHandY: 36,
          nearFootX: 48,
        }),
      },
      {
        time: 0.91,
        pose: pose({
          rootX: 4,
          rootY: 6,
          torso: 0.05,
          farHandX: 40,
          farHandY: 60,
          nearFootX: 38,
        }),
      },
      { time: 1, pose: pose({ throwPreview: 0 }) },
    ],
  };
  if (hand === "front")
    clip.frames = clip.frames.map((frame) => {
      const p = { ...frame.pose };
      for (const suffix of ["HandX", "HandY", "Wrist"]) {
        p["near" + suffix] = frame.pose["far" + suffix];
        p["far" + suffix] = frame.pose["near" + suffix];
      }
      return { ...frame, pose: p };
    });
  return clip;
}
