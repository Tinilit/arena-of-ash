import { test, expect, type Page } from "@playwright/test";
import { createPlayer, type Player } from "../../src/domain/model";
import { allSkillIds } from "../../src/domain/skills";
import live from "../../public/content/items.json" with { type: "json" };
import type { ArenaFighter, ContactEvent } from "../../src/combat/realtime";
interface State {
  scene: string;
  player: Player;
  lockedSkill?: string;
  autoBattle?: boolean;
  buttons: Record<string, { x: number; y: number }>;
  skills?: { id: number; status: string }[];
  rigs?: { animation: string; shield: boolean }[];
  battle?: {
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
async function click(page: Page, id: string) {
  const state = await snapshot(page),
    b = state.buttons[id];
  expect(b, `Missing ${id} in ${state.scene}`).toBeTruthy();
  const rect = await page.locator("canvas").boundingBox();
  await page.mouse.click(
    rect!.x + (b.x * rect!.width) / 1280,
    rect!.y + (b.y * rect!.height) / 720,
  );
  await page.waitForTimeout(100);
}
async function expectScene(page: Page, key: string) {
  await expect.poll(async () => (await snapshot(page))?.scene).toBe(key);
}
async function load(page: Page, p?: Player, version = 4) {
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: live }),
  );
  if (p)
    await page.addInitScript(
      ({ p, version }) => {
        if (!localStorage.getItem("arena-of-ash.v3"))
          localStorage.setItem(
            "arena-of-ash.v3",
            JSON.stringify({ version, player: p }),
          );
      },
      { p, version },
    );
  await page.goto("/?seed=42&renderer=canvas&ai=training&manual=1");
  await page.waitForFunction(() => "__arena" in window);
  await expect
    .poll(async () => Boolean((await snapshot(page))?.scene))
    .toBe(true);
}
function afterBattle(outcome: "Victory" | "Defeat" = "Victory") {
  const p = createPlayer();
  p.rewarded = ["completed-battle"];
  p.gold = 300;
  p.postBattle = {
    battleId: "completed-battle",
    outcome,
    opponent: "Arena Opponent",
    gold: outcome === "Victory" ? 50 : 10,
    choice: "pending",
    consumed: false,
    completed: false,
  };
  return p;
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test("fresh gladiator has basic combat only, locked notifications, no free shop and no reward on abandonment", async ({
  page,
}) => {
  await load(page);
  await expectScene(page, "MainMenuScene");
  expect((await snapshot(page)).player.skills).toEqual([]);
  expect((await snapshot(page)).buttons.shop).toBeUndefined();
  await click(page, "battle");
  await expectScene(page, "ArenaScene");
  await page.keyboard.press("f");
  expect((await snapshot(page)).lockedSkill).toBe("Kicking");
  expect((await snapshot(page)).battle!.player.bodyAction).toBeNull();
  await page.keyboard.press("h");
  await page.keyboard.press("c");
  await page.keyboard.press("z");
  expect((await snapshot(page)).battle!.player.grapple).toBeUndefined();
  expect((await snapshot(page)).battle!.player.parry).toBeNull();
  expect((await snapshot(page)).battle!.player.rageUsed).not.toBe(true);
  await page.keyboard.press("k");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.action?.name)
    .toBe("quick");
  await page.screenshot({
    path: "test-results/screenshots/basic-gladiator-skills.png",
  });
  await page.keyboard.press("Escape");
  await expectScene(page, "MainMenuScene");
  expect((await snapshot(page)).player.postBattle).toBeUndefined();
  expect((await snapshot(page)).player.rewarded).toEqual([]);
});
test("post-victory training displays 17 skills, prerequisites and confirmation, and survives reload without duplicates", async ({
  page,
}) => {
  await load(page, afterBattle());
  await expectScene(page, "ResultScene");
  await page.reload();
  await expectScene(page, "ResultScene");
  await click(page, "learn-skill");
  await expectScene(page, "SkillScene");
  let s = await snapshot(page);
  expect(s.skills).toHaveLength(17);
  expect(
    s.skills!.filter((s) => s.status === "locked").map((s) => s.id),
  ).toEqual([14, 16]);
  await page.screenshot({
    path: "test-results/screenshots/skill-selection-grid.png",
  });
  await click(page, "skill-14");
  expect((await snapshot(page)).buttons["confirm-skill"]).toBeUndefined();
  await click(page, "skill-3");
  await click(page, "cancel-skill");
  expect((await snapshot(page)).player.skills).toEqual([]);
  await page.reload();
  await expectScene(page, "SkillScene");
  await click(page, "skill-3");
  await page.screenshot({
    path: "test-results/screenshots/skill-learn-confirmation.png",
  });
  await click(page, "confirm-skill");
  await expectScene(page, "MainMenuScene");
  await page.reload();
  await expectScene(page, "MainMenuScene");
  s = await snapshot(page);
  expect(s.player.skills).toEqual([3]);
  expect(s.player.postBattle?.completed).toBe(true);
  expect(s.player.rewarded).toEqual(["completed-battle"]);
  expect(s.buttons.shop).toBeUndefined();
  await click(page, "battle");
  await page.keyboard.press("f");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.action?.name)
    .toBe("kick");
});
test("post-defeat shop visit is exclusive, survives reload, supports sales, and closes permanently", async ({
  page,
}) => {
  const p = afterBattle("Defeat");
  p.inventory.push("rust");
  await load(page, p);
  await expectScene(page, "ResultScene");
  await click(page, "visit-shop");
  await expectScene(page, "ShopScene");
  await page.reload();
  await expectScene(page, "ShopScene");
  expect((await snapshot(page)).player.skills).toEqual([]);
  expect((await snapshot(page)).player.postBattle?.consumed).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/skill-locked-shop-items.png",
  });
  await click(page, "sell-equipment");
  await expectScene(page, "CharacterScene");
  await click(page, "sell-rust");
  expect((await snapshot(page)).player.gold).toBe(320);
  await click(page, "back");
  await expectScene(page, "ShopScene");
  await click(page, "back");
  await expectScene(page, "MainMenuScene");
  await page.reload();
  await expectScene(page, "MainMenuScene");
  expect((await snapshot(page)).player.postBattle?.completed).toBe(true);
  await click(page, "character");
  expect(
    Object.keys((await snapshot(page)).buttons).some((b) =>
      b.startsWith("sell-"),
    ),
  ).toBe(false);
});
test("old saves keep possessions but migrate to zero skills and unequip restricted equipment", async ({
  page,
}) => {
  const p = createPlayer();
  p.gold = 756;
  p.progress = 7;
  p.inventory.push("crossbow", "cuirass");
  p.skills = [...allSkillIds];
  p.equipment = { rightHand: "crossbow", body: "cuirass" };
  await load(page, p, 3);
  await expectScene(page, "MainMenuScene");
  const s = await snapshot(page);
  expect(s.player.skills).toEqual([]);
  expect(s.player.gold).toBe(756);
  expect(s.player.progress).toBe(7);
  expect(s.player.inventory).toContain("crossbow");
  expect(s.player.equipment).toEqual({ body: "cuirass" });
  await click(page, "character");
  await click(page, "equip-crossbow");
  expect((await snapshot(page)).player.equipment.rightHand).toBeUndefined();
  await page.screenshot({
    path: "test-results/screenshots/skill-locked-inventory.png",
  });
});
test("all skills learned leaves only a shop choice, and reset clears the entire skill progression", async ({
  page,
}) => {
  const p = afterBattle();
  p.skills = [...allSkillIds];
  await load(page, p);
  await expectScene(page, "ResultScene");
  expect((await snapshot(page)).buttons["learn-skill"]).toBeUndefined();
  await click(page, "visit-shop");
  await click(page, "back");
  await expectScene(page, "MainMenuScene");
  await click(page, "reset");
  await click(page, "resetYes");
  expect((await snapshot(page)).player.skills).toEqual([]);
  expect((await snapshot(page)).player.postBattle).toBeUndefined();
  expect((await snapshot(page)).player.inventory).toEqual(["wood"]);
});
test("learned active skills animate a real shield, rage and a forward aerial weapon strike", async ({
  page,
}) => {
  const p = createPlayer();
  p.skills = [...allSkillIds];
  p.inventory.push("shield", "cuirass", "closed-helm");
  p.equipment = {
    rightHand: "wood",
    leftHand: "shield",
    body: "cuirass",
    helmet: "closed-helm",
  };
  await page.clock.install();
  await load(page, p);
  await expectScene(page, "MainMenuScene");
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  expect((await snapshot(page)).rigs![0].shield).toBe(true);
  await page.keyboard.down("s");
  await page.clock.runFor(120);
  expect((await snapshot(page)).battle!.player.guard).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/shield-block-pose.png",
  });
  await page.keyboard.up("s");
  await page.keyboard.press("Control+z");
  await page.clock.runFor(50);
  expect((await snapshot(page)).battle!.player.rageUsed).not.toBe(true);
  await page.keyboard.press("z");
  await page.clock.runFor(100);
  expect((await snapshot(page)).battle!.player.rageRemaining).toBeGreaterThan(
    7800,
  );
  await page.keyboard.press("t");
  await page.clock.runFor(200);
  const s = await snapshot(page);
  expect(s.battle!.player.action?.name).toBe("superman");
  expect(s.battle!.player.y).toBeLessThan(-20);
  expect(s.battle!.player.vx).toBeGreaterThan(300);
  await page.screenshot({
    path: "test-results/screenshots/superman-weapon-strike.png",
  });
});
