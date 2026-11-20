import bundled from "../../public/content/items.json" with { type: "json" };
import { parseCatalog } from "../content/schema";
import type { Item } from "../domain/model";
// A startup snapshot keeps gameplay synchronous and stable for the session.
export const items: Item[] = parseCatalog(bundled).items;
export function installCatalog(catalog: Item[]) {
  items.splice(0, items.length, ...catalog);
}
export const item = (id: string) => items.find((i) => i.id === id);
export const enemies = [
  {
    name: "Arena Novice",
    equipment: { rightHand: "wood" },
  },
  {
    name: "Iron Pit Fighter",
    equipment: { rightHand: "rust", body: "leather" },
  },
  {
    name: "Veteran Gladiator",
    equipment: {
      rightHand: "iron",
      body: "plate",
      helmet: "cap",
    },
  },
];
export const rewards = {
  victory: { gold: 50 },
  defeat: { gold: 10 },
};
