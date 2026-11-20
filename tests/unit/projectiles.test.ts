import { trainedGladiator as createPlayer } from "../fixtures/trained";
import { describe, it, expect } from "vitest";
import { RealtimeBattle, arenaRules } from "../../src/combat/realtime";

import { projectileShape } from "../../src/combat/projectiles";
import { consumeItem, purchase, equip } from "../../src/domain/progression";
import { deserialize, serialize } from "../../src/persistence/save";
import type { CombatGeometry, Capsule } from "../../src/combat/geometry";
const make = () => {
  const p = createPlayer(),
    e = createPlayer();
  p.inventory.push("throwing-knife", "throwing-axe");
  p.equipment.belt1 = "throwing-knife";
  p.equipment.belt2 = "throwing-axe";
  e.id = "enemy";
  return new RealtimeBattle(p, e, () => 0.5);
};
const cap = (x: number, y = 300): Capsule => ({
  a: { x, y },
  b: { x, y: y + 20 },
  radius: 8,
});
const geometry = (x = 370, body = 370): CombatGeometry => ({
  blade: cap(x),
  body: [cap(body)],
  grips: { front: { x, y: 300 }, rear: { x: x - 40, y: 300 } },
  hands: { front: cap(x), rear: cap(x - 40) },
});
const distant: CombatGeometry = geometry(1500, 1500);
function advance(b: RealtimeBattle, ms: number) {
  for (let t = 0; t < ms; t += arenaRules.step) {
    b.advance(arenaRules.step, [{}, {}]);
    b.resolve([geometry(), distant]);
  }
}
describe("overarm projectiles", () => {
  it.each(["front", "rear"] as const)(
    "throws only the selected %s hand at its release marker",
    (hand) => {
      const b = make();
      b.player.model.inventory.push("rust");
      b.player.model.equipment.leftHand = "rust";
      const source = hand === "front" ? "leftHand" : "rightHand",
        other = hand === "front" ? "rightHand" : "leftHand";
      const old = b.player.model.equipment[source],
        held = b.player.model.equipment[other];
      b.advance(0, [{ throws: [hand] }, {}]);
      advance(b, 490);
      expect(b.projectiles).toHaveLength(0);
      expect(b.player.model.equipment[source]).toBe(old);
      advance(b, 40);
      expect(b.projectiles).toHaveLength(1);
      expect(b.player.model.equipment[source]).toBeUndefined();
      expect(b.player.model.inventory).not.toContain(old);
      expect(b.player.model.equipment[other]).toBe(held);
      expect(b.projectiles[0].itemId).toBe(old);
      expect(b.projectiles[0].hand).toBe(hand);
      advance(b, 600);
      expect(b.projectiles).toHaveLength(1);
      expect(b.canThrow(b.player, hand)).toBe(false);
    },
  );
  it.each(["belt1", "belt2"] as const)(
    "takes %s, leaves the rear weapon in equipment, and prevents repeated use",
    (slot) => {
      const b = make();
      const old = b.player.model.equipment[slot];
      b.advance(0, [{ belt: slot }, {}]);
      advance(b, 530);
      expect(b.projectiles[0].itemId).toBe(old);
      expect(b.player.model.equipment[slot]).toBeUndefined();
      expect(b.player.model.inventory).not.toContain(old);
      expect(b.player.model.equipment.rightHand).toBe("wood");
      expect(b.canThrow(b.player, "rear", slot)).toBe(false);
    },
  );
  it("preserves the loadout if the wind-up is interrupted before release", () => {
    const b = make();
    b.advance(0, [{ belt: "belt1" }, {}]);
    advance(b, 300);
    b.player.action = null;
    b.player.stun = 180;
    advance(b, 600);
    expect(b.projectiles).toEqual([]);
    expect(b.player.model.equipment.belt1).toBe("throwing-knife");
  });
  it("throws both hand weapons independently without duplicating either item", () => {
    const b = make();
    b.player.model.inventory.push("rust");
    b.player.model.equipment.leftHand = "rust";
    b.advance(0, [{ throws: ["rear", "front", "rear"] }, {}]);
    advance(b, 530);
    expect(b.projectiles).toHaveLength(2);
    expect(new Set(b.projectiles.map((p) => p.itemId)).size).toBe(2);
    expect(b.player.model.equipment.rightHand).toBeUndefined();
    expect(b.player.model.equipment.leftHand).toBeUndefined();
  });
  it("releases from the actual airborne grip without adding a jump impulse", () => {
    const b = make();
    b.advance(arenaRules.step, [{ jump: true }, {}]);
    const vy = b.player.vy;
    b.advance(0, [{ belt: "belt2" }, {}]);
    expect(b.player.vy).toBe(vy);
    expect(b.player.handActions.rear!.duration).toBe(650);
    advance(b, 400);
    expect(b.player.y).toBeLessThan(0);
    expect(b.projectiles).toHaveLength(1);
  });
  it("damages once only after a swept projectile/body contact, ignoring the owner", () => {
    const b = make();
    b.advance(0, [{ belt: "belt1" }, {}]);
    advance(b, 520);
    const p = b.projectiles[0];
    expect(b.contacts).toEqual([]);
    const c = projectileShape(p);
    const target: CombatGeometry = { blade: null, body: [c] };
    const events = b.resolve([geometry(), target]);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("projectile");
    expect(events[0].damage).toBe(15);
    expect(b.enemy.hp).toBe(85);
    expect(b.player.hp).toBe(100);
    expect(b.resolve([geometry(), target])).toEqual([]);
  });
  it("catches a fast object crossing a narrow body between steps", () => {
    const b = make();
    b.advance(0, [{ belt: "belt2" }, {}]);
    advance(b, 520);
    const p = b.projectiles[0];
    p.spin = 0;
    p.angle = Math.PI / 2;
    p.x = 200;
    p.y = 300;
    p.previous = { x: 200, y: 300, angle: p.angle };
    p.vx = 1800;
    p.vy = 0;
    b.advance(100, [{}, {}]);
    const target: CombatGeometry = { blade: null, body: [cap(315)] };
    expect(b.resolve([geometry(), target])[0]?.kind).toBe("projectile");
  });
  it("settles missed objects on the floor and never damages from a landed object", () => {
    const b = make();
    b.advance(0, [{ belt: "belt1" }, {}]);
    advance(b, 2500);
    expect(b.projectiles[0].state).toBe("landed");
    const target: CombatGeometry = {
      blade: null,
      body: [projectileShape(b.projectiles[0])],
    };
    expect(b.resolve([geometry(), target])).toEqual([]);
  });
  it("never mutates persistent gear through battle-only copies", () => {
    const p = createPlayer(),
      before = structuredClone(p),
      e = createPlayer();
    e.id = "enemy";
    const b = new RealtimeBattle(p, e);
    b.advance(0, [{ belt: "belt2" }, {}]);
    advance(b, 900);
    expect(p).toEqual(before);
  });
  it("persists consumption exactly once and allows buying a replacement", () => {
    const p = createPlayer();
    p.inventory.push("throwing-knife");
    expect(consumeItem(p, "throwing-knife")).toBe(true);
    expect(consumeItem(p, "throwing-knife")).toBe(false);
    const loaded = deserialize(serialize(p));
    expect(loaded.inventory).not.toContain("throwing-knife");
    expect(loaded.equipment.belt1).toBeUndefined();
    expect(purchase(loaded, "throwing-knife")).toBe(true);
    expect(loaded.gold).toBe(75);
    expect(equip(loaded, "throwing-knife", "belt1")).toBe(true);
    expect(loaded.equipment.belt1).toBe("throwing-knife");
  });
  it("uses the rendered item's launch profile, including a failed-image fallback", () => {
    const b = make();
    b.advance(0, [{ throws: ["rear"] }, {}]);
    b.advance(520, [{}, {}]);
    const g = geometry();
    g.launch = {
      rear: { profile: { startY: -55, endY: -10, radius: 3 }, floorRadius: 12 },
    };
    b.resolve([g, distant]);
    expect(b.projectiles[0].profile).toEqual(g.launch.rear!.profile);
    expect(b.projectiles[0].floorRadius).toBe(12);
  });
});
