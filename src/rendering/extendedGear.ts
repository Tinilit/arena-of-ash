import Phaser from "phaser";
export const extendedGearBounds: Record<
  string,
  [number, number, number, number]
> = {
  spear: [-15, -136, 30, 208],
  "war-spear": [-19, -154, 38, 244],
  viking: [-60, -83, 120, 104],
  tower: [-42, -71, 84, 169],
  net: [-16, -5, 32, 49],
  flask: [-15, -5, 30, 44],
};
export function extendedGear(scene: Phaser.Scene, id: string) {
  if (!extendedGearBounds[id]) return null;
  const g = scene.add.graphics();
  const ink = 0x232a2c,
    metal = 0x9cb6bd,
    light = 0xe2e8d7,
    trim = 0x8daaba;
  g.lineStyle(2, ink);
  const polygon = (points: { x: number; y: number }[], color: number) => {
    g.fillStyle(color);
    g.fillPoints(points, true);
    g.strokePoints(points, true);
  };
  if (id === "net") {
    g.fillStyle(0x5a4632);
    g.fillRoundedRect(-12, 5, 24, 32, 8);
    g.strokeRoundedRect(-12, 5, 24, 32, 8);
    g.lineStyle(2, 0xc2a270);
    for (let x = -12; x <= 10; x += 6) {
      g.lineBetween(x, 7, Math.min(12, x + 16), 33);
      g.lineBetween(x, 33, Math.min(12, x + 16), 7);
    }
    g.lineStyle(3, 0x795a35);
    g.strokeEllipse(0, 6, 21, 10);
    g.lineBetween(0, -4, 0, 7);
  } else if (id === "flask") {
    g.fillStyle(0xa76e46);
    g.fillEllipse(0, 22, 25, 30);
    g.strokeEllipse(0, 22, 25, 30);
    g.fillRoundedRect(-6, 0, 12, 13, 3);
    g.strokeRoundedRect(-6, 0, 12, 13, 3);
    g.fillStyle(0xd3af74);
    g.fillRect(-5, -3, 10, 6);
    g.lineStyle(2, 0x594733);
    g.lineBetween(-12, 15, 10, 31);
    g.lineStyle(2, 0xe4bd88, 0.6);
    g.strokeEllipse(3, 20, 13, 18);
  } else if (id === "spear" || id === "war-spear") {
    const war = id === "war-spear",
      tip = war ? -150 : -132,
      socket = war ? -113 : -99,
      tail = war ? 84 : 66;
    // A wooden haft, socketed leaf head and butt cap, never a stretched sword.
    g.fillStyle(0x725035);
    g.fillRoundedRect(-4, socket, 8, tail - socket, 3);
    g.strokeRoundedRect(-4, socket, 8, tail - socket, 3);
    g.lineStyle(1, 0xc69b65);
    g.lineBetween(-1, socket + 10, -1, tail - 6);
    polygon(
      [
        { x: 0, y: tip },
        { x: war ? 13 : 10, y: tip + 23 },
        { x: 5, y: socket },
        { x: -5, y: socket },
        { x: war ? -13 : -10, y: tip + 23 },
      ],
      metal,
    );
    g.fillStyle(light);
    g.fillTriangle(0, tip, war ? 10 : 8, tip + 23, 0, socket);
    g.lineStyle(1, ink);
    g.lineBetween(0, tip + 8, 0, socket);
    g.fillStyle(trim);
    g.fillRect(-5, socket - 3, 10, 16);
    g.lineStyle(1, ink);
    g.strokeRect(-5, socket - 3, 10, 16);
    g.fillStyle(0x3f3028);
    g.fillRoundedRect(-5, -14, 10, 35, 2);
    g.lineStyle(1, 0xc5a376);
    for (let y = -10; y < 19; y += 5) g.lineBetween(-5, y, 5, y + 3);
    g.fillStyle(metal);
    g.fillRoundedRect(-5, tail - 8, 10, 12, 2);
    g.lineStyle(1, light);
    g.lineBetween(-3, tail - 5, 3, tail - 5);
  } else if (id === "viking") {
    // Fantasy horned warhelm, with a visible eye and an independent nasal guard.
    polygon(
      [
        { x: -20, y: -41 },
        { x: -35, y: -50 },
        { x: -47, y: -76 },
        { x: -57, y: -80 },
        { x: -51, y: -54 },
        { x: -34, y: -32 },
      ],
      0xd8c89e,
    );
    polygon(
      [
        { x: 17, y: -43 },
        { x: 34, y: -53 },
        { x: 45, y: -78 },
        { x: 55, y: -81 },
        { x: 50, y: -56 },
        { x: 33, y: -32 },
      ],
      0xe7d5ab,
    );
    g.fillStyle(metal);
    g.fillRoundedRect(-27, -49, 55, 31, 14);
    g.strokeRoundedRect(-27, -49, 55, 31, 14);
    g.fillStyle(0x52666e);
    g.fillRoundedRect(-24, -46, 15, 27, 6);
    g.fillStyle(light, 0.5);
    g.fillRoundedRect(8, -44, 8, 17, 3);
    g.fillStyle(trim);
    g.fillRoundedRect(-29, -27, 60, 10, 3);
    g.strokeRoundedRect(-29, -27, 60, 10, 3);
    g.fillRect(-3, -49, 7, 29);
    polygon(
      [
        { x: 21, y: -23 },
        { x: 29, y: -21 },
        { x: 31, y: 3 },
        { x: 24, y: 5 },
      ],
      metal,
    );
    for (const x of [-23, -12, 12, 24]) {
      g.fillStyle(light);
      g.fillCircle(x, -22, 2);
    }
  } else if (id === "tower") {
    polygon(
      [
        { x: -35, y: -55 },
        { x: -24, y: -66 },
        { x: 24, y: -66 },
        { x: 36, y: -55 },
        { x: 36, y: 76 },
        { x: 24, y: 93 },
        { x: -24, y: 93 },
        { x: -36, y: 76 },
      ],
      trim,
    );
    polygon(
      [
        { x: -28, y: -51 },
        { x: -20, y: -59 },
        { x: 20, y: -59 },
        { x: 29, y: -50 },
        { x: 29, y: 73 },
        { x: 19, y: 85 },
        { x: -19, y: 85 },
        { x: -29, y: 73 },
      ],
      0x694a34,
    );
    g.lineStyle(1.5, 0xba8c57);
    for (const x of [-17, -5, 7, 19]) g.lineBetween(x, -54, x, 79);
    g.fillStyle(0x354e60);
    g.fillRect(-11, -56, 22, 138);
    g.lineStyle(4, metal);
    g.lineBetween(-29, -22, 29, -22);
    g.lineBetween(-29, 49, 29, 49);
    g.fillStyle(metal);
    g.fillEllipse(0, 9, 28, 35);
    g.fillStyle(light, 0.7);
    g.fillEllipse(4, 4, 9, 13);
    for (const y of [-50, -23, 48, 75])
      for (const x of [-24, 24]) {
        g.fillStyle(light);
        g.fillCircle(x, y, 2.5);
      }
  }
  return g;
}
