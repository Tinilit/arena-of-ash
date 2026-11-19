import { describe, expect, it } from "vitest";
import { createPlayer } from "../../src/domain/model";
import {
  equip,
  unequip,
  purchase,
  primaryWeapon,
  primaryHand,
  stats,
} from "../../src/domain/progression";
import { deserialize, serialize } from "../../src/persistence/save";
import { Animator } from "../../src/characters/animation";
import { equipmentMotion } from "../../src/characters/equipmentMotion";
import { item } from "../../src/data/catalog";
import {
  groundedPose,
  skeleton,
  rotate,
} from "../../src/characters/kinematics";
import { throwTiming } from "../../src/characters/throwMotion";

describe("anatomical loadout", () => {
  it("starts with an empty belt and persists explicitly equipped positions", () => {
    const p = createPlayer();
    expect(p.equipment.belt1).toBeUndefined();
    expect(p.equipment.belt2).toBeUndefined();
    p.inventory.push("throwing-knife", "throwing-axe");
    equip(p, "throwing-knife", "belt1");
    equip(p, "throwing-axe", "belt2");
    purchase(p, "rust");
    purchase(p, "leather");
    expect(equip(p, "rust", "leftHand")).toBe(true);
    expect(equip(p, "leather", "body")).toBe(true);
    expect(p.equipment).toEqual({
      rightHand: "wood",
      leftHand: "rust",
      body: "leather",
      belt1: "throwing-knife",
      belt2: "throwing-axe",
    });
    expect(stats(p).attack).toBe(13);
    expect(stats(p).armor).toBe(2);
    expect(deserialize(serialize(p))).toEqual(p);
  });
  it("moves owned gear between compatible hands or belt mounts without duplicating it", () => {
    const p = createPlayer();
    equip(p, "wood", "leftHand");
    expect(p.equipment.rightHand).toBeUndefined();
    expect(primaryHand(p)).toBe("front");
    expect(primaryWeapon(p)?.id).toBe("wood");
    p.inventory.push("throwing-knife", "throwing-axe");
    equip(p, "throwing-knife", "belt2");
    expect(p.equipment.belt1).toBeUndefined();
    expect(
      Object.values(p.equipment).filter((id) => id === "throwing-knife"),
    ).toHaveLength(1);
    expect(p.inventory).toContain("throwing-axe");
    expect(equip(p, "throwing-knife", "helmet")).toBe(false);
    expect(equip(p, "wood", "belt1")).toBe(false);
    expect(unequip(p, "leftHand")).toBe(true);
    expect(primaryWeapon(p)).toBeUndefined();
    expect(p.inventory).toContain("wood");
  });
  it("rejects duplicated equipped instances and mismatched categories on load", () => {
    const p = createPlayer();
    p.equipment.leftHand = "wood";
    p.gold = 999;
    expect(deserialize(serialize(p)).gold).toBe(100);
    delete p.equipment.leftHand;
    p.equipment.belt1 = "wood";
    expect(deserialize(serialize(p)).gold).toBe(100);
  });
});
describe("throw preparation", () => {
  for (const hand of ["rear", "front"] as const) {
    it(`${hand}: has a single release, fixed bones, reachable hands and planted support`, () => {
      const lib = equipmentMotion(item("war-spear"), hand),
        a = new Animator(lib);
      let releases = 0,
        completed = 0;
      a.setIdle("idleRelaxed");
      a.play(
        "throw",
        () => releases++,
        () => completed++,
      );
      for (let t = 0; t < throwTiming.duration; t += 8) {
        const p = a.update(8),
          s = groundedPose(p);
        for (const arm of [s.nearArm, s.farArm]) {
          expect(arm.clamped).toBe(false);
          expect(
            Math.hypot(
              arm.shoulder.x - arm.elbow.x,
              arm.shoulder.y - arm.elbow.y,
            ),
          ).toBeCloseTo(40, 7);
          expect(
            Math.hypot(arm.elbow.x - arm.hand.x, arm.elbow.y - arm.hand.y),
          ).toBeCloseTo(34, 7);
          expect(arm.bend).toBeGreaterThanOrEqual(-skeleton.elbowMax);
        }
        for (const leg of [s.nearLeg, s.farLeg]) {
          expect(
            Math.hypot(leg.hip.x - leg.knee.x, leg.hip.y - leg.knee.y),
          ).toBeCloseTo(54, 7);
          expect(
            Math.hypot(leg.ankle.x - leg.knee.x, leg.ankle.y - leg.knee.y),
          ).toBeCloseTo(52, 7);
          const angle = s.root.rotation + leg.angle + leg.bend + leg.foot;
          expect(
            leg.ankle.y + rotate({ x: 28, y: 14 }, angle).y,
          ).toBeLessThanOrEqual(1e-6);
        }
      }
      a.update(1500);
      expect(releases).toBe(1);
      expect(completed).toBe(1);
      expect(a.name).toBe("idleRelaxed");
    });
  }
  it("emits release exactly once even if rendering skips across its marker", () => {
    const a = new Animator(equipmentMotion(item("wood")));
    let releases = 0;
    a.play("throw", () => releases++);
    a.update(throwTiming.duration * 0.8);
    a.update(500);
    a.update(1000);
    expect(releases).toBe(1);
  });
});

