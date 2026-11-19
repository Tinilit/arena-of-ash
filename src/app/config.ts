import Phaser from "phaser";
import { BootScene } from "../scenes/BootScene";
import { MainMenuScene } from "../scenes/MainMenuScene";
import { ArenaScene } from "../scenes/ArenaScene";
import { CharacterScene } from "../scenes/CharacterScene";
import { ShopScene } from "../scenes/ShopScene";
import { ResultScene } from "../scenes/ResultScene";
import { LadderScene } from "../scenes/LadderScene";
import { installBackgroundUpdates } from "./backgroundUpdates";
export const config: Phaser.Types.Core.GameConfig = {
  type:
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("renderer") === "canvas"
      ? Phaser.CANVAS
      : Phaser.AUTO,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#211e1c",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  fps: { target: 60, smoothStep: false },
  callbacks: { postBoot: installBackgroundUpdates },
  scene: [
    BootScene,
    MainMenuScene,
    ArenaScene,
    CharacterScene,
    ShopScene,
    ResultScene,
    LadderScene,
  ],
  render: { antialias: true },
};
