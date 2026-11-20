import type { Random } from "../utils/random";
import type { ArenaFighter } from "./realtime";
import { activeActions } from "./realtime";
/** Counts accepted attacks, including misses, rather than per-frame requests. */
export class SkillCadence {
  attacks = 0;
  threshold: number;
  private seen = new Set<number>();
  private rage = false;
  private grappling = false;
  constructor(private random: Random) {
    this.threshold = this.next();
  }
  private next() {
    return 1 + Math.min(2, Math.floor(Math.max(0, this.random()) * 3));
  }
  get due() {
    return this.attacks >= this.threshold;
  }
  observe(f: ArenaFighter) {
    const actions = [
      ...activeActions(f),
      ...(f.parry ? [{ id: f.parry.id, name: "parry" }] : []),
    ];
    let used = f.grapple?.role === "lifter" && !this.grappling;
    this.grappling = f.grapple?.role === "lifter";
    for (const a of actions) {
      if (this.seen.has(a.id)) continue;
      this.seen.add(a.id);
      if (a.name === "quick" || a.name === "shoot") this.attacks++;
      else used = true;
    }
    if (f.rageUsed && !this.rage) {
      this.rage = true;
      used = true;
    }
    if (used) {
      this.attacks = 0;
      this.threshold = this.next();
    }
    if (this.seen.size > 128) this.seen = new Set(actions.map((a) => a.id));
  }
}
