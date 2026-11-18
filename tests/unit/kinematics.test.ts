import { describe, it, expect } from "vitest";
import { Animator } from "../../src/characters/animation";
import { groundedMotion } from "../../src/characters/groundedMotion";
import {
  groundedPose,
  skeleton,
  solveTwoBone,
  chain,
  rotate,
  add,
} from "../../src/characters/kinematics";
import { visualStyles } from "../../src/characters/presentation";
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
describe("anatomical joint mechanics", () => {
  it("keeps unreachable targets on fixed-length limbs without reversing a knee", () => {
    for (const target of [
      { x: 1000, y: 1000 },
      { x: 0, y: 0 },
      { x: -1000, y: 0 },
    ]) {
      const leg = solveTwoBone(target, 54, 52, 1, 0.025, 2.094);
      expect(leg.bend).toBeGreaterThan(0);
      expect(leg.bend).toBeLessThanOrEqual(2.094 + 1e-8);
      expect(Math.hypot(leg.mid.x, leg.mid.y)).toBeCloseTo(54, 8);
      expect(distance(leg.mid, leg.tip)).toBeCloseTo(52, 8);
      expect(Object.values(leg.tip).every(Number.isFinite)).toBe(true);
    }
  });
  it("solves opposite elbow and knee bend directions", () => {
    const knee = solveTwoBone({ x: 0, y: 90 }, 54, 52, 1, 0.025, 2.094),
      elbow = solveTwoBone({ x: 50, y: 40 }, 40, 34, -1, 0.035, 2.269);
    expect(knee.mid.x).toBeGreaterThan(0);
    expect(knee.bend).toBeGreaterThan(0);
    expect(elbow.bend).toBeLessThan(0);
    expect(
      distance(chain(40, 34, elbow.angle, elbow.bend).tip, { x: 50, y: 40 }),
    ).toBeLessThan(1e-8);
  });
  for (const style of visualStyles) {
    for (const name of Object.keys(groundedMotion[style])) {
      it(`${style}/${name}: fixed segment lengths, constrained joints, and planted soles`, () => {
        const animator = new Animator(groundedMotion[style]);
        animator.play(name);
        for (
          let i = 0;
          i < Math.ceil(groundedMotion[style][name].duration / 16) + 4;
          i++
        ) {
          const p = animator.update(16),
            solved = groundedPose(p);
          for (const leg of [solved.nearLeg, solved.farLeg]) {
            expect(distance(leg.hip, leg.knee)).toBeCloseTo(skeleton.thigh, 7);
            expect(distance(leg.knee, leg.ankle)).toBeCloseTo(skeleton.shin, 7);
            expect(leg.bend).toBeGreaterThanOrEqual(0);
            expect(leg.bend).toBeLessThanOrEqual(skeleton.kneeMax + 1e-8);
            if (leg.plant === 1) {
              expect(leg.clamped, `${name}: unreachable foot target`).toBe(
                false,
              );
              expect(distance(leg.ankle, leg.target)).toBeLessThan(1e-6);
              expect(leg.sole.y).toBeCloseTo(
                (leg === solved.nearLeg ? p.nearFootY : p.farFootY) ?? 0,
                7,
              );
            }
          }
          for (const arm of [solved.nearArm, solved.farArm]) {
            expect(distance(arm.shoulder, arm.elbow)).toBeCloseTo(
              skeleton.upperArm,
              7,
            );
            expect(distance(arm.elbow, arm.hand)).toBeCloseTo(
              skeleton.forearm,
              7,
            );
            expect(arm.bend).toBeLessThanOrEqual(-skeleton.elbowMin + 1e-8);
            expect(arm.bend).toBeGreaterThanOrEqual(-skeleton.elbowMax - 1e-8);
            expect(arm.angle).toBeGreaterThanOrEqual(skeleton.shoulderMin);
            expect(arm.angle).toBeLessThanOrEqual(skeleton.shoulderMax);
          }
        }
      });
    }
  }
  it("keeps the rear sole locked throughout a lunge and return", () => {
    for (const name of ["quick", "heavy"]) {
      const a = new Animator(groundedMotion.ash);
      a.play(name);
      for (let i = 0; i < 80; i++) {
        const p = a.update(16);
        expect(groundedPose(p).farLeg.sole.x).toBeCloseTo(-28, 7);
        expect(groundedPose(p).farLeg.sole.y).toBeCloseTo(0, 7);
      }
    }
  });
  it("delivers one impact and completion in every grounded attack even with skipped frames", () => {
    for (const style of visualStyles)
      for (const name of ["quick", "heavy", "defend", "recover"]) {
        const a = new Animator(groundedMotion[style]);
        let impact = 0,
          done = 0;
        a.play(
          name,
          () => impact++,
          () => done++,
        );
        a.update(5000);
        a.update(5000);
        expect(impact).toBe(1);
        expect(done).toBe(1);
      }
  });
});

function intersectsFace(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  let enter = 0,
    exit = 1;
  for (const [axis, min, max] of [
    ["x", -23, 26],
    ["y", -35, 12],
  ] as const) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-10) {
      if (a[axis] < min || a[axis] > max) return false;
      continue;
    }
    const lo = (min - a[axis]) / delta,
      hi = (max - a[axis]) / delta;
    enter = Math.max(enter, Math.min(lo, hi));
    exit = Math.min(exit, Math.max(lo, hi));
    if (enter > exit) return false;
  }
  return true;
}
for (const style of visualStyles)
  it(`${style}: sword and spear blades do not sweep through the face`, () => {
    for (const [name, clip] of Object.entries(groundedMotion[style])) {
      const a = new Animator(groundedMotion[style]);
      a.play(name);
      for (let time = 8; time <= clip.duration; time += 8) {
        const p = a.update(8),
          s = groundedPose(p),
          torso = p.torso ?? 0,
          rootR = p.rootR ?? 0,
          headR = rootR + torso + (p.head ?? 0);
        const head = add(
          rotate(
            add(
              { x: 0, y: skeleton.pelvisY },
              rotate({ x: 0, y: skeleton.headY }, torso),
            ),
            rootR,
          ),
          s.root,
        );
        const bladeR =
          rootR +
          torso +
          s.nearArm.angle +
          s.nearArm.bend +
          s.nearArm.wrist +
          (p.weaponGrip ?? Math.PI / 2);
        const local = (length: number) => {
          const q = add(s.nearArm.hand, rotate({ x: 0, y: -length }, bladeR));
          return rotate({ x: q.x - head.x, y: q.y - head.y }, -headR);
        };
        expect(
          intersectsFace(local(15), local(143)),
          `${style}/${name} face clearance at ${time}ms`,
        ).toBe(false);
      }
    }
  });

for (const style of visualStyles)
  it(`${style}: rolling heels and toes never penetrate the floor during a collapse`, () => {
    const a = new Animator(groundedMotion[style]);
    a.play("death");
    for (let i = 0; i < 160; i++) {
      const p = a.update(8),
        s = groundedPose(p);
      for (const leg of [s.nearLeg, s.farLeg]) {
        const angle = s.root.rotation + leg.angle + leg.bend + leg.foot;
        for (const x of [-13, 28])
          expect(
            leg.ankle.y + rotate({ x, y: 14 }, angle).y,
          ).toBeLessThanOrEqual(1e-7);
      }
    }
  });
