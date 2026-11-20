import type { ArenaFighter, ArenaInput, ArenaState } from "./realtime";
export const grappleRules = {
  reach: 105,
  anticipation: 420,
  lift: 1000,
  throwDuration: 480,
  release: 170,
  cooldown: 1800,
  flightSpeed: 360,
  launchSpeed: 280,
};
export type GrapplePhase = "reach" | "lift" | "hold" | "throw" | "air";
export interface GrapplePoseState {
  role: "lifter" | "target";
  phase: GrapplePhase;
  elapsed: number;
}
interface Hold {
  lifter: ArenaFighter;
  target: ArenaFighter;
  phase: GrapplePhase;
  elapsed: number;
  queued: boolean;
  released: boolean;
  startX: number;
  startY: number;
  flightAge: number;
}
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
/** Coupled, zero-damage grab/lift/throw. The normal knockdown owns floor recovery. */
export class GrappleController {
  private hold: Hold | null = null;
  canStart(state: ArenaState, a: ArenaFighter, b: ArenaFighter) {
    return (
      state === "Fighting" &&
      !this.hold &&
      a.hp > 0 &&
      b.hp > 0 &&
      !a.finisher &&
      !b.finisher &&
      !a.action &&
      !a.parry &&
      !a.hop &&
      !a.dodge &&
      !a.knockdown &&
      !a.reaction &&
      a.stun === 0 &&
      (a.grappleCooldown ?? 0) === 0 &&
      a.y === 0 &&
      a.vy === 0 &&
      b.y === 0 &&
      b.vy === 0 &&
      !b.hop &&
      !b.knockdown &&
      Math.abs(a.x - b.x) <= grappleRules.reach
    );
  }
  command(
    state: ArenaState,
    a: ArenaFighter,
    b: ArenaFighter,
    input: ArenaInput,
  ) {
    if (!input.grapple) return;
    if (this.hold?.lifter === a) {
      this.hold.queued = true;
      return;
    }
    if (!this.canStart(state, a, b)) return;
    this.hold = {
      lifter: a,
      target: b,
      phase: "reach",
      elapsed: 0,
      queued: false,
      released: false,
      startX: b.x,
      startY: b.y,
      flightAge: 0,
    };
    a.relaxed = false;
    a.facing = b.x >= a.x ? 1 : -1;
    a.grapple = { role: "lifter", phase: "reach", elapsed: 0 };
  }
  update(
    delta: number,
    state: ArenaState,
    gravity: number,
    minX: number,
    maxX: number,
    speed: (f: ArenaFighter) => number = () => 1,
  ) {
    const h = this.hold;
    if (!h) return;
    const a = h.lifter,
      b = h.target;
    if (state !== "Fighting" || a.hp <= 0 || b.hp <= 0) {
      this.cancel();
      return;
    }
    if (!h.released && (a.stun > 0 || a.knockdown || a.reaction)) {
      this.cancel();
      return;
    }
    delta *= speed(a);
    h.elapsed += delta;
    if (h.phase === "reach" && h.elapsed >= grappleRules.anticipation) {
      if (
        Math.abs(a.x - b.x) > grappleRules.reach ||
        b.y !== 0 ||
        b.knockdown
      ) {
        this.cancel();
        return;
      }
      h.phase = "lift";
      h.elapsed = 0;
      h.startX = b.x;
      h.startY = b.y;
      b.action = null;
      b.parry = null;
      b.hop = null;
      b.dodge = null;
      b.guard = false;
      b.reaction = null;
      b.pushVx = 0;
      b.vx = b.vy = 0;
      b.grapple = { role: "target", phase: "lift", elapsed: 0 };
    } else if (h.phase === "lift" && h.elapsed >= grappleRules.lift) {
      h.phase = "hold";
      h.elapsed = 0;
    }
    if (h.phase === "hold" && h.queued) {
      h.phase = "throw";
      h.elapsed = 0;
    }
    if (
      h.phase === "throw" &&
      !h.released &&
      h.elapsed >= grappleRules.release
    ) {
      h.released = true;
      b.vx = a.facing * grappleRules.flightSpeed;
      b.vy = -grappleRules.launchSpeed;
      a.grappleCooldown = grappleRules.cooldown;
    }
    if (h.phase === "throw" && h.elapsed >= grappleRules.throwDuration) {
      a.grapple = undefined;
      h.phase = "air";
      h.elapsed = 0;
    }
    if (h.phase !== "air")
      a.grapple = { role: "lifter", phase: h.phase, elapsed: h.elapsed };
    if (h.phase !== "reach" && !h.released) {
      const t = h.phase === "lift" ? ease(h.elapsed / grappleRules.lift) : 1;
      // A carry near a wall must not release from outside the arena and snap
      // back to its bounds on the first flight step.
      b.x = Math.max(
        minX,
        Math.min(
          maxX,
          h.startX +
            (a.x +
              a.facing *
                (130 * (b.model.combatProfile?.size ?? 1) -
                  18 * (a.model.combatProfile?.size ?? 1)) -
              h.startX) *
              t,
        ),
      );
      b.y =
        h.startY + (-285 * (a.model.combatProfile?.size ?? 1) - h.startY) * t;
      b.facing = a.facing;
      b.vx = b.vy = 0;
      b.grapple = { role: "target", phase: h.phase, elapsed: h.elapsed };
    }
    if (h.released) {
      const dt = delta / 1000;
      h.flightAge += delta;
      b.x = Math.max(minX, Math.min(maxX, b.x + b.vx * dt));
      if (b.x === minX || b.x === maxX) b.vx = 0;
      b.y += b.vy * dt + 0.5 * gravity * dt * dt;
      b.vy += gravity * dt;
      b.grapple = { role: "target", phase: "air", elapsed: h.flightAge };
      if (b.y >= -32) {
        b.y = b.vy = b.vx = 0;
        b.grapple = undefined;
        b.stun = 0;
        b.reaction = null;
        b.knockdown = { phase: "fall", elapsed: 550 };
        a.grapple = undefined;
        this.hold = null;
      }
    }
  }
  blocksSeparation() {
    return Boolean(this.hold && this.hold.phase !== "reach");
  }
  end() {
    this.cancel();
  }
  private cancel() {
    const h = this.hold;
    if (!h) return;
    h.lifter.grapple = undefined;
    h.lifter.grappleCooldown = 500;
    if (h.target.grapple) {
      h.target.grapple = undefined;
      h.target.y = Math.min(0, h.target.y);
      h.target.vy = Math.max(0, h.target.vy);
    }
    this.hold = null;
  }
}
