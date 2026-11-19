import { beforeEach, describe, expect, it, vi } from "vitest";
import live from "../../public/content/items.json";
import { installCatalog, item } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";
import { createPlayer } from "../../src/domain/model";
import {
  equipmentTarget,
  freeEquipmentSlot,
  equip,
  quantity,
  stats,
} from "../../src/domain/progression";
import {
  RealtimeBattle,
  arenaRules,
  type CombatProcRandom,
} from "../../src/combat/realtime";
import { ArenaAI } from "../../src/combat/ArenaAI";
import type { CombatGeometry } from "../../src/combat/geometry";
import {
  projectileFloorRadius,
  projectileProfile,
  type Projectile,
} from "../../src/combat/projectiles";
import { serialize, deserialize } from "../../src/persistence/save";

beforeEach(() => installCatalog(parseCatalog(live).items));
const capsule = { a: { x: 500, y: 280 }, b: { x: 500, y: 310 }, radius: 8 };
const geometry: CombatGeometry = {
  blade: capsule,
  blades: { rear: capsule, front: capsule },
  body: [capsule],
  hands: { rear: capsule, front: capsule },
  grips: { rear: { x: 550, y: 300 }, front: { x: 570, y: 300 } },
};
const empty: CombatGeometry = { blade: null, body: [] };
function battle(weapon = "wood", random: CombatProcRandom = {}) {
  const p = createPlayer(),
    e = createPlayer();
  e.id = "enemy";
  if (!p.inventory.includes(weapon)) p.inventory.push(weapon);
  p.equipment.rightHand = weapon;
  const b = new RealtimeBattle(p, e, () => 0.99, {
    disarm: () => 0.99,
    hammerKnockdown: () => 0.99,
    hammerPush: () => 0.99,
    ...random,
  });
  b.player.x = 500;
  b.enemy.x = 600;
  return b;
}
function strike(b: RealtimeBattle) {
  b.advance(0, [{ attack: "quick" }, {}]);
  b.advance(b.player.action!.duration * 0.5, [{}, {}]);
  return b.resolve([geometry, geometry])[0];
}
function parry(b: RealtimeBattle) {
  b.advance(0, [{}, { attack: "quick" }]);
  b.advance(500, [{ parry: true }, {}]);
  return b.resolve([geometry, geometry])[0];
}
function ground(id: string, x: number, sequence = 100): Projectile {
  const def = item(id)!;
  return {
    id: sequence,
    ownerId: "wanderer",
    itemId: id,
    hand: "rear",
    sourceSlot: "rightHand",
    x,
    y: 530,
    vx: 0,
    vy: 0,
    angle: Math.PI / 2,
    spin: 0,
    previous: { x, y: 530, angle: Math.PI / 2 },
    attack: 0,
    floorRadius: projectileFloorRadius(def),
    profile: projectileProfile(def),
    age: 1000,
    state: "landed",
  };
}

describe("empty-first equipment", () => {
  it("starts and reloads a new character with an empty belt and supplies in the backpack", () => {
    const p = createPlayer();
    expect(p.equipment).toEqual({ rightHand: "wood" });
    expect(deserialize(serialize(p)).equipment).toEqual(p.equipment);
    expect(p.inventory).toContain("throwing-knife");
  });
  it("fills empty hands and belt slots before replacing the selected occupied slot", () => {
    const p = createPlayer();
    p.inventory.push("rust");
    equip(p, "rust", equipmentTarget(p, "rust", "rightHand"));
    expect(p.equipment).toMatchObject({ rightHand: "wood", leftHand: "rust" });
    equip(p, "throwing-knife", equipmentTarget(p, "throwing-knife", "belt1"));
    equip(p, "throwing-axe", equipmentTarget(p, "throwing-axe", "belt1"));
    expect(p.equipment).toMatchObject({
      belt1: "throwing-knife",
      belt2: "throwing-axe",
    });
    p.inventory.push("healing-potion");
    expect(equipmentTarget(p, "healing-potion", "belt2")).toBe("belt2");
    equip(p, "healing-potion", "belt2");
    expect(p.inventory).toContain("throwing-axe");
  });
  it("recognizes reserved support hands and requires two truly empty hands for a heavy pickup", () => {
    const p = createPlayer();
    expect(freeEquipmentSlot(p, "greatsword")).toBeUndefined();
    p.inventory.push("greatsword");
    equip(p, "greatsword", "rightHand");
    expect(freeEquipmentSlot(p, "rust")).toBeUndefined();
    expect(equipmentTarget(p, "rust", "leftHand")).toBe("leftHand");
    p.equipment = {};
    expect(freeEquipmentSlot(p, "greatsword")).toBe("rightHand");
  });
  it("equips and saves the new armor with its combined protection", () => {
    const p = createPlayer();
    p.inventory.push("closed-helm", "cuirass");
    equip(p, "closed-helm", "helmet");
    equip(p, "cuirass", "body");
    expect(stats(p).armor).toBe(13);
    expect(deserialize(serialize(p))).toEqual(p);
  });
});

