export const hopDefinitions = {
  backstep: {
    anticipation: 60,
    speed: 280,
    jumpSpeed: 260,
    landing: 100,
    cooldown: 180,
  },
  forwardHop: {
    anticipation: 75,
    speed: 270,
    jumpSpeed: 340,
    landing: 110,
    cooldown: 180,
  },
} as const;
export type HopKind = keyof typeof hopDefinitions;
export interface Hop {
  kind: HopKind;
  phase: "anticipation" | "air" | "landing";
  elapsed: number;
  direction: 1 | -1;
}
export const hopKind = (direction: -1 | 1): HopKind =>
  direction < 0 ? "backstep" : "forwardHop";
