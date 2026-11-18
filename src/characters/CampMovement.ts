import type { Gladiator } from "./Gladiator";
import { movementSpeeds, type Stance } from "./locomotion";
export interface MovementInput {
  left: boolean;
  right: boolean;
  run: boolean;
  jump: boolean;
  toggleStance: boolean;
}
export class CampMovement {
  stance: Stance = "relaxed";
  private action = "";
  private jumping = false;
  private demo?: { name: keyof typeof movementSpeeds; remaining: number };
  constructor(
    private rig: Gladiator,
    private minimum = 760,
    private maximum = 1180,
  ) {
    rig.setStance(this.stance);
  }
  demonstrate(name: keyof typeof movementSpeeds) {
    this.demo = { name, remaining: name.startsWith("run") ? 640 : 1000 };
  }
  toggle() {
    this.stance = this.stance === "relaxed" ? "combat" : "relaxed";
    this.rig.setStance(this.stance);
  }
  throw(kind: "underhand" | "overhand" = "underhand") {
    if (this.jumping) return;
    this.jumping = true;
    this.action = kind === "overhand" ? "throwOverhand" : "throw";
    this.demo = undefined;
    this.rig.play(this.action, undefined, () => {
      this.jumping = false;
      this.action = "";
    });
  }
  jump() {
    if (this.jumping) return;
    this.jumping = true;
    this.action = "jump";
    this.demo = undefined;
    this.rig.play("jump", undefined, () => {
      this.jumping = false;
      this.action = "";
    });
  }
  update(delta: number, input: MovementInput) {
    if (input.toggleStance) this.toggle();
    if (input.jump) this.jump();
    let name: keyof typeof movementSpeeds | undefined;
    const direction = Number(input.right) - Number(input.left);
    if (direction) {
      this.demo = undefined;
      name = input.run
        ? direction > 0
          ? "run"
          : "runBackward"
        : direction > 0
          ? "walkForward"
          : "walkBackward";
    } else if (this.demo) {
      name = this.demo.name;
      this.demo.remaining -= delta;
      if (this.demo.remaining <= 0) this.demo = undefined;
    }
    if (name) {
      const next = Math.max(
        this.minimum,
        Math.min(
          this.maximum,
          this.rig.x + (movementSpeeds[name] * this.rig.scale * delta) / 1000,
        ),
      );
      if (Math.abs(next - this.rig.x) < 0.00001) name = undefined;
      this.rig.moveBy(next - this.rig.x);
    }
    if (!this.jumping) {
      const next = name ?? "idle";
      if (next !== this.action) {
        this.action = next;
        this.rig.play(next);
      }
    }
  }
}
