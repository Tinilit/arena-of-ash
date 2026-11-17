import { test, expect, type Page } from "@playwright/test";
import bundled from "../fixtures/catalog.json" with { type: "json" };
import type { Player } from "../../src/domain/model";
import type { Fighter, State, CombatEvent } from "../../src/combat/engine";
interface Point {
  x: number;
  y: number;
}
interface Limb {
  hip: Point;
  knee: Point;
  ankle: Point;
  shoulder: Point;
  elbow: Point;
  hand: Point;
  heel: Point;
  toe: Point;
}
interface RigFrame {
  origin: Point;
  right: Point;
  down: Point;
}
interface Rig {
  physical: boolean;
  body: { layers: string[]; arms: string[]; waist: RigFrame; torso: RigFrame };
  scale: number;
  shield: boolean;
  shieldAttachment: (Point & { behindBody: boolean }) | null;
  weapons: (Point & { texture: string | null })[];
  near: Limb;
  far: Limb;
}
interface Snapshot {
  scene: string;
  style: "ash";
  motion: "grounded";
  content: {
    source: "live" | "bundled";
    revision: string;
    count: number;
    failedImages: number;
  };
  player: Player;
  buttons: Record<string, Point>;
  rigs?: Rig[];
  battle?: {
    state: State;
    player: Fighter;
    enemy: Fighter;
    pending: CombatEvent | null;
  };
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  // Foundation scenarios use a fixed balance; the live file is validated separately.
  await page.route("**/content/items.json?_=*", (route) =>
    route.fulfill({ json: bundled }),
  );
  page.on("pageerror", (e) => list.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") list.push(m.text());
  });
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
const snapshot = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __arena: { snapshot: () => Snapshot } }
    ).__arena.snapshot(),
  );
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function shot(page: Page, name: string) {
  await frames(page);
  await page.screenshot({ path: `test-results/screenshots/${name}.png` });
}
async function scene(page: Page, name: string) {
  await page.waitForFunction(() => "__arena" in window);
  await expect.poll(async () => (await snapshot(page))?.scene).toBe(name);
}
async function click(page: Page, id: string) {
  await expect
    .poll(async () => Boolean((await snapshot(page))?.buttons[id]))
    .toBe(true);
  await frames(page);
  const s = await snapshot(page),
    p = s.buttons[id],
    b = await page.locator("canvas").boundingBox();
  await page.mouse.click(
    b!.x + (p.x * b!.width) / 1280,
    b!.y + (p.y * b!.height) / 720,
  );
  await page.waitForTimeout(60);
}
async function launch(page: Page) {
  await page.goto("/?seed=42&renderer=canvas");
  await scene(page, "MainMenuScene");
}
async function finish(page: Page, attack = true) {
  for (let i = 0; i < 500; i++) {
    const s = await snapshot(page);
    if (s.scene === "ResultScene") return;
    if (s.battle?.state === "PlayerTurn")
      await click(
        page,
        attack
          ? s.battle.player.stamina >= 12
            ? "quick"
            : "recover"
          : "defend",
      );
    await page.waitForTimeout(180);
  }
  throw Error("Battle did not finish");
}
function anatomy(r: Rig) {
  const len = (a: Point, b: Point) =>
    Math.hypot(a.x - b.x, a.y - b.y) / r.scale;
  for (const side of [r.near, r.far]) {
    expect(len(side.hip, side.knee)).toBeCloseTo(54, 3);
    expect(len(side.knee, side.ankle)).toBeCloseTo(52, 3);
    expect(len(side.shoulder, side.elbow)).toBeCloseTo(40, 3);
    expect(len(side.elbow, side.hand)).toBeCloseTo(34, 3);
    expect(side.heel.y).toBeCloseTo(side.toe.y, 3);
  }
}

