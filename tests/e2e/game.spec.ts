import { test, expect, type Page } from "@playwright/test";
import type { Player } from "../../src/domain/model";
import type { Fighter, State, CombatEvent } from "../../src/combat/engine";
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});
interface Point {
  x: number;
  y: number;
}
interface RigMeasurement {
  physical: boolean;
  scale: number;
  near: {
    hip: Point;
    knee: Point;
    ankle: Point;
    shoulder: Point;
    elbow: Point;
    hand: Point;
    heel: Point;
    toe: Point;
  };
  far: RigMeasurement["near"];
}
interface Snapshot {
  motion: "grounded" | "legacy";
  rigs?: RigMeasurement[];
  scene: string;
  player: Player;
  buttons: Record<string, { x: number; y: number }>;
  preview?: {
    rigs: RigMeasurement[];
    bounds: { x: number; y: number; width: number; height: number }[];
  };
  battle?: {
    state: State;
    player: Fighter;
    enemy: Fighter;
    pending: CombatEvent | null;
  };
}
const snapshot = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __arena: { snapshot: () => Snapshot } }
    ).__arena.snapshot(),
  );
async function scene(page: Page, name: string) {
  await page.waitForFunction(() => "__arena" in window);
  await expect.poll(async () => (await snapshot(page))?.scene).toBe(name);
}
async function click(page: Page, id: string) {
  await expect
    .poll(async () => Boolean((await snapshot(page))?.buttons[id]))
    .toBe(true);
  const s = await snapshot(page);
  const point = s.buttons[id];
  expect(point, `button ${id}`).toBeTruthy();
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.click(
    box!.x + (point.x * box!.width) / 1280,
    box!.y + (point.y * box!.height) / 720,
  );
  await page.waitForTimeout(60);
}
async function expectPreviewFits(page: Page) {
  await expect
    .poll(async () =>
      (await snapshot(page)).preview?.bounds.every((b, index) => {
        const center = 220 + index * 420;
        return (
          b.x >= center - 175.01 &&
          b.x + b.width <= center + 175.01 &&
          b.y >= 259.99 &&
          b.y + b.height <= 490.01
        );
      }),
    )
    .toBe(true);
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
test("startup, battle, animation, victory and persisted rewards", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await launch(page);
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/menu.png" });
  await click(page, "battle");
  await scene(page, "ArenaScene");
  const initial = (await snapshot(page)).battle!;
  expect(initial.player.hp).toBe(100);
  expect(initial.enemy.hp).toBe(80);
  expect(initial.player.stamina).toBe(100);
  await page.screenshot({ path: "test-results/screenshots/arena.png" });
  await click(page, "quick");
  await expect
    .poll(async () => (await snapshot(page)).battle?.state)
    .toBe("PlayerAnimating");
  await page.waitForTimeout(250);
  await page.screenshot({ path: "test-results/screenshots/attack.png" });
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.stamina)
    .toBe(88);
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("PlayerTurn");
  expect((await snapshot(page)).battle!.enemy.hp).toBeLessThan(80);
  await finish(page);
  expect((await snapshot(page)).player.gold).toBe(150);
  expect((await snapshot(page)).player.xp).toBe(40);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: "test-results/screenshots/victory.png" });
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.gold).toBe(150);
  expect((await snapshot(page)).player.progress).toBe(1);
  expect(errors).toEqual([]);
});
test("shop, equip, navigation and reload", async ({ page }) => {
  await launch(page);
  await click(page, "shop");
  await scene(page, "ShopScene");
  await click(page, "buy-rust");
  expect((await snapshot(page)).player.gold).toBe(60);
  await click(page, "buy-rust");
  expect((await snapshot(page)).player.gold).toBe(60);
  await click(page, "buy-plate");
  expect((await snapshot(page)).player.gold).toBe(60);
  await click(page, "back");
  await click(page, "character");
  await click(page, "equip-rust");
  expect((await snapshot(page)).player.equipment.weapon).toBe("rust");
  await page.screenshot({ path: "test-results/screenshots/character.png" });
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.equipment.weapon).toBe("rust");
  expect((await snapshot(page)).player.gold).toBe(60);
  await click(page, "reset");
  await click(page, "resetNo");
  expect((await snapshot(page)).player.gold).toBe(60);
  await click(page, "reset");
  await click(page, "resetYes");
  expect((await snapshot(page)).player.gold).toBe(100);
});
test("defeat pays once and fight again works", async ({ page }) => {
  await launch(page);
  await click(page, "battle");
  await finish(page, false);
  const p = (await snapshot(page)).player;
  expect(p.gold).toBe(110);
  expect(p.xp).toBe(10);
  expect(p.progress).toBe(0);
  expect(p.rewarded).toHaveLength(1);
  await page.screenshot({ path: "test-results/screenshots/defeat.png" });
  await click(page, "again");
  await scene(page, "ArenaScene");
  expect((await snapshot(page)).player.gold).toBe(110);
});
test("keyboard, scene shutdown, gear, small viewport and portrait", async ({
  page,
}) => {
  await launch(page);
  await click(page, "shop");
  await click(page, "buy-cap");
  await click(page, "buy-shield");
  await click(page, "back");
  await click(page, "character");
  await click(page, "equip-cap");
  await click(page, "equip-shield");
  await page.screenshot({ path: "test-results/screenshots/equipment.png" });
  await page.keyboard.press("Escape");
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
  await page.screenshot({
    path: "test-results/screenshots/small-landscape.png",
  });
  const box = await page.locator("canvas").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(960);
  expect(box!.height).toBeLessThanOrEqual(600);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#rotate")).toBeVisible();
  await expect(page.locator("#rotate")).toContainText("Rotate your device");
  await page.screenshot({ path: "test-results/screenshots/portrait.png" });
});

