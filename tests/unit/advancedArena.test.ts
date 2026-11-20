import { trainedGladiator as createPlayer } from "../fixtures/trained";
import { beforeEach, describe, expect, it } from "vitest";
import live from "../../public/content/items.json";
import { installCatalog, item } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";

import {
  RealtimeBattle,
  fighterSpeed,
  type ArenaInput,
  type CombatProcRandom,
} from "../../src/combat/realtime";
import { ArenaAI } from "../../src/combat/ArenaAI";
import type { CombatGeometry } from "../../src/combat/geometry";
import {
  projectileFloorRadius,
  projectileProfile,
  type Projectile,
} from "../../src/combat/projectiles";
import { twoHandPose } from "../../src/characters/twoHandMotion";
import { combatRest, relaxedRest } from "../../src/characters/locomotion";
import { groundedPose, rotate, add } from "../../src/characters/kinematics";
import { ArenaMotion } from "../../src/characters/ArenaMotion";

beforeEach(() => installCatalog(parseCatalog(live).items));
const cap = { a: { x: 500, y: 300 }, b: { x: 500, y: 320 }, radius: 8 };
const g: CombatGeometry = {
  blade: cap,
  blades: { front: cap, rear: cap },
  body: [cap],
  grips: { front: { x: 580, y: 300 }, rear: { x: 600, y: 300 } },
  hands: { front: cap, rear: cap },
};
const empty: CombatGeometry = { blade: null, body: [] };
function battle(random: CombatProcRandom = {}) {
  const p = createPlayer(),
    e = createPlayer();
  e.id = "enemy";
  const b = new RealtimeBattle(p, e, () => 0.99, {
    disarm: () => 0.99,
    hammerPush: () => 0.99,
    hammerKnockdown: () => 0.99,
    ...random,
  });
  b.player.x = 400;
  b.enemy.x = 900;
  return b;
}
function steps(
  b: RealtimeBattle,
  ms: number,
  commands: [ArenaInput, ArenaInput] = [{}, {}],
) {
  for (let t = 0; t < ms; t += 5) {
    b.advance(Math.min(5, ms - t), commands);
    b.resolve([empty, empty]);
  }
}
function ai(roll = 0.99) {
  const brain = new ArenaAI(
    () => 0.8,
    () => 0.99,
    () => 0.99,
    () => roll,
  );
  brain.cadence.attacks = 3;
  return brain;
}
function drop(b: RealtimeBattle, x: number, id = "rust"): Projectile {
  const def = item(id)!;
  const p: Projectile = {
    id: 100,
    kind: "disarmed",
    ownerId: b.enemy.model.id,
    itemId: id,
    hand: "rear",
    sourceSlot: "rightHand",
    x,
    y: 520,
    vx: 0,
    vy: 0,
    angle: Math.PI / 2,
    spin: 0,
    previous: { x, y: 520, angle: Math.PI / 2 },
    attack: 0,
    floorRadius: projectileFloorRadius(def),
    profile: projectileProfile(def),
    age: 1000,
    state: "landed",
  };
  b.projectiles.push(p);
  return p;
}

it("returns to combat after an interrupted drink instead of retrying every free frame", () => {
  const b = battle();
  b.player.hp = 40;
  b.player.model.inventory.push("healing-potion");
  b.player.model.equipment.belt1 = "healing-potion";
  const brain = ai();
  const command = brain.update(300, b.player, b.enemy);
  expect(command.belt).toBe("belt1");
  b.advance(0, [command, {}]);
  expect(b.player.action?.name).toBe("drink");
  b.player.action = null;
  expect(brain.update(1500, b.player, b.enemy).belt).toBeUndefined();
  expect(brain.update(4500, b.player, b.enemy).belt).toBe("belt1");
  expect(b.player.model.equipment.belt1).toBe("healing-potion");
});

