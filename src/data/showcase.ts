import type { Player } from "../domain/model";
export const previewLoadouts = [
  "classic",
  "owned",
  "spear",
  "glaives",
] as const;
export type PreviewLoadout = (typeof previewLoadouts)[number];
export const showcaseKits = {
  classic: { weapon: "iron", chest: "plate", helmet: "cap", shield: "shield" },
  spear: {
    weapon: "war-spear",
    chest: "plate",
    helmet: "viking",
    shield: "tower",
  },
  glaives: { weapon: "glaives", chest: "plate", helmet: "viking" },
} satisfies Record<Exclude<PreviewLoadout, "owned">, Player["equipment"]>;
