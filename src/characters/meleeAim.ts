import type { Pose } from "./animation";
import type { Hand, Item } from "../domain/model";
import { groundedPose, rotate } from "./kinematics";
import { pairedGrip } from "./twoHandMotion";
import type { ArenaFighter } from "../combat/realtime";
export function meleePitch(f: ArenaFighter) {
  if (!f.aim) return 0;
  const size = f.model.combatProfile?.size ?? 1;
  const y = 551 + f.y - 175 * size;
  return Math.max(
    -0.32,
    Math.min(
      0.32,
      Math.atan2(f.aim.y - y, Math.max(50, Math.abs(f.aim.x - f.x))) * 0.8,
    ),
  );
}
/** Tilt an authored strike while retaining its arc, fixed bones and paired grips. */
export function meleeAimPose(
  base: Pose,
  weapon: Item,
  hand: Hand,
  pitch: number,
): Pose {
  if (!pitch || weapon.weaponType === "crossbow") return base;
  const prefix = hand === "rear" ? "far" : "near";
  const original = groundedPose(base);
  const arm = hand === "rear" ? original.farArm : original.nearArm;
  const angle = base[`${prefix}WeaponAim`]
    ? base[`${prefix}WeaponAngle`]!
    : arm.angle +
      arm.bend +
      arm.wrist +
      (base[`${prefix}WeaponGrip`] ?? base.weaponGrip ?? Math.PI / 2);
  for (let factor = 1; factor > 0.01; factor *= 0.5) {
    const tilt = pitch * factor;
    const grip = rotate(
      { x: base[`${prefix}HandX`] ?? 44, y: base[`${prefix}HandY`] ?? 42 },
      tilt,
    );
    const pose: Pose =
      weapon.hands === 2
        ? pairedGrip(
            base,
            grip.x,
            grip.y,
            angle + tilt,
            base.supportGripDistance ?? 24,
          )
        : {
            ...base,
            [`${prefix}HandX`]: grip.x,
            [`${prefix}HandY`]: grip.y,
            [`${prefix}WeaponAim`]: 1,
            [`${prefix}WeaponAngle`]: angle + tilt,
          };
    const solved = groundedPose(pose);
    const reaches = (side: "near" | "far") => {
      const arm = side === "far" ? solved.farArm : solved.nearArm;
      const offset = rotate(
        { x: pose[`${side}HandX`] ?? 44, y: pose[`${side}HandY`] ?? 42 },
        solved.root.rotation + solved.torso,
      );
      return (
        !arm.clamped &&
        Math.hypot(
          arm.hand.x - arm.shoulder.x - offset.x,
          arm.hand.y - arm.shoulder.y - offset.y,
        ) < 0.00001
      );
    };
    if (reaches(prefix) && (weapon.hands !== 2 || reaches("near"))) return pose;
  }
  return base;
}
