import { primaryWeapon } from "../domain/progression";
import { weaponHitbox } from "./weaponGeometry";
import type { Random } from "../utils/random";
import type { ArenaFighter, ArenaInput } from "./realtime";

export class ArenaAI {
  private thinking = 450;
  private guardFor = 0;
  private jumpCooldown = 1600;
  constructor(private rng: Random) {}
  update(delta: number, self: ArenaFighter, target: ArenaFighter): ArenaInput {
    this.thinking -= delta;
    this.guardFor -= delta;
    this.jumpCooldown -= delta;
    const gap = Math.abs(target.x - self.x),
      toward = Math.sign(target.x - self.x);
    const blade = weaponHitbox(primaryWeapon(self.model));
    const reach = Math.max(95, Math.abs(blade?.startY ?? -95) + 35);
    const input: ArenaInput = {
      move: gap > reach ? toward : gap < 85 ? -toward : 0,
      run: gap > 340,
      guard: this.guardFor > 0,
    };
    if (self.action || this.thinking > 0) return input;
    this.thinking = 250 + this.rng() * 350;
    if (self.stamina >= 12 && gap <= reach + 20) {
      const roll = this.rng();
      if (target.action && roll < 0.16) {
        this.guardFor = 650;
        input.guard = true;
      } else
        input.attack = roll > 0.65 && self.stamina >= 25 ? "heavy" : "quick";
      if (target.action && this.jumpCooldown <= 0 && this.rng() < 0.18) {
        input.jump = true;
        this.jumpCooldown = 2200;
      }
    }
    return input;
  }
}