test("Ash Vanguard is the only appearance, with no studio or old preference controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("arena-of-ash.presentation.v1", "original");
    localStorage.setItem("arena-of-ash.motion.v1", "legacy");
  });
  await launch(page);
  expect((await snapshot(page)).style).toBe("ash");
  expect((await snapshot(page)).motion).toBe("grounded");
  expect((await snapshot(page)).buttons.studio).toBeUndefined();
  await expect(page.locator("canvas")).toBeVisible();
  await shot(page, "menu");
  await click(page, "character");
  await scene(page, "CharacterScene");
  await shot(page, "character");
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
});
test("complete battle, animation impact and persisted victory rewards", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  expect((await snapshot(page)).battle!.player.hp).toBe(100);
  expect((await snapshot(page)).battle!.enemy.hp).toBe(80);
  await shot(page, "arena");
  await click(page, "quick");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.stamina)
    .toBe(88);
  await shot(page, "attack");
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("PlayerTurn");
  expect((await snapshot(page)).battle!.enemy.hp).toBe(66);
  await finish(page);
  expect((await snapshot(page)).player.gold).toBe(150);
  expect((await snapshot(page)).player.xp).toBe(40);
  await shot(page, "victory");
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.gold).toBe(150);
  expect((await snapshot(page)).player.progress).toBe(1);
});
test("defeat awards once and fight again initializes a fresh battle", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await finish(page, false);
  const p = (await snapshot(page)).player;
  expect(p.gold).toBe(110);
  expect(p.xp).toBe(10);
  expect(p.rewarded).toHaveLength(1);
  expect(p.progress).toBe(0);
  await shot(page, "defeat");
  await click(page, "again");
  await scene(page, "ArenaScene");
  expect((await snapshot(page)).battle!.player.hp).toBe(100);
  expect((await snapshot(page)).player.gold).toBe(110);
});
test("paginated purchases and inventory equip all remaining items and persist the spear kit", async ({
  page,
}) => {
  await launch(page);
  const p = (await snapshot(page)).player;
  p.gold = 1000;
  await page.evaluate(
    (p) =>
      localStorage.setItem(
        "arena-of-ash.v1",
        JSON.stringify({ version: 1, player: p }),
      ),
    p,
  );
  await page.reload();
  await scene(page, "MainMenuScene");
  await click(page, "shop");
  for (const id of [
    "rust",
    "iron",
    "spear",
    "leather",
    "plate",
    "cap",
    "war-spear",
  ])
    await click(page, `buy-${id}`);
  await click(page, "shop-next");
  await expect
    .poll(async () => Boolean((await snapshot(page)).buttons["buy-viking"]))
    .toBe(true);
  expect((await snapshot(page)).buttons["buy-glaives"]).toBeUndefined();
  await shot(page, "new-equipment-shop");
  await click(page, "buy-viking");
  expect((await snapshot(page)).player.gold).toBe(415);
  expect((await snapshot(page)).player.inventory).toHaveLength(9);
  await click(page, "back");
  await click(page, "character");
  await click(page, "equip-plate");
  await click(page, "equip-war-spear");
  await click(page, "inventory-next");
  await click(page, "equip-viking");
  await shot(page, "new-equipment-character");
  await click(page, "back");
  await click(page, "battle");
  await scene(page, "ArenaScene");
  const rig = (await snapshot(page)).rigs![0];
  expect(rig.weapons).toHaveLength(1);
  expect(rig.shield).toBe(false);
  expect(
    Math.hypot(
      rig.weapons[0].x - rig.near.hand.x,
      rig.weapons[0].y - rig.near.hand.y,
    ),
  ).toBeLessThan(0.01);
  await shot(page, "new-equipment-arena");
  await click(page, "quick");
  await expect
    .poll(async () => (await snapshot(page)).battle?.enemy.hp)
    .toBe(57);
  await shot(page, "spear-thrust");
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("PlayerTurn");
  await page.reload();
  await scene(page, "MainMenuScene");
  const loaded = (await snapshot(page)).player;
  expect(loaded.equipment).toEqual({
    weapon: "war-spear",
    chest: "plate",
    helmet: "viking",
  });
  expect(loaded.gold).toBe(415);
  expect(loaded.inventory).toHaveLength(9);
});
test("real joint transforms keep fixed bones, level soles and rear-foot support during a step", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  const initial = (await snapshot(page)).rigs![0];
  (await snapshot(page)).rigs!.forEach(anatomy);
  await shot(page, "anatomy-idle");
  await click(page, "heavy");
  // Measure every rendered frame in the browser. Screenshots and Node round trips
  // during this window can skip a brief lift on a busy software renderer.
  const samples = await page.evaluate(
    () =>
      new Promise<Rig[]>((resolve) => {
        const rigs: Rig[] = [],
          end = performance.now() + 1350;
        const sample = () => {
          const current = (
            window as unknown as { __arena: { snapshot: () => Snapshot } }
          ).__arena.snapshot();
          rigs.push(current.rigs![0]);
          if (performance.now() < end) requestAnimationFrame(sample);
          else resolve(rigs);
        };
        requestAnimationFrame(sample);
      }),
  );
  let lifted = false;
  expect(samples.length).toBeGreaterThan(2);
  for (const rig of samples) {
    anatomy(rig);
    expect(rig.far.heel.x).toBeCloseTo(initial.far.heel.x, 3);
    expect(rig.far.heel.y).toBeCloseTo(initial.far.heel.y, 3);
    expect(rig.near.heel.y).toBeLessThanOrEqual(initial.near.heel.y + 0.01);
    if (rig.near.heel.y < initial.near.heel.y - 2) lifted = true;
  }
  expect(lifted).toBe(true);
});
test("keyboard input, scene shutdown, reset confirmation and viewport scaling", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await page.keyboard.press("2");
  await expect
    .poll(async () => (await snapshot(page)).battle?.state)
    .toBe("PlayerAnimating");
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  await page.waitForTimeout(1300);
  await click(page, "battle");
  await page.keyboard.press("3");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.guard)
    .toBe(true);
  await page.setViewportSize({ width: 960, height: 600 });
  await shot(page, "small-landscape");
  const b = await page.locator("canvas").boundingBox();
  expect(b!.width).toBeLessThanOrEqual(960);
  expect(b!.height).toBeLessThanOrEqual(600);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#rotate")).toBeVisible();
  await shot(page, "portrait");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  await click(page, "shop");
  await click(page, "buy-rust");
  await click(page, "back");
  await click(page, "reset");
  await click(page, "resetNo");
  expect((await snapshot(page)).player.gold).toBe(60);
  await click(page, "reset");
  await click(page, "resetYes");
  expect((await snapshot(page)).player.gold).toBe(100);
});
test("default renderer starts without errors", async ({ page }) => {
  await page.goto("/");
  await scene(page, "MainMenuScene");
  await expect(page.locator("canvas")).toBeVisible();
  expect((await snapshot(page)).style).toBe("ash");
  await shot(page, "default-renderer");
});

