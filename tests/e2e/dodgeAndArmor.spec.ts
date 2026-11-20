import { test, expect, type Page } from "@playwright/test";
import { createPlayer, type Player } from "../../src/domain/model";
import type { ArenaFighter } from "../../src/combat/realtime";
import live from "../../public/content/items.json" with { type: "json" };
interface Point {
  x: number;
  y: number;
}
interface State {
  scene: string;
  player: Player;
  buttons: Record<string, Point>;
  battle?: {
    player: ArenaFighter;
    enemy: ArenaFighter;
    state: string;
    armorBreaks: { ownerId: string; itemId: string; slot: "helmet" | "body" }[];
  };
  rigs?: {
    origin: Point;
    near: { heel: Point; toe: Point; shoulder: Point };
    far: { heel: Point };
    armor: { helmet?: string; body?: string };
  }[];
}
const snapshot = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __arena: { snapshot: () => State } }
    ).__arena.snapshot(),
  );
async function load(page: Page, p: Player, catalog = live) {
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: catalog }),
  );
  await page.addInitScript((p) => {
    if (!localStorage.getItem("arena-of-ash.v3"))
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 4, player: p }),
      );
  }, p);
  await page.clock.install();
  await page.goto("/?seed=42&renderer=canvas&ai=training&manual=1");
  await page.waitForFunction(() => "__arena" in window);
  await expect
    .poll(async () => (await snapshot(page))?.scene)
    .toBe(p.postBattle ? "ShopScene" : "MainMenuScene");
}
async function click(page: Page, id: string) {
  // Let Phaser register newly created interactive objects before clicking.
  await page.clock.runFor(32);
  const s = await snapshot(page),
    p = s.buttons[id],
    b = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(
    b.x + (p.x * b.width) / 1280,
    b.y + (p.y * b.height) / 720,
  );
  await page.clock.runFor(50);
}
async function arena(page: Page, p = createPlayer(), catalog = live) {
  await load(page, p, catalog);
  await click(page, "battle");
  await expect
    .poll(async () => (await snapshot(page))?.scene)
    .toBe("ArenaScene");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
}
async function texts(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as {
        __arena: { display: () => { texts: { text: string }[] } };
      }
    ).__arena
      .display()
      .texts.map((t) => t.text),
  );
}

test("shop marks missing requirements with the short No skill notice", async ({
  page,
}) => {
  const p = createPlayer();
  p.gold = 2000;
  p.rewarded = ["shop"];
  p.postBattle = {
    battleId: "shop",
    outcome: "Victory",
    opponent: "Shop fixture",
    gold: 0,
    choice: "shop",
    consumed: true,
    completed: false,
  };
  await load(page, p);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  expect(
    (await texts(page)).filter((t) => t === "No skill").length,
  ).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/screenshots/shop-no-skill.png" });
  await click(page, "shop-usable-only");
  expect(await texts(page)).not.toContain("No skill");
  await click(page, "shop-armor");
  expect(await texts(page)).not.toContain("No skill");
});

test("S keeps the front foot planted, leans away and returns immediately into a rear-hand attack", async ({
  page,
}) => {
  await arena(page);
  const before = await snapshot(page),
    rig = before.rigs![0];
  await page.keyboard.press("s");
  await page.clock.runFor(180);
  let s = await snapshot(page);
  expect(s.battle!.player.dodge?.phase).toBe("lean");
  expect(s.battle!.player.x).toBeCloseTo(before.battle!.player.x, 6);
  expect(s.rigs![0].near.heel.x).toBeCloseTo(rig.near.heel.x, 1);
  expect(s.rigs![0].near.heel.y).toBeCloseTo(rig.near.heel.y, 1);
  expect(s.rigs![0].near.shoulder.x).toBeLessThan(rig.near.shoulder.x - 15);
  expect(s.rigs![0].far.heel.x).toBeLessThan(rig.far.heel.x - 25);
  await page.screenshot({ path: "test-results/screenshots/dodge-lean.png" });
  await page.keyboard.press("k");
  await page.clock.runFor(80);
  s = await snapshot(page);
  expect(s.battle!.player.dodge).toBeNull();
  expect(s.battle!.player.handActions.rear?.name).toBe("quick");
  expect(s.battle!.player.handActions.rear!.elapsed).toBeLessThan(60);
  await page.screenshot({
    path: "test-results/screenshots/dodge-counterattack.png",
  });
});

