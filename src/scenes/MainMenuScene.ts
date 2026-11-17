import { BaseScene } from "./BaseScene";
import { label, panel } from "../ui/widgets";
import { en } from "../ui/strings";
import { Gladiator } from "../characters/Gladiator";
import { opponent } from "../domain/progression";
export class MainMenuScene extends BaseScene {
  private rig!: Gladiator;
  constructor() {
    super("MainMenuScene");
  }
  create() {
    this.prepare(en.camp);
    label(this, 640, 169, en.subtitle, 17, "#e8bd72").setOrigin(0.5);
    label(this, 640, 230, en.title, 70).setOrigin(0.5);
    label(this, 640, 288, en.startCopy, 19).setOrigin(0.5);
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
    const large =
      ["spear", "war-spear"].includes(
        this.services.player.equipment.weapon ?? "",
      ) || this.services.player.equipment.helmet === "viking";
    this.rig = new Gladiator(
      this,
      867,
      548,
      this.services.player,
      false,
      large ? 0.82 : 0.92,
    );
    label(
      this,
      830,
      601,
      `${this.services.player.name} • ${en.level} ${this.services.player.level}`,
      22,
    ).setOrigin(0.5);
    label(
      this,
      640,
      668,
      `${en.next}: ${opponent(this.services.player).name}`,
      21,
    ).setOrigin(0.5);
  }
  private confirmReset() {
    const shade = this.add
      .rectangle(640, 360, 1280, 720, 0x000000, 0.75)
      .setInteractive();
    const box = panel(this, 640, 355, 540, 250);
    const title = label(this, 640, 290, en.confirm, 30).setOrigin(0.5);
    const hint = label(this, 640, 337, en.resetHint, 19).setOrigin(0.5);
    const cleanup = () =>
      [shade, box, title, hint, yes, no].forEach((o) => o.destroy());
    const yes = this.button("resetYes", 515, 410, 215, en.yes, () => {
      this.services.reset();
      this.scene.restart();
    });
    const no = this.button("resetNo", 765, 410, 215, en.no, cleanup);
  }
  update(_time: number, delta: number) {
    this.rig?.update(delta);
  }
}
