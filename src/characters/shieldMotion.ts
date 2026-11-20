import type { Item } from "../domain/model";
import type { Pose } from "./animation";
import { skeleton } from "./kinematics";
/** Shield artwork stays attached to the rear wrist, with clearance in standing poses. */
export function shieldCarryPose(p: Pose, shield: Item): Pose {
  if (
    p.grappling ||
    p.bodyFloor ||
    p.held ||
    p.farThrow ||
    p.throwPreview ||
    p.drinkPreview ||
    p.farShove
  )
    return p;
  const bottom = shield.image
    ? shield.image.height * (1 - shield.image.originY)
    : shield.visual === "tower"
      ? 98
      : 54;
  return {
    ...p,
    farHandX: -24,
    farHandY: Math.min(
      58,
      -skeleton.pelvisY - skeleton.shoulderY - bottom - 12 - (p.rootY ?? 0),
    ),
    farWrist: 0,
  };
}
