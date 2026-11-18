import { Animator, type Pose } from "./animation";
import { equipmentMotion } from "./equipmentMotion";
import { combatRest, movementSpeeds } from "./locomotion";
import { item } from "../data/catalog";
import type { ArenaFighter } from "../combat/realtime";

/** Locomotion owns legs/root/free arm; an action owns torso/weapon arm. */
export class ArenaMotion {
  private movement: Animator;
  private action: Animator;
  private movementName = "";
  private swing = -1;
  name = "idleCombat";
  constructor(model: ArenaFighter["model"]) {
    const lib = equipmentMotion(item(model.equipment.weapon ?? ""));
    this.movement = new Animator(lib);
    this.action = new Animator(lib);
  }
  update(delta: number, f: ArenaFighter): Pose {
    const running = Math.abs(f.vx) > 115,
      backwards = f.vx * f.facing < 0;
    const name =
      Math.abs(f.vx) < 0.01
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
    if (f.y < 0) {
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
        this.action.play(f.action.name);
        this.swing = f.action.id;
      }
      const overlay = this.action.update(starting ? 0 : delta);
      for (const [key, value] of Object.entries(overlay))
        if (
          key.startsWith("farHand") ||
          key === "farWrist" ||
          key === "torso" ||
          key === "head"
        )
          base[key] = value;
      this.name = f.action.name;
    } else if (f.guard) {
      Object.assign(base, {
        farHandX: 64,
        farHandY: 30,
        farWrist: 0.45,
        torso: 0.025,
      });
      this.name = "defend";
    } else if (this.swing !== -1) {
      this.swing = -1;
      // Idle/locomotion already contains the same ready hand targets.
      Object.assign(base, {
        farHandX: combatRest.farHandX,
        farHandY: combatRest.farHandY,
        farWrist: combatRest.farWrist,
      });
    }
    return base;
  }
}
