import Phaser from "phaser";
import { item } from "../data/catalog";
import { primaryWeapon, primaryHand } from "../domain/progression";
import type { Player } from "../domain/model";
import { LimbArt } from "../rendering/limbArt";
import { drawPart, drawGear } from "../rendering/characterVisuals";
import { equipmentMotion } from "./equipmentMotion";
import { groundedPose, skeleton } from "./kinematics";
import type { WeaponHand, Stance } from "./locomotion";
import { Animator, type Pose } from "./animation";
import type { CombatGeometry, Capsule } from "../combat/geometry";
import { weaponHitbox } from "../combat/weaponGeometry";
import { itemTextureKey } from "../content/textures";
export interface RigOptions {
  weaponHand?: WeaponHand;
  stance?: Stance;
}
export class Gladiator {
  readonly handMounts: Record<WeaponHand, Phaser.GameObjects.Container>;
  readonly primaryHand: WeaponHand;
  root: Phaser.GameObjects.Container;
  animator: Animator;
  private joints: Record<string, Phaser.GameObjects.Container> = {};
  private shadow: Phaser.GameObjects.Ellipse;
  private direction: number;
  private limbs: Record<string, LimbArt> = {};
  private skirt!: Phaser.GameObjects.Container;
  private weapons: Phaser.GameObjects.Container[] = [];
  private bladeProfile: ReturnType<typeof weaponHitbox>;
  private displayedAnimation?: string;
  private displayedPose: Pose = {};
  private offhand?: Phaser.GameObjects.Container;
  private beltItems: Phaser.GameObjects.Container[] = [];
  private throwProp!: Phaser.GameObjects.Graphics;
  private openPalm!: Phaser.GameObjects.Container;
  private closedPalm!: Phaser.GameObjects.GameObject;
  constructor(
    private scene: Phaser.Scene,
    private originX: number,
    private originY: number,
    model: Player,
    enemy = false,
    private bodyScale = 1.25,
    options: RigOptions = {},
  ) {
    const weapon = primaryWeapon(model);
    this.bladeProfile = weaponHitbox(
      weapon?.image && !scene.textures.exists(itemTextureKey(weapon.id))
        ? { ...weapon, image: undefined, hitbox: undefined }
        : weapon,
    );
    this.primaryHand = options.weaponHand ?? primaryHand(model);
    this.animator = new Animator(equipmentMotion(weapon, this.primaryHand));
    this.animator.setIdle(
      options.stance === "relaxed" ? "idleRelaxed" : "idleCombat",
    );
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
    const backTorso = joint("backTorso", pelvis, 0, 0);
    const torso = joint("torso", pelvis, 0, 0);
    torso.add(drawPart(scene, "torso", skin).setY(skeleton.torsoArtY));
    if (model.equipment.body)
      torso.add(
        drawGear(scene, item(model.equipment.body) ?? "leather").setY(
          skeleton.torsoArtY,
        ),
      );
    const head = joint("head", torso, 0, skeleton.headY, "head");
    if (model.equipment.helmet)
      head.add(drawGear(scene, item(model.equipment.helmet) ?? "cap"));
    this.skirt = drawPart(scene, "pelvis", 0x3e5c61).setName("skirt");
    pelvis.add(this.skirt);
    // Front/rear describe direction toward the opponent, not camera depth.
    // The free front arm is on the far camera side; the rear arm crosses the
    // chest in front. Separate planes preserve both shoulder attachments.
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
    const farHand = joint(
      "farHand",
      farElbow,
      0,
      skeleton.forearm,
      this.primaryHand === "rear" ? "hand" : "relaxedHand",
    );
    const nearArm = joint(
      "nearArm",
      backTorso,
      skeleton.nearShoulderX,
      skeleton.shoulderY,
    );
    const nearSkin = new LimbArt(scene, "arm", skin);
    nearArm.add(nearSkin);
    this.limbs.nearArm = nearSkin;
    const nearElbow = joint("nearElbow", nearArm, 0, skeleton.upperArm);
    const nearHand = joint(
      "nearHand",
      nearElbow,
      0,
      skeleton.forearm,
      this.primaryHand === "front" || model.equipment.leftHand
        ? "hand"
        : "relaxedHand",
    );
    this.handMounts = { rear: farHand, front: nearHand };
    const primary = this.handMounts[this.primaryHand];
    this.closedPalm = primary.list[0];
    this.openPalm = drawPart(scene, "relaxedHand", skin);
    primary.add(this.openPalm);
    this.openPalm.setVisible(false);
    this.throwProp = scene.add
      .graphics()
      .fillStyle(0xbc8351)
      .fillCircle(0, -5, 8)
      .lineStyle(2, 0x41332c)
      .strokeCircle(0, -5, 8);
    primary.addAt(this.throwProp, 0);
    this.throwProp.setVisible(false);
    if (model.equipment.rightHand && model.equipment.leftHand) {
      const definition = item(model.equipment.leftHand);
      if (definition) {
        this.offhand = drawGear(scene, definition);
        this.handMounts.front.addAt(this.offhand, 0);
      }
    }
    for (const [i, position] of (["belt1", "belt2"] as const).entries()) {
      const definition = item(model.equipment[position] ?? "");
      if (definition) {
        const attachment = drawGear(scene, definition);
        const bounds = attachment.getBounds();
        attachment
          .setPosition(i === 0 ? -32 : 30, 2)
          .setScale(Math.min(0.7, 30 / bounds.width, 40 / bounds.height))
          .setName(position);
        pelvis.addAt(attachment, pelvis.getIndex(frontTorso));
        this.beltItems.push(attachment);
      }
    }

    if (weapon) {
      const mounted = drawGear(scene, weapon).setRotation(Math.PI / 2);
      this.handMounts[this.primaryHand].addAt(mounted, 0);
      this.weapons.push(mounted);
    }
    scene.events.once("shutdown", () => this.animator.stop());
    this.update(0);
  }
  update(delta: number) {
    this.applyPose(this.animator.update(delta));
  }
  applyPose(p: Pose, animation?: string) {
    this.displayedPose = { ...p };
    this.displayedAnimation = animation;
    const solved = groundedPose(p);
    this.weapons.forEach((weapon) =>
      weapon.setRotation(p.weaponGrip ?? Math.PI / 2),
    );

    const throwing = (p.throwPreview ?? 0) > 0.01,
      released = (p.throwReleased ?? 0) > 0.5;
    this.weapons.forEach((weapon) => weapon.setVisible(!throwing));
    this.throwProp.setVisible(throwing && !released);
    this.openPalm.setVisible(throwing && released);
    (this.closedPalm as Phaser.GameObjects.Container).setVisible(
      !(throwing && released),
    );
    if (this.offhand) {
      this.offhand.setRotation((3 * Math.PI) / 4);
    }
    this.joints.torso.rotation = solved.torso;
    this.joints.backTorso.rotation = solved.torso;
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
      this.limbs[`${side}Arm`].pose(arm.bend, arm.angle);
    }
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
    const frame = (name: string) => ({
      origin: point(name),
      right: point(name, 1, 0),
      down: point(name, 0, 1),
    });
    return {
      physical: true,
      primaryHand: this.primaryHand,
      animation: this.displayedAnimation ?? this.animator.name,
      origin: { x: this.originX, y: this.originY },
      body: {
        layers: this.joints.pelvis.list.map((part) => part.name),
        arms: [
          ...this.joints.backTorso.list,
          ...this.joints.frontTorso.list,
        ].map((part) => part.name),
        backArms: this.joints.backTorso.list.map((part) => part.name),
        frontArms: this.joints.frontTorso.list.map((part) => part.name),
        waist: frame("pelvis"),
        torso: frame("torso"),
      },
      shield: false,
      shieldAttachment: null,
      weapons: this.weapons.map((weapon) => {
        const p = weapon.getWorldTransformMatrix().transformPoint(0, 0);
        return {
          x: p.x,
          y: p.y,
          texture: weapon.name || null,
          visible: weapon.visible,
        };
      }),
      belt: this.beltItems.map((attachment) => ({
        slot: attachment.name,
        ...attachment.getWorldTransformMatrix().transformPoint(0, 0),
      })),
      offhand: this.offhand
        ? { ...this.offhand.getWorldTransformMatrix().transformPoint(0, 0) }
        : null,
      throwing: {
        active: (this.displayedPose.throwPreview ?? 0) > 0.01,
        released: (this.displayedPose.throwReleased ?? 0) > 0.5,
        propVisible: this.throwProp.visible,
      },
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
  setStance(stance: Stance) {
    this.animator.setIdle(stance === "relaxed" ? "idleRelaxed" : "idleCombat");
  }
  setArenaTransform(x: number, y: number, facing: 1 | -1, floor: number) {
    this.originX = x;
    this.originY = y;
    this.direction = facing;
    this.root.setScale(this.bodyScale * facing, this.bodyScale);
    this.shadow.y = floor + 4;
    this.shadow.setScale(Math.max(0.55, 1 - (floor - y) / 350));
  }
  combatGeometry(): CombatGeometry {
    const point = (name: string, x = 0, y = 0) => {
      const p = this.joints[name]
        .getWorldTransformMatrix()
        .transformPoint(x, y);
      return { x: p.x, y: p.y };
    };
    const capsule = (
      a: ReturnType<typeof point>,
      b: ReturnType<typeof point>,
      radius: number,
    ): Capsule => ({ a, b, radius: radius * this.bodyScale });
    const body: Capsule[] = [
      capsule(point("head", 0, -25), point("head", 0, 0), 21),
      capsule(point("torso", 0, -55), point("torso", 0, -20), 26),
      capsule(point("pelvis", -15, 20), point("pelvis", 15, 20), 20),
    ];
    for (const side of ["near", "far"]) {
      body.push(
        capsule(point(`${side}Arm`), point(`${side}Elbow`), 9),
        capsule(point(`${side}Elbow`), point(`${side}Hand`), 7),
        capsule(point(`${side}Hand`), point(`${side}Hand`, 0, 12), 6),
        capsule(point(`${side}Thigh`), point(`${side}Shin`), 11),
        capsule(point(`${side}Shin`), point(`${side}Foot`), 8),
        capsule(point(`${side}Foot`, -9, 9), point(`${side}Foot`, 22, 9), 5),
      );
    }
    const profile = this.bladeProfile,
      weapon = this.weapons[0];
    let blade: Capsule | null = null;
    if (profile && weapon) {
      const matrix = weapon.getWorldTransformMatrix();
      const radius = Math.min(
        profile.radius,
        (profile.endY - profile.startY) / 2,
      );
      const p = matrix.transformPoint(0, profile.startY + radius);
      const q = matrix.transformPoint(0, profile.endY - radius);
      blade = capsule({ x: p.x, y: p.y }, { x: q.x, y: q.y }, radius);
    }
    return { blade, body };
  }
  moveBy(worldX: number) {
    this.originX += worldX;
  }
  get x() {
    return this.originX;
  }
  get scale() {
    return this.bodyScale;
  }
  getHandMount(hand: WeaponHand) {
    return this.handMounts[hand];
  }
  play(name: string, impact?: () => void, complete?: () => void) {
    this.animator.play(name, impact, complete, this.displayedPose);
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
