import type { Pose } from "./animation";
import { combatRest } from "./locomotion";
import { groundedPose } from "./kinematics";
import { knockdownTiming, type ArenaFighter } from "../combat/realtime";
import type { Hand } from "../domain/model";
const ease = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
const lying: Pose = {
  ...combatRest,
  bodyFloor: 1,
  rootX: 90,
  rootY: 30,
  rootR: -1.48,
  plant: 0,
  torso: -0.06,
  head: 0.05,
  nearThigh: -0.44,
  nearShin: 1,
  farThigh: -0.65,
  farShin: 0.95,
  nearHandX: -18,
  nearHandY: 65,
  nearWrist: 0.1,
  farHandX: 28,
  farHandY: 54,
  farWrist: 0.1,
};
function blend(a: Pose, b: Pose, t: number): Pose {
  const p: Pose = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
    p[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * ease(t);
  p.bodyFloor = 1;
  return p;
}
/** Roll to support, collect the knees, plant a foot, then slowly extend the hips.
 * There is no jump impulse or root-height bounce during this floor transfer.
 */
export function knockdownPose(
  k: NonNullable<ArenaFighter["knockdown"]>,
  from: Pose,
  primary: Hand = "rear",
): Pose {
  const ready: Pose =
    primary === "rear"
      ? combatRest
      : {
          ...combatRest,
          nearHandX: combatRest.farHandX,
          nearHandY: combatRest.farHandY,
          nearWrist: combatRest.farWrist,
          farHandX: combatRest.nearHandX,
          farHandY: combatRest.nearHandY,
          farWrist: combatRest.nearWrist,
        };
  let p: Pose;
  if (k.phase === "fall") {
    const t = k.elapsed / knockdownTiming.fall;
    const buckle = {
      ...combatRest,
      rootX: 8,
      rootY: 20,
      rootR: -0.2,
      torso: -0.12,
      nearHandX: 34,
      nearHandY: 43,
      farHandX: 35,
      farHandY: 46,
    };
    p =
      t < 0.3
        ? blend({ ...ready, ...from }, buckle, t / 0.3)
        : blend(buckle, lying, (t - 0.3) / 0.7);
  } else if (k.phase === "down") p = { ...lying };
  else {
    const frames: [number, Pose][] = [
      [0, lying],
      [
        0.25,
        {
          ...lying,
          rootX: 65,
          rootY: 45,
          rootR: -0.85,
          torso: 0.05,
          nearThigh: -0.9,
          nearShin: 1.9,
          farThigh: -0.8,
          farShin: 1.9,
          nearHandX: 8,
          nearHandY: 70,
          nearFootAngle: -0.15,
          farFootAngle: -0.25,
        },
      ],
      [
        0.47,
        {
          ...lying,
          rootX: 20,
          rootY: 90,
          rootR: 0.22,
          torso: 0.87,
          nearThigh: -1.7,
          nearShin: 1.95,
          farThigh: -0.4,
          farShin: 1.95,
          nearHandX: 53,
          nearHandY: 23,
          nearFootAngle: -0.47,
          farFootAngle: -1.77,
          farHandX: 25,
          farHandY: 40,
        },
      ],
      [
        0.64,
        {
          ...combatRest,
          bodyFloor: 1,
          rootX: 7,
          rootY: 45,
          torso: 0.32,
          nearFootX: 48,
          farFootX: -30,
          nearHandX: 28,
          nearHandY: 60,
          farHandX: 25,
          farHandY: 56,
        },
      ],
      [
        0.8,
        {
          ...combatRest,
          bodyFloor: 1,
          rootY: 24,
          torso: 0.19,
          nearFootX: 42,
          farFootX: -28,
          nearHandX: 19,
          nearHandY: 65,
        },
      ],
      [1, { ...ready, bodyFloor: 1 }],
    ];
    const t = Math.min(1, k.elapsed / knockdownTiming.getUp);
    const i = frames.findIndex(([time]) => time >= t);
    const [start, a] = frames[Math.max(0, i - 1)],
      [end, b] = frames[Math.max(0, i)];
    p = blend(a, b, end === start ? 1 : (t - start) / (end - start));
  }
  // Keep held equipment above the floor without releasing ownership or stretching an arm.
  const solved = groundedPose(p);
  const recovery =
    k.phase === "getUp"
      ? ease((k.elapsed / knockdownTiming.getUp - 0.65) / 0.35)
      : 0;
  for (const side of ["near", "far"] as const) {
    const a = side === "near" ? solved.nearArm : solved.farArm;
    const flat =
      1.35 - (solved.root.rotation + solved.torso + a.angle + a.bend + a.wrist);
    const grip =
      (side === "far" ? "rear" : "front") === primary
        ? Math.PI / 2
        : (3 * Math.PI) / 4;
    p[`${side}WeaponGrip`] = flat + (grip - flat) * recovery;
  }
  return p;
}
