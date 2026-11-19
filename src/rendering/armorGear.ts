import type Phaser from "phaser";

export const armorBounds: Record<string, [number, number, number, number]> = {
  "closed-helm": [-36, -55, 82, 86],
  cuirass: [-37, -6, 74, 78],
};

/** Original Ash Vanguard steel armor, drawn in the rig's three-quarter view. */
export function drawArmor(scene: Phaser.Scene, id: string) {
  const g = scene.add.graphics(),
    ink = 0x202c34,
    steel = 0x758d99,
    light = 0xc3d1ce,
    shade = 0x3e5362,
    brass = 0xc6a367;
  const plate = (points: number[][], color: number) => {
    const path = points.map(([x, y]) => ({ x, y }));
    g.fillStyle(color).fillPoints(path, true);
    g.lineStyle(2, ink).strokePoints(path, true);
  };
  if (id === "closed-helm") {
    g.fillStyle(shade).fillRoundedRect(-29, -50, 60, 70, 20);
    g.lineStyle(2, ink).strokeRoundedRect(-29, -50, 60, 70, 20);
    plate(
      [
        [-26, 5],
        [18, 5],
        [34, 26],
        [-32, 26],
        [-22, 13],
      ],
      steel,
    );
    plate(
      [
        [-6, -49],
        [18, -47],
        [29, -34],
        [33, -13],
        [12, -11],
        [-6, -24],
      ],
      steel,
    );
    plate(
      [
        [6, -29],
        [31, -27],
        [42, -8],
        [33, 4],
        [29, 17],
        [9, 18],
        [-2, 4],
      ],
      steel,
    );
    plate(
      [
        [17, -8],
        [42, -8],
        [33, 4],
        [29, 17],
        [17, 12],
      ],
      shade,
    );
    g.lineStyle(4, ink).lineBetween(10, -20, 32, -17);
    g.lineStyle(1.5, light).lineBetween(-2, -43, 16, -42);
    g.lineBetween(7, -28, 29, -26);
    g.lineBetween(14, -12, 36, -8);
    g.lineBetween(8, 20, 28, 23);
    g.lineStyle(2, brass).lineBetween(-27, 25, 31, 25);
    g.fillStyle(brass).fillCircle(2, -19, 4);
    g.fillStyle(ink).fillCircle(2, -19, 1.5);
    for (const [x, y] of [
      [23, -1],
      [29, 0],
      [20, 5],
      [26, 6],
    ])
      g.fillStyle(ink).fillCircle(x, y, 1.4);
    g.lineStyle(2, ink).lineBetween(-19, -35, -20, 4);
  } else {
    plate(
      [
        [-33, 0],
        [-19, -3],
        [-10, 7],
        [7, 9],
        [19, -3],
        [33, 1],
        [31, 31],
        [23, 53],
        [-23, 53],
        [-32, 29],
      ],
      steel,
    );
    plate(
      [
        [-32, 7],
        [-18, 10],
        [-13, 35],
        [-22, 50],
        [-30, 28],
      ],
      shade,
    );
    plate(
      [
        [3, 13],
        [25, 4],
        [28, 26],
        [18, 47],
        [1, 50],
      ],
      0x92aab2,
    );
    g.lineStyle(2, light).lineBetween(1, 14, 0, 49);
    g.lineBetween(-16, 11, -3, 17);
    g.lineBetween(5, 17, 24, 9);
    plate(
      [
        [-24, 48],
        [0, 53],
        [23, 48],
        [30, 61],
        [19, 68],
        [-23, 66],
        [-31, 60],
      ],
      shade,
    );
    g.lineStyle(2, brass).lineBetween(-24, 50, 0, 56);
    g.lineBetween(0, 56, 24, 51);
    g.lineStyle(1.5, light).lineBetween(-25, 60, -3, 65);
    g.lineBetween(2, 65, 24, 60);
    for (const x of [-27, 27]) {
      g.fillStyle(brass).fillCircle(x, 5, 2.5);
      g.fillCircle(x * 0.8, 53, 2);
    }
  }
  return g;
}
