import type { Item } from "../domain/model";
import type { VisualStyle, MotionMode } from "./presentation";
import type { Clip, Pose } from "./animation";
import { groundedMotion } from "./groundedMotion";
import { motionProfiles } from "./motionProfiles";
const cache = new Map<string, Record<string, Clip>>();
/** Equipment presentation never changes action costs, multipliers or event counts. */
export function equipmentMotion(
  style: VisualStyle,
  mode: MotionMode,
  weapon?: Item,
): Record<string, Clip> {
  const base =
    mode === "grounded" ? groundedMotion[style] : motionProfiles[style];
  const kind = weapon?.weaponType ?? "sword";
  if (kind === "sword" || (mode === "legacy" && weapon?.id === "spear"))
    return base;
  const key = `${style}:${mode}:${kind}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const paired = kind === "glaives",
    grounded = mode === "grounded";
  const guard: Pose = grounded
    ? paired
      ? { farHandX: -12, farHandY: 66, farWrist: 0.9 }
      : {}
    : paired
      ? { farArm: 0.5, farElbow: -0.15 }
      : {};
  const rest = { ...base.idle.frames[0].pose, ...guard };
  const pose = (p: Pose): Pose => ({ ...rest, ...p });
  const frame = (time: number, p: Pose, impact = false) => ({
    time,
    pose: pose(p),
    ...(impact ? { impact: true } : {}),
  });
  const result: Record<string, Clip> = Object.fromEntries(
    Object.entries(base).map(([name, clip]) => [
      name,
      {
        ...clip,
        frames: clip.frames.map((f) => ({
          ...f,
          pose: {
            ...f.pose,
            ...guard,
            ...(paired && grounded && name === "death"
              ? {
                  farHandX: f.time === 0 ? -12 : f.time < 0.48 ? 10 : 45,
                  farHandY: f.time === 0 ? 66 : f.time < 0.48 ? 55 : 20,
                  farWrist: f.time < 0.48 ? 0.9 : 0.6,
                }
              : {}),
            ...(name === "victory"
              ? grounded
                ? {
                    nearHandX: 48,
                    nearHandY: 38,
                    nearWrist: paired ? 0.6 : 0.05,
                    farHandX: paired ? -12 : 36,
                    farHandY: paired ? 66 : 42,
                  }
                : { nearArm: -0.4, nearElbow: -0.5, nearHand: 0 }
              : {}),
          },
        })),
      },
    ]),
  );
  if (grounded) {
    const travel = paired ? 40 : 22,
      reach = paired ? 68 : 64;
    result.quick = {
      duration: base.quick.duration,
      frames: [
        frame(0, {}),
        frame(0.22, {
          rootX: -3,
          rootY: 3,
          nearHandX: 32,
          nearHandY: 44,
          nearWrist: paired ? 0.8 : 1.0,
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
            rootX: travel,
            rootY: 10,
            torso: 0.1,
            nearFootX: paired ? 78 : 62,
            nearHandX: reach,
            nearHandY: paired ? 24 : 32,
            nearWrist: paired ? 1.0 : 1.3,
          },
          true,
        ),
        frame(0.68, {
          rootX: travel,
          rootY: 11,
          torso: 0.12,
          nearFootX: paired ? 78 : 62,
          nearHandX: 60,
          nearHandY: 40,
          nearWrist: paired ? 0.8 : 1.3,
          farHandX: paired ? 0 : 40,
          farHandY: paired ? 66 : 38,
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
          nearWrist: paired ? 0.8 : 1.1,
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
            rootX: paired ? 46 : 30,
            rootY: paired ? 20 : 14,
            torso: 0.15,
            nearFootX: paired ? 84 : 72,
            nearHandX: paired ? 70 : 64,
            nearHandY: paired ? 22 : 32,
            nearWrist: 1.3,
          },
          true,
        ),
        frame(0.78, {
          rootX: paired ? 44 : 28,
          rootY: paired ? 20 : 14,
          torso: 0.17,
          nearFootX: paired ? 84 : 72,
          nearHandX: 60,
          nearHandY: 40,
          nearWrist: paired ? 0.7 : 1.3,
          farHandX: paired ? 4 : 42,
          farHandY: paired ? 64 : 36,
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
  } else {
    // New weapons remain usable with the preserved legacy joint convention.
    for (const name of ["quick", "heavy"])
      result[name] = {
        duration: base[name].duration,
        frames: [
          frame(0, {}),
          frame(0.25, {
            rootX: -5,
            torso: -0.08,
            nearArm: -0.3,
            nearElbow: -1.1,
            nearHand: 0.8,
          }),
          frame(
            0.55,
            {
              rootX: paired ? 95 : 45,
              torso: 0.15,
              nearArm: -1.1,
              nearElbow: -0.25,
              nearHand: paired ? 0.4 : 1.2,
            },
            true,
          ),
          frame(0.72, {
            rootX: paired ? 80 : 40,
            nearArm: -1.2,
            nearElbow: -0.1,
            nearHand: paired ? 0.3 : 1.2,
          }),
          frame(1, {}),
        ],
      };
  }
  cache.set(key, result);
  return result;
}
