import { describe, it, expect } from "vitest";
import { items, item } from "../../src/data/catalog";
import { createPlayer } from "../../src/domain/model";
import { purchase, equip, stats } from "../../src/domain/progression";
import { serialize, deserialize } from "../../src/persistence/save";
import { Animator } from "../../src/characters/animation";
import { equipmentMotion } from "../../src/characters/equipmentMotion";
import { groundedMotion } from "../../src/characters/groundedMotion";
import {
  groundedPose,
  skeleton,
  rotate,
  add,
  type Point,
} from "../../src/characters/kinematics";
const funded = () => {
  const p = createPlayer();
  p.gold = 1000;
  return p;
};
describe("equipment catalog", () => {
  it("keeps eleven definitions with shields paused and no paired weapon", () => {
    expect(items).toHaveLength(11);
    expect(new Set(items.map((i) => i.id)).size).toBe(11);
    expect(item("glaives")).toBeUndefined();
    expect(items.some((it) => it.slot === "shield")).toBe(false);
  });
  it.each(["war-spear", "viking"])(
    "purchases and persists %s exactly once",
    (id) => {
      const p = funded();
      expect(purchase(p, id)).toBe(true);
      expect(p.gold).toBe(1000 - item(id)!.price);
      expect(purchase(p, id)).toBe(false);
      expect(deserialize(serialize(p)).inventory).toContain(id);
    },
  );
  it("equips the spear and helmet together with exact bonuses", () => {
    const p = funded();
    for (const id of ["war-spear", "viking"]) {
      purchase(p, id);
      expect(equip(p, id, id === "viking" ? "helmet" : "rightHand")).toBe(true);
    }
    expect(stats(p).attack).toBe(22);
    expect(stats(p).armor).toBe(3);
    expect(deserialize(serialize(p))).toEqual(p);
  });
  it("rejects unavailable items and wrong slots without changing equipment", () => {
    const p = funded();
    purchase(p, "viking");
    equip(p, "viking", "helmet");
    expect(equip(p, "glaives", "rightHand")).toBe(false);
    expect(equip(p, "viking", "rightHand")).toBe(false);
    expect(p.equipment.helmet).toBe("viking");
  });
  it("does not mutate the shared Ash motion library", () => {
    const before = JSON.stringify(groundedMotion);
    equipmentMotion(item("spear"));
    equipmentMotion(item("war-spear"));
    expect(JSON.stringify(groundedMotion)).toBe(before);
    expect(equipmentMotion(item("wood"), "front").quick).not.toBe(
      groundedMotion.ash.quick,
    );
    expect(equipmentMotion(item("wood")).quick).not.toBe(
      groundedMotion.ash.quick,
    );
  });
  for (const id of ["spear", "war-spear"])
    it(`${id}: one impact per action and stable grounded limbs`, () => {
      const library = equipmentMotion(item(id));
      for (const action of ["quick", "heavy", "defend", "recover"]) {
        const a = new Animator(library);
        let hits = 0;
        a.play(action, () => hits++);
        for (let t = 0; t < library[action].duration + 32; t += 16) {
          const s = groundedPose(a.update(16));
          for (const leg of [s.nearLeg, s.farLeg]) {
            expect(leg.clamped).toBe(false);
            expect(leg.bend).toBeGreaterThan(0);
          }
          for (const arm of [s.nearArm, s.farArm])
            expect(arm.bend).toBeGreaterThanOrEqual(-skeleton.elbowMax - 1e-8);
        }
        expect(hits).toBe(1);
      }
    });
});
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
for (const id of ["spear", "war-spear"])
  it(`${id}: entire shaft clears the face throughout every clip`, () => {
    const lib = equipmentMotion(item(id));
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
        const angle =
          rootR +
          torso +
          s.farArm.angle +
          s.farArm.bend +
          s.farArm.wrist +
          (p.weaponGrip ?? Math.PI / 2);
        const local = (length: number) => {
          const q = add(s.farArm.hand, rotate({ x: 0, y: length }, angle));
          return rotate({ x: q.x - head.x, y: q.y - head.y }, -headR);
        };
        if ((p.throwPreview ?? 0) > 0.01 || name === "punch") continue;
        expect(
          crossesFace(
            local(id === "war-spear" ? -150 : -132),
            local(id === "war-spear" ? 88 : 70),
          ),
          `${id}/${name} at ${t}ms`,
        ).toBe(false);
      }
    }
  });
