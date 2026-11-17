import type { Player } from "../domain/model";
import { stats } from "../domain/progression";
import type { Random } from "../utils/random";
export const actions = {
  quick: { cost: 12, accuracy: 0.9, multiplier: 1 },
  heavy: { cost: 25, accuracy: 0.72, multiplier: 1.6 },
  defend: { cost: 0, accuracy: 1, multiplier: 0 },
  recover: { cost: 0, accuracy: 1, multiplier: 0 },
};
export type Action = keyof typeof actions;
export type State =
  | "PlayerTurn"
  | "PlayerAnimating"
  | "EnemyThinking"
  | "EnemyAnimating"
  | "Resolving"
  | "Victory"
  | "Defeat";
export interface Fighter {
  model: Player;
  hp: number;
  stamina: number;
  guard: boolean;
}
export const fighter = (model: Player): Fighter => ({
  model,
  hp: stats(model).hp,
  stamina: stats(model).stamina,
  guard: false,
});
export const accuracy = (base: number, agility: number, other: number) =>
  Math.max(0.15, Math.min(0.95, base + (agility - other) * 0.01));
export const criticalChance = (agility: number) =>
  Math.min(0.25, Math.max(0, agility * 0.005));
export function damage(
  a: Player,
  d: Player,
  multiplier: number,
  critical: boolean,
  guard: boolean,
) {
  const raw = Math.max(
    1,
    Math.round(
      stats(a).attack * multiplier -
        d.attributes.defense * 0.35 -
        stats(d).armor,
    ),
  );
  return Math.max(
    1,
    Math.round(raw * (critical ? 1.5 : 1) * (guard ? 0.5 : 1)),
  );
}
export interface CombatEvent {
  id: number;
  action: Action;
  attackerId: string;
  defenderId: string;
  hit: boolean;
  critical: boolean;
  damage: number;
  staminaSpent: number;
  healthChange: number;
  outcome: "Victory" | "Defeat" | null;
}
export class Battle {
  state: State = "PlayerTurn";
  player: Fighter;
  enemy: Fighter;
  pending: CombatEvent | null = null;
  private applied = new Set<number>();
  private sequence = 0;
  constructor(
    p: Player,
    e: Player,
    private rng: Random,
  ) {
    this.player = fighter(p);
    this.enemy = fighter(e);
  }
  begin(action: Action): CombatEvent | null {
    if (this.state !== "PlayerTurn" && this.state !== "EnemyThinking")
      return null;
    const [a, d] =
      this.state === "PlayerTurn"
        ? [this.player, this.enemy]
        : [this.enemy, this.player];
    const def = actions[action];
    if (a.stamina < def.cost) return null;
    const attack = def.multiplier > 0;
    const hit =
      attack &&
      this.rng() <
        accuracy(
          def.accuracy,
          a.model.attributes.agility,
          d.model.attributes.agility,
        );
    const critical =
      hit && this.rng() < criticalChance(a.model.attributes.agility);
    const dealt = hit
      ? damage(a.model, d.model, def.multiplier, critical, d.guard)
      : 0;
    this.state = a === this.player ? "PlayerAnimating" : "EnemyAnimating";
    return (this.pending = {
      id: ++this.sequence,
      action,
      attackerId: a.model.id,
      defenderId: d.model.id,
      hit,
      critical,
      damage: dealt,
      staminaSpent: def.cost,
      healthChange: -Math.min(dealt, d.hp),
      outcome: null,
    });
  }
  impact(event: CombatEvent) {
    if (this.pending !== event || this.applied.has(event.id)) return false;
    this.applied.add(event.id);
    const a =
      event.attackerId === this.player.model.id ? this.player : this.enemy;
    const d = a === this.player ? this.enemy : this.player;
    a.stamina -= event.staminaSpent;
    if (event.action === "defend") {
      a.guard = true;
      a.stamina = Math.min(stats(a.model).stamina, a.stamina + 8);
    } else if (event.action === "recover")
      a.stamina = Math.min(stats(a.model).stamina, a.stamina + 25);
    else {
      d.hp = Math.max(0, d.hp - event.damage);
      d.guard = false;
    }
    event.outcome =
      this.enemy.hp === 0 ? "Victory" : this.player.hp === 0 ? "Defeat" : null;
    return true;
  }
  complete() {
    if (!this.pending || !this.applied.has(this.pending.id)) return;
    this.state =
      this.pending.outcome ??
      (this.pending.attackerId === this.player.model.id
        ? "EnemyThinking"
        : "PlayerTurn");
    this.pending = null;
  }
}
