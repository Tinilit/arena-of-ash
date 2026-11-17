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
