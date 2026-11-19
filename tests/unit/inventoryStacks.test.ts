import { describe, expect, it } from "vitest";
import { createPlayer } from "../../src/domain/model";
import {
  purchase,
  equip,
  unequip,
  quantity,
  availableQuantity,
  backpack,
  addItem,
  consumeItem,
} from "../../src/domain/progression";
import { serialize, deserialize } from "../../src/persistence/save";
describe("inventory quantities and one-copy equipment slots", () => {
  it.each(["throwing-knife", "throwing-axe", "healing-potion"])(
    "accumulates repeated and bulk purchases of %s",
    (id) => {
      const p = createPlayer();
      p.gold = 10000;
      const old = quantity(p, id);
      expect(purchase(p, id, 5)).toBe(true);
      expect(purchase(p, id, 10)).toBe(true);
      expect(quantity(p, id)).toBe(old + 15);
      expect(p.inventory.filter((entry) => entry === id)).toHaveLength(1);
      expect(deserialize(serialize(p))).toEqual(p);
    },
  );
  it("rejects invalid quantities and unaffordable bundles atomically", () => {
    const p = createPlayer(),
      before = structuredClone(p);
    for (const amount of [0, -1, 1.5, Infinity, 1001, 10])
      expect(purchase(p, "healing-potion", amount)).toBe(false);
    expect(p).toEqual(before);
    expect(purchase(p, "rust", 2)).toBe(false);
  });
  it("equips one copy per belt, displays reserves, and never deletes the other slot on use", () => {
    const p = createPlayer();
    purchase(p, "throwing-knife", 3);
    equip(p, "throwing-knife", "belt1");
    equip(p, "throwing-knife", "belt2");
    expect(quantity(p, "throwing-knife")).toBe(4);
    expect(availableQuantity(p, "throwing-knife")).toBe(2);
    expect(backpack(p)).toContain("throwing-knife");
    consumeItem(p, "throwing-knife", "belt1");
    expect(p.equipment.belt1).toBeUndefined();
    expect(p.equipment.belt2).toBe("throwing-knife");
    expect(quantity(p, "throwing-knife")).toBe(3);
    expect(availableQuantity(p, "throwing-knife")).toBe(2);
    unequip(p, "belt2");
    expect(availableQuantity(p, "throwing-knife")).toBe(3);
  });
  it("moves the sole owned copy, but can equip two separately acquired identical weapons", () => {
    const p = createPlayer();
    equip(p, "wood", "leftHand");
    expect(p.equipment.rightHand).toBeUndefined();
    addItem(p, "wood");
    equip(p, "wood", "rightHand");
    expect(p.equipment.leftHand).toBe("wood");
    expect(deserialize(serialize(p))).toEqual(p);
    consumeItem(p, "wood", "leftHand");
    expect(p.equipment.rightHand).toBe("wood");
    expect(quantity(p, "wood")).toBe(1);
  });
  it("loads old single-copy saves and rejects quantity/equipment mismatches", () => {
    const p = createPlayer();
    delete p.quantities;
    expect(quantity(deserialize(serialize(p)), "wood")).toBe(1);
    p.gold = 777;
    p.equipment.leftHand = "wood";
    expect(deserialize(serialize(p)).gold).toBe(100);
    p.quantities = { wood: 2 };
    expect(deserialize(serialize(p)).gold).toBe(777);
    for (const value of [0, -1, 1.5, Infinity]) {
      p.quantities.wood = value;
      expect(deserialize(serialize(p)).gold).toBe(100);
    }
  });
});
