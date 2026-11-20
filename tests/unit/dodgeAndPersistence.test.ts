import { beforeEach, describe, expect, it } from "vitest";
import {
  RealtimeBattle,
  arenaRules,
  type ArenaInput,
} from "../../src/combat/realtime";
import { dodgeRules } from "../../src/combat/dodge";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
import { groundedPose, skeleton } from "../../src/characters/kinematics";
import { ArenaAI } from "../../src/combat/ArenaAI";
import { createPlayer } from "../../src/domain/model";
import { syncBattleInventory } from "../../src/combat/inventorySync";
import {
  armorDurability,
  wearArmor,
  repairArmor,
} from "../../src/combat/armor";
import { addItem, quantity } from "../../src/domain/inventory";
import { installCatalog, item } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";
import { serialize, deserialize } from "../../src/persistence/save";
import live from "../../public/content/items.json";

beforeEach(() => installCatalog(parseCatalog(live).items));
function make() {
  const e = createPlayer();
  e.id = "enemy";
  return new RealtimeBattle(createPlayer(), e, () => 0.5);
}
function advance(b: RealtimeBattle, ms: number, input: ArenaInput = {}) {
  for (let elapsed = 0; elapsed < ms; elapsed += 5)
    b.advance(Math.min(5, ms - elapsed), [input, {}]);
}
describe("two-stage grounded evasion", () => {
  it.each(["greatsword", "war-hammer", "battle-axe", "trident", "crossbow"])(
    "keeps exact %s grips and reachable fixed legs throughout both phases",
    (id) => {
      const b = make();
      b.player.model.skills = [2, 8];
      addItem(b.player.model, id);
      b.player.model.equipment.rightHand = id;
      const motion = new ArenaMotion(b.player.model);
      motion.update(0, b.player);
      b.advance(0, [{ dodge: true }, {}]);
      for (let age = 0; age < 450; age += 10) {
        if (age === 160) b.advance(0, [{ dodge: true }, {}]);
        const pose = motion.update(10, b.player),
          rig = groundedPose(pose);
        expect(rig.nearLeg.clamped).toBe(false);
        expect(rig.farLeg.clamped).toBe(false);
        expect(
          Math.hypot(
            rig.nearArm.hand.x - rig.farArm.hand.x,
            rig.nearArm.hand.y - rig.farArm.hand.y,
          ),
        ).toBeCloseTo(
          id === "crossbow"
            ? Math.hypot(5, 44)
            : (pose.supportGripDistance ?? 24),
          5,
        );
        advance(b, 10);
      }
    },
  );
  it("steps the rear foot and leans while anchoring the front ankle with fixed bones", () => {
    const b = make(),
      motion = new ArenaMotion(b.player.model);
    const start = motion.update(0, b.player);
    const front = groundedPose(start).nearLeg.sole;
    b.advance(0, [{ dodge: true }, {}]);
    for (let age = 0; age < dodgeRules.enter + dodgeRules.hold; age += 10) {
      const pose = motion.update(10, b.player),
        rig = groundedPose(pose);
      expect(rig.nearLeg.sole.x).toBeCloseTo(front.x, 6);
      expect(rig.nearLeg.sole.y).toBeCloseTo(front.y, 6);
      for (const leg of [rig.nearLeg, rig.farLeg]) {
        expect(leg.clamped).toBe(false);
        expect(
          Math.hypot(leg.hip.x - leg.knee.x, leg.hip.y - leg.knee.y),
        ).toBeCloseTo(skeleton.thigh, 6);
        expect(
          Math.hypot(leg.ankle.x - leg.knee.x, leg.ankle.y - leg.knee.y),
        ).toBeCloseTo(skeleton.shin, 6);
      }
      advance(b, 10);
    }
    expect(b.player.x).toBe(370);
    expect(
      groundedPose(motion.update(10, b.player)).farLeg.sole.x,
    ).toBeLessThan(-55);
  });
  for (const facing of [-1, 1] as const)
    it(`retreats in facing ${facing} without jumping, reversing or damaging`, () => {
      const b = make();
      if (facing === -1) b.enemy.x = 100;
      b.advance(0, [{ dodge: true }, {}]);
      advance(b, dodgeRules.enter);
      b.advance(0, [{ dodge: true }, {}]);
      expect(b.player.dodge?.phase).toBe("retreat");
      const start = b.player.x;
      advance(b, dodgeRules.retreat);
      expect((start - b.player.x) * facing).toBeGreaterThan(100);
      expect((start - b.player.x) * facing).toBeLessThan(115);
      expect(b.player.y).toBe(0);
      expect(b.player.vy).toBe(0);
      expect(b.enemy.hp).toBe(100);
      expect(b.player.dodge).toBeNull();
    });
  it("automatically recovers and uses timings exactly 20% faster", () => {
    const b = make();
    b.advance(0, [{ dodge: true }, {}]);
    expect(dodgeRules.enter * 1.2).toBe(180);
    advance(b, dodgeRules.enter + dodgeRules.hold);
    expect(b.player.dodge?.phase).toBe("recover");
    advance(b, dodgeRules.recover);
    expect(b.player.dodge).toBeNull();
    b.advance(0, [{ dodge: true }, {}]);
    expect(b.player.dodge).toBeNull();
    advance(b, dodgeRules.cooldown);
    b.advance(0, [{ dodge: true }, {}]);
    expect(b.player.dodge?.phase).toBe("lean");
  });
  it("buffers a single attack once and begins it immediately after the quick return", () => {
    const b = make();
    b.advance(0, [{ dodge: true }, {}]);
    advance(b, 170);
    b.advance(0, [{ attacks: ["rear"] }, {}]);
    expect(b.player.dodge?.phase).toBe("attackReturn");
    expect(b.player.action).toBeNull();
    advance(b, dodgeRules.attackReturn - 5);
    expect(b.player.action).toBeNull();
    advance(b, 5);
    expect(b.player.dodge).toBeNull();
    expect(b.player.handActions.rear?.name).toBe("quick");
    expect(b.player.handActions.rear?.elapsed).toBe(0);
    expect(b.player.x).toBe(370);
  });
  it("preserves independent dual-hand commands across the return", () => {
    const b = make();
    b.player.model.skills = [1];
    addItem(b.player.model, "iron");
    b.player.model.equipment.leftHand = "iron";
    b.advance(0, [{ dodge: true }, {}]);
    advance(b, 160);
    b.advance(0, [{ attacks: ["front"] }, {}]);
    advance(b, 20);
    b.advance(0, [{ attacks: ["rear"] }, {}]);
    advance(b, 40);
    expect(b.player.handActions.front?.name).toBe("quick");
    expect(b.player.handActions.rear?.name).toBe("quick");
  });
  it("ignores held-key repeats until planted and disallows retreat attacks", () => {
    const b = make();
    b.advance(0, [{ dodge: true }, {}]);
    b.advance(0, [{ dodge: true }, {}]);
    expect(b.player.dodge?.phase).toBe("lean");
    advance(b, 160);
    b.advance(0, [{ dodge: true }, {}]);
    b.advance(0, [{ attack: "quick", jump: true, hop: 1 }, {}]);
    expect(b.player.action).toBeNull();
    expect(b.player.hop).toBeNull();
    expect(b.player.y).toBe(0);
  });
  it("respects walls, hit stun, airborne state and weapon cooldowns", () => {
    const b = make();
    b.player.stun = 100;
    b.advance(0, [{ dodge: true }, {}]);
    expect(b.player.dodge).toBeNull();
    advance(b, 110);
    b.advance(5, [{ jump: true }, {}]);
    b.advance(5, [{ dodge: true }, {}]);
    expect(b.player.dodge).toBeNull();
    const wall = make();
    wall.player.x = arenaRules.minX;
    wall.advance(0, [{ dodge: true }, {}]);
    advance(wall, 160);
    wall.advance(0, [{ dodge: true }, {}]);
    advance(wall, 300);
    expect(wall.player.x).toBe(arenaRules.minX);
    const cool = make();
    cool.player.handCooldowns.rear = 1000;
    cool.advance(0, [{ dodge: true }, {}]);
    advance(cool, 160);
    cool.advance(0, [{ attack: "quick" }, {}]);
    advance(cool, 60);
    expect(cool.player.action).toBeNull();
  });
  it("does not grant invulnerability and cancels a queued attack on a physical hit", () => {
    const b = make();
    b.advance(0, [{ dodge: true }, { attack: "quick" }]);
    advance(b, 500);
    b.player.dodge = {
      phase: "attackReturn",
      elapsed: 0,
      direction: 1,
      pending: { attacks: ["rear"] },
    };
    const cap = { a: { x: 0, y: 0 }, b: { x: 0, y: 10 }, radius: 5 };
    const body = { blade: null, body: [cap] };
    expect(b.resolve([body, { ...body, blade: cap }])[0].damage).toBe(13);
    expect(b.player.dodge).toBeNull();
    advance(b, 60);
    expect(b.player.action).toBeNull();
  });
  it("keeps the same pose and time during hit pause and halves real duration with haste", () => {
    const b = make();
    b.player.speedRemaining = 1000;
    b.advance(0, [{ dodge: true }, {}]);
    advance(b, 75);
    expect(b.player.dodge?.elapsed).toBe(150);
    b.hitStop.configure(true, 200);
    b.hitStop.impact(b.enemy.model.id, b.player.model.id, "rear", false);
    const elapsed = b.player.dodge!.elapsed;
    advance(b, 100);
    expect(b.player.dodge?.elapsed).toBe(elapsed);
  });
  it("lets tactical AI choose lean evasion and then retreat from an ongoing close attack", () => {
    const b = make(),
      ai = new ArenaAI(
        () => 0.5,
        () => 1,
        () => 0.25,
        () => 0.9,
        { advanced: true },
      );
    b.player.x = 500;
    b.enemy.x = 620;
    b.advance(0, [{ attack: "quick" }, {}]);
    advance(b, 160);
    const command = ai.update(10, b.enemy, b.player);
    expect(command.dodge).toBe(true);
    b.advance(0, [{}, command]);
    for (let i = 0; i < 16; i++) b.advance(10, [{}, {}]);
    b.enemy.x = 610;
    expect(ai.update(10, b.enemy, b.player).dodge).toBe(true);
  });
});

