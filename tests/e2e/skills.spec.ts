import type { CombatGeometry } from "../../src/combat/geometry";
import { test, expect, type Page } from "@playwright/test";
import { createPlayer, type Player } from "../../src/domain/model";
import { allSkillIds } from "../../src/domain/skills";
import live from "../../public/content/items.json" with { type: "json" };
import type { ArenaFighter, ContactEvent } from "../../src/combat/realtime";
interface State {
  scene: string;
  geometry?: CombatGeometry[];
  player: Player;
  lockedSkill?: string;
  hitStop?: { enabled: boolean; duration: number };
  autoBattle?: boolean;
  buttons: Record<string, { x: number; y: number }>;
  skills?: { id: number; status: string }[];
  rigs?: {
    animation: string;
    shield: boolean;
    painRemaining: number;
    shieldAttachment?: { hand: string; farthest: boolean };
  }[];
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
test("training offers two stable random skills and learns immediately without confirmation", async ({
  page,
}) => {
  await load(page, afterBattle());
  await expectScene(page, "ResultScene");
  const offers = (await snapshot(page)).player.postBattle!.offers!;
  expect(offers).toHaveLength(2);
  await click(page, "learn-skill");
  await expectScene(page, "SkillScene");
  expect((await snapshot(page)).skills!.map((s) => s.id)).toEqual(offers);
  await page.screenshot({
    path: "test-results/screenshots/two-random-skills.png",
  });
  await page.reload();
  await expectScene(page, "SkillScene");
  expect((await snapshot(page)).skills!.map((s) => s.id)).toEqual(offers);
  await click(page, `skill-${offers[0]}`);
  await expectScene(page, "MainMenuScene");
  expect((await snapshot(page)).buttons["confirm-skill"]).toBeUndefined();
  await page.reload();
  await expectScene(page, "MainMenuScene");
  const s = await snapshot(page);
  expect(s.player.skills).toEqual([offers[0]]);
  expect(s.player.postBattle?.completed).toBe(true);
  expect(s.player.rewarded).toEqual(["completed-battle"]);
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
  expect(s.player.equipment).toEqual({});
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
test("passive rear shield stays behind the body and active skills retain weapon use", async ({
  page,
}) => {
  const p = createPlayer();
  p.skills = [...allSkillIds];
  p.inventory.push("shield", "cuirass", "closed-helm");
  p.equipment = {
    rightHand: "shield",
    leftHand: "wood",
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
  expect((await snapshot(page)).battle!.player.guard).toBe(false);
  expect((await snapshot(page)).rigs![0].shieldAttachment).toMatchObject({
    hand: "rear",
    farthest: true,
  });
  await page.screenshot({
    path: "test-results/screenshots/passive-rear-shield.png",
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

test("live hit-pause settings do not take control or queue attacks", async ({
  page,
}) => {
  await load(page);
  await page.goto("/?seed=42&renderer=canvas");
  await expectScene(page, "MainMenuScene");
  await click(page, "battle");
  await expectScene(page, "ArenaScene");
  expect((await snapshot(page)).autoBattle).toBe(true);
  expect((await snapshot(page)).hitStop).toEqual({
    enabled: true,
    duration: 200,
  });
  await click(page, "hit-stop-more");
  expect((await snapshot(page)).hitStop?.duration).toBe(250);
  await click(page, "hit-stop-toggle");
  expect((await snapshot(page)).hitStop?.enabled).toBe(false);
  expect((await snapshot(page)).autoBattle).toBe(true);
  await click(page, "hit-stop-less");
  expect((await snapshot(page)).hitStop?.duration).toBe(200);
  await page.screenshot({
    path: "test-results/screenshots/live-hit-pause-controls.png",
  });
});

test("tower shield retains its rear wrist attachment and farthest layer during movement and jumps", async ({
  page,
}) => {
  const p = createPlayer();
  p.skills = [10, 18];
  p.inventory.push("tower");
  p.equipment = { rightHand: "tower", leftHand: "wood" };
  await page.clock.install();
  await load(page, p);
  await expectScene(page, "MainMenuScene");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  await click(page, "battle");
  await page.clock.runFor(40);
  for (const stage of ["stand", "walk", "jump"] as const) {
    if (stage === "walk") {
      await page.keyboard.down("d");
      await page.clock.runFor(200);
      await page.keyboard.up("d");
    }
    if (stage === "jump") {
      await page.keyboard.press("Space");
      await page.clock.runFor(180);
    }
    const s = await snapshot(page);
    expect(s.battle!.player.model.equipment).toEqual({
      rightHand: "tower",
      leftHand: "wood",
    });
    expect(s.rigs![0].shieldAttachment).toMatchObject({
      hand: "rear",
      farthest: true,
    });
    const surface = s.geometry![0].shield!;
    expect(Math.max(surface.a.y, surface.b.y) + surface.radius).toBeLessThan(
      551,
    );
    await page.screenshot({
      path: `test-results/screenshots/tower-shield-${stage}.png`,
    });
  }
});
