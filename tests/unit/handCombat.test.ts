import { describe, it, expect } from "vitest";
import {
  RealtimeBattle,
  arenaRules,
  attackTimings,
} from "../../src/combat/realtime";
import { createPlayer, type Hand } from "../../src/domain/model";
import { opponent } from "../../src/domain/progression";
import type { Capsule, CombatGeometry } from "../../src/combat/geometry";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
const cap = (x: number): Capsule => ({
  a: { x, y: 0 },
  b: { x, y: 20 },
  radius: 4,
});
const make = () => {
  const p = createPlayer();
  return new RealtimeBattle(p, opponent(p), () => 0.5);
};
const geometry = (front: number, rear: number, body = 0): CombatGeometry => ({
  blade: cap(rear),
  blades: { rear: cap(rear), front: cap(front) },
  hands: { front: cap(front), rear: cap(rear) },
  feet: { front: cap(front), rear: cap(rear) },
  body: [cap(body)],
});
const active = (b: RealtimeBattle) => b.advance(550, [{}, {}]);
describe("explicit hand attacks", () => {
  it("rejects an empty front hand even when the rear blade touches", () => {
    const b = make();
    b.advance(0, [{ attack: "quick", hand: "front" }, {}]);
    active(b);
    expect(b.player.action).toBeNull();
    expect(b.resolve([geometry(0, 0), geometry(0, 0)])).toEqual([]);
    expect(b.enemy.hp).toBe(100);
  });
  it("uses the chosen second weapon's capsule and stats without a primary fallback", () => {
    const b = make();
    b.player.model.equipment.leftHand = "war-spear";
    b.advance(0, [{ attack: "quick", hand: "front" }, {}]);
    active(b);
    expect(b.resolve([geometry(100, 0), geometry(0, 0)])).toEqual([]);
    const [hit] = b.resolve([geometry(0, 100), geometry(0, 0)]);
    expect(hit.kind).toBe("weapon");
    expect(hit.damage).toBe(22);
  });
  it.each(["front", "rear"] as Hand[])(
    "rejects an empty %s hand for either fighter",
    (hand) => {
      const b = make();
      b.player.model.equipment = {};
      b.enemy.model.equipment = {};
      b.advance(0, [
        { attack: "quick", hand },
        { attack: "quick", hand },
      ]);
      active(b);
      expect(b.player.action).toBeNull();
      expect(b.enemy.action).toBeNull();
      expect(b.resolve([geometry(0, 0), geometry(0, 0)])).toEqual([]);
    },
  );
  it("disables heavy attacks at the rules layer and enforces wind-up plus cooldown", () => {
    const b = make();
    b.advance(0, [{ attack: "heavy" }, { attack: "heavy" }]);
    expect(b.player.action).toBeNull();
    expect(b.enemy.action).toBeNull();
    b.advance(0, [{ attack: "quick", hand: "rear" }, {}]);
    b.advance(400, [{}, {}]);
    expect(b.resolve([geometry(0, 0), geometry(0, 0)])).toEqual([]);
    b.advance(600, [{}, {}]);
    expect(b.player.action).toBeNull();
    expect(b.player.attackCooldown).toBe(280);
    b.advance(279, [{ attack: "quick" }, {}]);
    expect(b.player.action).toBeNull();
    b.advance(1, [{ attack: "quick" }, {}]);
    expect(b.player.action?.name).toBe("quick");
    expect(attackTimings.quick.duration).toBe(1000);
  });
});
describe("pain and front kick", () => {
  it("interrupts a swing, gives a short pain animation and blocks commands during stun", () => {
    const b = make();
    b.advance(0, [{ attack: "quick" }, { attack: "quick" }]);
    active(b);
    b.resolve([geometry(0, 0), geometry(100, 100, 0)]);
    expect(b.enemy.action).toBeNull();
    expect(b.enemy.stun).toBe(180);
    expect(b.enemy.reaction?.kind).toBe("hit");
    const x = b.enemy.x;
    b.advance(50, [{}, { attack: "quick", move: -1, run: true, jump: true }]);
    expect(b.enemy.action).toBeNull();
    expect(b.enemy.y).toBe(0);
    expect(b.enemy.x).toBeGreaterThan(x);
    const motion = new ArenaMotion(b.enemy.model);
    motion.update(8, b.enemy);
    expect(motion.name).toBe("hit");
    b.advance(130, [{}, {}]);
    expect(b.enemy.stun).toBe(0);
    expect(b.canAttack(b.enemy, "quick")).toBe(true);
  });
  it("only kicks on active boot/body contact, pushes for several steps and recovers balance", () => {
    const b = make();
    b.player.x = 700;
    b.enemy.x = 900;
    b.advance(0, [{ attack: "kick" }, {}]);
    expect(b.resolve([geometry(0, 0), geometry(0, 0)])).toEqual([]);
    b.advance(420, [{}, {}]);
    expect(b.resolve([geometry(100, 0), geometry(0, 0)])).toEqual([]);
    const [hit] = b.resolve([geometry(0, 100), geometry(0, 0)]);
    expect(hit.kind).toBe("kick");
    expect(b.enemy.stun).toBe(350);
    expect(b.enemy.reaction?.kind).toBe("stagger");
    expect(b.resolve([geometry(0, 0), geometry(0, 0)])).toEqual([]);
    const start = b.enemy.x;
    for (let i = 0; i < 110; i++)
      b.advance(arenaRules.step, [{}, { move: -1, attack: "quick" }]);
    expect(b.enemy.x - start).toBeGreaterThan(180);
    expect(b.enemy.x - start).toBeLessThan(230);
    expect(b.enemy.reaction).toBeNull();
    expect(b.enemy.pushVx).toBe(0);
  });
  it("keeps knockback inside arena bounds and does not bypass collisions with another kick", () => {
    const b = make();
    b.player.x = 1020;
    b.enemy.x = 1180;
    b.advance(0, [{ attack: "kick" }, {}]);
    b.advance(420, [{}, {}]);
    b.resolve([geometry(0, 0), geometry(0, 0)]);
    for (let i = 0; i < 110; i++) b.advance(arenaRules.step, [{}, {}]);
    expect(b.enemy.x).toBe(arenaRules.maxX);
    expect(b.player.x).toBeLessThanOrEqual(b.enemy.x - 64);
  });
  it("allows kicks during ordinary jumps and directional hops without resetting their launch", () => {
    for (const start of [
      { jump: true },
      { hop: 1 as const },
      { hop: -1 as const },
    ]) {
      const b = make();
      b.advance(8, [start, {}]);
      for (let i = 0; i < 12; i++) b.advance(arenaRules.step, [{}, {}]);
      expect(b.canAttack(b.player, "kick")).toBe(true);
      const vy = b.player.vy,
        hop = b.player.hop;
      b.advance(arenaRules.step, [{ attack: "kick", move: 1, run: true }, {}]);
      expect(b.player.action?.name).toBe("kick");
      expect(b.player.y).toBeLessThan(0);
      expect(b.player.vy).toBeCloseTo(
        vy + (arenaRules.gravity * arenaRules.step) / 1000,
      );
      expect(b.player.hop).toBe(hop);
      expect(Math.abs(b.player.vx)).toBeGreaterThanOrEqual(arenaRules.run);
    }
  });
});

