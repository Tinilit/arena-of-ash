import { trainedGladiator as createPlayer } from "../fixtures/trained";
import { beforeEach, describe, expect, it } from "vitest";
import live from "../../public/content/items.json";
import { installCatalog, item } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";

import { damage } from "../../src/combat/engine";
import { armorDurability, wearArmor } from "../../src/combat/armor";
import { RealtimeBattle } from "../../src/combat/realtime";
import { ArenaAI } from "../../src/combat/ArenaAI";
import { projectileShape } from "../../src/combat/projectiles";
import {
  purchase,
  equip,
  unequip,
  quantity,
  sell,
  stats,
} from "../../src/domain/progression";
import { serialize, deserialize } from "../../src/persistence/save";
import type { CombatGeometry } from "../../src/combat/geometry";
beforeEach(() => installCatalog(parseCatalog(live).items));
const cap = { a: { x: 500, y: 300 }, b: { x: 500, y: 330 }, radius: 12 };
const touching: CombatGeometry = {
  blade: cap,
  blades: { rear: cap, front: cap },
  hands: { rear: cap, front: cap },
  feet: { rear: cap, front: cap },
  body: [cap, cap],
  grips: { rear: { x: 500, y: 300 }, front: { x: 500, y: 300 } },
};
const empty: CombatGeometry = { blade: null, body: [] };
function make() {
  const p = createPlayer(),
    e = createPlayer();
  e.id = "enemy";
  e.inventory.push("closed-helm", "cuirass");
  e.equipment.helmet = "closed-helm";
  e.equipment.body = "cuirass";
  const b = new RealtimeBattle(p, e, () => 0.5);
  b.player.x = 500;
  b.enemy.x = 650;
  return b;
}
function strike(b: RealtimeBattle) {
  b.advance(0, [{ attack: "quick" }, {}]);
  b.advance(550, [{}, {}]);
  return b.resolve([touching, touching]);
}
describe("fixed damage and breakable protection", () => {
  it("subtracts total helmet and body armor, without attack cross-bonuses", () => {
    const b = make();
    item("cuirass")!.armor = 6;
    item("cuirass")!.attack = 999;
    b.player.model.equipment.rightHand = "spear"; // 18 damage
    expect(stats(b.enemy.model).armor).toBe(11);
    expect(damage(b.player.model, b.enemy.model)).toBe(7);
    expect(damage(b.player.model, b.enemy.model)).toBe(7);
  });
  it("wears fully absorbing armor only on confirmed hits and destroys each copy once", () => {
    const b = make();
    for (const id of ["closed-helm", "cuirass"])
      (b.enemy.model.armorWear ??= {})[id] = armorDurability(item(id)!) - 1;
    b.advance(0, [{ attack: "quick" }, {}]);
    b.advance(550, [{}, {}]);
    expect(b.resolve([empty, empty])).toEqual([]);
    expect(b.enemy.model.equipment.body).toBe("cuirass");
    const [hit] = b.resolve([touching, touching]);
    expect(hit).toMatchObject({ damage: 0, rawDamage: 13, blocked: true });
    expect(b.enemy.hp).toBe(100);
    expect(b.enemy.model.equipment).toEqual({
      rightHand: "wood",
      body: "cuirass",
    });
    expect(b.enemy.model.inventory).toEqual(["wood", "cuirass"]);
    expect(b.armorBreaks.map((e) => e.slot)).toEqual(["helmet"]);
    expect(b.consumedItems).toHaveLength(1);
    expect(b.projectiles).toEqual([]);
    expect(b.resolve([touching, touching])).toEqual([]);
    for (let i = 0; i < 120; i++) b.advance(8, [{}, {}]);
    // A later torso contact breaks only the remaining body piece.
    const bodyHit = {
      ...touching,
      bodyRegions: ["body", "body"] as ("body" | "helmet")[],
    };
    b.advance(0, [{ attack: "quick" }, {}]);
    b.advance(550, [{}, {}]);
    expect(b.resolve([bodyHit, bodyHit])[0].damage).toBe(5);
    expect(b.enemy.model.equipment).toEqual({ rightHand: "wood" });
    expect(b.consumedItems).toHaveLength(2);
    for (let i = 0; i < 120; i++) b.advance(8, [{}, {}]);
    expect(strike(b)[0].damage).toBe(13);
    expect(b.enemy.hp).toBe(82);
  });
  it("uses the same fixed armor subtraction and wear for thrown items and bolts", () => {
    for (const kind of ["throw", "bolt"] as const) {
      const b = make();
      const shape = { startY: -25, endY: 0, radius: 6 };
      b.projectiles.push({
        id: 700,
        ownerId: b.player.model.id,
        itemId: kind === "bolt" ? "crossbow" : "throwing-knife",
        kind: kind === "bolt" ? "bolt" : undefined,
        hand: "rear",
        sourceSlot: "rightHand",
        x: 500,
        y: 300,
        vx: 500,
        vy: 0,
        angle: 0,
        spin: 0,
        previous: { x: 500, y: 300, angle: 0 },
        attack: 18,
        floorRadius: 10,
        profile: shape,
        age: 1,
        state: "flying",
      });
      const body: CombatGeometry = {
        blade: null,
        body: [projectileShape(b.projectiles[0])],
      };
      expect(b.resolve([empty, body])[0]).toMatchObject({
        kind: "projectile",
        damage: 5,
        rawDamage: 18,
      });
      expect(b.enemy.model.armorWear).toEqual({
        "closed-helm": 18,
      });
    }
  });
  it("does not fatigue armor from a kick or a parried weapon", () => {
    const b = make();
    b.advance(0, [{ attack: "kick" }, {}]);
    b.advance(420, [{}, {}]);
    b.resolve([touching, touching]);
    expect(b.enemy.model.armorWear).toBeUndefined();
    const parried = make();
    parried.advance(0, [{ attack: "quick" }, {}]);
    parried.advance(550, [{}, { parry: true }]);
    expect(parried.resolve([touching, touching])[0].parried).toBe(true);
    expect(parried.enemy.model.armorWear).toBeUndefined();
  });
  it("retains fatigue across re-equipping and saving until battle repair", () => {
    const p = make().enemy.model;
    wearArmor(p, 20);
    unequip(p, "helmet");
    equip(p, "closed-helm", "helmet");
    const loaded = deserialize(serialize(p));
    expect(loaded.armorWear).toEqual({ "closed-helm": 20, cuirass: 20 });
    const next = new RealtimeBattle(loaded, createPlayer());
    expect(next.player.model.armorWear).toEqual(loaded.armorWear);
    wearArmor(next.player.model, armorDurability(item("closed-helm")!) - 20);
    expect(next.player.model.equipment.helmet).toBeUndefined();
    expect(next.player.model.equipment.body).toBe("cuirass");
  });
  it("destroys only the worn copy without automatically equipping a spare", () => {
    const p = make().enemy.model;
    p.quantities = { cuirass: 2 };
    wearArmor(p, 10000);
    expect(quantity(p, "cuirass")).toBe(1);
    expect(p.equipment.body).toBeUndefined();
    expect(p.armorWear).toEqual({});
  });
  it("rejects invalid fatigue metadata in saves", () => {
    for (const wear of [
      { wood: 1 },
      { cuirass: -1 },
      { cuirass: Infinity },
      { missing: 10 },
    ] as Record<string, number>[]) {
      const p = make().enemy.model;
      p.armorWear = wear;
      expect(deserialize(serialize(p))).toEqual({
        ...createPlayer(),
        skills: [],
      });
    }
  });
});
describe("selling backpack copies", () => {
  it("sells reserves one at a time, preserves equipped copies and persists proceeds", () => {
    const p = createPlayer();
    p.gold = 1000;
    purchase(p, "throwing-knife", 3);
    equip(p, "throwing-knife", "belt1");
    expect(sell(p, "throwing-knife")).toBe(true);
    expect(p.gold).toBe(937);
    expect(quantity(p, "throwing-knife")).toBe(2);
    expect(sell(p, "throwing-knife")).toBe(true);
    expect(sell(p, "throwing-knife")).toBe(false);
    expect(p.equipment.belt1).toBe("throwing-knife");
    expect(deserialize(serialize(p))).toEqual(p);
  });
  it.each(["rust", "closed-helm", "cuirass", "healing-potion"])(
    "can sell %s and buy it again",
    (id) => {
      const p = createPlayer();
      p.gold = 1000;
      purchase(p, id);
      if (id === "cuirass") p.armorWear = { cuirass: 20 };
      const before = p.gold;
      expect(sell(p, id)).toBe(true);
      expect(p.gold).toBe(before + Math.floor(item(id)!.price / 2));
      expect(quantity(p, id)).toBe(0);
      expect(p.armorWear?.[id]).toBeUndefined();
      expect(purchase(p, id)).toBe(true);
    },
  );
  it("never sells worn gear, a nonexistent ID or an unsafe gold total", () => {
    const p = createPlayer();
    expect(sell(p, "wood")).toBe(false);
    expect(sell(p, "missing")).toBe(false);
    unequip(p, "rightHand");
    p.gold = Number.MAX_SAFE_INTEGER;
    expect(sell(p, "wood")).toBe(false);
  });
});
describe("AI reach and empty hands", () => {
  it.each(["wood", "war-spear", "trident"])(
    "keeps %s distance despite an empty offhand",
    (id) => {
      const b = make();
      b.enemy.model.equipment = { rightHand: id };
      const ai = new ArenaAI(
        () => 0.8,
        () => 1,
        () => 1,
        () => 1,
        { advanced: false },
      );
      b.enemy.x = 1100;
      expect(ai.update(600, b.enemy, b.player).move).toBe(-1);
      b.enemy.x = 570;
      expect(ai.update(600, b.enemy, b.player).move).toBe(1);
      b.enemy.x = id === "wood" ? 640 : id === "trident" ? 740 : 695;
      expect(ai.update(600, b.enemy, b.player).move).toBe(0);
    },
  );
  it("does not request unarmed attacks in either AI policy", () => {
    for (const advanced of [true, false]) {
      const b = make();
      b.enemy.model.equipment = {};
      b.enemy.x = 610;
      const ai = new ArenaAI(
        () => 0.8,
        () => 1,
        () => 1,
        () => 0.5,
        { advanced },
      );
      for (let i = 0; i < 10; i++) {
        const input = ai.update(600, b.enemy, b.player);
        expect(input.attack).not.toBe("quick");
        expect(input.attacks).toBeUndefined();
      }
      expect(b.canAttack(b.enemy, "kick")).toBe(true);
      expect(b.canGrapple(b.enemy)).toBe(false); // Too far, not disabled.
      b.enemy.x = 590;
      expect(b.canGrapple(b.enemy)).toBe(true);
    }
  });
});