describe("parry disarming", () => {
  it("uses an exact 20% threshold and drops one recoverable weapon without damage", () => {
    let disarms = 0;
    for (let roll = 0; roll < 100; roll++) {
      const b = battle("wood", { disarm: () => roll / 100 });
      const hit = parry(b);
      expect(hit.parried).toBe(true);
      expect(hit.damage).toBe(0);
      if (hit.disarmed) {
        disarms++;
        expect(b.enemy.model.equipment.rightHand).toBeUndefined();
        expect(b.projectiles).toHaveLength(1);
        expect(b.projectiles[0].state).toBe("spent");
        expect(b.projectiles[0].attack).toBe(0);
      } else expect(b.enemy.model.equipment.rightHand).toBe("wood");
    }
    expect(disarms).toBe(20);
  });
  it("rolls once against simultaneous weapons and preserves the untouched hand", () => {
    const roll = vi.fn(() => 0),
      b = battle("wood", { disarm: roll });
    b.enemy.model.inventory.push("rust");
    b.enemy.model.equipment.leftHand = "rust";
    b.advance(0, [{}, { attacks: ["front", "rear"] }]);
    b.advance(500, [{ parry: true }, {}]);
    const events = b.resolve([geometry, geometry]);
    expect(events.every((e) => e.parried)).toBe(true);
    expect(events.filter((e) => e.disarmed)).toHaveLength(1);
    expect(roll).toHaveBeenCalledTimes(1);
    expect(Object.values(b.enemy.model.equipment)).toHaveLength(1);
    expect(b.consumedItems).toHaveLength(1);
    expect(b.resolve([geometry, geometry])).toEqual([]);
  });
  it("does not roll on misses, late parries or punches", () => {
    const roll = vi.fn(() => 0),
      b = battle("wood", { disarm: roll });
    b.advance(0, [{}, { attack: "quick" }]);
    b.advance(500, [{ parry: true }, {}]);
    b.resolve([empty, empty]);
    expect(roll).not.toHaveBeenCalled();
    b.advance(150, [{}, {}]);
    b.resolve([geometry, geometry]);
    expect(roll).not.toHaveBeenCalled();
    const fists = battle("wood", { disarm: roll });
    delete fists.enemy.model.equipment.rightHand;
    parry(fists);
    expect(roll).not.toHaveBeenCalled();
  });
  it("settles the dropped weapon, transfers ownership on pickup and never duplicates it", () => {
    const b = battle("wood", { disarm: () => 0 });
    parry(b);
    for (let i = 0; i < 200; i++) {
      b.advance(10, [{}, {}]);
      b.resolve([empty, empty]);
    }
    const p = b.projectiles[0];
    expect(p.state).toBe("landed");
    b.player.x = p.x;
    b.advance(0, [{ pickup: true }, {}]);
    expect(p.state).toBe("pickedUp");
    expect(quantity(b.player.model, "wood")).toBe(2);
    expect(quantity(b.enemy.model, "wood")).toBe(0);
    b.advance(0, [{ pickup: true }, {}]);
    expect(b.collectedItems).toHaveLength(1);
  });
});

