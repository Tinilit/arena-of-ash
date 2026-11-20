import { test, expect, type Page } from "@playwright/test";
import live from "../../public/content/items.json" with { type: "json" };
import type { ArenaFighter, ContactEvent } from "../../src/combat/realtime";
interface State {
  scene: string;
  buttons: Record<string, { x: number; y: number }>;
  rigs: { painRemaining: number; animation: string }[];
  battle: {
    player: ArenaFighter;
    enemy: ArenaFighter;
    contacts: ContactEvent[];
  };
}
const snapshot = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __arena: { snapshot: () => State } }
    ).__arena.snapshot(),
  );
test("real weapon damage closes the eyes during hit pause and the expression recovers", async ({
  page,
}) => {
  await page.clock.install();
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: live }),
  );
  await page.goto("/?seed=42&renderer=canvas");
  await page.waitForFunction(() => "__arena" in window);
  await expect
    .poll(async () => (await snapshot(page))?.scene)
    .toBe("MainMenuScene");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  const button = (await snapshot(page)).buttons.battle;
  await page.mouse.click(button.x, button.y);
  await page.clock.runFor(30);
  await expect
    .poll(async () => (await snapshot(page))?.scene)
    .toBe("ArenaScene");
  let state = await snapshot(page);
  for (
    let i = 0;
    i < 120 && !state.rigs.some((r) => r.painRemaining > 300);
    i++
  ) {
    await page.clock.runFor(100);
    state = await snapshot(page);
  }
  const index = state.rigs.findIndex((r) => r.painRemaining > 300);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(state.battle.contacts.some((c) => c.damage > 0)).toBe(true);
  await page.clock.runFor(40);
  state = await snapshot(page);
  expect(state.rigs[index].painRemaining).toBeGreaterThan(150);
  expect(state.rigs[index].painRemaining).toBeLessThan(386);
  await page.screenshot({
    path: "test-results/screenshots/pain-closed-eyes.png",
  });
  const before = index === 0 ? state.battle.player : state.battle.enemy;
  await page.clock.runFor(20);
  state = await snapshot(page);
  const paused = index === 0 ? state.battle.player : state.battle.enemy;
  expect(paused.x).toBeCloseTo(before.x, 3);
  await page.keyboard.press("b"); // Manual mode prevents a new player swing.
  await page.keyboard.down("a");
  await page.clock.runFor(1500);
  await page.keyboard.up("a");
  expect((await snapshot(page)).rigs[index].painRemaining).toBe(0);
  await page.screenshot({
    path: "test-results/screenshots/pain-expression-recovered.png",
  });
});
