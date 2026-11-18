import { test, expect, type Page } from "@playwright/test";
import bundled from "../fixtures/catalog.json" with { type: "json" };
import type { Player } from "../../src/domain/model";
import type {
  ArenaFighter,
  ArenaState,
  ContactEvent,
} from "../../src/combat/realtime";
import { contact, type CombatGeometry } from "../../src/combat/geometry";
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
  primaryHand: "rear" | "front";
  animation: string;
  origin: Point;
  body: {
    layers: string[];
    arms: string[];
    backArms: string[];
    frontArms: string[];
    waist: RigFrame;
    torso: RigFrame;
  };
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
  stance?: "relaxed" | "combat";
  previewBounds?: { x: number; y: number; width: number; height: number };
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
  geometry?: CombatGeometry[];
  battle?: {
    state: ArenaState;
    player: ArenaFighter;
    enemy: ArenaFighter;
    contacts: ContactEvent[];
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
async function steer(page: Page, state: Snapshot) {
  const { player, enemy } = state.battle!;
  const range = player.model.equipment.weapon?.includes("spear") ? 170 : 120;
  const gap = Math.abs(player.x - enemy.x),
    toward = Math.sign(enemy.x - player.x);
  const direction = gap > range + 8 ? toward : gap < range - 8 ? -toward : 0;
  for (const [key, held] of [
    ["a", direction < 0],
    ["d", direction > 0],
  ] as const)
    if (held) await page.keyboard.down(key);
    else await page.keyboard.up(key);
  return gap < range + 20;
}
async function hitEnemy(page: Page, action: "quick" | "heavy" = "quick") {
  const first = (await snapshot(page)).battle!.contacts.at(-1)?.id ?? 0;
  for (let i = 0; i < 100; i++) {
    const s = await snapshot(page);
    const contact = s.battle?.contacts.find(
      (e) => e.id > first && e.attackerId === "wanderer",
    );
    if (contact) {
      await page.keyboard.up("a");
      await page.keyboard.up("d");
      return contact;
    }
    if (s.scene !== "ArenaScene" || s.battle?.state !== "Fighting")
      throw Error("Fight ended before a player contact");
    if ((await steer(page, s)) && !s.battle.player.action)
      await page.keyboard.press(action === "quick" ? "j" : "k");
    await page.waitForTimeout(90);
  }
  throw Error("No physical weapon contact");
}
async function finish(page: Page, attack = true) {
  for (let i = 0; i < 450; i++) {
    const s = await snapshot(page);
    if (s.scene === "ResultScene") {
      await page.keyboard.up("a");
      await page.keyboard.up("d");
      return;
    }
    if (s.battle?.state === "Fighting" && attack) {
      const inRange = await steer(page, s);
      if (!s.battle.player.action) {
        if (s.battle.player.stamina < 12) await page.keyboard.press("f");
        else if (inRange) await page.keyboard.press("j");
      }
    }
    await page.waitForTimeout(100);
  }
  throw Error("Battle did not finish");
}
function anatomy(r: Rig, level = true) {
  const len = (a: Point, b: Point) =>
    Math.hypot(a.x - b.x, a.y - b.y) / r.scale;
  for (const side of [r.near, r.far]) {
    expect(len(side.hip, side.knee)).toBeCloseTo(54, 3);
    expect(len(side.knee, side.ankle)).toBeCloseTo(52, 3);
    expect(len(side.shoulder, side.elbow)).toBeCloseTo(40, 3);
    expect(len(side.elbow, side.hand)).toBeCloseTo(34, 3);
    if (level) expect(side.heel.y).toBeCloseTo(side.toe.y, 3);
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
  await page.waitForTimeout(720);
  expect((await snapshot(page)).battle!.enemy.hp).toBe(80);
  expect((await snapshot(page)).battle!.contacts).toHaveLength(0);
  await shot(page, "attack-missed-at-distance");
  const hit = await hitEnemy(page);
  expect(hit.damage).toBe(hit.blocked ? 7 : 14);
  expect((await snapshot(page)).battle!.enemy.hp).toBe(80 - hit.damage);
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
      rig.weapons[0].x - rig.far.hand.x,
      rig.weapons[0].y - rig.far.hand.y,
    ),
  ).toBeLessThan(0.01);
  await shot(page, "new-equipment-arena");
  const hit = await hitEnemy(page);
  expect(hit.damage).toBe(hit.blocked ? 12 : 23);
  await shot(page, "spear-thrust");
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
test("arena movement, running, jumping and attacks share fixed-length joint transforms", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  const initial = (await snapshot(page)).rigs![0];
  (await snapshot(page)).rigs!.forEach((r) => anatomy(r));
  await shot(page, "anatomy-idle");
  await page.keyboard.down("d");
  await page.keyboard.down("Shift");
  await page.keyboard.press("k");
  await page.waitForTimeout(230);
  const moving = await snapshot(page);
  expect(moving.battle!.player.x).toBeGreaterThan(initial.origin.x + 10);
  expect(moving.battle!.player.action?.name).toBe("heavy");
  expect(moving.rigs![0].animation).toBe("heavy");
  await shot(page, "arena-running-attack");
  await page.keyboard.press("Space");
  await page.waitForTimeout(220);
  const jumping = await snapshot(page);
  expect(jumping.battle!.player.y).toBeLessThan(-25);
  expect(jumping.battle!.player.action?.name).toBe("heavy");
  jumping.rigs!.forEach((r) => anatomy(r, false));
  await shot(page, "arena-jumping-attack");
  await page.keyboard.up("d");
  await page.keyboard.up("Shift");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.y)
    .toBe(0);
});
test("keyboard input, scene shutdown, reset confirmation and viewport scaling", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await page.keyboard.press("2");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.action?.name)
    .toBe("heavy");
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  await page.waitForTimeout(1300);
  await click(page, "battle");
  await click(page, "defend");
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
  const hit = await hitEnemy(page);
  expect(hit.damage).toBe(hit.blocked ? 8 : 15);
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
        hitbox: { startY: -115, endY: -85, radius: 3 },
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
  const firstHit = await hitEnemy(page);
  expect(firstHit.damage).toBe(firstHit.blocked ? 13 : 25);
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
  const secondHit = await hitEnemy(page);
  expect(secondHit.damage).toBe(secondHit.blocked ? 16 : 31);
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
  const hit = await hitEnemy(page);
  expect(hit.damage).toBe(hit.blocked ? 7 : 14);
});

