import { weaponForHand } from "../domain/progression";
import { weaponHitbox } from "./weaponGeometry";
import type { Random } from "../utils/random";
import type { Hand } from "../domain/model";
import type { ArenaFighter, ArenaInput } from "./realtime";
export class ArenaAI {
  private thinking: Record<Hand, number> = { rear: 450, front: 650 };
  private guardFor = 0;
  private jumpCooldown = 1600;
  constructor(private rng: Random) {}
  update(delta: number, self: ArenaFighter, target: ArenaFighter): ArenaInput {
    this.guardFor -= delta;
    this.jumpCooldown -= delta;
    for (const hand of ["rear", "front"] as const) this.thinking[hand] -= delta;
    const hands: Hand[] = (["rear", "front"] as Hand[]).filter((hand) =>
      weaponForHand(self.model, hand),
    );
    if (!hands.length) hands.push("rear");
    const reachFor = (hand: Hand) =>
      Math.max(
        85,
        Math.abs(weaponHitbox(weaponForHand(self.model, hand))?.startY ?? -60) +
          35,
      );
    const reach = Math.min(...hands.map(reachFor));
    const gap = Math.abs(target.x - self.x),
      toward = Math.sign(target.x - self.x);
    const input: ArenaInput = {
      move: gap > reach ? toward : gap < 75 ? -toward : 0,
      run: gap > 340,
      guard: this.guardFor > 0,
    };
    if (
      self.knockdown ||
      self.stun > 0 ||
      self.reaction ||
      self.bodyAction ||
      self.bodyCooldown > 0
    )
      return input;
    for (const hand of hands) {
      if (
        self.handActions[hand] ||
        self.handCooldowns[hand] > 0 ||
        this.thinking[hand] > 0
      )
        continue;
      this.thinking[hand] = 250 + this.rng() * 350;
      if (gap > reachFor(hand) + 20) continue;
      if (!self.action && !input.attack && target.action && this.rng() < 0.16) {
        this.guardFor = 650;
        input.guard = true;
        return input;
      }
      if (!input.attack) {
        input.attack = "quick";
        input.hand = hand;
      } else (input.attacks ??= []).push(hand);
    }
    if (
      input.attack &&
      target.action &&
      this.jumpCooldown <= 0 &&
      this.rng() < 0.18
    ) {
      input.jump = true;
      this.jumpCooldown = 2200;
    }
    return input;
  }
}
