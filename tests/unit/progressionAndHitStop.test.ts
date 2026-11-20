import { shieldCarryPose } from "../../src/characters/shieldMotion";
import { groundedPose } from "../../src/characters/kinematics";
import { combatRest, relaxedRest } from "../../src/characters/locomotion";
import { beforeEach, describe, expect, it } from "vitest";
import live from "../../public/content/items.json";
import { installCatalog, item, items } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";
import { createPlayer } from "../../src/domain/model";
import {
  activeSkills,
  allSkillIds,
  equipmentAllowed,
  itemUsable,
  skill,
  skillBalance,
} from "../../src/domain/skills";
import {
  completeBattle,
  choosePostBattle,
  ensureSkillOffers,
  learnSkill,
} from "../../src/domain/postBattle";
import { deserialize, serialize } from "../../src/persistence/save";
import { opponent } from "../../src/domain/opponents";
import {
  addItem,
  equip,
  primaryHand,
  stats,
} from "../../src/domain/progression";
import { seeded } from "../../src/utils/random";
import { HitStop } from "../../src/combat/hitStop";
import { SkillCadence } from "../../src/combat/skillCadence";
import { ArenaAI } from "../../src/combat/ArenaAI";
import { RealtimeBattle } from "../../src/combat/realtime";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
import type { CombatGeometry } from "../../src/combat/geometry";
beforeEach(() => installCatalog(parseCatalog(live).items));
function battle(dual = false) {
  const p = createPlayer(),
    e = createPlayer();
  e.id = "enemy";
  if (dual) {
    p.skills = [skill.dual];
    addItem(p, "rust");
    equip(p, "rust", "leftHand");
  }
  const b = new RealtimeBattle(p, e, () => 1);
  b.hitStop.configure(true, 200);
  return b;
}
const shape = { a: { x: 500, y: 300 }, b: { x: 500, y: 320 }, radius: 10 };
const contactGeometry: [CombatGeometry, CombatGeometry] = [
  { blade: shape, blades: { rear: shape }, body: [] },
  { blade: null, body: [shape] },
];
function impact(b: RealtimeBattle) {
  b.advance(0, [{ attack: "quick", hand: "rear" }, {}]);
  b.player.handActions.rear!.elapsed = 500;
  return b.resolve(contactGeometry);
}
describe("two durable random offers", () => {
  it("offers two distinct eligible skills and rejects every unoffered skill", () => {
    const p = createPlayer();
    completeBattle(p, "one", "Victory", "Enemy");
    const offers = p.postBattle!.offers!;
    expect(offers).toHaveLength(2);
    expect(new Set(offers).size).toBe(2);
    expect(offers).not.toContain(skill.counter);
    expect(offers).not.toContain(skill.bash);
    choosePostBattle(p, "skill");
    expect(
      learnSkill(
        p,
        allSkillIds.find((id) => !offers.includes(id))!,
      ),
    ).toBe(false);
    expect(learnSkill(p, offers[0])).toBe(true);
    expect(learnSkill(p, offers[1])).toBe(false);
  });
  it("persists offers through refresh and samples different offers for another fight", () => {
    let p = createPlayer();
    completeBattle(p, "one", "Defeat", "Enemy");
    delete p.postBattle!.offers;
    ensureSkillOffers(p, () => 0);
    expect(p.postBattle!.offers).toEqual([1, 2]);
    p = deserialize(serialize(p));
    ensureSkillOffers(p, () => 0.99);
    expect(p.postBattle!.offers).toEqual([1, 2]);
    choosePostBattle(p, "skill");
    learnSkill(p, 1);
    completeBattle(p, "two", "Victory", "Enemy");
    delete p.postBattle!.offers;
    ensureSkillOffers(p, () => 0.99);
    expect(p.postBattle!.offers).not.toEqual([1, 2]);
  });
  it("offers the single remaining skill and none after the active catalog is exhausted", () => {
    const p = createPlayer();
    p.skills = activeSkills()
      .map((s) => s.id)
      .filter((id) => id !== 18);
    completeBattle(p, "last", "Victory", "Enemy");
    expect(p.postBattle!.offers).toEqual([18]);
    choosePostBattle(p, "skill");
    expect(learnSkill(p, 18)).toBe(true);
    completeBattle(p, "done", "Victory", "Enemy");
    expect(p.postBattle!.offers).toEqual([]);
    expect(choosePostBattle(p, "skill")).toBe(false);
  });
});
describe("skill-compatible enemy budgets", () => {
  it.each([0, 1, 2, 6, 11, 17, 18])(
    "gives exactly %s skills to challengers and bosses",
    (count) => {
      for (const wins of [0, 5, 6, 11, 17, 25])
        for (let seed = 0; seed < 20; seed++) {
          const p = createPlayer();
          p.progress = wins;
          p.skills = allSkillIds.slice(0, count);
          const e = opponent(p, seeded(seed));
          expect(e.skills).toHaveLength(count);
          expect(new Set(e.skills).size).toBe(count);
          for (const [slot, id] of Object.entries(e.equipment)) {
            const def = item(id!)!;
            expect(itemUsable(e, def), `${e.name}: ${id}`).toBe(true);
            expect(
              equipmentAllowed(e, def, slot as keyof typeof e.equipment),
            ).toBe(true);
          }
          expect(e.skills!.includes(16) && !e.skills!.includes(6)).toBe(false);
          expect(new RealtimeBattle(p, e).enemy.model.skills).toEqual(e.skills);
        }
    },
  );
});
describe("weight classes and passive rear shields", () => {
  it("classifies every weapon and armor item and gates heavy armor separately", () => {
    const p = createPlayer();
    for (const def of items.filter((i) =>
      ["weapon", "helmet", "chest", "shield"].includes(i.slot),
    ))
      expect(["light", "heavy"]).toContain(def.equipmentClass);
    addItem(p, "cuirass");
    expect(equip(p, "cuirass", "body")).toBe(false);
    p.skills = [skill.heavy];
    expect(equip(p, "cuirass", "body")).toBe(false);
    p.skills = [skill.heavyArmor];
    expect(equip(p, "cuirass", "body")).toBe(true);
    addItem(p, "greatsword");
    expect(equip(p, "greatsword", "rightHand")).toBe(false);
  });
  it("keeps either shield above the floor with reachable fixed-length arms", () => {
    for (const id of ["shield", "tower"])
      for (const pose of [combatRest, relaxedRest]) {
        const result = groundedPose(shieldCarryPose(pose, item(id)!));
        expect(result.farArm.clamped).toBe(false);
        expect(result.farArm.hand.y + (id === "tower" ? 98 : 54)).toBeLessThan(
          -5,
        );
      }
  });
  it("supports a front weapon plus rear shield without Dual Wielding", () => {
    const p = createPlayer();
    p.skills = [skill.shield];
    addItem(p, "shield");
    expect(equip(p, "shield", "leftHand")).toBe(false);
    expect(equip(p, "shield", "rightHand")).toBe(true);
    expect(equip(p, "wood", "leftHand")).toBe(true);
    expect(primaryHand(p)).toBe("front");
    expect(stats(p).armor).toBe(3);
    expect(deserialize(serialize(p)).equipment).toEqual(p.equipment);
    addItem(p, "tower");
    expect(equip(p, "tower", "rightHand")).toBe(false);
    p.skills.push(skill.heavyArmor);
    expect(equip(p, "tower", "rightHand")).toBe(true);
    expect(stats(p).armor).toBe(6);
  });
});
describe("removable real-time hit pause", () => {
  it("freezes both actors for 200 ms on actual damage, then resumes", () => {
    const b = battle();
    expect(impact(b)[0].damage).toBeGreaterThan(0);
    const x = b.player.x,
      elapsed = b.player.action!.elapsed;
    b.advance(199, [{ move: 1 }, { move: -1 }]);
    expect(b.player.x).toBe(x);
    expect(b.player.action!.elapsed).toBe(elapsed);
    expect(b.enemy.stun).toBe(0);
    expect(b.enemy.painRemaining).toBeGreaterThan(0);
    b.advance(11, [{ move: 1 }, {}]);
    expect(b.player.action!.elapsed).toBe(elapsed + 10);
    expect(b.player.x).toBeGreaterThan(x);
  });
  it("integrates a partial pause expiry without stacking another pain recovery", () => {
    const b = battle();
    impact(b);
    b.advance(201, [{}, {}]);
    expect(b.enemy.stun).toBe(0);
    expect(b.enemy.bodyCooldown).toBe(0);
    expect(b.enemy.handCooldowns.rear).toBe(0);
    expect(b.canAttack(b.enemy, "quick")).toBe(true);
  });
  it("freezes only the contacting hand of a dual-wielding attacker", () => {
    const b = battle(true);
    impact(b);
    const elapsed = b.player.handActions.rear!.elapsed;
    expect(b.canAttack(b.player, "quick", "front")).toBe(true);
    b.advance(100, [{ attack: "quick", hand: "front" }, {}]);
    expect(b.player.handActions.rear!.elapsed).toBe(elapsed);
    expect(b.player.handActions.front).not.toBeNull();
    b.advance(50, [{}, {}]);
    expect(b.player.handActions.front!.elapsed).toBe(50);
    expect(b.player.handActions.rear!.elapsed).toBe(elapsed);
  });
  it("holds the frozen hand's animation while its other hand animates", () => {
    const b = battle(true),
      motion = new ArenaMotion(b.player.model);
    b.advance(0, [{ attack: "quick" }, {}]);
    b.advance(500, [{}, {}]);
    const before = motion.update(500, b.player);
    b.resolve(contactGeometry);
    b.advance(50, [{ attack: "quick", hand: "front" }, {}]);
    const after = motion.update(50, b.player);
    expect(after.farHandX).toBe(before.farHandX);
    expect(after.farHandY).toBe(before.farHandY);
    b.advance(140, [{}, {}]);
    const next = motion.update(140, b.player);
    expect([next.nearHandX, next.nearHandY]).not.toEqual([
      after.nearHandX,
      after.nearHandY,
    ]);
  });
  it("disables immediately and lets duration change for subsequent contacts", () => {
    const h = new HitStop();
    h.configure(true, 200);
    h.impact("a", "b", "rear", true);
    h.configure(false, 350);
    expect(h.blocked("a", "rear")).toBe(false);
    expect(h.step("b", 10).active).toBe(10);
    h.configure(true, 350);
    h.impact("a", "b", "rear", true);
    expect(h.step("a", 300).hands).toEqual({ rear: 0, front: 300 });
    expect(h.step("a", 100).hands.rear).toBe(50);
  });
  it("retains real-time buff expiry when haste expires inside a hand pause", () => {
    const b = battle(true);
    b.player.speedRemaining = 100;
    b.player.rageRemaining = 500;
    impact(b);
    b.advance(0, [{ attack: "quick", hand: "front" }, {}]);
    b.advance(250, [{}, {}]);
    expect(b.player.speedRemaining).toBe(0);
    expect(b.player.rageRemaining).toBe(250);
    expect(b.player.handActions.rear!.elapsed).toBe(550);
    expect(b.player.handActions.front!.elapsed).toBe(350);
  });
  it("does not pause either actor when armor absorbs all HP damage", () => {
    const b = battle();
    b.enemy.model.skills = [skill.heavyArmor];
    for (const [id, slot] of [
      ["cuirass", "body"],
      ["legionary-helm", "helmet"],
    ] as const) {
      addItem(b.enemy.model, id);
      equip(b.enemy.model, id, slot);
    }
    expect(impact(b)[0].damage).toBe(0);
    expect(b.enemy.hp).toBe(100);
    expect(b.hitStop.blocked(b.player.model.id)).toBe(false);
    expect(b.hitStop.blocked(b.enemy.model.id)).toBe(false);
  });
  it("does not pause on zero damage or a miss", () => {
    const b = battle();
    b.player.model.equipment = {};
    b.player.model.skills = [skill.kick];
    b.advance(0, [{ attack: "kick" }, {}]);
    b.player.bodyAction!.elapsed = 420;
    expect(b.resolve(contactGeometry)).toEqual([]);
    const g = structuredClone(contactGeometry);
    g[0].feet = { front: shape, rear: shape };
    expect(b.resolve(g)[0]).toMatchObject({ kind: "kick", damage: 0 });
    expect(b.hitStop.blocked(b.player.model.id)).toBe(false);
    expect(b.hitStop.blocked(b.enemy.model.id)).toBe(false);
  });
});
describe("attack cadence and launch distance", () => {
  it.each([0, 0.5, 0.999])(
    "samples 1–3 accepted attacks and resets after a skill (rng %s)",
    (random) => {
      const b = battle(),
        c = new SkillCadence(() => random);
      expect(c.threshold).toBe(1 + Math.floor(random * 3));
      for (let i = 0; i < c.threshold; i++) {
        b.player.handActions.rear = {
          id: i + 1,
          name: "quick",
          elapsed: 0,
          duration: 1000,
          hit: false,
          hand: "rear",
        };
        c.observe(b.player);
        c.observe(b.player);
      }
      expect(c.attacks).toBe(c.threshold);
      expect(c.due).toBe(true);
      b.player.handActions.rear = null;
      b.player.bodyAction = {
        id: 100,
        name: "kick",
        elapsed: 0,
        duration: 500,
        hit: false,
        hand: "rear",
      };
      c.observe(b.player);
      expect(c.attacks).toBe(0);
    },
  );
  it("auto battle requests a learned skill after its scheduled normal attacks", () => {
    const b = battle(),
      ai = new ArenaAI(
        () => 1,
        () => 1,
        () => 1,
        () => 0,
      );
    b.player.model.skills = [skill.kick];
    b.enemy.x = b.player.x + 100;
    expect(ai.update(1000, b.player, b.enemy).attack).toBe("quick");
    b.advance(0, [{ attack: "quick" }, {}]);
    ai.update(10, b.player, b.enemy);
    b.player.action = null;
    b.player.handCooldowns.rear = 0;
    expect(ai.update(10, b.player, b.enemy).attack).toBe("kick");
  });
  it("dual-wielding AI leaves a recovery window and uses a skill after 1–3 accepted swings", () => {
    const b = battle(true);
    b.hitStop.configure(false, 200);
    b.player.model.skills!.push(skill.kick);
    b.enemy.x = b.player.x + 100;
    const ai = new ArenaAI(
      () => 0,
      () => 1,
      () => 1,
      () => 0.5,
    );
    const swings = new Set<number>();
    let kicked = false;
    for (let time = 0; time < 6000; time += 10) {
      b.advance(10, [ai.update(10, b.player, b.enemy), {}]);
      for (const a of Object.values(b.player.handActions))
        if (a?.name === "quick") swings.add(a.id);
      if (b.player.bodyAction?.name === "kick") {
        kicked = true;
        break;
      }
    }
    expect(kicked).toBe(true);
    expect(swings.size).toBeGreaterThanOrEqual(1);
    expect(swings.size).toBeLessThanOrEqual(3);
  });
  it("AI creates launch distance when Superman is its only offensive technique", () => {
    const b = battle();
    b.player.model.skills = [skill.superman];
    b.enemy.x = b.player.x + 100;
    const ai = new ArenaAI(
      () => 1,
      () => 1,
      () => 1,
      () => 0,
    );
    ai.cadence.attacks = 1;
    expect(ai.update(10, b.player, b.enemy).move).toBe(-1);
    b.enemy.x = b.player.x + skillBalance.supermanMinDistance;
    expect(ai.update(10, b.player, b.enemy).attack).toBe("superman");
  });
  it("rejects point-blank Superman Punch without consuming an action or cooldown", () => {
    const b = battle();
    b.player.model.skills = [skill.superman];
    b.enemy.x = b.player.x + 80;
    expect(b.canAttack(b.player, "superman")).toBe(false);
    b.advance(0, [{ attack: "superman" }, {}]);
    expect(b.player.action).toBeNull();
    expect(b.player.bodyCooldown).toBe(0);
    b.enemy.x = b.player.x + skillBalance.supermanMinDistance;
    expect(b.canAttack(b.player, "superman")).toBe(true);
  });
});
