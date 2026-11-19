import { wearArmor, repairArmor, type ArmorSlot } from "./armor";
import { aimedVelocity } from "./aim";
import type { Player, Hand, EquipmentSlot } from "../domain/model";
import { item } from "../data/catalog";
import { handSlots } from "../domain/model";
import {
  stats,
  consumeItem,
  addItem,
  equip,
  freeEquipmentSlot,
} from "../domain/progression";
import { parryRules } from "./parry";
import { FinisherController, type FinishState } from "./finishers";
import { GrappleController, type GrapplePoseState } from "./grapples";
import {
  advanceProjectile,
  settleProjectile,
  deflectBolt,
  projectileProfile,
  projectileFloorRadius,
  projectileShape,
  pickupDistance,
  type Projectile,
} from "./projectiles";
import {
  primaryHand,
  weaponForHand,
  twoHandWeapon,
} from "../domain/progression";
import { damage, damageAfterArmor, fighter, type Fighter } from "./engine";
import { hopDefinitions, hopKind, type Hop } from "./hops";
import {
  sweptContact,
  type CombatGeometry,
  type Point,
  type Capsule,
} from "./geometry";

export const arenaRules = {
  step: 1000 / 120,
  floor: 551,
  minX: 90,
  maxX: 1190,
  walk: 110,
  run: 200,
  gravity: 1350,
  jumpSpeed: 500,
  hitStun: 180,
  hitReaction: 280,
  kickStun: 350,
  staggerDuration: 850,
  kickImpulse: 500,
  pushFriction: 600,
};
export const knockdownTiming = {
  fall: 550,
  down: 1000,
  getUp: 1800,
  chance: 0.2,
} as const;
export const hammerRules = { knockdownChance: 0.1, pushChance: 0.1 } as const;
export interface CombatProcRandom {
  disarm?: () => number;
  hammerKnockdown?: () => number;
  hammerPush?: () => number;
  drop?: () => number;
  deflect?: () => number;
}
import { twoHandDuration } from "../characters/twoHandMotion";
export const attackTimings = {
  shoot: { duration: 2600, from: 0.2, to: 0.2 },
  quick: { duration: 1000, from: 0.45, to: 0.67 },
  shove: { duration: 800, from: 0.35, to: 0.55 },
  finish: { duration: 1000, from: 0.55, to: 0.8 },
  kick: { duration: 1050, from: 0.36, to: 0.56 },
  heavy: { duration: 1100, from: 0.46, to: 0.8 },
  throw: { duration: 850, from: 0.6, to: 0.6 },
  drink: { duration: 2100, from: 0.55, to: 0.55 },
  recover: { duration: 750, from: 1, to: 1 },
} as const;
export type Attack = "quick" | "heavy" | "kick" | "throw" | "shove" | "finish";
export type ArenaAction = Attack | "recover" | "drink" | "shoot";
export type ArenaState = "Fighting" | "Victory" | "Defeat" | "Draw";
export interface ArenaInput {
  aim?: Point;
  move?: number;
  run?: boolean;
  jump?: boolean;
  hop?: -1 | 1;
  /** Absolute key intent, resolved after mouse aiming changes the facing. */
  worldHop?: -1 | 1;
  attack?: Attack;
  hand?: Hand;
  attacks?: Hand[];
  throws?: Hand[];
  belt?: "belt1" | "belt2";
  guard?: boolean;
  recover?: boolean;
  toggleStance?: boolean;
  parry?: boolean;
  pickup?: boolean;
  grapple?: boolean;
}
export interface Swing {
  id: number;
  name: ArenaAction;
  elapsed: number;
  duration: number;
  hit: boolean;
  hand: Hand;
  itemId?: string;
  sourceSlot?: EquipmentSlot;
  released?: boolean;
  throwAttack?: number;
}
export interface ArenaFighter extends Fighter {
  aim?: Point;
  speedRemaining?: number;
  timeScale?: number;
  animationDelta?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  /** Aggregate view for presentation; hand eligibility uses its own track. */
  action: Swing | null;
  bodyAction: Swing | null;
  handActions: Record<Hand, Swing | null>;
  handCooldowns: Record<Hand, number>;
  bodyCooldown: number;
  relaxed: boolean;
  landed: number;
  hop: Hop | null;
  hopCooldown: number;
  attackCooldown: number;
  stun: number;
  rangedCooldown?: number;
  pushVx: number;
  grapple?: GrapplePoseState;
  finisher?: FinishState;
  grappleCooldown?: number;
  parry: {
    id: number;
    elapsed: number;
    succeeded: boolean;
    targetId?: string;
    shoveAge?: number;
    pushed?: boolean;
    disarmAttempted?: boolean;
  } | null;
  parryCooldown: number;
  knockdown: { phase: "fall" | "down" | "getUp"; elapsed: number } | null;
  reaction: {
    id: number;
    kind: "hit" | "stagger" | "parried";
    elapsed: number;
    duration: number;
    direction: 1 | -1;
  } | null;
}
export interface ContactEvent {
  id: number;
  attackerId: string;
  defenderId: string;
  damage: number;
  rawDamage?: number;
  hitRegion?: ArmorSlot;
  blocked: boolean;
  parried?: boolean;
  deflected?: boolean;
  disarmed?: boolean;
  pushed?: boolean;
  knockdown: boolean;
  kind: "weapon" | "kick" | "projectile" | "shove" | "finisher";
  hand: Hand;
  point: Point;
  blade: Capsule;
  body: Capsule;
}
function parrySurfaces(g: CombatGeometry): Capsule[] {
  return [
    ...(g.parries ?? []),
    ...Object.values(g.blades ?? {}),
    ...(g.blade ? [g.blade] : []),
    ...(g.shove ? [g.shove] : []),
  ].filter((c): c is Capsule => Boolean(c));
}
function actor(model: Player, x: number, facing: 1 | -1): ArenaFighter {
  return {
    ...fighter(structuredClone(model)),
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    bodyAction: null,
    handActions: { front: null, rear: null },
    handCooldowns: { front: 0, rear: 0 },
    bodyCooldown: 0,
    get action() {
      return this.bodyAction ?? this.handActions.rear ?? this.handActions.front;
    },
    set action(value: Swing | null) {
      this.bodyAction = null;
      this.handActions.front = this.handActions.rear = null;
      if (
        value?.name === "quick" ||
        value?.name === "heavy" ||
        value?.name === "throw" ||
        value?.name === "drink" ||
        value?.name === "shoot"
      )
        this.handActions[value.hand] = value;
      else this.bodyAction = value;
    },
    relaxed: false,
    landed: 1000,
    hop: null,
    hopCooldown: 0,
    get attackCooldown() {
      return Math.max(
        this.bodyCooldown,
        this.handCooldowns.front,
        this.handCooldowns.rear,
      );
    },
    set attackCooldown(value: number) {
      this.bodyCooldown = value;
      this.handCooldowns.front = this.handCooldowns.rear = value;
    },
    stun: 0,
    pushVx: 0,
    parry: null,
    parryCooldown: 0,
    reaction: null,
    knockdown: null,
  };
}
export function activeActions(f: ArenaFighter): Swing[] {
  return [f.bodyAction, f.handActions.front, f.handActions.rear].filter(
    (a): a is Swing => a !== null,
  );
}
export const fighterSpeed = (f: ArenaFighter) =>
  (f.speedRemaining ?? 0) > 0 ? 2 : 1;
