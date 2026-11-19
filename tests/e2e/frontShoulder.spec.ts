import { test, expect } from "@playwright/test";
import type Phaser from "phaser";

test("front shoulder stays behind the torso while the attacking forearm changes depth", async ({
  page,
}) => {
  await page.goto("/?renderer=canvas&manual=1");
  await page.waitForFunction(() => "__arena" in window);
  const result = await page.evaluate(async () => {
    const rigPath = "/src/characters/Gladiator.ts",
      modelPath = "/src/domain/model.ts",
      motionPath = "/src/characters/equipmentMotion.ts",
      animationPath = "/src/characters/animation.ts",
      catalogPath = "/src/data/catalog.ts",
      grapplePath = "/src/characters/grappleMotion.ts",
      parryPath = "/src/characters/parryMotion.ts",
      restPath = "/src/characters/locomotion.ts";
    const [
      { Gladiator },
      { createPlayer },
      { equipmentMotion },
      { Animator },
      { item },
      { grapplePose },
      { parryPose },
      { combatRest },
    ] = await Promise.all([
      import(rigPath) as Promise<
        typeof import("../../src/characters/Gladiator")
      >,
      import(modelPath) as Promise<typeof import("../../src/domain/model")>,
      import(motionPath) as Promise<
        typeof import("../../src/characters/equipmentMotion")
      >,
      import(animationPath) as Promise<
        typeof import("../../src/characters/animation")
      >,
      import(catalogPath) as Promise<typeof import("../../src/data/catalog")>,
      import(grapplePath) as Promise<
        typeof import("../../src/characters/grappleMotion")
      >,
      import(parryPath) as Promise<
        typeof import("../../src/characters/parryMotion")
      >,
      import(restPath) as Promise<
        typeof import("../../src/characters/locomotion")
      >,
    ]);
    const engine = (window as unknown as { Phaser: typeof Phaser }).Phaser;
    const parent = document.createElement("div");
    parent.id = "front-shoulder-fixture";
    parent.style.cssText =
      "position:absolute;inset:0;z-index:1000;background:#211e1c";
    document.body.append(parent);
    return new Promise<{
      checked: number;
      failures: number;
      examples: string[];
      maxDrift: number;
      crossed: number;
    }>((resolve) => {
      new engine.Game({
        type: engine.CANVAS,
        width: 1280,
        height: 720,
        parent,
        backgroundColor: "#211e1c",
        audio: { noAudio: true },
        banner: false,
        scene: {
          create(this: Phaser.Scene) {
            let checked = 0,
              failures = 0,
              maxDrift = 0,
              crossed = 0;
            const examples: string[] = [];
            const check = (
              rig: InstanceType<typeof Gladiator>,
              context: string,
            ) => {
              const s = rig.jointSnapshot(),
                shoulder = s.body.frontShoulder;
              if (
                shoulder.plane !== "backTorso" ||
                s.body.layers.indexOf("backTorso") >=
                  s.body.layers.indexOf("torso")
              ) {
                failures++;
                if (examples.length < 8) examples.push(context);
              }
              if (s.body.frontArms.includes("nearArm")) crossed++;
              for (const key of ["origin", "right", "down"] as const)
                maxDrift = Math.max(
                  maxDrift,
                  Math.hypot(
                    shoulder.frame[key].x - shoulder.forearmFrame[key].x,
                    shoulder.frame[key].y - shoulder.forearmFrame[key].y,
                  ),
                );
              maxDrift = Math.max(
                maxDrift,
                Math.hypot(
                  shoulder.frame.origin.x - s.near.shoulder.x,
                  shoulder.frame.origin.y - s.near.shoulder.y,
                ),
              );
              checked++;
            };
            for (const id of [
              "wood",
              "war-spear",
              "greatsword",
              "war-hammer",
              "battle-axe",
              "trident",
              "crossbow",
            ])
              for (const armored of [false, true]) {
                const p = createPlayer();
                p.inventory.push(id);
                p.equipment = {
                  rightHand: id,
                  ...(armored
                    ? { body: "cuirass", helmet: "closed-helm" }
                    : {}),
                };
                const rig = new Gladiator(this, 640, 560, p, false, 1);
                for (const facing of [1, -1] as const) {
                  rig.setArenaTransform(640, 560, facing, 560);
                  for (const hand of ["front", "rear"] as const) {
                    const library = equipmentMotion(item(id), hand);
                    for (const [name, clip] of Object.entries(library)) {
                      const animator = new Animator(library);
                      animator.play(name);
                      for (let frame = 0; frame <= 8; frame++) {
                        rig.applyPose(
                          animator.update(frame ? clip.duration / 8 : 0),
                          name,
                        );
                        check(rig, `${id}/${hand}/${name}/${facing}/${frame}`);
                      }
                    }
                  }
                  for (const phase of [
                    "reach",
                    "lift",
                    "hold",
                    "throw",
                    "air",
                  ] as const)
                    for (const role of ["lifter", "target"] as const)
                      for (const elapsed of [0, 150, 420, 800, 1000]) {
                        rig.applyPose(
                          grapplePose(combatRest, { phase, role, elapsed }),
                          "grapple",
                        );
                        check(rig, `${id}/${role}/${phase}/${elapsed}`);
                      }
                  for (const elapsed of [0, 75, 150, 250, 400]) {
                    rig.applyPose(
                      parryPose(combatRest, 100, "rear", elapsed),
                      "parry",
                    );
                    check(rig, `${id}/counter-shove/${elapsed}`);
                  }
                }
                rig.root.destroy();
              }
            this.children.removeAll(true);
            this.add.text(
              40,
              20,
              "Front shoulder stays behind torso - forearm can cross in front",
              { fontSize: "24px", color: "#e9d6ab" },
            );
            const samples = [
              "front strike",
              "front throw",
              "counter shove",
              "lift",
              "rear strike",
              "two-handed hold",
            ];
            for (let i = 0; i < samples.length; i++) {
              const p = createPlayer();
              p.equipment =
                i === 5
                  ? { rightHand: "greatsword" }
                  : { rightHand: "wood", leftHand: "rust" };
              const x = 220 + (i % 3) * 420,
                y = i < 3 ? 365 : 690;
              const rig = new Gladiator(this, x, y, p, false, 1.1);
              rig.setArenaTransform(x, y, i % 2 ? -1 : 1, y);
              if (i === 2)
                rig.applyPose(parryPose(combatRest, 100, "rear", 150), "parry");
              else if (i === 3)
                rig.applyPose(
                  grapplePose(combatRest, {
                    phase: "lift",
                    role: "lifter",
                    elapsed: 650,
                  }),
                  "grapple",
                );
              else {
                const hand = i < 2 ? "front" : "rear",
                  name =
                    i === 1 ? "throwAction" : i === 5 ? "idleCombat" : "quick";
                const library = equipmentMotion(
                  item(
                    p.equipment[hand === "front" ? "leftHand" : "rightHand"]!,
                  ),
                  hand,
                );
                const animator = new Animator(library);
                animator.play(name);
                rig.applyPose(
                  animator.update(
                    library[name].duration * (i === 1 ? 0.34 : 0.52),
                  ),
                  name,
                );
              }
              this.add.text(70 + (i % 3) * 420, i < 3 ? 66 : 395, samples[i], {
                fontSize: "18px",
                color: "#e9d6ab",
              });
            }
            this.time.delayedCall(100, () =>
              resolve({ checked, failures, examples, maxDrift, crossed }),
            );
          },
        },
      });
    });
  });
  expect(result.checked).toBeGreaterThan(10000);
  expect(result.failures, result.examples.join("\n")).toBe(0);
  expect(result.crossed).toBeGreaterThan(100);
  expect(result.maxDrift).toBeLessThan(0.0001);
  await page.screenshot({
    path: "test-results/screenshots/front-shoulder-layering.png",
  });
});
