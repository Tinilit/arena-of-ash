import type { ArenaFighter, ContactEvent, Swing } from "./realtime";
import type { CombatGeometry, Point } from "./geometry";
import type { Item } from "../domain/model";
import { groundedPose } from "../characters/kinematics";
import { finishPose, twoHandPose } from "../characters/twoHandMotion";
import { combatRest } from "../characters/locomotion";
import { weaponHitbox } from "./weaponGeometry";
export const finishRules = {
  reach: 260,
  approach: 220,
  impact: 680,
  duration: 1000,
};
export interface FinishState {
  role: "executor" | "target";
  elapsed: number;
  point: Point;
}
interface Binding {
  actor: ArenaFighter;
  target: ArenaFighter;
  swing: Swing;
  point: Point;
  startX: number;
  anchor: number;
  facing: 1 | -1;
  elapsed: number;
  hit: boolean;
}
const ease = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
export function executionPose(
  weapon: Item,
  hand: "front" | "rear",
  elapsed: number,
) {
  const phase = Math.min(1, elapsed / finishRules.duration);
  return weapon.hands === 2
    ? twoHandPose(combatRest, weapon, "finish", phase)
    : finishPose(combatRest, hand, phase);
}
/** A confirmed local ground execution is a paired action, not another free swing. */
export class FinisherController {
  private binding: Binding | null = null;
  point(a: ArenaFighter, b: ArenaFighter, g?: CombatGeometry): Point | null {
    if (
      this.binding ||
      b.hp <= 0 ||
      b.knockdown?.phase !== "down" ||
      a.y !== 0 ||
      b.y !== 0
    )
      return null;
    const chest = g?.body[1] ?? g?.body[0];
    const center = chest
      ? {
          x: (chest.a.x + chest.b.x) / 2,
          y: (chest.a.y + chest.b.y) / 2 - chest.radius * 0.5,
        }
      : null;
    const point =
      center && Math.abs(center.x - b.x) < 300 && center.y > 400
        ? center
        : {
            x: b.x - b.facing * 130 * (b.model.combatProfile?.size ?? 1),
            y: 551 - 45 * (b.model.combatProfile?.size ?? 1),
          };
    return Math.abs(point.x - a.x) <= finishRules.reach ? point : null;
  }
  start(
    a: ArenaFighter,
    b: ArenaFighter,
    weapon: Item,
    swing: Swing,
    g?: CombatGeometry,
  ) {
    const point = this.point(a, b, g);
    if (!point) return false;
    const facing: 1 | -1 = point.x >= a.x ? 1 : -1;
    const p = executionPose(weapon, swing.hand, finishRules.impact),
      rig = groundedPose(p);
    const prefix = swing.hand === "rear" ? "far" : "near",
      arm = swing.hand === "rear" ? rig.farArm : rig.nearArm;
    const angle = rig.root.rotation + rig.torso + p[prefix + "WeaponAngle"]!;
    const profile = weaponHitbox(weapon) ?? {
      startY: -95,
      endY: -15,
      radius: 5,
    };
    const size = a.model.combatProfile?.size ?? 1;
    const localY = Math.max(
      profile.startY + profile.radius,
      Math.min(
        profile.endY - profile.radius,
        ((point.y - 551) / size - arm.hand.y) / (Math.cos(angle) || -1),
      ),
    );
    const contactX = arm.hand.x - Math.sin(angle) * localY;
    const anchor = Math.max(
      90,
      Math.min(1190, point.x - facing * contactX * size),
    );
    this.binding = {
      actor: a,
      target: b,
      swing,
      point,
      startX: a.x,
      anchor,
      facing,
      elapsed: 0,
      hit: false,
    };
    a.finisher = { role: "executor", elapsed: 0, point };
    b.finisher = { role: "target", elapsed: 0, point };
    a.facing = facing;
    a.pushVx = a.vx = 0;
    b.action = null;
    b.parry = null;
    b.hop = null;
    b.reaction = null;
    b.guard = false;
    b.pushVx = b.vx = b.vy = 0;
    return true;
  }
  update(delta: number, speed: (f: ArenaFighter) => number = () => 1) {
    const h = this.binding;
    if (!h) return;
    if (h.actor.hp <= 0 || h.target.hp <= 0) {
      this.end();
      return;
    }
    h.elapsed += delta * speed(h.actor);
    h.actor.x =
      h.startX + (h.anchor - h.startX) * ease(h.elapsed / finishRules.approach);
    h.actor.facing = h.facing;
    h.actor.y = h.actor.vy = h.actor.pushVx = 0;
    h.actor.bodyAction = h.swing;
    h.swing.elapsed = h.elapsed;
    h.actor.finisher = { role: "executor", elapsed: h.elapsed, point: h.point };
    h.target.finisher = { role: "target", elapsed: h.elapsed, point: h.point };
    h.target.pushVx = h.target.vx = h.target.vy = 0;
  }
  resolve(
    geometry: [CombatGeometry, CombatGeometry],
    fighters: [ArenaFighter, ArenaFighter],
  ): ContactEvent | null {
    const h = this.binding;
    if (
      !h ||
      h.hit ||
      h.elapsed < finishRules.impact ||
      h.actor.hp <= 0 ||
      h.target.hp <= 0
    )
      return null;
    h.hit = true;
    h.swing.hit = true;
    const index = fighters.indexOf(h.target),
      body = geometry[index].body[1] ??
        geometry[index].body[0] ?? { a: h.point, b: h.point, radius: 12 };
    // The paired animation owns this committed strike; the victim cannot walk
    // out of the socket or start getting up between anticipation and impact.
    const attackerGeometry = geometry[fighters.indexOf(h.actor)];
    const blade = attackerGeometry.blades?.[h.swing.hand] ??
      attackerGeometry.blade ?? { a: h.point, b: h.point, radius: 4 };
    return {
      id: h.swing.id,
      attackerId: h.actor.model.id,
      defenderId: h.target.model.id,
      hand: h.swing.hand,
      kind: "finisher",
      damage: h.target.hp,
      blocked: false,
      knockdown: false,
      point: h.point,
      blade,
      body,
    };
  }
  end() {
    if (this.binding) {
      this.binding.actor.finisher = undefined;
      this.binding.target.finisher = undefined;
    }
    this.binding = null;
  }
}
