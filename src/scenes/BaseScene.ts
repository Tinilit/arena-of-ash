import Phaser from "phaser";
import type { Services } from "../app/services";
import { arena } from "../rendering/arena";
import { Button, label } from "../ui/widgets";
import { en } from "../ui/strings";
import { prepareDisplay } from "../app/display";
import {
  progressionScene,
  pendingDecision,
  shopAccess,
  closeShop,
} from "../domain/postBattle";
export class BaseScene extends Phaser.Scene {
  services!: Services;
  buttons: Record<string, Button> = {};
  prepare(title: string) {
    prepareDisplay(this);
    this.services = this.registry.get("services");
    const destination = progressionScene(this.services.player);
    if (
      (pendingDecision(this.services.player) &&
        this.scene.key !== destination &&
        !(
          this.scene.key === "CharacterScene" &&
          shopAccess(this.services.player)
        )) ||
      ((this.scene.key === "ShopScene" ||
        this.scene.key === "SkillScene" ||
        this.scene.key === "ResultScene") &&
        !pendingDecision(this.services.player))
    ) {
      this.scene.start(destination);
      return false;
    }
    this.buttons = {};
    arena(this);
    label(this, 42, 47, title, 32);
    label(
      this,
      1237,
      46,
      `${this.services.player.gold} ◈`,
      24,
      "#e8bd72",
    ).setOrigin(1, 0.5);
    if (this.services.store.warning)
      label(this, 640, 707, en.storage, 14, "#e8bd72").setOrigin(0.5);
    else if (
      this.services.content.source === "bundled" ||
      this.services.content.failedImages
    )
      label(
        this,
        640,
        707,
        this.services.content.source === "bundled"
          ? en.contentFallback
          : en.artFallback,
        14,
        "#e8bd72",
      ).setOrigin(0.5);
    this.input.keyboard?.on("keydown-ESC", () => {
      this.leave();
    });
    this.events.once("shutdown", () => {
      this.input.keyboard?.removeAllListeners();
    });
    return true;
  }
  private leave() {
    const p = this.services.player;
    if (this.scene.key === "CharacterScene" && shopAccess(p)) {
      this.scene.start("ShopScene");
      return;
    }
    if (this.scene.key === "ShopScene") {
      closeShop(p);
      this.services.save();
      this.scene.start("MainMenuScene");
      return;
    }
    if (pendingDecision(p)) {
      this.scene.start(progressionScene(p));
      return;
    }
    if (this.scene.key !== "MainMenuScene") this.scene.start("MainMenuScene");
  }
  button(
    id: string,
    x: number,
    y: number,
    w: number,
    text: string,
    run: () => void,
    h = 48,
  ) {
    const b = new Button(this, x, y, w, h, text, run);
    this.buttons[id] = b;
    return b;
  }
  back() {
    this.button(
      "back",
      160,
      670,
      230,
      this.scene.key === "ShopScene"
        ? "← Finish shop visit"
        : this.scene.key === "CharacterScene" &&
            shopAccess(this.services.player)
          ? "← Back to shop"
          : en.back,
      () => this.leave(),
    );
  }
  snapshot() {
    return {
      scene: this.scene.key,
      style: this.services.style,
      motion: this.services.motion,
      content: { ...this.services.content },
      player: structuredClone(this.services.player),
      buttons: Object.fromEntries(
        Object.entries(this.buttons).map(([id, b]) => [id, { x: b.x, y: b.y }]),
      ),
    };
  }
}
