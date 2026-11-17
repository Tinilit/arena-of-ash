import Phaser from "phaser";
import { item } from "../data/catalog";
import type { Player } from "../domain/model";
import { drawPart, drawGear } from "../rendering/characterVisuals";
import { motionProfiles } from "./motionProfiles";
import type { VisualStyle } from "./presentation";
import { Animator } from "./animation";
export class Gladiator {
  root: Phaser.GameObjects.Container;
  animator: Animator;
  private joints: Record<string, Phaser.GameObjects.Container> = {};
  private shadow: Phaser.GameObjects.Ellipse;
  private jointNames: string[] = [];
  private originX: number;
  private originY: number;
  private direction: number;
  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    model: Player,
    enemy = false,
    scale = 1.25,
    style: VisualStyle = scene.registry.get("services")?.style ?? "original",
    private motionScale = 1,
  ) {
    this.animator = new Animator(motionProfiles[style]);
    this.originX = x;
    this.originY = y;
    this.direction = enemy ? -1 : 1;
    this.shadow = scene.add.ellipse(x, y + 4, 126, 22, 0x30281f, 0.3);
    this.root = scene.add
      .container(x, y)
      .setScale(scale * this.direction, scale);
    const skin = enemy ? 0xba805b : 0xd79e72;
    const joint = (
      name: string,
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      kind?: string,
      color = skin,
    ) => {
      const c = scene.add.container(x, y);
      parent.add(c);
      this.joints[name] = c;
      this.jointNames.push(name);
      if (kind) c.add(drawPart(scene, kind, color, style));
      return c;
    };
    const pelvis = joint("pelvis", this.root, 0, -95);
    const farThigh = joint("farThigh", pelvis, 15, 14, "thigh");
    const farShin = joint("farShin", farThigh, 0, 44, "shin");
    joint("farFoot", farShin, 0, 43, "foot", 0x694634);
    const torso = joint("torso", pelvis, 0, -76);
    const farArm = joint("farArm", torso, -23, 15, "upper");
    const farElbow = joint("farElbow", farArm, 0, 38, "forearm");
    const farHand = joint("farHand", farElbow, 0, 35, "hand");
    if (model.equipment.shield)
      farHand.add(
        drawGear(
          scene,
          item(model.equipment.shield)?.visual ?? "shield",
          style,
        ),
      );
    torso.add(drawPart(scene, "torso", skin, style));
    if (model.equipment.chest)
      torso.add(
        drawGear(
          scene,
          item(model.equipment.chest)?.visual ?? "leather",
          style,
        ),
      );
    const head = joint("head", torso, 0, -8, "head");
    if (model.equipment.helmet)
      head.add(
        drawGear(scene, item(model.equipment.helmet)?.visual ?? "cap", style),
      );
    pelvis.add(drawPart(scene, "pelvis", enemy ? 0x623e3b : 0x3e5c61, style));
    const nearThigh = joint("nearThigh", pelvis, -14, 14, "thigh");
    const nearShin = joint("nearShin", nearThigh, 0, 44, "shin");
    joint("nearFoot", nearShin, 0, 43, "foot", 0x694634);
    const nearArm = joint("nearArm", torso, 25, 17, "upper");
    const nearElbow = joint("nearElbow", nearArm, 0, 38, "forearm");
    const nearHand = joint("nearHand", nearElbow, 0, 35, "hand");
    if (model.equipment.weapon)
      nearHand.add(
        drawGear(
          scene,
          item(model.equipment.weapon)?.visual ?? "wood",
          style,
        ).setRotation(Math.PI),
      );
    scene.events.once("shutdown", () => this.animator.stop());
  }
  update(delta: number) {
    const p = this.animator.update(delta);
    for (const name of this.jointNames)
      if (p[name] !== undefined) this.joints[name].rotation = p[name]!;
    this.root.x =
      this.originX + (p.rootX ?? 0) * this.direction * this.motionScale;
    this.shadow.x = this.root.x;
    this.root.y = this.originY + (p.rootY ?? 0);
    this.root.rotation = (p.rootR ?? 0) * this.direction;
  }
  play(name: string, impact?: () => void, complete?: () => void) {
    this.animator.play(name, impact, complete);
  }
  flash() {
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0.45,
      duration: 70,
      yoyo: true,
      repeat: 1,
    });
  }
}
