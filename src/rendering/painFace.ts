import Phaser from "phaser";
/** Closed lids, lowered brow and tense mouth blend without changing head shape. */
export function drawFace(g: Phaser.GameObjects.Graphics, remaining: number) {
  const age = 420 - remaining;
  const pain = remaining > 0 ? Math.min(1, age / 35, remaining / 150) : 0;
  g.clear();
  g.lineStyle(3, 0x202c34);
  g.lineBetween(10, -19 + pain * 3, 22, -16 - pain * 2);
  if (pain < 0.8) {
    g.fillStyle(0xffedc8);
    g.fillEllipse(17, -12, 10, 6 * (1 - pain));
    g.fillStyle(0x202c34);
    g.fillEllipse(20, -12, 5, 5 * (1 - pain));
  } else {
    g.lineStyle(2.5, 0x202c34);
    g.lineBetween(12, -12, 17, -10);
    g.lineBetween(17, -10, 23, -13);
  }
  g.lineStyle(2, 0x202c34);
  g.lineBetween(17 - 2 * pain, 5, 25, 4 + 3 * pain);
  if (pain > 0.3) {
    g.lineBetween(15, 5, 17, 9);
    g.lineBetween(17, 9, 23, 9);
  }
}
