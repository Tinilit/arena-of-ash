import { describe, it, expect } from "vitest";
import { items, item } from "../../src/data/catalog";
import { createPlayer } from "../../src/domain/model";
import {
  purchase,
  equip,
  canEquip,
  stats,
  isPairedWeapon,
} from "../../src/domain/progression";
import { serialize, deserialize } from "../../src/persistence/save";
import { Animator } from "../../src/characters/animation";
import { equipmentMotion } from "../../src/characters/equipmentMotion";
import { groundedMotion } from "../../src/characters/groundedMotion";
import { motionProfiles } from "../../src/characters/motionProfiles";
import { visualStyles, motionModes } from "../../src/characters/presentation";
import { groundedPose, skeleton } from "../../src/characters/kinematics";
import { showcaseKits } from "../../src/data/showcase";
const funded = () => {
  const p = createPlayer();
  p.gold = 1000;
  return p;
};
describe("expanded equipment", () => {
  it("retains old catalog IDs and adds four distinct definitions", () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const id of [
      "wood",
      "rust",
      "iron",
      "spear",
      "leather",
      "plate",
      "cap",
      "shield",
      "war-spear",
      "viking",
      "tower",
      "glaives",
    ])
      expect(item(id)).toBeDefined();
  });
  it.each(["war-spear", "viking", "tower", "glaives"])(
    "purchases and persists %s exactly once",
    (id) => {
      const p = funded();
      expect(purchase(p, id)).toBe(true);
      expect(p.gold).toBe(1000 - item(id)!.price);
      expect(purchase(p, id)).toBe(false);
      expect(deserialize(serialize(p)).inventory).toContain(id);
    },
  );
  it("equips a spear with the tower and viking helmet", () => {
    const p = funded();
    for (const id of ["war-spear", "tower", "viking"]) {
      purchase(p, id);
      expect(equip(p, id, item(id)!.slot)).toBe(true);
    }
    expect(stats(p).attack).toBe(25);
    expect(stats(p).armor).toBe(8);
    expect(isPairedWeapon(p)).toBe(false);
    expect(deserialize(serialize(p))).toEqual(p);
  });
  it("paired blades remove the shield without deleting ownership or doubling attack", () => {
    const p = funded();
    purchase(p, "tower");
    equip(p, "tower", "shield");
    purchase(p, "glaives");
    equip(p, "glaives", "weapon");
    expect(p.equipment.shield).toBeUndefined();
    expect(p.inventory).toContain("tower");
    expect(stats(p).attack).toBe(29);
    expect(stats(p).armor).toBe(0);
    expect(canEquip(p, "tower", "shield")).toBe(false);
    expect(equip(p, "tower", "shield")).toBe(false);
    equip(p, "wood", "weapon");
    expect(equip(p, "tower", "shield")).toBe(true);
    expect(stats(p).armor).toBe(5);
  });
  it("does not remove a shield for an invalid or unowned weapon", () => {
    const p = funded();
    purchase(p, "tower");
    equip(p, "tower", "shield");
    expect(equip(p, "glaives", "weapon")).toBe(false);
    expect(p.equipment.shield).toBe("tower");
  });
  it("normalizes conflicting imported hand slots without resetting progression", () => {
    const p = funded();
    purchase(p, "tower");
    purchase(p, "glaives");
    p.equipment = { weapon: "glaives", shield: "tower" };
    expect(stats(p).armor).toBe(0);
    const loaded = deserialize(serialize(p));
    expect(loaded.gold).toBe(p.gold);
    expect(loaded.inventory).toEqual(p.inventory);
    expect(loaded.equipment).toEqual({ weapon: "glaives" });
  });
  it("showcase loadouts reference valid slots and never combine paired blades with a shield", () => {
    for (const kit of Object.values(showcaseKits)) {
      for (const [slot, id] of Object.entries(kit))
        expect(item(id)!.slot).toBe(slot);
      if (item(kit.weapon)!.occupiesOffhand)
        expect("shield" in kit).toBe(false);
    }
  });
});
describe("weapon-aware presentation", () => {
  it("leaves every previous motion library unchanged", () => {
    const before = JSON.stringify({ groundedMotion, motionProfiles });
    for (const style of visualStyles)
      for (const mode of motionModes)
        for (const id of ["spear", "war-spear", "glaives"])
          equipmentMotion(style, mode, item(id));
    expect(JSON.stringify({ groundedMotion, motionProfiles })).toBe(before);
    expect(equipmentMotion("bronze", "legacy", item("spear"))).toBe(
      motionProfiles.bronze,
    );
  });
  for (const style of visualStyles)
    for (const mode of motionModes)
      for (const id of ["spear", "war-spear", "glaives"]) {
        it(`${style}/${mode}/${id}: one impact per action and valid joint mechanics`, () => {
          const library = equipmentMotion(style, mode, item(id));
          for (const action of ["quick", "heavy", "defend", "recover"]) {
            const a = new Animator(library);
            let impacts = 0;
            a.play(action, () => impacts++);
            for (
              let i = 0;
              i < Math.ceil(library[action].duration / 16) + 2;
              i++
            ) {
              const p = a.update(16);
              if (mode === "grounded") {
                const s = groundedPose(p);
                for (const leg of [s.nearLeg, s.farLeg]) {
                  expect(leg.clamped).toBe(false);
                  expect(leg.bend).toBeGreaterThan(0);
                }
                for (const arm of [s.nearArm, s.farArm])
                  expect(arm.bend).toBeGreaterThanOrEqual(
                    -skeleton.elbowMax - 1e-8,
                  );
              }
            }
            expect(impacts).toBe(1);
          }
        });
      }
});

