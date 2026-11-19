export type Slot = "weapon" | "helmet" | "chest" | "shield" | "utility";
export const equipmentSlots = [
  "helmet",
  "body",
  "rightHand",
  "leftHand",
  "belt1",
  "belt2",
] as const;
export type EquipmentSlot = (typeof equipmentSlots)[number];
export const slotCategory: Record<EquipmentSlot, Slot> = {
  helmet: "helmet",
  body: "chest",
  rightHand: "weapon",
  leftHand: "weapon",
  belt1: "utility",
  belt2: "utility",
};
export type Hand = "front" | "rear";
export const handSlots: Record<Hand, EquipmentSlot> = {
  front: "leftHand",
  rear: "rightHand",
};
export type WeaponType = "sword" | "spear" | "hammer" | "axe" | "crossbow";
export interface WeaponHitbox {
  startY: number;
  endY: number;
  radius: number;
}
export interface ItemImage {
  src: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
}
export interface Item {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  attack: number;
  armor: number;
  visual: string;
  weaponType?: WeaponType;
  hands?: 1 | 2;
  description?: string;
  image?: ItemImage;
  hitbox?: WeaponHitbox;
  use?: "throw" | "drink";
  heal?: number;
}
export interface Player {
  id: string;
  name: string;
  gold: number;
  inventory: string[];
  quantities?: Record<string, number>;
  equipment: Partial<Record<EquipmentSlot, string>>;
  progress: number;
  rewarded: string[];
}
export const createPlayer = (): Player => ({
  id: "wanderer",
  name: "The Wanderer",
  gold: 100,
  inventory: ["wood", "throwing-knife", "throwing-axe"],
  quantities: {},
  equipment: {
    rightHand: "wood",
  },
  progress: 0,
  rewarded: [],
});
