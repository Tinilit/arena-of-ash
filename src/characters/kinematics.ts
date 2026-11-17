import type { Pose } from "./animation";
export interface Point {
  x: number;
  y: number;
}
export const skeleton = {
  pelvisY: -120,
  torsoArtY: -76,
  shoulderY: -59,
  headY: -84,
  nearShoulderX: 14,
  farShoulderX: -14,
  hipY: -110,
  nearHipX: 8,
  farHipX: -8,
  upperArm: 40,
  forearm: 34,
  thigh: 54,
  shin: 52,
  soleY: 14,
  elbowMin: 0.035,
  elbowMax: (130 * Math.PI) / 180,
  kneeMin: 0.025,
  kneeMax: (120 * Math.PI) / 180,
  shoulderMin: -Math.PI,
  shoulderMax: Math.PI / 4,
} as const;
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const rotate = (p: Point, a: number): Point => ({
  x: p.x * Math.cos(a) - p.y * Math.sin(a),
  y: p.x * Math.sin(a) + p.y * Math.cos(a),
});
export const add = (a: Point, b: Point): Point => ({
  x: a.x + b.x,
  y: a.y + b.y,
});
export const bone = (length: number, angle: number): Point => ({
  x: -length * Math.sin(angle),
  y: length * Math.cos(angle),
});
export function chain(
  upper: number,
  lower: number,
  angle: number,
  bend: number,
) {
  const mid = bone(upper, angle);
  return { mid, tip: add(mid, bone(lower, angle + bend)) };
}
/** Analytic two-bone IK. Positive bend puts a knee forward; negative bends an elbow. */
export function solveTwoBone(
  target: Point,
  upper: number,
  lower: number,
  sign: 1 | -1,
  minBend: number,
  maxBend: number,
) {
  const requested = Math.hypot(target.x, target.y);
  const reach = (bend: number) =>
    Math.sqrt(
      upper * upper + lower * lower + 2 * upper * lower * Math.cos(bend),
    );
  const distance = clamp(requested, reach(maxBend), reach(minBend));
  const bend =
    sign *
    Math.acos(
      clamp(
        (distance * distance - upper * upper - lower * lower) /
          (2 * upper * lower),
        -1,
        1,
      ),
    );
  const angle =
    Math.atan2(-target.x, target.y) -
    Math.atan2(lower * Math.sin(bend), upper + lower * Math.cos(bend));
  const points = chain(upper, lower, angle, bend);
  return {
    angle,
    bend,
    ...points,
    clamped: Math.abs(requested - distance) > 1e-6,
  };
}
export function groundedPose(p: Pose, travelScale = 1) {
  const v = (key: string, fallback = 0) => p[key] ?? fallback;
  const root = {
    x: v("rootX") * travelScale,
    y: v("rootY"),
    rotation: v("rootR"),
  };
  const world = (q: Point) => add(rotate(q, root.rotation), root);
  const local = (q: Point) =>
    rotate({ x: q.x - root.x, y: q.y - root.y }, -root.rotation);
  const plant = clamp(v("plant", 1), 0, 1),
    torso = v("torso");
  function leg(side: "near" | "far") {
    const hip = {
      x: side === "near" ? skeleton.nearHipX : skeleton.farHipX,
      y: skeleton.hipY,
    };
    const restX = side === "near" ? 32 : -28;
    const target = {
      x: restX + (v(`${side}FootX`, restX) - restX) * travelScale,
      y: -skeleton.soleY + v(`${side}FootY`),
    };
    const tip = local(target);
    const ik = solveTwoBone(
      { x: tip.x - hip.x, y: tip.y - hip.y },
      skeleton.thigh,
      skeleton.shin,
      1,
      skeleton.kneeMin,
      skeleton.kneeMax,
    );
    const angle = ik.angle * plant + v(`${side}Thigh`) * (1 - plant);
    const bend =
      ik.bend * plant +
      clamp(v(`${side}Shin`), 0, skeleton.kneeMax) * (1 - plant);
    const fk = chain(skeleton.thigh, skeleton.shin, angle, bend);
    const foot =
      (-root.rotation - angle - bend) * plant +
      v(`${side}FootAngle`) * (1 - plant);
    const ankle = world(add(hip, fk.tip));
    return {
      angle,
      bend,
      foot,
      hip: world(hip),
      knee: world(add(hip, fk.mid)),
      ankle,
      sole: add(
        ankle,
        rotate(
          { x: 0, y: skeleton.soleY },
          root.rotation + angle + bend + foot,
        ),
      ),
      target,
      clamped: ik.clamped,
      plant,
    };
  }
  function arm(side: "near" | "far") {
    const shoulder = {
      x: side === "near" ? skeleton.nearShoulderX : skeleton.farShoulderX,
      y: skeleton.shoulderY,
    };
    const target = { x: v(`${side}HandX`, 44), y: v(`${side}HandY`, 42) };
    const ik = solveTwoBone(
      target,
      skeleton.upperArm,
      skeleton.forearm,
      -1,
      skeleton.elbowMin,
      skeleton.elbowMax,
    );
    const angle = clamp(ik.angle, skeleton.shoulderMin, skeleton.shoulderMax);
    const fk = chain(skeleton.upperArm, skeleton.forearm, angle, ik.bend);
    const toWorld = (q: Point) =>
      world(
        add({ x: 0, y: skeleton.pelvisY }, rotate(add(shoulder, q), torso)),
      );
    return {
      angle,
      bend: ik.bend,
      wrist: clamp(v(`${side}Wrist`), -0.65, 1.3),
      shoulder: toWorld({ x: 0, y: 0 }),
      elbow: toWorld(fk.mid),
      hand: toWorld(fk.tip),
      clamped: ik.clamped,
    };
  }
  const nearLeg = leg("near"),
    farLeg = leg("far");
  // Released feet can roll during a collapse, but their heel/toe sole line
  // cannot pass through the ground. Translate the solved pose as one rigid
  // assembly; never stretch a segment or feed the correction back into IK.
  if (plant < 1) {
    const bottom = (leg: typeof nearLeg) => {
      const angle = root.rotation + leg.angle + leg.bend + leg.foot;
      return Math.max(
        ...[-13, 28].map(
          (x) => leg.ankle.y + rotate({ x, y: skeleton.soleY }, angle).y,
        ),
      );
    };
    const penetration = Math.max(0, bottom(nearLeg), bottom(farLeg));
    root.y -= penetration;
    for (const leg of [nearLeg, farLeg])
      for (const point of [leg.hip, leg.knee, leg.ankle, leg.sole])
        point.y -= penetration;
  }
  return {
    root,
    torso,
    plant,
    nearLeg,
    farLeg,
    nearArm: arm("near"),
    farArm: arm("far"),
  };
}
