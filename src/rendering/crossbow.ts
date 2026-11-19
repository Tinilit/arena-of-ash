import type Phaser from "phaser";
interface CrossbowParts {
  string: Phaser.GameObjects.Graphics;
  bolt: Phaser.GameObjects.Graphics;
}
/** Original three-quarter illustration: stock/rail, transverse prod, string and trigger. */
export function drawCrossbow(scene: Phaser.Scene) {
  const root = scene.add.container(),
    art = scene.add.container().setRotation(-Math.PI / 2),
    g = scene.add.graphics();
  art.add(g);
  root.add(art);
  g.lineStyle(2, 0x232a2c);
  g.fillStyle(0x755139);
  g.fillRoundedRect(-31, -8, 115, 16, 4);
  g.strokeRoundedRect(-31, -8, 115, 16, 4);
  g.fillStyle(0x493426);
  g.fillRoundedRect(-35, -10, 22, 25, 4);
  g.strokeRoundedRect(-35, -10, 22, 25, 4);
  g.fillStyle(0xb7b59b);
  g.fillRoundedRect(1, -10, 84, 5, 2);
  g.strokeRoundedRect(1, -10, 84, 5, 2);
  g.lineStyle(2, 0xe2e8d7);
  g.lineBetween(5, -10, 84, -10);
  // Laminated limbs are transverse to the rail, shown foreshortened in depth.
  g.lineStyle(8, 0x37434a);
  g.beginPath();
  g.moveTo(64, -43);
  g.lineTo(82, -29);
  g.lineTo(88, -8);
  g.lineTo(82, 13);
  g.lineTo(64, 29);
  g.strokePath();
  g.lineStyle(3, 0x9cb6bd);
  g.beginPath();
  g.moveTo(64, -44);
  g.lineTo(82, -29);
  g.lineTo(88, -8);
  g.lineTo(82, 13);
  g.lineTo(64, 30);
  g.strokePath();
  g.lineStyle(3, 0xb7b59b);
  g.strokeRoundedRect(89, -16, 15, 17, 4);
  g.fillStyle(0x8daaba);
  g.fillRoundedRect(78, -17, 10, 18, 2);
  g.lineStyle(1, 0x232a2c);
  g.strokeRoundedRect(78, -17, 10, 18, 2);
  g.lineStyle(2, 0x232a2c);
  g.strokeEllipse(0, 13, 15, 12);
  g.lineBetween(3, 6, 0, 16);
  g.fillStyle(0xd4c397);
  g.fillCircle(-2, -8, 4);
  const string = scene.add.graphics(),
    bolt = scene.add.graphics();
  art.add([string, bolt]);
  bolt.lineStyle(2, 0xd6c8a2);
  bolt.lineBetween(3, -12, 99, -12);
  bolt.fillStyle(0xd9e4dc);
  bolt.fillTriangle(107, -12, 97, -16, 97, -8);
  bolt.fillStyle(0x6d9698);
  bolt.fillTriangle(5, -12, 14, -18, 21, -12);
  bolt.fillTriangle(5, -12, 14, -7, 21, -12);
  root.add(scene.add.zone(-48, -110, 84, 151).setOrigin(0));
  root.setData("crossbowParts", { string, bolt } satisfies CrossbowParts);
  setCrossbowState(root, 1, true);
  return root;
}
export function setCrossbowState(
  root: Phaser.GameObjects.Container,
  draw: number,
  loaded: boolean,
) {
  const parts = root.getData("crossbowParts") as CrossbowParts | undefined;
  if (!parts) return;
  const catchX = 79 - 76 * Math.max(0, Math.min(1, draw));
  parts.string.clear().lineStyle(1.5, 0xe3d7b7);
  parts.string.lineBetween(64, -43, catchX, -10);
  parts.string.lineBetween(catchX, -10, 64, 29);
  parts.bolt.setVisible(loaded);
}
export function drawBolt(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.lineStyle(2, 0xcbb995);
  g.lineBetween(0, -28, 0, 12);
  g.fillStyle(0xc8d5d1);
  g.fillTriangle(0, -34, -4, -26, 4, -26);
  g.fillStyle(0x668a8b);
  g.fillTriangle(0, 6, -4, 13, 0, 10);
  g.fillTriangle(0, 6, 4, 13, 0, 10);
  return scene.add.container(0, 0, [g]);
}