test("attribute allocation persists and updates battle statistics", async ({
  page,
}) => {
  await launch(page);
  const p = (await snapshot(page)).player;
  p.level = 2;
  p.points = 2;
  await page.evaluate(
    (p) =>
      localStorage.setItem(
        "arena-of-ash.v1",
        JSON.stringify({ version: 1, player: p }),
      ),
    p,
  );
  await page.reload();
  await scene(page, "MainMenuScene");
  await click(page, "character");
  await click(page, "attribute-vitality");
  await click(page, "attribute-strength");
  expect((await snapshot(page)).player.points).toBe(0);
  expect((await snapshot(page)).player.attributes.vitality).toBe(11);
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.attributes.strength).toBe(11);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  expect((await snapshot(page)).battle!.player.hp).toBe(104);
  await click(page, "quick");
  await expect
    .poll(async () => (await snapshot(page)).battle?.enemy.hp)
    .toBe(65);
});

test("external JSON adds image-backed equipment and changes live stats after refresh without code changes", async ({
  page,
}) => {
  const live = {
    ...structuredClone(bundled),
    revision: "runtime-test-1",
    items: [
      ...structuredClone(bundled.items),
      {
        id: "runtime-spear",
        name: "Runtime Test Spear",
        slot: "weapon",
        price: 25,
        attack: 12,
        armor: 0,
        visual: "war-spear",
        weaponType: "spear",
        description: "Loaded from an external catalog.",
        image: {
          src: "items/runtime-spear.png",
          width: 18,
          height: 190,
          originX: 0.5,
          originY: 0.63,
        },
      },
    ],
  };
  const imageRequests: string[] = [];
  await page.route("**/content/items.json?_=*", (route) =>
    route.fulfill({ json: live }),
  );
  await page.route("**/content/items/runtime-spear*.png?*", (route) => {
    imageRequests.push(route.request().url());
    return route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1kAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await launch(page);
  expect((await snapshot(page)).content).toEqual({
    source: "live",
    revision: "runtime-test-1",
    count: 10,
    failedImages: 0,
  });
  await click(page, "shop");
  await click(page, "shop-next");
  await click(page, "buy-runtime-spear");
  expect((await snapshot(page)).player.gold).toBe(75);
  await click(page, "back");
  await click(page, "character");
  await click(page, "equip-runtime-spear");
  await click(page, "back");
  await click(page, "battle");
  await scene(page, "ArenaScene");
  expect((await snapshot(page)).rigs![0].weapons[0].texture).toBe(
    "content-item:runtime-spear",
  );
  await shot(page, "runtime-image-equipped");
  // Publishing changed data cannot mutate an already-running battle.
  live.items[live.items.length - 1].attack = 18;
  live.revision = "runtime-test-2";
  const updated = live.items[live.items.length - 1];
  if (!("image" in updated)) throw Error("Missing test artwork");
  updated.image.src = "items/runtime-spear-v2.png";
  await click(page, "quick");
  await expect
    .poll(async () => (await snapshot(page)).battle?.enemy.hp)
    .toBe(55);
  expect((await snapshot(page)).content.revision).toBe("runtime-test-1");
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).content.revision).toBe("runtime-test-2");
  expect((await snapshot(page)).player.equipment.weapon).toBe("runtime-spear");
  expect(
    imageRequests.some((url) =>
      url.includes("runtime-spear-v2.png?rev=runtime-test-2"),
    ),
  ).toBe(true);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await click(page, "quick");
  await expect
    .poll(async () => (await snapshot(page)).battle?.enemy.hp)
    .toBe(49);
});

