import { faceExpression } from "./faceExpression";
import { shieldCarryPose } from "./shieldMotion";
import { drawFace } from "../rendering/painFace";
import { armorDamage, type ArmorSlot } from "../combat/armor";
import { crossbowPose } from "./crossbowMotion";
import { setCrossbowState } from "../rendering/crossbow";
import { twoHandPose } from "./twoHandMotion";
import Phaser from "phaser";
import type { ArenaFighter } from "../combat/realtime";
import { item } from "../data/catalog";
import {
  primaryWeapon,
  primaryHand,
  weaponForHand,
} from "../domain/progression";
import type { Player, Hand, Item } from "../domain/model";
import {
  projectileProfile,
  projectileFloorRadius,
} from "../combat/projectiles";
import { LimbArt } from "../rendering/limbArt";
import { drawPart, drawGear } from "../rendering/characterVisuals";
import { equipmentMotion } from "./equipmentMotion";
import { groundedPose, skeleton } from "./kinematics";
import type { WeaponHand, Stance } from "./locomotion";
import { Animator, type Pose } from "./animation";
import type { CombatGeometry, Capsule } from "../combat/geometry";
import { weaponHitbox } from "../combat/weaponGeometry";
import { itemTextureKey } from "../content/textures";
import { rangedPreview } from "../rendering/rangedPreview";
export interface RigOptions {
  weaponHand?: WeaponHand;
  stance?: Stance;
}
export class Gladiator {
  readonly handMounts: Record<WeaponHand, Phaser.GameObjects.Container>;
  primaryHand: WeaponHand;
  root: Phaser.GameObjects.Container;
  animator: Animator;
  private joints: Record<string, Phaser.GameObjects.Container> = {};
  private shadow: Phaser.GameObjects.Ellipse;
  private hitFlash?: Phaser.Tweens.Tween;
  private direction: number;
  private limbs: Record<string, LimbArt> = {};
  private skirt!: Phaser.GameObjects.Container;
  private weapons: Phaser.GameObjects.Container[] = [];
  private bladeProfiles: Partial<
    Record<Hand, ReturnType<typeof weaponHitbox>>
  > = {};
  private handWeapons: Partial<Record<Hand, Phaser.GameObjects.Container>> = {};
  private palms: Record<string, Phaser.GameObjects.Container> = {};
  private relaxedPalms: Record<string, Phaser.GameObjects.Container> = {};
  private displayedAnimation?: string;
  private displayedPose: Pose = {};
  private offhand?: Phaser.GameObjects.Container;
  private beltItems: Phaser.GameObjects.Container[] = [];
  private throwProp!: Phaser.GameObjects.Graphics;
  private loadoutKey = "";
  private armorCracks: Partial<Record<ArmorSlot, Phaser.GameObjects.Graphics>> =
    {};
  private armorRatios: Partial<Record<ArmorSlot, number>> = {};
  private armorArt: Partial<
    Record<"helmet" | "body", Phaser.GameObjects.Container>
  > = {};
  private armorIds: Partial<Record<"helmet" | "body", string>> = {};
  private actionProps: Partial<
    Record<
      Hand,
      {
        key: string;
        art: Phaser.GameObjects.Container;
        launch?: NonNullable<CombatGeometry["launch"]>[Hand];
      }
    >
  > = {};
  private potion!: Phaser.GameObjects.Container;
  private guns!: ReturnType<typeof rangedPreview>[];
  private equippedWeapon?: Item;
  private face!: Phaser.GameObjects.Graphics;
  private painRemaining = 0;
  private rageRemaining = 0;
  private rageActivationRemaining = 0;
  private shieldArt?: Phaser.GameObjects.Container;
  private shieldId?: string;
  private shieldProfile = { x: 0, top: -4, bottom: 22, radius: 32 };
  private openPalm!: Phaser.GameObjects.Container;
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
    this.equippedWeapon = weapon;
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
    if (model.equipment.body) {
      this.armorArt.body = drawGear(
        scene,
        item(model.equipment.body) ?? "leather",
      ).setY(skeleton.torsoArtY);
      this.attachCracks("body", this.armorArt.body);
      torso.add(this.armorArt.body);
      this.armorIds.body = model.equipment.body;
    }
    const head = joint("head", torso, 0, skeleton.headY, "head");
    this.face = scene.add.graphics().setName("face-expression");
    drawFace(this.face, 0);
    head.add(this.face);
    if (model.equipment.helmet) {
      this.armorArt.helmet = drawGear(
        scene,
        item(model.equipment.helmet) ?? "cap",
      );
      this.attachCracks("helmet", this.armorArt.helmet);
      head.add(this.armorArt.helmet);
      this.armorIds.helmet = model.equipment.helmet;
    }
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
    const farHand = joint("farHand", farElbow, 0, skeleton.forearm, "hand");
    const nearArm = joint(
      "nearArm",
      backTorso,
      skeleton.nearShoulderX,
      skeleton.shoulderY,
    );
    // Only the front forearm changes depth for a strike, throw or grab.
    // Its shoulder and upper arm remain occluded by the torso in every pose.
    const frontShoulder = joint(
      "frontShoulder",
      backTorso,
      skeleton.nearShoulderX,
      skeleton.shoulderY,
    );
    const shoulderSkin = new LimbArt(scene, "arm", skin, false, "upper");
    // Graphics have no getBounds; a hidden envelope gives this standalone pass
    // real bounds instead of an empty container rectangle at the world origin.
    frontShoulder.add(
      scene.add
        .rectangle(0, skeleton.upperArm / 2, 26, skeleton.upperArm + 26)
        .setVisible(false),
    );
    frontShoulder.add(shoulderSkin);
    this.limbs.frontShoulder = shoulderSkin;
    const nearSkin = new LimbArt(scene, "arm", skin, false, "lower");
    nearArm.add(nearSkin);
    this.limbs.nearArm = nearSkin;
    const nearElbow = joint("nearElbow", nearArm, 0, skeleton.upperArm);
    const nearHand = joint("nearHand", nearElbow, 0, skeleton.forearm, "hand");
    this.handMounts = { rear: farHand, front: nearHand };
    for (const hand of ["rear", "front"] as const) {
      const mount = this.handMounts[hand];
      this.palms[hand] = mount.list[0] as Phaser.GameObjects.Container;
      this.relaxedPalms[hand] = drawPart(scene, "relaxedHand", skin);
      mount.add(this.relaxedPalms[hand]);
      const definition = weaponForHand(model, hand);
      if (definition) {
        const mounted = drawGear(scene, definition);
        this.handWeapons[hand] = mounted;
        mount.addAt(mounted, 0);
        this.bladeProfiles[hand] = weaponHitbox(this.artDefinition(definition));
      }
    }
    this.weapons = [
      this.handWeapons[this.primaryHand],
      this.handWeapons[this.primaryHand === "rear" ? "front" : "rear"],
    ].filter((w): w is Phaser.GameObjects.Container => Boolean(w));
    this.offhand =
      model.equipment.rightHand && model.equipment.leftHand
        ? this.handWeapons.front
        : undefined;
    this.openPalm = drawPart(scene, "relaxedHand", skin);
    farHand.add(this.openPalm);
    this.openPalm.setVisible(false);
    this.throwProp = scene.add
      .graphics()
      .fillStyle(0xbc8351)
      .fillCircle(0, -5, 8)
      .lineStyle(2, 0x41332c)
      .strokeCircle(0, -5, 8);
    farHand.addAt(this.throwProp, 0);
    this.throwProp.setVisible(false);
    this.potion = drawGear(scene, "healing-potion");
    this.potion.setRotation(0.4);
    farHand.addAt(this.potion, 0);
    this.potion.setVisible(false);
    this.guns = [
      rangedPreview(scene, "crossbow"),
      rangedPreview(scene, "rifle"),
    ];
    for (const gun of this.guns) {
      frontTorso.addAt(gun.prop, 0);
      gun.prop.setVisible(false);
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

    this.syncShield(model);
    this.updateCracks(model);
    this.loadoutKey = JSON.stringify(model.equipment);
    scene.events.once("shutdown", () => this.animator.stop());
    this.update(0);
  }
  private syncShield(model: Player) {
    const def = item(model.equipment.rightHand ?? "");
    const id = def?.slot === "shield" ? def.id : undefined;
    if (id === this.shieldId) return;
    this.shieldArt?.destroy();
    this.shieldArt = undefined;
    this.shieldId = id;
    if (id && def) {
      const resolved = this.artDefinition(def);
      const tower = resolved.visual === "tower";
      const width = resolved.image?.width ?? (tower ? 84 : 68),
        height = resolved.image?.height ?? (tower ? 169 : 90);
      const radius = Math.max(1, Math.min(width, height) / 2 - 2);
      const top = resolved.image
        ? -height * resolved.image.originY
        : tower
          ? -71
          : -36;
      this.shieldProfile = {
        x: resolved.image ? width * (0.5 - resolved.image.originX) : 0,
        top: top + radius,
        bottom: top + height - radius,
        radius,
      };
      this.shieldArt = drawGear(this.scene, def).setName("held-shield");
      this.joints.pelvis.addAt(this.shieldArt, 0);
    }
  }
  update(delta: number) {
    this.applyPose(this.animator.update(delta));
  }
  private artDefinition(definition: Item): Item {
    return definition.image &&
      !this.scene.textures.exists(itemTextureKey(definition.id))
      ? { ...definition, image: undefined, hitbox: undefined }
      : definition;
  }
  private attachCracks(slot: ArmorSlot, art: Phaser.GameObjects.Container) {
    const bounds = art.getBounds();
    const x = bounds.centerX - art.x,
      y = slot === "helmet" ? -28 : bounds.centerY - art.y;
    const w =
        slot === "helmet"
          ? Math.min(20, bounds.width * 0.3)
          : bounds.width * 0.3,
      h = slot === "helmet" ? 9 : bounds.height * 0.32;
    const cracks = this.scene.add.graphics().lineStyle(1.4, 0xe0e5e6, 0.95);
    for (const offset of [-0.5, 0.6]) {
      cracks
        .beginPath()
        .moveTo(x + offset * w, y - h * 0.7)
        .lineTo(x + offset * w - w * 0.12, y - h * 0.1)
        .lineTo(x + offset * w + w * 0.18, y + h * 0.2)
        .lineTo(x + offset * w + w * 0.03, y + h * 0.8)
        .strokePath();
      cracks.lineBetween(
        x + offset * w - w * 0.12,
        y - h * 0.1,
        x + offset * w - w * 0.42,
        y + h * 0.1,
      );
    }
    art.add(cracks.setAlpha(0));
    this.armorCracks[slot] = cracks;
  }
  private updateCracks(model: Player) {
    for (const slot of ["helmet", "body"] as const) {
      const ratio = armorDamage(model, slot);
      this.armorRatios[slot] = ratio;
      this.armorCracks[slot]?.setAlpha(
        Math.max(0, (ratio - 0.55) / 0.45) * 0.75,
      );
    }
  }
  syncArena(f: ArenaFighter) {
    const pain = f.painRemaining ?? 0,
      rage = f.rageRemaining ?? 0,
      activation = f.rageActivationRemaining ?? 0;
    if (
      pain !== this.painRemaining ||
      rage > 0 !== this.rageRemaining > 0 ||
      activation !== this.rageActivationRemaining
    )
      drawFace(this.face, pain, rage, activation);
    this.painRemaining = pain;
    this.rageRemaining = rage;
    this.rageActivationRemaining = activation;
    for (const slot of ["helmet", "body"] as const) {
      const id = f.model.equipment[slot];
      if (id === this.armorIds[slot]) continue;
      this.armorArt[slot]?.destroy();
      delete this.armorArt[slot];
      delete this.armorCracks[slot];
      this.armorIds[slot] = id;
      const definition = item(id ?? "");
      if (definition) {
        const art = drawGear(this.scene, definition).setY(
          slot === "body" ? skeleton.torsoArtY : 0,
        );
        this.attachCracks(slot, art);
        this.joints[slot === "body" ? "torso" : "head"].addAt(
          art,
          slot === "body" ? 1 : 2,
        );
        this.armorArt[slot] = art;
      }
    }
    this.syncShield(f.model);
    this.updateCracks(f.model);
    this.equippedWeapon = primaryWeapon(f.model);
    this.primaryHand = primaryHand(f.model);
    const key = JSON.stringify(f.model.equipment);
    if (key !== this.loadoutKey) {
      this.loadoutKey = key;
      for (const hand of ["front", "rear"] as const) {
        this.handWeapons[hand]?.destroy();
        delete this.handWeapons[hand];
        delete this.bladeProfiles[hand];
        const definition = weaponForHand(f.model, hand);
        if (definition) {
          const art = drawGear(this.scene, definition);
          this.handWeapons[hand] = art;
          this.handMounts[hand].addAt(art, 0);
          this.bladeProfiles[hand] = weaponHitbox(
            this.artDefinition(definition),
          );
        }
      }
      this.weapons = [
        this.handWeapons[this.primaryHand],
        this.handWeapons[this.primaryHand === "rear" ? "front" : "rear"],
      ].filter((v): v is Phaser.GameObjects.Container => Boolean(v));
      this.offhand =
        f.model.equipment.leftHand && f.model.equipment.rightHand
          ? this.handWeapons.front
          : undefined;
      for (const art of this.beltItems) art.destroy();
      this.beltItems = [];
      for (const [i, slot] of (["belt1", "belt2"] as const).entries()) {
        const definition = item(f.model.equipment[slot] ?? "");
        if (!definition) continue;
        const art = drawGear(this.scene, definition),
          bounds = art.getBounds();
        art
          .setPosition(i === 0 ? -32 : 30, 2)
          .setScale(Math.min(0.7, 30 / bounds.width, 40 / bounds.height))
          .setName(slot);
        this.joints.pelvis.addAt(
          art,
          this.joints.pelvis.getIndex(this.joints.frontTorso),
        );
        this.beltItems.push(art);
      }
    }
    for (const hand of ["front", "rear"] as const) {
      const action = f.handActions[hand],
        definition =
          action?.name === "throw" || action?.name === "drink"
            ? item(action.itemId ?? "")
            : undefined;
      const key = definition ? `${action!.id}:${definition.id}` : "";
      if (this.actionProps[hand]?.key !== key) {
        this.actionProps[hand]?.art.destroy();
        delete this.actionProps[hand];
        if (definition) {
          const art = drawGear(this.scene, definition);
          this.handMounts[hand].addAt(art, 0);
          const resolved = this.artDefinition(definition);
          this.actionProps[hand] = {
            key,
            art,
            ...(action?.name === "throw"
              ? {
                  launch: {
                    profile: projectileProfile(resolved),
                    floorRadius: projectileFloorRadius(resolved),
                  },
                }
              : {}),
          };
        }
      }
      if (this.actionProps[hand])
        this.actionProps[hand]!.art.setVisible(
          action?.name === "drink" || !action?.released,
        );
    }
    for (const art of this.beltItems)
      art.setVisible(
        !Object.values(f.handActions).some(
          (a) =>
            (a?.name === "throw" || a?.name === "drink") &&
            a.sourceSlot === art.name,
        ),
      );
  }
  applyPose(p: Pose, animation?: string) {
    const sharedWeapon = this.equippedWeapon;
    if (
      sharedWeapon?.hands === 2 &&
      (p.twoHanded ?? 0) < 0.99999 &&
      (p.rangedHold ?? 0) < 0.99999 &&
      !p.grappling &&
      !p.shootPreview &&
      !p.throwPreview &&
      !p.drinkPreview &&
      !p.farThrow &&
      !p.nearThrow &&
      ![
        "pain",
        "hit",
        "parry",
        "knockdown",
        "down",
        "getUp",
        "kipUp",
        "carried",
        "death",
      ].includes(animation ?? this.animator.name)
    )
      p =
        sharedWeapon.weaponType === "crossbow"
          ? crossbowPose(p)
          : twoHandPose(p, sharedWeapon);
    const shield = item(this.shieldId ?? "");
    if (shield && !p.shieldCarryReady) p = shieldCarryPose(p, shield);
    this.displayedPose = { ...p };
    this.displayedAnimation = animation;
    const solved = groundedPose(p);
    const throwing = (p.throwPreview ?? 0) > 0.01,
      released = (p.throwReleased ?? 0) > 0.5;
    const drinking = (p.drinkPreview ?? 0) > 0.5;
    const shooting = (p.shootPreview ?? 0) > 0.5;
    const grappling = (p.grappling ?? 0) > 0.5;
    this.root.setDepth((p.carried ?? 0) > 0 ? 5 : 0);
    this.shadow.setVisible(!(p.held ?? 0));
    for (const hand of ["rear", "front"] as const) {
      const prefix = hand === "rear" ? "far" : "near",
        weapon = this.handWeapons[hand];
      const runtimeThrow = (p[`${prefix}Throw`] ?? 0) > 0.5,
        runtimeReleased = (p[`${prefix}Released`] ?? 0) > 0.5;
      const shoving = (p[`${prefix}Shove`] ?? 0) > 0.5;
      const arm = hand === "rear" ? solved.farArm : solved.nearArm;
      weapon?.setRotation(
        (p[`${prefix}WeaponAim`] ?? 0) > 0.5
          ? p[`${prefix}WeaponAngle`]! - arm.angle - arm.bend - arm.wrist
          : (p[`${prefix}WeaponGrip`] ??
              (hand === this.primaryHand
                ? (p.weaponGrip ?? Math.PI / 2)
                : (3 * Math.PI) / 4)),
      );
      weapon?.setVisible(
        !grappling &&
          !shooting &&
          !shoving &&
          !runtimeThrow &&
          !(hand === "rear" && (throwing || drinking)),
      );
      if (weapon)
        setCrossbowState(
          weapon,
          p.crossbowDraw ?? 1,
          (p.crossbowLoaded ?? 1) > 0.5,
        );
      const prop = this.actionProps[hand];
      if (prop) {
        const arm = hand === "rear" ? solved.farArm : solved.nearArm;
        prop.art.setRotation(
          hand === "rear" && drinking
            ? 0.4
            : 1.35 -
                (solved.root.rotation +
                  solved.torso +
                  arm.angle +
                  arm.bend +
                  arm.wrist),
        );
        prop.art.setVisible(
          (runtimeThrow && !runtimeReleased) || (hand === "rear" && drinking),
        );
      }
      const closed =
        shooting ||
        (p.rangedHold ?? 0) > 0.5 ||
        ((p.twoHanded ?? 0) > 0.5 &&
          (hand === "rear" || (p.shoulderCarry ?? 0) < 0.5)) ||
        Boolean(weapon) ||
        (p[`${prefix}Fist`] ?? 0) > 0.5 ||
        (hand === "rear" && throwing && !released) ||
        (runtimeThrow && !runtimeReleased) ||
        (hand === "rear" && drinking);
      this.palms[hand].setVisible(
        closed &&
          !grappling &&
          !shoving &&
          !(hand === "rear" && throwing && released) &&
          !(runtimeThrow && runtimeReleased),
      );
      this.relaxedPalms[hand].setVisible(
        (grappling ||
          shoving ||
          !closed ||
          (runtimeThrow && runtimeReleased)) &&
          !(hand === "rear" && throwing),
      );
    }
    this.throwProp.setVisible(throwing && !released);
    this.potion.setVisible(drinking && !this.actionProps.rear);
    const pairedHold = (p.twoHanded ?? 0) > 0.5 || (p.rangedHold ?? 0) > 0.5;
    const frontThrow =
      grappling ||
      (!pairedHold && (p.nearStrike ?? 0) > 0.5) ||
      (p.nearThrow ?? 0) > 0.5 ||
      (p.nearShove ?? 0) > 0.5;
    const nearParent = frontThrow
      ? this.joints.frontTorso
      : this.joints.backTorso;
    if (this.joints.nearArm.parentContainer !== nearParent)
      nearParent.addAt(this.joints.nearArm, 0);
    this.joints.backTorso.sendToBack(this.joints.frontShoulder);
    const rearParent = this.joints.frontTorso;
    if (this.joints.farArm.parentContainer !== rearParent)
      rearParent.addAt(this.joints.farArm, 0);
    const handParent = this.joints.farElbow;
    if (this.joints.farHand.parentContainer !== handParent)
      handParent.add(this.joints.farHand);
    this.openPalm.setVisible(throwing && released);
    // The rear arm stays in front of the entire torso/head plane throughout
    // throwing. Keep depth fixed instead of hiding a moving hand with the head.
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
    this.joints.frontShoulder.rotation = solved.nearArm.angle;
    this.limbs.frontShoulder.pose(solved.nearArm.bend, solved.nearArm.angle);
    this.joints.farHand.setPosition(0, skeleton.forearm);
    this.root.x =
      this.originX + solved.root.x * this.bodyScale * this.direction;
    this.root.y = this.originY + solved.root.y * this.bodyScale;
    this.root.rotation = solved.root.rotation * this.direction;
    const handPosition = this.joints.farHand
      .getWorldTransformMatrix()
      .transformPoint(0, 0);
    if (this.shieldArt) {
      const position = this.joints.pelvis
        .getWorldTransformMatrix()
        .applyInverse(handPosition.x, handPosition.y);
      this.shieldArt
        .setPosition(position.x, position.y)
        .setRotation(-solved.root.rotation)
        .setVisible(true);
      this.joints.pelvis.sendToBack(this.shieldArt);
    }
    const localGun = this.joints.frontTorso
      .getWorldTransformMatrix()
      .applyInverse(handPosition.x, handPosition.y);
    this.guns.forEach((gun, i) => {
      gun.prop
        .setVisible(Math.round(p.shootPreview ?? 0) === i + 1)
        .setPosition(localGun.x, localGun.y)
        .setRotation(-solved.root.rotation - solved.torso);
      gun.flash.setVisible(Math.round(p.shotFlash ?? 0) === i + 1);
      const canonical = gun.prop.getData("canonicalCrossbow") as
        Phaser.GameObjects.Container | undefined;
      if (canonical)
        setCrossbowState(
          canonical,
          (p.crossbowPreviewFired ?? 0) > 0.5 ? 0 : 1,
          (p.crossbowPreviewFired ?? 0) < 0.5,
        );
    });
    let floorShadowX: number | undefined;
    if ((p.bodyFloor ?? 0) > 0) {
      // A rotated helmet can project beyond the unarmored head envelope.
      const bottom = this.joints.head.getBounds().bottom;
      this.root.y -= Math.max(0, bottom - this.originY);
      const parts = this.combatGeometry().body;
      const left = Math.min(
        ...parts.map((part) => Math.min(part.a.x, part.b.x) - part.radius),
      );
      const right = Math.max(
        ...parts.map((part) => Math.max(part.a.x, part.b.x) + part.radius),
      );
      const shift = Math.max(0, 20 - left) - Math.max(0, right - 1260);
      this.root.x += shift;
      floorShadowX = (left + right) / 2 + shift;
    }
    this.shadow.x = floorShadowX ?? this.root.x;
  }
  jointSnapshot() {
    const vial =
      (this.displayedPose.drinkPreview ?? 0) > 0.5
        ? (this.actionProps.rear?.art ?? this.potion)
        : this.potion;
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
      alpha: this.root.alpha,
      primaryHand: this.primaryHand,
      animation: this.displayedAnimation ?? this.animator.name,
      origin: { x: this.originX, y: this.originY },
      body: {
        frontShoulder: {
          plane: this.joints.frontShoulder.parentContainer?.name,
          frame: frame("frontShoulder"),
          forearmFrame: frame("nearArm"),
        },
        rearHandPlane: this.joints.farHand.parentContainer?.name,
        layers: this.joints.pelvis.list.map((part) => part.name),
        arms: [...this.joints.backTorso.list, ...this.joints.frontTorso.list]
          .filter((part) => part.name.endsWith("Arm"))
          .map((part) => part.name),
        backArms: this.joints.backTorso.list
          .filter((part) => part.name.endsWith("Arm"))
          .map((part) => part.name),
        frontArms: this.joints.frontTorso.list
          .filter((part) => part.name.endsWith("Arm"))
          .map((part) => part.name),
        waist: frame("pelvis"),
        torso: frame("torso"),
      },
      painRemaining: this.painRemaining,
      expression: faceExpression(
        this.painRemaining,
        this.rageRemaining,
        this.rageActivationRemaining,
      ),
      shield: Boolean(this.shieldArt?.visible),
      shieldAttachment: this.shieldArt
        ? {
            ...this.shieldArt.getWorldTransformMatrix().transformPoint(0, 0),
            behindBody: this.joints.pelvis.list[0] === this.shieldArt,
            hand: "rear",
            farthest: this.joints.pelvis.list[0] === this.shieldArt,
          }
        : null,
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
        hand: "rear",
        headFront: this.joints.head.parentContainer === this.joints.frontTorso,
      },
      drinking: (this.displayedPose.drinkPreview ?? 0) > 0.5,
      crossbow:
        this.equippedWeapon?.weaponType === "crossbow"
          ? {
              loaded: (this.displayedPose.crossbowLoaded ?? 1) > 0.5,
              draw: this.displayedPose.crossbowDraw ?? 1,
              supportGrip: this.handWeapons.rear
                ? {
                    ...this.handWeapons.rear
                      .getWorldTransformMatrix()
                      .transformPoint(5, -44),
                  }
                : null,
            }
          : null,
      twoHanded: {
        active: (this.displayedPose.twoHanded ?? 0) > 0.5,
        shoulderCarry: (this.displayedPose.shoulderCarry ?? 0) > 0.5,
        supportGrip:
          this.equippedWeapon?.hands === 2 && this.handWeapons.rear?.visible
            ? {
                ...this.handWeapons.rear
                  .getWorldTransformMatrix()
                  .transformPoint(
                    0,
                    -(this.displayedPose.supportGripDistance ?? 24),
                  ),
              }
            : null,
      },
      shooting: {
        kind: Math.round(this.displayedPose.shootPreview ?? 0),
        flash: (this.displayedPose.shotFlash ?? 0) > 0,
      },
      drink: {
        vialVisible: vial.visible,
        mouth: point("head", 25, 4),
        neck: {
          ...vial.getWorldTransformMatrix().transformPoint(0, -22),
        },
        base: {
          ...vial.getWorldTransformMatrix().transformPoint(0, 15),
        },
      },
      armor: { ...this.armorIds },
      armorDamage: { ...this.armorRatios },
      armorCracks: Object.fromEntries(
        Object.entries(this.armorCracks).map(([slot, art]) => [
          slot,
          art.alpha,
        ]),
      ),
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
  armorAttachment(slot: "helmet" | "body") {
    const art = this.armorArt[slot];
    if (!art) return undefined;
    const matrix = art.getWorldTransformMatrix();
    const scaleX = this.bodyScale * this.direction;
    return {
      x: matrix.tx,
      y: matrix.ty,
      rotation: Math.atan2(matrix.b / scaleX, matrix.a / scaleX),
      scaleX,
      scaleY: this.bodyScale,
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
    const blades: Partial<Record<Hand, Capsule>> = {};
    const parries: Capsule[] = [];
    for (const hand of ["rear", "front"] as const) {
      const profile = this.bladeProfiles[hand],
        weapon = this.handWeapons[hand];
      if (weapon?.visible) {
        const matrix = weapon.getWorldTransformMatrix();
        const a = matrix.transformPoint(0, profile?.startY ?? -100);
        const b = matrix.transformPoint(0, 18);
        parries.push(capsule(a, b, profile ? Math.min(6, profile.radius) : 8));
      }
      if (profile && weapon && weapon.visible) {
        const matrix = weapon.getWorldTransformMatrix(),
          radius = Math.min(
            profile.radius,
            (profile.endY - profile.startY) / 2,
          );
        const a = matrix.transformPoint(0, profile.startY + radius),
          b = matrix.transformPoint(0, profile.endY - radius);
        blades[hand] = capsule({ x: a.x, y: a.y }, { x: b.x, y: b.y }, radius);
      }
    }
    return {
      blade: blades[this.primaryHand] ?? null,
      shield: this.shieldArt?.visible
        ? (() => {
            const m = this.shieldArt!.getWorldTransformMatrix();
            const profile = this.shieldProfile;
            return capsule(
              m.transformPoint(profile.x, profile.top),
              m.transformPoint(profile.x, profile.bottom),
              profile.radius,
            );
          })()
        : undefined,
      parries,
      shove:
        (this.displayedPose.twoHanded ?? 0) > 0.5 ||
        (this.displayedPose.rangedHold ?? 0) > 0.5
          ? capsule(point("farHand"), point("nearHand"), 12)
          : undefined,
      grips: { front: point("nearHand"), rear: point("farHand") },
      muzzles:
        this.equippedWeapon?.weaponType === "crossbow" &&
        this.handWeapons.rear?.visible
          ? {
              rear: {
                ...this.handWeapons.rear
                  .getWorldTransformMatrix()
                  .transformPoint(-12, -107),
              },
            }
          : {},
      launch: Object.fromEntries(
        Object.entries(this.actionProps)
          .filter(([, prop]) => prop.launch)
          .map(([hand, prop]) => [hand, prop.launch]),
      ),
      blades,
      body,
      bodyRegions: body.map((_, index) => (index === 0 ? "helmet" : "body")),
      hands: {
        front: capsule(point("nearHand", 0, 4), point("nearHand", 0, 10), 8),
        rear: capsule(point("farHand", 0, 4), point("farHand", 0, 10), 8),
      },
      feet: {
        front: capsule(point("nearFoot", -9, 9), point("nearFoot", 22, 9), 5),
        rear: capsule(point("farFoot", -9, 9), point("farFoot", 22, 9), 5),
      },
    };
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
    // Restart from solid opacity: overlapping yoyo tweens can retain a faded start.
    this.hitFlash?.stop();
    this.root.setAlpha(1);
    const restore = () => {
      this.root.setAlpha(1);
      this.hitFlash = undefined;
    };
    this.hitFlash = this.scene.tweens.add({
      targets: this.root,
      alpha: { from: 1, to: 0.45 },
      duration: 70,
      yoyo: true,
      repeat: 1,
      onComplete: restore,
      onStop: restore,
    });
  }
}
