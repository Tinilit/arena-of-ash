import { trainedGladiator as createPlayer } from "../fixtures/trained";
import { describe, expect, it, vi } from "vitest";

import { opponent } from "../../src/domain/progression";
import {
  RealtimeBattle,
  arenaRules,
  knockdownTiming,
} from "../../src/combat/realtime";
import type { CombatGeometry } from "../../src/combat/geometry";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
import { knockdownPose } from "../../src/characters/knockdownMotion";
import { combatRest, relaxedRest } from "../../src/characters/locomotion";
import {
  groundedPose,
  rotate,
  add,
  skeleton,
} from "../../src/characters/kinematics";
import { Animator } from "../../src/characters/animation";
import { equipmentMotion } from "../../src/characters/equipmentMotion";
import { throwTiming } from "../../src/characters/throwMotion";
const shape = { a: { x: 0, y: 0 }, b: { x: 0, y: 20 }, radius: 5 };
const geometry: CombatGeometry = {
  blade: shape,
  feet: { front: shape, rear: shape },
  body: [shape],
};
function battle(roll = 0) {
  const p = createPlayer();
  return new RealtimeBattle(p, opponent(p), () => roll);
}
function kick(b: RealtimeBattle) {
  b.advance(0, [{ attack: "kick" }, {}]);
  b.advance(420, [{}, {}]);
  return b.resolve([geometry, geometry])[0];
}
describe("contact-based knockdown", () => {
  it("uses the exact 20% threshold and rolls only once after boot/body contact", () => {
    let falls = 0;
    for (let i = 0; i < 100; i++) if (kick(battle(i / 100)).knockdown) falls++;
    expect(falls).toBe(20);
    const rng = vi.fn(() => 0),
      p = createPlayer(),
      b = new RealtimeBattle(p, opponent(p), rng);
    b.advance(0, [{ attack: "kick" }, {}]);
    expect(b.resolve([geometry, geometry])).toEqual([]);
    expect(rng).not.toHaveBeenCalled();
    b.advance(420, [{}, {}]);
    const miss = {
      ...geometry,
      feet: {
        rear: shape,
        front: { ...shape, a: { x: 500, y: 0 }, b: { x: 500, y: 20 } },
      },
    };
    expect(b.resolve([miss, geometry])).toEqual([]);
    expect(rng).not.toHaveBeenCalled();
    expect(b.resolve([geometry, geometry])[0].knockdown).toBe(true);
    b.resolve([geometry, geometry]);
    expect(rng).toHaveBeenCalledTimes(1);
  });
  it("holds the floor for one second, then gets up heavily without any jump impulse", () => {
    const b = battle();
    kick(b);
    const f = b.enemy,
      motion = new ArenaMotion(f.model);
    const commands = {
      move: -1,
      run: true,
      jump: true,
      attack: "quick" as const,
      guard: true,
    };
    let downTime = 0,
      getUpTime = 0,
      seenDown = false,
      seenGetUp = false;
    for (let i = 0; i < 410; i++) {
      const previous = f.knockdown?.phase;
      b.advance(arenaRules.step, [{}, commands]);
      const p = motion.update(arenaRules.step, f);
      if (f.knockdown) {
        expect(f.action).toBeNull();
        expect(f.guard).toBe(false);
        expect(b.canAttack(f, "kick")).toBe(false);
        expect(f.y).toBe(0);
        expect(f.vy).toBe(0);
        if (f.knockdown.phase === "down") {
          seenDown = true;
          downTime += arenaRules.step;
          expect(f.pushVx).toBe(0);
          expect(f.vx).toBe(0);
          expect(p.rootR).toBeLessThan(-1.4);
        }
        if (f.knockdown.phase === "getUp") {
          seenGetUp = true;
          getUpTime += arenaRules.step;
          expect(motion.name).toBe("getUp");
        }
      } else if (previous) break;
    }
    expect(seenDown && seenGetUp).toBe(true);
    expect(downTime).toBeGreaterThanOrEqual(
      knockdownTiming.down - arenaRules.step,
    );
    expect(getUpTime).toBeGreaterThanOrEqual(
      knockdownTiming.getUp - arenaRules.step,
    );
    expect(f.knockdown).toBeNull();
  });
  it("does not restart a floor transfer when further real hits land", () => {
    const b = battle();
    kick(b);
    b.advance(700, [{}, {}]);
    const state = b.enemy.knockdown!,
      hp = b.enemy.hp;
    b.player.action = {
      id: 99,
      name: "quick",
      hand: "rear",
      elapsed: 550,
      duration: 1000,
      hit: false,
    };
    b.resolve([geometry, geometry]);
    expect(b.enemy.hp).toBeLessThan(hp);
    expect(b.enemy.knockdown).toBe(state);
    expect(b.enemy.reaction).toBeNull();
  });
  it("finishes an airborne fall on the ground before starting the one-second hold", () => {
    const b = battle();
    b.enemy.y = -50;
    b.enemy.vy = -400;
    kick(b);
    b.advance(550, [{}, {}]);
    expect(b.enemy.knockdown?.phase).toBe("fall");
    for (let i = 0; i < 140 && b.enemy.knockdown?.phase === "fall"; i++)
      b.advance(arenaRules.step, [{}, {}]);
    expect(b.enemy.y).toBe(0);
    expect(b.enemy.knockdown?.phase).toBe("down");
    expect(b.enemy.knockdown?.elapsed).toBe(0);
  });
});
it("keeps every fall/get-up segment fixed, joints constrained and body art above the floor", () => {
  for (const phase of ["fall", "down", "getUp"] as const) {
    const duration = knockdownTiming[phase];
    for (let elapsed = 0; elapsed <= duration; elapsed += 8) {
      const p = knockdownPose({ phase, elapsed }, combatRest),
        s = groundedPose(p);
      for (const a of [s.nearArm, s.farArm]) {
        expect(
          Math.hypot(a.elbow.x - a.shoulder.x, a.elbow.y - a.shoulder.y),
        ).toBeCloseTo(40, 7);
        expect(
          Math.hypot(a.hand.x - a.elbow.x, a.hand.y - a.elbow.y),
        ).toBeCloseTo(34, 7);
        expect(a.bend).toBeGreaterThanOrEqual(-skeleton.elbowMax);
      }
      for (const l of [s.nearLeg, s.farLeg]) {
        expect(Math.hypot(l.knee.x - l.hip.x, l.knee.y - l.hip.y)).toBeCloseTo(
          54,
          7,
        );
        expect(
          Math.hypot(l.ankle.x - l.knee.x, l.ankle.y - l.knee.y),
        ).toBeCloseTo(52, 7);
        expect(l.bend).toBeLessThanOrEqual(skeleton.kneeMax);
        const angle = s.root.rotation + l.angle + l.bend + l.foot;
        for (const x of [-13, 27])
          for (const y of [-14, 14])
            expect(l.ankle.y + rotate({ x, y }, angle).y).toBeLessThanOrEqual(
              1e-6,
            );
      }
      const head = add(
        s.root,
        rotate(
          add(
            { x: 0, y: skeleton.pelvisY },
            rotate({ x: 0, y: skeleton.headY }, s.torso),
          ),
          s.root.rotation,
        ),
      );
      for (const x of [-32, 34])
        for (const y of [-49, 26])
          expect(
            head.y +
              rotate({ x, y }, s.root.rotation + s.torso + (p.head ?? 0)).y,
          ).toBeLessThanOrEqual(1e-6);
    }
  }
});
it("points the rear weapon slightly up in combat and down only when relaxed", () => {
  for (const [p, upward] of [
    [combatRest, true],
    [relaxedRest, false],
  ] as const) {
    const s = groundedPose(p),
      a = s.farArm;
    const axis = rotate(
      { x: 0, y: -1 },
      s.root.rotation + s.torso + a.angle + a.bend + a.wrist + p.weaponGrip!,
    );
    expect(axis.x).toBeGreaterThan(0.8);
    if (upward) {
      expect(axis.y).toBeLessThan(-0.1);
      expect(axis.y).toBeGreaterThan(-0.55);
    } else expect(axis.y).toBeGreaterThan(0.1);
  }
});
it("throws on a continuous elbow branch with no shoulder flip or hand teleport", () => {
  const a = new Animator(equipmentMotion());
  a.play("throw");
  let old = groundedPose(a.update(0));
  for (let t = 8; t < throwTiming.duration; t += 8) {
    const next = groundedPose(a.update(8));
    expect(Math.abs(next.farArm.angle - old.farArm.angle)).toBeLessThan(0.12);
    expect(
      Math.hypot(
        next.farArm.hand.x - old.farArm.hand.x,
        next.farArm.hand.y - old.farArm.hand.y,
      ),
    ).toBeLessThan(8);
    old = next;
  }
});

