import { describe, it, expect } from "vitest";
import { createPlayer } from "../../src/domain/model";
import {
  stats,
  purchase,
  equip,
  experience,
  reward,
  allocate,
} from "../../src/domain/progression";
import { damage } from "../../src/combat/engine";
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
    expect(p.attributes.strength).toBe(10);
  });
  it("derives maximum health", () =>
    expect(stats(createPlayer()).hp).toBe(100));
  it("derives maximum stamina", () =>
    expect(stats(createPlayer()).stamina).toBe(100));
  it("includes weapon attack", () =>
    expect(stats(createPlayer()).attack).toBe(16));
  it("includes armor without mutating attributes", () => {
    const p = createPlayer();
    purchase(p, "leather");
    equip(p, "leather", "chest");
    expect(stats(p).armor).toBe(2);
    expect(p.attributes.defense).toBe(10);
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
    expect(equip(p, "rust", "weapon")).toBe(true);
    expect(p.equipment.weapon).toBe("rust");
    expect(stats(p).attack).toBe(19);
  });
  it("rejects wrong slot and unowned items", () => {
    const p = createPlayer();
    expect(equip(p, "wood", "helmet")).toBe(false);
    expect(equip(p, "iron", "weapon")).toBe(false);
  });
  it("allocates points once", () => {
    const p = createPlayer();
    expect(allocate(p, "vitality")).toBe(false);
    p.points = 1;
    allocate(p, "vitality");
    expect(stats(p).hp).toBe(104);
    expect(p.points).toBe(0);
  });
});
describe("combat damage calculation", () => {
  it("damage never becomes negative", () => {
    const p = createPlayer(),
      e = createPlayer();
    e.attributes.defense = 999;
    expect(damage(p, e, 1, false, false)).toBe(1);
  });
  it("guard halves incoming damage", () => {
    const p = createPlayer();
    expect(damage(p, p, 1, false, true)).toBe(
      Math.round(damage(p, p, 1, false, false) / 2),
    );
  });
  it("supports an explicit critical modifier without choosing whether contact occurred", () => {
    const p = createPlayer();
    expect(damage(p, p, 1, true, false)).toBeGreaterThan(
      damage(p, p, 1, false, false),
    );
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
  it("grants level and attribute points", () => {
    const p = createPlayer();
    expect(experience(p, 100)).toBe(1);
    expect(p.level).toBe(2);
    expect(p.points).toBe(2);
  });
  it("retains excess experience", () => {
    const p = createPlayer();
    experience(p, 120);
    expect(p.xp).toBe(20);
  });
  it("handles multiple levels", () => {
    const p = createPlayer();
    expect(experience(p, 460)).toBe(3);
    expect(p.level).toBe(4);
    expect(p.xp).toBe(10);
    expect(p.points).toBe(6);
  });
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
    expect(p.xp).toBe(10);
    expect(p.progress).toBe(0);
  });
  it("round-trips a valid save", () => {
    const p = createPlayer();
    purchase(p, "rust");
    equip(p, "rust", "weapon");
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
    p.equipment = { weapon: "wood" };
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
