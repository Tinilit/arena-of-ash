import { test, expect, type Page } from "@playwright/test";
import { createPlayer, type Player } from "../../src/domain/model";
import { allSkillIds } from "../../src/domain/skills";
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
  skills?: { id: number; name: string }[];
  shop?: {
    items: string[];
    category: string;
    page: number;
    usableOnly: boolean;
  };
  rigs?: {
    animation: string;
    drinking: boolean;
    expression: { enraged: boolean; eyeColor: number; mouth: string };
    origin: Point;
    far: { hand: Point; shoulder: Point };
    shieldAttachment: { hand: string; farthest: boolean };
  }[];
  battle?: { player: ArenaFighter; enemy: ArenaFighter };
}
const snapshot = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __arena: { snapshot: () => State } }
    ).__arena.snapshot(),
  );
async function click(page: Page, id: string, controlled = false) {
  const s = await snapshot(page),
    b = s.buttons[id];
  expect(b, `${id} in ${s.scene}`).toBeTruthy();
  const r = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(
    r.x + (b.x * r.width) / 1280,
    r.y + (b.y * r.height) / 720,
  );
  if (controlled) await page.clock.runFor(50);
  else
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
}
async function load(page: Page, p: Player, seed = 42, training = true) {
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: live }),
  );
  await page.addInitScript((p) => {
    if (!localStorage.getItem("arena-of-ash.v3"))
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 4, player: p }),
      );
  }, p);
  await page.goto(
    `/?seed=${seed}&renderer=canvas&manual=1${training ? "&ai=training" : ""}`,
  );
  await page.waitForFunction(() => "__arena" in window);
  await expect
    .poll(async () => (await snapshot(page))?.scene)
    .toBe(p.postBattle?.choice === "shop" ? "ShopScene" : "MainMenuScene");
}
function shopPlayer() {
  const p = createPlayer();
  p.gold = 2000;
  p.rewarded = ["shop-fixture"];
  p.postBattle = {
    battleId: "shop-fixture",
    outcome: "Victory",
    opponent: "Shop fixture",
    gold: 0,
    choice: "shop",
    consumed: true,
    completed: false,
  };
  return p;
}
test("checkbox shows skill-allowed stock and survives categories, purchases, quantity changes and inventory", async ({
  page,
}) => {
  const p = shopPlayer();
  p.skills = [8, 9, 10, 18];
  await load(page, p);
  expect((await snapshot(page)).scene).toBe("ShopScene");
  expect((await snapshot(page)).shop!.items).toContain("greatsword");
  await click(page, "shop-usable-only");
  let s = await snapshot(page);
  expect(s.shop!.usableOnly).toBe(true);
  expect(s.shop!.items).not.toContain("greatsword");
  expect(s.shop!.items).not.toContain("throwing-knife");
  expect(s.shop!.items).toContain("crossbow");
  await click(page, "buy-crossbow");
  expect((await snapshot(page)).player.inventory).toContain("crossbow");
  expect((await snapshot(page)).shop!.usableOnly).toBe(true);
  await click(page, "shop-armor");
  expect((await snapshot(page)).shop!.items).toContain("tower");
  await click(page, "shop-misc");
  await click(page, "quantity-5");
  await click(page, "buy-healing-potion");
  s = await snapshot(page);
  expect(s.player.quantities!["healing-potion"]).toBe(5);
  expect(s.shop!.usableOnly).toBe(true);
  await click(page, "sell-equipment");
  await click(page, "back");
  expect((await snapshot(page)).shop!.usableOnly).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/shop-skill-checkbox.png",
  });
  await click(page, "shop-usable-only");
  expect((await snapshot(page)).shop!.usableOnly).toBe(false);
  await click(page, "shop-weapons");
  expect((await snapshot(page)).shop!.items).toContain("greatsword");
});
test("basic gladiator's filtered Misc category has a safe empty state", async ({
  page,
}) => {
  await load(page, shopPlayer());
  await click(page, "shop-usable-only");
  await click(page, "shop-misc");
  const s = await snapshot(page);
  expect(s.shop!.items).toEqual([]);
  expect(s.shop!.page).toBe(0);
  expect(Object.keys(s.buttons).some((id) => id.startsWith("buy-"))).toBe(
    false,
  );
  await page.screenshot({
    path: "test-results/screenshots/shop-filter-empty-state.png",
  });
});
for (const learned of [
  [],
  [3, 9],
  [...allSkillIds],
] as (typeof allSkillIds)[]) {
  test(`Gladiator contains only ${learned.length} learned skills and camp has no Skills tab`, async ({
    page,
  }) => {
    const p = createPlayer();
    p.skills = learned;
    await load(page, p);
    expect((await snapshot(page)).buttons.skills).toBeUndefined();
    await click(page, "character");
    const s = await snapshot(page);
    expect(s.skills!.map((s) => s.id)).toEqual(learned);
    expect(s.player.skills).toEqual(learned);
    await page.screenshot({
      path: `test-results/screenshots/gladiator-learned-skills-${learned.length}.png`,
    });
  });
}
test("Rage braces and roars, keeps red eyes and a snarl, then restores the neutral face", async ({
  page,
}) => {
  await page.clock.install();
  const p = createPlayer();
  p.skills = [11];
  await load(page, p);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  await click(page, "battle", true);
  await page.clock.runFor(40);
  await page.keyboard.press("z");
  await page.clock.runFor(310);
  let s = await snapshot(page);
  expect(s.rigs![0].animation).toBe("rage");
  expect(s.rigs![0].expression).toMatchObject({
    enraged: true,
    eyeColor: 0xff3428,
    mouth: "roar",
  });
  await page.screenshot({
    path: "test-results/screenshots/rage-activation-roar.png",
  });
  await page.clock.runFor(600);
  s = await snapshot(page);
  expect(s.rigs![0].expression).toMatchObject({
    enraged: true,
    eyeColor: 0xff3428,
    mouth: "snarl",
  });
  await page.screenshot({
    path: "test-results/screenshots/rage-active-red-eyes.png",
  });
  await page.keyboard.down("a");
  await page.keyboard.down("Shift");
  await page.clock.runFor(7300);
  await page.keyboard.up("a");
  await page.keyboard.up("Shift");
  s = await snapshot(page);
  expect(s.battle!.player.rageRemaining).toBe(0);
  expect(s.rigs![0].expression).toMatchObject({
    enraged: false,
    eyeColor: 0x202c34,
  });
});
for (const shield of ["shield", "tower"]) {
  test(`${shield} returns in front after the full potion animation`, async ({
    page,
  }) => {
    await page.clock.install();
    const p = createPlayer();
    p.skills = [9, 10, 18];
    p.inventory.push(shield, "speed-potion");
    p.equipment = {
      rightHand: shield,
      leftHand: "wood",
      belt1: "speed-potion",
    };
    await load(page, p);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
    await click(page, "battle", true);
    await page.clock.runFor(40);
    await page.keyboard.press("q");
    await page.clock.runFor(2200);
    const s = await snapshot(page),
      f = s.battle!.player,
      r = s.rigs![0];
    expect(f.model.equipment.belt1).toBeUndefined();
    expect(f.speedRemaining).toBeGreaterThan(8500);
    expect(r.drinking).toBe(false);
    expect(r.shieldAttachment).toMatchObject({ hand: "rear", farthest: true });
    expect((r.far.hand.x - r.origin.x) * f.facing).toBeGreaterThan(10);
    expect((r.far.hand.x - r.far.shoulder.x) * f.facing).toBeGreaterThan(40);
    await page.screenshot({
      path: `test-results/screenshots/${shield}-after-potion.png`,
    });
  });
}
test("an enemy drinks its own potion and restores its shield wrist in front", async ({
  page,
}) => {
  await page.clock.install();
  const p = createPlayer();
  p.skills = [9, 10, 18];
  await load(page, p, 6, false);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  await click(page, "battle", true);
  await page.clock.runFor(40);
  expect((await snapshot(page)).battle!.enemy.model.equipment.rightHand).toBe(
    "shield",
  );
  expect((await snapshot(page)).battle!.enemy.handActions.rear?.name).toBe(
    "drink",
  );
  await page.clock.runFor(2200);
  const s = await snapshot(page),
    f = s.battle!.enemy,
    r = s.rigs![1];
  expect(f.model.equipment.belt1).toBeUndefined();
  expect(f.speedRemaining).toBeGreaterThan(8500);
  expect(r.drinking).toBe(false);
  expect(r.shieldAttachment).toMatchObject({ hand: "rear", farthest: true });
  expect((r.far.hand.x - r.origin.x) * f.facing).toBeGreaterThan(10);
  expect((r.far.hand.x - r.far.shoulder.x) * f.facing).toBeGreaterThan(40);
  await page.screenshot({
    path: "test-results/screenshots/enemy-shield-after-potion.png",
  });
});