it("rear throw draws the hand behind the hip before a forward release without stretching bones", async () => {
  const { equipmentMotion } =
    await import("../../src/characters/equipmentMotion");
  const { Animator } = await import("../../src/characters/animation");
  const { groundedPose, add, rotate, skeleton } =
    await import("../../src/characters/kinematics");
  const a = new Animator(equipmentMotion(undefined, "front"));
  a.play("throw");
  let drawnBack = false;
  let delivered = false;
  for (let t = 0; t < 1700; t += 8) {
    const p = a.update(8),
      s = groundedPose(p),
      arm = s.farArm;
    const expected = add(
      s.root,
      rotate(
        add(
          { x: 0, y: skeleton.pelvisY },
          rotate(
            {
              x: skeleton.farShoulderX + p.farHandX!,
              y: skeleton.shoulderY + p.farHandY!,
            },
            s.torso,
          ),
        ),
        s.root.rotation,
      ),
    );
    expect(
      Math.hypot(arm.hand.x - expected.x, arm.hand.y - expected.y),
    ).toBeLessThan(1e-6);
    if (p.farHandX! < -30 && p.farHandY! > 55) {
      drawnBack = true;
      expect(p.nearHandY).toBeCloseTo(69, 7);
    }
    if (drawnBack && p.throwReleased === 1 && p.farHandX! > 65)
      delivered = true;
  }
  expect(drawnBack).toBe(true);
  expect(delivered).toBe(true);
});

