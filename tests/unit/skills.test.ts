import { beforeEach, describe, it, expect } from "vitest";
import { createPlayer, type Player } from "../../src/domain/model";
import {
  skills,
  activeSkills,
  allSkillIds,
  enemySkills,
  hasSkill,
  canLearn,
  itemRequirements,
  skillBalance,
} from "../../src/domain/skills";
import {
  completeBattle,
  choosePostBattle,
  learnSkill,
  closeShop,
  shopAccess,
  progressionScene,
} from "../../src/domain/postBattle";
import {
  equip,
  equipmentTarget,
  addItem,
  stats,
} from "../../src/domain/progression";
import { serialize, deserialize } from "../../src/persistence/save";
import { Services } from "../../src/app/services";
import { RealtimeBattle, knockdownTiming } from "../../src/combat/realtime";
import { ArenaAI } from "../../src/combat/ArenaAI";
import {
  actionAllowed,
  permittedInput,
  attackRate,
  damageMultiplier,
  resolvedDamage,
} from "../../src/combat/skillRules";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
import { installCatalog, item } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";
import live from "../../public/content/items.json";
import { opponent } from "../../src/domain/opponents";
import type { CombatGeometry } from "../../src/combat/geometry";
beforeEach(() => installCatalog(parseCatalog(live).items));
function grant(p: Player, ...ids: typeof allSkillIds) {
  p.skills = ids;
  return p;
}
function battle(ids: typeof allSkillIds = []) {
  const p = grant(createPlayer(), ...ids),
    e = createPlayer();
  e.id = "enemy";
  return new RealtimeBattle(p, e, () => 0.99, {
    disarm: () => 0.99,
    counter: () => 0,
  });
}
const capsule = (x = 500, y = 400) => ({
  a: { x, y },
  b: { x: x + 12, y: y + 20 },
  radius: 10,
});
const geometry = (): [CombatGeometry, CombatGeometry] => [
  {
    blade: capsule(),
    blades: { rear: capsule(), front: capsule() },
    grips: { rear: { x: 500, y: 400 }, front: { x: 500, y: 400 } },
    shield: capsule(),
    body: [capsule(900)],
    feet: { front: capsule(), rear: capsule() },
  },
  { blade: capsule(900), blades: { rear: capsule(900) }, body: [capsule()] },
];
function hit(b: RealtimeBattle) {
  b.advance(1, [{ attack: "quick" }, {}]);
  b.player.handActions.rear!.elapsed = 500;
  return b.resolve(geometry())[0];
}
describe("skill progression and durable exclusive choices", () => {
  it("new and reset gladiators have no advanced skills or shop access", () => {
    const s = new Services();
    expect(s.player.skills).toEqual([]);
    expect(shopAccess(s.player)).toBe(false);
    s.player.skills = [...allSkillIds];
    s.reset();
    expect(s.player.skills).toEqual([]);
    expect(s.player.postBattle).toBeUndefined();
  });
  it.each(activeSkills())(
    "learns $name once, then unlocks its prerequisite-aware capability",
    (s) => {
      const p = createPlayer();
      if (s.requires) p.skills = [s.requires];
      expect(canLearn(p, s.id)).toBe(true);
      completeBattle(p, "fight", "Victory", "Opponent");
      p.postBattle!.offers = [s.id];
      expect(choosePostBattle(p, "skill")).toBe(true);
      expect(learnSkill(p, s.id)).toBe(true);
      expect(hasSkill(p, s.id)).toBe(true);
      expect(learnSkill(p, s.id)).toBe(false);
      expect(choosePostBattle(p, "shop")).toBe(false);
      expect(progressionScene(p)).toBe("MainMenuScene");
    },
  );
  it("has exactly the two requested prerequisite edges", () => {
    const p = createPlayer();
    expect(
      skills.filter((s) => s.requires).map((s) => [s.id, s.requires]),
    ).toEqual([
      [14, 10],
      [16, 6],
    ]);
    expect(canLearn(p, 14)).toBe(false);
    expect(canLearn(p, 16)).toBe(false);
    expect(canLearn(p, 13)).toBe(true);
  });
  it.each(["Victory", "Defeat", "Draw"] as const)(
    "persists a %s choice and prevents replayed rewards",
    (outcome) => {
      let p = createPlayer();
      const payout = completeBattle(p, "completed", outcome, "Gladiator")!;
      expect(payout.gold).toBe(outcome === "Victory" ? 50 : 10);
      p = deserialize(serialize(p));
      expect(progressionScene(p)).toBe("ResultScene");
      expect(completeBattle(p, "completed", outcome, "Gladiator")).toBeNull();
      expect(choosePostBattle(p, "shop")).toBe(true);
      p = deserialize(serialize(p));
      expect(progressionScene(p)).toBe("ShopScene");
      expect(choosePostBattle(p, "skill")).toBe(false);
      expect(learnSkill(p, 3)).toBe(false);
      expect(closeShop(p)).toBe(true);
      expect(closeShop(p)).toBe(false);
      expect(progressionScene(deserialize(serialize(p)))).toBe("MainMenuScene");
      expect(p.rewarded).toEqual(["completed"]);
    },
  );
  it("resumes unfinished training and grants exactly one skill", () => {
    let p = createPlayer();
    completeBattle(p, "lost", "Defeat", "Opponent");
    p.postBattle!.offers = [3, 4];
    choosePostBattle(p, "skill");
    p = deserialize(serialize(p));
    expect(progressionScene(p)).toBe("SkillScene");
    expect(learnSkill(p, 14)).toBe(false);
    expect(learnSkill(p, 3)).toBe(true);
    p = deserialize(serialize(p));
    expect(p.skills).toEqual([3]);
    expect(learnSkill(p, 4)).toBe(false);
  });
  it("only permits the shop after all active skills", () => {
    const p = grant(createPlayer(), ...allSkillIds);
    completeBattle(p, "last", "Victory", "Opponent");
    expect(choosePostBattle(p, "skill")).toBe(false);
    expect(choosePostBattle(p, "shop")).toBe(true);
  });
  it("migrates old saves explicitly without losing owned gear, money or progress", () => {
    const p = grant(createPlayer(), ...allSkillIds);
    p.gold = 327;
    p.progress = 8;
    addItem(p, "crossbow");
    addItem(p, "iron");
    p.equipment = { rightHand: "crossbow" };
    const migrated = deserialize(JSON.stringify({ version: 3, player: p }));
    expect(migrated.skills).toEqual([]);
    expect(migrated.inventory).toEqual(p.inventory);
    expect(migrated.equipment.rightHand).toBeUndefined();
    expect(migrated.gold).toBe(327);
    expect(migrated.progress).toBe(8);
    expect(JSON.parse(serialize(migrated)).version).toBe(4);
  });
  it("rejects forged prerequisite and decision states", () => {
    const p = createPlayer();
    p.skills = [14];
    expect(deserialize(serialize(p)).skills).toEqual([]);
    p.skills = [];
    completeBattle(p, "real", "Victory", "Opponent");
    p.postBattle!.consumed = true;
    expect(deserialize(serialize(p)).postBattle).toBeUndefined();
  });
});
describe("equipment and action eligibility", () => {
  it("keeps the starter sword usable, replaces it without Dual Wielding, and gates all advanced equipment", () => {
    const p = createPlayer();
    for (const id of [
      "rust",
      "greatsword",
      "crossbow",
      "shield",
      "healing-potion",
      "throwing-knife",
    ])
      addItem(p, id);
    expect(actionAllowed(p, "quick")).toBe(true);
    expect(equip(p, "rust", "leftHand")).toBe(false);
    expect(equipmentTarget(p, "rust", "leftHand")).toBe("rightHand");
    expect(equip(p, "greatsword", "rightHand")).toBe(false);
    expect(equip(p, "crossbow", "rightHand")).toBe(false);
    expect(equip(p, "shield", "leftHand")).toBe(false);
    expect(equip(p, "healing-potion", "belt1")).toBe(false);
    expect(equip(p, "throwing-knife", "belt1")).toBe(false);
    p.skills = [8];
    expect(equip(p, "crossbow", "rightHand")).toBe(true);
    expect(p.skills).not.toContain(2);
  });
  it("learned skills enable matching equipment without inventing prerequisites", () => {
    const p = grant(createPlayer(), ...enemySkills);
    for (const id of [
      "rust",
      "greatsword",
      "crossbow",
      "shield",
      "healing-potion",
      "throwing-knife",
    ])
      addItem(p, id);
    expect(equip(p, "rust", "leftHand")).toBe(true);
    expect(equip(p, "greatsword", "rightHand")).toBe(true);
    expect(p.equipment.leftHand).toBeUndefined();
    expect(equip(p, "crossbow", "rightHand")).toBe(true);
    expect(equip(p, "shield", "rightHand")).toBe(true);
    expect(p.equipment.rightHand).toBe("shield");
    expect(equip(p, "healing-potion", "belt1")).toBe(true);
    expect(equip(p, "throwing-knife", "belt2")).toBe(true);
    expect(stats(p).armor).toBe(item("shield")!.armor);
  });
  it.each([
    ["kick", 3],
    ["grapple", 4],
    ["finish", 5],
    ["parry", 6],
    ["throw", 7],
    ["drink", 9],
    ["rage", 11],
    ["superman", 13],
  ] as const)("gates %s in centralized rules", (action, id) => {
    const p = createPlayer();
    expect(actionAllowed(p, action)).toBe(false);
    p.skills = [id];
    expect(actionAllowed(p, action)).toBe(true);
  });
  it("gates future potions and throwable definitions by functionality", () => {
    expect(
      itemRequirements({ ...item("healing-potion")!, id: "future-potion" }),
    ).toEqual([9]);
    expect(
      itemRequirements({ ...item("throwing-knife")!, id: "future-projectile" }),
    ).toEqual([7]);
  });
  it("engine refuses locked inputs even when a caller bypasses the UI", () => {
    const b = battle();
    b.advance(10, [
      {
        attack: "kick",
        parry: true,
        grapple: true,
        throws: ["rear"],
        rage: true,
      },
      {},
    ]);
    expect(b.player.action).toBeNull();
    expect(b.player.parry).toBeNull();
    expect(b.player.grapple).toBeUndefined();
    expect(b.player.rageUsed).not.toBe(true);
    expect(b.canParry(b.player)).toBe(false);
    expect(b.canGrapple()).toBe(false);
    b.advance(10, [{ attack: "quick" }, {}]);
    expect(b.player.action?.name).toBe("quick");
  });
  it("AI and enemies both respect their assigned skill budget", () => {
    const b = battle(),
      ai = new ArenaAI(
        () => 0,
        () => 0,
        () => 0,
        () => 0,
      );
    b.player.x = 500;
    b.enemy.x = 580;
    for (let n = 0; n < 200; n++) {
      const command = ai.update(20, b.player, b.enemy);
      expect(permittedInput(b.player.model, command)).toEqual(command);
      expect(command.attack).not.toBe("kick");
      expect(command.grapple).not.toBe(true);
      expect(command.parry).not.toBe(true);
      b.advance(20, [command, {}]);
    }
    expect(b.enemy.model.skills).toEqual([]);
    expect(actionAllowed(b.enemy.model, "kick")).toBe(false);
    expect(actionAllowed(opponent(createPlayer()), "grapple")).toBe(false);
  });
  it("dual hand attacks remain independent when learned", () => {
    const b = battle([1]);
    addItem(b.player.model, "rust");
    equip(b.player.model, "rust", "leftHand");
    b.advance(10, [{ attacks: ["front", "rear"] }, {}]);
    expect(b.player.handActions.front).toBeTruthy();
    expect(b.player.handActions.rear).toBeTruthy();
  });
});
describe("new physical skill mechanics", () => {
  it("rage lasts eight real combat seconds, boosts damage and speed, reduces armor, and cannot repeat", () => {
    const b = battle([11, 18]);
    b.advance(10, [{ rage: true }, {}]);
    expect(b.player.rageRemaining).toBe(8000);
    expect(attackRate(b.player)).toBe(1.3);
    expect(damageMultiplier(b.player)).toBe(1.2);
    addItem(b.player.model, "cuirass");
    equip(b.player.model, "cuirass", "body");
    expect(resolvedDamage(20, b.player)).toBe(
      Math.round(20 - item("cuirass")!.armor * 0.75),
    );
    b.advance(8000, [{}, {}]);
    expect(b.player.rageRemaining).toBe(0);
    b.advance(10, [{ rage: true }, {}]);
    expect(b.player.rageRemaining).toBe(0);
  });
  it("berserker scales only below half health", () => {
    const b = battle([15]);
    expect(attackRate(b.player)).toBe(1);
    b.player.hp = 25;
    expect(attackRate(b.player)).toBeCloseTo(1.125);
    expect(damageMultiplier(b.player)).toBeCloseTo(1.15);
    b.player.hp = 1;
    expect(damageMultiplier(b.player)).toBeGreaterThan(1.29);
  });
  it("Second Wind heals 30 HP once and never converts an execution into a nonfatal hit", () => {
    const b = battle();
    b.enemy.model.skills = [17];
    b.enemy.hp = 25;
    expect(hit(b).damage).toBe(13);
    expect(b.enemy.hp).toBe(42);
    expect(b.enemy.secondWindUsed).toBe(true);
    b.player.action = null;
    b.player.handCooldowns.rear = 0;
    b.enemy.hp = 25;
    hit(b);
    expect(b.enemy.hp).toBe(12);
  });
  it("Superman Punch launches forward, physically hits for +40%, and leaves recovery", () => {
    const b = battle([13]);
    b.advance(10, [{ attack: "superman" }, {}]);
    expect(b.player.y).toBeLessThan(0);
    expect(b.player.vx).toBeGreaterThan(300);
    b.player.bodyAction!.elapsed = 600;
    const e = b.resolve(geometry())[0];
    expect(e.damage).toBe(Math.round(13 * 1.4));
    expect(e.kind).toBe("weapon");
    b.advance(1300, [{}, {}]);
    expect(b.player.bodyCooldown).toBe(skillBalance.supermanRecovery);
  });
  it("Kip-Up uses a jumping pose and completes in 500ms while unlearned recovery stays slow", () => {
    for (const learned of [false, true]) {
      const b = battle(learned ? [12] : []);
      b.player.knockdown = { phase: "getUp", elapsed: 0 };
      const motion = new ArenaMotion(b.player.model);
      b.advance(250, [{}, {}]);
      const pose = motion.update(250, b.player);
      expect(motion.name).toBe(learned ? "kipUp" : "getUp");
      expect(Number.isFinite(pose.rootY)).toBe(true);
      b.advance(250, [{}, {}]);
      expect(Boolean(b.player.knockdown)).toBe(!learned);
      if (!learned) {
        b.advance(knockdownTiming.getUp - 500, [{}, {}]);
        expect(b.player.knockdown).toBeNull();
      }
    }
  });
  it("a rear-hand shield supplies passive armor without interception", () => {
    const b = battle([10]);
    addItem(b.player.model, "shield");
    equip(b.player.model, "shield", "rightHand");
    b.player.x = 500;
    b.enemy.x = 600;
    b.player.facing = 1;
    b.enemy.facing = -1;
    b.advance(1, [{ guard: true }, { attack: "quick" }]);
    b.enemy.handActions.rear!.elapsed = 500;
    const g = geometry();
    g[0].body = [capsule()];
    g[0].shield = capsule();
    g[1].blade = capsule();
    g[1].blades = { rear: capsule() };
    const e = b.resolve(g)[0];
    expect(e.shieldBlocked).toBe(false);
    expect(e.damage).toBe(item("wood")!.attack - item("shield")!.armor);
    expect(b.player.hp).toBe(100 - e.damage);
    expect(stats(b.player.model).armor).toBe(item("shield")!.armor);
  });
  it("passive shields cannot block or bash even with the dormant skill learned", () => {
    const b = battle([10, 14]);
    addItem(b.player.model, "shield");
    equip(b.player.model, "shield", "rightHand");
    b.advance(1, [{ attack: "bash", hand: "rear", guard: true }, {}]);
    expect(b.player.bodyAction).toBeNull();
    expect(b.player.guard).toBe(false);
    expect(b.player.bashCooldown ?? 0).toBe(0);
  });
  it("a successful learned parry launches a rolled physical counterstrike instead of its shove", () => {
    const b = battle([6, 16]);
    b.player.x = 500;
    b.enemy.x = 580;
    b.advance(1, [{ parry: true }, { attack: "quick" }]);
    b.enemy.handActions.rear!.elapsed = 500;
    const g = geometry();
    g[0].body = [capsule()];
    g[1].blade = capsule();
    g[1].blades = { rear: capsule() };
    expect(b.resolve(g)[0].parried).toBe(true);
    b.advance(150, [{}, {}]);
    expect(b.player.handActions.rear?.name).toBe("counter");
    expect(b.enemy.pushVx).toBe(0);
    b.player.handActions.rear!.elapsed = 200;
    g[0].blade = capsule(700);
    g[0].blades = { rear: capsule(700) };
    g[1].body = [capsule(700)];
    expect(
      b
        .resolve(g)
        .some((e) => e.attackerId === b.player.model.id && e.damage > 0),
    ).toBe(true);
  });
});
it("both hand inputs address the same reserved two-handed weapon without Dual Wielding", () => {
  const b = battle([2]);
  addItem(b.player.model, "greatsword");
  equip(b.player.model, "greatsword", "rightHand");
  b.advance(10, [{ attacks: ["front"] }, {}]);
  expect(b.player.handActions.rear?.name).toBe("quick");
  expect(b.player.handActions.front).toBeNull();
});
it.each(["greatsword", "crossbow"])(
  "counterstrikes preserve the actual %s weapon mechanics",
  (weapon) => {
    const b = battle([2, 8, 6, 16]);
    addItem(b.player.model, weapon);
    equip(b.player.model, weapon, "rightHand");
    b.player.x = 500;
    b.enemy.x = 580;
    b.advance(1, [{ parry: true }, { attack: "quick" }]);
    b.enemy.handActions.rear!.elapsed = 500;
    const g = geometry();
    g[0].body = [capsule()];
    g[1].blade = capsule();
    g[1].blades = { rear: capsule() };
    expect(b.resolve(g)[0].parried).toBe(true);
    b.advance(150, [{}, {}]);
    expect(b.player.handActions.rear?.name).toBe("counter");
    const motion = new ArenaMotion(b.player.model);
    const pose = motion.update(0, b.player);
    expect(Math.max(pose.twoHanded ?? 0, pose.rangedHold ?? 0)).toBeGreaterThan(
      0.5,
    );
    if (weapon === "crossbow") {
      b.player.handActions.rear!.elapsed = 200;
      g[0].muzzles = { rear: { x: 500, y: 400 } };
      b.resolve(g);
      expect(b.projectiles.some((p) => p.kind === "bolt")).toBe(true);
    }
  },
);
it("a shield cannot block a rear strike or a blade that misses its surface", () => {
  for (const rear of [false, true]) {
    const b = battle([10]);
    addItem(b.player.model, "shield");
    equip(b.player.model, "shield", "rightHand");
    b.advance(1, [{ guard: true }, { attack: "quick" }]);
    b.player.x = 500;
    b.enemy.x = rear ? 400 : 600;
    b.player.facing = 1;
    b.enemy.handActions.rear!.elapsed = 500;
    const g = geometry();
    g[0].body = [capsule()];
    g[0].shield = rear ? capsule() : capsule(100);
    g[1].blade = capsule();
    g[1].blades = { rear: capsule() };
    const e = b.resolve(g)[0];
    expect(e.shieldBlocked).not.toBe(true);
    expect(e.damage).toBeGreaterThan(0);
  }
});
it("basic gladiators cannot shoot and counterstrikes cannot be requested manually", () => {
  const b = battle();
  expect(actionAllowed(b.player.model, "shoot")).toBe(false);
  b.player.model.skills = [8];
  expect(actionAllowed(b.player.model, "shoot")).toBe(false);
  b.player.model.skills = [6, 16];
  b.advance(10, [{ attack: "counter" }, {}]);
  expect(b.player.action).toBeNull();
});
it("Second Wind cannot rescue a bound execution", () => {
  const b = battle([5]);
  b.enemy.model.skills = [17];
  b.player.x = 500;
  b.enemy.x = 590;
  b.enemy.knockdown = { phase: "down", elapsed: 990 };
  b.advance(0, [{ attack: "finish" }, {}]);
  expect(b.player.finisher?.role).toBe("executor");
  for (let t = 0; t < 700; t += 10) b.advance(10, [{}, {}]);
  const empty: CombatGeometry = { blade: null, body: [] };
  expect(b.resolve([empty, empty])[0].kind).toBe("finisher");
  expect(b.enemy.hp).toBe(0);
  expect(b.enemy.secondWindUsed).not.toBe(true);
  expect(b.state).toBe("Victory");
});
it("Battle Rage accelerates the real crossbow reload as well as its firing clip", () => {
  const b = battle([8, 11]);
  addItem(b.player.model, "crossbow");
  equip(b.player.model, "crossbow", "rightHand");
  b.advance(1, [{ rage: true, attack: "quick" }, {}]);
  expect(b.player.handActions.rear!.duration).toBeCloseTo(2600 / 1.3);
  b.player.handActions.rear!.elapsed = 500;
  const g = geometry();
  g[0].muzzles = { rear: { x: 500, y: 300 } };
  b.resolve(g);
  expect(b.projectiles.some((p) => p.kind === "bolt")).toBe(true);
  expect(b.player.rangedCooldown).toBeCloseTo(2080 / 1.3);
});
it("a learned counter follows a real bolt deflection without remotely stunning its shooter", () => {
  const b = battle([6, 16]);
  b.advance(1, [{ parry: true }, {}]);
  b.projectiles.push({
    id: 99,
    sourceSlot: "rightHand",
    kind: "bolt",
    ownerId: b.enemy.model.id,
    itemId: "crossbow",
    hand: "rear",
    x: 500,
    y: 400,
    vx: -500,
    vy: 0,
    angle: 0,
    spin: 0,
    previous: { x: 510, y: 400, angle: 0 },
    attack: 23,
    profile: { startY: -20, endY: 10, radius: 2 },
    floorRadius: 4,
    age: 20,
    state: "flying",
  });
  const event = b.resolve(geometry())[0];
  expect(event.deflected).toBe(true);
  expect(b.enemy.stun).toBe(0);
  for (let t = 0; t < 450; t += 10) b.advance(10, [{}, {}]);
  expect(b.player.handActions.rear?.name).toBe("counter");
  expect(b.enemy.stun).toBe(0);
});
it("zero-damage contact does not consume Second Wind", () => {
  const b = battle([3]);
  b.enemy.model.skills = [17];
  b.enemy.hp = 15;
  b.advance(1, [{ attack: "kick" }, {}]);
  b.player.bodyAction!.elapsed = 450;
  expect(b.resolve(geometry())[0].damage).toBe(0);
  expect(b.enemy.hp).toBe(15);
  expect(b.enemy.secondWindUsed).not.toBe(true);
});
it("a successful two-handed riposte can interrupt the previous attack's recovery", () => {
  const b = battle([2, 6, 16]);
  addItem(b.player.model, "greatsword");
  equip(b.player.model, "greatsword", "rightHand");
  b.player.handCooldowns.front =
    b.player.handCooldowns.rear =
    b.player.bodyCooldown =
      400;
  b.player.x = 500;
  b.enemy.x = 580;
  b.advance(1, [{ parry: true }, { attack: "quick" }]);
  b.enemy.handActions.rear!.elapsed = 500;
  const g = geometry();
  g[0].body = [capsule()];
  g[1].blade = capsule();
  g[1].blades = { rear: capsule() };
  expect(b.resolve(g)[0].parried).toBe(true);
  b.advance(150, [{}, {}]);
  expect(b.player.handActions.rear?.name).toBe("counter");
});
