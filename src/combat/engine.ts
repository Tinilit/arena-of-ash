import type { Player, Hand } from "../domain/model";
import { stats } from "../domain/progression";

export const actions = {
  quick: { multiplier: 1 },
  kick: { multiplier: 0 },
  heavy: { multiplier: 1.6 },
  defend: { multiplier: 0 },
  recover: { multiplier: 0 },
};
export type Action = keyof typeof actions;
export interface Fighter {
  model: Player;
  hp: number;
  guard: boolean;
}
export const fighter = (model: Player): Fighter => ({
  model,
  hp: stats(model).hp,
  guard: false,
});
export function damage(
  a: Player,
  d: Player,
  multiplier: number,
  critical: boolean,
  guard: boolean,
  hand?: Hand,
) {
  const raw = Math.max(
    1,
    Math.round(stats(a, hand).attack * multiplier - stats(d).armor),
  );
  return Math.max(
    1,
    Math.round(raw * (critical ? 1.5 : 1) * (guard ? 0.5 : 1)),
  );
}
