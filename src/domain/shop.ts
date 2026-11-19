import type { Item } from "./model";
export const shopCategories = ["weapons", "armor", "misc"] as const;
export type ShopCategory = (typeof shopCategories)[number];
export function shopCategory(item: Item): ShopCategory {
  return item.slot === "weapon" || item.use === "throw"
    ? "weapons"
    : ["helmet", "chest", "shield"].includes(item.slot)
      ? "armor"
      : "misc";
}

export function shopStock(items: readonly Item[], category: ShopCategory) {
  return items
    .filter((item) => shopCategory(item) === category)
    .sort((a, b) =>
      category === "weapons"
        ? Number(a.slot !== "weapon") - Number(b.slot !== "weapon")
        : 0,
    );
}
