import { describe, it, expect } from "vitest";
import { item } from "../../src/data/catalog";
import { equipmentMotion } from "../../src/characters/equipmentMotion";
import { gaitFoot, movementSpeeds } from "../../src/characters/locomotion";
import { Animator } from "../../src/characters/animation";
import {
  groundedPose,
  skeleton,
  add,
  rotate,
} from "../../src/characters/kinematics";

describe("locomotion and hand roles", () => {
  it("retains a distinct front-hand attack library while rear attacks leave the front hand relaxed", () => {
    const rear = equipmentMotion(item("wood")),
      front = equipmentMotion(item("wood"), "front");
    expect(rear.quick).not.toBe(front.quick);
    for (const action of ["quick", "heavy"])
      for (const frame of rear[action].frames) {
        expect(frame.pose.nearHandX).toBe(14);
        expect(frame.pose.nearHandY).toBe(69);
        expect(frame.pose.farHandX).toBeGreaterThan(30);
      }
  });
  for (const name of Object.keys(
    movementSpeeds,
  ) as (keyof typeof movementSpeeds)[]) {
    it(`${name}: contact travel cancels translation in either direction`, () => {
      const running = name.startsWith("run"),
        duration = running ? 640 : 1000,
        duty = running ? 0.35 : 0.6;
      let first: number | undefined;
      for (let phase = 0; phase < duty; phase += 0.01) {
        const foot = gaitFoot(
          phase,
          movementSpeeds[name],
          duration,
          duty,
          running ? 35 : 20,
        );
        const worldX =
          (movementSpeeds[name] * duration * phase) / 1000 + foot.x;
        first ??= worldX;
        expect(worldX).toBeCloseTo(first, 8);
        expect(foot.y).toBe(0);
      }
      expect(
        gaitFoot(0.8, movementSpeeds[name], duration, duty, 20).y,
      ).toBeLessThan(-1);
      const footAt = (phase: number) =>
        gaitFoot(phase, movementSpeeds[name], duration, duty, 20);
      for (const boundary of [0, duty]) {
        const step = 1e-6,
          before = footAt(boundary - step),
          at = footAt(boundary),
          after = footAt(boundary + step);
        for (const axis of ["x", "y"] as const)
          expect((after[axis] - at[axis]) / step).toBeCloseTo(
            (at[axis] - before[axis]) / step,
            2,
          );
      }
    });
  }
  it("gait sampling preserves overshoot time at a cycle boundary", () => {
    const lib = equipmentMotion(item("wood")),
      a = new Animator(lib);
    a.play("walkForward");
    a.update(992);
    const p = a.update(24),
      direct = lib.walkForward.sample!(0.016);
    expect(p.nearFootX).toBeCloseTo(direct.nearFootX!, 8);
  });
  it("returns to the selected stance after jumping, including a stance change in flight", () => {
    const a = new Animator(equipmentMotion(item("wood")));
    let completions = 0;
    a.setIdle("idleRelaxed");
    a.play("jump", undefined, () => completions++);
    a.update(400);
    a.setIdle("idleCombat");
    expect(a.name).toBe("jump");
    a.update(620);
    expect(a.name).toBe("idleCombat");
    a.update(3000);
    expect(completions).toBe(1);
    a.setIdle("idleRelaxed");
    expect(a.name).toBe("idleRelaxed");
  });
  it("keeps the free elbow softly flexed and wrist neutral through actions and movement", () => {
    const lib = equipmentMotion(item("wood"));
    for (const name of [
      "idleRelaxed",
      "idleCombat",
      "quick",
      "heavy",
      "walkForward",
      "walkBackward",
      "run",
      "runBackward",
      "jump",
    ]) {
      const a = new Animator(lib);
      a.play(name);
      for (let t = 0; t < lib[name].duration; t += 16) {
        const arm = groundedPose(a.update(16)).nearArm;
        expect(arm.clamped, `${name} at ${t}`).toBe(false);
        expect(arm.bend).toBeLessThan(-0.35);
        expect(arm.bend).toBeGreaterThan(-1.3);
        expect(Math.abs(arm.wrist)).toBeLessThan(0.1);
      }
    }
  });
  for (const name of [
    "idleRelaxed",
    "idleCombat",
    "walkForward",
    "walkBackward",
    "run",
    "runBackward",
    "jump",
  ]) {
    it(`${name}: retains fixed bones, floor clearance and a stable loop/landing`, () => {
      const lib = equipmentMotion(item("wood")),
        a = new Animator(lib);
      a.play(name);
      for (let t = 0; t < lib[name].duration * 2; t += 8) {
        const p = a.update(8),
          s = groundedPose(p);
        for (const leg of [s.nearLeg, s.farLeg]) {
          expect(
            Math.hypot(leg.hip.x - leg.knee.x, leg.hip.y - leg.knee.y),
          ).toBeCloseTo(54, 7);
          expect(
            Math.hypot(leg.ankle.x - leg.knee.x, leg.ankle.y - leg.knee.y),
          ).toBeCloseTo(52, 7);
          if (s.plant === 1) expect(leg.clamped, `${name} at ${t}`).toBe(false);
          const angle = s.root.rotation + leg.angle + leg.bend + leg.foot;
          for (const x of [-13, 28])
            expect(
              leg.ankle.y + rotate({ x, y: 14 }, angle).y,
            ).toBeLessThanOrEqual(1e-6);
        }
      }
    });
  }
});
function intersects(a: { x: number; y: number }, b: { x: number; y: number }) {
  let lo = 0,
    hi = 1;
  for (const [axis, min, max] of [
    ["x", -23, 26],
    ["y", -35, 12],
  ] as const) {
    const d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-9) {
      if (a[axis] < min || a[axis] > max) return false;
      continue;
    }
    const u = (min - a[axis]) / d,
      v = (max - a[axis]) / d;
    lo = Math.max(lo, Math.min(u, v));
    hi = Math.min(hi, Math.max(u, v));
    if (lo > hi) return false;
  }
  return true;
}
for (const hand of ["rear", "front"] as const)
  for (const id of ["wood", "war-spear"]) {
    it(`${hand}/${id}: weapon clears the face in every action, stance and movement`, () => {
      const lib = equipmentMotion(item(id), hand);
      for (const [name, clip] of Object.entries(lib)) {
        const a = new Animator(lib);
        a.play(name);
        for (let t = 8; t <= clip.duration; t += 8) {
          const p = a.update(8),
            s = groundedPose(p),
            torso = s.torso,
            r = s.root.rotation;
          const head = add(
            rotate(
              add(
                { x: 0, y: skeleton.pelvisY },
                rotate({ x: 0, y: skeleton.headY }, torso),
              ),
              r,
            ),
            s.root,
          );
          const arm = hand === "rear" ? s.farArm : s.nearArm;
          const angle =
            r +
            torso +
            arm.angle +
            arm.bend +
            arm.wrist +
            (p.weaponGrip ?? Math.PI / 2);
          const local = (y: number) => {
            const q = add(arm.hand, rotate({ x: 0, y }, angle));
            return rotate(
              { x: q.x - head.x, y: q.y - head.y },
              -(r + torso + (p.head ?? 0)),
            );
          };
          if ((p.throwPreview ?? 0) > 0.01 || name === "punch") continue;
          expect(
            intersects(
              local(id === "wood" ? -95 : -150),
              local(id === "wood" ? -15 : 88),
            ),
            `${hand}/${id}/${name} at ${t}ms`,
          ).toBe(false);
        }
      }
    });
  }