test("default renderer starts without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await scene(page, "MainMenuScene");
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({
    path: "test-results/screenshots/default-renderer.png",
  });
  expect(errors).toEqual([]);
});

test("attribute allocation and all equipment persist through battle initialization", async ({
  page,
}) => {
  await launch(page);
  // A valid earned-progress fixture keeps this test focused on the character UI.
  const p = (await snapshot(page)).player;
  p.points = 2;
  p.level = 2;
  p.gold = 500;
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
  for (const id of ["iron", "plate", "cap", "shield"])
    await click(page, `buy-${id}`);
  await page.screenshot({ path: "test-results/screenshots/shop.png" });
  await click(page, "back");
  await click(page, "character");
  for (const id of ["iron", "plate", "cap", "shield"])
    await click(page, `equip-${id}`);
  await click(page, "attribute-vitality");
  await click(page, "attribute-strength");
  expect((await snapshot(page)).player.attributes.vitality).toBe(11);
  expect((await snapshot(page)).player.points).toBe(0);
  await page.screenshot({
    path: "test-results/screenshots/full-equipment.png",
  });
  await page.reload();
  await scene(page, "MainMenuScene");
  await click(page, "battle");
  expect((await snapshot(page)).battle!.player.hp).toBe(104);
  expect((await snapshot(page)).battle!.player.model.equipment.weapon).toBe(
    "iron",
  );
  await page.screenshot({
    path: "test-results/screenshots/equipped-arena.png",
  });
});

test("style studio preserves progress, previews motion, and restores the original", async ({
  page,
}) => {
  await launch(page);
  const before = (await snapshot(page)).player;
  await click(page, "studio");
  await scene(page, "StyleStudioScene");
  await page.screenshot({
    path: "test-results/screenshots/style-comparison.png",
  });
  await click(page, "preview-gear");
  await page.screenshot({
    path: "test-results/screenshots/style-unarmored.png",
  });
  await click(page, "preview-heavy");
  await page.waitForTimeout(250);
  await expectPreviewFits(page);
  await page.screenshot({ path: "test-results/screenshots/style-heavy.png" });
  await click(page, "preview-hit");
  await click(page, "preview-defend");
  await click(page, "preview-recover");
  await click(page, "preview-death");
  await page.waitForTimeout(1200);
  await expectPreviewFits(page);
  await page.screenshot({ path: "test-results/screenshots/style-death.png" });
  await click(page, "preview-victory");
  await page.waitForTimeout(1400);
  await expectPreviewFits(page);
  await page.screenshot({ path: "test-results/screenshots/style-victory.png" });
  await click(page, "preview-idle");
  await click(page, "preview-mirror");
  await page.screenshot({
    path: "test-results/screenshots/style-mirrored.png",
  });
  await click(page, "style-bronze");
  expect((await snapshot(page)).player).toEqual(before);
  await page.reload();
  await scene(page, "MainMenuScene");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("arena-of-ash.presentation.v1"),
    ),
  ).toBe("bronze");
  await click(page, "battle");
  await click(page, "quick");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.stamina)
    .toBe(88);
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("PlayerTurn");
  await page.screenshot({ path: "test-results/screenshots/bronze-arena.png" });
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  await click(page, "studio");
  await click(page, "style-ash");
  await click(page, "back");
  await scene(page, "MainMenuScene");
  await click(page, "battle");
  await click(page, "heavy");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.stamina)
    .toBe(75);
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("PlayerTurn");
  await page.screenshot({ path: "test-results/screenshots/ash-arena.png" });
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  await click(page, "studio");
  await click(page, "style-original");
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player).toEqual(before);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("arena-of-ash.presentation.v1"),
    ),
  ).toBe("original");
});

