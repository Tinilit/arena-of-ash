import { describe, expect, it } from "vitest";
import { createPlayer } from "../../src/domain/model";
import { RealtimeBattle, arenaRules } from "../../src/combat/realtime";
import type { CombatGeometry } from "../../src/combat/geometry";
import { quantity, purchase } from "../../src/domain/progression";
import { ArenaAI } from "../../src/combat/ArenaAI";
import { seeded } from "../../src/utils/random";
const empty: CombatGeometry = {
  blade: null,
  body: [],
  grips: { front: { x: 400, y: 300 }, rear: { x: 370, y: 300 } },
};
function make() {
  const p = createPlayer(),
    e = createPlayer();
  p.inventory.push("throwing-knife", "throwing-axe");
  p.equipment.belt1 = "throwing-knife";
  p.equipment.belt2 = "throwing-axe";
  e.id = "enemy";
  return new RealtimeBattle(p, e);
}
function tick(b: RealtimeBattle, ms: number) {
  for (let t = 0; t < ms; t += arenaRules.step) {
    b.advance(arenaRules.step, [{}, {}]);
    b.resolve([
      empty,
      {
        ...empty,
        grips: { front: { x: 910, y: 300 }, rear: { x: 910, y: 300 } },
      },
    ]);
  }
}
function drop(b: RealtimeBattle, enemy = false) {
  b.advance(0, enemy ? [{}, { throws: ["rear"] }] : [{ belt: "belt1" }, {}]);
  tick(b, 2200);
  return b.projectiles[0];
}
describe("grounded item recovery", () => {
  it("recovers a thrown copy into its original slot, with no reserve auto-refill or duplication", () => {
    const b = make();
    purchase(b.player.model, "throwing-knife", 3);
    const p = drop(b);
    expect(p.state).toBe("landed");
    expect(b.player.model.equipment.belt1).toBeUndefined();
    expect(quantity(b.player.model, "throwing-knife")).toBe(3);
    expect(b.canUseBelt(b.player, "belt1")).toBe(false);
    b.player.x = p.x;
    b.advance(0, [{ pickup: true }, {}]);
    expect(p.state).toBe("pickedUp");
    expect(b.player.model.equipment.belt1).toBe("throwing-knife");
    expect(quantity(b.player.model, "throwing-knife")).toBe(4);
    b.advance(0, [{ pickup: true }, {}]);
    expect(b.collectedItems).toHaveLength(1);
    expect(quantity(b.player.model, "throwing-knife")).toBe(4);
  });
  it("collects enemy weapons and preserves a separate copy already held by the player", () => {
    const b = make(),
      p = drop(b, true);
    b.player.x = p.x;
    b.advance(0, [{ pickup: true }, {}]);
    expect(b.player.model.equipment.rightHand).toBe("wood");
    expect(b.player.model.equipment.leftHand).toBe("wood");
    expect(quantity(b.player.model, "wood")).toBe(2);
    expect(b.enemy.model.equipment.rightHand).toBeUndefined();
    expect(b.collectedItems[0].ownerId).toBe("wanderer");
  });
  it("adds a pickup to the backpack when compatible slots are occupied", () => {
    const b = make(),
      p = drop(b);
    purchase(b.player.model, "throwing-axe");
    b.player.model.equipment.belt1 = "throwing-axe";
    b.player.x = p.x;
    b.advance(0, [{ pickup: true }, {}]);
    expect(b.collectedItems[0].slot).toBeUndefined();
    expect(quantity(b.player.model, "throwing-knife")).toBe(1);
    expect(b.player.model.equipment.belt1).toBe("throwing-axe");
  });
  it("requires a nearby grounded item and rejects airborne, stunned or attacking collectors", () => {
    const b = make(),
      p = drop(b);
    b.player.x = p.x - 100;
    expect(b.nearbyPickup(b.player)).toBeUndefined();
    b.player.x = p.x + 120;
    expect(b.nearbyPickup(b.player)).toBe(p);
    b.player.x = p.x;
    b.player.y = -10;
    expect(b.nearbyPickup(b.player)).toBeUndefined();
    b.player.y = 0;
    b.player.stun = 10;
    expect(b.nearbyPickup(b.player)).toBeUndefined();
    b.player.stun = 0;
    b.advance(0, [{ attack: "quick" }, {}]);
    expect(b.nearbyPickup(b.player)).toBeUndefined();
    b.player.action = null;
    p.state = "flying";
    expect(b.nearbyPickup(b.player)).toBeUndefined();
  });
  it("continues settling projectiles after victory and permits collection before the next match", () => {
    const b = make();
    b.advance(0, [{ throws: ["rear"] }, {}]);
    tick(b, 530);
    b.state = "Victory";
    b.enemy.hp = 0;
    for (let t = 0; t < 2000; t += arenaRules.step)
      b.advanceAftermath(arenaRules.step, {});
    const p = b.projectiles[0];
    expect(p.state).toBe("landed");
    b.player.x = p.x;
    b.advanceAftermath(0, { pickup: true });
    expect(b.player.model.equipment.rightHand).toBe("wood");
    expect(p.state).toBe("pickedUp");
    expect(b.state).toBe("Victory");
  });
});
describe("rare enemy throws", () => {
  it("uses a separate chance stream, a wind-up, a long interval and at most one throw per fight", () => {
    const b = make(),
      ai = new ArenaAI(seeded(42), () => 0);
    b.enemy.model.inventory.push("rust");
    b.enemy.model.equipment.leftHand = "rust";
    b.enemy.x = b.player.x + 400;
    expect(ai.update(1000, b.enemy, b.player).throws).toBeUndefined();
    const input = ai.update(800, b.enemy, b.player);
    expect(input.throws).toEqual(["rear"]);
    b.advance(0, [{}, input]);
    tick(b, 530);
    expect(b.projectiles[0].ownerId).toBe("enemy");
    expect(b.enemy.model.equipment.rightHand).toBeUndefined();
    tick(b, 800);
    expect(b.enemy.model.equipment.leftHand).toBe("rust");
    for (let i = 0; i < 10; i++)
      expect(ai.update(10000, b.enemy, b.player).throws).toBeUndefined();
  });
  it("does not throw with a failed probability roll or from melee range", () => {
    const b = make(),
      no = new ArenaAI(seeded(42), () => 0.99),
      close = new ArenaAI(seeded(42), () => 0);
    b.enemy.x = b.player.x + 400;
    expect(no.update(2000, b.enemy, b.player).throws).toBeUndefined();
    b.enemy.x = b.player.x + 100;
    expect(close.update(2000, b.enemy, b.player).throws).toBeUndefined();
  });
});
