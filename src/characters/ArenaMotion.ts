import { shieldCarryPose } from "./shieldMotion";
import { hasSkill, skill } from "../domain/skills";
import { item } from "../data/catalog";
import { kipUpPose } from "./skillMotion";
import { meleeAimPose, meleePitch } from "./meleeAim";
import { rangedPitch } from "../combat/aim";
import { Animator, type Pose } from "./animation";
import { equipmentMotion } from "./equipmentMotion";
import { movementSpeeds } from "./locomotion";
import {
  primaryWeapon,
  primaryHand,
  weaponForHand,
  twoHandWeapon,
} from "../domain/progression";
import type { Hand } from "../domain/model";
import { activeActions, type ArenaFighter } from "../combat/realtime";
import { knockdownPose } from "./knockdownMotion";
import { groundedPose } from "./kinematics";
import { hopPose } from "./hopPose";
import { parryPose } from "./parryMotion";
import { crossbowPose } from "./crossbowMotion";
import { executionPose } from "../combat/finishers";
import { grapplePose } from "./grappleMotion";
import { twoHandPose, finishPose } from "./twoHandMotion";
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
  private swings: Record<Hand, number> = { front: -1, rear: -1 };
  private returning: Partial<Record<Hand, { from: Pose; age: number }>> = {};
  private falling = false;
  private fallStart: Pose = {};
  private reaction = -1;
  private carryStarts: Record<Hand, Pose> = { front: {}, rear: {} };
  private displayed: Pose = {};
  private primary: Hand;
  private guardStart?: Pose;
  private guardAge = 0;
  private weaponKinds: Partial<Record<Hand, string>> = {};
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
    if (f.animationDelta === 0 && Object.keys(this.displayed).length)
      return this.displayed;
    if (this.primary !== primaryHand(f.model)) {
      this.primary = primaryHand(f.model);
      this.movement = new Animator(
        equipmentMotion(primaryWeapon(f.model), this.primary),
      );
      this.movementName = "";
      this.pain = new Animator(
        equipmentMotion(primaryWeapon(f.model), this.primary),
      );
    }
    for (const hand of ["front", "rear"] as const) {
      const weapon = weaponForHand(f.model, hand),
        kind = `${weapon?.weaponType ?? "sword"}-${weapon?.hands ?? 1}`;
      if (this.weaponKinds[hand] !== kind && !f.handActions[hand]) {
        this.actions[hand] = new Animator(equipmentMotion(weapon, hand));
        this.weaponKinds[hand] = kind;
      }
    }
    if (f.finisher?.role === "executor") {
      this.name = "finish";
      this.displayed = executionPose(
        primaryWeapon(f.model)!,
        primaryHand(f.model),
        f.finisher.elapsed,
      );
      return this.displayed;
    }
    if (f.knockdown) {
      if (!this.falling) this.fallStart = { ...this.displayed };
      this.falling = true;
      this.name =
        f.knockdown.phase === "fall"
          ? "knockdown"
          : f.knockdown.phase === "down"
            ? "down"
            : "getUp";
      this.displayed =
        hasSkill(f.model, skill.kipUp) && f.knockdown.phase === "getUp"
          ? kipUpPose(f.knockdown.elapsed, this.fallStart, this.primary)
          : knockdownPose(f.knockdown, this.fallStart, this.primary);
      if (hasSkill(f.model, skill.kipUp) && f.knockdown.phase === "getUp")
        this.name = "kipUp";
      return this.displayed;
    }
    const recovering = this.falling;
    if (this.falling) {
      this.falling = false;
      this.movementName = "";
    }
    const locomotionVx =
      f.vx / ((f.timeScale ?? 1) * (f.model.combatProfile?.size ?? 1));
    const running = Math.abs(locomotionVx) > 115,
      backwards = f.vx * f.facing < 0;
    const name =
      Math.abs(f.vx) < 0.01 || f.hop
        ? f.relaxed
          ? "idleRelaxed"
          : "idleCombat"
        : f.reaction?.kind === "stagger" || f.reaction?.kind === "parried"
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
    const rate = speed ? Math.abs(locomotionVx / speed) : 1;
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
    const active = activeActions(f);
    for (const hand of ["front", "rear"] as const) {
      if (active.some((a) => a.hand === hand)) {
        delete this.returning[hand];
        continue;
      }
      if (this.swings[hand] !== -1) {
        this.returning[hand] = { from: this.displayed, age: 0 };
        this.swings[hand] = -1;
      }
      const back = this.returning[hand];
      if (!back) continue;
      back.age += delta;
      const prefix = hand === "front" ? "near" : "far",
        t = smooth(back.age / 140);
      for (const suffix of ["HandX", "HandY", "Wrist", "WeaponGrip"]) {
        const key = prefix + suffix;
        base[key] =
          (back.from[key] ?? base[key] ?? 0) * (1 - t) + (base[key] ?? 0) * t;
      }
      if (t === 1) delete this.returning[hand];
    }
    const torsoBase = base.torso ?? 0,
      headBase = base.head ?? 0;
    let torsoSum = 0,
      headSum = 0,
      totalWeight = 0;
    for (const action of active) {
      const hand = action.hand,
        prefix = hand === "rear" ? "far" : "near";
      const armed = Boolean(weaponForHand(f.model, hand));
      const clip =
        action.name === "counter" &&
        weaponForHand(f.model, hand)?.weaponType === "crossbow"
          ? "shoot"
          : action.name === "superman" || action.name === "counter"
            ? "quick"
            : action.name === "bash"
              ? "shove"
              : action.name === "throw"
                ? "throwAction"
                : action.name === "quick" && !armed
                  ? "punch"
                  : action.name;
      const library = equipmentMotion(weaponForHand(f.model, hand), hand);
      const clockRate =
        (library[clip]?.duration ?? action.duration) / action.duration;
      const starting = this.swings[hand] !== action.id;
      if (starting) {
        this.carryStarts[hand] = {
          ...base,
          ...this.displayed,
          weaponGrip:
            this.displayed[`${prefix}WeaponGrip`] ??
            base[`${prefix}WeaponGrip`],
        };
        this.actions[hand].play(
          clip,
          undefined,
          undefined,
          this.carryStarts[hand],
        );
        this.swings[hand] = action.id;
      }
      const sample = this.actions[hand].update(
        (starting ? action.elapsed : (f.handAnimationDelta?.[hand] ?? delta)) *
          clockRate,
      );
      const overlay =
        armed && action.name === "quick"
          ? raisedWeapon(this.carryStarts[hand], sample, action.elapsed, prefix)
          : sample;
      for (const [key, value] of Object.entries(overlay)) {
        if (
          key.startsWith(`${prefix}Hand`) ||
          key === `${prefix}Wrist` ||
          key === `${prefix}Fist`
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
      if (action.name === "throw") {
        base[`${prefix}Throw`] = 1;
        base[`${prefix}Released`] = action.released ? 1 : 0;
        this.name = "throwOverhand";
      }
      if (action.name === "drink") base.drinkPreview = overlay.drinkPreview;
      const weight =
        smooth(action.elapsed / 100) *
        smooth((action.duration - action.elapsed) / 140);
      torsoSum += ((overlay.torso ?? torsoBase) - torsoBase) * weight;
      headSum += ((overlay.head ?? headBase) - headBase) * weight;
      totalWeight += weight;
      this.name =
        active.length > 1
          ? "dualAttack"
          : action.name === "throw"
            ? "throwOverhand"
            : clip;
    }
    if (active.length) {
      base.torso = torsoBase + torsoSum / Math.max(1, totalWeight);
      base.head = headBase + headSum / Math.max(1, totalWeight);
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
    if (f.parry) {
      Object.assign(
        base,
        parryPose(
          base,
          f.parry.elapsed,
          weaponForHand(f.model, "rear") ? "rear" : "front",
          f.parry.shoveAge,
        ),
      );
      this.name = "parry";
    }
    base.weaponGrip =
      base[`${this.primary === "rear" ? "far" : "near"}WeaponGrip`];
    const twoHand = twoHandWeapon(f.model);
    const shared = f.action;
    if (
      twoHand?.weaponType === "crossbow" &&
      !f.grapple &&
      !f.parry &&
      !f.reaction &&
      (!shared ||
        shared.name === "shoot" ||
        shared.name === "counter" ||
        shared.name === "kick")
    ) {
      Object.assign(
        base,
        crossbowPose(
          base,
          shared?.name === "shoot" || shared?.name === "counter"
            ? shared.elapsed / shared.duration
            : undefined,
          (f.rangedCooldown ?? 0) === 0,
          rangedPitch(f),
        ),
      );
      if (shared?.name === "shoot") this.name = "shoot";
    } else if (
      twoHand &&
      !f.grapple &&
      !f.parry &&
      !f.reaction &&
      (!shared || ["quick", "counter", "shove", "finish"].includes(shared.name))
    ) {
      Object.assign(
        base,
        twoHandPose(
          base,
          twoHand,
          shared?.name === "counter" ? "quick" : shared?.name,
          shared ? shared.elapsed / shared.duration : 0,
        ),
      );
      if (shared)
        this.name =
          shared.name === "quick"
            ? `twoHand-${twoHand.weaponType}`
            : shared.name;
    } else if (shared?.name === "finish") {
      Object.assign(
        base,
        finishPose(base, shared.hand, shared.elapsed / shared.duration),
      );
      this.name = "finish";
    }
    if (f.grapple) {
      Object.assign(base, grapplePose(base, f.grapple));
      this.name =
        f.grapple.role === "target"
          ? "carried"
          : f.grapple.phase === "throw"
            ? "throwOpponent"
            : "liftOpponent";
    }
    const shield = item(f.model.equipment.rightHand ?? "");
    if (shield?.slot === "shield")
      Object.assign(base, shieldCarryPose(base, shield));
    if (f.bodyAction?.name === "superman") {
      const t = f.bodyAction.elapsed / f.bodyAction.duration;
      base.torso = 0.18 * Math.sin(Math.PI * t);
      if (f.y < 0) {
        base.nearThigh = -0.9;
        base.nearShin = 1.7;
        base.farThigh = -0.35;
        base.farShin = 0.8;
        base.plant = 0;
      }
      this.name = "superman";
    }
    if (f.aim && !f.reaction && !f.parry && !f.grapple) {
      for (const action of activeActions(f)) {
        const weapon = weaponForHand(f.model, action.hand);
        if (action.name !== "quick" || !weapon) continue;
        const weight =
          smooth(action.elapsed / 180) *
          smooth((action.duration - action.elapsed) / 180);
        Object.assign(
          base,
          meleeAimPose(base, weapon, action.hand, meleePitch(f) * weight),
        );
      }
    }
    for (const hand of ["front", "rear"] as const) {
      if (f.handAnimationDelta?.[hand] !== 0) continue;
      const prefix = hand === "front" ? "near" : "far";
      for (const key of Object.keys(this.displayed))
        if (
          key.startsWith(prefix) &&
          !key.includes("Thigh") &&
          !key.includes("Shin") &&
          !key.includes("Foot")
        )
          base[key] = this.displayed[key];
    }
    this.displayed = { ...base };
    return base;
  }
}
