import { beforeEach, describe, expect, it } from "vitest";
import live from "../../public/content/items.json";
import { parseCatalog } from "../../src/content/schema";
import { installCatalog, item } from "../../src/data/catalog";
import {
  bosses,
  bossAt,
  createBoss,
  ladderEntries,
} from "../../src/domain/ladder";
import { createPlayer } from "../../src/domain/model";
import {
  opponent,
  opponentName,
  stats,
  quantity,
} from "../../src/domain/progression";
import { RealtimeBattle, attackTimings } from "../../src/combat/realtime";
import { ArenaAI } from "../../src/combat/ArenaAI";
import { aimedVelocity, aimAtFighter, rangedPitch } from "../../src/combat/aim";
import {
  advanceProjectile,
  deflectBolt,
  type Projectile,
} from "../../src/combat/projectiles";
import { crossbowPose } from "../../src/characters/crossbowMotion";
import { combatRest } from "../../src/characters/locomotion";
import { groundedPose, rotate, add } from "../../src/characters/kinematics";
import type { CombatGeometry } from "../../src/combat/geometry";

beforeEach(() => installCatalog(parseCatalog(live).items));
describe("eighteen-fight arena ladder", () => {
  it("places one fixed boss after each group of five opponents", () => {
    expect(ladderEntries(0)).toHaveLength(18);
    expect(
      ladderEntries(0)
        .filter((e) => e.boss)
        .map((e) => e.index),
    ).toEqual([5, 11, 17]);
    expect(ladderEntries(6).filter((e) => e.state === "defeated")).toHaveLength(
      6,
    );
    expect(ladderEntries(6).find((e) => e.state === "current")?.index).toBe(6);
    expect(ladderEntries(18).every((e) => e.state === "defeated")).toBe(true);
    expect(bossAt(23)).toBeUndefined();
  });
  it.each([5, 11, 17])(
    "spawns the named fixed encounter after %s wins regardless of spawn RNG",
    (wins) => {
      const p = createPlayer();
      p.progress = wins;
      const boss = bossAt(wins)!;
      expect(opponent(p, () => 0)).toEqual(opponent(p, () => 0.99));
      const enemy = opponent(p);
      expect(enemy.name).toBe(boss.name);
      expect(opponentName(wins)).toBe(boss.name);
      expect(enemy.equipment).toEqual(boss.equipment);
      expect(enemy.combatProfile?.size).toBeGreaterThanOrEqual(1.2);
      expect(enemy.combatProfile?.size).toBeLessThanOrEqual(1.3);
      for (const id of Object.values(enemy.equipment))
        expect(quantity(enemy, id!)).toBeGreaterThan(0);
      expect(stats(enemy).hp).toBe(boss.profile.maxHealth);
      expect(enemy.equipment.belt1).toBeTruthy();
      expect(enemy.equipment.belt2).toBeTruthy();
    },
  );
  it("keeps ordinary opponents and exhibitions outside boss rounds", () => {
    const p = createPlayer();
    for (const progress of [0, 4, 6, 10, 12, 16, 18, 30]) {
      p.progress = progress;
      expect(opponent(p).combatProfile).toBeUndefined();
    }
  });
  it("applies attack and movement specialties independently and composes with haste", () => {
    const fast = new RealtimeBattle(createPlayer(), createBoss(bosses[0], 5));
    fast.advance(0, [{}, { attack: "quick" }]);
    expect(fast.enemy.action!.duration).toBe(
      attackTimings.quick.duration / 1.25,
    );
    const mobile = new RealtimeBattle(
      createPlayer(),
      createBoss(bosses[2], 17),
    );
    mobile.enemy.speedRemaining = 10000;
    const x = mobile.enemy.x;
    mobile.advance(100, [{}, { move: -1, run: true }]);
    expect(x - mobile.enemy.x).toBeCloseTo(200 * 1.3 * 0.2);
    expect(mobile.enemy.speedRemaining).toBe(9900);
    expect(mobile.player.timeScale).toBe(1);
  });
  it.each([0, 1, 2])("lets boss %s actively choose its belt gear", (index) => {
    const enemy = createBoss(bosses[index], index * 6 + 5);
    const b = new RealtimeBattle(createPlayer(), enemy);
    b.enemy.hp = stats(enemy).hp * 0.5;
    const ai = new ArenaAI(
      () => 0.99,
      () => 0.99,
      () => 0.99,
      () => 0.1,
    );
    const choice = ai.update(500, b.enemy, b.player);
    expect(choice.belt).toBe(index === 2 ? "belt1" : "belt2");
    b.advance(0, [{}, choice]);
    expect(b.enemy.action?.name).toBe("drink");
    b.advance(1155, [{}, {}]);
    b.resolve([
      { blade: null, body: [] },
      { blade: null, body: [] },
    ]);
    expect(b.enemy.model.equipment[choice.belt!]).toBeUndefined();
    if (index === 2) expect(b.enemy.speedRemaining).toBe(10000);
    else expect(b.enemy.hp).toBeCloseTo(stats(enemy).hp * 0.5 + 35);
  });
});

