import { skillBalance } from "../domain/skills";
/** Shared facial state keeps real-time buffs independent from the renderer. */
export function faceExpression(
  painRemaining: number,
  rageRemaining = 0,
  activationRemaining = 0,
) {
  const age = 420 - painRemaining;
  const pain =
    painRemaining > 0
      ? Math.max(0, Math.min(1, age / 35, painRemaining / 150))
      : 0;
  const enraged = rageRemaining > 0;
  const progress = 1 - activationRemaining / skillBalance.rageActivation;
  const roar =
    enraged && activationRemaining > 0
      ? Math.max(0, Math.sin(Math.PI * Math.max(0, Math.min(1, progress))))
      : 0;
  return {
    pain,
    enraged,
    eyeColor: enraged ? 0xff3428 : 0x202c34,
    roar,
    mouth: enraged
      ? roar > 0.35
        ? "roar"
        : "snarl"
      : pain > 0.3
        ? "pain"
        : "neutral",
  };
}
