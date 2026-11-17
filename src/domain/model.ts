export const attributes = [
  "strength",
  "agility",
  "vitality",
  "defense",
  "endurance",
] as const;
export type Attribute = (typeof attributes)[number];
export type Attributes = Record<Attribute, number>;
export type Slot = "weapon" | "helmet" | "chest" | "shield";
export interface Item {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  attack: number;
  armor: number;
  visual: string;
}
export interface Player {
  id: string;
  name: string;
  level: number;
  xp: number;
  gold: number;
  attributes: Attributes;
  points: number;
  inventory: string[];
  equipment: Partial<Record<Slot, string>>;
  progress: number;
  rewarded: string[];
}
export const createPlayer = (): Player => ({
  id: "wanderer",
  name: "The Wanderer",
  level: 1,
  xp: 0,
  gold: 100,
  attributes: {
    strength: 10,
    agility: 10,
    vitality: 10,
    defense: 10,
    endurance: 10,
  },
  points: 0,
  inventory: ["wood"],
  equipment: { weapon: "wood" },
  progress: 0,
  rewarded: [],
});
