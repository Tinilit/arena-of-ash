import type { Player } from "../domain/model";
import { primaryWeapon } from "../domain/progression";
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
  jumpCost: 10,
  staminaRegen: 14,
};
export const attackTimings = {
  quick: { duration: 650, from: 0.3, to: 0.7 },
  heavy: { duration: 1100, from: 0.46, to: 0.8 },
  recover: { duration: 750, from: 1, to: 1 },
} as const;
export type Attack = "quick" | "heavy";
export type ArenaAction = Attack | "recover";
export type ArenaState = "Fighting" | "Victory" | "Defeat" | "Draw";
export interface ArenaInput {
  move?: number;
  run?: boolean;
  jump?: boolean;
  hop?: -1 | 1;
  attack?: Attack;
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
}
export interface ContactEvent {
  id: number;
  attackerId: string;
  defenderId: string;
  damage: number;
  blocked: boolean;
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
  constructor(player: Player, enemy: Player) {
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
      !f.action &&
      f.stamina >= actions[name].cost &&
      (name === "recover" || Boolean(primaryWeapon(f.model)))
    );
  }
  canHop(f: ArenaFighter, direction: -1 | 1) {
    return (
      this.state === "Fighting" &&
      f === this.player &&
      f.hp > 0 &&
      f.y === 0 &&
      f.vy === 0 &&
      !f.hop &&
      f.hopCooldown === 0 &&
      f.stamina >= hopDefinitions[hopKind(direction)].cost
    );
  }
  advance(delta: number, input: [ArenaInput, ArenaInput]) {
    if (this.state !== "Fighting") return;
    const dt = delta / 1000;
    const before = this.fighters.map((f) => f.x);
    this.fighters.forEach((f, i) => {
      f.landed += delta;
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
          if (f.action.name === "recover")
            f.stamina = Math.min(stats(f.model).stamina, f.stamina + 25);
          f.action = null;
        }
      }
      const c = input[i];
      if (c.toggleStance) f.relaxed = !f.relaxed;
      if (!f.action && !f.hop)
        f.facing = this.fighters[1 - i].x >= f.x ? 1 : -1;
      const request = c.attack ?? (c.recover ? "recover" : undefined);
      if (request && this.canAttack(f, request)) {
        f.stamina -= actions[request].cost;
        f.action = {
          id: ++this.sequence,
          name: request,
          elapsed: 0,
          duration: attackTimings[request].duration,
          hit: false,
        };
        f.relaxed = false;
      }
      if (i === 0 && c.hop && this.canHop(f, c.hop)) {
        const kind = hopKind(c.hop);
        f.stamina -= hopDefinitions[kind].cost;
        f.hop = {
          kind,
          phase: "anticipation",
          elapsed: 0,
          direction: (c.hop * f.facing) as 1 | -1,
        };
      }
      f.guard = Boolean(
        c.guard && !f.action && !f.hop && f.stamina >= (f.guard ? 0.1 : 10),
      );
      if (f.guard) f.relaxed = false;
      if (
        c.jump &&
        !c.hop &&
        !f.hop &&
        f.y === 0 &&
        f.vy === 0 &&
        f.stamina >= arenaRules.jumpCost
      ) {
        f.vy = -arenaRules.jumpSpeed;
        f.stamina -= arenaRules.jumpCost;
      }
      const running = c.run && f.stamina >= 1;
      const movement = Math.max(-1, Math.min(1, c.move ?? 0));
      f.vx =
        movement *
        (running ? arenaRules.run : arenaRules.walk) *
        Math.max(
          0.8,
          Math.min(1.5, 1 + (f.model.attributes.agility - 10) * 0.01),
        ) *
        (f.guard ? 0.5 : f.action ? 0.7 : 1);
      if (f.hop)
        f.vx =
          f.hop.phase === "air"
            ? f.hop.direction * hopDefinitions[f.hop.kind].speed
            : 0;
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
      const drain = f.hop ? 0 : f.guard ? 8 : running && movement ? 10 : 0;
      const regeneration = arenaRules.staminaRegen;
      f.stamina = Math.max(
        0,
        Math.min(
          stats(f.model).stamina,
          f.stamina + (regeneration - drain) * dt,
        ),
      );
    });
    const [a, b] = this.fighters;
    if (Math.abs(a.y - b.y) < 180 && Math.abs(a.x - b.x) < 64) {
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
      if (!swing || swing.name === "recover" || swing.hit || !geometry[i].blade)
        return;
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
      const blade = geometry[i].blade!,
        oldBlade = previous[i].blade ?? blade;
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
          damage: damage(
            f.model,
            defender.model,
            actions[swing.name].multiplier,
            false,
            defender.guard,
          ),
          blocked: defender.guard,
          ...collision,
        });
      }
    });
    // Resolve trades from the same physical instant before deciding the outcome.
    for (const e of events) {
      const defender = this.fighters.find((f) => f.model.id === e.defenderId)!;
      defender.hp = Math.max(0, defender.hp - e.damage);
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
