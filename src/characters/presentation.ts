export const visualStyles = ["original", "bronze", "ash"] as const;
export type VisualStyle = (typeof visualStyles)[number];
export const STYLE_KEY = "arena-of-ash.presentation.v1";
export function parseStyle(raw: string | null): VisualStyle {
  return visualStyles.find((style) => style === raw) ?? "original";
}
export function loadStyle(): VisualStyle {
  try {
    return parseStyle(localStorage.getItem(STYLE_KEY));
  } catch {
    return "original";
  }
}
export function saveStyle(style: VisualStyle): boolean {
  try {
    localStorage.setItem(STYLE_KEY, style);
    return true;
  } catch {
    return false;
  }
}

export const motionModes = ["grounded", "legacy"] as const;
export type MotionMode = (typeof motionModes)[number];
export const MOTION_KEY = "arena-of-ash.motion.v1";
export function parseMotion(raw: string | null): MotionMode {
  return raw === "legacy" ? "legacy" : "grounded";
}
export function loadMotion(): MotionMode {
  try {
    return parseMotion(localStorage.getItem(MOTION_KEY));
  } catch {
    return "grounded";
  }
}
export function saveMotion(mode: MotionMode) {
  try {
    localStorage.setItem(MOTION_KEY, mode);
    return true;
  } catch {
    return false;
  }
}