it("allows a deliberate AI grapple approach inside normal weapon spacing", () => {
  const b = make();
  const ai = new ArenaAI(
    () => 0.8,
    () => 1,
    () => 1,
    () => 0.99,
  );
  ai.cadence.attacks = 3;
  let grabbed = false;
  for (let i = 0; i < 150; i++) {
    const input = ai.update(i === 0 ? 600 : 8, b.enemy, b.player);
    b.advance(8, [{}, input]);
    if (b.enemy.grapple) {
      grabbed = true;
      break;
    }
  }
  expect(grabbed).toBe(true);
  expect(Math.abs(b.enemy.x - b.player.x)).toBeLessThanOrEqual(105);
});

it("allows a close grab to commit instead of automatically backpedaling out of every reach", () => {
  const b = make();
  b.enemy.x = b.player.x + 94;
  const ai = new ArenaAI(
    () => 0.8,
    () => 1,
    () => 1,
    () => 1,
    { advanced: false },
  );
  b.advance(0, [{ grapple: true }, {}]);
  for (let i = 0; i < 60; i++)
    b.advance(8, [{}, ai.update(8, b.enemy, b.player)]);
  expect(b.enemy.grapple?.role).toBe("target");
  expect(b.player.grapple?.phase).toBe("lift");
});
