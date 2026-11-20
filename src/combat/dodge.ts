import type { ArenaFighter, ArenaInput } from "./realtime";

export const dodgeRules = {
  speed: 1.2,
  enter: 180 / 1.2,
  hold: 360 / 1.2,
  recover: 180 / 1.2,
  retreat: 360 / 1.2,
  attackReturn: 72 / 1.2,
  retreatSpeed: 480 * 1.2,
  cooldown: 180 / 1.2,
} as const;
export interface Dodge {
  phase: "lean" | "retreat" | "recover" | "attackReturn";
  elapsed: number;
  direction: 1 | -1;
  pending?: Pick<ArenaInput, "attack" | "attacks" | "hand">;
}
export function canDodge(f: ArenaFighter) {
  return (
    f.hp > 0 &&
    f.y === 0 &&
    f.vy === 0 &&
    !f.action &&
    !f.parry &&
    !f.hop &&
    !f.grapple &&
    !f.finisher &&
    !f.knockdown &&
    !f.reaction &&
    f.stun === 0 &&
    !f.dodge &&
    (f.dodgeCooldown ?? 0) === 0
  );
}
export function dodgeDuration(d: Dodge) {
  return d.phase === "lean"
    ? dodgeRules.enter + dodgeRules.hold
    : dodgeRules[d.phase];
}