for (const style of ["bronze", "ash"] as const) {
  test(`${style} killing blow completes its new death animation`, async ({
    page,
  }) => {
    await launch(page);
    // An allocated high-level fixture isolates the presentation of a killing blow.
    // The normal starter victory/defeat cases above still play entire battles.
    const p = (await snapshot(page)).player;
    p.level = 46;
    p.attributes.strength = 100;
    await page.evaluate(
      ({ p, style }) => {
        localStorage.setItem(
          "arena-of-ash.v1",
          JSON.stringify({ version: 1, player: p }),
        );
        localStorage.setItem("arena-of-ash.presentation.v1", style);
      },
      { p, style },
    );
    await page.reload();
    await scene(page, "MainMenuScene");
    await click(page, "battle");
    await click(page, "quick");
    await expect
      .poll(async () => (await snapshot(page)).battle?.enemy.hp)
      .toBe(0);
    await page.waitForTimeout(1100);
    await page.screenshot({
      path: `test-results/screenshots/${style}-death-arena.png`,
    });
    await scene(page, "ResultScene");
    expect((await snapshot(page)).player.rewarded).toHaveLength(1);
    expect((await snapshot(page)).player.gold).toBe(150);
  });
}

function expectAnatomicalRig(rig: RigMeasurement) {
  const length = (a: Point, b: Point) =>
    Math.hypot(a.x - b.x, a.y - b.y) / rig.scale;
  expect(rig.physical).toBe(true);
  for (const side of [rig.near, rig.far]) {
    expect(length(side.hip, side.knee)).toBeCloseTo(54, 3);
    expect(length(side.knee, side.ankle)).toBeCloseTo(52, 3);
    expect(length(side.shoulder, side.elbow)).toBeCloseTo(40, 3);
    expect(length(side.elbow, side.hand)).toBeCloseTo(34, 3);
    expect(side.toe.y).toBeCloseTo(side.heel.y, 3);
  }
}
test("grounded limbs keep fixed lengths, level soles, a planted rear foot, and an actual front step", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  let s = await snapshot(page);
  expect(s.motion).toBe("grounded");
  s.rigs!.forEach(expectAnatomicalRig);
  const initial = s.rigs![0];
  await page.waitForTimeout(300);
  s = await snapshot(page);
  expect(s.rigs![0].far.heel.y).toBeCloseTo(initial.far.heel.y, 3);
  expect(s.rigs![0].near.heel.y).toBeCloseTo(initial.near.heel.y, 3);
  await page.screenshot({ path: "test-results/screenshots/anatomy-idle.png" });
  await click(page, "heavy");
  let lifted = false;
  for (let frame = 0; frame < 16; frame++) {
    s = await snapshot(page);
    const rig = s.rigs![0];
    expectAnatomicalRig(rig);
    expect(rig.far.heel.x).toBeCloseTo(initial.far.heel.x, 3);
    expect(rig.far.heel.y).toBeCloseTo(initial.far.heel.y, 3);
    expect(rig.near.heel.y).toBeLessThanOrEqual(initial.near.heel.y + 0.01);
    if (rig.near.heel.y < initial.near.heel.y - 2) lifted = true;
    if ([2, 5, 8, 12].includes(frame))
      await page.screenshot({
        path: `test-results/screenshots/anatomy-heavy-${frame}.png`,
      });
    await page.waitForTimeout(65);
  }
  expect(lifted).toBe(true);
  await expect
    .poll(async () => (await snapshot(page)).battle?.state, { timeout: 15000 })
    .toBe("PlayerTurn");
  const end = (await snapshot(page)).rigs![0];
  expect(end.near.heel.x).toBeCloseTo(initial.near.heel.x, 3);
  expect(end.far.heel.x).toBeCloseTo(initial.far.heel.x, 3);
});

test("Legacy restores every previous rig and motion without changing progress", async ({
  page,
}) => {
  await launch(page);
  const player = (await snapshot(page)).player;
  await click(page, "studio");
  await click(page, "preview-motion");
  expect((await snapshot(page)).motion).toBe("legacy");
  await expect
    .poll(async () =>
      (await snapshot(page)).preview?.rigs.every((r) => !r.physical),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/anatomy-legacy.png",
  });
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).motion).toBe("legacy");
  await click(page, "studio");
  await click(page, "preview-motion");
  expect((await snapshot(page)).motion).toBe("grounded");
  expect((await snapshot(page)).preview!.rigs.every((r) => r.physical)).toBe(
    true,
  );
  await click(page, "preview-mirror");
  await page.screenshot({
    path: "test-results/screenshots/anatomy-mirrored.png",
  });
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).motion).toBe("grounded");
  expect((await snapshot(page)).player).toEqual(player);
});
