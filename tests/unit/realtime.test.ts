import { describe, it, expect } from "vitest";
import {
  contact,
  segmentDistance,
  sweptContact,
  type Capsule,
  type CombatGeometry,
} from "../../src/combat/geometry";
import {
  RealtimeBattle,
  arenaRules,
  attackTimings,
} from "../../src/combat/realtime";
import { weaponHitbox } from "../../src/combat/weaponGeometry";
import { ArenaAI } from "../../src/combat/ArenaAI";
import { ArenaMotion } from "../../src/characters/ArenaMotion";
import { Animator } from "../../src/characters/animation";
import { equipmentMotion } from "../../src/characters/equipmentMotion";
import { createPlayer } from "../../src/domain/model";
import { opponent } from "../../src/domain/progression";
import { item } from "../../src/data/catalog";
import { parseCatalog } from "../../src/content/schema";
import catalog from "../fixtures/catalog.json";

const capsule = (x: number, y = 0): Capsule => ({
  a: { x, y },
  b: { x, y: y + 20 },
  radius: 3,
});
const geometry = (bladeX = 0, bodyX = 0): CombatGeometry => ({
  blade: capsule(bladeX),
  body: [capsule(bodyX)],
});
const make = () => new RealtimeBattle(createPlayer(), opponent(createPlayer()));
const begin = (b: RealtimeBattle, heavy = false) =>
  b.advance(0, [{ attack: heavy ? "heavy" : "quick" }, {}]);