test("invalid external data and undecodable image files keep the game playable", async ({
  page,
}) => {
  await page.route("**/content/items.json?_=*", (route) =>
    route.fulfill({ json: { version: 99, items: [] } }),
  );
  await launch(page);
  expect((await snapshot(page)).content.source).toBe("bundled");
  await click(page, "shop");
  expect((await snapshot(page)).buttons["buy-rust"]).toBeDefined();
  await page.unroute("**/content/items.json?_=*");
  const live = structuredClone(bundled);
  await page.route("**/content/items.json?_=*", (route) =>
    route.fulfill({
      json: {
        ...live,
        items: live.items.map((i) =>
          i.id === "wood"
            ? {
                ...i,
                image: {
                  src: "items/broken.png",
                  width: 25,
                  height: 130,
                  originX: 0.5,
                  originY: 0.8,
                },
              }
            : i,
        ),
      },
    }),
  );
  await page.route("**/content/items/broken.png?*", (route) =>
    route.fulfill({ contentType: "image/png", body: "invalid image bytes" }),
  );
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).content).toMatchObject({
    source: "live",
    failedImages: 1,
  });
  await click(page, "battle");
  await scene(page, "ArenaScene");
  expect((await snapshot(page)).rigs![0].weapons[0].texture).toBeNull();
  await click(page, "quick");
  await expect
    .poll(async () => (await snapshot(page)).battle?.enemy.hp)
    .toBe(66);
});

