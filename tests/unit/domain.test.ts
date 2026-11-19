import { describe, it, expect } from "vitest";
import { createPlayer } from "../../src/domain/model";
import { stats, purchase, equip, reward } from "../../src/domain/progression";
import { damage, damageAfterArmor } from "../../src/combat/engine";
import { serialize, deserialize, SaveStore } from "../../src/persistence/save";
import { seeded } from "../../src/utils/random";
import { Animator } from "../../src/characters/animation";
import { groundedMotion } from "../../src/characters/groundedMotion";
const clips = groundedMotion.ash;
describe("character and equipment", () => {
  it("creates the initial character", () => {
    const p = createPlayer();
    expect(p.name).toBe("The Wanderer");
    expect(p.gold).toBe(100);
    expect(p).not.toHaveProperty("attributes");
    expect(p).not.toHaveProperty("level");
  });
  it("derives maximum health", () =>
    expect(stats(createPlayer()).hp).toBe(100));
  it("includes weapon attack", () =>
    expect(stats(createPlayer()).attack).toBe(13));
  it("includes armor without changing base health", () => {
    const p = createPlayer();
    purchase(p, "leather");
    equip(p, "leather", "body");
    expect(stats(p).armor).toBe(2);
    expect(stats(p).hp).toBe(100);
  });
  it("rejects insufficient gold", () => {
    const p = createPlayer();
    expect(purchase(p, "plate")).toBe(false);
    expect(p.gold).toBe(100);
  });
  it("deducts exact purchase price", () => {
    const p = createPlayer();
    expect(purchase(p, "rust")).toBe(true);
    expect(p.gold).toBe(60);
    expect(p.inventory).toContain("rust");
  });
  it("prevents duplicate ownership", () => {
    const p = createPlayer();
    purchase(p, "rust");
    expect(purchase(p, "rust")).toBe(false);
    expect(p.gold).toBe(60);
  });
  it("equips correct slot", () => {
    const p = createPlayer();
    purchase(p, "rust");
    expect(equip(p, "rust", "rightHand")).toBe(true);
    expect(p.equipment.rightHand).toBe("rust");
    expect(stats(p).attack).toBe(16);
  });
  it("rejects wrong slot and unowned items", () => {
    const p = createPlayer();
    expect(equip(p, "wood", "helmet")).toBe(false);
    expect(equip(p, "iron", "rightHand")).toBe(false);
  });
});
describe("combat damage calculation", () => {
  it("subtracts only total worn armor from fixed weapon damage", () => {
    const p = createPlayer(),
      e = createPlayer();
    p.equipment.rightHand = "spear";
    e.equipment = { body: "plate", helmet: "cap" };
    expect(damage(p, e)).toBe(12);
    expect(damage(p, e)).toBe(12);
  });
  it("fully absorbs a weak weapon without negative damage", () => {
    const e = createPlayer();
    e.equipment = { body: "plate", helmet: "cap" };
    expect(damageAfterArmor(5, e)).toBe(0);
    expect(damageAfterArmor(0, e)).toBe(0);
  });
  it("does not substitute a weapon for an empty hand", () => {
    const p = createPlayer();
    expect(damage(p, p, "front")).toBe(0);
  });
  it("seeded AI randomness is repeatable", () => {
    const a = seeded(13),
      b = seeded(13);
    expect(Array.from({ length: 10 }, a)).toEqual(
      Array.from({ length: 10 }, b),
    );
  });
});
describe("progression and persistence", () => {
  it("prevents duplicate rewards across serialization", () => {
    const p = createPlayer();
    reward(p, "battle", true);
    const loaded = deserialize(serialize(p));
    expect(reward(loaded, "battle", true)).toBeNull();
    expect(loaded.gold).toBe(150);
    expect(loaded.progress).toBe(1);
  });
  it("awards defeat without advancing", () => {
    const p = createPlayer();
    reward(p, "lost", false);
    expect(p.gold).toBe(110);
    expect(p.progress).toBe(0);
  });
  it("migrates coins and gear while discarding old attributes, level and experience", () => {
    const p = createPlayer();
    p.gold = 321;
    const loaded = deserialize(
      JSON.stringify({
        version: 2,
        player: {
          ...p,
          level: 8,
          xp: 12,
          points: 4,
          attributes: { strength: 50 },
        },
      }),
    );
    expect(loaded).toEqual(p);
    expect(JSON.parse(serialize(loaded)).version).toBe(3);
    expect(loaded).not.toHaveProperty("level");
    expect(loaded).not.toHaveProperty("attributes");
  });
  it("round-trips a valid save", () => {
    const p = createPlayer();
    purchase(p, "rust");
    equip(p, "rust", "rightHand");
    expect(deserialize(serialize(p))).toEqual(p);
  });
  it.each([null, "bad", "{}", '{"version":2}', '{"version":1,"player":null}'])(
    "recovers invalid saves %s",
    (raw) => expect(deserialize(raw)).toEqual(createPlayer()),
  );
  it("rejects invalid equipment and numeric fields", () => {
    const p = createPlayer();
    p.equipment.helmet = "wood";
    expect(deserialize(serialize(p))).toEqual(createPlayer());
    p.equipment = { rightHand: "wood" };
    p.gold = -1;
    expect(deserialize(serialize(p)).gold).toBe(100);
  });
  it("handles unavailable storage", () => {
    const store = new SaveStore();
    expect(store.load()).toEqual(createPlayer());
    expect(store.save(createPlayer())).toBe(false);
    expect(store.warning).toBe(true);
  });
});
describe("animation lifecycle", () => {
  it("emits one impact despite repeated updates", () => {
    const a = new Animator(clips);
    let hits = 0,
      done = 0;
    a.play(
      "quick",
      () => hits++,
      () => done++,
    );
    for (let i = 0; i < 100; i++) a.update(16);
    expect(hits).toBe(1);
    expect(done).toBe(1);
  });
  it("stops callbacks on shutdown or interruption", () => {
    const a = new Animator(clips);
    let hits = 0;
    a.play("heavy", () => hits++);
    a.stop();
    a.update(2000);
    expect(hits).toBe(0);
    a.play("heavy", () => hits++);
    a.play("defend");
    a.update(2000);
    expect(hits).toBe(0);
  });
  it("supports repeated attacks followed by defend", () => {
    const a = new Animator(clips);
    let hits = 0;
    for (const clip of ["quick", "quick", "heavy", "defend"]) {
      a.play(clip, () => hits++);
      a.update(2000);
    }
    expect(hits).toBe(4);
  });
  it("holds defeated pose", () => {
    const a = new Animator(clips);
    a.play("death");
    const final = a.update(clips.death.duration);
    expect(a.update(1000)).toEqual(final);
    expect(final.rootR).toBeLessThan(-1);
  });
});
