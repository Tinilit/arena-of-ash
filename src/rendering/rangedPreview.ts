import type Phaser from "phaser";
import type { ShootingKind } from "../characters/shootMotion";
/** Procedural training props. They are deliberately absent from the item catalog. */
export function rangedPreview(scene: Phaser.Scene, kind: ShootingKind) {
  const g = scene.add.graphics();
  g.lineStyle(2, 0x232a2c);
  g.fillStyle(0x725035);
  g.fillRoundedRect(-27, -9, 72, 13, 4);
  g.strokeRoundedRect(-27, -9, 72, 13, 4);
  g.fillStyle(0x493426);
  g.fillRoundedRect(-31, -14, 15, 23, 3);
  g.strokeRoundedRect(-31, -14, 15, 23, 3);
  g.fillStyle(0x9cb6bd);
  g.fillRoundedRect(9, -11, kind === "rifle" ? 89 : 63, 6, 2);
  g.strokeRoundedRect(9, -11, kind === "rifle" ? 89 : 63, 6, 2);
  g.lineStyle(2, 0xe2e8d7);
  g.lineBetween(13, -10, kind === "rifle" ? 96 : 70, -10);
  g.lineStyle(2, 0x232a2c);
  g.strokeCircle(0, 8, 6);
  g.lineBetween(2, 4, 2, 10);
  if (kind === "crossbow") {
    g.lineStyle(5, 0x785538);
    g.beginPath();
    g.moveTo(50, -35);
    g.lineTo(62, -20);
    g.lineTo(66, -8);
    g.lineTo(62, 8);
    g.lineTo(50, 23);
    g.strokePath();
    g.lineStyle(1.5, 0xddd1ad);
    g.lineBetween(50, -35, 24, -7);
    g.lineBetween(24, -7, 50, 23);
    g.lineStyle(2, 0xc0cbb4);
    g.lineBetween(26, -7, 88, -7);
    g.fillStyle(0x9cb6bd);
    g.fillTriangle(94, -7, 85, -11, 85, -3);
  } else {
    g.fillStyle(0x232a2c);
    g.fillRect(88, -15, 3, 5);
    g.fillStyle(0xc9a76b);
    g.fillCircle(9, -4, 3);
  }
  const zone = scene.add.zone(-35, -38, 140, 65).setOrigin(0);
  const prop = scene.add.container(0, 0, [g, zone]);
  const flash = scene.add.graphics();
  if (kind === "rifle") {
    flash.fillStyle(0xf4c56f);
    flash.fillTriangle(101, -8, 120, -15, 116, -4);
    flash.fillTriangle(102, -8, 117, 1, 112, -11);
  } else {
    flash.lineStyle(2, 0xe2e8d7);
    flash.lineBetween(94, -7, 131, -7);
  }
  prop.add(flash);
  flash.setVisible(false);
  return { prop, flash };
}