test("shields are absent and the free front arm stays behind the torso while the armed rear arm renders in front", async ({
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
  await frames(page);
  const equippedFloor = (await snapshot(page)).rigs![0].near.heel.y;
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].near.heel.y)
    .toBeLessThan(equippedFloor - 25);
  expect((await snapshot(page)).previewBounds!.y).toBeGreaterThan(270);
  await shot(page, "camp-equipped-jump");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleRelaxed");
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
      expect(rig.body.arms).toEqual(["nearArm", "farArm"]);
      expect(rig.body.backArms).toEqual(["nearArm"]);
      expect(rig.body.frontArms).toEqual(["farArm"]);
      expect(rig.body.layers.indexOf("backTorso")).toBeGreaterThanOrEqual(0);
      expect(rig.body.layers.indexOf("backTorso")).toBeLessThan(
        rig.body.layers.indexOf("torso"),
      );
      expect(rig.body.layers.indexOf("frontTorso")).toBeGreaterThan(
        rig.body.layers.indexOf("torso"),
      );
      expect(rig.body.layers.indexOf("frontTorso")).toBeGreaterThan(
        rig.body.layers.indexOf("skirt"),
      );
    }
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("Fighting");
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
      close(rig.near.shoulder, localPoint(torso, 24, -55));
      close(rig.far.shoulder, localPoint(torso, -24, -55));
      close(rig.near.hip, localPoint(waist, 8, 10));
      close(rig.far.hip, localPoint(waist, -8, 10));
    }
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("Fighting");
  await click(page, "heavy");
  await page.waitForTimeout(250);
  await shot(page, "rig-revised-heavy");
});