it("relaxed idle stands upright on nearly straight planted legs with the blade lowered", () => {
  for (const id of ["wood", "war-spear"]) {
    const a = new Animator(equipmentMotion(item(id)));
    a.play("idleRelaxed");
    a.update(400);
    for (let t = 0; t < 2600; t += 16) {
      const p = a.update(16),
        s = groundedPose(p);
      expect(s.torso).toBe(0);
      expect(s.root.rotation).toBe(0);
      for (const leg of [s.nearLeg, s.farLeg]) {
        expect(leg.bend).toBeGreaterThan(0.025);
        expect(leg.bend).toBeLessThan(0.08);
        expect(leg.ankle.y).toBeCloseTo(-14, 7);
      }
      const arm = s.farArm;
      const angle = arm.angle + arm.bend + arm.wrist + p.weaponGrip!;
      const tip = add(
        arm.hand,
        rotate({ x: 0, y: id === "wood" ? -95 : -150 }, angle),
      );
      expect(tip.y).toBeGreaterThan(arm.hand.y);
      expect(tip.y).toBeLessThan(-10);
    }
  }
});

it("raises and lowers a carried spear below the face through stance and movement transitions", () => {
  const lib = equipmentMotion(item("war-spear"));
  for (const target of ["idleCombat", "walkForward", "walkBackward", "run"]) {
    const a = new Animator(lib);
    a.play("idleRelaxed");
    a.update(400);
    for (const name of [target, "idleRelaxed"]) {
      a.play(name);
      for (let t = 0; t < 400; t += 8) {
        const p = a.update(8);
        const s = groundedPose(p),
          arm = s.farArm;
        const angle =
          s.root.rotation +
          s.torso +
          arm.angle +
          arm.bend +
          arm.wrist +
          p.weaponGrip!;
        const head = add(
          s.root,
          rotate(
            add(
              { x: 0, y: skeleton.pelvisY },
              rotate({ x: 0, y: skeleton.headY }, s.torso),
            ),
            s.root.rotation,
          ),
        );
        const local = (y: number) =>
          rotate(
            add(add(arm.hand, rotate({ x: 0, y }, angle)), {
              x: -head.x,
              y: -head.y,
            }),
            -(s.root.rotation + s.torso + (p.head ?? 0)),
          );
        expect(intersects(local(-150), local(88)), `${name} at ${t}`).toBe(
          false,
        );
        expect(
          add(arm.hand, rotate({ x: 0, y: -150 }, angle)).y,
          `${name} floor at ${t}`,
        ).toBeLessThan(-2);
      }
    }
  }
});

