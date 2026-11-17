/** The game has one art direction and one corrected motion system. */
export const visualStyles = ["ash"] as const;
export type VisualStyle = (typeof visualStyles)[number];
export const motionModes = ["grounded"] as const;
export type MotionMode = (typeof motionModes)[number];