const active = (b: RealtimeBattle) => b.advance(550, [{}, {}]);
describe("moving capsule contact", () => {
  it("measures crossing, parallel and point segments", () => {
    expect(
      segmentDistance(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: -5 },
        { x: 5, y: 5 },
      ).distance,
    ).toBe(0);
    expect(
      segmentDistance(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 7 },
        { x: 10, y: 7 },
      ).distance,
    ).toBe(7);
    expect(
      segmentDistance(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 4 },
      ).distance,
    ).toBe(5);
  });
  it("hits an edge but rejects a near miss", () => {
    expect(contact(capsule(0), capsule(6))).not.toBeNull();
    expect(contact(capsule(0), capsule(6.01))).toBeNull();
  });
  it("catches a fast blade crossing between rendered positions", () => {
    expect(contact(capsule(-80), capsule(0))).toBeNull();
    expect(contact(capsule(80), capsule(0))).toBeNull();
    expect(
      sweptContact(capsule(-80), capsule(80), capsule(0), capsule(0)),
    ).not.toBeNull();
  });
  it("sweeps the moving target at the same instant, without false hits on its old position", () => {
    expect(
      sweptContact(capsule(0), capsule(80), capsule(30), capsule(110)),
    ).toBeNull();
    expect(
      sweptContact(capsule(-60), capsule(60), capsule(60), capsule(-60)),
    ).not.toBeNull();
    expect(
      sweptContact(capsule(-60, 100), capsule(60, 100), capsule(0), capsule(0)),
    ).toBeNull();
  });
});
describe("real-time arena rules", () => {
  it("spends stamina on starting a swing, without precomputing damage", () => {
    const b = make();
    begin(b);
    expect(b.player.stamina).toBe(88);
    expect(b.enemy.hp).toBe(80);
    expect(b.contacts).toHaveLength(0);
    expect(b.player.action?.name).toBe("quick");
  });
  it("ignores idle contact and contacts during anticipation/recovery", () => {
    const b = make();
    expect(b.resolve([geometry(), geometry()])).toEqual([]);
    begin(b);
    expect(b.resolve([geometry(), geometry()])).toEqual([]);
    b.advance(800, [{}, {}]);
    expect(b.resolve([geometry(), geometry()])).toEqual([]);
    expect(b.enemy.hp).toBe(80);
  });
  it("never damages a target outside the actual blade, even at the authored impact time", () => {
    const b = make();
    begin(b);
    active(b);
    expect(b.resolve([geometry(-100), geometry(100, 200)])).toEqual([]);
    expect(b.enemy.hp).toBe(80);
  });
  it("does not sweep an inactive wind-up or a facing flip into the active strike", () => {
    const b = make();
    begin(b);
    b.resolve([geometry(-100), geometry(0)]);
    active(b);
    expect(b.resolve([geometry(100), geometry(0)])).toEqual([]);
    b.player.facing = -1;
    expect(b.resolve([geometry(-100), geometry(0)])).toEqual([]);
    expect(b.enemy.hp).toBe(80);
  });
  it("requires stamina for a jump and a fresh guard, without exhausting into a free permanent block", () => {
    const b = make();
    b.player.stamina = 0;
    b.advance(8, [{ jump: true, guard: true }, {}]);
    expect(b.player.y).toBe(0);
    expect(b.player.guard).toBe(false);
    b.player.stamina = 10;
    b.advance(8, [{ guard: true }, {}]);
    expect(b.player.guard).toBe(true);
    b.player.stamina = 0;
    b.advance(8, [{ guard: true }, {}]);
    expect(b.player.guard).toBe(false);
    for (let i = 0; i < 10; i++) b.advance(8, [{ guard: true }, {}]);
    expect(b.player.guard).toBe(false);
  });
  it("damages only once per swing across many contact frames and permits a later swing", () => {
    const b = make();
    begin(b);
    active(b);
    expect(b.resolve([geometry(), geometry()])).toHaveLength(1);
    expect(b.enemy.hp).toBe(66);
    for (let i = 0; i < 20; i++)
      expect(b.resolve([geometry(), geometry()])).toEqual([]);
    b.advance(450, [{}, {}]);
    b.advance(280, [{}, {}]);
    begin(b);
    active(b);
    expect(b.resolve([geometry(), geometry()])).toHaveLength(1);
    expect(b.enemy.hp).toBe(52);
  });
  it("does not apply random misses to a confirmed physical contact", () => {
    const b = make();
    b.player.model.attributes.agility = 0;
    b.enemy.model.attributes.agility = 1000;
    begin(b);
    active(b);
    b.resolve([geometry(), geometry()]);
    expect(b.enemy.hp).toBeLessThan(80);
  });
  it("reduces contact damage while AI guarding and continuously regenerates stamina", () => {
    const b = make();
    begin(b);
    b.enemy.stamina = 60;
    b.advance(550, [{}, { guard: true }]);
    const [event] = b.resolve([geometry(), geometry()]);
    expect(event.blocked).toBe(true);
    expect(event.damage).toBe(7);
    expect(b.enemy.stamina).toBeCloseTo(63.3);
  });
  it("resolves simultaneous lethal contacts as a draw, then ignores further hits", () => {
    const b = make();
    b.player.hp = 1;
    b.enemy.hp = 1;
    b.advance(0, [{ attack: "quick" }, { attack: "quick" }]);
    active(b);
    expect(b.resolve([geometry(), geometry()])).toHaveLength(2);
    expect(b.state).toBe("Draw");
    expect(b.resolve([geometry(), geometry()])).toEqual([]);
  });
  it.each([true, false])(
    "ends once a physical contact kills a fighter (player wins: %s)",
    (win) => {
      const b = make();
      (win ? b.enemy : b.player).hp = 1;
      b.advance(0, win ? [{ attack: "quick" }, {}] : [{}, { attack: "quick" }]);
      active(b);
      b.resolve([geometry(), geometry()]);
      expect(b.state).toBe(win ? "Victory" : "Defeat");
      expect(b.canAttack(b.player, "heavy")).toBe(false);
    },
  );
  it("rejects unaffordable attacks and overlapping action requests", () => {
    const b = make();
    b.player.stamina = 11;
    begin(b);
    expect(b.player.action).toBeNull();
    b.player.stamina = 100;
    begin(b);
    const id = b.player.action!.id;
    b.advance(0, [{ attack: "heavy" }, {}]);
    expect(b.player.action!.id).toBe(id);
    expect(b.player.stamina).toBe(88);
  });
  it("allows movement and jumping during a swing without another jump in flight", () => {
    const b = make();
    begin(b);
    b.advance(100, [{ move: 1, run: true, jump: true }, {}]);
    expect(b.player.x).toBeGreaterThan(370);
    expect(b.player.y).toBeLessThan(0);
    const vy = b.player.vy;
    b.advance(8, [{ jump: true }, {}]);
    expect(b.player.vy).toBeGreaterThan(vy);
    expect(b.player.action?.name).toBe("quick");
    for (let i = 0; i < 150; i++) b.advance(arenaRules.step, [{}, {}]);
    expect(b.player.y).toBe(0);
    expect(b.player.vy).toBe(0);
  });
  it("enforces bounds and grounded body separation", () => {
    const b = make();
    b.player.x = 90;
    b.enemy.x = 1190;
    b.advance(100, [
      { move: -1, run: true },
      { move: 1, run: true },
    ]);
    expect(b.player.x).toBe(90);
    expect(b.enemy.x).toBe(1190);
    b.player.x = 500;
    b.enemy.x = 530;
    b.advance(8, [{ move: 1 }, { move: -1 }]);
    expect(b.enemy.x - b.player.x).toBeCloseTo(64);
  });
  it("locks facing through a swing and turns toward the opponent afterward", () => {
    const b = make();
    begin(b);
    b.enemy.x = 100;
    b.advance(100, [{}, {}]);
    expect(b.player.facing).toBe(1);
    b.advance(1000, [{}, {}]);
    expect(b.player.facing).toBe(-1);
  });
  it("finishes recovery once, caps regeneration and leaves persistent models unchanged", () => {
    const p = createPlayer(),
      initial = structuredClone(p),
      b = new RealtimeBattle(p, opponent(p));
    b.player.stamina = 30;
    b.advance(0, [{ recover: true }, {}]);
    b.advance(740, [{}, {}]);
    expect(b.player.stamina).toBeCloseTo(40.36);
    b.advance(10, [{}, {}]);
    expect(b.player.stamina).toBeCloseTo(65.5);
    b.advance(5000, [{}, {}]);
    expect(b.player.stamina).toBe(100);
    expect(p).toEqual(initial);
  });
  it("keeps contact windows aligned with sword/spear action durations", () => {
    for (const id of ["wood", "spear", "war-spear"])
      for (const action of ["quick", "heavy", "recover"] as const)
        expect(equipmentMotion(item(id))[action].duration).toBe(
          attackTimings[action].duration,
        );
  });
  it("layers running/jumping legs under an ongoing rear-hand attack", () => {
    const b = make(),
      motion = new ArenaMotion(b.player.model);
    begin(b);
    b.advance(100, [{ move: 1, run: true, jump: true }, {}]);
    const pose = motion.update(100, b.player);
    expect(pose.plant).toBe(0);
    expect(pose.rootY).toBe(0);
    expect(motion.name).toBe("quick");
    expect(pose.nearHandY).toBeGreaterThan(0);
    expect(pose.nearWrist).toBeCloseTo(0.03);
  });
  it("starts death from the displayed composite pose rather than a stale idle", () => {
    const b = make(),
      motion = new ArenaMotion(b.player.model);
    begin(b);
    b.advance(100, [{ move: 1, jump: true }, {}]);
    const displayed = motion.update(100, b.player);
    const animator = new Animator(equipmentMotion(item("wood")));
    animator.play("death", undefined, undefined, displayed);
    const start = animator.update(0);
    for (const key of [
      "plant",
      "nearThigh",
      "nearShin",
      "farHandX",
      "nearHandY",
      "torso",
    ])
      expect(start[key]).toBeCloseTo(displayed[key]!);
  });
  it("AI closes the distance and selects affordable attacks, guard or jumps and waits for passive regeneration", () => {
    const b = make(),
      ai = new ArenaAI(() => 0.8);
    expect(ai.update(600, b.enemy, b.player).move).toBe(-1);
    b.enemy.x = b.player.x + 120;
    expect(ai.update(600, b.enemy, b.player).attack).toBe("quick");
    b.enemy.stamina = 5;
    expect(ai.update(600, b.enemy, b.player).recover).toBeUndefined();
    expect(ai.update(600, b.enemy, b.player).attack).toBeUndefined();
  });
});
describe("runtime weapon contact geometry", () => {
  it("includes the blade/leaf head and excludes the spear shaft", () => {
    expect(weaponHitbox(item("wood"))).toEqual({
      startY: -95,
      endY: -15,
      radius: 5,
    });
    expect(weaponHitbox(item("war-spear"))!.endY).toBe(-113);
    expect(weaponHitbox(undefined)).toBeNull();
  });
  it("accepts runtime geometry and rejects invalid intervals, radii and armor hitboxes", () => {
    const raw = structuredClone(catalog);
    const candidate = raw.items[0] as unknown as Record<string, unknown>;
    candidate.hitbox = { startY: -80, endY: -20, radius: 4 };
    expect(weaponHitbox(parseCatalog(raw).items[0])).toEqual(candidate.hitbox);
    for (const hitbox of [
      { startY: 0, endY: -20, radius: 4 },
      { startY: -80, endY: -20, radius: -1 },
      { startY: -80, endY: -20, radius: Infinity },
    ]) {
      candidate.hitbox = hitbox;
      expect(() => parseCatalog(raw)).toThrow();
    }
    const armor = raw.items.find(
      (i) => i.slot === "chest",
    ) as unknown as Record<string, unknown>;
    delete candidate.hitbox;
    armor.hitbox = { startY: -80, endY: -20, radius: 4 };
    expect(() => parseCatalog(raw)).toThrow();
  });
});