it.each(["rear", "front"] as const)(
  "returns from get-up to the %s-hand loadout without a grip snap",
  (primary) => {
    const b = battle();
    b.player.model.equipment =
      primary === "rear"
        ? { rightHand: "wood", leftHand: "war-spear" }
        : { leftHand: "wood" };
    const motion = new ArenaMotion(b.player.model);
    b.player.vx = 150;
    for (let i = 0; i < 40; i++) motion.update(arenaRules.step, b.player);
    b.player.vx = 0;
    b.player.knockdown = { phase: "getUp", elapsed: knockdownTiming.getUp };
    const before = motion.update(arenaRules.step, b.player);
    b.player.knockdown = null;
    b.player.vx = arenaRules.walk;
    const after = motion.update(arenaRules.step, b.player);
    for (const prefix of ["near", "far"]) {
      expect(
        Math.abs(
          after[`${prefix}WeaponGrip`]! - before[`${prefix}WeaponGrip`]!,
        ),
      ).toBeLessThan(0.03);
      const a = groundedPose(before),
        c = groundedPose(after);
      const first = prefix === "near" ? a.nearArm : a.farArm,
        second = prefix === "near" ? c.nearArm : c.farArm;
      expect(
        Math.hypot(second.hand.x - first.hand.x, second.hand.y - first.hand.y),
      ).toBeLessThan(2);
    }
  },
);
