import Phaser from "phaser";
import { faceExpression } from "../characters/faceExpression";
/** Expressions stay in the head plane below helmets and throwing arms. */
export function drawFace(
  g: Phaser.GameObjects.Graphics,
  remaining: number,
  rageRemaining = 0,
  activationRemaining = 0,
) {
  const { pain, enraged, eyeColor, roar, mouth } = faceExpression(
    remaining,
    rageRemaining,
    activationRemaining,
  );
  g.clear();
  g.lineStyle(3, 0x202c34);
  g.lineBetween(
    enraged ? 9 : 10,
    (enraged ? -21 : -19) + pain * 3,
    22,
    (enraged ? -14 : -16) - pain * 2,
  );
  if (pain < 0.8) {
    g.fillStyle(enraged ? 0xffb8a0 : 0xffedc8);
    g.fillEllipse(17, -12, 10, 6 * (1 - pain));
    g.fillStyle(eyeColor);
    g.fillEllipse(20, -12, enraged ? 6 : 5, 5 * (1 - pain));
    if (enraged) {
      g.fillStyle(0xff8060);
      g.fillCircle(20, -12, 1);
    }
  } else {
    g.lineStyle(2.5, eyeColor);
    g.lineBetween(12, -12, 17, -10);
    g.lineBetween(17, -10, 23, -13);
  }
  g.lineStyle(2, 0x202c34);
  if (mouth === "roar") {
    g.fillStyle(0x381f22);
    g.fillEllipse(20, 8, 12, 6 + roar * 8);
    g.fillStyle(0xffe6ba);
    g.fillRoundedRect(15, 3, 10, 3, 1);
  } else if (mouth === "snarl") {
    g.fillStyle(0x381f22);
    const lips = [
      { x: 14, y: 5 },
      { x: 25, y: 2 },
      { x: 26, y: 10 },
      { x: 16, y: 10 },
    ];
    g.fillPoints(lips, true);
    g.strokePoints(lips, true);
    g.fillStyle(0xffe6ba);
    g.fillTriangle(15, 5, 25, 3, 25, 7);
    g.lineBetween(18, 4, 18, 7);
    g.lineBetween(22, 3, 22, 7);
  } else {
    g.lineBetween(17 - 2 * pain, 5, 25, 4 + 3 * pain);
    if (pain > 0.3) {
      g.lineBetween(15, 5, 17, 9);
      g.lineBetween(17, 9, 23, 9);
    }
  }
}
