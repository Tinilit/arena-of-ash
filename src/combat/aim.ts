import type { Point } from "./geometry";
import type { ArenaFighter } from "./realtime";
/** Low ballistic arc at a fixed launch speed, including gravity compensation. */
export function aimedVelocity(
  origin: Point,
  target: Point,
  speed = 1150,
  gravity = 220,
) {
  const dx = target.x - origin.x,
    dy = target.y - origin.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const b = speed * speed + gravity * dy;
  const discriminant = b * b - gravity * gravity * distance * distance;
  const time =
    discriminant >= 0 && b > 0
      ? Math.sqrt((2 * distance * distance) / (b + Math.sqrt(discriminant)))
      : distance / speed;
  return { vx: dx / time, vy: dy / time - (gravity * time) / 2 };
}
export function aimAtFighter(f: ArenaFighter): Point {
  const size = f.model.combatProfile?.size ?? 1;
  return { x: f.x, y: 551 + f.y - (f.knockdown ? 35 : 145) * size };
}
export function rangedPitch(f: ArenaFighter) {
  if (!f.aim) return 0;
  const size = f.model.combatProfile?.size ?? 1;
  const origin = { x: f.x + f.facing * 28 * size, y: 551 + f.y - 181 * size };
  const velocity = aimedVelocity(origin, f.aim);
  return Math.max(
    -1.5,
    Math.min(1.5, Math.atan2(velocity.vy, Math.abs(velocity.vx))),
  );
}