describe("authoritative equipment persistence", () => {
  for (const slot of ["helmet", "body"] as const)
    it(`never restores broken ${slot}, even if an event replay missed its occupied slot`, () => {
      const saved = createPlayer();
      saved.skills = [18];
      addItem(saved, "closed-helm");
      addItem(saved, "cuirass");
      saved.equipment.helmet = "closed-helm";
      saved.equipment.body = "cuirass";
      const live = structuredClone(saved),
        id = live.equipment[slot]!;
      wearArmor(live, armorDurability(item(id)!), slot);
      delete saved.equipment[slot]; // Replaying a strict source-slot event would now fail.
      expect(syncBattleInventory(saved, live)).toBe(true);
      repairArmor(saved);
      const loaded = deserialize(serialize(saved));
      expect(loaded.equipment[slot]).toBeUndefined();
      expect(quantity(loaded, id)).toBe(0);
      expect(syncBattleInventory(saved, live)).toBe(false);
    });
  it("consumes only a worn copy, keeps reserves unequipped and preserves progression", () => {
    const saved = createPlayer();
    saved.skills = [18];
    saved.gold = 777;
    saved.progress = 11;
    addItem(saved, "cuirass", 2);
    saved.equipment.body = "cuirass";
    const live = structuredClone(saved);
    wearArmor(live, 10000, "body");
    live.gold = 0;
    live.progress = 0;
    syncBattleInventory(saved, live);
    expect(quantity(saved, "cuirass")).toBe(1);
    expect(saved.equipment.body).toBeUndefined();
    expect(saved.gold).toBe(777);
    expect(saved.progress).toBe(11);
    expect(saved.skills).toEqual([18]);
    live.equipment.rightHand = undefined;
    expect(saved.equipment.rightHand).toBe("wood");
  });
  it("does not apply another fighter's equipment or share mutable inventory references", () => {
    const saved = createPlayer(),
      other = createPlayer();
    other.id = "enemy";
    expect(syncBattleInventory(saved, other)).toBe(false);
    const live = structuredClone(saved);
    addItem(live, "iron");
    syncBattleInventory(saved, live);
    live.inventory.length = 0;
    expect(saved.inventory).toContain("iron");
  });
});
