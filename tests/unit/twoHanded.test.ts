import { beforeEach, describe, expect, it } from "vitest";
import live from "../../public/content/items.json";
import { installCatalog, item } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";
import { createPlayer } from "../../src/domain/model";
import { equip, purchase, twoHandWeapon } from "../../src/domain/progression";
import { deserialize, serialize } from "../../src/persistence/save";
import { RealtimeBattle, arenaRules } from "../../src/combat/realtime";
import { damage } from "../../src/combat/engine";
import { twoHandPose, finishPose } from "../../src/characters/twoHandMotion";
import {
  groundedPose,
  rotate,
  add,
  skeleton,
} from "../../src/characters/kinematics";
import { combatRest, relaxedRest } from "../../src/characters/locomotion";
import type { CombatGeometry } from "../../src/combat/geometry";
beforeEach(() => installCatalog(parseCatalog(live).items));
const ids = ["greatsword", "war-hammer", "battle-axe"];
const capsule = { a: { x: 0, y: 0 }, b: { x: 0, y: 30 }, radius: 10 };
const touching: CombatGeometry = {
  blade: capsule,
  shove: capsule,
  body: [capsule],
  hands: { rear: capsule, front: capsule },
};
const empty: CombatGeometry = { blade: null, body: [] };
function make(id = "greatsword") {
  const p = createPlayer();
  p.gold = 1000;
  purchase(p, id);
  equip(p, id, "rightHand");
  const e = createPlayer();
  e.id = "enemy";
  const b = new RealtimeBattle(p, e, () => 0);
  b.player.x = 500;
  b.enemy.x = 590;
  return b;
}
function advance(b: RealtimeBattle, ms: number) {
  for (let left = ms; left > 1e-6; left -= arenaRules.step)
    b.advance(Math.min(left, arenaRules.step), [{}, {}]);
}
describe("two-handed ownership and contact rules", () => {
  it.each(ids)(
    "buys %s, reserves the front hand without deleting its item, and round-trips saves",
    (id) => {
      const p = createPlayer();
      p.gold = 1000;
      purchase(p, "rust");
      equip(p, "rust", "leftHand");
      purchase(p, id);
      expect(equip(p, id, "leftHand")).toBe(false);
      expect(equip(p, id, "rightHand")).toBe(true);
      expect(p.equipment.leftHand).toBeUndefined();
      expect(p.inventory).toContain("rust");
      expect(twoHandWeapon(p)?.id).toBe(id);
      expect(deserialize(serialize(p))).toEqual(p);
      equip(p, "rust", "leftHand");
      expect(p.equipment.rightHand).toBeUndefined();
      expect(p.inventory).toContain(id);
    },
  );
  it("keeps either unarmed fist at exactly one damage, including guard, armor and critical modifiers", () => {
    const p = createPlayer(),
      e = createPlayer();
    e.inventory.push("plate");
    e.equipment.body = "plate";
    for (const guard of [false, true])
      expect(damage(p, e, 1.6, true, guard, "front")).toBe(1);
    delete p.equipment.rightHand;
    expect(damage(p, e, 1, true, false, "rear")).toBe(1);
  });
  it("merges shared swing inputs and locks the supporting hand until recovery ends", () => {
    const b = make();
    b.advance(0, [{ attacks: ["front", "rear"] }, {}]);
    expect(b.player.handActions.front).toBeNull();
    expect(b.player.handActions.rear?.duration).toBe(1150);
    expect(b.canAttack(b.player, "quick", "front")).toBe(false);
    advance(b, 1151);
    expect(b.player.handCooldowns.front).toBeGreaterThan(0);
    expect(b.canAttack(b.player, "quick", "rear")).toBe(false);
    advance(b, 401);
    expect(b.canAttack(b.player, "quick", "rear")).toBe(true);
  });
  it("pushes only on haft contact, once, without damage or knockdown", () => {
    const b = make();
    b.advance(0, [{ attack: "shove" }, {}]);
    advance(b, 320);
    expect(b.resolve([empty, empty])).toEqual([]);
    const events = b.resolve([touching, touching]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "shove",
      damage: 0,
      knockdown: false,
    });
    expect(b.enemy.pushVx).toBe(500);
    expect(b.enemy.hp).toBe(100);
    expect(b.enemy.reaction?.kind).toBe("stagger");
    expect(b.resolve([touching, touching])).toEqual([]);
    advance(b, 900);
    expect(b.enemy.x).toBeGreaterThan(780);
    expect(b.enemy.knockdown).toBeNull();
    const one = make("wood");
    expect(one.canAttack(one.player, "shove")).toBe(false);
  });
  it.each(["wood", ...ids])(
    "finishes a grounded opponent with %s only when the weapon actually touches",
    (id) => {
      const b = make(id);
      expect(b.canAttack(b.player, "finish")).toBe(false);
      b.enemy.knockdown = { phase: "down", elapsed: 0 };
      b.enemy.hp = 87;
      b.enemy.model.inventory.push("plate");
      b.enemy.model.equipment.body = "plate";
      b.advance(0, [{ attack: "finish" }, {}]);
      advance(b, 600);
      expect(b.resolve([empty, empty])).toEqual([]);
      expect(b.enemy.hp).toBe(87);
      const hit = b.resolve([touching, touching]);
      expect(hit[0]).toMatchObject({ kind: "finisher", damage: 87 });
      expect(b.enemy.hp).toBe(0);
      expect(b.state).toBe("Victory");
    },
  );
  it("cannot execute with a fist or kill a target that has begun getting up", () => {
    const unarmed = make();
    delete unarmed.player.model.equipment.rightHand;
    unarmed.enemy.knockdown = { phase: "down", elapsed: 0 };
    expect(unarmed.canAttack(unarmed.player, "finish")).toBe(false);
    const b = make();
    b.enemy.knockdown = { phase: "down", elapsed: 600 };
    b.advance(0, [{ attack: "finish" }, {}]);
    advance(b, 600);
    expect(b.enemy.knockdown?.phase).toBe("getUp");
    expect(b.resolve([touching, touching])).toEqual([]);
    expect(b.enemy.hp).toBe(100);
  });
});
for (const id of ids)
  for (const action of [undefined, "quick", "shove", "finish"])
    it(`${id}/${action ?? "idle"} keeps fixed bones and two exact grip points on one shaft`, () => {
      for (const rest of [combatRest, relaxedRest])
        for (let step = 0; step <= 400; step++) {
          const p = twoHandPose(rest, item(id)!, action, step / 400),
            s = groundedPose(p);
          expect(s.nearArm.clamped).toBe(false);
          expect(s.farArm.clamped).toBe(false);
          const grip = add(
            s.farArm.hand,
            rotate(
              { x: 0, y: -24 },
              s.root.rotation + s.torso + p.farWeaponAngle!,
            ),
          );
          expect(
            Math.hypot(grip.x - s.nearArm.hand.x, grip.y - s.nearArm.hand.y),
          ).toBeLessThan(1e-6);
          for (const arm of [s.nearArm, s.farArm])
            expect(
              Math.hypot(
                arm.elbow.x - arm.shoulder.x,
                arm.elbow.y - arm.shoulder.y,
              ),
            ).toBeCloseTo(skeleton.upperArm, 7);
        }
    });
