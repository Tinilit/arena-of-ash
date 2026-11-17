import Phaser from "phaser";
import type { VisualStyle } from "../characters/presentation";
import { part, gear, type PartVisual } from "./parts";

// Graphics has no geometry bounds in Phaser. A non-rendering Zone supplies a
// conservative local art envelope for framing articulated preview poses.
function bounded(
  scene: Phaser.Scene,
  visual: PartVisual,
  box: [number, number, number, number],
) {
  const zone = scene.add.zone(...box).setOrigin(0);
  return scene.add.container(0, 0, [visual, zone]);
}
const bodyBounds: Record<string, [number, number, number, number]> = {
  head: [-32, -49, 66, 75],
  torso: [-38, -3, 76, 85],
  pelvis: [-36, -3, 72, 49],
  foot: [-15, -7, 46, 25],
  hand: [-13, -8, 27, 28],
  thigh: [-18, -9, 36, 66],
  shin: [-14, -9, 28, 64],
  upper: [-16, -9, 32, 59],
  forearm: [-14, -9, 28, 55],
};
function equipmentBounds(id: string): [number, number, number, number] {
  if (id === "shield") return [-34, -36, 68, 90];
  if (id === "cap") return [-30, -58, 62, 63];
  if (id === "plate" || id === "leather") return [-35, -3, 70, 59];
  return id === "spear" ? [-22, -148, 44, 176] : [-22, -100, 44, 128];
}

