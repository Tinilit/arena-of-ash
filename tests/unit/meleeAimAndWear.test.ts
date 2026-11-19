import { describe, expect, it, vi } from "vitest";
import { item, installCatalog } from "../../src/data/catalog";
import live from "../../public/content/items.json";
import { parseCatalog } from "../../src/content/schema";
import {
  armorDamage,
  armorDurability,
  repairArmor,
  wearArmor,
} from "../../src/combat/armor";
import { createPlayer } from "../../src/domain/model";
import { RealtimeBattle } from "../../src/combat/realtime";
import { meleeAimPose } from "../../src/characters/meleeAim";
import { twoHandPose } from "../../src/characters/twoHandMotion";
import { Animator } from "../../src/characters/animation";
import { equipmentMotion } from "../../src/characters/equipmentMotion";
import {
  groundedPose,
  rotate,
  skeleton,
} from "../../src/characters/kinematics";
import { Services } from "../../src/app/services";
import { shopCategory } from "../../src/domain/shop";
import type { CombatGeometry } from "../../src/combat/geometry";

describe("localized fatigue and repair", () => {
  it("head and torso contacts accumulate independently", () => {
    const p = createPlayer();
    p.inventory.push("cap", "plate");
    p.equipment.helmet = "cap";
    p.equipment.body = "plate";
    wearArmor(p, 5, "helmet");
    wearArmor(p, 8, "body");
    wearArmor(p, 7, "helmet");
    expect(p.armorWear).toEqual({ cap: 12, plate: 8 });
    expect(armorDamage(p, "helmet")).toBeCloseTo(
      12 / armorDurability(item("cap")!),
    );
    wearArmor(p, 1000, "helmet");
    expect(p.equipment.helmet).toBeUndefined();
    expect(p.equipment.body).toBe("plate");
    repairArmor(p);
    expect(p.armorWear).toEqual({});
    expect(p.inventory).not.toContain("cap");
    expect(p.equipment.body).toBe("plate");
  });
  it("repair on load handles leaving a fight by refreshing without reviving broken gear", () => {
    const s = new Services(),
      p = createPlayer();
    p.inventory.push("plate");
    p.equipment.body = "plate";
    p.armorWear = { plate: 35 };
    vi.spyOn(s.store, "load").mockReturnValue(p);
    const save = vi.spyOn(s.store, "save").mockReturnValue(true);
    s.load();
    expect(s.player.armorWear).toEqual({});
    expect(save).toHaveBeenCalled();
    expect(s.player.equipment.helmet).toBeUndefined();
  });
  it("repairs survivors at a resolved battle outcome", () => {
    const p = createPlayer(),
      e = createPlayer();
    e.id = "enemy";
    p.inventory.push("plate");
    p.equipment.body = "plate";
    const b = new RealtimeBattle(p, e);
    b.player.model.armorWear = { plate: 40 };
    b.enemy.hp = 1;
    const c = { a: { x: 0, y: 0 }, b: { x: 0, y: 20 }, radius: 8 };
    const g: CombatGeometry = { blade: c, body: [c], bodyRegions: ["body"] };
    b.advance(0, [{ attack: "quick" }, {}]);
    b.advance(550, [{}, {}]);
    b.resolve([g, g]);
    expect(b.state).toBe("Victory");
    expect(b.player.model.armorWear).toEqual({});
  });
  it.each(["helmet", "body"] as const)(
    "wears the actual %s contact without changing total armor subtraction",
    (region) => {
      const p = createPlayer(),
        e = createPlayer();
      e.id = "enemy";
      e.inventory.push("cap", "plate");
      e.equipment.helmet = "cap";
      e.equipment.body = "plate";
      const b = new RealtimeBattle(p, e);
      const c = { a: { x: 0, y: 0 }, b: { x: 0, y: 20 }, radius: 8 };
      const g: CombatGeometry = { blade: c, body: [c], bodyRegions: [region] };
      b.advance(0, [{ attack: "quick" }, {}]);
      b.advance(550, [{}, {}]);
      expect(b.resolve([g, g])[0]).toMatchObject({
        hitRegion: region,
        damage: 7,
      });
      expect(b.enemy.model.armorWear).toEqual({
        [region === "helmet" ? "cap" : "plate"]: 13,
      });
    },
  );
});

describe("slight mouse steering of physical melee poses", () => {
  it.each([
    "wood",
    "war-spear",
    "greatsword",
    "war-hammer",
    "battle-axe",
    "trident",
  ])(
    "keeps %s hands reachable and paired grips exact through aimed strikes",
    (id) => {
      installCatalog(parseCatalog(live).items);
      const weapon = item(id)!;
      for (const hand of weapon.hands === 2
        ? (["rear"] as const)
        : (["front", "rear"] as const)) {
        const library = equipmentMotion(weapon, hand),
          a = new Animator(library);
        a.play("quick");
        let changed = false;
        for (let frame = 0; frame < 101; frame++) {
          const sampled = a.update(frame ? library.quick.duration / 101 : 0);
          const p =
            weapon.hands === 2
              ? twoHandPose(sampled, weapon, "quick", frame / 101)
              : sampled;
          for (const pitch of [-0.32, 0.32]) {
            const aimed = meleeAimPose(p, weapon, hand, pitch),
              s = groundedPose(aimed);
            const arm = hand === "rear" ? s.farArm : s.nearArm;
            expect(arm.clamped).toBe(false);
            expect(
              Math.hypot(
                arm.elbow.x - arm.shoulder.x,
                arm.elbow.y - arm.shoulder.y,
              ),
            ).toBeCloseTo(skeleton.upperArm, 6);
            expect(Number.isFinite(arm.hand.x)).toBe(true);
            const prefix = hand === "rear" ? "far" : "near";
            changed ||=
              Math.abs(
                (aimed[`${prefix}HandY`] ?? 0) - (p[`${prefix}HandY`] ?? 0),
              ) > 0.5;
            if (weapon.hands === 2) {
              expect(s.nearArm.clamped).toBe(false);
              const offset = rotate(
                { x: 0, y: -(aimed.supportGripDistance ?? 24) },
                s.root.rotation + s.torso + aimed.farWeaponAngle!,
              );
              expect(
                Math.hypot(
                  s.farArm.hand.x + offset.x - s.nearArm.hand.x,
                  s.farArm.hand.y + offset.y - s.nearArm.hand.y,
                ),
              ).toBeLessThan(0.001);
            }
          }
        }
        expect(changed).toBe(true);
      }
    },
  );
});
it("shop categories follow equipment type, including runtime items", () => {
  expect(shopCategory(item("wood")!)).toBe("weapons");
  expect(shopCategory(item("plate")!)).toBe("armor");
  expect(shopCategory(item("cap")!)).toBe("armor");
  expect(shopCategory(item("healing-potion")!)).toBe("misc");
  expect(shopCategory(item("throwing-knife")!)).toBe("weapons");
});