it("finisher targets remain reachable for either one-handed grip", () => {
  for (const hand of ["front", "rear"] as const)
    for (let t = 0; t <= 1; t += 0.005) {
      const s = groundedPose(finishPose(combatRest, hand, t));
      expect(s.nearArm.clamped).toBe(false);
      expect(s.farArm.clamped).toBe(false);
    }
});

it("validates runtime handedness and rejects mismatched heavy weapon art", () => {
  for (const patch of [{ hands: 3 }, { hands: 1 }, { weaponType: "axe" }]) {
    const candidate = structuredClone(live);
    Object.assign(
      candidate.items.find((i) => i.id === "greatsword")!,
      patch,
    );
    expect(() => parseCatalog(candidate)).toThrow();
  }
});
it("rejects a saved two-handed weapon sharing its support slot with another item", () => {
  const b = make();
  b.player.model.equipment.leftHand = "wood";
  expect(deserialize(serialize(b.player.model)).equipment.rightHand).toBe(
    "wood",
  );
});
for (const situation of [
  "offhand occupied",
  "two-handed grip occupied",
  "both hands empty",
])
  it(`collects landed equipment without replacing an occupied hand: ${situation}`, () => {
    const b = make(
      situation === "two-handed grip occupied" ? "greatsword" : "wood",
    );
    const id = situation === "two-handed grip occupied" ? "rust" : "greatsword";
    if (situation !== "two-handed grip occupied")
      delete b.player.model.equipment.rightHand;
    if (situation === "offhand occupied") {
      b.player.model.inventory.push("rust");
      b.player.model.equipment.leftHand = "rust";
    }
    b.projectiles.push({
      id: 999,
      ownerId: "enemy",
      itemId: id,
      hand: "rear",
      sourceSlot: "rightHand",
      x: b.player.x,
      y: 551,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
      spin: 0,
      previous: { x: b.player.x, y: 551, angle: Math.PI / 2 },
      attack: 20,
      floorRadius: 22,
      profile: { startY: -150, endY: -38, radius: 7 },
      age: 0,
      state: "landed",
    });
    b.advance(0, [{ pickup: true }, {}]);
    expect(b.player.model.inventory).toContain(id);
    if (situation === "both hands empty")
      expect(b.player.model.equipment.rightHand).toBe(id);
    else if (situation === "offhand occupied") {
      expect(b.player.model.equipment.leftHand).toBe("rust");
      expect(b.player.model.equipment.rightHand).toBeUndefined();
    } else {
      expect(b.player.model.equipment.rightHand).toBe("greatsword");
      expect(b.player.model.equipment.leftHand).toBeUndefined();
    }
  });