test("shields are absent and both arms render in front of the armored character", async ({
  page,
}) => {
  await launch(page);
  await click(page, "shop");
  expect((await snapshot(page)).buttons["buy-shield"]).toBeUndefined();
  expect((await snapshot(page)).buttons["buy-tower"]).toBeUndefined();
  await click(page, "shop-next");
  expect((await snapshot(page)).buttons["buy-shield"]).toBeUndefined();
  expect((await snapshot(page)).buttons["buy-tower"]).toBeUndefined();
  await click(page, "back");
  const player = (await snapshot(page)).player;
  player.progress = 2;
  player.inventory = ["wood", "war-spear", "plate", "viking"];
  player.equipment = { weapon: "war-spear", chest: "plate", helmet: "viking" };
  await page.evaluate(
    (p) =>
      localStorage.setItem(
        "arena-of-ash.v1",
        JSON.stringify({ version: 1, player: p }),
      ),
    player,
  );
  await page.reload();
  await scene(page, "MainMenuScene");
  await click(page, "character");
  await scene(page, "CharacterScene");
  await shot(page, "rig-armored-character");
  await click(page, "back");
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await shot(page, "rig-armored-both-facing");
  await click(page, "heavy");
  const samples = await page.evaluate(
    () =>
      new Promise<Rig[][]>((resolve) => {
        const poses: Rig[][] = [],
          end = performance.now() + 2300;
        const sample = () => {
          poses.push(
            (
              window as unknown as { __arena: { snapshot: () => Snapshot } }
            ).__arena.snapshot().rigs!,
          );
          if (performance.now() < end) requestAnimationFrame(sample);
          else resolve(poses);
        };
        requestAnimationFrame(sample);
      }),
  );
  for (const rigs of samples)
    for (const rig of rigs) {
      expect(rig.shield).toBe(false);
      expect(rig.body.arms).toEqual(["farArm", "nearArm"]);
      expect(rig.body.layers.indexOf("frontTorso")).toBeGreaterThan(
        rig.body.layers.indexOf("torso"),
      );
      expect(rig.body.layers.indexOf("frontTorso")).toBeGreaterThan(
        rig.body.layers.indexOf("skirt"),
      );
    }
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("PlayerTurn");
  await click(page, "defend");
  await shot(page, "rig-armored-guard");
});

test("both legs stay beneath the skirt and arms keep their own shoulder attachments through motion", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await shot(page, "rig-revised-idle");
  await click(page, "heavy");
  const samples = await page.evaluate(
    () =>
      new Promise<Rig[][]>((resolve) => {
        const poses: Rig[][] = [],
          end = performance.now() + 1500;
        const sample = () => {
          poses.push(
            (
              window as unknown as { __arena: { snapshot: () => Snapshot } }
            ).__arena.snapshot().rigs!,
          );
          if (performance.now() < end) requestAnimationFrame(sample);
          else resolve(poses);
        };
        requestAnimationFrame(sample);
      }),
  );
  const localPoint = (frame: RigFrame, x: number, y: number) => ({
    x:
      frame.origin.x +
      x * (frame.right.x - frame.origin.x) +
      y * (frame.down.x - frame.origin.x),
    y:
      frame.origin.y +
      x * (frame.right.y - frame.origin.y) +
      y * (frame.down.y - frame.origin.y),
  });
  const close = (actual: Point, expected: Point) =>
    expect(
      Math.hypot(actual.x - expected.x, actual.y - expected.y),
    ).toBeLessThan(0.04);
  expect(samples.length).toBeGreaterThan(2);
  for (const rigs of samples)
    for (const rig of rigs) {
      const { layers, waist, torso } = rig.body;
      for (const name of ["nearThigh", "farThigh"]) {
        expect(layers.indexOf(name)).toBeGreaterThanOrEqual(0);
        expect(layers.indexOf(name)).toBeLessThan(layers.indexOf("skirt"));
      }
      expect(layers.indexOf("frontTorso")).toBeGreaterThan(
        layers.indexOf("skirt"),
      );
      close(rig.near.shoulder, localPoint(torso, 27, -63));
      close(rig.far.shoulder, localPoint(torso, -27, -63));
      close(rig.near.hip, localPoint(waist, 8, 10));
      close(rig.far.hip, localPoint(waist, -8, 10));
    }
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("PlayerTurn");
  await click(page, "heavy");
  await page.waitForTimeout(250);
  await shot(page, "rig-revised-heavy");
});
