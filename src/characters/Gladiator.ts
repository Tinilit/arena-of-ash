import Phaser from "phaser";
import { item } from "../data/catalog";
import type { Player } from "../domain/model";
import { drawPart, drawGear } from "../rendering/characterVisuals";
import { equipmentMotion } from "./equipmentMotion";
import { groundedPose, skeleton } from "./kinematics";
import { Animator } from "./animation";
export class Gladiator {
  root: Phaser.GameObjects.Container;
  animator: Animator;
  private joints: Record<string, Phaser.GameObjects.Container> = {};
  private shadow: Phaser.GameObjects.Ellipse;
  private direction: number;
  private shieldMount?: Phaser.GameObjects.Container;
  private weapons: Phaser.GameObjects.Container[] = [];
  constructor(
    private scene: Phaser.Scene,
    private originX: number,
    private originY: number,
    model: Player,
    enemy = false,
    private bodyScale = 1.25,
  ) {
    const weapon = item(model.equipment.weapon ?? "");
    this.animator = new Animator(equipmentMotion(weapon));
    this.direction = enemy ? -1 : 1;
    this.shadow = scene.add.ellipse(
      originX,
      originY + 4,
      126,
      22,
      0x30281f,
      0.3,
    );
    this.root = scene.add
      .container(originX, originY)
      .setScale(bodyScale * this.direction, bodyScale);
    const skin = enemy ? 0xba805b : 0xd79e72;
    const stretch: Record<string, number> = {
      thigh: skeleton.thigh / 44,
      shin: skeleton.shin / 43,
      upper: skeleton.upperArm / 38,
      forearm: skeleton.forearm / 35,
    };
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
      if (kind)
        c.add(drawPart(scene, kind, color).setScale(1, stretch[kind] ?? 1));
      return c;
    };
    const pelvis = joint("pelvis", this.root, 0, skeleton.pelvisY);
    const farThigh = joint("farThigh", pelvis, skeleton.farHipX, 10, "thigh");
    const farShin = joint("farShin", farThigh, 0, skeleton.thigh, "shin");
    joint("farFoot", farShin, 0, skeleton.shin, "foot", 0x694634);
    const torso = joint("torso", pelvis, 0, 0);
    const farArm = joint(
      "farArm",
      torso,
      skeleton.farShoulderX,
      skeleton.shoulderY,
      "upper",
    );
    const farElbow = joint("farElbow", farArm, 0, skeleton.upperArm, "forearm");
    const farHand = joint("farHand", farElbow, 0, skeleton.forearm, "hand");
    if (model.equipment.shield) {
      this.shieldMount = drawGear(
        scene,
        item(model.equipment.shield) ?? "shield",
      );
      farHand.add(this.shieldMount);
    }
    torso.add(drawPart(scene, "torso", skin).setY(skeleton.torsoArtY));
    if (model.equipment.chest)
      torso.add(
        drawGear(scene, item(model.equipment.chest) ?? "leather").setY(
          skeleton.torsoArtY,
        ),
      );
    const head = joint("head", torso, 0, skeleton.headY, "head");
    if (model.equipment.helmet)
      head.add(drawGear(scene, item(model.equipment.helmet) ?? "cap"));
    pelvis.add(drawPart(scene, "pelvis", 0x3e5c61));
    const nearThigh = joint(
      "nearThigh",
      pelvis,
      skeleton.nearHipX,
      10,
      "thigh",
    );
    const nearShin = joint("nearShin", nearThigh, 0, skeleton.thigh, "shin");
    joint("nearFoot", nearShin, 0, skeleton.shin, "foot", 0x694634);
    const nearArm = joint(
      "nearArm",
      torso,
      skeleton.nearShoulderX,
      skeleton.shoulderY,
      "upper",
    );
    const nearElbow = joint(
      "nearElbow",
      nearArm,
      0,
      skeleton.upperArm,
      "forearm",
    );
    const nearHand = joint("nearHand", nearElbow, 0, skeleton.forearm, "hand");
    if (weapon) {
      const mounted = drawGear(scene, weapon).setRotation(Math.PI / 2);
      nearHand.add(mounted);
      this.weapons.push(mounted);
    }
    if (item(model.equipment.shield ?? "")?.visual === "tower") {
      torso.bringToTop(farArm);
      torso.bringToTop(nearArm);
    }
    scene.events.once("shutdown", () => this.animator.stop());
  }
  update(delta: number) {
    const p = this.animator.update(delta),
      solved = groundedPose(p);
    this.joints.torso.rotation = solved.torso;
    this.joints.head.rotation = p.head ?? 0;
    for (const side of ["near", "far"] as const) {
      const leg = side === "near" ? solved.nearLeg : solved.farLeg,
        arm = side === "near" ? solved.nearArm : solved.farArm;
      this.joints[`${side}Thigh`].rotation = leg.angle;
      this.joints[`${side}Shin`].rotation = leg.bend;
      this.joints[`${side}Foot`].rotation = leg.foot;
      this.joints[`${side}Arm`].rotation = arm.angle;
      this.joints[`${side}Elbow`].rotation = arm.bend;
      this.joints[`${side}Hand`].rotation = arm.wrist;
    }
    if (this.shieldMount)
      this.shieldMount.rotation = -(
        solved.torso +
        solved.farArm.angle +
        solved.farArm.bend +
        solved.farArm.wrist
      );
    this.root.x =
      this.originX + solved.root.x * this.bodyScale * this.direction;
    this.root.y = this.originY + solved.root.y * this.bodyScale;
    this.root.rotation = solved.root.rotation * this.direction;
    this.shadow.x = this.root.x;
  }
  jointSnapshot() {
    const point = (name: string, x = 0, y = 0) => {
      const p = this.joints[name]
        .getWorldTransformMatrix()
        .transformPoint(x, y);
      return { x: p.x, y: p.y };
    };
    return {
      physical: true,
      shield: Boolean(this.shieldMount),
      weapons: this.weapons.map((weapon) => {
        const p = weapon.getWorldTransformMatrix().transformPoint(0, 0);
        return { x: p.x, y: p.y, texture: weapon.name || null };
      }),
      scale: Math.abs(this.root.scaleY),
      near: {
        hip: point("nearThigh"),
        knee: point("nearShin"),
        ankle: point("nearFoot"),
        shoulder: point("nearArm"),
        elbow: point("nearElbow"),
        hand: point("nearHand"),
        heel: point("nearFoot", -12, skeleton.soleY),
        toe: point("nearFoot", 26, skeleton.soleY),
      },
      far: {
        hip: point("farThigh"),
        knee: point("farShin"),
        ankle: point("farFoot"),
        shoulder: point("farArm"),
        elbow: point("farElbow"),
        hand: point("farHand"),
        heel: point("farFoot", -12, skeleton.soleY),
        toe: point("farFoot", 26, skeleton.soleY),
      },
    };
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
