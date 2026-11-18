import { Animator, type Pose } from "./animation";
import { equipmentMotion } from "./equipmentMotion";
import { movementSpeeds } from "./locomotion";
import { primaryWeapon, primaryHand } from "../domain/progression";
import type { ArenaFighter } from "../combat/realtime";
import { hopPose } from "./hopPose";

/** Turn a carried spear below the face before lifting its hand into guard. */
function raisedWeapon(
  from: Pose,
  target: Pose,
  age: number,
  prefix: string,
): Pose {
  if ((from.weaponGrip ?? Math.PI / 2) <= Math.PI / 2 + 0.1) return target;
  const smooth = (n: number) => {
    const t = Math.max(0, Math.min(1, n));
    return t * t * (3 - 2 * t);
  };
  const hand = smooth((age / 170 - 0.6) / 0.4),
    grip = smooth(age / 170 / 0.6);
  const pose: Pose = {
    ...target,
    weaponGrip: from.weaponGrip! + (Math.PI / 2 - from.weaponGrip!) * grip,
  };
  for (const key of [`${prefix}HandX`, `${prefix}HandY`, `${prefix}Wrist`])
    pose[key] = from[key]! + (target[key]! - from[key]!) * hand;
  return pose;
}

/** Locomotion owns legs/root/free arm; an action owns torso/weapon arm. */
export class ArenaMotion {
  private movement: Animator;
  private action: Animator;
  private movementName = "";
  private swing = -1;
  private carryStart?: Pose;
  private guardStart?: Pose;
  private guardAge = 0;
  private prefix: string;
  name = "idleCombat";
  constructor(model: ArenaFighter["model"]) {
    const hand = primaryHand(model);
    this.prefix = hand === "rear" ? "far" : "near";
    const lib = equipmentMotion(primaryWeapon(model), hand);
    this.movement = new Animator(lib);
    this.action = new Animator(lib);
  }
  update(delta: number, f: ArenaFighter): Pose {
    const running = Math.abs(f.vx) > 115,
      backwards = f.vx * f.facing < 0;
    const name =
      f.hop || Math.abs(f.vx) < 0.01
        ? f.relaxed
          ? "idleRelaxed"
          : "idleCombat"
        : running
          ? backwards
            ? "runBackward"
            : "run"
          : backwards
            ? "walkBackward"
            : "walkForward";
    if (name !== this.movementName) {
      this.movementName = name;
      this.movement.play(name);
    }
    const referenceSpeed = movementSpeeds[name as keyof typeof movementSpeeds];
    const base = this.movement.update(
      referenceSpeed ? delta * Math.abs(f.vx / referenceSpeed) : delta,
    );
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
      const starting = this.swing !== f.action.id;
      if (starting) {
        this.carryStart = { ...base };
        this.action.play(f.action.name, undefined, undefined, base);
        this.swing = f.action.id;
      }
      const overlay = raisedWeapon(
        this.carryStart!,
        this.action.update(starting ? 0 : delta),
        f.action.elapsed,
        this.prefix,
      );
      this.guardStart = undefined;
      for (const [key, value] of Object.entries(overlay))
        if (
          key.startsWith(`${this.prefix}Hand`) ||
          key === `${this.prefix}Wrist` ||
          key === "weaponGrip" ||
          key === "torso" ||
          key === "head"
        )
          base[key] = value;
      this.name = f.action.name;
    } else if (f.guard) {
      if (!this.guardStart) {
        this.guardStart = { ...base };
        this.guardAge = 0;
      }
      this.guardAge += delta;
      Object.assign(
        base,
        raisedWeapon(
          this.guardStart,
          {
            ...base,
            [`${this.prefix}HandX`]: 64,
            [`${this.prefix}HandY`]: 30,
            [`${this.prefix}Wrist`]: 0.45,
            weaponGrip: Math.PI / 2,
            torso: 0.025,
          },
          this.guardAge,
          this.prefix,
        ),
      );
      this.name = "defend";
    } else if (this.swing !== -1) {
      this.swing = -1;
    }
    if (!f.guard) this.guardStart = undefined;
    return base;
  }
}