it("prepares a relaxed spear for an arena attack or guard without crossing the face", async () => {
  const { RealtimeBattle, arenaRules } =
    await import("../../src/combat/realtime");
  const { ArenaMotion } = await import("../../src/characters/ArenaMotion");
  const { createPlayer } = await import("../../src/domain/model");
  const { opponent } = await import("../../src/domain/progression");
  for (const command of [{ attack: "quick" as const }, { guard: true }]) {
    const player = createPlayer();
    player.equipment.rightHand = "war-spear";
    const battle = new RealtimeBattle(player, opponent(player)),
      motion = new ArenaMotion(battle.player.model);
    battle.player.relaxed = true;
    for (let i = 0; i < 50; i++) motion.update(arenaRules.step, battle.player);
    battle.advance(0, [command, {}]);
    for (let i = 0; i < 80; i++) {
      battle.advance(arenaRules.step, ["guard" in command ? command : {}, {}]);
      const p = motion.update(arenaRules.step, battle.player),
        s = groundedPose(p),
        arm = s.farArm;
      const angle =
        s.root.rotation +
        s.torso +
        arm.angle +
        arm.bend +
        arm.wrist +
        p.weaponGrip!;
      const head = add(
        s.root,
        rotate(
          add(
            { x: 0, y: skeleton.pelvisY },
            rotate({ x: 0, y: skeleton.headY }, s.torso),
          ),
          s.root.rotation,
        ),
      );
      const local = (y: number) =>
        rotate(
          add(add(arm.hand, rotate({ x: 0, y }, angle)), {
            x: -head.x,
            y: -head.y,
          }),
          -(s.root.rotation + s.torso + (p.head ?? 0)),
        );
      expect(
        intersects(local(-150), local(88)),
        `${JSON.stringify(command)} at ${i * arenaRules.step}ms`,
      ).toBe(false);
      if (i < 23)
        expect(add(arm.hand, rotate({ x: 0, y: -150 }, angle)).y).toBeLessThan(
          -2,
        );
      if (i > 25) expect(p.weaponGrip).toBeCloseTo(Math.PI / 2);
    }
  }
});