it("preserves live bonuses on active armor/weapon and ignores carried gear", () => {
  const p = createPlayer();
  p.gold = 1000;
  purchase(p, "rust");
  purchase(p, "leather");
  equip(p, "rust", "leftHand");
  equip(p, "leather", "body");
  item("wood")!.armor = 2;
  item("leather")!.attack = 3;
  item("rust")!.attack = 999;
  item("throwing-axe")!.attack = 999;
  item("throwing-knife")!.armor = 999;
  expect(stats(p).attack).toBe(16);
  expect(stats(p).armor).toBe(4);
});

it("starts a second throw with a held prop and no stale release state", () => {
  const a = new Animator(equipmentMotion(item("wood")));
  let releases = 0;
  a.play("throw", () => releases++);
  a.update(throwTiming.duration);
  a.play("throw", () => releases++);
  const initial = a.update(0);
  expect(initial.throwPreview).toBe(1);
  expect(initial.throwReleased).toBe(0);
  a.update(throwTiming.duration);
  expect(releases).toBe(2);
});

it("retains the underarm throw and adds a distinct high-release volleyball-style throw", async () => {
  const { overhandThrowTiming } =
    await import("../../src/characters/throwMotion");
  for (const hand of ["front", "rear"] as const) {
    const lib = equipmentMotion(item("war-spear"), hand),
      a = new Animator(lib);
    let releases = 0,
      cocked = false,
      high = false;
    expect(lib.throw).not.toBe(lib.throwOverhand);
    a.play("throwOverhand", () => releases++);
    let last = groundedPose(a.update(0));
    for (let t = 8; t <= overhandThrowTiming.duration; t += 8) {
      const p = a.update(8),
        s = groundedPose(p),
        arm = s.farArm;
      expect(arm.clamped).toBe(false);
      expect(Math.abs(arm.angle - last.farArm.angle)).toBeLessThan(0.18);
      expect(
        Math.hypot(
          arm.hand.x - last.farArm.hand.x,
          arm.hand.y - last.farArm.hand.y,
        ),
      ).toBeLessThan(9);
      if (p.farHandX! < 0 && p.farHandY! < -45 && Math.abs(arm.bend) > 1.2)
        cocked = true;
      if (p.throwReleased === 1 && p.farHandY! < -70) {
        high = true;
        expect(Math.abs(arm.bend)).toBeLessThan(0.3);
      }
      last = s;
    }
    a.update(100);
    expect(releases).toBe(1);
    expect(cocked && high).toBe(true);
  }
});
