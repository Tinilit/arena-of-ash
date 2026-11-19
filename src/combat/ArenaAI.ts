import { stats } from "../domain/progression";
import { aimAtFighter } from "./aim";
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
  lastDecision = "approach";
  recoveryTargetId?: number;
  private recoveryGoal?: number;
  private tacticalCooldown = 300;
  private drinkCooldown = 0;
  private grappleApproach = 0;
  private parryPlans = new Map<
    number,
    { at: number; attempt: boolean; done: boolean }
  >();
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
    private tacticsRandom: Random = Math.random,
    private options: { advanced?: boolean } = {},
  ) {}
  setAdvanced(enabled: boolean) {
    this.options.advanced = enabled;
  }
  private ready(self: ArenaFighter) {
    return (
      !self.action &&
      !self.parry &&
      !self.hop &&
      self.bodyCooldown === 0 &&
      self.handCooldowns.front === 0 &&
      self.handCooldowns.rear === 0
    );
  }
  private tactics(
    self: ArenaFighter,
    target: ArenaFighter,
    ground: readonly Projectile[],
  ): ArenaInput | undefined {
    const gap = Math.abs(target.x - self.x),
      toward = Math.sign(target.x - self.x);
    const armed = Boolean(
      weaponForHand(self.model, "rear") || weaponForHand(self.model, "front"),
    );
    const loot = ground
      .filter(
        (p) =>
          p.kind !== "bolt" &&
          p.state !== "expired" &&
          p.state !== "pickedUp" &&
          item(p.itemId)?.slot === "weapon" &&
          freeEquipmentSlot(self.model, p.itemId) &&
          ((p.kind === "disarmed" && p.ownerId === self.model.id) ||
            (!armed && p.state === "landed")),
      )
      .sort(
        (a, b) =>
          Number(b.ownerId === self.model.id) -
            Number(a.ownerId === self.model.id) ||
          Math.abs(a.x - self.x) - Math.abs(b.x - self.x),
      )[0];
    this.recoveryTargetId = loot?.id;
    if (loot) {
      const height = Math.max(0, 551 - loot.floorRadius - loot.y);
      const flight =
        loot.state === "landed"
          ? 0
          : (-loot.vy + Math.sqrt(loot.vy ** 2 + 2000 * height)) / 1000;
      const goal = Math.max(90, Math.min(1190, loot.x + loot.vx * flight));
      this.recoveryGoal = goal;
      this.lastDecision = "recover-weapon";
      if (
        loot.state === "landed" &&
        pickupDistance(loot, self.x) <= 85 &&
        !self.action &&
        !self.parry
      )
        return { pickup: true, move: 0 };
      const move = Math.sign(goal - self.x),
        blocked =
          (target.x - self.x) * move > 0 &&
          (goal - target.x) * move > -35 &&
          gap < 130 &&
          !target.knockdown;
      if (blocked && this.ready(self) && this.tacticalCooldown <= 0) {
        this.tacticalCooldown = 900;
        if (
          gap <= 105 &&
          (self.grappleCooldown ?? 0) === 0 &&
          target.y === 0 &&
          this.tacticsRandom() < 0.45
        ) {
          this.lastDecision = "recovery-grapple";
          return { grapple: true, move: 0 };
        }
        this.lastDecision = "recovery-kick";
        return { attack: "kick", move: 0 };
      }
      return { move: Math.abs(goal - self.x) > 15 ? move : 0, run: true };
    }
    this.recoveryGoal = undefined;
    if (
      armed &&
      !self.action &&
      !self.parry &&
      self.parryCooldown === 0 &&
      self.y === 0 &&
      !self.hop
    ) {
      const bolt = ground.find(
        (p) =>
          p.kind === "bolt" &&
          p.state === "flying" &&
          p.ownerId !== self.model.id &&
          p.vx * self.facing < 0 &&
          Math.abs(p.x - self.x) < 170 &&
          Math.abs(
            p.y - (551 + self.y - 170 * (self.model.combatProfile?.size ?? 1)),
          ) < 100 &&
          !this.noticed.has(-p.id),
      );
      if (bolt) {
        this.noticed.add(-bolt.id);
        if (this.tacticsRandom() < (self.model.combatProfile ? 0.45 : 0.28))
          return { parry: true, move: 0 };
      }
    }
    if (
      armed &&
      !self.action &&
      !self.parry &&
      self.parryCooldown === 0 &&
      self.y === 0 &&
      !self.hop &&
      gap < 235
    ) {
      for (const threat of activeActions(target).filter(
        (a) => a.name === "quick",
      )) {
        let plan = this.parryPlans.get(threat.id);
        if (!plan) {
          plan = {
            at: threat.duration * (0.34 + this.tacticsRandom() * 0.1),
            attempt: this.tacticsRandom() < 0.28,
            done: false,
          };
          this.parryPlans.set(threat.id, plan);
          if (this.parryPlans.size > 32)
            this.parryPlans.delete(this.parryPlans.keys().next().value!);
        }
        if (!plan.done && threat.elapsed >= plan.at) {
          plan.done = true;
          if (
            plan.attempt &&
            threat.elapsed <= threat.duration * 0.6 &&
            (target.x - self.x) * self.facing >= 0
          ) {
            this.lastDecision = "parry";
            return { parry: true, move: 0 };
          }
        }
      }
    }
    if (this.grappleApproach > 0 && !target.knockdown && this.ready(self)) {
      this.lastDecision = "grapple";
      return { grapple: gap <= 105, move: gap <= 105 ? 0 : toward, run: true };
    }
    if (!this.ready(self) || this.tacticalCooldown > 0) return undefined;
    this.tacticalCooldown = self.model.combatProfile
      ? 450 + this.tacticsRandom() * 450
      : 700 + this.tacticsRandom() * 800;
    if (target.knockdown?.phase === "down" && armed && gap < 260) {
      this.lastDecision = "finish";
      return { attack: "finish", move: toward };
    }
    const belts: ("belt1" | "belt2")[] = ["belt1", "belt2"];
    belts.sort(
      (a, b) =>
        Number(item(self.model.equipment[b] ?? "")?.use === "drink") -
        Number(item(self.model.equipment[a] ?? "")?.use === "drink"),
    );
    for (const belt of belts) {
      const def = item(self.model.equipment[belt] ?? "");
      if (
        this.drinkCooldown === 0 &&
        def?.use === "drink" &&
        ((def.effect === "haste" && !(self.speedRemaining ?? 0)) ||
          (def.heal && self.hp < stats(self.model).hp * 0.65))
      ) {
        this.drinkCooldown = 6000;
        this.lastDecision = "drink";
        return { belt, move: gap < 200 ? -toward : 0 };
      }
      if (
        def?.use === "throw" &&
        gap > (self.model.combatProfile ? 110 : 160) &&
        gap < (self.model.combatProfile ? 720 : 600) &&
        this.tacticsRandom() < (self.model.combatProfile ? 0.8 : 0.5)
      ) {
        this.lastDecision = "belt-throw";
        return { belt, move: 0 };
      }
    }
    const choice = this.tacticsRandom();
    if (
      gap < 230 &&
      target.y === 0 &&
      !target.knockdown &&
      (self.grappleCooldown ?? 0) === 0 &&
      choice < 0.18
    ) {
      this.lastDecision = "grapple";
      this.grappleApproach = 1000;
      return { grapple: gap <= 105, move: gap <= 105 ? 0 : toward, run: true };
    }
    if (gap < 130 && (choice < 0.45 || !armed)) {
      this.lastDecision = choice < 0.1 ? "jump-kick" : "kick";
      return { attack: "kick", jump: choice < 0.1 };
    }
    if (gap < 135 && twoHandWeapon(self.model) && choice < 0.68) {
      this.lastDecision = "shove";
      return { attack: "shove" };
    }
    if (gap > 175 && gap < 320 && self.hopCooldown === 0 && choice < 0.4) {
      this.lastDecision = "forward-hop";
      return { hop: 1, move: 0 };
    }
    if (armed && gap < 185 && choice > 0.8) {
      this.lastDecision = "jump-attack";
      return {
        jump: true,
        attack: "quick",
        hand: weaponForHand(self.model, "rear") ? "rear" : "front",
        move: toward,
      };
    }
    return undefined;
  }
  update(
    delta: number,
    self: ArenaFighter,
    target: ArenaFighter,
    ground: readonly Projectile[] = [],
  ): ArenaInput {
    const input = this.decide(delta, self, target, ground);
    return twoHandWeapon(self.model)?.weaponType === "crossbow"
      ? { ...input, aim: aimAtFighter(target) }
      : input;
  }
  private decide(
    delta: number,
    self: ArenaFighter,
    target: ArenaFighter,
    ground: readonly Projectile[] = [],
  ): ArenaInput {
    this.grappleApproach = Math.max(0, this.grappleApproach - delta);
    this.drinkCooldown = Math.max(0, this.drinkCooldown - delta);
    this.guardFor -= delta;
    this.jumpCooldown -= delta;
    this.throwCooldown -= delta;
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - delta);
    this.tacticalCooldown = Math.max(0, this.tacticalCooldown - delta);
    for (const hand of ["rear", "front"] as const) this.thinking[hand] -= delta;
    const hands: Hand[] = (["rear", "front"] as Hand[]).filter((hand) =>
      weaponForHand(self.model, hand),
    );

    const reachFor = (hand: Hand) =>
      Math.max(
        85,
        Math.abs(weaponHitbox(weaponForHand(self.model, hand))?.startY ?? -60) +
          35,
      );
    const reach = hands.length
      ? Math.max(...hands.map(reachFor)) * (self.model.combatProfile?.size ?? 1)
      : 115;
    const preferred = reach;
    const gap = Math.abs(target.x - self.x),
      toward = Math.sign(target.x - self.x);
    // Keep weapon distance without perfectly kiting every close-range grab.
    // Committed swings hold their ground; a live grab reach can still be
    // interrupted by a hit or deliberately dodged by the tactical policy.
    const backOff = gap < preferred - 20 && !self.action && !target.grapple;
    const input: ArenaInput = {
      move: gap > preferred + 12 ? toward : backOff ? -toward : 0,
      run: gap > 340,
      guard: this.guardFor > 0,
    };
    if (
      this.options.advanced !== false &&
      self.grapple?.role === "lifter" &&
      self.grapple.phase === "hold"
    ) {
      this.lastDecision = "throw-opponent";
      return {
        grapple: true,
        move:
          this.recoveryGoal === undefined
            ? 0
            : -Math.sign(this.recoveryGoal - self.x),
      };
    }
    if (this.options.advanced !== false && self.action?.name === "drink") {
      this.lastDecision = "drink";
      return { move: gap < 300 ? -toward : 0, run: true };
    }
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
    if (this.options.advanced !== false) {
      const tactic = this.tactics(self, target, ground);
      if (tactic) return { ...tactic, toggleStance: self.relaxed };
    }
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
      if (
        gap >
        reachFor(hand) * (self.model.combatProfile?.size ?? 1) +
          12 * (target.model.combatProfile?.size ?? 1)
      )
        continue;
      if (
        !self.action &&
        !input.attack &&
        target.action &&
        this.rng() < 0.16 &&
        this.options.advanced === false
      ) {
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
