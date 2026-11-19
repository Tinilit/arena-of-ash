import { describe, expect, it, vi } from "vitest";
import { createPlayer } from "../../src/domain/model";
import { ArenaAI } from "../../src/combat/ArenaAI";
import {
  RealtimeBattle,
  arenaRules,
  type ArenaInput,
} from "../../src/combat/realtime";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
import { groundedPose } from "../../src/characters/kinematics";
import { Animator } from "../../src/characters/animation";
import { equipmentMotion } from "../../src/characters/equipmentMotion";
import { grappleRules } from "../../src/combat/grapples";
import { parryPose } from "../../src/characters/parryMotion";
import { parryRules } from "../../src/combat/parry";
import { combatRest } from "../../src/characters/locomotion";
import { grapplePose } from "../../src/characters/grappleMotion";
const make = () => {
  const enemy = createPlayer();
  enemy.id = "enemy";
  const b = new RealtimeBattle(createPlayer(), enemy);
  b.player.x = 500;
  b.enemy.x = 590;
  b.enemy.facing = -1;
  return b;
};
function advance(
  b: RealtimeBattle,
  ms: number,
  input: [ArenaInput, ArenaInput] = [{}, {}],
) {
  for (let left = ms; left > 1e-6; left -= arenaRules.step)
    b.advance(Math.min(left, arenaRules.step), input);
}
describe("reactive enemy backsteps", () => {
  it("notices a committed swing once, hops away and waits before another attempt", () => {
    const b = make(),
      roll = vi.fn(() => 0),
      ai = new ArenaAI(
        () => 1,
        () => 1,
        roll,
      );
    b.advance(0, [{ attack: "quick" }, {}]);
    expect(ai.update(0, b.enemy, b.player).hop).toBeUndefined();
    advance(b, 140);
    const input = ai.update(140, b.enemy, b.player);
    expect(input).toMatchObject({ hop: -1, move: 0, guard: false });
    b.advance(0, [{}, input]);
    expect(b.enemy.hop?.kind).toBe("backstep");
    const start = b.enemy.x;
    advance(b, 900);
    expect(b.enemy.x - start).toBeGreaterThan(100);
    expect(b.enemy.y).toBe(0);
    b.player.handCooldowns.rear = 0;
    b.player.action = null;
    b.advance(0, [{ attack: "quick" }, {}]);
    advance(b, 140);
    expect(ai.update(1040, b.enemy, b.player).hop).toBeUndefined();
    expect(roll).toHaveBeenCalledTimes(1);
  });
  it("does not reroll a failed dodge every frame or dodge into a wall", () => {
    const b = make(),
      roll = vi.fn(() => 1),
      ai = new ArenaAI(
        () => 1,
        () => 1,
        roll,
      );
    b.advance(0, [{ attack: "quick" }, {}]);
    advance(b, 140);
    for (let i = 0; i < 20; i++)
      expect(ai.update(8, b.enemy, b.player).hop).toBeUndefined();
    expect(roll).toHaveBeenCalledTimes(1);
    const wall = make();
    wall.player.x = 1090;
    wall.enemy.x = 1180;
    wall.advance(0, [{ attack: "quick" }, {}]);
    advance(wall, 140);
    const wallRoll = vi.fn(() => 0);
    expect(
      new ArenaAI(
        () => 1,
        () => 1,
        wallRoll,
      ).update(140, wall.enemy, wall.player).hop,
    ).toBeUndefined();
    expect(wallRoll).not.toHaveBeenCalled();
  });
});
describe("coupled overhead lift and throw", () => {
  it.each([1, -1] as const)(
    "keeps a wall-side carry and release continuous facing %s",
    (facing) => {
      const b = make();
      b.player.x = facing === 1 ? arenaRules.maxX - 64 : arenaRules.minX + 64;
      b.enemy.x = facing === 1 ? arenaRules.maxX : arenaRules.minX;
      b.advance(0, [{ grapple: true }, {}]);
      let previous = b.enemy.x;
      for (let i = 0; i < 200; i++) {
        advance(b, 8);
        expect(b.enemy.x).toBeGreaterThanOrEqual(arenaRules.minX);
        expect(b.enemy.x).toBeLessThanOrEqual(arenaRules.maxX);
        expect(Math.abs(b.enemy.x - previous)).toBeLessThan(4);
        previous = b.enemy.x;
      }
      b.advance(0, [{ grapple: true }, {}]);
      advance(b, 200);
      expect(b.enemy.x).toBe(previous);
      expect(b.enemy.grapple?.phase).toBe("air");
    },
  );
  it("eases into the crouched reach and returns both hands to idle after throwing", () => {
    const initial = grapplePose(combatRest, {
      role: "lifter",
      phase: "reach",
      elapsed: 0,
    });
    const final = grapplePose(combatRest, {
      role: "lifter",
      phase: "throw",
      elapsed: grappleRules.throwDuration,
    });
    for (const key of [
      "farHandX",
      "farHandY",
      "nearHandX",
      "nearHandY",
      "rootY",
      "torso",
      "head",
    ])
      for (const pose of [initial, final])
        expect(pose[key] ?? 0).toBeCloseTo(combatRest[key] ?? 0, 7);
    for (const [phase, duration] of [
      ["reach", grappleRules.anticipation],
      ["lift", grappleRules.lift],
      ["throw", grappleRules.throwDuration],
    ] as const) {
      let previous = groundedPose(
        grapplePose(combatRest, { role: "lifter", phase, elapsed: 0 }),
      );
      for (let t = 4; t <= duration; t += 4) {
        const next = groundedPose(
          grapplePose(combatRest, { role: "lifter", phase, elapsed: t }),
        );
        for (const side of ["nearArm", "farArm"] as const)
          expect(
            Math.hypot(
              next[side].hand.x - previous[side].hand.x,
              next[side].hand.y - previous[side].hand.y,
            ),
          ).toBeLessThan(6);
        previous = next;
      }
    }
  });
  it("holds until commanded, allows the carrier to walk, throws without HP damage and uses heavy floor recovery", () => {
    const b = make(),
      saved = JSON.stringify(b.player.model),
      motion = new ArenaMotion(b.enemy.model);
    b.advance(0, [{ grapple: true }, {}]);
    expect(b.player.grapple?.phase).toBe("reach");
    advance(b, grappleRules.anticipation + grappleRules.lift + 40);
    expect(b.player.grapple?.phase).toBe("hold");
    expect(b.enemy.grapple?.role).toBe("target");
    expect(b.enemy.y).toBe(-285);
    const heldX = b.enemy.x;
    advance(b, 400, [
      { move: 1, jump: true, attack: "quick" },
      { move: -1, jump: true, attack: "quick" },
    ]);
    expect(b.player.x).toBeCloseTo(532, 6);
    expect(b.enemy.x).toBeCloseTo(heldX + 32, 6);
    expect(b.enemy.action).toBeNull();
    expect(b.canAttack(b.enemy, "quick")).toBe(false);
    expect(b.canParry(b.player)).toBe(false);
    expect(b.canHop(b.player, 1)).toBe(false);
    b.advance(0, [{ grapple: true }, {}]);
    expect(b.player.grapple?.phase).toBe("throw");
    advance(b, 200);
    expect(b.enemy.grapple?.phase).toBe("air");
    expect(b.enemy.x).toBeGreaterThan(heldX);
    expect(b.enemy.vy).toBeLessThan(0);
    for (let i = 0; i < 240 && !b.enemy.knockdown; i++) {
      b.advance(arenaRules.step, [{}, {}]);
      motion.update(arenaRules.step, b.enemy);
    }
    expect(b.enemy.knockdown).not.toBeNull();
    expect(b.enemy.y).toBe(0);
    advance(b, 20);
    expect(b.enemy.knockdown?.phase).toBe("down");
    advance(b, 1020);
    expect(b.enemy.knockdown?.phase).toBe("getUp");
    advance(b, 1840);
    expect(b.enemy.knockdown).toBeNull();
    expect(b.player.hp).toBe(100);
    expect(b.enemy.hp).toBe(100);
    expect(JSON.stringify(b.player.model)).toBe(saved);
    expect(b.contacts).toEqual([]);
  });
  it("can queue a throw during the lift and mirror it toward the left", () => {
    const b = make();
    b.enemy.x = 410;
    b.advance(0, [{ grapple: true }, {}]);
    expect(b.player.facing).toBe(-1);
    advance(b, 700);
    b.advance(0, [{ grapple: true }, {}]);
    advance(b, 1000);
    expect(b.enemy.grapple?.phase).toBe("air");
    expect(b.enemy.vx).toBeLessThan(0);
  });
  it("rejects distant or airborne targets and lets an opponent escape or interrupt the reach", () => {
    const b = make();
    b.enemy.x = 800;
    expect(b.canGrapple()).toBe(false);
    b.enemy.x = 590;
    b.enemy.y = -5;
    expect(b.canGrapple()).toBe(false);
    b.enemy.y = 0;
    b.advance(0, [{ grapple: true }, {}]);
    advance(b, 500, [{}, { move: 1, run: true }]);
    expect(b.player.grapple).toBeUndefined();
    expect(b.enemy.grapple).toBeUndefined();
    const hurt = make();
    hurt.advance(0, [{ grapple: true }, {}]);
    hurt.player.stun = 200;
    advance(hurt, 20);
    expect(hurt.player.grapple).toBeUndefined();
    expect(hurt.enemy.y).toBe(0);
  });
  it("keeps fixed reachable arm chains throughout lifting and the automatic counter-shove", () => {
    const b = make(),
      motion = new ArenaMotion(b.player.model);
    b.advance(0, [{ grapple: true }, {}]);
    for (let i = 0; i < 190; i++) {
      advance(b, 8);
      const rig = groundedPose(motion.update(8, b.player));
      for (const arm of [rig.nearArm, rig.farArm]) {
        expect(arm.clamped).toBe(false);
        expect(
          Math.hypot(
            arm.elbow.x - arm.shoulder.x,
            arm.elbow.y - arm.shoulder.y,
          ),
        ).toBeCloseTo(40, 7);
        expect(
          Math.hypot(arm.hand.x - arm.elbow.x, arm.hand.y - arm.elbow.y),
        ).toBeCloseTo(34, 7);
      }
    }
    for (const hand of ["front", "rear"] as const)
      for (let t = 0; t < parryRules.shoveDuration; t += 8) {
        const rig = groundedPose(parryPose(combatRest, 120 + t, hand, t));
        expect(rig.nearArm.clamped).toBe(false);
        expect(rig.farArm.clamped).toBe(false);
      }
  });
});
for (const name of ["shootCrossbow", "shootRifle"])
  it(`${name} aims with two reachable arms, emits one shot and returns to idle`, () => {
    const animator = new Animator(equipmentMotion(undefined)),
      fire = vi.fn();
    animator.play(name, fire);
    let flash = false;
    for (let t = 0; t < 2300; t += 8) {
      const pose = animator.update(8),
        rig = groundedPose(pose);
      flash ||= (pose.shotFlash ?? 0) > 0;
      for (const arm of [rig.nearArm, rig.farArm])
        expect(arm.clamped).toBe(false);
      if (t > 650 && t < 900)
        expect(rig.nearArm.hand.x - rig.farArm.hand.x).toBeGreaterThan(35);
    }
    expect(fire).toHaveBeenCalledTimes(1);
    expect(flash).toBe(true);
    expect(animator.name).toBe("idle");
  });
