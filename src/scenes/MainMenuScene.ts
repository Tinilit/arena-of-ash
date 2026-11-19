import { BaseScene } from "./BaseScene";
import { label, panel } from "../ui/widgets";
import { en } from "../ui/strings";
import { Gladiator } from "../characters/Gladiator";
import Phaser from "phaser";
import { item } from "../data/catalog";
import { CampMovement } from "../characters/CampMovement";
import { opponentName } from "../domain/progression";
export class MainMenuScene extends BaseScene {
  private rig!: Gladiator;
  private movement!: CampMovement;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private modalOpen = false;
  constructor() {
    super("MainMenuScene");
  }
  create() {
    this.prepare(en.camp);
    label(this, 640, 169, en.subtitle, 17, "#e8bd72").setOrigin(0.5);
    label(this, 640, 230, en.title, 70).setOrigin(0.5);
    label(this, 350, 288, en.startCopy, 18).setOrigin(0.5);
    panel(this, 350, 441, 440, 245);
    this.button("battle", 350, 366, 350, en.battle, () =>
      this.scene.start("ArenaScene"),
    );
    this.button("character", 260, 430, 170, en.character, () =>
      this.scene.start("CharacterScene"),
    );
    this.button("shop", 444, 430, 170, en.shop, () =>
      this.scene.start("ShopScene"),
    );
    this.button("reset", 350, 501, 350, en.reset, () => this.confirmReset());
    this.modalOpen = false;
    const equipped = this.services.player.equipment;
    const large =
      item(equipped.rightHand ?? "")?.weaponType === "spear" ||
      item(equipped.helmet ?? "")?.visual === "viking";
    this.rig = new Gladiator(
      this,
      960,
      555,
      this.services.player,
      false,
      large ? 0.7 : 0.78,
      { stance: "relaxed" },
    );
    this.movement = new CampMovement(this.rig);
    this.keys = this.input.keyboard?.addKeys({
      left: "A",
      right: "D",
      run: "SHIFT",
      jump: "SPACE",
      stance: "R",
      throw: "T",
      throwOverhand: "Y",
      drink: "P",
      crossbow: "U",
      rifle: "I",
    }) as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.keys?.jump.on("down", () => {
      if (!this.modalOpen) this.movement.jump();
    });
    this.keys?.throw.on("down", () => {
      if (!this.modalOpen) this.movement.throw();
    });
    this.keys?.throwOverhand.on("down", () => {
      if (!this.modalOpen) this.movement.throw("overhand");
    });
    this.keys?.drink.on("down", () => {
      if (!this.modalOpen) this.movement.drink();
    });
    this.keys?.crossbow.on("down", () => {
      if (!this.modalOpen) this.movement.shoot("crossbow");
    });
    this.keys?.rifle.on("down", () => {
      if (!this.modalOpen) this.movement.shoot("rifle");
    });
    this.keys?.stance.on("down", () => {
      if (!this.modalOpen) this.movement.toggle();
    });
    this.events.once("shutdown", () => {
      for (const key of Object.values(this.keys ?? {}))
        this.input.keyboard?.removeKey(key, true);
      this.keys = undefined;
    });
    label(this, 960, 588, this.services.player.name, 20).setOrigin(0.5);
    label(
      this,
      960,
      625,
      "A/D: move · Shift: run · Space: jump · R: stance",
      14,
    ).setOrigin(0.5);
    label(
      this,
      640,
      694,
      `${en.next}: ${opponentName(this.services.player.progress)} · Victories: ${this.services.player.progress}`,
      21,
    ).setOrigin(0.5);
    label(
      this,
      960,
      650,
      "Arena: B toggles Auto Battle",
      14,
      "#b9aa8d",
    ).setOrigin(0.5);
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      rigs: this.rig ? [this.rig.jointSnapshot()] : [],
      stance: this.movement?.stance,
      previewBounds: this.rig?.root.getBounds(),
    };
  }
  private confirmReset() {
    this.modalOpen = true;
    const shade = this.add
      .rectangle(640, 360, 1280, 720, 0x000000, 0.75)
      .setInteractive();
    const box = panel(this, 640, 355, 540, 250);
    const title = label(this, 640, 290, en.confirm, 30).setOrigin(0.5);
    const hint = label(this, 640, 337, en.resetHint, 19).setOrigin(0.5);
    const cleanup = () => {
      [shade, box, title, hint, yes, no].forEach((o) => o.destroy());
      this.modalOpen = false;
    };
    const yes = this.button("resetYes", 515, 410, 215, en.yes, () => {
      this.services.reset();
      this.scene.restart();
    });
    const no = this.button("resetNo", 765, 410, 215, en.no, cleanup);
  }
  update(_time: number, delta: number) {
    if (this.rig && this.movement) {
      const keys = this.keys,
        active = !this.modalOpen;
      this.movement.update(delta, {
        left: active && Boolean(keys?.left.isDown),
        right: active && Boolean(keys?.right.isDown),
        run: active && Boolean(keys?.run.isDown),
        jump: false,
        toggleStance: false,
      });
      this.rig.update(delta);
    }
  }
}