export class RealtimeBattle {
  state: ArenaState = "Fighting";
  readonly fighters: [ArenaFighter, ArenaFighter];
  readonly contacts: ContactEvent[] = [];
  readonly armorBreaks: {
    id: number;
    ownerId: string;
    itemId: string;
    slot: ArmorSlot;
    point: Point;
  }[] = [];
  armorRevision = 0;
  readonly projectiles: Projectile[] = [];
  readonly consumedItems: {
    ownerId: string;
    itemId: string;
    actionId: number;
    sourceSlot?: EquipmentSlot;
  }[] = [];
  readonly collectedItems: {
    ownerId: string;
    itemId: string;
    slot?: EquipmentSlot;
    projectileId: number;
  }[] = [];
  private sequence = 0;
  private finishers = new FinisherController();
  private grapples = new GrappleController();
  private previous?: [CombatGeometry, CombatGeometry];
  private previousFacing: number[] = [];
  private previousActive: Set<number>[] = [];
  constructor(
    player: Player,
    enemy: Player,
    private random: () => number = Math.random,
    private procRandom: CombatProcRandom = {},
  ) {
    this.fighters = [actor(player, 370, 1), actor(enemy, 910, -1)];
  }
  get player() {
    return this.fighters[0];
  }
  get enemy() {
    return this.fighters[1];
  }
  canGrapple(f = this.player) {
    return this.grapples.canStart(
      this.state,
      f,
      this.fighters.find((t) => t !== f)!,
    );
  }
  canAttack(
    f: ArenaFighter,
    name: ArenaAction,
    hand: Hand = primaryHand(f.model),
  ) {
    if (name === "finish")
      return (
        this.state === "Fighting" &&
        f.hp > 0 &&
        Boolean(weaponForHand(f.model, hand)) &&
        f.y === 0 &&
        f.vy === 0 &&
        !f.hop &&
        !f.knockdown &&
        !f.parry &&
        !f.grapple &&
        !f.finisher &&
        f.stun === 0 &&
        Boolean(
          this.finishers.point(
            f,
            this.fighters.find((t) => t !== f)!,
            this.previous?.[this.fighters.indexOf(f) === 0 ? 1 : 0],
          ),
        )
      );
    return (
      this.state === "Fighting" &&
      f.hp > 0 &&
      name !== "heavy" &&
      (name !== "quick" || Boolean(weaponForHand(f.model, hand))) &&
      (!(
        weaponForHand(f.model, hand)?.weaponType === "crossbow" &&
        (name === "quick" || name === "shoot")
      ) ||
        (f.rangedCooldown ?? 0) === 0) &&
      (name !== "shove" ||
        (Boolean(twoHandWeapon(f.model)) &&
          f.y === 0 &&
          f.vy === 0 &&
          !f.hop)) &&
      (!twoHandWeapon(f.model) ||
        ((hand === "rear" || name === "kick") &&
          !f.handActions.front &&
          !f.handActions.rear &&
          f.handCooldowns.front === 0 &&
          f.handCooldowns.rear === 0)) &&
      !f.knockdown &&
      !f.parry &&
      !f.finisher &&
      !f.grapple &&
      f.stun === 0 &&
      !f.bodyAction &&
      f.bodyCooldown === 0 &&
      (name === "quick" ||
      name === "throw" ||
      name === "drink" ||
      name === "shoot"
        ? !f.handActions[hand] && f.handCooldowns[hand] === 0
        : !f.handActions.front && !f.handActions.rear) &&
      f.reaction?.kind !== "stagger"
    );
  }
  canThrow(f: ArenaFighter, hand: Hand, slot: EquipmentSlot = handSlots[hand]) {
    const definition = item(f.model.equipment[slot] ?? "");
    return (
      this.canAttack(f, "throw", hand) &&
      Boolean(
        definition &&
        (slot === handSlots[hand]
          ? definition.slot === "weapon"
          : (slot === "belt1" || slot === "belt2") &&
            definition.use === "throw"),
      ) &&
      !activeActions(f).some((a) => a.sourceSlot === slot)
    );
  }
  canParry(f: ArenaFighter) {
    return (
      this.state === "Fighting" &&
      f.hp > 0 &&
      !f.finisher &&
      !f.grapple &&
      !f.knockdown &&
      f.stun === 0 &&
      !f.parry &&
      f.parryCooldown === 0 &&
      !f.action &&
      f.reaction?.kind !== "stagger" &&
      f.reaction?.kind !== "parried" &&
      Boolean(weaponForHand(f.model, "rear") || weaponForHand(f.model, "front"))
    );
  }
  nearbyPickup(f: ArenaFighter) {
    if (
      (this.state !== "Fighting" && this.state !== "Victory") ||
      f.hp <= 0 ||
      f.y !== 0 ||
      f.vy !== 0 ||
      f.stun > 0 ||
      f.knockdown ||
      f.parry ||
      f.action ||
      f.grapple ||
      f.finisher
    )
      return undefined;
    return this.projectiles
      .filter(
        (p) =>
          p.kind !== "bolt" &&
          p.state === "landed" &&
          (f !== this.enemy ||
            (item(p.itemId)?.slot === "weapon" &&
              freeEquipmentSlot(f.model, p.itemId))) &&
          pickupDistance(p, f.x) <= 85,
      )
      .sort(
        (a, b) =>
          pickupDistance(a, f.x) - pickupDistance(b, f.x) || a.id - b.id,
      )[0];
  }
  private pickup(f: ArenaFighter) {
    const p = this.nearbyPickup(f);
    const definition = p && item(p.itemId);
    if (!p || !definition || !addItem(f.model, p.itemId)) return;
    const slot = freeEquipmentSlot(f.model, p.itemId, p.sourceSlot);
    if (slot) equip(f.model, p.itemId, slot);
    p.state = "pickedUp";
    this.collectedItems.push({
      ownerId: f.model.id,
      itemId: p.itemId,
      slot,
      projectileId: p.id,
    });
  }
  /** A victorious player can collect equipment before explicitly leaving the arena. */
  advanceAftermath(delta: number, input: ArenaInput) {
    if (this.state !== "Victory") return;
    const dt = delta / 1000,
      f = this.player;
    this.projectiles.forEach((p) => {
      advanceProjectile(p, delta, arenaRules.floor);
      settleProjectile(p, arenaRules.floor);
    });
    f.action = null;
    f.parry = null;
    f.hop = null;
    f.landed += delta;
    f.stun = Math.max(0, f.stun - delta);
    if (!f.stun) f.reaction = null;
    const before = f.x;
    f.x = Math.max(
      arenaRules.minX,
      Math.min(
        arenaRules.maxX,
        f.x +
          Math.max(-1, Math.min(1, input.move ?? 0)) *
            (input.run ? arenaRules.run : arenaRules.walk) *
            dt,
      ),
    );
    f.vx = dt ? (f.x - before) / dt : 0;
    if (f.vx) f.facing = f.vx > 0 ? 1 : -1;
    if (f.y < 0 || f.vy < 0) {
      f.y += f.vy * dt + 0.5 * arenaRules.gravity * dt * dt;
      f.vy += arenaRules.gravity * dt;
      if (f.y >= 0) {
        f.y = f.vy = 0;
        f.landed = 0;
      }
    }
    if (input.pickup) this.pickup(f);
  }
  canUseBelt(f: ArenaFighter, slot: "belt1" | "belt2") {
    const definition = item(f.model.equipment[slot] ?? "");
    if (definition?.use === "throw") return this.canThrow(f, "rear", slot);
    return (
      definition?.use === "drink" &&
      this.canAttack(f, "drink", "rear") &&
      (definition.effect === "haste"
        ? (f.speedRemaining ?? 0) === 0
        : f.hp < stats(f.model).hp)
    );
  }
  private startBeltUse(f: ArenaFighter, slot: "belt1" | "belt2") {
    if (!this.canUseBelt(f, slot)) return;
    const definition = item(f.model.equipment[slot]!)!;
    if (definition.use === "throw") return this.startThrow(f, "rear", slot);
    f.handActions.rear = {
      id: ++this.sequence,
      name: "drink",
      hand: "rear",
      sourceSlot: slot,
      itemId: definition.id,
      elapsed: 0,
      duration: attackTimings.drink.duration,
      hit: false,
      released: false,
    };
    f.relaxed = false;
    f.reaction = null;
  }
  private consume(f: ArenaFighter, swing: Swing, itemId: string) {
    consumeItem(f.model, itemId, swing.sourceSlot);
    swing.released = true;
    this.consumedItems.push({
      ownerId: f.model.id,
      itemId,
      actionId: swing.id,
      sourceSlot: swing.sourceSlot,
    });
  }
  private disarm(f: ArenaFighter, hand: Hand, geometry: CombatGeometry) {
    const definition = weaponForHand(f.model, hand),
      sourceSlot = handSlots[hand];
    if (!definition || !consumeItem(f.model, definition.id, sourceSlot))
      return false;
    const id = ++this.sequence;
    this.consumedItems.push({
      ownerId: f.model.id,
      itemId: definition.id,
      actionId: id,
      sourceSlot,
    });
    const origin = geometry.grips?.[hand] ??
      geometry.hands?.[hand]?.a ?? { x: f.x, y: arenaRules.floor + f.y - 160 };
    const roll = this.procRandom.drop ?? Math.random;
    const direction = roll() < 0.5 ? -1 : 1;
    const angle = (roll() * 2 - 1) * Math.PI;
    this.projectiles.push({
      id,
      kind: "disarmed",
      ownerId: f.model.id,
      itemId: definition.id,
      hand,
      sourceSlot,
      ...origin,
      vx: direction * (230 + roll() * 230),
      vy: -280 - roll() * 130,
      angle,
      spin: direction * (8 + roll() * 7),
      previous: { ...origin, angle },
      attack: 0,
      floorRadius: projectileFloorRadius(definition),
      profile: projectileProfile(definition),
      age: 0,
      state: "spent",
    });
    return true;
  }
  private startThrow(f: ArenaFighter, hand: Hand, slot: EquipmentSlot) {
    if (!this.canThrow(f, hand, slot)) return;
    const definition = item(f.model.equipment[slot]!)!;
    f.handActions[hand] = {
      id: ++this.sequence,
      name: "throw",
      hand,
      sourceSlot: slot,
      itemId: definition.id,
      elapsed: 0,
      duration: f.y < 0 || f.vy < 0 ? 650 : attackTimings.throw.duration,
      hit: false,
      released: false,
      throwAttack: definition.attack,
    };
    f.relaxed = false;
    f.reaction = null;
  }
  canHop(f: ArenaFighter, direction: -1 | 1) {
    return (
      this.state === "Fighting" &&
      (direction === -1 || direction === 1) &&
      f.hp > 0 &&
      !f.finisher &&
      !f.grapple &&
      f.action?.name !== "finish" &&
      f.action?.name !== "shove" &&
      !f.knockdown &&
      f.stun === 0 &&
      !f.reaction &&
      f.y === 0 &&
      f.vy === 0 &&
      !f.hop &&
      f.hopCooldown === 0
    );
  }
  advance(delta: number, input: [ArenaInput, ArenaInput]) {
    if (this.state !== "Fighting") return;
    this.fighters.forEach((f, i) =>
      this.grapples.command(this.state, f, this.fighters[1 - i], input[i]),
    );
    const dt = delta / 1000;
    this.projectiles.forEach((p) =>
      advanceProjectile(p, delta, arenaRules.floor),
    );
    const before = this.fighters.map((f) => f.x);
    this.fighters.forEach((f, i) => {
      const command = input[i];
      if (
        command.aim &&
        Number.isFinite(command.aim.x) &&
        Number.isFinite(command.aim.y)
      )
        f.aim = { ...command.aim };
      const actorDelta = delta + Math.min(delta, f.speedRemaining ?? 0);
      f.timeScale = delta > 0 ? actorDelta / delta : fighterSpeed(f);
      f.animationDelta = actorDelta;
      f.speedRemaining = Math.max(0, (f.speedRemaining ?? 0) - delta);
      const dt = actorDelta / 1000;
      f.landed += actorDelta;
      f.grappleCooldown = Math.max(0, (f.grappleCooldown ?? 0) - actorDelta);
      f.parryCooldown = Math.max(0, f.parryCooldown - actorDelta);
      if (f.parry) {
        f.parry.elapsed += actorDelta;
        if (f.parry.succeeded) {
          f.parry.shoveAge = (f.parry.shoveAge ?? 0) + actorDelta;
          if (!f.parry.pushed && f.parry.shoveAge >= parryRules.shoveImpact) {
            f.parry.pushed = true;
            const target = this.fighters.find(
              (t) => t.model.id === f.parry?.targetId,
            );
            if (target && target.hp > 0 && !target.knockdown)
              target.pushVx = f.facing * arenaRules.kickImpulse;
          }
        }
        if (
          f.parry.elapsed >= parryRules.duration &&
          (!f.parry.succeeded ||
            (f.parry.shoveAge ?? 0) >= parryRules.shoveDuration)
        ) {
          f.parry = null;
          f.parryCooldown = parryRules.cooldown;
        }
      }
      f.stun = Math.max(0, f.stun - actorDelta);
      f.rangedCooldown = Math.max(0, (f.rangedCooldown ?? 0) - actorDelta);
      f.bodyCooldown = Math.max(0, f.bodyCooldown - actorDelta);
      for (const hand of ["front", "rear"] as const)
        f.handCooldowns[hand] = Math.max(0, f.handCooldowns[hand] - actorDelta);
      if (f.reaction) {
        f.reaction.elapsed += actorDelta;
        if (f.reaction.elapsed >= f.reaction.duration) f.reaction = null;
      }
      f.hopCooldown = Math.max(0, f.hopCooldown - actorDelta);
      if (f.hop) {
        const h = f.hop,
          definition = hopDefinitions[h.kind];
        h.elapsed += actorDelta;
        if (
          h.phase === "anticipation" &&
          h.elapsed >= definition.anticipation
        ) {
          h.phase = "air";
          h.elapsed = 0;
          f.vy = -definition.jumpSpeed;
        } else if (h.phase === "landing" && h.elapsed >= definition.landing) {
          f.hop = null;
          f.hopCooldown = definition.cooldown;
        }
      }
      for (const hand of ["front", "rear"] as const) {
        const swing = f.handActions[hand];
        if (!swing) continue;
        swing.elapsed += actorDelta;
        if (swing.elapsed >= swing.duration) {
          f.handCooldowns[hand] =
            twoHandWeapon(f.model) && swing.name === "quick" ? 400 : 280;
          if (twoHandWeapon(f.model))
            f.handCooldowns.front = f.handCooldowns.rear = Math.max(
              f.handCooldowns.front,
              f.handCooldowns.rear,
            );
          f.handActions[hand] = null;
        }
      }
      if (f.bodyAction) {
        f.bodyAction.elapsed += actorDelta;
        if (f.bodyAction.elapsed >= f.bodyAction.duration) {
          f.bodyCooldown = f.bodyAction.name === "kick" ? 350 : 280;
          f.bodyAction = null;
        }
      }
      if (f.knockdown && !f.finisher) {
        const k = f.knockdown;
        k.elapsed += actorDelta;
        if (
          k.phase === "fall" &&
          k.elapsed >= knockdownTiming.fall &&
          f.y === 0
        ) {
          k.phase = "down";
          k.elapsed = 0;
          f.pushVx = 0;
        } else if (k.phase === "down" && k.elapsed >= knockdownTiming.down) {
          k.phase = "getUp";
          k.elapsed = 0;
        } else if (k.phase === "getUp" && k.elapsed >= knockdownTiming.getUp) {
          f.knockdown = null;
          f.landed = 1000;
        }
      }
      if (f.grapple?.role === "target" || f.finisher?.role === "target") return;
      const carrying =
        f.grapple?.role === "lifter" && f.grapple.phase === "hold";
      const carryMargin =
        130 * (this.fighters[1 - i].model.combatProfile?.size ?? 1) -
        18 * (f.model.combatProfile?.size ?? 1);
      const c =
        f.finisher ||
        f.knockdown ||
        f.stun > 0 ||
        f.reaction?.kind === "stagger" ||
        f.reaction?.kind === "parried" ||
        (f.grapple &&
          !(f.grapple.role === "lifter" && f.grapple.phase === "hold"))
          ? {}
          : carrying
            ? { move: input[i].move }
            : input[i];
      if (carrying && c.move) f.facing = c.move > 0 ? 1 : -1;
      if (c.toggleStance) f.relaxed = !f.relaxed;
      if (c.pickup) this.pickup(f);
      if (c.parry && this.canParry(f)) {
        f.parryCooldown = parryRules.duration + parryRules.cooldown;
        f.parry = { id: ++this.sequence, elapsed: 0, succeeded: false };
        f.relaxed = false;
        f.reaction = null;
      }
      if (!f.grapple && !f.action && !f.hop && !f.reaction && !f.knockdown)
        f.facing = this.fighters[1 - i].x >= f.x ? 1 : -1;
      if (
        f.aim &&
        (twoHandWeapon(f.model)?.weaponType === "crossbow" ||
          (!f.action && !f.hop)) &&
        !f.grapple &&
        !f.finisher &&
        !f.knockdown &&
        f.stun === 0
      )
        f.facing = f.aim.x >= f.x ? 1 : -1;
      for (const hand of new Set([
        ...(c.throws ?? []),
        ...(c.attack === "throw" ? [c.hand ?? primaryHand(f.model)] : []),
      ]))
        this.startThrow(f, hand, handSlots[hand]);
      if (c.belt) this.startBeltUse(f, c.belt);
      const hands = new Set(c.attacks ?? []);
      if (c.attack === "quick") hands.add(c.hand ?? primaryHand(f.model));
      if (twoHandWeapon(f.model) && hands.size) {
        hands.clear();
        hands.add("rear");
      }
      for (const hand of hands) {
        if (!this.canAttack(f, "quick", hand)) continue;
        f.handActions[hand] = {
          id: ++this.sequence,
          name:
            weaponForHand(f.model, hand)?.weaponType === "crossbow"
              ? "shoot"
              : "quick",
          hand,
          elapsed: 0,
          duration:
            (weaponForHand(f.model, hand)?.weaponType === "crossbow"
              ? attackTimings.shoot.duration
              : twoHandWeapon(f.model)
                ? twoHandDuration(twoHandWeapon(f.model)!)
                : attackTimings.quick.duration) /
            (f.model.combatProfile?.attackSpeed ?? 1),
          hit: false,
        };
        f.relaxed = false;
        f.reaction = null;
      }
      const request =
        c.attack && c.attack !== "quick" && c.attack !== "throw"
          ? c.attack
          : c.recover
            ? "recover"
            : undefined;
      if (request && this.canAttack(f, request)) {
        if (request === "finish") f.action = null;
        f.bodyAction = {
          id: ++this.sequence,
          name: request,
          elapsed: 0,
          duration: attackTimings[request].duration,
          hit: false,
          hand: c.hand ?? primaryHand(f.model),
        };
        if (request === "finish")
          this.finishers.start(
            f,
            this.fighters[1 - i],
            weaponForHand(f.model, f.bodyAction.hand)!,
            f.bodyAction,
            this.previous?.[1 - i],
          );
        f.relaxed = false;
        f.reaction = null;
      }
      const hop = c.worldHop ? ((c.worldHop * f.facing) as -1 | 1) : c.hop;
      if (hop && this.canHop(f, hop)) {
        const kind = hopKind(hop);
        f.hop = {
          kind,
          phase: "anticipation",
          elapsed: 0,
          direction: c.worldHop ?? ((hop * f.facing) as 1 | -1),
        };
      }
      f.guard = Boolean(
        c.guard &&
        !f.action &&
        !f.hop &&
        !f.reaction &&
        !f.knockdown &&
        !f.parry,
      );
      if (f.guard) f.relaxed = false;
      if (
        c.jump &&
        f.action?.name !== "finish" &&
        f.action?.name !== "shove" &&
        !c.hop &&
        !f.hop &&
        !f.reaction &&
        f.y === 0 &&
        f.vy === 0 &&
        !f.knockdown
      ) {
        f.vy = -arenaRules.jumpSpeed;
      }
      const running = c.run;
      const flyingKick = f.action?.name === "kick" && (f.y < 0 || f.vy < 0);
      const movement =
        f.action?.name === "finish" || f.action?.name === "shove"
          ? 0
          : Math.max(-1, Math.min(1, c.move ?? 0));
      f.vx =
        movement *
        (carrying ? 80 : running ? arenaRules.run : arenaRules.walk) *
        (f.model.combatProfile?.movement ?? 1) *
        (f.guard ? 0.5 : (f.action && !flyingKick) || f.parry ? 0.7 : 1);
      if (f.hop)
        f.vx =
          f.hop.phase === "air"
            ? f.hop.direction * hopDefinitions[f.hop.kind].speed
            : 0;
      if (
        f.knockdown ||
        (f.action?.name === "kick" && f.y === 0 && f.vy === 0) ||
        f.stun > 0 ||
        f.reaction?.kind === "stagger" ||
        f.reaction?.kind === "parried"
      )
        f.vx = 0;
      f.vx += f.pushVx;
      f.pushVx =
        Math.sign(f.pushVx) *
        Math.max(0, Math.abs(f.pushVx) - arenaRules.pushFriction * dt);
      f.x = Math.max(
        carrying
          ? Math.min(f.x, arenaRules.minX + carryMargin)
          : arenaRules.minX,
        Math.min(
          carrying
            ? Math.max(f.x, arenaRules.maxX - carryMargin)
            : arenaRules.maxX,
          f.x + f.vx * dt,
        ),
      );
      if (f.y < 0 || f.vy < 0) {
        f.y += f.vy * dt + 0.5 * arenaRules.gravity * dt * dt;
        f.vy += arenaRules.gravity * dt;
        if (f.y >= 0) {
          f.y = 0;
          f.vy = 0;
          // Hops own their landing compression; do not replay the jump bounce.
          f.landed = f.hop ? 180 : 0;
          if (f.hop?.phase === "air") {
            f.hop.phase = "landing";
            f.hop.elapsed = 0;
          }
        }
      }
    });
    const [a, b] = this.fighters;
    const separation =
      32 *
      ((a.model.combatProfile?.size ?? 1) + (b.model.combatProfile?.size ?? 1));
    this.finishers.update(delta, (f) => f.timeScale ?? 1);
    this.grapples.update(
      delta,
      this.state,
      arenaRules.gravity,
      arenaRules.minX,
      arenaRules.maxX,
      (f) => f.timeScale ?? 1,
    );
    if (
      !this.grapples.blocksSeparation() &&
      !a.knockdown &&
      !b.knockdown &&
      Math.abs(a.y - b.y) < 180 &&
      Math.abs(a.x - b.x) < separation
    ) {
      const sign = a.x <= b.x ? -1 : 1;
      const middle = Math.max(
        arenaRules.minX + separation / 2,
        Math.min(arenaRules.maxX - separation / 2, (a.x + b.x) / 2),
      );
      a.x = middle + (sign * separation) / 2;
      b.x = middle - (sign * separation) / 2;
    }
    if (dt > 0)
      this.fighters.forEach((f, i) => {
        f.vx = (f.x - before[i]) / dt;
      });
  }
  resolve(geometry: [CombatGeometry, CombatGeometry]): ContactEvent[] {
    if (this.state !== "Fighting") return [];
    const events: ContactEvent[] = [];
    const execution = this.finishers.resolve(geometry, this.fighters);
    if (execution) events.push(execution);
    this.fighters.forEach((f, i) => {
      for (const swing of activeActions(f)) {
        if (swing.name === "drink") {
          const definition = item(swing.itemId ?? "");
          if (
            !swing.released &&
            swing.elapsed / swing.duration >= attackTimings.drink.from &&
            definition?.use === "drink" &&
            swing.sourceSlot &&
            f.model.equipment[swing.sourceSlot] === definition.id
          ) {
            if (definition.effect === "haste")
              f.speedRemaining = definition.durationMs ?? 10000;
            else
              f.hp = Math.min(stats(f.model).hp, f.hp + (definition.heal ?? 0));
            this.consume(f, swing, definition.id);
          }
          continue;
        }
        if (swing.name === "shoot") {
          const weapon = weaponForHand(f.model, swing.hand),
            origin = geometry[i].muzzles?.[swing.hand];
          if (
            !swing.released &&
            swing.elapsed / swing.duration >= attackTimings.shoot.from &&
            weapon?.weaponType === "crossbow" &&
            origin
          ) {
            swing.released = true;
            f.rangedCooldown = 2080 / (f.model.combatProfile?.attackSpeed ?? 1);
            const { vx, vy } = f.aim
              ? aimedVelocity(origin, f.aim)
              : { vx: f.facing * 1150, vy: -20 };
            const angle = Math.atan2(vy, vx) + Math.PI / 2;
            this.projectiles.push({
              id: swing.id,
              kind: "bolt",
              timeScale: fighterSpeed(f),
              ownerId: f.model.id,
              itemId: weapon.id,
              sourceSlot: "rightHand",
              hand: swing.hand,
              ...origin,
              vx,
              vy,
              angle,
              spin: 0,
              previous: { ...origin, angle },
              floorRadius: 4,
              attack: stats(f.model, swing.hand).attack,
              profile: { startY: -34, endY: 12, radius: 2 },
              age: 0,
              state: "flying",
            });
          }
          continue;
        }
        if (swing.name === "throw") {
          if (
            !swing.released &&
            swing.elapsed / swing.duration >= attackTimings.throw.from
          ) {
            const definition = item(swing.itemId ?? ""),
              slot = swing.sourceSlot;
            const origin =
              geometry[i].grips?.[swing.hand] ??
              geometry[i].hands?.[swing.hand].a;
            if (
              definition &&
              slot &&
              origin &&
              f.model.equipment[slot] === definition.id
            ) {
              this.consume(f, swing, definition.id);
              const speed =
                definition.weaponType === "spear"
                  ? 800
                  : definition.visual === "throwing-axe"
                    ? 600
                    : 700;
              const vx = f.facing * speed + (f.vx / (f.timeScale ?? 1)) * 0.35,
                vy = -120;
              const angle = Math.atan2(vy, vx) + Math.PI / 2;
              this.projectiles.push({
                id: swing.id,
                timeScale: fighterSpeed(f),
                ownerId: f.model.id,
                itemId: definition.id,
                sourceSlot: slot,
                hand: swing.hand,
                ...origin,
                vx,
                vy,
                angle,
                spin:
                  definition.weaponType === "spear"
                    ? 0
                    : f.facing *
                      (definition.visual === "throwing-axe" ? 10 : 5),
                previous: { ...origin, angle },
                floorRadius:
                  geometry[i].launch?.[swing.hand]?.floorRadius ??
                  projectileFloorRadius(definition),
                attack: swing.throwAttack ?? definition.attack,
                profile:
                  geometry[i].launch?.[swing.hand]?.profile ??
                  projectileProfile(definition),
                age: 0,
                state: "flying",
              });
            }
          }
          continue;
        }
        if (swing.name === "recover" || swing.name === "finish" || swing.hit)
          continue;
        const weapon = weaponForHand(f.model, swing.hand);
        if (swing.name === "quick" && !weapon) continue;
        const shape = (g: CombatGeometry) =>
          swing.name === "shove"
            ? g.shove
            : swing.name === "kick"
              ? g.feet?.front
              : weapon
                ? g.blades
                  ? g.blades[swing.hand]
                  : g.blade
                : g.hands?.[swing.hand];
        const strike = shape(geometry[i]);
        if (!strike) continue;
        const timing = attackTimings[swing.name],
          phase = swing.elapsed / swing.duration;
        if (phase < timing.from || phase > timing.to) continue;
        const other = 1 - i;
        // A facing flip is a discrete orientation change, not a blade sweep.
        const previous =
          this.previous &&
          this.previousActive[i]?.has(swing.id) &&
          this.previousFacing[i] === f.facing &&
          this.previousFacing[other] === this.fighters[other].facing
            ? this.previous
            : geometry;
        const blade = strike,
          oldBlade = shape(previous[i]) ?? blade;
        let collision: ReturnType<typeof sweptContact> = null;
        let hitRegion: ArmorSlot = "body";
        for (let index = 0; index < geometry[other].body.length; index++) {
          const part = geometry[other].body[index];
          const candidate = sweptContact(
            oldBlade,
            blade,
            previous[other].body[index] ?? part,
            part,
          );
          if (candidate && (!collision || candidate.time < collision.time)) {
            collision = candidate;
            hitRegion =
              geometry[other].bodyRegions?.[index] ??
              (index === 0 ? "helmet" : "body");
          }
        }
        if (collision) {
          swing.hit = true;
          const defender = this.fighters[other];
          events.push({
            id: swing.id,
            attackerId: f.model.id,
            defenderId: defender.model.id,
            kind:
              swing.name === "shove"
                ? "shove"
                : swing.name === "kick"
                  ? "kick"
                  : "weapon",
            hand: swing.hand,
            damage:
              swing.name === "kick" || swing.name === "shove"
                ? 0
                : damage(f.model, defender.model, swing.hand),
            hitRegion,
            rawDamage: swing.name === "quick" ? (weapon?.attack ?? 0) : 0,
            blocked:
              swing.name === "quick" &&
              damage(f.model, defender.model, swing.hand) === 0,
            knockdown:
              swing.name === "kick" &&
              !defender.knockdown &&
              this.random() < knockdownTiming.chance,
            ...collision,
          });
        }
      }
    });
    for (const p of this.projectiles) {
      if (p.state !== "flying") continue;
      const target = this.fighters.findIndex((f) => f.model.id !== p.ownerId),
        defender = this.fighters[target];
      if (
        p.kind === "bolt" &&
        defender.parry &&
        defender.parry.elapsed < parryRules.window &&
        p.vx * defender.facing < 0
      ) {
        const guard = geometry[target];
        const surfaces = parrySurfaces(guard);
        const previousSurfaces =
          this.previousFacing[target] === defender.facing && this.previous
            ? parrySurfaces(this.previous[target])
            : surfaces;
        const collision = surfaces
          .map((surface, index) =>
            sweptContact(
              projectileShape(p, true),
              projectileShape(p),
              previousSurfaces[index] ?? surface,
              surface,
            ),
          )
          .find(Boolean);
        if (collision) {
          const attackerId = p.ownerId;
          deflectBolt(
            p,
            collision.point,
            defender.model.id,
            this.procRandom.deflect ?? Math.random,
          );
          events.push({
            id: p.id,
            attackerId,
            defenderId: defender.model.id,
            hand: p.hand,
            kind: "projectile",
            damage: 0,
            blocked: true,
            parried: true,
            deflected: true,
            knockdown: false,
            ...collision,
          });
          continue;
        }
      }
      let collision: ReturnType<typeof sweptContact> = null;
      let hitPart = 0;
      for (let part = 0; part < geometry[target].body.length; part++) {
        const body = geometry[target].body[part];
        const candidate = sweptContact(
          projectileShape(p, true),
          projectileShape(p),
          p.age > 0 && this.previousFacing[target] === defender.facing
            ? (this.previous?.[target].body[part] ?? body)
            : body,
          body,
        );
        if (candidate && (!collision || candidate.time < collision.time)) {
          collision = candidate;
          hitPart = part;
        }
      }
      if (collision) {
        p.state = "spent";
        p.vx *= 0.18;
        p.vy = Math.max(60, p.vy);
        p.spin *= 0.3;
        events.push({
          id: p.id,
          attackerId: p.ownerId,
          defenderId: defender.model.id,
          hand: p.hand,
          kind: "projectile",
          damage: damageAfterArmor(p.attack, defender.model),
          rawDamage: p.attack,
          hitRegion:
            geometry[target].bodyRegions?.[hitPart] ??
            (hitPart === 0 ? "helmet" : "body"),
          blocked: damageAfterArmor(p.attack, defender.model) === 0,
          knockdown: false,
          ...collision,
        });
      }
    }
    this.projectiles.forEach((p) => settleProjectile(p, arenaRules.floor));
    const parriedAttackers = new Set<string>();
    for (const e of events) {
      const defender = this.fighters.find((f) => f.model.id === e.defenderId)!;
      const attacker = this.fighters.find((f) => f.model.id === e.attackerId)!;
      if (
        e.kind === "weapon" &&
        defender.parry &&
        defender.parry.elapsed < parryRules.window &&
        (attacker.x - defender.x) * defender.facing >= 0
      ) {
        e.parried = e.blocked = true;
        e.damage = 0;
        e.knockdown = false;
        defender.parry.succeeded = true;
        defender.parry.targetId = attacker.model.id;
        defender.parry.shoveAge ??= 0;
        if (e.kind === "weapon" && !defender.parry.disarmAttempted) {
          defender.parry.disarmAttempted = true;
          if (
            (this.procRandom.disarm ?? Math.random)() < parryRules.disarmChance
          )
            e.disarmed = this.disarm(
              attacker,
              e.hand,
              geometry[this.fighters.indexOf(attacker)],
            );
        }
        parriedAttackers.add(attacker.model.id);
      }
    }
    for (const id of parriedAttackers) {
      const f = this.fighters.find((f) => f.model.id === id)!;
      f.stun = Math.max(f.stun, parryRules.stun);
      f.reaction = {
        id: ++this.sequence,
        kind: "parried",
        elapsed: 0,
        duration: parryRules.stun,
        direction: -f.facing as 1 | -1,
      };
      f.action = null;
      f.parry = null;
      f.hop = null;
      f.guard = false;
      f.relaxed = false;
      f.pushVx = 0;
      f.bodyCooldown = Math.max(f.bodyCooldown, parryRules.stun);
      for (const hand of ["front", "rear"] as const)
        f.handCooldowns[hand] = Math.max(
          f.handCooldowns[hand],
          parryRules.stun,
        );
    }
    // Resolve trades from the same physical instant before deciding the outcome.
    for (const e of events) {
      if (e.parried) {
        this.contacts.push(e);
        continue;
      }
      const defender = this.fighters.find((f) => f.model.id === e.defenderId)!;
      if (
        (e.kind === "weapon" || e.kind === "projectile") &&
        (e.rawDamage ?? 0) > 0
      ) {
        const hadArmor = Boolean(
          defender.model.equipment.helmet || defender.model.equipment.body,
        );
        const broken = wearArmor(
          defender.model,
          e.rawDamage!,
          e.hitRegion ?? "body",
        );
        if (hadArmor) this.armorRevision++;
        for (const piece of broken) {
          const id = ++this.sequence;
          const shape =
            geometry[this.fighters.indexOf(defender)].body[
              piece.slot === "helmet" ? 0 : 1
            ];
          const point = shape
            ? { x: (shape.a.x + shape.b.x) / 2, y: (shape.a.y + shape.b.y) / 2 }
            : e.point;
          this.armorBreaks.push({
            id,
            ownerId: defender.model.id,
            ...piece,
            point,
          });
          this.consumedItems.push({
            ownerId: defender.model.id,
            itemId: piece.itemId,
            sourceSlot: piece.slot,
            actionId: id,
          });
        }
      }
      defender.hp = Math.max(0, defender.hp - e.damage);
      const attacker = this.fighters.find((f) => f.model.id === e.attackerId)!;
      const direction: 1 | -1 = attacker.x <= defender.x ? 1 : -1;
      if (defender.knockdown) {
        // Further contact still deals damage without restarting a floor transfer.
        this.contacts.push(e);
        continue;
      }
      if (
        e.kind === "weapon" &&
        !e.blocked &&
        defender.hp > 0 &&
        weaponForHand(attacker.model, e.hand)?.weaponType === "hammer"
      ) {
        e.knockdown =
          (this.procRandom.hammerKnockdown ?? Math.random)() <
          hammerRules.knockdownChance;
        e.pushed =
          (this.procRandom.hammerPush ?? Math.random)() <
          hammerRules.pushChance;
      }
      const strongPush = e.kind === "kick" || e.kind === "shove" || e.pushed;
      if (e.knockdown) defender.knockdown = { phase: "fall", elapsed: 0 };
      defender.stun = Math.max(
        defender.stun,
        strongPush ? arenaRules.kickStun : arenaRules.hitStun,
      );
      if (defender.reaction?.kind !== "parried")
        defender.reaction = e.knockdown
          ? null
          : {
              id: e.id,
              kind: strongPush ? "stagger" : "hit",
              elapsed: 0,
              duration: strongPush
                ? arenaRules.staggerDuration
                : arenaRules.hitReaction,
              direction,
            };
      defender.pushVx = direction * (strongPush ? arenaRules.kickImpulse : 65);
      defender.action = null;
      defender.parry = null;
      defender.hop = null;
      defender.guard = false;
      defender.relaxed = false;
      defender.bodyCooldown = Math.max(defender.bodyCooldown, 180);
      for (const hand of ["front", "rear"] as const)
        defender.handCooldowns[hand] = Math.max(
          defender.handCooldowns[hand],
          180,
        );
      this.contacts.push(e);
    }
    if (this.contacts.length > 32)
      this.contacts.splice(0, this.contacts.length - 32);
    this.previous = geometry;
    this.previousFacing = this.fighters.map((f) => f.facing);
    this.previousActive = this.fighters.map(
      (f) =>
        new Set(
          activeActions(f)
            .filter((a) => {
              const t = a.elapsed / a.duration,
                timing = attackTimings[a.name];
              return a.name !== "recover" && t >= timing.from && t <= timing.to;
            })
            .map((a) => a.id),
        ),
    );
    if (this.player.hp === 0 && this.enemy.hp === 0) this.state = "Draw";
    else if (this.enemy.hp === 0) this.state = "Victory";
    else if (this.player.hp === 0) this.state = "Defeat";
    if (this.state !== "Fighting") {
      for (const fighter of this.fighters)
        if (repairArmor(fighter.model)) this.armorRevision++;
      this.grapples.end();
      this.finishers.end();
    }
    return events;
  }
}
