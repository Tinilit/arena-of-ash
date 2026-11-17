import type { Clip, Pose } from "./animation";
import { chain, skeleton } from "./kinematics";

export type WeaponHand = "rear" | "front";
export type Stance = "relaxed" | "combat";
export const movementSpeeds = {
  walkForward: 60,
  walkBackward: -60,
  run: 120,
  runBackward: -120,
} as const;

/** Rear is the far shoulder in the drawing; facing mirrors the whole rig. */
export const freeFrontArm: Pose = {
  nearHandX: 14,
  nearHandY: 69,
  nearWrist: 0.03,
};
export const rearReady: Pose = { farHandX: 62, farHandY: 34, farWrist: 0.1 };
export const combatRest: Pose = {
  rootX: 0,
  rootY: 3,
  rootR: 0,
  torso: 0.035,
  head: -0.02,
  plant: 1,
  nearFootX: 32,
  farFootX: -28,
  nearFootY: 0,
  farFootY: 0,
  nearFootAngle: 0,
  farFootAngle: 0,
  nearThigh: -0.6,
  nearShin: 0.7,
  farThigh: -0.15,
  farShin: 0.7,
  ...freeFrontArm,
  ...rearReady,
};
export const relaxedRest: Pose = {
  ...combatRest,
  rootY: 0,
  torso: 0,
  head: 0,
  nearFootX: 22,
  farFootX: -20,
  farHandX: 54,
  farHandY: 43,
  farWrist: 0.12,
};
function forHand(p: Pose, hand: WeaponHand): Pose {
  if (hand === "rear") return p;
  return {
    ...p,
    nearHandX: p.farHandX,
    nearHandY: p.farHandY,
    nearWrist: p.farWrist,
    farHandX: p.nearHandX,
    farHandY: p.nearHandY,
    farWrist: p.nearWrist,
  };
}
function idle(rest: Pose, hand: WeaponHand): Clip {
  return {
    duration: 2600,
    loop: true,
    blendIn: 180,
    frames: [
      { time: 0, pose: forHand(rest, hand) },
      {
        time: 0.5,
        pose: forHand(
          {
            ...rest,
            rootY: rest.rootY! - 0.65,
            head: rest.head! - 0.012,
            nearHandY: rest.nearHandY! - 0.3,
            farHandY: rest.farHandY! - 0.4,
          },
          hand,
        ),
      },
      { time: 1, pose: forHand(rest, hand) },
    ],
  };
}
/** Linear contact travel cancels actor translation; only swing uses an eased arc. */
export function gaitFoot(
  phase: number,
  speed: number,
  duration: number,
  duty: number,
  lift: number,
) {
  const t = ((phase % 1) + 1) % 1;
  const distance = ((Math.abs(speed) * duration) / 1000) * duty;
  const direction = Math.sign(speed);
  if (t < duty)
    return {
      x: direction * (distance / 2 - (distance * t) / duty),
      y: 0,
      contact: true,
    };
  const swing = (t - duty) / (1 - duty),
    // Match the contact velocity at toe-off and heel-strike. The small
    // overshoot lets the foot leave/meet the ground without a velocity snap.
    tangent = -(1 - duty) / duty,
    ease =
      swing * swing * (3 - 2 * swing) +
      tangent * swing * (1 - swing) * (1 - 2 * swing);
  return {
    x: direction * (-distance / 2 + distance * ease),
    y: -lift * Math.sin(Math.PI * swing) ** 2,
    contact: false,
  };
}
function gait(name: keyof typeof movementSpeeds, hand: WeaponHand): Clip {
  const running = name.startsWith("run"),
    duration = running ? 640 : 1000,
    duty = running ? 0.35 : 0.6;
  const sample = (phase: number): Pose => {
    const near = gaitFoot(
      phase,
      movementSpeeds[name],
      duration,
      duty,
      running ? 35 : 20,
    );
    const far = gaitFoot(
      phase + 0.5,
      movementSpeeds[name],
      duration,
      duty,
      running ? 35 : 20,
    );
    const swing = Math.sin(phase * 2 * Math.PI),
      freeHand = chain(
        skeleton.upperArm,
        skeleton.forearm,
        running ? -0.12 + swing * 0.4 : 0.06 + swing * 0.16,
        running ? -1.15 : -0.57,
      ).tip;
    return forHand(
      {
        ...combatRest,
        rootY: running
          ? 3 - 8 * Math.sin((phase - 0.175) * 2 * Math.PI) ** 2
          : 1 - 1.5 * Math.sin(phase * 2 * Math.PI) ** 2,
        torso: running ? 0.08 * Math.sign(movementSpeeds[name]) : 0.015,
        nearFootX: near.x,
        nearFootY: near.y,
        farFootX: far.x,
        farFootY: far.y,
        nearHandX: freeHand.x,
        nearHandY: freeHand.y,
        farHandX: 60 + swing * 2,
        farHandY: 36 + swing * 2,
      },
      hand,
    );
  };
  return {
    duration,
    loop: true,
    blendIn: 160,
    frames: [
      { time: 0, pose: sample(0) },
      { time: 1, pose: sample(1) },
    ],
    sample,
  };
}
export function locomotionClips(hand: WeaponHand): Record<string, Clip> {
  const jumpFrame = (time: number, pose: Pose) => ({
    time,
    pose: forHand({ ...combatRest, ...pose }, hand),
  });
  return {
    idleRelaxed: idle(relaxedRest, hand),
    idleCombat: idle(combatRest, hand),
    walkForward: gait("walkForward", hand),
    walkBackward: gait("walkBackward", hand),
    run: gait("run", hand),
    runBackward: gait("runBackward", hand),
    jump: {
      duration: 1000,
      blendIn: 80,
      frames: [
        jumpFrame(0, {}),
        jumpFrame(0.16, { rootY: 14, torso: 0.07 }),
        jumpFrame(0.32, {
          rootY: -48,
          plant: 0,
          nearThigh: -0.35,
          nearShin: 0.8,
          farThigh: -0.1,
          farShin: 0.65,
        }),
        jumpFrame(0.5, {
          rootY: -82,
          plant: 0,
          nearThigh: -0.5,
          nearShin: 1.1,
          farThigh: -0.3,
          farShin: 0.9,
        }),
        jumpFrame(0.72, {
          rootY: -35,
          plant: 0,
          nearThigh: -0.25,
          nearShin: 0.65,
          farThigh: -0.2,
          farShin: 0.7,
        }),
        jumpFrame(0.86, { rootY: 12, plant: 1, torso: 0.05 }),
        jumpFrame(1, {}),
      ],
    },
  };
}
