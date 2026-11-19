import { test, expect } from "@playwright/test";
import type Phaser from "phaser";

test("overlapping hit flashes and interrupted flashes always restore full opacity", async ({
  page,
}) => {
  await page.goto("/?renderer=canvas&manual=1");
  await page.waitForFunction(() => "__arena" in window);
  const result = await page.evaluate(async () => {
    const rigModule = "/src/characters/Gladiator.ts";
    const modelModule = "/src/domain/model.ts";
    const { Gladiator } = (await import(
      rigModule
    )) as typeof import("../../src/characters/Gladiator");
    const { createPlayer } = (await import(
      modelModule
    )) as typeof import("../../src/domain/model");
    const engine = (window as unknown as { Phaser: typeof Phaser }).Phaser;
    return new Promise<{
      overlap: number;
      interrupted: number;
      idle: number;
      flashed: boolean;
    }>((resolve) => {
      const game: Phaser.Game = new engine.Game({
        type: engine.HEADLESS,
        width: 400,
        height: 500,
        audio: { noAudio: true },
        banner: false,
        scene: {
          create(this: Phaser.Scene) {
            const rig = new Gladiator(this, 200, 450, createPlayer(), false, 1);
            let faded = false;
            // A second hit lands while the first flash is already translucent.
            rig.flash();
            this.time.delayedCall(35, () => {
              faded ||= rig.root.alpha < 1;
              rig.flash();
            });
            this.time.delayedCall(90, () => {
              rig.flash();
              rig.flash();
            });
            this.time.delayedCall(650, () => {
              const overlap = rig.root.alpha;
              rig.flash();
              this.time.delayedCall(40, () => {
                this.tweens
                  .getTweensOf(rig.root)
                  .forEach((tween) => tween.stop());
              });
              this.time.delayedCall(150, () => {
                const interrupted = rig.root.alpha;
                this.time.delayedCall(300, () => {
                  const idle = rig.root.alpha;
                  rig.root.destroy();
                  game.destroy(true);
                  resolve({ overlap, interrupted, idle, flashed: faded });
                });
              });
            });
          },
        },
      });
    });
  });
  expect(result.flashed).toBe(true);
  expect(result.overlap).toBe(1);
  expect(result.interrupted).toBe(1);
  expect(result.idle).toBe(1);
});