// Art clearance uses the actual crescent outline, including both blades.
import { glaiveOutline } from "../../src/data/gearGeometry";
import { add, rotate, type Point } from "../../src/characters/kinematics";
function crossesFace(a: Point, b: Point) {
  let lo = 0,
    hi = 1;
  for (const [axis, min, max] of [
    ["x", -23, 26],
    ["y", -35, 12],
  ] as const) {
    const d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-9) {
      if (a[axis] < min || a[axis] > max) return false;
      continue;
    }
    const u = (min - a[axis]) / d,
      v = (max - a[axis]) / d;
    lo = Math.max(lo, Math.min(u, v));
    hi = Math.min(hi, Math.max(u, v));
    if (lo > hi) return false;
  }
  return true;
}
for (const style of visualStyles)
  for (const id of ["spear", "war-spear", "glaives"])
    it(`${style}/${id}: weapon shapes clear the face throughout every grounded clip`, () => {
      const lib = equipmentMotion(style, "grounded", item(id));
      for (const [name, clip] of Object.entries(lib)) {
        const a = new Animator(lib);
        a.play(name);
        for (let t = 8; t <= clip.duration; t += 8) {
          const p = a.update(8),
            s = groundedPose(p),
            torso = p.torso ?? 0,
            rootR = s.root.rotation,
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
          const parts =
            id === "glaives"
              ? [
                  { arm: s.nearArm, offset: Math.PI / 2 },
                  { arm: s.farArm, offset: Math.PI / 2 },
                ]
              : [{ arm: s.nearArm, offset: Math.PI / 2 }];
          for (const part of parts) {
            const angle =
              rootR +
              torso +
              part.arm.angle +
              part.arm.bend +
              part.arm.wrist +
              part.offset;
            const local = (point: Point) => {
              const q = add(part.arm.hand, rotate(point, angle));
              return rotate({ x: q.x - head.x, y: q.y - head.y }, -headR);
            };
            const points =
              id === "glaives"
                ? glaiveOutline
                : [
                    { x: 0, y: id === "war-spear" ? -150 : -132 },
                    { x: 0, y: id === "war-spear" ? 88 : 70 },
                  ];
            for (let i = 0; i < points.length - (id === "glaives" ? 0 : 1); i++)
              expect(
                crossesFace(
                  local(points[i]),
                  local(points[(i + 1) % points.length]),
                ),
                `${style}/${id}/${name} at ${t}ms`,
              ).toBe(false);
          }
        }
      }
    });
