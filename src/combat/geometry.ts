import type { Hand, WeaponHitbox } from "../domain/model";
export interface Point {
  x: number;
  y: number;
}
export interface Capsule {
  a: Point;
  b: Point;
  radius: number;
}
export interface CombatGeometry {
  blade: Capsule | null;
  shove?: Capsule;
  grips?: Record<Hand, Point>;
  launch?: Partial<
    Record<Hand, { profile: WeaponHitbox; floorRadius: number }>
  >;
  body: Capsule[];
  blades?: Partial<Record<Hand, Capsule>>;
  hands?: Record<Hand, Capsule>;
  feet?: Record<Hand, Capsule>;
}
export interface SweptCollision {
  point: Point;
  blade: Capsule;
  body: Capsule;
}
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Closest points on two finite segments, including parallel/degenerate cases. */
export function segmentDistance(a: Point, b: Point, c: Point, d: Point) {
  const u = sub(b, a),
    v = sub(d, c),
    w = sub(a, c);
  const aa = dot(u, u),
    bb = dot(u, v),
    cc = dot(v, v),
    dd = dot(u, w),
    ee = dot(v, w);
  let s = 0,
    t = 0;
  if (aa < 1e-12) t = cc > 1e-12 ? clamp(ee / cc) : 0;
  else {
    if (cc < 1e-12) s = clamp(-dd / aa);
    else {
      const denominator = aa * cc - bb * bb;
      s = denominator > 1e-12 ? clamp((bb * ee - cc * dd) / denominator) : 0;
      t = (bb * s + ee) / cc;
      if (t < 0) {
        t = 0;
        s = clamp(-dd / aa);
      } else if (t > 1) {
        t = 1;
        s = clamp((bb - dd) / aa);
      }
    }
  }
  const p = mix(a, b, s),
    q = mix(c, d, t);
  return { distance: Math.hypot(p.x - q.x, p.y - q.y), point: mix(p, q, 0.5) };
}
export function contact(a: Capsule, b: Capsule): Point | null {
  const closest = segmentDistance(a.a, a.b, b.a, b.b);
  return closest.distance <= a.radius + b.radius ? closest.point : null;
}
const interpolate = (a: Capsule, b: Capsule, t: number): Capsule => ({
  a: mix(a.a, b.a, t),
  b: mix(a.b, b.b, t),
  radius: Math.max(a.radius, b.radius),
});

/** Sweep both moving shapes in the same time interval, never a static target AABB. */
export function sweptContact(
  previousBlade: Capsule,
  blade: Capsule,
  previousBody: Capsule,
  body: Capsule,
): SweptCollision | null {
  for (const axis of ["x", "y"] as const) {
    const bladePoints = [
      previousBlade.a[axis],
      previousBlade.b[axis],
      blade.a[axis],
      blade.b[axis],
    ];
    const bodyPoints = [
      previousBody.a[axis],
      previousBody.b[axis],
      body.a[axis],
      body.b[axis],
    ];
    const radius =
      Math.max(previousBlade.radius, blade.radius) +
      Math.max(previousBody.radius, body.radius);
    if (
      Math.max(...bladePoints) + radius < Math.min(...bodyPoints) ||
      Math.max(...bodyPoints) + radius < Math.min(...bladePoints)
    )
      return null;
  }
  const travel = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const maximum =
    Math.max(
      travel(previousBlade.a, blade.a),
      travel(previousBlade.b, blade.b),
    ) +
    Math.max(travel(previousBody.a, body.a), travel(previousBody.b, body.b));
  const spacing = Math.max(0.25, Math.min(blade.radius, body.radius) * 0.5);
  const samples = Math.max(1, Math.ceil(maximum / spacing));
  for (let i = 0; i <= samples; i++) {
    const sampledBlade = interpolate(previousBlade, blade, i / samples),
      sampledBody = interpolate(previousBody, body, i / samples);
    const p = contact(sampledBlade, sampledBody);
    if (p) return { point: p, blade: sampledBlade, body: sampledBody };
  }
  return null;
}