it.each([
  [1, 1.3, 1],
  [1.3, 1, 1],
  [1, 1.3, -1],
  [1.3, 1, -1],
])(
  "keeps scaled carry sockets attached at a wall (%s, %s, %s)",
  (aSize, bSize, direction) => {
    const p = createPlayer(),
      e = createPlayer();
    e.id = "enemy";
    p.combatProfile = { ...bosses[1].profile, size: aSize, movement: 1 };
    e.combatProfile = { ...bosses[1].profile, size: bSize };
    const b = new RealtimeBattle(p, e);
    b.player.x = 500;
    b.enemy.x = 590;
    b.advance(0, [{ grapple: true }, {}]);
    b.advance(420, [{}, {}]);
    b.advance(1000, [{}, {}]);
    expect(b.player.grapple?.phase).toBe("hold");
    expect(b.enemy.y).toBeCloseTo(-285 * aSize);
    b.advance(20000, [{ move: direction }, {}]);
    expect(b.enemy.x - b.player.x).toBeCloseTo(
      direction * (130 * bSize - 18 * aSize),
    );
    expect(b.enemy.x).toBeGreaterThanOrEqual(90);
    expect(b.enemy.x).toBeLessThanOrEqual(1190);
  },
);

describe("mouse-directed crossbow shots", () => {
  it.each([
    [1, -1],
    [1, 1],
    [-1, -1],
    [-1, 1],
  ] as const)(
    "preserves a world hop when aiming reverses facing (%s, %s)",
    (facing, direction) => {
      const p = createPlayer();
      p.inventory.push("crossbow");
      p.equipment = { rightHand: "crossbow" };
      const e = createPlayer();
      e.id = "enemy";
      const b = new RealtimeBattle(p, e);
      b.player.x = 600;
      b.player.facing = facing;
      b.enemy.x = 1100;
      b.advance(0, [
        {
          aim: { x: 600 - facing * 300, y: 400 },
          hop: (direction * facing) as -1 | 1,
          worldHop: direction,
        },
        {},
      ]);
      expect(b.player.facing).toBe(-facing);
      expect(b.player.hop?.direction).toBe(direction);
      expect(b.player.hop?.kind).toBe(
        direction === b.player.facing ? "forwardHop" : "backstep",
      );
      b.advance(350, [{}, {}]);
      expect((b.player.x - 600) * direction).toBeGreaterThan(0);
    },
  );
  it.each([
    [900, 500],
    [200, 500],
    [600, 200],
    [501, 540],
  ])("compensates gravity and reaches %s,%s", (x, y) => {
    const origin = { x: 500, y: 350 },
      target = { x, y };
    const velocity = aimedVelocity(origin, target);
    const time = Math.abs(x - origin.x) > 0 ? (x - origin.x) / velocity.vx : 0;
    expect(Math.hypot(velocity.vx, velocity.vy)).toBeCloseTo(1150, 5);
    expect(origin.x + velocity.vx * time).toBeCloseTo(x, 5);
    expect(origin.y + velocity.vy * time + 110 * time * time).toBeCloseTo(y, 5);
  });
  it("aims the actual bolt from its rendered muzzle and can hit a grounded opponent", () => {
    const p = createPlayer();
    p.inventory.push("crossbow");
    p.equipment = { rightHand: "crossbow" };
    const e = createPlayer();
    e.id = "enemy";
    const b = new RealtimeBattle(p, e);
    b.enemy.x = 850;
    b.enemy.knockdown = { phase: "down", elapsed: 0 };
    const target = { x: 850, y: 515 },
      origin = { x: 520, y: 350 };
    b.advance(0, [{ aim: target, attack: "quick" }, {}]);
    b.advance(520, [{ aim: target }, {}]);
    const empty: CombatGeometry = { blade: null, body: [] };
    const g = { ...empty, muzzles: { rear: origin } };
    b.resolve([g, empty]);
    const bolt = b.projectiles[0];
    expect(bolt.vy).toBeGreaterThan(0);
    const time = (target.x - origin.x) / bolt.vx;
    advanceProjectile(bolt, time * 1000, 551);
    const body = { a: { x: 820, y: 515 }, b: { x: 880, y: 515 }, radius: 15 };
    b.resolve([g, { ...empty, body: [body] }]);
    expect(b.enemy.hp).toBeLessThan(100);
    expect(bolt.state).toBe("spent");
    expect(b.enemy.knockdown?.phase).toBe("down");
  });
  it("lets ranged AI target a downed body and turns toward a target behind the shooter", () => {
    const b = new RealtimeBattle(createPlayer(), createBoss(bosses[2], 17));
    b.player.knockdown = { phase: "down", elapsed: 0 };
    const ai = new ArenaAI(
      () => 0.99,
      () => 0.99,
      () => 0.99,
      () => 0.99,
    );
    expect(ai.update(0, b.enemy, b.player).aim).toEqual(aimAtFighter(b.player));
    b.advance(0, [{}, { aim: { x: 1100, y: 510 }, attack: "quick" }]);
    expect(b.enemy.facing).toBe(1);
    expect(rangedPitch(b.enemy)).toBeGreaterThan(0);
  });
  it("preserves fixed arm lengths and the support grip while aiming up or down", () => {
    for (let pitch = -1.5; pitch <= 1.5; pitch += 0.1) {
      const p = crossbowPose(combatRest, 0.2, true, pitch),
        solved = groundedPose(p);
      const support = rotate(
        { x: 5, y: -44 },
        p.farWeaponAngle! + solved.root.rotation + solved.torso,
      );
      const expected = add(solved.farArm.hand, support);
      expect(solved.nearArm.hand.x).toBeCloseTo(expected.x, 4);
      expect(solved.nearArm.hand.y).toBeCloseTo(expected.y, 4);
      for (const arm of [solved.farArm, solved.nearArm]) {
        expect(
          Math.hypot(
            arm.elbow.x - arm.shoulder.x,
            arm.elbow.y - arm.shoulder.y,
          ),
        ).toBeCloseTo(40, 4);
        expect(
          Math.hypot(arm.hand.x - arm.elbow.x, arm.hand.y - arm.elbow.y),
        ).toBeCloseTo(34, 4);
      }
    }
  });
});

