import type { Item, Hand, EquipmentSlot } from "../domain/model";
import { weaponHitbox } from "./weaponGeometry";
import type { Capsule, Point } from "./geometry";
export interface Projectile {
  id: number;
  kind?: "bolt" | "disarmed";
  timeScale?: number;
  ownerId: string;
  itemId: string;
  hand: Hand;
  sourceSlot: EquipmentSlot;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  previous: { x: number; y: number; angle: number };
  attack: number;
  floorRadius: number;
  profile: { startY: number; endY: number; radius: number };
  age: number;
  state: "flying" | "spent" | "landed" | "expired" | "pickedUp";
}
export function deflectBolt(
  p: Projectile,
  point: Point,
  ownerId: string,
  random: () => number,
) {
  const angle = random() * Math.PI * 2;
  const speed = Math.hypot(p.vx, p.vy);
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  p.ownerId = ownerId;
  p.vx = dx * speed;
  p.vy = dy * speed;
  p.x = point.x + dx * 40;
  p.y = point.y + dy * 40;
  p.angle = angle + Math.PI / 2;
  p.previous = { x: p.x, y: p.y, angle: p.angle };
  p.spin = 0;
}
export function projectileProfile(item: Item) {
  if (item.weaponType === "crossbow")
    return { startY: -100, endY: 25, radius: 12 };
  return (
    item.hitbox ??
    (item.image
      ? weaponHitbox(item)!
      : item.visual === "throwing-knife"
        ? { startY: -55, endY: -10, radius: 4 }
        : item.visual === "throwing-axe"
          ? { startY: -62, endY: -29, radius: 12 }
          : weaponHitbox(item)!)
  );
}
export function projectileFloorRadius(item: Item) {
  if (item.visual === "trident") return 30;
  if (item.visual === "crossbow") return 48;
  return item.image
    ? item.image.width * Math.max(item.image.originX, 1 - item.image.originX)
    : item.visual === "throwing-axe"
      ? 39
      : item.visual === "throwing-knife"
        ? 10
        : item.visual === "greatsword"
          ? 27
          : ["war-hammer", "battle-axe"].includes(item.visual)
            ? 34
            : 22;
}
export function projectileShape(p: Projectile, previous = false): Capsule {
  const pose = previous ? p.previous : p,
    radius = Math.min(
      p.profile.radius,
      (p.profile.endY - p.profile.startY) / 2,
    );
  const point = (y: number): Point => ({
    x: pose.x - Math.sin(pose.angle) * y,
    y: pose.y + Math.cos(pose.angle) * y,
  });
  return {
    a: point(p.profile.startY + radius),
    b: point(p.profile.endY - radius),
    radius,
  };
}
export function advanceProjectile(p: Projectile, delta: number, floor: number) {
  p.previous = { x: p.x, y: p.y, angle: p.angle };
  if (p.state === "landed" || p.state === "expired" || p.state === "pickedUp")
    return;
  delta *= p.timeScale ?? 1;
  const dt = delta / 1000;
  p.age += delta;
  p.x += p.vx * dt;
  if (p.kind === "disarmed" && (p.x < 90 || p.x > 1190)) {
    p.x = Math.max(90, Math.min(1190, p.x));
    p.vx *= -0.55;
    p.spin *= -0.7;
  }
  const gravity = p.kind === "bolt" ? 220 : 1000;
  p.y += p.vy * dt + 0.5 * gravity * dt * dt;
  p.vy += gravity * dt;
  p.angle = p.spin
    ? p.angle + p.spin * dt
    : Math.atan2(p.vy, p.vx) + Math.PI / 2;
  if (p.age > 8000 || p.x < -600 || p.x > 1880) p.state = "expired";
  // Landing is committed after the body sweep, so fast objects cannot skip a hit.
  if (p.y > floor + 200) p.state = "expired";
}
export function pickupDistance(p: Projectile, x: number) {
  const c = projectileShape(p);
  return Math.max(
    Math.min(p.x, c.a.x, c.b.x) - x,
    0,
    x - Math.max(p.x, c.a.x, c.b.x),
  );
}
export function settleProjectile(p: Projectile, floor: number) {
  if (p.state !== "flying" && p.state !== "spent") return;
  const c = projectileShape(p);
  if (Math.max(c.a.y, c.b.y) + c.radius >= floor) {
    p.state = "landed";
    p.angle = p.vx >= 0 ? Math.PI / 2 : -Math.PI / 2;
    p.y = floor - p.floorRadius;
    p.vx = 0;
    p.vy = 0;
    p.spin = 0;
  }
}