interface Palette {
  ink: number;
  shade: number;
  light: number;
  metal: number;
  trim: number;
  cloth: number;
}
const palettes: Record<Exclude<VisualStyle, "original">, Palette> = {
  bronze: {
    ink: 0x392724,
    shade: 0x985c40,
    light: 0xefbd87,
    metal: 0xc19652,
    trim: 0xf2d292,
    cloth: 0x98513f,
  },
  ash: {
    ink: 0x202c34,
    shade: 0x805e51,
    light: 0xd7af8c,
    metal: 0x758d99,
    trim: 0xc3d1ce,
    cloth: 0x3d5968,
  },
};
export function drawPart(
  scene: Phaser.Scene,
  kind: string,
  color: number,
  style: VisualStyle,
): Phaser.GameObjects.Container {
  if (style === "original")
    return bounded(scene, part(scene, kind, color), bodyBounds[kind]);
  const p = palettes[style],
    heroic = style === "bronze";
  const g = scene.add.graphics();
  g.lineStyle(2.5, p.ink, 1);
  g.fillStyle(color);
  const shape = (points: { x: number; y: number }[]) => {
    g.fillPoints(points, true);
    g.strokePoints(points, true);
  };
  if (kind === "head") {
    // Local face geometry is authored toward +X; the rig mirrors the whole assembly.
    g.fillEllipse(-21, -10, 13, 19);
    g.strokeEllipse(-21, -10, 13, 19);
    shape([
      { x: -22, y: -33 },
      { x: -12, y: -41 },
      { x: 12, y: -39 },
      { x: 23, y: -28 },
      { x: 24, y: -12 },
      { x: 31, y: -5 },
      { x: 24, y: 0 },
      { x: 21, y: 14 },
      { x: 6, y: 19 },
      { x: -15, y: 12 },
      { x: -22, y: -3 },
    ]);
    g.fillStyle(p.shade, 0.45);
    g.fillRoundedRect(-20, -22, 12, 28, 5);
    g.fillStyle(p.light, 0.5);
    g.fillEllipse(12, -19, 13, 14);
    g.fillStyle(p.ink);
    g.fillPoints(
      [
        { x: -23, y: -24 },
        { x: -24, y: -38 },
        { x: -12, y: -46 },
        { x: 17, y: -43 },
        { x: 25, y: -32 },
        { x: 8, y: -32 },
        { x: -6, y: -36 },
        { x: -13, y: -21 },
      ],
      true,
    );
    g.lineStyle(3, p.ink);
    g.lineBetween(10, -19, 22, -16);
    g.fillStyle(0xffedc8);
    g.fillEllipse(17, -12, 10, 6);
    g.fillStyle(p.ink);
    g.fillCircle(20, -12, 2.5);
    g.lineStyle(2, p.ink);
    g.lineBetween(17, 5, 25, 4);
    if (heroic) {
      g.fillStyle(p.ink, 0.8);
      g.fillPoints(
        [
          { x: -6, y: 6 },
          { x: 4, y: 13 },
          { x: 21, y: 11 },
          { x: 16, y: 20 },
          { x: 1, y: 22 },
          { x: -8, y: 15 },
        ],
        true,
      );
    } else {
      g.lineStyle(1.5, 0xa65f51);
      g.lineBetween(9, -8, 14, 1);
      g.lineBetween(11, -7, 8, -4);
    }
  } else if (kind === "torso") {
    shape([
      { x: -27, y: 0 },
      { x: -35, y: 10 },
      { x: -30, y: 34 },
      { x: -23, y: 51 },
      { x: -25, y: 77 },
      { x: 25, y: 77 },
      { x: 24, y: 49 },
      { x: 33, y: 29 },
      { x: 34, y: 9 },
      { x: 23, y: 0 },
    ]);
    g.fillStyle(p.shade, 0.38);
    g.fillPoints(
      [
        { x: -28, y: 13 },
        { x: -20, y: 35 },
        { x: -17, y: 65 },
        { x: -25, y: 68 },
        { x: -31, y: 33 },
      ],
      true,
    );
    g.fillStyle(p.light, 0.45);
    g.fillEllipse(-12, 17, 25, 18);
    g.fillEllipse(14, 17, 25, 18);
    g.lineStyle(1.4, p.shade, 0.8);
    g.lineBetween(-22, 28, -4, 31);
    g.lineBetween(4, 31, 24, 28);
    g.lineBetween(0, 35, 0, 49);
    g.fillStyle(p.cloth);
    g.fillPoints(
      [
        { x: -29, y: 1 },
        { x: -21, y: 0 },
        { x: 30, y: 47 },
        { x: 25, y: 56 },
      ],
      true,
    );
    g.fillStyle(p.ink);
    g.fillRoundedRect(-27, 56, 54, 14, 3);
    g.fillStyle(p.metal);
    g.fillRoundedRect(-9, 56, 18, 15, 3);
    g.fillStyle(p.trim);
    g.fillRect(-4, 59, 8, 8);
  } else if (kind === "pelvis") {
    g.fillStyle(p.cloth);
    shape([
      { x: -28, y: 0 },
      { x: 28, y: 0 },
      { x: 34, y: 35 },
      { x: 0, y: 42 },
      { x: -33, y: 34 },
    ]);
    for (let x = -24; x < 25; x += 12) {
      g.fillStyle(x < 0 ? p.shade : p.metal);
      g.fillPoints(
        [
          { x, y: 3 },
          { x: x + 9, y: 3 },
          { x: x + 12, y: 31 },
          { x: x + 2, y: 36 },
        ],
        true,
      );
      g.lineStyle(1, p.ink, 0.5);
      g.lineBetween(x, 4, x + 2, 30);
      g.fillStyle(p.trim);
      g.fillCircle(x + 4, 9, 1.5);
    }
  } else if (kind === "hand") {
    g.fillRoundedRect(-9, -4, 19, 20, 6);
    g.strokeRoundedRect(-9, -4, 19, 20, 6);
    g.fillStyle(p.shade, 0.5);
    g.fillRoundedRect(-9, 4, 19, 10, 4);
    g.lineStyle(1, p.ink, 0.6);
    g.lineBetween(0, 6, 0, 12);
    g.lineBetween(5, 6, 5, 12);
  } else if (kind === "foot") {
    g.fillStyle(p.ink);
    g.fillRoundedRect(-13, -4, 41, 18, 5);
    g.strokeRoundedRect(-13, -4, 41, 18, 5);
    g.fillStyle(p.shade);
    g.fillRoundedRect(-10, -3, 34, 10, 4);
    g.lineStyle(2, p.trim, 0.75);
    g.lineBetween(-8, 1, 9, 1);
    g.fillStyle(p.metal);
    g.fillRect(-12, 10, 39, 4);
  } else {
    const len =
      kind === "thigh" ? 48 : kind === "shin" ? 46 : kind === "upper" ? 41 : 37;
    const width =
      kind === "thigh"
        ? 29
        : kind === "upper"
          ? heroic
            ? 25
            : 22
          : kind === "shin"
            ? 21
            : 20;
    g.fillRoundedRect(-width / 2, -6, width, len + 12, width / 2);
    g.strokeRoundedRect(-width / 2, -6, width, len + 12, width / 2);
    g.fillStyle(p.shade, 0.4);
    g.fillRoundedRect(-width / 2 + 1, 3, 6, len - 1, 3);
    g.fillStyle(p.light, 0.5);
    g.fillRoundedRect(2, 2, 5, len - 11, 2);
    if (kind === "upper") {
      g.lineStyle(1.3, p.shade, 0.7);
      g.lineBetween(1, 13, 5, 23);
    }
    if (kind === "forearm") {
      g.fillStyle(p.cloth);
      g.fillRoundedRect(-width / 2 - 1, len - 14, width + 2, 15, 3);
      g.lineStyle(2, p.trim, 0.7);
      g.lineBetween(-9, len - 9, 9, len - 9);
      g.lineBetween(-9, len - 4, 9, len - 4);
    }
    if (kind === "shin") {
      g.fillStyle(p.metal);
      g.fillPoints(
        [
          { x: -10, y: 13 },
          { x: 9, y: 13 },
          { x: 8, y: 43 },
          { x: -9, y: 43 },
        ],
        true,
      );
      g.lineStyle(2, p.trim);
      g.lineBetween(2, 16, 2, 38);
      g.fillStyle(p.ink);
      g.fillRect(-10, 11, 20, 5);
    }
  }
  return bounded(scene, g, bodyBounds[kind]);
}
export function drawGear(
  scene: Phaser.Scene,
  id: string,
  style: VisualStyle,
): Phaser.GameObjects.Container {
  if (style === "original")
    return bounded(scene, gear(scene, id), equipmentBounds(id));
  const p = palettes[style],
    g = scene.add.graphics();
  g.lineStyle(2.5, p.ink);
  if (id === "shield") {
    g.fillStyle(0x654735);
    g.fillEllipse(0, 8, 61, 82);
    g.strokeEllipse(0, 8, 61, 82);
    g.lineStyle(1.5, 0xb78c59);
    for (let x = -16; x < 25; x += 10) g.lineBetween(x, -23, x, 39);
    g.lineStyle(5, p.metal);
    g.strokeEllipse(0, 8, 56, 77);
    g.fillStyle(p.cloth);
    g.fillPoints(
      [
        { x: -12, y: -14 },
        { x: 12, y: -14 },
        { x: 8, y: 18 },
        { x: 0, y: 28 },
        { x: -8, y: 18 },
      ],
      true,
    );
    g.fillStyle(p.metal);
    g.fillCircle(0, 8, 11);
    g.fillStyle(p.trim);
    g.fillCircle(3, 4, 4);
    for (const y of [-23, 39]) {
      g.fillStyle(p.trim);
      g.fillCircle(0, y, 2.5);
    }
  } else if (id === "cap") {
    g.fillStyle(0x795341);
    g.fillRoundedRect(-26, -45, 54, 30, 13);
    g.strokeRoundedRect(-26, -45, 54, 30, 13);
    g.fillStyle(p.metal);
    g.fillRoundedRect(-25, -28, 54, 10, 3);
    g.fillPoints(
      [
        { x: -25, y: -22 },
        { x: -14, y: -19 },
        { x: -13, y: 0 },
        { x: -23, y: -4 },
      ],
      true,
    );
    g.lineStyle(2, p.trim);
    g.lineBetween(-23, -24, 27, -24);
    g.fillStyle(p.metal);
    g.fillRect(-3, -43, 8, 21);
    g.fillStyle(p.cloth);
    g.fillRoundedRect(-13, -54, 24, 12, 4);
  } else if (id === "plate" || id === "leather") {
    g.fillStyle(id === "plate" ? p.metal : 0x805639);
    g.fillPoints(
      [
        { x: -30, y: 3 },
        { x: -19, y: 1 },
        { x: 0, y: 11 },
        { x: 19, y: 1 },
        { x: 31, y: 4 },
        { x: 26, y: 40 },
        { x: 0, y: 52 },
        { x: -26, y: 40 },
      ],
      true,
    );
    g.strokePoints(
      [
        { x: -30, y: 3 },
        { x: -19, y: 1 },
        { x: 0, y: 11 },
        { x: 19, y: 1 },
        { x: 31, y: 4 },
        { x: 26, y: 40 },
        { x: 0, y: 52 },
        { x: -26, y: 40 },
      ],
      true,
    );
    g.fillStyle(p.ink, 0.2);
    g.fillTriangle(-25, 8, 0, 16, -23, 40);
    g.fillStyle(p.trim, 0.3);
    g.fillTriangle(4, 16, 25, 8, 21, 34);
    g.lineStyle(2, p.trim);
    g.lineBetween(-24, 10, -6, 18);
    g.lineBetween(6, 18, 25, 10);
    g.lineBetween(0, 19, 0, 42);
    g.lineBetween(-20, 37, 0, 46);
    g.lineBetween(0, 46, 21, 37);
    for (const x of [-24, 24]) {
      g.fillStyle(p.trim);
      g.fillCircle(x, 7, 2.5);
    }
  } else {
    const spear = id === "spear",
      tip = spear ? -143 : -95;
    g.fillStyle(id === "wood" ? 0xb68a56 : id === "rust" ? 0x9d7258 : 0xa9bfc5);
    const blade = [
      { x: -5, y: -12 },
      { x: -7, y: tip + 18 },
      { x: 0, y: tip },
      { x: 8, y: tip + 18 },
      { x: 5, y: -12 },
    ];
    g.fillPoints(blade, true);
    g.strokePoints(blade, true);
    g.fillStyle(id === "wood" ? 0xe0b276 : p.trim, 0.7);
    g.fillTriangle(0, tip, 6, tip + 20, 0, -14);
    g.lineStyle(1, p.ink, 0.5);
    g.lineBetween(0, tip + 12, 0, -17);
    g.fillStyle(p.metal);
    g.fillRoundedRect(-18, -14, 36, 8, 3);
    g.fillStyle(0x49332c);
    g.fillRoundedRect(-4, -6, 8, 23, 2);
    g.lineStyle(1, p.trim, 0.7);
    for (let y = -3; y < 14; y += 4) g.lineBetween(-3, y, 3, y + 2);
    g.fillStyle(p.metal);
    g.fillCircle(0, 18, 6);
  }
  return bounded(scene, g, equipmentBounds(id));
}
