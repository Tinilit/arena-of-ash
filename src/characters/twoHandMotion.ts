import type { Clip, Pose } from "./animation";
import type { Hand, Item } from "../domain/model";
import { combatRest } from "./locomotion";
import { skeleton, rotate } from "./kinematics";
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
type Key = [number, number, number, number];
/** Authored grip position and weapon angle in the torso's coordinate plane. */
function sample(keys: Key[], phase: number) {
  const next = keys.findIndex((k) => k[0] >= phase);
  if (next <= 0) return keys[next < 0 ? keys.length - 1 : 0].slice(1);
  const a = keys[next - 1],
    b = keys[next],
    t = ease((phase - a[0]) / (b[0] - a[0]));
  return a.slice(1).map((v, i) => v + (b[i + 1] - v) * t);
}
export const twoHandDuration = (weapon: Item) =>
  weapon.weaponType === "hammer"
    ? 1350
    : weapon.weaponType === "axe"
      ? 1250
      : 1150;
/** Keep both exact grip points within the fixed 40/34 arm chains. */
function pairedGrip(base: Pose, x: number, y: number, angle: number): Pose {
  const offset = rotate({ x: 0, y: -24 }, angle);
  const dx = skeleton.nearShoulderX - skeleton.farShoulderX;
  for (let i = 0; i < 64; i++) {
    const previousX = x,
      previousY = y;
    for (const [cx, cy] of [
      [0, 0],
      [dx - offset.x, -offset.y],
    ]) {
      const px = x - cx,
        py = y - cy,
        length = Math.hypot(px, py);
      const distance = Math.max(34, Math.min(72, length));
      if (length > 1e-8) {
        x = cx + (px * distance) / length;
        y = cy + (py * distance) / length;
      }
    }
    if (Math.hypot(x - previousX, y - previousY) < 1e-9) break;
  }
  return {
    ...base,
    twoHanded: 1,
    nearStrike: 1,
    farHandX: x,
    farHandY: y,
    farWrist: 0.1,
    nearHandX: x - dx + offset.x,
    nearHandY: y + offset.y,
    nearWrist: 0.1,
    farWeaponAngle: angle,
    farWeaponAim: 1,
  };
}
export function twoHandPose(
  base: Pose,
  weapon: Item,
  action?: string,
  phase = 0,
): Pose {
  const relaxed = clamp(
    ((base.weaponGrip ?? Math.PI / 2) - Math.PI / 2) / (Math.PI / 4),
  );
  const idle: Key = [
    0,
    44 + 4 * relaxed,
    52 - 14 * relaxed,
    0.75 + 1.85 * relaxed,
  ];
  let grip = idle.slice(1);
  if (action === "quick") {
    const hammer = weapon.weaponType === "hammer",
      axe = weapon.weaponType === "axe";
    grip = sample(
      [
        idle,
        [0.28, 64, -26, hammer ? 0.16 : axe ? 0.24 : 0.34],
        [0.44, 60, 12, axe ? 1.1 : 1.25],
        [
          0.6,
          hammer ? 44 : 48,
          hammer ? 48 : 50,
          hammer ? 2.7 : axe ? 2.55 : 2.4,
        ],
        [0.82, 44, 52, 0.75],
        [1, ...idle.slice(1)] as Key,
      ],
      phase,
    );
  } else if (action === "shove") {
    // The weapon is held upright across the chest and driven forward by both arms.
    grip = sample(
      [
        idle,
        [0.2, 40, 52, 0.75],
        [0.4, 66, 20, 0.75],
        [0.55, 66, 20, 0.75],
        [0.85, 44, 52, 0.75],
        [1, ...idle.slice(1)] as Key,
      ],
      phase,
    );
  } else if (action === "finish") {
    grip = sample(
      [
        idle,
        [0.3, 64, -26, 0.25],
        [0.5, 60, 4, 1.2],
        [0.68, 48, 50, 2.94],
        [0.8, 48, 50, 2.94],
        [1, ...idle.slice(1)] as Key,
      ],
      phase,
    );
  }
  const result = pairedGrip(base, grip[0], grip[1], grip[2]);
  if (action) {
    const weight = ease(phase / 0.2) * ease((1 - phase) / 0.18);
    result.torso =
      (base.torso ?? 0) + (action === "shove" ? 0.1 : 0.08) * weight;
    result.head = (base.head ?? 0) - 0.025 * weight;
  }
  return result;
}
export function finishPose(base: Pose, hand: Hand, phase: number): Pose {
  const prefix = hand === "rear" ? "far" : "near";
  const rest: Key = [
    0,
    base[prefix + "HandX"] ?? 32,
    base[prefix + "HandY"] ?? 65,
    0.6,
  ];
  const [x, y, angle] = sample(
    [
      rest,
      [0.3, 64, -26, 0.2],
      [0.48, 64, 30, 1.3],
      [0.56, 30, 65, 1.3],
      [0.68, 24, 68, Math.PI - 0.45],
      [0.8, 24, 68, Math.PI - 0.45],
      [1, ...rest.slice(1)] as Key,
    ],
    phase,
  );
  return {
    ...base,
    [prefix + "HandX"]: x,
    [prefix + "HandY"]: y,
    [prefix + "Wrist"]: 0.1,
    [prefix + "WeaponAngle"]: angle,
    [prefix + "WeaponAim"]: 1,
    ...(hand === "front" ? { nearStrike: 1 } : {}),
    torso:
      (base.torso ?? 0) + 0.1 * ease(phase / 0.25) * ease((1 - phase) / 0.2),
  };
}
export function twoHandClip(weapon: Item, action = "quick"): Clip {
  const duration =
    action === "shove"
      ? 800
      : action === "finish"
        ? 1000
        : twoHandDuration(weapon);
  return {
    duration,
    blendIn: 120,
    frames: [
      { time: 0, pose: twoHandPose(combatRest, weapon) },
      { time: 1, pose: twoHandPose(combatRest, weapon) },
    ],
    sample: (phase) => twoHandPose(combatRest, weapon, action, phase),
  };
}
export function finisherClip(hand: Hand): Clip {
  return {
    duration: 1000,
    blendIn: 100,
    frames: [
      { time: 0, pose: combatRest },
      { time: 1, pose: combatRest },
    ],
    sample: (t) => finishPose(combatRest, hand, t),
  };
}
