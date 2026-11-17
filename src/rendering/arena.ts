import Phaser from "phaser";
export function arena(s: Phaser.Scene) {
  const g = s.add.graphics();
  g.fillGradientStyle(0x151f27, 0x25313a, 0xb37c4d, 0xd6a367, 1);
  g.fillRect(0, 0, 1280, 720);
  g.fillStyle(0x654d3c);
  g.fillRect(0, 225, 1280, 240);
  for (let i = 0; i < 11; i++) {
    const x = i * 128 - 14;
    g.fillStyle(0x322e2b);
    g.fillRoundedRect(x + 18, 241, 88, 156, { tl: 44, tr: 44, bl: 0, br: 0 });
    g.fillStyle(0x9d7956);
    g.fillRect(x, 227, 17, 219);
    g.fillStyle(0xc49b6b);
    g.fillRect(x - 5, 219, 28, 17);
    g.fillRect(x - 4, 427, 26, 19);
  }
  g.fillStyle(0x91704f);
  g.fillRect(0, 397, 1280, 15);
  g.fillStyle(0xbf955e);
  g.fillRect(0, 446, 1280, 122);
  g.fillStyle(0xa67d4e);
  g.fillEllipse(640, 548, 1500, 140);
  for (let i = 0; i < 90; i++) {
    g.fillStyle(i % 2 ? 0x292b2b : 0x4b3830);
    g.fillCircle(12 + i * 15, 219 - (i % 3) * 4, 5);
    g.fillRect(8 + i * 15, 220 - (i % 3) * 4, 9, 12);
  }
  g.lineStyle(1, 0xe3b878, 0.15);
  for (let i = 0; i < 50; i++) {
    const x = (i * 137) % 1280;
    const y = 468 + ((i * 19) % 84);
    g.lineBetween(x, y, x + 14, y - 2);
  }
  g.fillStyle(0x1a2024, 0.85);
  g.fillRect(0, 0, 1280, 136);
  g.fillStyle(0x191e20);
  g.fillRect(0, 568, 1280, 152);
  g.lineStyle(2, 0xb58b52);
  g.lineBetween(32, 137, 1248, 137);
  g.lineBetween(32, 567, 1248, 567);
}
