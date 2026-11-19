import type Phaser from "phaser";

export const arenaGearBounds: Record<string, [number, number, number, number]> =
  {
    chainmail: [-36, -5, 72, 85],
    "legionary-helm": [-55, -94, 98, 124],
    trident: [-31, -201, 62, 309],
    "speed-potion": [-13, -28, 26, 53],
  };

/** Original Ash Vanguard equipment: interlinked mail, a crested helm and a real forked polearm. */
export function drawArenaGear(scene: Phaser.Scene, id: string) {
  const [x, y, width, height] = arenaGearBounds[id];
  const key = `arena-gear-v3-${id}`;
  const sprite = () => scene.add.image(x, y, key).setOrigin(0).setScale(0.5);
  if (scene.textures.exists(key)) return sprite();
  const g = scene.add.graphics(),
    ink = 0x202c34,
    steel = 0x829ba5,
    light = 0xc3d1ce,
    gold = 0xc6a367;
  // Cache detailed static art at double resolution instead of replaying hundreds
  // of mail-ring paths every frame. Local coordinates and equipment mounts stay exact.
  g.scaleCanvas(2, 2).translateCanvas(-x, -y);
  const polygon = (points: number[][], color: number) => {
    const p = points.map(([x, y]) => ({ x, y }));
    g.fillStyle(color).fillPoints(p, true);
    g.lineStyle(2, ink).strokePoints(p, true);
  };
  if (id === "trident") {
    g.fillStyle(0x79563b).fillRoundedRect(-5, -154, 10, 258, 3);
    g.lineStyle(2, ink).strokeRoundedRect(-5, -154, 10, 258, 3);
    g.fillStyle(0x3b302b).fillRoundedRect(-6, -25, 12, 70, 2);
    for (let y = -20; y < 45; y += 6)
      g.lineStyle(1, gold).lineBetween(-5, y, 5, y + 2);
    polygon(
      [
        [-5, -140],
        [-24, -154],
        [-27, -184],
        [-21, -194],
        [-17, -180],
        [-17, -160],
        [-5, -153],
      ],
      steel,
    );
    polygon(
      [
        [5, -140],
        [24, -154],
        [27, -184],
        [21, -194],
        [17, -180],
        [17, -160],
        [5, -153],
      ],
      steel,
    );
    polygon(
      [
        [-6, -148],
        [-5, -180],
        [0, -199],
        [5, -180],
        [6, -148],
      ],
      steel,
    );
    g.lineStyle(2, light).lineBetween(0, -192, 0, -149);
    g.fillStyle(gold).fillRoundedRect(-9, -147, 18, 8, 2);
    g.fillStyle(steel).fillCircle(0, 101, 6);
  } else if (id === "chainmail") {
    polygon(
      [
        [-31, 1],
        [-17, -1],
        [-10, 8],
        [10, 8],
        [18, -1],
        [31, 2],
        [33, 34],
        [26, 74],
        [-26, 74],
        [-33, 34],
      ],
      0x3f515b,
    );
    for (let row = 0; row < 12; row++) {
      const y = 10 + row * 5;
      for (let x = -25 + (row % 2) * 3; x < 28; x += 6) {
        if (y < 20 && Math.abs(x) < 12) continue;
        g.lineStyle(1.4, 0x192c36).strokeEllipse(x, y + 1, 6, 5);
        g.lineStyle(1, 0x9eb4ba).strokeEllipse(x, y, 5, 4);
      }
    }
    g.lineStyle(3, 0x76523c).lineBetween(-29, 4, -12, 12);
    g.lineBetween(12, 12, 29, 5);
    g.lineStyle(5, 0x76523c).lineBetween(-28, 55, 28, 55);
    g.lineStyle(1.5, gold).strokeRect(4, 51, 9, 8);
  } else if (id === "legionary-helm") {
    // Open-faced Roman profile: the brow stays above the eyes, and the
    // near cheek guard stays behind the nose and mouth rather than masking them.
    g.save()
      .translateCanvas(-8, -40)
      .scaleCanvas(0.82, 0.75)
      .translateCanvas(8, 40);
    polygon(
      [
        [-35, 3],
        [-55, -18],
        [-59, -49],
        [-48, -78],
        [-25, -100],
        [4, -108],
        [30, -99],
        [41, -83],
        [25, -59],
        [-11, -48],
      ],
      0xbc4136,
    );
    for (const [ox, oy, ix, iy] of [
      [-51, -22, -32, -18],
      [-56, -42, -30, -33],
      [-51, -63, -27, -44],
      [-39, -83, -18, -53],
      [-22, -98, -8, -58],
      [-2, -104, 3, -62],
      [17, -100, 14, -64],
      [34, -86, 23, -65],
    ]) {
      g.lineStyle(2, 0x762f2f).lineBetween(ox, oy, ix, iy);
      g.lineStyle(1.2, 0xe36c4d).lineBetween(ox + 3, oy + 1, ix + 2, iy);
    }
    polygon(
      [
        [-35, 5],
        [-38, -22],
        [-27, -49],
        [-9, -63],
        [15, -67],
        [30, -59],
        [27, -51],
        [6, -53],
        [-15, -40],
        [-25, -18],
        [-26, 5],
      ],
      ink,
    );
    g.restore();
    // Flared nape guard is entirely behind the open face.
    polygon(
      [
        [-27, -11],
        [-40, 9],
        [-53, 16],
        [-39, 25],
        [-15, 20],
        [-8, 8],
      ],
      steel,
    );
    g.lineStyle(2, gold).lineBetween(-49, 17, -37, 21);
    g.lineBetween(-37, 21, -17, 17);
    polygon(
      [
        [-30, -17],
        [-30, -35],
        [-23, -48],
        [-8, -55],
        [13, -53],
        [25, -44],
        [29, -29],
        [19, -25],
        [-9, -25],
      ],
      steel,
    );
    polygon(
      [
        [-24, -34],
        [-18, -45],
        [-4, -49],
        [12, -47],
        [20, -40],
        [7, -41],
        [-11, -37],
      ],
      light,
    );
    g.lineStyle(2.5, gold).lineBetween(-23, -27, 28, -28);
    // Raised projecting brow: its bottom edge clears the anatomical eyebrow.
    polygon(
      [
        [-22, -28],
        [24, -30],
        [38, -25],
        [34, -22],
        [-24, -21],
      ],
      steel,
    );
    g.lineStyle(2, gold).lineBetween(-21, -23, 34, -24);
    polygon(
      [
        [-26, -18],
        [-14, -21],
        [-8, -12],
        [-10, -1],
        [-4, 12],
        [2, 18],
        [-13, 20],
        [-25, 8],
        [-29, -5],
      ],
      steel,
    );
    g.lineStyle(2, gold).lineBetween(-16, -15, -18, -2);
    g.lineBetween(-18, -2, -12, 12);
    g.lineBetween(-12, 12, -2, 16);
    g.lineStyle(1.5, light).lineBetween(-25, -11, -23, 5);
    g.fillStyle(gold).fillCircle(-20, -18, 3);
  } else {
    g.fillStyle(0x4f354d).fillRoundedRect(-11, -9, 22, 32, 6);
    g.lineStyle(2, ink).strokeRoundedRect(-11, -9, 22, 32, 6);
    g.fillStyle(0x3cddd5).fillRoundedRect(-8, 0, 16, 19, 4);
    g.fillStyle(0xabc8c6).fillRoundedRect(-5, -21, 10, 16, 2);
    g.lineStyle(2, ink).strokeRoundedRect(-5, -21, 10, 16, 2);
    g.fillStyle(0xb38a56).fillRoundedRect(-6, -26, 12, 7, 2);
    polygon(
      [
        [3, -3],
        [-5, 7],
        [0, 7],
        [-3, 16],
        [6, 4],
        [1, 4],
      ],
      0xf5e0a2,
    );
    g.lineStyle(1.5, 0xe4ffff).lineBetween(-7, 1, -7, 13);
  }
  g.generateTexture(key, width * 2, height * 2);
  g.destroy();
  return sprite();
}