describe("real-time haste", () => {
  it("requires purchased supplies and permits haste at full health", () => {
    expect(createPlayer().inventory).toEqual(["wood"]);
    const b = battle();
    b.player.model.inventory.push("speed-potion");
    b.player.model.equipment.belt1 = "speed-potion";
    expect(b.canUseBelt(b.player, "belt1")).toBe(true);
    b.advance(0, [{ belt: "belt1" }, {}]);
    steps(b, 1150);
    expect(b.player.speedRemaining ?? 0).toBe(0);
    steps(b, 5);
    expect(b.player.speedRemaining).toBe(10000);
    expect(b.player.model.inventory).not.toContain("speed-potion");
    expect(b.consumedItems).toHaveLength(1);
    steps(b, 500);
    expect(b.player.speedRemaining).toBe(9500);
    expect(b.consumedItems).toHaveLength(1);
  });
  it("doubles only the drinker's movement, actions, reload and recovery clocks", () => {
    const b = battle();
    b.player.speedRemaining = 10000;
    b.player.rangedCooldown = b.enemy.rangedCooldown = 1000;
    b.advance(0, [{ attack: "quick" }, { attack: "quick" }]);
    b.advance(250, [{ move: 1 }, { move: -1 }]);
    expect(b.player.action?.elapsed).toBe(500);
    expect(b.enemy.action?.elapsed).toBe(250);
    expect(b.player.rangedCooldown).toBe(500);
    expect(b.enemy.rangedCooldown).toBe(750);
    expect(b.player.vx).toBeCloseTo(154);
    expect(b.enemy.vx).toBeCloseTo(-77);
    expect(b.player.animationDelta).toBe(500);
    const motion = new ArenaMotion(b.player.model);
    b.player.action = null;
    b.advance(10, [{ move: 1 }, {}]);
    motion.update(b.player.animationDelta!, b.player);
    expect(motion.name).toBe("walkForward");
  });
  it("expires at ten real seconds and integrates a partial final boosted step exactly", () => {
    const b = battle();
    b.player.speedRemaining = 100;
    b.advance(150, [{ move: 1 }, {}]);
    expect(b.player.x).toBeCloseTo(427.5);
    expect(b.player.speedRemaining).toBe(0);
    expect(fighterSpeed(b.player)).toBe(1);
    b.advance(100, [{ move: 1 }, {}]);
    expect(b.player.x).toBeCloseTo(438.5);
    b.player.speedRemaining = 10000;
    b.advance(9999, [{}, {}]);
    expect(b.player.speedRemaining).toBe(1);
    b.advance(1, [{}, {}]);
    expect(b.player.speedRemaining).toBe(0);
  });
  it("keeps weapon release, accelerated projectile travel and consumption synchronized", () => {
    const b = battle();
    b.player.speedRemaining = 10000;
    b.advance(0, [{ throws: ["rear"] }, {}]);
    b.advance(260, [{}, {}]);
    b.resolve([g, empty]);
    expect(b.projectiles).toHaveLength(1);
    const p = b.projectiles[0];
    expect(p.timeScale).toBe(2);
    expect(b.consumedItems).toHaveLength(1);
    const x = p.x;
    b.advance(100, [{}, {}]);
    expect(p.x - x).toBeCloseTo(140);
  });
  it("accelerates a bound execution without accelerating the victim or the buff duration", () => {
    const b = battle();
    b.enemy.x = 500;
    b.enemy.knockdown = { phase: "down", elapsed: 0 };
    b.player.speedRemaining = 10000;
    b.advance(0, [{ attack: "finish" }, {}]);
    expect(b.player.finisher?.role).toBe("executor");
    b.advance(339, [{}, {}]);
    expect(b.resolve([empty, empty])).toEqual([]);
    b.advance(1, [{}, {}]);
    expect(b.resolve([empty, empty])[0].damage).toBe(100);
    expect(b.player.speedRemaining).toBe(9660);
  });
});

