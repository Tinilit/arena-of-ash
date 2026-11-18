import type { Player } from "../domain/model";
import { stats } from "../domain/progression";

export const actions = {
  quick: { cost: 12, multiplier: 1 },
  heavy: { cost: 25, multiplier: 1.6 },
  defend: { cost: 0, multiplier: 0 },
  recover: { cost: 0, multiplier: 0 },
};
export type Action = keyof typeof actions;
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
