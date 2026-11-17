import Phaser from "phaser";
import { item } from "../data/catalog";
import type { Player } from "../domain/model";
import { LimbArt } from "../rendering/limbArt";
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
  private limbs: Record<string, LimbArt> = {};
  private skirt!: Phaser.GameObjects.Container;
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
    const joint = (
      name: string,
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      kind?: string,
      color = skin,
    ) => {
      const c = scene.add.container(x, y).setName(name);
      parent.add(c);
      this.joints[name] = c;
      if (kind) c.add(drawPart(scene, kind, color));
      return c;
    };
    const pelvis = joint("pelvis", this.root, 0, skeleton.pelvisY);
    // Both leg branches are below the torso and the skirt overlay.
    for (const side of ["far", "near"] as const) {
      const thigh = joint(
        `${side}Thigh`,
        pelvis,
        side === "near" ? skeleton.nearHipX : skeleton.farHipX,
        skeleton.hipY - skeleton.pelvisY,
      );
      const skinArt = new LimbArt(scene, "leg", skin, side === "far");
      thigh.add(skinArt);
      this.limbs[`${side}Leg`] = skinArt;
      const shin = joint(`${side}Shin`, thigh, 0, skeleton.thigh);
      joint(`${side}Foot`, shin, 0, skeleton.shin, "foot", 0x694634);
    }
    const torso = joint("torso", pelvis, 0, 0);
    if (model.equipment.shield) {
      this.shieldMount = drawGear(
        scene,
        item(model.equipment.shield) ?? "shield",
      );
      // Container children render as a subtree: a shield inside the arm cannot
      // sit behind the legs. Keep its drawing below the entire body instead.
      this.root.addAt(this.shieldMount, 0);
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
    this.skirt = drawPart(scene, "pelvis", 0x3e5c61).setName("skirt");
    pelvis.add(this.skirt);
    // Both arms render above the body and skirt, far arm before near arm.
    // Their shoulder attachments still share the anatomical torso transform.
    const frontTorso = joint("frontTorso", pelvis, 0, 0);
    const farArm = joint(
      "farArm",
      frontTorso,
      skeleton.farShoulderX,
      skeleton.shoulderY,
    );
    const farSkin = new LimbArt(scene, "arm", skin, true);
    farArm.add(farSkin);
    this.limbs.farArm = farSkin;
    const farElbow = joint("farElbow", farArm, 0, skeleton.upperArm);
    joint("farHand", farElbow, 0, skeleton.forearm, "hand");
    const nearArm = joint(
      "nearArm",
      frontTorso,
      skeleton.nearShoulderX,
      skeleton.shoulderY,
    );
    const nearSkin = new LimbArt(scene, "arm", skin);
    nearArm.add(nearSkin);
    this.limbs.nearArm = nearSkin;
    const nearElbow = joint("nearElbow", nearArm, 0, skeleton.upperArm);
    const nearHand = joint("nearHand", nearElbow, 0, skeleton.forearm, "hand");
    if (weapon) {
      const mounted = drawGear(scene, weapon).setRotation(Math.PI / 2);
      nearHand.add(mounted);
      this.weapons.push(mounted);
    }
    scene.events.once("shutdown", () => this.animator.stop());
    this.update(0);
  }
  update(delta: number) {
    const p = this.animator.update(delta),
      solved = groundedPose(p);
    this.joints.torso.rotation = solved.torso;
    this.joints.frontTorso.rotation = solved.torso;
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
      this.limbs[`${side}Leg`].pose(leg.bend);
      this.limbs[`${side}Arm`].pose(arm.bend);
    }
    this.root.x =
      this.originX + solved.root.x * this.bodyScale * this.direction;
    this.root.y = this.originY + solved.root.y * this.bodyScale;
    this.root.rotation = solved.root.rotation * this.direction;
    if (this.shieldMount) {
      // Copy the actual hand attachment into root space after posing the rig.
      // This preserves grip, mirror/scale and fall rotation without arm layering.
      const hand = this.joints.farHand
        .getWorldTransformMatrix()
        .transformPoint(0, 0);
      const local = this.root
        .getWorldTransformMatrix()
        .applyInverse(hand.x, hand.y);
      this.shieldMount.setPosition(local.x, local.y);
    }
    this.shadow.x = this.root.x;
  }
  jointSnapshot() {
    const point = (name: string, x = 0, y = 0) => {
      const p = this.joints[name]
        .getWorldTransformMatrix()
        .transformPoint(x, y);
      return { x: p.x, y: p.y };
    };
    const frame = (name: string) => ({
      origin: point(name),
      right: point(name, 1, 0),
      down: point(name, 0, 1),
    });
    return {
      physical: true,
      body: {
        layers: this.joints.pelvis.list.map((part) => part.name),
        arms: this.joints.frontTorso.list.map((part) => part.name),
        waist: frame("pelvis"),
        torso: frame("torso"),
      },
      shield: Boolean(this.shieldMount),
      shieldAttachment: this.shieldMount
        ? {
            ...this.shieldMount.getWorldTransformMatrix().transformPoint(0, 0),
            behindBody:
              this.shieldMount.parentContainer === this.root &&
              this.root.getIndex(this.shieldMount) <
                this.root.getIndex(this.joints.pelvis),
          }
        : null,
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