function bolt(): Projectile {
  return {
    id: 100,
    kind: "bolt",
    ownerId: "enemy",
    itemId: "crossbow",
    hand: "rear",
    sourceSlot: "rightHand",
    x: 480,
    y: 340,
    vx: -1150,
    vy: 0,
    angle: -Math.PI / 2,
    previous: { x: 600, y: 340, angle: -Math.PI / 2 },
    spin: 0,
    attack: 25,
    age: 100,
    floorRadius: 4,
    profile: { startY: -34, endY: 12, radius: 2 },
    state: "flying",
  };
}
function parryBattle(age = 0) {
  const e = createPlayer();
  e.id = "enemy";
  const b = new RealtimeBattle(createPlayer(), e, () => 0.99, {
    deflect: () => 0,
  });
  b.player.x = 450;
  b.enemy.x = 900;
  b.advance(0, [{ parry: true }, {}]);
  b.advance(age, [{}, {}]);
  b.projectiles.push(bolt());
  const guard = { a: { x: 500, y: 310 }, b: { x: 500, y: 380 }, radius: 7 };
  const body = { a: { x: 455, y: 320 }, b: { x: 455, y: 370 }, radius: 16 };
  const g: CombatGeometry = {
    blade: guard,
    blades: { rear: guard },
    body: [body],
  };
  const other: CombatGeometry = {
    blade: null,
    body: [{ a: { x: 900, y: 320 }, b: { x: 900, y: 380 }, radius: 20 }],
  };
  return { b, g, other };
}
describe("physical bolt deflection", () => {
  it("reflects a bolt off the weapon during the parry window without a remote stun, shove or inventory change", () => {
    const { b, g, other } = parryBattle();
    const events = b.resolve([g, other]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      deflected: true,
      parried: true,
      damage: 0,
    });
    expect(b.projectiles[0]).toMatchObject({
      ownerId: b.player.model.id,
      state: "flying",
      vx: 1150,
    });
    expect(b.enemy.stun).toBe(0);
    expect(b.player.parry?.succeeded).toBe(false);
    expect(b.consumedItems).toHaveLength(0);
    b.advance(310, [{}, {}]);
    b.resolve([g, other]);
    expect(b.enemy.hp).toBeLessThan(100);
    expect(b.player.hp).toBe(100);
    expect(b.projectiles[0].state).toBe("spent");
  });
  it("allows the physical shaft or hilt to deflect without awarding shaft damage", () => {
    const { b, g, other } = parryBattle();
    g.parries = [g.blade!];
    g.blade = null;
    g.blades = {};
    expect(b.resolve([g, other])[0].deflected).toBe(true);
    expect(b.enemy.hp).toBe(100);
    expect(b.player.hp).toBe(100);
  });
  it("requires both the timing window and real weapon contact", () => {
    for (const late of [false, true]) {
      const { b, g, other } = parryBattle(late ? 140 : 0);
      if (!late) {
        g.blade = null;
        g.blades = {};
      }
      const events = b.resolve([g, other]);
      expect(events.some((e) => e.deflected)).toBe(false);
      expect(b.player.hp).toBeLessThan(100);
      expect(b.projectiles[0].state).toBe("spent");
    }
  });
  it.each([0, 0.25, 0.5, 0.75])(
    "uses random direction %s, retaining speed and resetting the sweep",
    (roll) => {
      const p = bolt();
      deflectBolt(p, { x: 500, y: 340 }, "wanderer", () => roll);
      expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(1150);
      expect(p.previous).toEqual({ x: p.x, y: p.y, angle: p.angle });
      expect(p.vx).toBeCloseTo(Math.cos(roll * Math.PI * 2) * 1150);
      expect(p.vy).toBeCloseTo(Math.sin(roll * Math.PI * 2) * 1150);
    },
  );
  it("does not turn a thrown weapon into a deflected arrow", () => {
    const { b, g, other } = parryBattle();
    b.projectiles[0].kind = undefined;
    b.projectiles[0].itemId = item("wood")!.id;
    expect(b.resolve([g, other])[0].deflected).toBeUndefined();
    expect(b.player.hp).toBeLessThan(100);
  });
});
