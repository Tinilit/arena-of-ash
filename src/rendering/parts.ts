import Phaser from "phaser";
export type PartVisual = Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
// All visuals share a local joint origin. Texture-backed parts can replace this factory.
export function part(s: Phaser.Scene, kind: string, color: number): PartVisual {
  const g = s.add.graphics();
  g.fillStyle(color);
  g.lineStyle(2, 0x302620);
  if (kind === "head") {
    g.fillRoundedRect(-23, -39, 46, 52, 16);
    g.strokeRoundedRect(-23, -39, 46, 52, 16);
    g.fillStyle(0x2f2725);
    g.fillRoundedRect(-23, -40, 46, 14, 6);
    g.fillRect(9, -13, 6, 4);
    g.fillStyle(0x8c4c39);
    g.fillRect(10, 3, 10, 3);
  } else if (kind === "torso") {
    g.fillRoundedRect(-30, 0, 60, 79, 15);
    g.strokeRoundedRect(-30, 0, 60, 79, 15);
    g.fillStyle(0x734937);
    g.fillRect(-30, 49, 60, 14);
    g.fillStyle(0xd3a963);
    g.fillRect(-6, 50, 12, 13);
  } else if (kind === "pelvis") {
    g.fillTriangle(-31, 0, 31, 0, 24, 38);
    g.fillTriangle(-31, 0, 24, 38, -25, 38);
    g.fillStyle(0xb18a58);
    for (let i = -24; i < 25; i += 12) g.fillRect(i, 4, 8, 32);
  } else if (kind === "foot") {
    g.fillRoundedRect(-12, -3, 39, 16, 6);
    g.strokeRoundedRect(-12, -3, 39, 16, 6);
  } else if (kind === "hand") {
    g.fillCircle(0, 3, 11);
    g.strokeCircle(0, 3, 11);
  } else {
    const len =
      kind === "thigh" ? 48 : kind === "shin" ? 46 : kind === "upper" ? 41 : 37;
    const w = kind === "thigh" ? 28 : kind === "shin" ? 21 : 21;
    g.fillRoundedRect(-w / 2, -5, w, len + 9, 10);
    g.strokeRoundedRect(-w / 2, -5, w, len + 9, 10);
    if (kind === "shin") {
      g.fillStyle(0x71513a);
      g.fillRect(-w / 2, len - 18, w, 18);
    }
  }
  return g;
}
export function gear(s: Phaser.Scene, id: string): PartVisual {
  const g = s.add.graphics();
  g.lineStyle(2, 0x322b26);
  if (id === "shield") {
    g.fillStyle(0x78513a);
    g.fillEllipse(0, 8, 57, 78);
    g.strokeEllipse(0, 8, 57, 78);
    g.lineStyle(4, 0xc6a574);
    g.strokeEllipse(0, 8, 51, 72);
    g.fillStyle(0xb89a68);
    g.fillCircle(0, 8, 10);
  } else if (id === "cap") {
    g.fillStyle(0x78523b);
    g.fillRoundedRect(-26, -45, 52, 28, 12);
    g.lineStyle(3, 0xc2a070);
    g.lineBetween(-26, -20, 26, -20);
  } else if (id === "leather" || id === "plate") {
    g.fillStyle(id === "plate" ? 0x83949a : 0x805735);
    g.fillRoundedRect(-31, 3, 62, 45, 9);
    g.strokeRoundedRect(-31, 3, 62, 45, 9);
    g.lineStyle(3, 0xc6aa74);
    g.lineBetween(-25, 10, 25, 10);
    g.lineBetween(0, 5, 0, 46);
  } else {
    const spear = id === "spear";
    g.fillStyle(id === "wood" ? 0xb78751 : id === "rust" ? 0x99715b : 0xc6d2d0);
    g.fillPoints(
      [
        { x: -5, y: -12 },
        { x: -6, y: spear ? -123 : -78 },
        { x: 0, y: spear ? -143 : -95 },
        { x: 7, y: spear ? -123 : -78 },
        { x: 5, y: -12 },
      ],
      true,
    );
    g.strokePoints(
      [
        { x: -5, y: -12 },
        { x: -6, y: spear ? -123 : -78 },
        { x: 0, y: spear ? -143 : -95 },
        { x: 7, y: spear ? -123 : -78 },
        { x: 5, y: -12 },
      ],
      true,
    );
    g.fillStyle(0xc9a358);
    g.fillRoundedRect(-17, -14, 34, 7, 2);
    g.fillStyle(0x5e4030);
    g.fillRect(-4, -7, 8, 23);
  }
  return g;
}
