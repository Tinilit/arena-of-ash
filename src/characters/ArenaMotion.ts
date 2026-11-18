import { Animator, type Pose } from "./animation";
import { equipmentMotion } from "./equipmentMotion";
import { movementSpeeds } from "./locomotion";
import {
  primaryWeapon,
  primaryHand,
  weaponForHand,
} from "../domain/progression";
import type { Hand } from "../domain/model";
import type { ArenaFighter } from "../combat/realtime";
import { knockdownPose } from "./knockdownMotion";
import { groundedPose } from "./kinematics";
import { hopPose } from "./hopPose";
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
function raisedWeapon(
  from: Pose,
  target: Pose,
  age: number,
  prefix: string,
): Pose {
  if ((from.weaponGrip ?? Math.PI / 2) <= Math.PI / 2 + 0.1) return target;
  const pose: Pose = {
    ...target,
    weaponGrip:
      from.weaponGrip! + (Math.PI / 2 - from.weaponGrip!) * smooth(age / 102),
  };
  for (const key of [`${prefix}HandX`, `${prefix}HandY`, `${prefix}Wrist`])
    pose[key] =
      from[key]! + (target[key]! - from[key]!) * smooth((age - 102) / 68);
  return pose;
}
/** Each attack owns only its selected hand; contact reads that same hand's rig. */
export class ArenaMotion {
  private movement: Animator;
  private actions: Record<Hand, Animator>;
  private pain: Animator;
  private movementName = "";
  private swing = -1;
  private falling = false;
  private fallStart: Pose = {};
  private reaction = -1;
  private carryStart: Pose = {};
  private displayed: Pose = {};
  private primary: Hand;
  private guardStart?: Pose;
  private guardAge = 0;
  name = "idleCombat";
  constructor(model: ArenaFighter["model"]) {
    this.primary = primaryHand(model);
    this.movement = new Animator(
      equipmentMotion(primaryWeapon(model), this.primary),
    );
    this.actions = {
      rear: new Animator(equipmentMotion(weaponForHand(model, "rear"), "rear")),
      front: new Animator(
        equipmentMotion(weaponForHand(model, "front"), "front"),
      ),
    };
    this.pain = new Animator(
      equipmentMotion(primaryWeapon(model), this.primary),
    );
  }
  update(delta: number, f: ArenaFighter): Pose {
    if (f.knockdown) {
      if (!this.falling) this.fallStart = { ...this.displayed };
      this.falling = true;
      this.name =
        f.knockdown.phase === "fall"
          ? "knockdown"
          : f.knockdown.phase === "down"
            ? "down"
            : "getUp";
      this.displayed = knockdownPose(f.knockdown, this.fallStart, this.primary);
      return this.displayed;
    }
    const recovering = this.falling;
    if (this.falling) {
      this.falling = false;
      this.movementName = "";
    }
    const running = Math.abs(f.vx) > 115,
      backwards = f.vx * f.facing < 0;
    const name =
      Math.abs(f.vx) < 0.01 || f.hop
        ? f.relaxed
          ? "idleRelaxed"
          : "idleCombat"
        : f.reaction?.kind === "stagger"
          ? "staggerStep"
          : running
            ? backwards
              ? "runBackward"
              : "run"
            : backwards
              ? "walkBackward"
              : "walkForward";
    if (name !== this.movementName) {
      this.movementName = name;
      this.movement.play(
        name,
        undefined,
        undefined,
        recovering ? this.displayed : undefined,
      );
    }
    const speed =
      name === "staggerStep"
        ? -200
        : movementSpeeds[name as keyof typeof movementSpeeds];
    const rate = speed ? Math.abs(f.vx / speed) : 1;
    const base = this.movement.update(delta * rate);
    base.farWeaponGrip =
      this.primary === "rear" ? base.weaponGrip : (3 * Math.PI) / 4;
    base.nearWeaponGrip =
      this.primary === "front" ? base.weaponGrip : (3 * Math.PI) / 4;
    this.name = name;
    if (f.hop) {
      Object.assign(base, hopPose(base, f.hop));
      this.name = f.hop.kind;
    } else if (f.y < 0) {
      Object.assign(base, {
        rootY: 0,
        plant: 0,
        nearThigh: -0.45,
        nearShin: 0.9,
        farThigh: -0.2,
        farShin: 0.75,
        nearFootAngle: -0.2,
        farFootAngle: -0.1,
      });
      this.name = "jump";
    } else if (f.landed < 180)
      base.rootY = (base.rootY ?? 0) + 7 * Math.sin((Math.PI * f.landed) / 180);
    if (f.action) {
      const action = f.action,
        hand = action.hand,
        prefix = hand === "rear" ? "far" : "near";
      const armed = Boolean(weaponForHand(f.model, hand));
      const clip = action.name === "quick" && !armed ? "punch" : action.name;
      const starting = this.swing !== action.id;
      if (starting) {
        this.carryStart = {
          ...base,
          ...this.displayed,
          weaponGrip:
            this.displayed[`${prefix}WeaponGrip`] ??
            base[`${prefix}WeaponGrip`],
        };
        this.actions[hand].play(clip, undefined, undefined, this.carryStart);
        this.swing = action.id;
      }
      const sample = this.actions[hand].update(
        starting ? action.elapsed : delta,
      );
      const overlay =
        armed && action.name === "quick"
          ? raisedWeapon(this.carryStart, sample, action.elapsed, prefix)
          : sample;
      for (const [key, value] of Object.entries(overlay)) {
        if (
          key.startsWith(`${prefix}Hand`) ||
          key === `${prefix}Wrist` ||
          key === `${prefix}Fist` ||
          key === "torso" ||
          key === "head"
        )
          base[key] = value;
        if (
          action.name === "kick" &&
          ["nearFootX", "nearFootY", "nearFootRoll", "rootY", "plant"].includes(
            key,
          )
        )
          base[key] = value;
      }
      if (action.name !== "kick")
        base[`${prefix}WeaponGrip`] = overlay.weaponGrip ?? Math.PI / 2;
      else if (f.y < 0 || f.vy < 0) {
        // Aim the striking boot using the same target as a grounded kick, then
        // release only that leg into FK. The other leg keeps its airborne tuck.
        base.rootY = 0;
        const leg = groundedPose({ ...base, plant: 1 }).nearLeg;
        base.plant = 0;
        base.nearThigh = leg.angle;
        base.nearShin = leg.bend;
        base.nearFootAngle = leg.foot;
        base.nearFootRoll = 0;
      }
      this.name = clip;
    } else if (f.reaction) {
      const r = f.reaction;
      if (r.kind === "hit") {
        const starting = this.reaction !== r.id;
        if (starting) {
          this.pain.play("pain", undefined, undefined, this.displayed);
          this.reaction = r.id;
        }
        const p = this.pain.update(starting ? r.elapsed : delta);
        for (const key of ["torso", "head", "rootY"]) base[key] = p[key];
        this.name = "hit";
      } else {
        const weight =
          smooth(r.elapsed / 70) * smooth((r.duration - r.elapsed) / 160);
        base.torso = -0.17 * weight;
        base.head = -0.09 * weight;
        base.rootY = (base.rootY ?? 0) + 6 * weight;
        base.nearHandX = 14 + 8 * weight;
        base.nearHandY = 69 - 10 * weight;
        this.name = "stagger";
      }
    }
    if (f.guard && !f.action && !f.reaction) {
      const prefix = this.primary === "rear" ? "far" : "near";
      if (!this.guardStart) {
        this.guardStart = {
          ...this.displayed,
          ...base,
          weaponGrip: base[`${prefix}WeaponGrip`],
        };
        this.guardAge = 0;
      }
      this.guardAge += delta;
      const pose = raisedWeapon(
        this.guardStart,
        {
          ...base,
          [`${prefix}HandX`]: 64,
          [`${prefix}HandY`]: 30,
          [`${prefix}Wrist`]: 0.45,
          weaponGrip: Math.PI / 2,
        },
        this.guardAge,
        prefix,
      );
      for (const key of [`${prefix}HandX`, `${prefix}HandY`, `${prefix}Wrist`])
        base[key] = pose[key];
      base[`${prefix}WeaponGrip`] = pose.weaponGrip;
      this.name = "defend";
    } else this.guardStart = undefined;
    base.weaponGrip =
      base[`${this.primary === "rear" ? "far" : "near"}WeaponGrip`];
    this.displayed = { ...base };
    return base;
  }
}
