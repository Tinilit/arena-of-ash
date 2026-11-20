import { trainedGladiator as createPlayer } from "../fixtures/trained";
import { describe, it, expect } from "vitest";
import { opponent, opponentTier, reward } from "../../src/domain/progression";

import { item, items, installCatalog } from "../../src/data/catalog";
import { seeded } from "../../src/utils/random";
import { deserialize, serialize } from "../../src/persistence/save";
import { ArenaAI } from "../../src/combat/ArenaAI";
import { RealtimeBattle } from "../../src/combat/realtime";
describe("random progressive enemy equipment", () => {
  it("replays equipment with an injected seed without changing player ownership", () => {
    const p = createPlayer(),
      original = structuredClone(p);
    expect(opponent(p, seeded(42))).toEqual(opponent(p, seeded(42)));
    expect(p).toEqual(original);
  });
  it("varies novice weapons and sometimes equips two distinct owned weapons", () => {
    const p = createPlayer(),
      set = new Set<string>();
    let dual = 0;
    for (let i = 0; i < 100; i++) {
      const e = opponent(p, seeded(i));
      set.add(e.equipment.rightHand!);
      if (e.equipment.leftHand) dual++;
      const worn = Object.values(e.equipment);
      expect(new Set(worn).size).toBe(worn.length);
      expect(e.inventory).toEqual(worn);
    }
    expect(set.size).toBeGreaterThan(1);
    expect(dual).toBeGreaterThan(5);
    expect(dual).toBeLessThan(50);
  });
  it.each([0, 3, 6, 15])(
    "uses the correct gear floor after %s victories",
    (wins) => {
      const p = createPlayer();
      p.progress = wins;
      const tier = opponentTier(wins);
      for (let seed = 0; seed < 30; seed++) {
        const e = opponent(p, seeded(seed));
        expect(item(e.equipment.rightHand!)!.attack).toBeGreaterThanOrEqual(
          [13, 16, 21][tier],
        );
        if (tier > 0) {
          expect(item(e.equipment.body!)!.armor).toBe([0, 2, 5][tier]);
          expect(item(e.equipment.helmet!)!.armor).toBe([0, 1, 3][tier]);
        }
      }
    },
  );
  it("counts and persists victories beyond the former third opponent cap", () => {
    const p = createPlayer();
    for (let i = 0; i < 12; i++) reward(p, String(i), true);
    expect(p.progress).toBe(12);
    expect(deserialize(serialize(p)).progress).toBe(12);
    reward(p, "loss", false);
    expect(p.progress).toBe(12);
  });
  it("lets a dual-wielding enemy use the second hand while the first is active", () => {
    const p = createPlayer(),
      e = opponent(p, () => 0);
    const b = new RealtimeBattle(p, e),
      ai = new ArenaAI(() => 0.8);
    ai.cadence.threshold = 3;
    expect(e.equipment.leftHand).toBeTruthy();
    b.enemy.x = b.player.x + 100;
    b.advance(0, [{}, { attack: "quick", hand: "rear" }]);
    const input = ai.update(800, b.enemy, b.player);
    expect(input.hand).toBe("front");
    b.advance(0, [{}, input]);
    expect(b.enemy.handActions.front).not.toBeNull();
    expect(b.enemy.handActions.rear).not.toBeNull();
  });
});

it("keeps offhand fallback inside the tier budget when a runtime catalog has a missing band", () => {
  const original = [...items];
  try {
    installCatalog(
      original.filter(
        (i) => i.slot !== "weapon" || i.id === "wood" || i.id === "war-spear",
      ),
    );
    const p = createPlayer();
    for (const wins of [0, 3]) {
      p.progress = wins;
      const e = opponent(p, () => 0);
      expect(e.equipment.rightHand).toBe("wood");
      expect(e.equipment.leftHand).toBeUndefined();
    }
    p.progress = 9;
    const late = opponent(p, () => 0);
    expect(late.equipment.rightHand).toBe("war-spear");
    expect(late.equipment.leftHand).toBe("wood");
  } finally {
    installCatalog(original);
  }
});
