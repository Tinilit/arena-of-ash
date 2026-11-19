import { parryPose } from "../../src/characters/parryMotion";
import { combatRest } from "../../src/characters/locomotion";
import { groundedPose, skeleton } from "../../src/characters/kinematics";
import { describe, expect, it } from "vitest";
import { createPlayer } from "../../src/domain/model";
import { RealtimeBattle, arenaRules } from "../../src/combat/realtime";
import { parryRules } from "../../src/combat/parry";
import type { CombatGeometry } from "../../src/combat/geometry";
const capsule = { a: { x: 0, y: 0 }, b: { x: 0, y: 20 }, radius: 8 };
const g: CombatGeometry = {
  blade: capsule,
  blades: { front: capsule, rear: capsule },
  hands: { front: capsule, rear: capsule },
  feet: { front: capsule, rear: capsule },
  body: [capsule],
};
const empty: CombatGeometry = { blade: null, body: [] };
function make() {
  const p = createPlayer(),
    e = createPlayer();
  e.id = "enemy";
  return new RealtimeBattle(p, e, () => 0.5, { disarm: () => 1 });
}
function prepare(b: RealtimeBattle, age = 0) {
  b.advance(0, [{}, { attack: "quick" }]);
  b.advance(450, [{ parry: true }, {}]);
  b.advance(age, [{}, {}]);
}
describe("timed physical-contact parry", () => {
  it("automatically follows a success with exactly one kick-strength shove and never a fall", () => {
    const b = make();
    b.player.x = 500;
    b.enemy.x = 600;
    prepare(b, 60);
    b.resolve([g, g]);
    const start = b.enemy.x;
    for (let i = 0; i < 14; i++) b.advance(10, [{}, {}]);
    expect(b.enemy.x).toBe(start);
    b.advance(10, [{}, {}]);
    expect(b.enemy.pushVx).toBe(
      arenaRules.kickImpulse - arenaRules.pushFriction * 0.01,
    );
    for (let i = 0; i < 100; i++) b.advance(10, [{}, {}]);
    expect(b.enemy.x - start).toBeGreaterThan(200);
    expect(b.enemy.x - start).toBeLessThan(220);
    expect(b.enemy.hp).toBe(100);
    expect(b.enemy.knockdown).toBeNull();
    expect(b.contacts).toHaveLength(1);
  });
  it("deflects a physical frontal hit, preserving HP and stunning the attacker for a full second", () => {
    const b = make();
    prepare(b, 60);
    const hits = b.resolve([g, g]);
    expect(hits).toHaveLength(1);
    expect(hits[0].parried).toBe(true);
    expect(hits[0].damage).toBe(0);
    expect(b.player.hp).toBe(100);
    expect(b.enemy.stun).toBe(1000);
    expect(b.enemy.action).toBeNull();
    expect(b.enemy.reaction?.kind).toBe("parried");
    const x = b.enemy.x;
    b.advance(999, [{}, { move: 1, jump: true, attack: "quick" }]);
    expect(b.enemy.vy).toBe(0);
    expect(b.enemy.x - x).toBeGreaterThan(150);
    expect(b.enemy.knockdown).toBeNull();
    expect(b.enemy.action).toBeNull();
    expect(b.canAttack(b.enemy, "quick")).toBe(false);
    b.advance(1, [{}, {}]);
    expect(b.canAttack(b.enemy, "quick")).toBe(true);
  });
  it.each([parryRules.window, 200])(
    "does not block when contact occurs after %sms",
    (age) => {
      const b = make();
      prepare(b, age);
      const [e] = b.resolve([g, g]);
      expect(e.parried).not.toBe(true);
      expect(b.player.hp).toBeLessThan(100);
    },
  );
  it("does not stun on a miss, block a rear attack, or award invulnerability against kicks", () => {
    const b = make();
    prepare(b, 20);
    expect(b.resolve([empty, empty])).toEqual([]);
    expect(b.enemy.stun).toBe(0);
    b.player.facing = -1;
    expect(b.resolve([g, g])[0].parried).not.toBe(true);
    const k = make();
    k.advance(0, [{}, { attack: "kick" }]);
    k.advance(400, [{ parry: true }, {}]);
    const [kick] = k.resolve([g, g]);
    expect(kick.kind).toBe("kick");
    expect(kick.parried).not.toBe(true);
    expect(k.player.reaction?.kind).toBe("stagger");
  });
  it("deflects simultaneous hands before cancelling both attacker tracks", () => {
    const b = make();
    b.enemy.model.inventory.push("rust");
    b.enemy.model.equipment.leftHand = "rust";
    b.advance(0, [{}, { attacks: ["front", "rear"] }]);
    b.advance(500, [{ parry: true }, {}]);
    const hits = b.resolve([g, g]);
    expect(hits).toHaveLength(2);
    expect(hits.every((e) => e.parried && e.damage === 0)).toBe(true);
    expect(b.enemy.stun).toBe(1000);
    expect(b.enemy.handActions.front).toBeNull();
    expect(b.enemy.handActions.rear).toBeNull();
  });
  it("requires a held weapon, respects recovery and cannot restart by repeated commands", () => {
    const b = make();
    b.advance(0, [{ parry: true }, {}]);
    const id = b.player.parry!.id;
    b.advance(100, [{ parry: true }, {}]);
    expect(b.player.parry!.id).toBe(id);
    b.advance(350, [{ parry: true }, {}]);
    expect(b.player.parry).toBeNull();
    expect(b.canParry(b.player)).toBe(false);
    b.advance(750, [{}, {}]);
    expect(b.canParry(b.player)).toBe(true);
    delete b.player.model.equipment.rightHand;
    expect(b.canParry(b.player)).toBe(false);
  });
});

it.each(["front", "rear"] as const)(
  "%s weapon parry keeps fixed bones, reachable targets and a compact raised guard",
  (hand) => {
    const rest = groundedPose(combatRest),
      side = hand === "rear" ? "farArm" : "nearArm";
    for (let t = 0; t <= parryRules.duration; t += 6) {
      const s = groundedPose(parryPose(combatRest, t, hand)),
        arm = s[side];
      expect(arm.clamped).toBe(false);
      expect(
        Math.hypot(arm.elbow.x - arm.shoulder.x, arm.elbow.y - arm.shoulder.y),
      ).toBeCloseTo(40, 7);
      expect(
        Math.hypot(arm.hand.x - arm.elbow.x, arm.hand.y - arm.elbow.y),
      ).toBeCloseTo(34, 7);
      expect(arm.bend).toBeGreaterThanOrEqual(-skeleton.elbowMax);
      if (t >= 60 && t <= 140)
        expect(arm.hand.y - arm.shoulder.y).toBeLessThan(30);
    }
    const end = groundedPose(parryPose(combatRest, parryRules.duration, hand));
    expect(end[side].hand.x).toBeCloseTo(rest[side].hand.x, 7);
    expect(end[side].hand.y).toBeCloseTo(rest[side].hand.y, 7);
  },
);
