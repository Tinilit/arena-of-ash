import type { Hand } from "../domain/model";

/** Optional experiment. Real-time clocks stay outside actor/haste simulation. */
export class HitStop {
  enabled = false;
  duration = 200;
  private actors = new Map<string, number>();
  private hands = new Map<string, number>();
  configure(enabled: boolean, duration: number) {
    this.enabled = enabled;
    this.duration = Math.max(
      0,
      Math.min(1000, Number.isFinite(duration) ? duration : 200),
    );
    if (!enabled) {
      this.actors.clear();
      this.hands.clear();
    }
  }
  impact(attacker: string, defender: string, hand: Hand, dual: boolean) {
    if (!this.enabled || !this.duration) return;
    this.actors.set(
      defender,
      Math.max(this.duration, this.actors.get(defender) ?? 0),
    );
    const key = dual ? `${attacker}:${hand}` : attacker;
    const clocks = dual ? this.hands : this.actors;
    clocks.set(key, Math.max(this.duration, clocks.get(key) ?? 0));
  }
  blocked(id: string, hand?: Hand) {
    return (
      this.enabled &&
      ((this.actors.get(id) ?? 0) > 0 ||
        (hand !== undefined && (this.hands.get(`${id}:${hand}`) ?? 0) > 0))
    );
  }
  step(id: string, delta: number) {
    const remaining = this.enabled ? (this.actors.get(id) ?? 0) : 0;
    const active = Math.max(0, delta - remaining);
    this.actors.set(id, Math.max(0, remaining - delta));
    const hands = {} as Record<Hand, number>;
    for (const hand of ["front", "rear"] as const) {
      const key = `${id}:${hand}`,
        clock = this.enabled ? (this.hands.get(key) ?? 0) : 0;
      hands[hand] = Math.max(0, delta - Math.max(remaining, clock));
      this.hands.set(key, Math.max(0, clock - delta));
    }
    return { active, hands };
  }
}
