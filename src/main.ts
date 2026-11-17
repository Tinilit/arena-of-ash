import Phaser from "phaser";
import { config } from "./app/config";
import type { BaseScene } from "./scenes/BaseScene";
const game = new Phaser.Game(config);
if (import.meta.env.DEV) {
  Object.defineProperty(window, "__arena", {
    configurable: true,
    value: {
      snapshot: () => {
        const scene = game.scene.getScenes(true)[0] as BaseScene | undefined;
        return scene?.snapshot?.();
      },
    },
  });
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    game.destroy(true);
    delete (window as unknown as Record<string, unknown>).__arena;
  });
