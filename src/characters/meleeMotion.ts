import type { Clip, Pose } from "./animation";
import { combatRest, gaitFoot, type WeaponHand } from "./locomotion";
export function punchClip(hand: WeaponHand): Clip {
  const prefix = hand === "rear" ? "far" : "near";
  const pose = (x: number, y: number, extra: Pose = {}): Pose => ({
    ...combatRest,
    [`${prefix}HandX`]: x,
    [`${prefix}HandY`]: y,
    [`${prefix}Fist`]: 1,
    ...extra,
  });
  return {
    duration: 1000,
    blendIn: 120,
    discrete: [`${prefix}Fist`],
    frames: [
      { time: 0, pose: pose(50, 36) },
      { time: 0.23, pose: pose(34, 48, { torso: -0.04 }) },
      { time: 0.43, pose: pose(36, 46, { torso: -0.035 }) },
      { time: 0.56, impact: true, pose: pose(72, 8, { torso: 0.12 }) },
      { time: 0.67, pose: pose(70, 14, { torso: 0.11 }) },
      { time: 0.85, pose: pose(54, 34) },
      { time: 1, pose: pose(50, 36) },
    ],
  };
}
export const kickClip: Clip = {
  duration: 1050,
  blendIn: 100,
  frames: [
    { time: 0, pose: { ...combatRest } },
    {
      time: 0.22,
      pose: {
        ...combatRest,
        rootY: 8,
        torso: -0.06,
        nearFootX: 48,
        nearFootY: -35,
        nearFootRoll: -0.5,
      },
    },
    {
      time: 0.38,
      pose: {
        ...combatRest,
        rootY: 10,
        torso: -0.12,
        nearFootX: 113,
        nearFootY: -95,
        nearFootRoll: -1.3,
      },
    },
    {
      time: 0.48,
      impact: true,
      pose: {
        ...combatRest,
        rootY: 10,
        torso: -0.12,
        nearFootX: 113,
        nearFootY: -95,
        nearFootRoll: -1.3,
      },
    },
    {
      time: 0.6,
      pose: {
        ...combatRest,
        rootY: 9,
        torso: -0.08,
        nearFootX: 53,
        nearFootY: -35,
        nearFootRoll: -0.5,
      },
    },
    {
      time: 0.8,
      pose: { ...combatRest, rootY: 6, nearFootX: 37, nearFootY: 0 },
    },
    { time: 1, pose: { ...combatRest } },
  ],
};
export const painClip: Clip = {
  duration: 280,
  blendIn: 30,
  frames: [
    { time: 0, pose: { ...combatRest } },
    {
      time: 0.25,
      pose: { ...combatRest, torso: -0.15, head: -0.14, rootY: 7 },
    },
    { time: 0.6, pose: { ...combatRest, torso: -0.09, head: -0.08, rootY: 6 } },
    { time: 1, pose: { ...combatRest } },
  ],
};
/** Longer anticipation without changing the original blade-clearance path. */
export function lightClip(source: Clip): Clip {
  return {
    ...source,
    duration: 1000,
    frames: source.frames.map((frame) => ({
      ...frame,
      time:
        frame.time <= 0.34
          ? (frame.time / 0.34) * 0.45
          : 0.45 + ((frame.time - 0.34) / 0.66) * 0.55,
    })),
  };
}

export function staggerClip(hand: WeaponHand): Clip {
  const sample = (phase: number): Pose => {
    const near = gaitFoot(phase, -200, 800, 0.5, 18),
      far = gaitFoot(phase + 0.5, -200, 800, 0.5, 18);
    const p: Pose = {
      ...combatRest,
      rootY: 8,
      nearFootX: near.x,
      nearFootY: near.y,
      farFootX: far.x,
      farFootY: far.y,
    };
    return hand === "rear"
      ? p
      : {
          ...p,
          nearHandX: p.farHandX,
          nearHandY: p.farHandY,
          nearWrist: p.farWrist,
          farHandX: p.nearHandX,
          farHandY: p.nearHandY,
          farWrist: p.nearWrist,
        };
  };
  return {
    duration: 800,
    loop: true,
    blendIn: 80,
    sample,
    frames: [
      { time: 0, pose: sample(0) },
      { time: 1, pose: sample(1) },
    ],
  };
}
