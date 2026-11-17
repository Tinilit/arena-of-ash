import Phaser from "phaser";
import { item } from "../data/catalog";
import type { Player } from "../domain/model";
import { drawPart, drawGear } from "../rendering/characterVisuals";
import { equipmentMotion } from "./equipmentMotion";
import { groundedPose, skeleton } from "./kinematics";
import type { VisualStyle, MotionMode } from "./presentation";
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
  private physical: boolean;
  private bodyScale: number;
  private shieldMount?: Phaser.GameObjects.Container;
  private weapons: Phaser.GameObjects.Container[] = [];
  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    model: Player,
    enemy = false,
    scale = 1.25,
    style: VisualStyle = scene.registry.get("services")?.style ?? "original",
    private motionScale = 1,
    motion: MotionMode = scene.registry.get("services")?.motion ?? "grounded",
  ) {
    this.physical = motion === "grounded";
    this.bodyScale = scale;
    const weapon = item(model.equipment.weapon ?? "");
    const paired = weapon?.occupiesOffhand === true;
    this.animator = new Animator(equipmentMotion(style, motion, weapon));
    const physical = this.physical;
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
      if (kind) {
        const visual = drawPart(scene, kind, color, style);
        const stretch = physical
          ? kind === "thigh"
            ? skeleton.thigh / 44
            : kind === "shin"
              ? skeleton.shin / 43
              : kind === "upper"
                ? skeleton.upperArm / 38
                : kind === "forearm"
                  ? skeleton.forearm / 35
                  : 1
          : 1;
        visual.setScale(1, stretch);
        c.add(visual);
      }
      return c;
    };
    const pelvis = joint(
      "pelvis",
      this.root,
      0,
      physical ? skeleton.pelvisY : -95,
    );
    const farThigh = joint(
      "farThigh",
      pelvis,
      physical ? skeleton.farHipX : 15,
      physical ? 10 : 14,
      "thigh",
    );
    const farShin = joint(
      "farShin",
      farThigh,
      0,
      physical ? skeleton.thigh : 44,
      "shin",
    );
    joint(
      "farFoot",
      farShin,
      0,
      physical ? skeleton.shin : 43,
      "foot",
      0x694634,
    );
    const torso = joint("torso", pelvis, 0, physical ? 0 : -76);
    const farArm = joint(
      "farArm",
      torso,
      physical ? skeleton.farShoulderX : -23,
      physical ? skeleton.shoulderY : 15,
      "upper",
    );
    const farElbow = joint(
      "farElbow",
      farArm,
      0,
      physical ? skeleton.upperArm : 38,
      "forearm",
    );
    const farHand = joint(
      "farHand",
      farElbow,
      0,
      physical ? skeleton.forearm : 35,
      "hand",
    );
    if (model.equipment.shield && !paired) {
      this.shieldMount = drawGear(
        scene,
        item(model.equipment.shield)?.visual ?? "shield",
        style,
      );
      farHand.add(this.shieldMount);
    }
    if (paired) {
      const offhand = drawGear(scene, weapon!.visual, style).setRotation(
        Math.PI / 2,
      );
      farHand.add(offhand);
      this.weapons.push(offhand);
    }
    torso.add(
      drawPart(scene, "torso", skin, style).setY(
        physical ? skeleton.torsoArtY : 0,
      ),
    );
    if (model.equipment.chest)
      torso.add(
        drawGear(
          scene,
          item(model.equipment.chest)?.visual ?? "leather",
          style,
        ).setY(physical ? skeleton.torsoArtY : 0),
      );
    const head = joint(
      "head",
      torso,
      0,
      physical ? skeleton.headY : -8,
      "head",
    );
    if (model.equipment.helmet)
      head.add(
        drawGear(scene, item(model.equipment.helmet)?.visual ?? "cap", style),
      );
    pelvis.add(drawPart(scene, "pelvis", enemy ? 0x623e3b : 0x3e5c61, style));
    const nearThigh = joint(
      "nearThigh",
      pelvis,
      physical ? skeleton.nearHipX : -14,
      physical ? 10 : 14,
      "thigh",
    );
    const nearShin = joint(
      "nearShin",
      nearThigh,
      0,
      physical ? skeleton.thigh : 44,
      "shin",
    );
    joint(
      "nearFoot",
      nearShin,
      0,
      physical ? skeleton.shin : 43,
      "foot",
      0x694634,
    );
    const nearArm = joint(
      "nearArm",
      torso,
      physical ? skeleton.nearShoulderX : 25,
      physical ? skeleton.shoulderY : 17,
      "upper",
    );
    const nearElbow = joint(
      "nearElbow",
      nearArm,
      0,
      physical ? skeleton.upperArm : 38,
      "forearm",
    );
    const nearHand = joint(
      "nearHand",
      nearElbow,
      0,
      physical ? skeleton.forearm : 35,
      "hand",
    );
    if (model.equipment.weapon) {
      const mainWeapon = drawGear(
        scene,
        !physical && model.equipment.weapon === "spear"
          ? "spear-legacy"
          : (weapon?.visual ?? "wood"),
        style,
      ).setRotation(
        physical || (weapon?.weaponType === "spear" && weapon.id !== "spear")
          ? Math.PI / 2
          : Math.PI,
      );
      nearHand.add(mainWeapon);
      this.weapons.push(mainWeapon);
    }
    // A tower shield is carried in front of the torso, below the weapon arm.
    if (model.equipment.shield === "tower" && !paired) {
      torso.bringToTop(farArm);
      torso.bringToTop(nearArm);
    }
    scene.events.once("shutdown", () => this.animator.stop());
  }
  update(delta: number) {
    const p = this.animator.update(delta);
    if (this.physical) {
      const solved = groundedPose(p, this.motionScale);
      this.joints.torso.rotation = solved.torso;
      this.joints.head.rotation = p.head ?? 0;
      for (const side of ["near", "far"] as const) {
        const leg = side === "near" ? solved.nearLeg : solved.farLeg;
        const arm = side === "near" ? solved.nearArm : solved.farArm;
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
      return;
    }
    for (const name of this.jointNames)
      if (p[name] !== undefined) this.joints[name].rotation = p[name]!;
    this.root.x =
      this.originX + (p.rootX ?? 0) * this.direction * this.motionScale;
    this.shadow.x = this.root.x;
    this.root.y = this.originY + (p.rootY ?? 0);
    this.root.rotation = (p.rootR ?? 0) * this.direction;
  }
  jointSnapshot() {
    const point = (name: string, x = 0, y = 0) => {
      const p = this.joints[name]
        .getWorldTransformMatrix()
        .transformPoint(x, y);
      return { x: p.x, y: p.y };
    };
    return {
      physical: this.physical,
      shield: Boolean(this.shieldMount),
      weapons: this.weapons.map((weapon) => {
        const p = weapon.getWorldTransformMatrix().transformPoint(0, 0);
        return { x: p.x, y: p.y };
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
