import type { Item, ItemImage, Slot } from "../domain/model";

export interface Catalog {
  version: 1;
  revision: string;
  items: Item[];
}

const visuals: Record<Slot, readonly string[]> = {
  weapon: ["wood", "rust", "iron", "spear", "war-spear"],
  helmet: ["cap", "viking"],
  chest: ["leather", "plate"],
  shield: ["shield", "tower"],
};
// Starter and opponent loadouts need these IDs and slots to remain available.
const required: Record<string, Slot> = {
  wood: "weapon",
  rust: "weapon",
  iron: "weapon",
  leather: "chest",
  plate: "chest",
  cap: "helmet",
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Expected an object");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error("Invalid text field");
  return value;
}
function number(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    throw Error("Invalid numeric field");
  return value;
}
function image(value: unknown, source: string, revision: string): ItemImage {
  const v = record(value),
    src = text(v.src, 240);
  // Art lives beside the catalog. No scripts, data URLs or parent traversal.
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*\.(png|webp|jpg|jpeg)$/i.test(src) ||
    src.split("/").some((p) => p === ".." || p === "." || !p)
  )
    throw Error("Image must be a relative PNG, WebP or JPEG path");
  const url = new URL(src, source);
  url.searchParams.set("rev", revision);
  return {
    src: url.href,
    width: number(v.width, 1, 600),
    height: number(v.height, 1, 600),
    originX: number(v.originX, 0, 1),
    originY: number(v.originY, 0, 1),
  };
}

/** Validate the complete candidate before replacing any live definitions. */
export function parseCatalog(
  value: unknown,
  source = "https://content.invalid/items.json",
): Catalog {
  const root = record(value);
  if (
    root.version !== 1 ||
    !Array.isArray(root.items) ||
    root.items.length < 6 ||
    root.items.length > 1000
  )
    throw Error("Unsupported catalog version or item count");
  const revision = text(root.revision, 64),
    ids = new Set<string>();
  const items = root.items.map((entry): Item => {
    const v = record(entry),
      id = text(v.id, 64),
      slot = v.slot as Slot;
    if (!/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id))
      throw Error("Invalid or duplicate item ID");
    ids.add(id);
    if (
      !Object.hasOwn(visuals, slot) ||
      !visuals[slot].includes(String(v.visual))
    )
      throw Error("Invalid slot or fallback visual");
    if (
      v.weaponType !== undefined &&
      (slot !== "weapon" || !["sword", "spear"].includes(String(v.weaponType)))
    )
      throw Error("Unsupported weapon type");
    const spearVisual = v.visual === "spear" || v.visual === "war-spear";
    if (slot === "weapon" && (v.weaponType === "spear") !== spearVisual)
      throw Error("Weapon animation must match its fallback visual");
    return {
      id,
      name: text(v.name, 36),
      slot,
      price: number(v.price, 0, 1000000, true),
      attack: number(v.attack, 0, 10000, true),
      armor: number(v.armor, 0, 10000, true),
      visual: String(v.visual),
      ...(v.weaponType === undefined
        ? {}
        : { weaponType: v.weaponType as Item["weaponType"] }),
      ...(v.description === undefined
        ? {}
        : { description: text(v.description, 64) }),
      ...(v.image === undefined
        ? {}
        : { image: image(v.image, source, revision) }),
    };
  });
  for (const [id, slot] of Object.entries(required))
    if (!items.some((i) => i.id === id && i.slot === slot))
      throw Error(`Missing required item: ${id}`);
  return { version: 1, revision, items };
}
