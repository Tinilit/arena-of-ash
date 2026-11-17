import Phaser from "phaser";
import { skeleton } from "../characters/kinematics";

type Point = { x: number; y: number };
const ink = 0x202c34,
  shade = 0x805e51,
  light = 0xd7af8c;

/** A tapered capsule with tangent sides and circular joint-centered ends. */
function capsule(a: Point, b: Point, start: number, end: number): Point[] {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const tangent = Math.acos((start - end) / Math.hypot(b.x - a.x, b.y - a.y));
  const points: Point[] = [];
  const arc = (center: Point, radius: number, from: number, to: number) => {
    for (let i = 0; i <= 12; i++) {
      const t = from + ((to - from) * i) / 12;
      points.push({
        x: center.x + radius * Math.cos(t),
        y: center.y + radius * Math.sin(t),
      });
    }
  };
  arc(a, start, angle + tangent, angle + 2 * Math.PI - tangent);
  arc(b, end, angle - tangent, angle + tangent);
  return points;
}

/** Draw both segments together so the skin covers all interior joint outlines. */
export class LimbArt extends Phaser.GameObjects.Graphics {
  private bend = NaN;
  private boneAngle = NaN;
  private farSide: boolean;
  constructor(
    scene: Phaser.Scene,
    private kind: "arm" | "leg",
    private skin: number,
    far = false,
  ) {
    super(scene);
    scene.add.existing(this);
    this.farSide = far;
    this.setName(`${far ? "far" : "near"}-${kind}-skin`);
    if (far)
      this.skin = Phaser.Display.Color.GetColor(
        Math.round(((skin >> 16) & 255) * 0.93),
        Math.round(((skin >> 8) & 255) * 0.93),
        Math.round((skin & 255) * 0.93),
      );
  }
  pose(bend: number, upperAngle = 0) {
    if (
      Math.abs(this.bend - bend) < 0.00001 &&
      Math.abs(this.boneAngle - upperAngle) < 0.00001
    )
      return;
    this.bend = bend;
    this.boneAngle = upperAngle;
    this.clear();
    const arm = this.kind === "arm",
      upper = arm ? skeleton.upperArm : skeleton.thigh;
    const lower = arm ? skeleton.forearm : skeleton.shin;
    const root = { x: 0, y: 0 },
      joint = { x: 0, y: upper };
    const local = (x: number, y: number): Point => ({
      x: -Math.sin(bend) * y + Math.cos(bend) * x,
      y: upper + Math.cos(bend) * y + Math.sin(bend) * x,
    });
    const tip = local(0, lower);
    const radii = arm ? [11.5, 8, 5.5] : [14.5, 10.5, 8.5];
    const envelopes = [
      { a: root, b: joint, start: radii[0], end: radii[1] },
      ...(arm
        ? [
            { a: joint, b: local(0, lower * 0.28), start: radii[1], end: 9 },
            { a: local(0, lower * 0.28), b: tip, start: 9, end: radii[2] },
          ]
        : [{ a: joint, b: tip, start: radii[1], end: radii[2] }]),
    ];
    const paint = (points: Point[], color: number, alpha = 1) => {
      this.fillStyle(color, alpha);
      this.fillPoints(points, true);
    };
    // Paint the complete outline before either skin segment. A shared, covered
    // joint disc removes the stacked rings of independent outlined sprites.
    for (const outline of [1.5, 0]) {
      const color = outline ? ink : this.skin;
      for (const { a, b, start, end } of envelopes)
        paint(capsule(a, b, start + outline, end + outline), color);
    }
    if (arm) {
      // The humeral head sits inside the deltoid. Remove the circular socket
      // seam and outline only the exposed outer shoulder, in torso space.
      this.fillStyle(this.skin);
      this.fillCircle(0, 0, radii[0] + 1.5);
      const outer = (this.farSide ? Math.PI : 0) - upperAngle;
      this.lineStyle(1.7, ink);
      this.beginPath();
      this.arc(0, 0, radii[0] + 0.9, outer - 0.9, outer + 0.9);
      this.strokePath();
    }
    paint(
      capsule(
        { x: -radii[0] * 0.45, y: 2 },
        { x: -radii[1] * 0.45, y: upper - 2 },
        radii[0] * 0.3,
        radii[1] * 0.3,
      ),
      shade,
      0.28,
    );
    paint(
      capsule(
        local(-radii[1] * 0.45, 2),
        local(-radii[2] * 0.45, lower - 2),
        radii[1] * 0.3,
        radii[2] * 0.3,
      ),
      shade,
      0.28,
    );
    paint(capsule({ x: 3, y: 4 }, { x: 2, y: upper - 6 }, 3, 2), light, 0.25);
    // A short fold suggests the hinge without drawing a ring around the joint.
    this.lineStyle(1.1, shade, Math.min(0.45, Math.abs(bend) * 0.18));
    const fold = local(-3, 2);
    this.lineBetween(-4, upper - 2, fold.x, fold.y);
    if (arm) {
      const cuff = [
        [-7, lower - 13],
        [7, lower - 13],
        [6.5, lower - 1],
        [-6.5, lower - 1],
      ].map(([x, y]) => local(x, y));
      paint(cuff, 0x3d5968);
      this.lineStyle(1.5, 0x9cb6bd, 0.9);
      for (const y of [lower - 12, lower - 3]) {
        const a = local(-6, y),
          b = local(6, y);
        this.lineBetween(a.x, a.y, b.x, b.y);
      }
    } else {
      // Follow the full calf width rather than placing a narrow plate on skin.
      const radius = (y: number) =>
        radii[1] + ((radii[2] - radii[1]) * y) / lower;
      const top = radius(8),
        bottom = radius(lower - 10);
      const plate = [
        [-top, 8],
        [-top + 2, 4],
        [top - 2, 4],
        [top, 8],
        [bottom, lower - 10],
        [bottom - 1, lower - 8],
        [-bottom + 1, lower - 8],
        [-bottom, lower - 10],
      ].map(([x, y]) => local(x, y));
      paint(plate, ink);
      const surface = [
        [-top + 1.2, 9],
        [-top + 2.5, 5.5],
        [top - 2.5, 5.5],
        [top - 1.2, 9],
        [bottom - 1.2, lower - 10],
        [bottom - 2, lower - 9],
        [-bottom + 2, lower - 9],
        [-bottom + 1.2, lower - 10],
      ].map(([x, y]) => local(x, y));
      paint(surface, 0x758d99);
      paint(
        [
          [-top + 1.2, 9],
          [-3, 7],
          [-2, lower - 10],
          [-bottom + 1.2, lower - 10],
        ].map(([x, y]) => local(x, y)),
        0x445d68,
      );
      const a = local(4, 9),
        b = local(3, lower - 12);
      this.lineStyle(2, 0xc3d1ce, 0.85);
      this.lineBetween(a.x, a.y, b.x, b.y);
    }
  }
}
