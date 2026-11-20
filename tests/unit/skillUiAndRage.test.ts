import { ArenaAI } from "../../src/combat/ArenaAI";
import { beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../../public/content/items.json";
import { installCatalog, items, item } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";
import { createPlayer } from "../../src/domain/model";
import { shopStock } from "../../src/domain/shop";
import { skill, skillBalance } from "../../src/domain/skills";
import { addItem, equip } from "../../src/domain/progression";
import { RealtimeBattle } from "../../src/combat/realtime";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
import { groundedPose } from "../../src/characters/kinematics";
import { ragePose } from "../../src/characters/skillMotion";
import { faceExpression } from "../../src/characters/faceExpression";
import { parryRules } from "../../src/combat/parry";
import type { CombatGeometry } from "../../src/combat/geometry";
beforeEach(() => installCatalog(parseCatalog(catalog).items));
function battle(counter = () => 1) {
  const p = createPlayer(),
    e = createPlayer();
  e.id = "enemy";
  p.skills = [6, 16];
  const b = new RealtimeBattle(p, e, () => 1, { counter, disarm: () => 1 });
  b.player.x = 500;
  b.enemy.x = 620;
  return b;
}
const capsule = { a: { x: 540, y: 350 }, b: { x: 550, y: 370 }, radius: 10 };
const geometry = (): [CombatGeometry, CombatGeometry] => [
  {
    blade: capsule,
    blades: { rear: capsule, front: capsule },
    body: [capsule],
    parries: [capsule],
  },
  {
    blade: capsule,
    blades: { rear: capsule, front: capsule },
    body: [capsule],
  },
];
function parry(b: RealtimeBattle) {
  b.advance(0, [{ parry: true }, { attack: "quick" }]);
  b.enemy.handActions.rear!.elapsed = 500;
  return b.resolve(geometry());
}
describe("skill-only shop stock", () => {
  it("filters by learned requirements rather than ownership or currently free slots", () => {
    const p = createPlayer();
    const initial = shopStock(items, "weapons", p).map((i) => i.id);
    expect(initial).toContain("wood");
    expect(initial).toContain("iron");
    for (const id of ["greatsword", "crossbow", "throwing-knife"])
      expect(initial).not.toContain(id);
    p.skills = [skill.ranged];
    expect(
      shopStock(items, "weapons", p).some((i) => i.id === "crossbow"),
    ).toBe(true);
    expect(
      shopStock(items, "weapons", p).some((i) => i.id === "greatsword"),
    ).toBe(false);
    p.skills = [skill.heavy];
    expect(
      shopStock(items, "weapons", p).some((i) => i.id === "greatsword"),
    ).toBe(true);
  });
  it("handles both shield prerequisites and the empty consumable category", () => {
    const p = createPlayer();
    expect(shopStock(items, "misc", p)).toEqual([]);
    p.skills = [skill.shield];
    expect(shopStock(items, "armor", p).map((i) => i.id)).toContain("shield");
    expect(shopStock(items, "armor", p).map((i) => i.id)).not.toContain(
      "tower",
    );
    p.skills.push(skill.heavyArmor, skill.alchemy);
    expect(shopStock(items, "armor", p).map((i) => i.id)).toContain("tower");
    expect(shopStock(items, "misc", p).map((i) => i.id)).toContain(
      "healing-potion",
    );
    expect(shopStock(items, "weapons").length).toBeGreaterThan(
      shopStock(items, "weapons", p).length,
    );
  });
});
describe("exclusive probabilistic parry follow-up", () => {
  it.each([0, 0.19999, 0.2, 0.999])(
    "roll %s selects exactly one follow-up",
    (roll) => {
      const random = vi.fn(() => roll),
        b = battle(random);
      expect(parry(b)[0].parried).toBe(true);
      expect(random).toHaveBeenCalledTimes(1);
      expect(b.enemy.stun).toBe(parryRules.stun);
      const pose = new ArenaMotion(b.player.model).update(0, b.player);
      if (roll < 0.2) expect(pose.nearShove ?? 0).toBe(0);
      b.advance(150, [{}, {}]);
      if (roll < 0.2) {
        expect(b.player.handActions.rear?.name).toBe("counter");
        expect(b.enemy.pushVx).toBe(0);
        expect(b.player.parry).toBeNull();
      } else {
        expect(b.player.handActions.rear).toBeNull();
        expect(b.enemy.pushVx).toBeGreaterThan(0);
      }
      expect(random).toHaveBeenCalledTimes(1);
    },
  );
  it("produces exactly 20 counters per 100 evenly spaced eligible successes", () => {
    let counters = 0;
    for (let i = 0; i < 100; i++) {
      const b = battle(() => i / 100);
      parry(b);
      if (b.player.counterPending) counters++;
    }
    expect(counters).toBe(20);
  });
  it("rolls once for two simultaneously parried hands, not once per contact", () => {
    const random = vi.fn(() => 0.1),
      b = battle(random);
    b.enemy.model.skills = [1];
    addItem(b.enemy.model, "rust");
    equip(b.enemy.model, "rust", "leftHand");
    b.advance(0, [{ parry: true }, { attacks: ["rear", "front"] }]);
    b.enemy.handActions.rear!.elapsed =
      b.enemy.handActions.front!.elapsed = 500;
    const g = geometry();
    g[1].blades = { rear: capsule, front: capsule };
    expect(b.resolve(g).filter((e) => e.parried)).toHaveLength(2);
    expect(random).toHaveBeenCalledTimes(1);
    b.advance(150, [{}, {}]);
    expect(b.enemy.pushVx).toBe(0);
  });
  it("preserves the ordinary shove without Counterstrike and avoids rolling on misses", () => {
    const random = vi.fn(() => 0),
      b = battle(random);
    b.player.model.skills = [6];
    parry(b);
    b.advance(150, [{}, {}]);
    expect(random).not.toHaveBeenCalled();
    expect(b.enemy.pushVx).toBeGreaterThan(0);
    const miss = battle(random);
    miss.advance(0, [{ parry: true }, {}]);
    miss.resolve(geometry());
    expect(random).not.toHaveBeenCalled();
  });
  it("requires actual weapon contact for counter damage and never adds shove damage", () => {
    const b = battle(() => 0);
    parry(b);
    b.advance(150, [{}, {}]);
    const hp = b.enemy.hp;
    expect(hp).toBe(100);
    b.player.handActions.rear!.elapsed = 200;
    const empty: CombatGeometry = { blade: null, body: [] };
    expect(b.resolve([empty, empty])).toEqual([]);
    expect(b.enemy.hp).toBe(hp);
    expect(b.resolve(geometry())[0]).toMatchObject({
      kind: "weapon",
      damage: Math.round(item("wood")!.attack * skillBalance.counterDamage),
    });
  });
});
describe("rage and shield presentation", () => {
  it("animates rage activation and keeps red eyes and anger for exactly its buff lifetime", () => {
    const b = battle();
    b.player.model.skills = [11];
    b.advance(0, [{ rage: true }, {}]);
    expect(b.player.rageActivationRemaining).toBe(620);
    const motion = new ArenaMotion(b.player.model);
    b.advance(310, [{}, {}]);
    expect(motion.update(310, b.player).head).toBeLessThan(-0.1);
    expect(motion.name).toBe("rage");
    expect(
      faceExpression(
        0,
        b.player.rageRemaining,
        b.player.rageActivationRemaining,
      ),
    ).toMatchObject({ enraged: true, eyeColor: 0xff3428, mouth: "roar" });
    b.advance(310, [{}, {}]);
    expect(faceExpression(0, b.player.rageRemaining, 0).mouth).toBe("snarl");
    b.advance(7380, [{}, {}]);
    expect(faceExpression(0, b.player.rageRemaining)).toMatchObject({
      enraged: false,
      eyeColor: 0x202c34,
      mouth: "neutral",
    });
    const base = { torso: 0.1, head: 0.2, rootY: 3 };
    expect(ragePose(base, 620)).toEqual(base);
  });
  it("Auto Battle gives the Rage activation time to play before another attack", () => {
    const b = battle();
    b.player.model.skills = [11];
    const ai = new ArenaAI(
      () => 0.99,
      () => 1,
      () => 1,
      () => 0.99,
    );
    b.advance(0, [{ rage: true }, {}]);
    expect(ai.update(1000, b.player, b.enemy)).toMatchObject({ move: 0 });
    expect(ai.lastDecision).toBe("rage");
    b.advance(620, [{}, {}]);
    expect(ai.update(1000, b.player, b.enemy).attack).toBe("quick");
  });
  it.each(["shield", "tower"])(
    "returns the %s wrist to the front after drinking, with fixed bone lengths",
    (id) => {
      const b = battle();
      b.player.model.skills = [9, 10, 18];
      for (const itemId of [id, "healing-potion"])
        addItem(b.player.model, itemId);
      equip(b.player.model, id, "rightHand");
      equip(b.player.model, "wood", "leftHand");
      equip(b.player.model, "healing-potion", "belt1");
      b.player.hp = 40;
      const motion = new ArenaMotion(b.player.model);
      b.advance(0, [{ belt: "belt1" }, {}]);
      expect(b.player.handActions.rear?.name).toBe("drink");
      let pose = motion.update(0, b.player);
      for (let t = 0; t < 2400; t += 10) {
        b.advance(10, [{}, {}]);
        b.resolve([
          { blade: null, body: [] },
          { blade: null, body: [] },
        ]);
        pose = motion.update(10, b.player);
      }
      expect(b.player.model.equipment.belt1).toBeUndefined();
      expect(b.player.hp).toBe(75);
      expect(pose.drinkPreview).toBe(0);
      expect(pose.farHandX).toBe(54);
      expect(pose.farHandY).toBe(42);
      const arm = groundedPose(pose).farArm;
      expect(arm.hand.x).toBeGreaterThan(arm.shoulder.x + 40);
      expect(arm.clamped).toBe(false);
      expect(
        Math.hypot(arm.hand.x - arm.elbow.x, arm.hand.y - arm.elbow.y),
      ).toBeCloseTo(34);
    },
  );
});
