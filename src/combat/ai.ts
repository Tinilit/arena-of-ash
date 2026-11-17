import type { Fighter, Action } from "./engine";
import type { Random } from "../utils/random";
export function decide(f: Fighter, rng: Random): Action {
  if (f.stamina < 12) return "recover";
  const roll = rng();
  if (roll < 0.15) return "defend";
  if (roll < 0.5 && f.stamina >= 25) return "heavy";
  return "quick";
}