it("front kick extends a nearly straight leg, presents the sole and keeps the support foot planted", async () => {
  const { equipmentMotion } =
    await import("../../src/characters/equipmentMotion");
  const { Animator } = await import("../../src/characters/animation");
  const { groundedPose } = await import("../../src/characters/kinematics");
  const a = new Animator(equipmentMotion());
  a.play("kick");
  let extended = false;
  for (let t = 0; t < 1050; t += 8) {
    const p = a.update(8),
      s = groundedPose(p);
    for (const leg of [s.nearLeg, s.farLeg]) expect(leg.clamped).toBe(false);
    expect(s.farLeg.sole.y).toBeCloseTo(0, 6);
    if (p.nearFootX! > 112) {
      extended = true;
      expect(s.nearLeg.bend).toBeLessThan(0.35);
      expect(p.nearFootRoll).toBeLessThan(-1);
      expect(s.nearLeg.ankle.y).toBeLessThan(-90);
    }
  }
  expect(extended).toBe(true);
});

it("planted stumble feet follow actual knockback travel between backward steps", async () => {
  const { groundedPose } = await import("../../src/characters/kinematics");
  const b = make();
  b.player.x = 700;
  b.enemy.x = 900;
  b.advance(0, [{ attack: "kick" }, {}]);
  b.advance(420, [{}, {}]);
  b.resolve([geometry(0, 0), geometry(0, 0)]);
  const motion = new ArenaMotion(b.enemy.model);
  let previous: { x: number; planted: boolean } | undefined,
    checked = 0;
  for (let i = 0; i < 90; i++) {
    b.advance(arenaRules.step, [{}, {}]);
    const p = motion.update(arenaRules.step, b.enemy),
      s = groundedPose(p);
    const x = b.enemy.x + s.nearLeg.ankle.x * b.enemy.facing,
      planted = p.nearFootY === 0;
    if (i > 15 && previous?.planted && planted) {
      expect(Math.abs(x - previous.x)).toBeLessThan(0.05);
      checked++;
    }
    previous = { x, planted };
  }
  expect(checked).toBeGreaterThan(5);
});

it("a guarded front kick causes no damage and still forces balance recovery", () => {
  const b = make();
  b.advance(0, [{ attack: "kick" }, {}]);
  b.advance(420, [{}, { guard: true }]);
  const [hit] = b.resolve([geometry(0, 0), geometry(0, 0)]);
  expect(hit.blocked).toBe(false);
  expect(hit.damage).toBe(0);
  expect(b.enemy.reaction?.kind).toBe("stagger");
  expect(b.enemy.pushVx).toBe(500);
});

it("a flying kick extends only the striking leg and shoves without damage on boot contact", async () => {
  const { groundedPose } = await import("../../src/characters/kinematics");
  const b = make(),
    motion = new ArenaMotion(b.player.model);
  b.advance(arenaRules.step, [{ jump: true, attack: "kick" }, {}]);
  motion.update(0, b.player);
  for (let i = 0; i < 52; i++) {
    b.advance(arenaRules.step, [{}, {}]);
    motion.update(arenaRules.step, b.player);
  }
  const pose = motion.update(0, b.player),
    rig = groundedPose(pose);
  expect(b.player.y).toBeLessThan(-50);
  expect(pose.plant).toBe(0);
  expect(pose.rootY).toBe(0);
  expect(rig.farLeg.bend).toBeCloseTo(0.75);
  expect(rig.nearLeg.bend).toBeLessThan(0.4);
  expect(rig.nearLeg.ankle.x - rig.nearLeg.hip.x).toBeGreaterThan(95);
  const miss = geometry(100, 0),
    target = geometry(0, 0);
  expect(b.resolve([miss, target])).toEqual([]);
  const [hit] = b.resolve([geometry(0, 100), target]);
  expect(hit.kind).toBe("kick");
  expect(b.enemy.hp).toBe(100);
  expect(hit.damage).toBe(0);
  expect(b.resolve([geometry(0, 100), target])).toEqual([]);
  for (let i = 0; i < 120; i++) b.advance(arenaRules.step, [{}, {}]);
  expect(b.player.y).toBe(0);
  expect(b.player.vy).toBe(0);
});
