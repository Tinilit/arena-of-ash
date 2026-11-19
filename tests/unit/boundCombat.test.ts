import { beforeEach, expect, it } from "vitest";
import live from "../../public/content/items.json";
import { installCatalog } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";
import { createPlayer } from "../../src/domain/model";
import { RealtimeBattle, arenaRules } from "../../src/combat/realtime";
import { crossbowPose } from "../../src/characters/crossbowMotion";
import { groundedPose } from "../../src/characters/kinematics";
import { combatRest, relaxedRest } from "../../src/characters/locomotion";
import type { CombatGeometry } from "../../src/combat/geometry";
beforeEach(() => installCatalog(parseCatalog(live).items));
function make(weapon = "wood") {
  const p = createPlayer();
  if (!p.inventory.includes(weapon)) p.inventory.push(weapon);
  p.equipment = { rightHand: weapon };
  const e = createPlayer();
  e.id = "enemy";
  const b = new RealtimeBattle(p, e);
  b.player.x = 500;
  b.enemy.x = 590;
  return b;
}
function step(
  b: RealtimeBattle,
  ms: number,
  input: [
    Parameters<RealtimeBattle["advance"]>[1][0],
    Parameters<RealtimeBattle["advance"]>[1][1],
  ] = [{}, {}],
) {
  for (let t = ms; t > 1e-6; t -= arenaRules.step)
    b.advance(Math.min(t, arenaRules.step), input);
}
const empty: CombatGeometry = { blade: null, body: [] };
it.each(["wood", "greatsword", "war-hammer", "battle-axe"])(
  "locks an execution socket and kills with %s even when starting at the end of the down timer",
  (weapon) => {
    const b = make(weapon);
    b.enemy.knockdown = { phase: "down", elapsed: 990 };
    b.player.bodyCooldown = 350;
    b.advance(0, [{ attack: "finish" }, {}]);
    expect(b.player.finisher?.role).toBe("executor");
    step(b, 300, [
      { move: -1, jump: true, attack: "kick" },
      { move: 1, jump: true, attack: "quick" },
    ]);
    const anchor = b.player.x;
    expect(b.enemy.knockdown?.phase).toBe("down");
    expect(b.player.y).toBe(0);
    step(b, 400, [{ move: 1 }, { move: -1 }]);
    expect(b.player.x).toBe(anchor);
    expect(b.resolve([empty, empty])[0]).toMatchObject({
      kind: "finisher",
      damage: 100,
    });
    expect(b.state).toBe("Victory");
    expect(b.enemy.hp).toBe(0);
    expect(b.resolve([empty, empty])).toEqual([]);
  },
);
it("rejects a remote or already rising execution target", () => {
  const b = make();
  b.enemy.knockdown = { phase: "getUp", elapsed: 0 };
  expect(b.canAttack(b.player, "finish")).toBe(false);
  b.enemy.knockdown.phase = "down";
  b.enemy.x = 1100;
  expect(b.canAttack(b.player, "finish")).toBe(false);
});
it.each([-1, 1] as const)(
  "walks with a captive and throws in direction %s",
  (direction) => {
    const b = make();
    b.advance(0, [{ grapple: true }, {}]);
    step(b, 1500);
    expect(b.player.grapple?.phase).toBe("hold");
    const start = b.player.x;
    step(b, 400, [{ move: direction, jump: true }, {}]);
    expect((b.player.x - start) * direction).toBeCloseTo(32, 6);
    expect(b.player.y).toBe(0);
    expect(b.player.facing).toBe(direction);
    expect(b.enemy.facing).toBe(direction);
    expect(b.enemy.x - b.player.x).toBeCloseTo(112 * direction, 6);
    b.advance(0, [{ grapple: true }, {}]);
    step(b, 200);
    expect(b.enemy.vx * direction).toBeGreaterThan(300);
  },
);
it("fires one physical bolt, retains the weapon and does not turn a landed bolt into another crossbow", () => {
  const b = make("crossbow"),
    saved = JSON.stringify(b.player.model);
  b.enemy.x = 1050;
  b.advance(0, [{ attacks: ["front", "rear"] }, {}]);
  expect(b.player.handActions.rear?.name).toBe("shoot");
  expect(b.player.handActions.front).toBeNull();
  const firing: CombatGeometry = {
    ...empty,
    muzzles: { rear: { x: 600, y: 360 } },
  };
  step(b, 530);
  b.resolve([firing, empty]);
  b.resolve([firing, empty]);
  expect(b.projectiles).toHaveLength(1);
  expect(b.projectiles[0].kind).toBe("bolt");
  expect(b.consumedItems).toEqual([]);
  expect(JSON.stringify(b.player.model)).toBe(saved);
  const bolt = b.projectiles[0];
  bolt.state = "landed";
  bolt.x = b.player.x;
  expect(b.nearbyPickup(b.player)).toBeUndefined();
  b.player.action = null;
  b.player.handCooldowns.rear = b.player.handCooldowns.front = 0;
  expect(b.canAttack(b.player, "quick", "rear")).toBe(false);
  step(b, 2300);
  expect(b.canAttack(b.player, "quick", "rear")).toBe(true);
});
it("a released bolt requires swept contact and damages only once", () => {
  const b = make("crossbow");
  b.advance(0, [{ attack: "quick" }, {}]);
  step(b, 530);
  const body = { a: { x: 615, y: 350 }, b: { x: 615, y: 380 }, radius: 16 };
  const events = b.resolve([
    { ...empty, muzzles: { rear: { x: 600, y: 360 } } },
    { blade: null, body: [body] },
  ]);
  expect(events[0]?.kind).toBe("projectile");
  expect(events[0]?.damage).toBe(26);
  expect(b.enemy.hp).toBe(74);
  expect(b.resolve([empty, { blade: null, body: [body] }])).toEqual([]);
});
it("keeps crossbow trigger and fore-end grips reachable through aiming and reloading", () => {
  for (const rest of [combatRest, relaxedRest])
    for (let i = 0; i <= 400; i++) {
      const pose = crossbowPose(rest, i / 400),
        rig = groundedPose(pose);
      expect(rig.nearArm.clamped).toBe(false);
      expect(rig.farArm.clamped).toBe(false);
    }
});
it("keeps a walking carry inside the walls with its full hand socket offset", () => {
  const b = make();
  b.advance(0, [{ grapple: true }, {}]);
  step(b, 1500);
  step(b, 10000, [{ move: 1 }, {}]);
  expect(b.player.x).toBeCloseTo(1078, 6);
  expect(b.enemy.x - b.player.x).toBeCloseTo(112, 6);
  step(b, 20000, [{ move: -1 }, {}]);
  expect(b.player.x).toBeCloseTo(202, 6);
  expect(b.enemy.x - b.player.x).toBeCloseTo(-112, 6);
});
it("returns to a loaded crossbow idle after the reload action without dropping the new bolt", () => {
  const b = make("crossbow");
  b.advance(0, [{ attack: "quick" }, {}]);
  step(b, 530);
  b.resolve([{ ...empty, muzzles: { rear: { x: 600, y: 360 } } }, empty]);
  step(b, 2080);
  expect(b.player.action).toBeNull();
  expect(b.player.rangedCooldown).toBe(0);
});