describe("opponent ground pickups", () => {
  it("collects weapons underfoot into the free hand, ignoring closer belt loot", () => {
    const b = battle(),
      ai = new ArenaAI(() => 0.99);
    const utility = ground("throwing-knife", b.enemy.x, 101),
      weapon = ground("rust", b.enemy.x + 20);
    b.projectiles.push(utility, weapon);
    const input = ai.update(16, b.enemy, b.player, b.projectiles);
    expect(input.pickup).toBe(true);
    b.advance(0, [{}, input]);
    expect(b.enemy.model.equipment).toMatchObject({
      rightHand: "wood",
      leftHand: "rust",
    });
    expect(utility.state).toBe("landed");
    expect(weapon.state).toBe("pickedUp");
    expect(b.collectedItems[0].ownerId).toBe("enemy");
    expect(b.player.model.inventory).not.toContain("rust");
  });
  it("does not replace held weapons, fill reserved grips, collect while stunned or chase distant drops", () => {
    const b = battle(),
      ai = new ArenaAI(() => 0.99),
      p = ground("rust", b.enemy.x);
    b.enemy.model.equipment.leftHand = "iron";
    expect(ai.update(0, b.enemy, b.player, [p]).pickup).not.toBe(true);
    b.projectiles.push(p);
    b.advance(0, [{}, { pickup: true }]);
    expect(p.state).toBe("landed");
    b.enemy.model.equipment = { rightHand: "greatsword" };
    expect(ai.update(0, b.enemy, b.player, [p]).pickup).not.toBe(true);
    b.enemy.model.equipment = {};
    b.enemy.stun = 100;
    expect(ai.update(0, b.enemy, b.player, [p]).pickup).not.toBe(true);
    b.enemy.stun = 0;
    p.x = 100;
    expect(ai.update(0, b.enemy, b.player, [p]).pickup).not.toBe(true);
  });
});

describe("physical hammer effects", () => {
  it("uses two independent exact 10% chances", () => {
    let falls = 0,
      pushes = 0;
    for (let i = 0; i < 100; i++) {
      if (
        strike(battle("war-hammer", { hammerKnockdown: () => i / 100 }))
          .knockdown
      )
        falls++;
      if (strike(battle("war-hammer", { hammerPush: () => i / 100 })).pushed)
        pushes++;
    }
    expect(falls).toBe(10);
    expect(pushes).toBe(10);
    const both = battle("war-hammer", {
      hammerKnockdown: () => 0,
      hammerPush: () => 0,
    });
    expect(strike(both)).toMatchObject({ knockdown: true, pushed: true });
    expect(both.enemy.pushVx).toBe(arenaRules.kickImpulse);
  });
  it("pushes with normal damage and stagger, and cannot proc twice on the same swing", () => {
    const roll = vi.fn(() => 0),
      b = battle("war-hammer", { hammerPush: roll });
    const hit = strike(b);
    expect(hit.damage).toBe(30);
    expect(b.enemy.hp).toBe(70);
    expect(b.enemy.reaction?.kind).toBe("stagger");
    expect(b.enemy.knockdown).toBeNull();
    b.resolve([geometry, geometry]);
    expect(roll).toHaveBeenCalledTimes(1);
  });
  it("never rolls for a miss, block, parried blow or another weapon", () => {
    const roll = vi.fn(() => 0),
      random = { hammerKnockdown: roll, hammerPush: roll };
    const miss = battle("war-hammer", random);
    miss.advance(0, [{ attack: "quick" }, {}]);
    miss.advance(700, [{}, {}]);
    miss.resolve([empty, empty]);
    expect(roll).not.toHaveBeenCalled();
    const blocked = battle("war-hammer", random);
    blocked.advance(0, [{ attack: "quick" }, { guard: true }]);
    blocked.advance(700, [{}, { guard: true }]);
    blocked.resolve([geometry, geometry]);
    expect(roll).not.toHaveBeenCalled();
    strike(battle("greatsword", random));
    expect(roll).not.toHaveBeenCalled();
    const parried = battle("war-hammer", random);
    parried.advance(0, [{ attack: "quick" }, {}]);
    parried.advance(680, [{}, { parry: true }]);
    parried.resolve([geometry, geometry]);
    expect(roll).not.toHaveBeenCalled();
  });
});
