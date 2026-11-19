import { describe, it, expect } from "vitest";
import { RealtimeBattle, arenaRules } from "../../src/combat/realtime";
import { createPlayer } from "../../src/domain/model";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
import type { CombatGeometry } from "../../src/combat/geometry";
const make = () => {
  const p = createPlayer(),
    e = createPlayer();
  e.id = "enemy";
  return new RealtimeBattle(p, e, () => 0.5);
};
const cap = { a: { x: 0, y: 0 }, b: { x: 0, y: 20 }, radius: 4 };
const g: CombatGeometry = {
  blade: cap,
  blades: { rear: cap },
  hands: { front: cap, rear: cap },
  feet: { front: cap, rear: cap },
  body: [cap, cap],
};
describe("independent hand actions", () => {
  it("starts both hands in one step, preserves unique IDs and resolves two actual contacts once each", () => {
    const b = make();
    b.advance(0, [{ attacks: ["front", "rear", "front"] }, {}]);
    expect(b.player.handActions.front).not.toBeNull();
    expect(b.player.handActions.rear).not.toBeNull();
    expect(b.player.handActions.front!.id).not.toBe(
      b.player.handActions.rear!.id,
    );
    b.advance(550, [{}, {}]);
    const hits = b.resolve([g, g]);
    expect(hits.map((h) => h.hand).sort()).toEqual(["front", "rear"]);
    expect(b.enemy.hp).toBe(86);
    expect(b.resolve([g, g])).toEqual([]);
  });
  it("starts the second hand during the first wind-up and keeps cooldowns independent", () => {
    const b = make();
    b.advance(0, [{ attack: "quick", hand: "rear" }, {}]);
    b.advance(200, [{ attack: "quick", hand: "front" }, {}]);
    expect(b.player.handActions.rear!.elapsed).toBe(200);
    expect(b.player.handActions.front!.elapsed).toBe(0);
    b.advance(800, [{}, {}]);
    expect(b.player.handActions.rear).toBeNull();
    expect(b.player.handActions.front!.elapsed).toBe(800);
    expect(b.canAttack(b.player, "quick", "rear")).toBe(false);
    b.advance(200, [{}, {}]);
    b.advance(80, [{}, {}]);
    expect(b.canAttack(b.player, "quick", "rear")).toBe(true);
    expect(b.canAttack(b.player, "quick", "front")).toBe(false);
    const cooldown = b.player.handCooldowns.front;
    b.advance(0, [{ attack: "quick", hand: "rear" }, {}]);
    expect(b.player.handActions.rear).not.toBeNull();
    expect(b.player.handCooldowns.front).toBe(cooldown);
  });
  it("does not restart or overwrite the first arm's pose when the second starts", () => {
    const a = make(),
      b = make(),
      m1 = new ArenaMotion(a.player.model),
      m2 = new ArenaMotion(b.player.model);
    for (const x of [a, b])
      x.advance(0, [{ attack: "quick", hand: "rear" }, {}]);
    for (let i = 0; i < 30; i++) {
      for (const x of [a, b]) x.advance(arenaRules.step, [{}, {}]);
      m1.update(arenaRules.step, a.player);
      m2.update(arenaRules.step, b.player);
    }
    b.advance(0, [{ attack: "quick", hand: "front" }, {}]);
    for (let i = 0; i < 30; i++) {
      for (const x of [a, b]) x.advance(arenaRules.step, [{}, {}]);
      const one = m1.update(arenaRules.step, a.player),
        two = m2.update(arenaRules.step, b.player);
      for (const key of ["farHandX", "farHandY", "farWrist", "farWeaponGrip"])
        expect(two[key]).toBeCloseTo(one[key]!, 6);
      expect(m2.name).toBe("dualAttack");
    }
  });
  it("pain interrupts both hands while each simultaneous hit still counts in a trade", () => {
    const b = make();
    b.advance(0, [
      { attacks: ["front", "rear"] },
      { attacks: ["front", "rear"] },
    ]);
    b.advance(550, [{}, {}]);
    const hits = b.resolve([g, g]);
    expect(hits).toHaveLength(4);
    expect(b.player.hp).toBe(86);
    expect(b.enemy.hp).toBe(86);
    for (const f of b.fighters) {
      expect(f.handActions.front).toBeNull();
      expect(f.handActions.rear).toBeNull();
      expect(f.stun).toBe(180);
    }
  });
  it("keeps kicks body-exclusive and causes zero HP loss while shoving and staggering", () => {
    const b = make();
    b.advance(0, [{ attack: "kick" }, {}]);
    expect(b.canAttack(b.player, "quick", "front")).toBe(false);
    b.advance(420, [{}, {}]);
    const [event] = b.resolve([g, g]);
    expect(event.damage).toBe(0);
    expect(b.enemy.hp).toBe(100);
    expect(b.enemy.pushVx).toBe(500);
    expect(b.enemy.reaction?.kind).toBe("stagger");
  });
});
