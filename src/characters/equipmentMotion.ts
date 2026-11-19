import type { Item } from "../domain/model";
import type { Clip, Pose } from "./animation";
import { rearHandMotion } from "./rearHandMotion";
import { locomotionClips, type WeaponHand } from "./locomotion";
import { groundedMotion } from "./groundedMotion";
import { drinkClip } from "./drinkMotion";
import { shootClip } from "./shootMotion";
import { throwClip, overhandThrowClip } from "./throwMotion";
import {
  punchClip,
  kickClip,
  painClip,
  lightClip,
  staggerClip,
} from "./meleeMotion";
import { twoHandClip, finisherClip } from "./twoHandMotion";
import { crossbowPose, crossbowTiming } from "./crossbowMotion";
import { combatRest } from "./locomotion";
const base = groundedMotion.ash;
let spearLibrary: Record<string, Clip> | undefined;
/** Spears thrust; the equipment renderer does not alter combat rules. */
function frontEquipmentMotion(weapon?: Item): Record<string, Clip> {
  if (weapon?.weaponType !== "spear") return base;
  if (spearLibrary) return spearLibrary;
  const pose = (p: Pose): Pose => ({ ...base.idle.frames[0].pose, ...p });
  const frame = (time: number, p: Pose, impact = false) => ({
    time,
    pose: pose(p),
    ...(impact ? { impact: true } : {}),
  });
  const result: Record<string, Clip> = { ...base };
  result.victory = {
    ...base.victory,
    frames: base.victory.frames.map((f) => ({
      ...f,
      pose: {
        ...f.pose,
        nearHandX: 48,
        nearHandY: 38,
        nearWrist: 0.05,
        farHandX: 36,
        farHandY: 42,
      },
    })),
  };
  result.quick = {
    duration: base.quick.duration,
    frames: [
      frame(0, {}),
      frame(0.22, {
        rootX: -3,
        rootY: 3,
        nearHandX: 32,
        nearHandY: 44,
        nearWrist: 1,
      }),
      frame(0.34, {
        rootX: 8,
        rootY: 5,
        nearFootX: 53,
        nearFootY: -12,
        nearHandX: 45,
        nearHandY: 36,
        nearWrist: 1.15,
      }),
      frame(
        0.5,
        {
          rootX: 22,
          rootY: 10,
          torso: 0.1,
          nearFootX: 62,
          nearHandX: 64,
          nearHandY: 32,
          nearWrist: 1.3,
          farHandX: 40,
          farHandY: 38,
        },
        true,
      ),
      frame(0.68, {
        rootX: 22,
        rootY: 11,
        torso: 0.12,
        nearFootX: 62,
        nearHandX: 60,
        nearHandY: 40,
        nearWrist: 1.3,
        farHandX: 40,
        farHandY: 38,
      }),
      frame(0.84, {
        rootX: 10,
        rootY: 4,
        nearFootX: 50,
        nearFootY: -10,
        nearHandX: 45,
        nearHandY: 42,
        nearWrist: 0.4,
      }),
      frame(1, {}),
    ],
  };
  result.heavy = {
    duration: base.heavy.duration,
    frames: [
      frame(0, {}),
      frame(0.25, {
        rootX: -4,
        rootY: 8,
        torso: -0.05,
        nearHandX: 28,
        nearHandY: 48,
        nearWrist: 1.1,
      }),
      frame(0.46, {
        rootX: 8,
        rootY: 10,
        nearFootX: 55,
        nearFootY: -14,
        nearHandX: 40,
        nearHandY: 40,
        nearWrist: 1.15,
      }),
      frame(
        0.64,
        {
          rootX: 30,
          rootY: 14,
          torso: 0.15,
          nearFootX: 72,
          nearHandX: 64,
          nearHandY: 32,
          nearWrist: 1.3,
          farHandX: 42,
          farHandY: 36,
        },
        true,
      ),
      frame(0.78, {
        rootX: 28,
        rootY: 14,
        torso: 0.17,
        nearFootX: 72,
        nearHandX: 60,
        nearHandY: 40,
        nearWrist: 1.3,
        farHandX: 42,
        farHandY: 36,
      }),
      frame(0.9, {
        rootX: 12,
        rootY: 5,
        nearFootX: 52,
        nearFootY: -10,
        nearHandX: 43,
        nearHandY: 42,
        nearWrist: 0.4,
      }),
      frame(1, {}),
    ],
  };
  spearLibrary = result;
  return result;
}

const libraries = new Map<string, Record<string, Clip>>();
export function equipmentMotion(
  weapon?: Item,
  hand: WeaponHand = "rear",
): Record<string, Clip> {
  const spear = weapon?.weaponType === "spear",
    key = `${hand}-${weapon?.hands === 2 ? weapon.weaponType + "-2h" : spear ? "spear" : "sword"}`;
  if (!libraries.has(key)) {
    const front = frontEquipmentMotion(weapon);
    const action = hand === "rear" ? rearHandMotion(front, spear) : front;
    const library: Record<string, Clip> = {
      ...action,
      ...locomotionClips(hand),
      throw: throwClip(),
      throwOverhand: overhandThrowClip(),
      throwAction: overhandThrowClip(hand),
      drink: drinkClip(),
      shootCrossbow: shootClip("crossbow"),
      shoot:
        weapon?.weaponType === "crossbow"
          ? {
              duration: crossbowTiming.duration,
              frames: [
                { time: 0, pose: crossbowPose(combatRest) },
                { time: 1, pose: crossbowPose(combatRest) },
              ],
              sample: (t) => crossbowPose(combatRest, t),
            }
          : shootClip("crossbow"),
      shootRifle: shootClip("rifle"),
      punch: punchClip(hand),
      kick: kickClip,
      pain: painClip,
      staggerStep: staggerClip(hand),
      quick:
        weapon?.hands === 2 ? twoHandClip(weapon) : lightClip(action.quick),
      shove: weapon?.hands === 2 ? twoHandClip(weapon, "shove") : action.quick,
      finish:
        weapon?.hands === 2
          ? twoHandClip(weapon, "finish")
          : finisherClip(hand),
    };
    library.idle = library.idleCombat;
    libraries.set(key, library);
  }
  return libraries.get(key)!;
}