test("camp supports both stances, forward/back walks, running and a grounded jump without changing progression", async ({
  page,
}) => {
  await launch(page);
  await expect
    .poll(async () => (await snapshot(page)).rigs?.[0].animation)
    .toBe("idleRelaxed");
  const initial = await snapshot(page),
    startX = initial.rigs![0].origin.x;
  expect(initial.rigs![0].primaryHand).toBe("rear");
  await page.keyboard.down("d");
  await page.waitForTimeout(420);
  expect((await snapshot(page)).rigs![0].animation).toBe("walkForward");
  const forward = (await snapshot(page)).rigs![0].origin.x;
  expect(forward).toBeGreaterThan(startX + 10);
  await shot(page, "camp-walk-forward");
  await page.keyboard.up("d");
  const backwardStart = (await snapshot(page)).rigs![0].origin.x;
  await page.keyboard.down("a");
  await page.waitForTimeout(420);
  expect((await snapshot(page)).rigs![0].animation).toBe("walkBackward");
  expect((await snapshot(page)).rigs![0].origin.x).toBeLessThan(backwardStart);
  await shot(page, "camp-walk-backward");
  await page.keyboard.up("a");
  await page.keyboard.down("Shift");
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  expect((await snapshot(page)).rigs![0].animation).toBe("run");
  await shot(page, "camp-run");
  await page.keyboard.up("d");
  await page.keyboard.up("Shift");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleRelaxed");
  await page.waitForTimeout(220);
  const grounded = (await snapshot(page)).rigs![0].near.heel.y;
  await click(page, "move-jump");
  await page.waitForTimeout(320);
  const airborne = (await snapshot(page)).rigs![0];
  expect(airborne.animation).toBe("jump");
  expect(airborne.near.heel.y).toBeLessThan(grounded - 20);
  await shot(page, "camp-jump");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleRelaxed");
  await page.keyboard.press("r");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleCombat");
  await shot(page, "camp-combat-idle");
  await click(page, "move-stance");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleRelaxed");
  const rig = (await snapshot(page)).rigs![0];
  expect(rig.near.hand.y - rig.near.shoulder.y).toBeGreaterThan(50 * rig.scale);
  expect(
    Math.hypot(
      rig.weapons[0].x - rig.far.hand.x,
      rig.weapons[0].y - rig.far.hand.y,
    ),
  ).toBeLessThan(0.02);
  expect((await snapshot(page)).player).toEqual(initial.player);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  for (const fighter of (await snapshot(page)).rigs!) {
    expect(["idleCombat", "walkForward", "run"]).toContain(fighter.animation);
    expect(fighter.primaryHand).toBe("rear");
    expect(
      Math.hypot(
        fighter.weapons[0].x - fighter.far.hand.x,
        fighter.weapons[0].y - fighter.far.hand.y,
      ),
    ).toBeLessThan(0.02);
  }
  await shot(page, "rear-hand-combat-idle");
  await click(page, "heavy");
  await page.waitForTimeout(300);
  await shot(page, "rear-hand-heavy");
});

test("every HP change follows a real swept blade/body contact in both directions", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await hitEnemy(page);
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.action)
    .toBeNull();
  await page.keyboard.press("k");
  const samples = await page.evaluate(
    () =>
      new Promise<NonNullable<Snapshot["battle"]>[]>((resolve) => {
        const get = () =>
          (
            window as unknown as { __arena: { snapshot: () => Snapshot } }
          ).__arena.snapshot();
        const poses = [get().battle!],
          end = performance.now() + 3300;
        const sample = () => {
          const state = get();
          if (state.scene !== "ArenaScene") {
            resolve(poses);
            return;
          }
          poses.push(state.battle!);
          if (performance.now() < end) requestAnimationFrame(sample);
          else resolve(poses);
        };
        requestAnimationFrame(sample);
      }),
  );
  expect(samples.length).toBeGreaterThan(5);
  const seen = new Set(samples[0].contacts.map((e) => e.id));
  const attackers = new Set<string>();
  for (let i = 1; i < samples.length; i++) {
    const current = samples[i],
      previous = samples[i - 1];
    const events = current.contacts.filter((e) => !seen.has(e.id));
    for (const event of events) {
      expect(contact(event.blade, event.body)).not.toBeNull();
      attackers.add(event.attackerId);
      seen.add(event.id);
    }
    for (const name of ["player", "enemy"] as const) {
      const lost = events
        .filter((e) => e.defenderId === current[name].model.id)
        .reduce((sum, e) => sum + e.damage, 0);
      expect(current[name].hp).toBe(Math.max(0, previous[name].hp - lost));
    }
  }
  expect(attackers.has("wanderer")).toBe(true);
  expect(attackers.has("enemy")).toBe(true);
  await shot(page, "realtime-contact-combat");
});

test("arena hold buttons, guard, jump and boundaries remain responsive without turns", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  const initial = (await snapshot(page)).battle!.player.x;
  const position = (await snapshot(page)).buttons["arena-left"];
  await page.mouse.move(position.x, position.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  const after = (await snapshot(page)).battle!.player.x;
  expect(after).toBeLessThan(initial - 20);
  await page.waitForTimeout(180);
  expect((await snapshot(page)).battle!.player.x).toBeCloseTo(after, 1);
  await click(page, "defend");
  expect((await snapshot(page)).battle!.player.guard).toBe(true);
  await click(page, "defend");
  expect((await snapshot(page)).battle!.player.guard).toBe(false);
  await click(page, "arena-jump");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.y)
    .toBeLessThan(-20);
  await shot(page, "arena-touch-jump");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.y)
    .toBe(0);
  await page.keyboard.down("a");
  await page.keyboard.down("Shift");
  await page.waitForTimeout(1800);
  expect((await snapshot(page)).battle!.player.x).toBe(90);
  expect(Math.abs((await snapshot(page)).battle!.player.vx)).toBeLessThan(0.01);
  await page.keyboard.up("a");
  await page.keyboard.up("Shift");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const paused = (await snapshot(page)).battle!;
  await page.waitForTimeout(400);
  expect((await snapshot(page)).battle!.player.hp).toBe(paused.player.hp);
  expect((await snapshot(page)).battle!.player.x).toBe(paused.player.x);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.rewarded).toHaveLength(0);
});
