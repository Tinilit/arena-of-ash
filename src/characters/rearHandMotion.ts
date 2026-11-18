import type { Clip, Pose } from "./animation";
import { combatRest, freeFrontArm, rearReady } from "./locomotion";
type HandKey = { time: number; x: number; y: number; wrist: number };
function handAt(time: number, keys: HandKey[]): Pose {
  let i = 0;
  while (i < keys.length - 2 && time > keys[i + 1].time) i++;
  const a = keys[i],
    b = keys[i + 1],
    f = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
  return {
    farHandX: a.x + (b.x - a.x) * f,
    farHandY: a.y + (b.y - a.y) * f,
    farWrist: a.wrist + (b.wrist - a.wrist) * f,
  };
}
/** Low rear-shoulder cuts/thrusts keep the long blade outside the head arc. */
export function rearHandMotion(
  front: Record<string, Clip>,
  spear: boolean,
): Record<string, Clip> {
  const result: Record<string, Clip> = {};
  for (const [name, clip] of Object.entries(front))
    result[name] = {
      ...clip,
      frames: clip.frames.map((f) => ({
        ...f,
        pose: { ...f.pose, ...freeFrontArm, ...rearReady },
      })),
    };
  const quick: HandKey[] = [
    { time: 0, x: 32, y: 65, wrist: 0.3 },
    { time: 0.2, x: 40, y: 48, wrist: spear ? 1.2 : 0.85 },
    { time: 0.34, x: 58, y: 28, wrist: 1.1 },
    { time: 0.5, x: 72, y: 8, wrist: 1.3 },
    { time: 0.68, x: 70, y: 18, wrist: 1.3 },
    { time: 0.84, x: 60, y: 36, wrist: 0.35 },
    { time: 1, x: 32, y: 65, wrist: 0.3 },
  ];
  const heavy: HandKey[] = [
    quick[0],
    { time: 0.25, x: 38, y: 52, wrist: 1.2 },
    { time: 0.46, x: 46, y: 40, wrist: 1.2 },
    { time: 0.64, x: 72, y: 10, wrist: 1.3 },
    { time: 0.78, x: 70, y: 20, wrist: 1.3 },
    { time: 0.9, x: 60, y: 38, wrist: 0.35 },
    quick[quick.length - 1],
  ];
  for (const [name, keys] of [
    ["quick", quick],
    ["heavy", heavy],
  ] as const)
    result[name] = {
      ...front[name],
      frames: front[name].frames.map((f) => ({
        ...f,
        pose: { ...f.pose, ...freeFrontArm, ...handAt(f.time, keys) },
      })),
    };
  result.defend = {
    ...result.defend,
    frames: result.defend.frames.map((f) => ({
      ...f,
      pose: { ...f.pose, farHandX: 64, farHandY: 30, farWrist: 0.45 },
    })),
  };
  result.victory = {
    ...result.victory,
    frames: result.victory.frames.map((f) => ({
      ...f,
      pose: {
        ...f.pose,
        farHandX: spear ? 62 : 65,
        farHandY: spear ? 34 : -2,
        farWrist: spear ? 0.1 : 1.3,
      },
    })),
  };
  result.death = {
    ...result.death,
    frames: result.death.frames.map((f) => ({
      ...f,
      pose: { ...f.pose, farHandX: 62, farHandY: 28, farWrist: 0.5 },
    })),
  };
  result.idle = {
    ...front.idle,
    frames: front.idle.frames.map((f) => ({
      ...f,
      pose: { ...combatRest, rootY: (f.pose.rootY ?? 0) + 3 },
    })),
  };
  return result;
}