test("a second S retreats sharply on the ground and cannot retrigger from key auto-repeat", async ({
  page,
}) => {
  await arena(page);
  await page.keyboard.down("s");
  await page.clock.runFor(180);
  await page.keyboard.down("s");
  await page.clock.runFor(20);
  expect((await snapshot(page)).battle!.player.dodge?.phase).toBe("lean");
  await page.keyboard.up("s");
  await page.keyboard.press("s");
  await page.clock.runFor(150);
  let s = await snapshot(page);
  expect(s.battle!.player.dodge?.phase).toBe("retreat");
  expect(s.battle!.player.x).toBeLessThan(330);
  expect(s.battle!.player.y).toBe(0);
  expect(s.battle!.player.vy).toBe(0);
  await page.screenshot({ path: "test-results/screenshots/dodge-retreat.png" });
  await page.clock.runFor(200);
  s = await snapshot(page);
  expect(s.battle!.player.dodge).toBeNull();
  expect(s.battle!.player.x).toBeLessThan(270);
  expect(s.battle!.enemy.hp).toBe(100);
});

for (const exit of ["Escape", "Defeat", "Victory"] as const)
  test(`shattered armor stays absent after ${exit}, reload and the next match`, async ({
    page,
  }) => {
    const catalog = structuredClone(live);
    for (const item of catalog.items)
      if (item.slot === "weapon")
        item.attack = exit === "Defeat" ? 140 : exit === "Victory" ? 30 : 40;
    if (exit === "Victory")
      catalog.items.find((i) => i.id === "spear")!.attack = 200;
    catalog.items.find((i) => i.id === "closed-helm")!.armor = 0;
    catalog.items.find((i) => i.id === "cuirass")!.armor = 0;
    const p = createPlayer();
    p.skills = [18];
    p.inventory.push("closed-helm", "cuirass");
    p.equipment.helmet = "closed-helm";
    p.equipment.body = "cuirass";
    if (exit === "Victory") {
      p.inventory.push("spear");
      p.equipment.rightHand = "spear";
    }
    await arena(page, p, catalog);
    for (let elapsed = 0; elapsed < 15000; elapsed += 80) {
      const s = await snapshot(page);
      if (s.battle!.armorBreaks.some((e) => e.ownerId === p.id)) break;
      await page.clock.runFor(80);
    }
    let s = await snapshot(page);
    const broken = s.battle!.armorBreaks.find((e) => e.ownerId === p.id)!;
    expect(broken).toBeTruthy();
    expect(s.player.inventory).not.toContain(broken.itemId);
    expect(s.player.equipment[broken.slot]).toBeUndefined();
    expect(s.rigs![0].armor[broken.slot]).toBeUndefined();
    await page.screenshot({
      path: `test-results/screenshots/armor-broken-${exit}.png`,
    });
    if (exit === "Escape") {
      await page.keyboard.press("Escape");
      await page.clock.runFor(50);
    } else if (exit === "Defeat") {
      expect(s.battle!.state).toBe("Defeat");
      await page.clock.runFor(1600);
    } else {
      await page.clock.runFor(400);
      await page.keyboard.press("k");
      for (let elapsed = 0; elapsed < 3000; elapsed += 80) {
        if ((await snapshot(page)).battle!.state !== "Fighting") break;
        await page.clock.runFor(80);
      }
      expect((await snapshot(page)).battle!.state).toBe("Victory");
      await click(page, "finish-battle");
    }
    s = await snapshot(page);
    expect(s.scene).toBe(exit === "Escape" ? "MainMenuScene" : "ResultScene");
    expect(s.player.equipment[broken.slot]).toBeUndefined();
    await page.clock.resume();
    await page.reload();
    await expect
      .poll(async () => (await snapshot(page))?.scene)
      .toBe(exit === "Escape" ? "MainMenuScene" : "ResultScene");
    s = await snapshot(page);
    expect(s.player.inventory).not.toContain(broken.itemId);
    expect(s.player.equipment[broken.slot]).toBeUndefined();
    if (exit !== "Escape") {
      await click(page, "visit-shop");
      await click(page, "back");
    }
    await click(page, "battle");
    s = await snapshot(page);
    expect(s.battle!.player.model.equipment[broken.slot]).toBeUndefined();
    expect(s.rigs![0].armor[broken.slot]).toBeUndefined();
  });
