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
interface Snapshot {
  scene: string;
  player: Player;
  buttons: Record<string, { x: number; y: number }>;
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