describe("symmetric advanced AI", () => {
  it("requests parries only once per threat with a 28% decision probability", () => {
    let attempts = 0;
    for (let i = 0; i < 100; i++) {
      const b = battle();
      b.enemy.x = 500;
      b.advance(0, [{ attack: "quick" }, {}]);
      b.advance(400, [{}, {}]);
      const brain = ai(i / 100);
      for (let j = 0; j < 10; j++) {
        if (brain.update(0, b.enemy, b.player).parry) attempts++;
        b.player.action!.elapsed += 10;
      }
    }
    expect(attempts).toBe(28);
  });
  it.each([
    [0, "kick"],
    [0.3, "kick"],
    [0.9, "grapple"],
  ] as const)(
    "chooses and starts a valid close action at roll %s",
    (roll, action) => {
      const b = battle();
      b.enemy.x = 490;
      const input = ai(roll).update(1000, b.enemy, b.player);
      b.advance(0, [{}, input]);
      if (action === "grapple") expect(b.enemy.grapple?.role).toBe("lifter");
      else expect(b.enemy.action?.name).toBe(action);
    },
  );
  it("uses both hop directions, two-handed shoves, finishers and belt items", () => {
    const b = battle();
    b.enemy.x = 650;
    const learned = b.enemy.model.skills;
    b.enemy.model.skills = [];
    expect(ai(0.2).update(1000, b.enemy, b.player).hop).toBe(1);
    b.enemy.model.skills = learned;
    b.enemy.x = 500;
    b.enemy.model.inventory.push("trident");
    b.enemy.model.equipment.rightHand = "trident";
    expect(ai(0.99).update(1000, b.enemy, b.player).attack).toBe("shove");
    b.player.knockdown = { phase: "down", elapsed: 0 };
    expect(ai().update(1000, b.enemy, b.player).attack).toBe("finish");
    b.player.knockdown = null;
    b.enemy.x = 750;
    b.enemy.model.inventory.push("speed-potion");
    b.enemy.model.equipment.belt1 = "speed-potion";
    expect(ai().update(1000, b.enemy, b.player).belt).toBe("belt1");
    b.enemy.model.inventory.push("throwing-knife");
    b.enemy.model.equipment.belt1 = "throwing-knife";
    expect(ai(0.2).update(1000, b.enemy, b.player).belt).toBe("belt1");
  });
  it("allows the opponent to lift and throw the player", () => {
    const b = battle();
    b.enemy.x = 490;
    b.advance(0, [{}, { grapple: true }]);
    steps(b, 1500);
    expect(b.enemy.grapple?.phase).toBe("hold");
    expect(b.player.grapple?.role).toBe("target");
    b.advance(0, [{}, { grapple: true }]);
    steps(b, 180);
    expect(b.player.y).toBeLessThan(0);
    expect(b.player.vx).toBeLessThan(0);
  });
  it("actively runs to its dropped weapon and picks up one copy", () => {
    const b = battle(),
      brain = ai(),
      p = drop(b, 1100);
    const input = brain.update(1000, b.enemy, b.player, b.projectiles);
    expect(input).toMatchObject({ move: 1, run: true });
    expect(brain.recoveryTargetId).toBe(p.id);
    for (let i = 0; i < 150 && p.state !== "pickedUp"; i++)
      b.advance(10, [{}, brain.update(10, b.enemy, b.player, b.projectiles)]);
    expect(p.state).toBe("pickedUp");
    expect(b.enemy.model.equipment.leftHand).toBe("rust");
    expect(b.collectedItems).toHaveLength(1);
  });
  it.each([0, 0.99])(
    "clears an obstructed recovery path using a grapple or kick at roll %s",
    (roll) => {
      const b = battle();
      b.player.x = 600;
      b.enemy.x = 500;
      drop(b, 950);
      const input = ai(roll).update(1000, b.enemy, b.player, b.projectiles);
      expect(input.grapple || input.attack === "kick").toBe(true);
      b.advance(0, [{}, input]);
      expect(
        b.enemy.grapple?.role === "lifter" || b.enemy.action?.name === "kick",
      ).toBe(true);
    },
  );
});

describe("dramatic disarmed drops", () => {
  it.each([0, 0.99])(
    "flings and settles behind either side at roll %s, without damage",
    (roll) => {
      const b = battle({ disarm: () => 0, drop: () => roll });
      b.enemy.x = 500;
      b.player.x = 400;
      b.advance(0, [{}, { attack: "quick" }]);
      b.advance(500, [{ parry: true }, {}]);
      const hit = b.resolve([g, g])[0];
      expect(hit.disarmed).toBe(true);
      const p = b.projectiles[0],
        origin = p.x;
      expect(p.kind).toBe("disarmed");
      expect(Math.abs(p.spin)).toBeGreaterThanOrEqual(8);
      expect(Math.sign(p.vx)).toBe(roll === 0 ? -1 : 1);
      steps(b, 2000);
      expect(p.state).toBe("landed");
      expect((p.x - origin) * (roll === 0 ? -1 : 1)).toBeGreaterThan(100);
      expect(p.x).toBeGreaterThanOrEqual(90);
      expect(p.x).toBeLessThanOrEqual(1190);
      expect(b.player.hp).toBe(100);
    },
  );
});

describe("two-handed thrusting polearm", () => {
  it.each([undefined, "quick", "shove", "finish"])(
    "keeps a 52-unit support grip and fixed bones through %s",
    (action) => {
      for (let i = 0; i <= 400; i++) {
        const p = twoHandPose(combatRest, item("trident")!, action, i / 400),
          s = groundedPose(p);
        expect(s.farArm.clamped).toBe(false);
        expect(s.nearArm.clamped).toBe(false);
        const support = add(
          s.farArm.hand,
          rotate(
            { x: 0, y: -52 },
            s.root.rotation + s.torso + p.farWeaponAngle!,
          ),
        );
        expect(
          Math.hypot(
            support.x - s.nearArm.hand.x,
            support.y - s.nearArm.hand.y,
          ),
          `phase ${i / 400}`,
        ).toBeLessThan(1e-6);
        if (action === "quick") expect(p.farWeaponAngle).toBeGreaterThan(1.4);
      }
      const relaxed = twoHandPose(relaxedRest, item("trident")!);
      expect(relaxed.shoulderCarry).toBe(1);
    },
  );
});
