import { describe, expect, it } from "vitest";
import { RealtimeBattle, arenaRules } from "../../src/combat/realtime";
import { hopDefinitions } from "../../src/combat/hops";
import { createPlayer } from "../../src/domain/model";
import { opponent } from "../../src/domain/progression";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
import { groundedPose } from "../../src/characters/kinematics";
const make = () => new RealtimeBattle(createPlayer(), opponent(createPlayer()));
const step = (b: RealtimeBattle) => b.advance(arenaRules.step, [{}, {}]);

describe("player directional hops", () => {
  for (const direction of [-1, 1] as const) {
    const kind = direction < 0 ? "backstep" : "forwardHop";
    it(`${kind}: anticipates, follows a ballistic arc, lands and cools down without attacking`, () => {
      const b = make(),
        start = b.player.x;
      b.advance(0, [{ hop: direction }, { hop: direction }]);
      expect(b.enemy.hop?.kind ?? null).toBe(kind);
      expect(b.player.hop?.phase).toBe("anticipation");
      expect(b.player.y).toBe(0);
      let minimum = 0;
      const phases = new Set<string>();
      for (let i = 0; i < 150 && b.player.hop; i++) {
        phases.add(b.player.hop.phase);
        // Releasing keys does not cancel the launch impulse.
        step(b);
        minimum = Math.min(minimum, b.player.y);
        expect(b.player.action).toBeNull();
      }
      expect([...phases]).toEqual(["anticipation", "air", "landing"]);
      expect(minimum).toBeCloseTo(
        -(hopDefinitions[kind].jumpSpeed ** 2) / (2 * arenaRules.gravity),
        0,
      );
      expect((b.player.x - start) * direction).toBeGreaterThan(100);
      expect((b.player.x - start) * direction).toBeLessThan(145);
      expect(b.player.y).toBe(0);
      expect(b.player.vy).toBe(0);
      expect(b.canHop(b.player, direction)).toBe(false);
      expect(b.enemy.hp).toBe(100);
      expect(b.contacts).toEqual([]);
      for (let i = 0; i < 25; i++) step(b);
      expect(b.canHop(b.player, direction)).toBe(true);
    });
  }
  it("rejects air retriggers without replacing a hop or ordinary jump", () => {
    const b = make();
    b.advance(0, [{ hop: -1 }, {}]);
    for (let i = 0; i < 12; i++) step(b);
    const hop = b.player.hop,
      vy = b.player.vy;
    b.advance(arenaRules.step, [{ hop: 1, jump: true }, {}]);
    expect(b.player.hop).toBe(hop);
    expect(b.player.vy).toBeGreaterThan(vy);
    const ordinary = make();
    ordinary.advance(8, [{ jump: true }, {}]);
    ordinary.advance(8, [{ hop: 1 }, {}]);
    expect(ordinary.player.hop).toBeNull();
    expect(ordinary.player.y).toBeLessThan(0);
  });
  it("mirrors relative hops and locks direction when the opponent crosses", () => {
    const b = make();
    b.enemy.x = 100;
    b.advance(0, [{ hop: -1 }, {}]);
    expect(b.player.facing).toBe(-1);
    expect(b.player.hop?.direction).toBe(1);
    b.enemy.x = 900;
    for (let i = 0; i < 20; i++) step(b);
    expect(b.player.x).toBeGreaterThan(370);
    expect(b.player.facing).toBe(-1);
  });
  it("respects arena walls and opponent separation", () => {
    const b = make();
    b.player.x = arenaRules.minX;
    b.advance(0, [{ hop: -1 }, {}]);
    for (let i = 0; i < 80; i++) step(b);
    expect(b.player.x).toBe(arenaRules.minX);
    b.player.x = 500;
    b.enemy.x = 570;
    b.advance(0, [{ hop: 1 }, {}]);
    for (let i = 0; i < 100; i++) {
      step(b);
      expect(b.enemy.x - b.player.x).toBeGreaterThanOrEqual(64 - 1e-6);
    }
  });
  it("allows a manually requested swing and remains vulnerable to real weapon contact", () => {
    const b = make();
    b.advance(0, [{ hop: 1, attack: "quick" }, { attack: "quick" }]);
    for (let i = 0; i < 60; i++) step(b);
    expect(b.player.hop?.phase).toBe("air");
    expect(b.player.action?.name).toBe("quick");
    const capsule = { a: { x: 0, y: 0 }, b: { x: 0, y: 20 }, radius: 3 };
    const geometry = { blade: capsule, body: [capsule] };
    const events = b.resolve([geometry, geometry]);
    expect(events).toHaveLength(2);
    expect(b.player.hp).toBeLessThan(100);
  });
  it("allows either character to hop forward and backward or jump", () => {
    const b = make();
    expect(b.canHop(b.enemy, 1)).toBe(true);
    b.advance(8, [{}, { move: -1, jump: true }]);
    expect(b.enemy.hop).toBeNull();
    expect(b.enemy.y).toBeLessThan(0);
  });
  it("keeps hop bones fixed and grounded soles above the floor", () => {
    for (const direction of [-1, 1] as const) {
      const b = make(),
        motion = new ArenaMotion(b.player.model);
      b.advance(0, [{ hop: direction }, {}]);
      for (let i = 0; i < 100; i++) {
        step(b);
        const pose = motion.update(arenaRules.step, b.player),
          rig = groundedPose(pose);
        for (const leg of [rig.nearLeg, rig.farLeg]) {
          expect(
            Math.hypot(leg.hip.x - leg.knee.x, leg.hip.y - leg.knee.y),
          ).toBeCloseTo(54, 7);
          expect(
            Math.hypot(leg.ankle.x - leg.knee.x, leg.ankle.y - leg.knee.y),
          ).toBeCloseTo(52, 7);
          expect(leg.bend).toBeGreaterThan(0);
          if (rig.plant === 1)
            expect(leg.ankle.y + 14).toBeLessThanOrEqual(1e-6);
        }
      }
    }
  });
});

it("finishes hop landing compression without triggering a second ordinary-jump bounce", () => {
  for (const direction of [-1, 1] as const) {
    const b = make(),
      motion = new ArenaMotion(b.player.model);
    b.advance(0, [{ hop: direction }, {}]);
    let previous = motion.update(0, b.player),
      phase = b.player.hop?.phase;
    let checked = false;
    for (let i = 0; i < 110; i++) {
      step(b);
      const pose = motion.update(arenaRules.step, b.player);
      if (phase === "landing" && !b.player.hop) {
        expect(Math.abs(pose.rootY! - previous.rootY!)).toBeLessThan(0.3);
        checked = true;
      }
      phase = b.player.hop?.phase;
      previous = pose;
    }
    expect(checked).toBe(true);
  }
});
