import bundled from "../../public/content/items.json";
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
    attributes: {
      strength: 7,
      agility: 7,
      vitality: 5,
      defense: 5,
      endurance: 6,
    },
    equipment: { rightHand: "wood" },
  },
  {
    name: "Iron Pit Fighter",
    attributes: {
      strength: 11,
      agility: 10,
      vitality: 10,
      defense: 10,
      endurance: 10,
    },
    equipment: { rightHand: "rust", body: "leather" },
  },
  {
    name: "Veteran Gladiator",
    attributes: {
      strength: 14,
      agility: 13,
      vitality: 14,
      defense: 13,
      endurance: 13,
    },
    equipment: {
      rightHand: "iron",
      body: "plate",
      helmet: "cap",
    },
  },
];
export const rewards = {
  victory: { gold: 50, xp: 40 },
  defeat: { gold: 10, xp: 10 },
};
