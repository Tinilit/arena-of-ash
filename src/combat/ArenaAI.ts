import {
  weaponForHand,
  twoHandWeapon,
  freeEquipmentSlot,
} from "../domain/progression";
import { item } from "../data/catalog";
import { pickupDistance, type Projectile } from "./projectiles";
import { weaponHitbox } from "./weaponGeometry";
import type { Random } from "../utils/random";
import type { Hand } from "../domain/model";
import { activeActions, type ArenaFighter, type ArenaInput } from "./realtime";
export class ArenaAI {
  private thinking: Record<Hand, number> = { rear: 450, front: 650 };
  private guardFor = 0;
  private jumpCooldown = 1600;
  private throwCooldown = 1800;
  private throwsRemaining = 1;
  private dodgeCooldown = 0;
  private noticed = new Set<number>();
  constructor(
    private rng: Random,
    private throwRandom: Random = Math.random,
    private dodgeRandom: Random = Math.random,
  ) {}
  update(
    delta: number,
    self: ArenaFighter,
    target: ArenaFighter,
    ground: readonly Projectile[] = [],
  ): ArenaInput {
    this.guardFor -= delta;
    this.jumpCooldown -= delta;
    this.throwCooldown -= delta;
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - delta);
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
      self.grapple ||
      self.finisher ||
      self.knockdown ||
      self.stun > 0 ||
      self.reaction ||
      self.bodyAction ||
      self.bodyCooldown > 0
    )
      return input;
    if (
      !self.action &&
      !self.parry &&
      !self.hop &&
      self.y === 0 &&
      self.vy === 0 &&
      ground.some(
        (p) =>
          p.kind !== "bolt" &&
          p.state === "landed" &&
          item(p.itemId)?.slot === "weapon" &&
          freeEquipmentSlot(self.model, p.itemId) &&
          pickupDistance(p, self.x) <= 85,
      )
    )
      return { pickup: true, move: 0, guard: false };
    if (twoHandWeapon(self.model)?.weaponType === "crossbow") {
      return {
        move: gap > 520 ? toward : gap < 260 ? -toward : 0,
        attack:
          !self.action &&
          self.handCooldowns.rear === 0 &&
          (self.rangedCooldown ?? 0) === 0
            ? "quick"
            : undefined,
        hand: "rear",
      };
    }
    if (self.hop) return { ...input, move: 0, guard: false };
    if (
      !self.action &&
      !self.parry &&
      self.y === 0 &&
      self.vy === 0 &&
      self.hopCooldown === 0 &&
      this.dodgeCooldown === 0
    ) {
      const threat = activeActions(target).find(
        (a) =>
          (a.name === "quick" || a.name === "kick") &&
          a.elapsed >= 120 &&
          a.elapsed <= a.duration * 0.45 &&
          !this.noticed.has(a.id),
      );
      if (threat) {
        this.noticed.add(threat.id);
        if (this.noticed.size > 32)
          this.noticed.delete(this.noticed.values().next().value!);
        const threatReach =
          Math.abs(
            weaponHitbox(weaponForHand(target.model, threat.hand))?.startY ??
              -60,
          ) + 80;
        const room = self.facing === 1 ? self.x - 90 : 1190 - self.x;
        if (gap <= threatReach && room >= 90 && this.dodgeRandom() < 0.35) {
          this.dodgeCooldown = 2200;
          return { hop: -1, move: 0, guard: false };
        }
      }
    }
    if (
      this.throwsRemaining &&
      this.throwCooldown <= 0 &&
      !self.action &&
      !self.parry &&
      gap >= 230 &&
      gap <= 600
    ) {
      this.throwCooldown = 9000;
      if (this.throwRandom() < 0.12) {
        const hand = hands.find(
          (h) => weaponForHand(self.model, h) && self.handCooldowns[h] === 0,
        );
        if (hand) {
          this.throwsRemaining--;
          input.throws = [hand];
          input.guard = false;
          return input;
        }
      }
    }
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
