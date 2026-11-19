import type { Item, WeaponHitbox } from "../domain/model";

/** Only the blade/leaf head deals damage. The grip and spear shaft do not. */
export function weaponHitbox(weapon?: Item): WeaponHitbox | null {
  if (!weapon) return null;
  if (weapon.hitbox) return weapon.hitbox;
  if (weapon.image) {
    const top = -weapon.image.height * weapon.image.originY;
    return {
      startY: top,
      endY:
        weapon.weaponType === "spear"
          ? top + weapon.image.height * 0.16
          : top + weapon.image.height * 0.7,
      radius: Math.max(1, Math.min(6, weapon.image.width * 0.2)),
    };
  }
  if (weapon.visual === "greatsword")
    return { startY: -150, endY: -38, radius: 7 };
  if (weapon.visual === "war-hammer")
    return { startY: -147, endY: -113, radius: 18 };
  if (weapon.visual === "battle-axe")
    return { startY: -146, endY: -101, radius: 18 };
  if (weapon.visual === "war-spear")
    return { startY: -150, endY: -113, radius: 6 };
  if (weapon.visual === "spear") return { startY: -132, endY: -99, radius: 5 };
  return { startY: -95, endY: -15, radius: 5 };
}
