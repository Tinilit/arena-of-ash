import type { Player, Hand } from "../domain/model";
import { primaryHand, weaponForHand } from "../domain/progression";
import { stats } from "../domain/progression";
import { actions, damage, fighter, type Fighter } from "./engine";
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
export const attackTimings = {
  quick: { duration: 1000, from: 0.45, to: 0.67 },
  kick: { duration: 1050, from: 0.36, to: 0.56 },
  heavy: { duration: 1100, from: 0.46, to: 0.8 },
  recover: { duration: 750, from: 1, to: 1 },
} as const;
export type Attack = "quick" | "heavy" | "kick";
export type ArenaAction = Attack | "recover";
export type ArenaState = "Fighting" | "Victory" | "Defeat" | "Draw";
export interface ArenaInput {
  move?: number;
  run?: boolean;
  jump?: boolean;
  hop?: -1 | 1;
  attack?: Attack;
  hand?: Hand;
  guard?: boolean;
  recover?: boolean;
  toggleStance?: boolean;
}
export interface Swing {
  id: number;
  name: ArenaAction;
  elapsed: number;
  duration: number;
  hit: boolean;
  hand: Hand;
}
export interface ArenaFighter extends Fighter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  action: Swing | null;
  relaxed: boolean;
  landed: number;
  hop: Hop | null;
  hopCooldown: number;
  attackCooldown: number;
  stun: number;
  pushVx: number;
  knockdown: { phase: "fall" | "down" | "getUp"; elapsed: number } | null;
  reaction: {
    id: number;
    kind: "hit" | "stagger";
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
  blocked: boolean;
  knockdown: boolean;
  kind: "weapon" | "punch" | "kick";
  hand: Hand;
  point: Point;
  blade: Capsule;
  body: Capsule;
}
function actor(model: Player, x: number, facing: 1 | -1): ArenaFighter {
  return {
    ...fighter(structuredClone(model)),
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    action: null,
    relaxed: false,
    landed: 1000,
    hop: null,
    hopCooldown: 0,
    attackCooldown: 0,
    stun: 0,
    pushVx: 0,
    reaction: null,
    knockdown: null,
  };
}
export class RealtimeBattle {
  state: ArenaState = "Fighting";
  readonly fighters: [ArenaFighter, ArenaFighter];
  readonly contacts: ContactEvent[] = [];
  private sequence = 0;
  private previous?: [CombatGeometry, CombatGeometry];
  private previousFacing: number[] = [];
  private previousActive: number[] = [];
  constructor(
    player: Player,
    enemy: Player,
    private random: () => number = Math.random,
  ) {
    this.fighters = [actor(player, 370, 1), actor(enemy, 910, -1)];
  }
  get player() {
    return this.fighters[0];
  }
  get enemy() {
    return this.fighters[1];
  }
  canAttack(f: ArenaFighter, name: ArenaAction) {
    return (
      this.state === "Fighting" &&
      f.hp > 0 &&
      name !== "heavy" &&
      !f.knockdown &&
      f.stun === 0 &&
      f.attackCooldown === 0 &&
      !f.action &&
      (name !== "kick" || (f.y === 0 && f.vy === 0 && !f.hop)) &&
      f.reaction?.kind !== "stagger"
    );
  }
  canHop(f: ArenaFighter, direction: -1 | 1) {
    return (
      this.state === "Fighting" &&
      (direction === -1 || direction === 1) &&
      f === this.player &&
      f.hp > 0 &&
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
    const dt = delta / 1000;
    const before = this.fighters.map((f) => f.x);
    this.fighters.forEach((f, i) => {
      f.landed += delta;
      f.stun = Math.max(0, f.stun - delta);
      f.attackCooldown = Math.max(0, f.attackCooldown - delta);
      if (f.reaction) {
        f.reaction.elapsed += delta;
        if (f.reaction.elapsed >= f.reaction.duration) f.reaction = null;
      }
      f.hopCooldown = Math.max(0, f.hopCooldown - delta);
      if (f.hop) {
        const h = f.hop,
          definition = hopDefinitions[h.kind];
        h.elapsed += delta;
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
      if (f.action) {
        f.action.elapsed += delta;
        if (f.action.elapsed >= f.action.duration) {
          f.attackCooldown = f.action.name === "kick" ? 350 : 280;
          f.action = null;
        }
      }
      if (f.knockdown) {
        const k = f.knockdown;
        k.elapsed += delta;
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
      const c =
        f.knockdown || f.stun > 0 || f.reaction?.kind === "stagger"
          ? {}
          : input[i];
      if (c.toggleStance) f.relaxed = !f.relaxed;
      if (!f.action && !f.hop && !f.reaction && !f.knockdown)
        f.facing = this.fighters[1 - i].x >= f.x ? 1 : -1;
      const request = c.attack ?? (c.recover ? "recover" : undefined);
      if (request && this.canAttack(f, request)) {
        f.action = {
          id: ++this.sequence,
          name: request,
          elapsed: 0,
          duration: attackTimings[request].duration,
          hit: false,
          hand: c.hand ?? primaryHand(f.model),
        };
        f.relaxed = false;
        f.reaction = null;
      }
      if (i === 0 && c.hop && this.canHop(f, c.hop)) {
        const kind = hopKind(c.hop);
        f.hop = {
          kind,
          phase: "anticipation",
          elapsed: 0,
          direction: (c.hop * f.facing) as 1 | -1,
        };
      }
      f.guard = Boolean(
        c.guard && !f.action && !f.hop && !f.reaction && !f.knockdown,
      );
      if (f.guard) f.relaxed = false;
      if (
        c.jump &&
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
      const movement = Math.max(-1, Math.min(1, c.move ?? 0));
      f.vx =
        movement *
        (running ? arenaRules.run : arenaRules.walk) *
        (f.guard ? 0.5 : f.action ? 0.7 : 1);
      if (f.hop)
        f.vx =
          f.hop.phase === "air"
            ? f.hop.direction * hopDefinitions[f.hop.kind].speed
            : 0;
      if (
        f.knockdown ||
        f.action?.name === "kick" ||
        f.stun > 0 ||
        f.reaction?.kind === "stagger"
      )
        f.vx = 0;
      f.vx += f.pushVx;
      f.pushVx =
        Math.sign(f.pushVx) *
        Math.max(0, Math.abs(f.pushVx) - arenaRules.pushFriction * dt);
      f.x = Math.max(
        arenaRules.minX,
        Math.min(arenaRules.maxX, f.x + f.vx * dt),
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
    if (
      !a.knockdown &&
      !b.knockdown &&
      Math.abs(a.y - b.y) < 180 &&
      Math.abs(a.x - b.x) < 64
    ) {
      const sign = a.x <= b.x ? -1 : 1;
      const middle = Math.max(
        arenaRules.minX + 32,
        Math.min(arenaRules.maxX - 32, (a.x + b.x) / 2),
      );
      a.x = middle + sign * 32;
      b.x = middle - sign * 32;
    }
    if (dt > 0)
      this.fighters.forEach((f, i) => {
        f.vx = (f.x - before[i]) / dt;
      });
  }
  resolve(geometry: [CombatGeometry, CombatGeometry]): ContactEvent[] {
    if (this.state !== "Fighting") return [];
    const events: ContactEvent[] = [];
    this.fighters.forEach((f, i) => {
      const swing = f.action;
      if (!swing || swing.name === "recover" || swing.hit) return;
      const weapon = weaponForHand(f.model, swing.hand);
      const shape = (g: CombatGeometry) =>
        swing.name === "kick"
          ? g.feet?.front
          : weapon
            ? g.blades
              ? g.blades[swing.hand]
              : g.blade
            : g.hands?.[swing.hand];
      const strike = shape(geometry[i]);
      if (!strike) return;
      const timing = attackTimings[swing.name],
        phase = swing.elapsed / swing.duration;
      if (phase < timing.from || phase > timing.to) return;
      const other = 1 - i;
      // A facing flip is a discrete orientation change, not a blade sweep.
      const previous =
        this.previous &&
        this.previousActive[i] === swing.id &&
        this.previousFacing[i] === f.facing &&
        this.previousFacing[other] === this.fighters[other].facing
          ? this.previous
          : geometry;
      const blade = strike,
        oldBlade = shape(previous[i]) ?? blade;
      let collision: ReturnType<typeof sweptContact> = null;
      for (let index = 0; index < geometry[other].body.length; index++) {
        const part = geometry[other].body[index];
        collision = sweptContact(
          oldBlade,
          blade,
          previous[other].body[index] ?? part,
          part,
        );
        if (collision) break;
      }
      if (collision) {
        swing.hit = true;
        const defender = this.fighters[other];
        events.push({
          id: swing.id,
          attackerId: f.model.id,
          defenderId: defender.model.id,
          kind: swing.name === "kick" ? "kick" : weapon ? "weapon" : "punch",
          hand: swing.hand,
          damage:
            swing.name === "kick"
              ? Math.max(
                  1,
                  Math.round(
                    (12 - stats(defender.model).armor * 0.5) *
                      (defender.guard ? 0.5 : 1),
                  ),
                )
              : damage(
                  f.model,
                  defender.model,
                  actions[swing.name].multiplier,
                  false,
                  defender.guard,
                  swing.hand,
                ),
          blocked: defender.guard,
          knockdown:
            swing.name === "kick" &&
            !defender.knockdown &&
            this.random() < knockdownTiming.chance,
          ...collision,
        });
      }
    });
    // Resolve trades from the same physical instant before deciding the outcome.
    for (const e of events) {
      const defender = this.fighters.find((f) => f.model.id === e.defenderId)!;
      defender.hp = Math.max(0, defender.hp - e.damage);
      const attacker = this.fighters.find((f) => f.model.id === e.attackerId)!;
      const direction: 1 | -1 = attacker.x <= defender.x ? 1 : -1;
      if (defender.knockdown) {
        // Further contact still deals damage without restarting a floor transfer.
        this.contacts.push(e);
        continue;
      }
      if (e.knockdown) defender.knockdown = { phase: "fall", elapsed: 0 };
      defender.stun =
        e.kind === "kick" ? arenaRules.kickStun : arenaRules.hitStun;
      defender.reaction = e.knockdown
        ? null
        : {
            id: e.id,
            kind: e.kind === "kick" ? "stagger" : "hit",
            elapsed: 0,
            duration:
              e.kind === "kick"
                ? arenaRules.staggerDuration
                : arenaRules.hitReaction,
            direction,
          };
      defender.pushVx =
        direction * (e.kind === "kick" ? arenaRules.kickImpulse : 65);
      defender.action = null;
      defender.hop = null;
      defender.guard = false;
      defender.relaxed = false;
      defender.attackCooldown = Math.max(defender.attackCooldown, 180);
      this.contacts.push(e);
    }
    if (this.contacts.length > 32)
      this.contacts.splice(0, this.contacts.length - 32);
    this.previous = geometry;
    this.previousFacing = this.fighters.map((f) => f.facing);
    this.previousActive = this.fighters.map((f) => {
      const a = f.action;
      if (!a || a.name === "recover") return -1;
      const t = a.elapsed / a.duration,
        timing = attackTimings[a.name];
      return t >= timing.from && t <= timing.to ? a.id : -1;
    });
    if (this.player.hp === 0 && this.enemy.hp === 0) this.state = "Draw";
    else if (this.enemy.hp === 0) this.state = "Victory";
    else if (this.player.hp === 0) this.state = "Defeat";
    return events;
  }
}
