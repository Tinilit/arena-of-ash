import { trainedGladiator as createPlayer } from "../fixtures/trained";
import { describe, expect, it } from "vitest";

import { equip, purchase } from "../../src/domain/progression";
import { RealtimeBattle, arenaRules } from "../../src/combat/realtime";
import type { CombatGeometry } from "../../src/combat/geometry";
import { Animator } from "../../src/characters/animation";
import { equipmentMotion } from "../../src/characters/equipmentMotion";
import {
  groundedPose,
  rotate,
  add,
  skeleton,
} from "../../src/characters/kinematics";
const empty: CombatGeometry = { blade: null, body: [] };
function make() {
  const p = createPlayer(),
    e = createPlayer();
  e.id = "enemy";
  purchase(p, "healing-potion");
  equip(p, "healing-potion", "belt1");
  return new RealtimeBattle(p, e);
}
function advance(b: RealtimeBattle, duration: number) {
  for (let t = 0; t < duration; t += arenaRules.step) {
    b.advance(arenaRules.step, [{}, {}]);
    b.resolve([empty, empty]);
  }
}
describe("belt healing potion", () => {
  it("heals at the sip once, consumes the potion, and leaves weapons untouched", () => {
    const b = make();
    b.player.hp = 30;
    b.advance(0, [{ belt: "belt1" }, {}]);
    expect(b.player.handActions.rear?.name).toBe("drink");
    advance(b, 1100);
    expect(b.player.hp).toBe(30);
    expect(b.player.model.equipment.belt1).toBe("healing-potion");
    advance(b, 100);
    expect(b.player.hp).toBe(65);
    expect(b.player.model.equipment.belt1).toBeUndefined();
    expect(b.player.model.inventory).not.toContain("healing-potion");
    expect(b.player.model.equipment.rightHand).toBe("wood");
    expect(b.consumedItems).toHaveLength(1);
    advance(b, 2000);
    expect(b.player.hp).toBe(65);
    expect(b.consumedItems).toHaveLength(1);
    expect(b.projectiles).toEqual([]);
  });
  it("caps healing at full health and refuses to waste a full-health potion", () => {
    const b = make();
    expect(b.canUseBelt(b.player, "belt1")).toBe(false);
    expect(b.canThrow(b.player, "rear", "belt1")).toBe(false);
    b.advance(0, [{ belt: "belt1" }, {}]);
    expect(b.player.action).toBeNull();
    b.player.hp = 90;
    b.advance(0, [{ belt: "belt1" }, {}]);
    advance(b, 1200);
    expect(b.player.hp).toBe(100);
  });
  it("keeps the potion if an enemy hit interrupts drinking before the sip", () => {
    const b = make();
    b.player.hp = 60;
    b.advance(0, [{ belt: "belt1" }, { attack: "quick" }]);
    advance(b, 450);
    const c = { a: { x: 0, y: 0 }, b: { x: 0, y: 20 }, radius: 8 };
    b.resolve([
      { blade: null, body: [c] },
      { blade: c, body: [] },
    ]);
    expect(b.player.handActions.rear).toBeNull();
    const hp = b.player.hp;
    advance(b, 1800);
    expect(b.player.hp).toBe(hp);
    expect(b.player.model.inventory).toContain("healing-potion");
    expect(b.consumedItems).toEqual([]);
  });
  it("reaches the mouth with a tilted open vial, fixed bones and a smooth return", () => {
    const a = new Animator(equipmentMotion());
    a.play("drink");
    let last = groundedPose(a.update(0));
    for (let t = 8; t <= 2100; t += 8) {
      const p = a.update(8),
        s = groundedPose(p),
        arm = s.farArm;
      expect(arm.clamped).toBe(false);
      expect(
        Math.hypot(arm.hand.x - arm.elbow.x, arm.hand.y - arm.elbow.y),
      ).toBeCloseTo(34, 6);
      expect(
        Math.hypot(
          arm.hand.x - last.farArm.hand.x,
          arm.hand.y - last.farArm.hand.y,
        ),
      ).toBeLessThan(4);
      if (t >= 1155 && t <= 1400) {
        const angle =
          s.root.rotation + s.torso + arm.angle + arm.bend + arm.wrist + 0.4;
        const neck = add(arm.hand, rotate({ x: 0, y: -22 }, angle));
        const mouth = add(
          s.root,
          rotate(
            add(
              { x: 0, y: skeleton.pelvisY },
              rotate(
                add(
                  { x: 0, y: skeleton.headY },
                  rotate({ x: 25, y: 4 }, p.head ?? 0),
                ),
                s.torso,
              ),
            ),
            s.root.rotation,
          ),
        );
        expect(Math.hypot(neck.x - mouth.x, neck.y - mouth.y)).toBeLessThan(6);
      }
      last = s;
    }
    a.update(200);
    expect(a.name).toBe("idle");
  });
});
