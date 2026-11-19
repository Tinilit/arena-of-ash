import type { Player, Hand } from "../domain/model";
import { stats, weaponForHand, primaryHand } from "../domain/progression";

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
export function damageAfterArmor(raw: number, defender: Player) {
  return Math.max(0, raw - stats(defender).armor);
}
export function damage(a: Player, d: Player, hand: Hand = primaryHand(a)) {
  return damageAfterArmor(weaponForHand(a, hand)?.attack ?? 0, d);
}
