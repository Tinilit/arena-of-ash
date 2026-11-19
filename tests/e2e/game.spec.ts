import { test, expect, type Page } from "@playwright/test";
import liveItems from "../../public/content/items.json" with { type: "json" };
import bundled from "../fixtures/catalog.json" with { type: "json" };
import type { Player } from "../../src/domain/model";
import { createPlayer } from "../../src/domain/model";
import type { Projectile } from "../../src/combat/projectiles";
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
  armorDamage: { helmet: number; body: number };
  armorCracks: { helmet?: number; body?: number };
  alpha: number;
  armor: { helmet?: string; body?: string };
  crossbow: { loaded: boolean; draw: number; supportGrip: Point | null } | null;
  shooting: { kind: number; flash: boolean };
  twoHanded: {
    active: boolean;
    shoulderCarry: boolean;
    supportGrip: Point | null;
  };
  drinking: boolean;
  drink: { vialVisible: boolean; mouth: Point; neck: Point; base: Point };
  physical: boolean;
  primaryHand: "rear" | "front";
  animation: string;
  origin: Point;
  body: {
    layers: string[];
    rearHandPlane?: string;
    arms: string[];
    backArms: string[];
    frontArms: string[];
    waist: RigFrame;
    torso: RigFrame;
  };
  scale: number;
  shield: boolean;
  shieldAttachment: (Point & { behindBody: boolean }) | null;
  weapons: (Point & { texture: string | null; visible: boolean })[];
  belt: (Point & { slot: string })[];
  offhand: Point | null;
  throwing: {
    active: boolean;
    released: boolean;
    propVisible: boolean;
    headFront: boolean;
    hand: string;
  };
  near: Limb;
  far: Limb;
}
interface Snapshot {
  shop?: {
    category: string;
    page: number;
    items: string[];
    itemCategories: Record<string, string>;
  };
  aim?: Point;
  ladder?: {
    index: number;
    name: string;
    state: string;
    boss?: { name: string };
  }[];
  autoBattle?: boolean;
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
    armorBreaks: { ownerId: string; itemId: string; slot: string }[];
    contacts: ContactEvent[];
    projectiles: Projectile[];
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

test("chainmail, Roman legionary helm and two-handed trident equip with a true thrust", async ({
  page,
}) => {
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: liveItems }),
  );
  const p = createPlayer();
  p.gold = 2000;
  await savedFixture(page, p);
  await page.clock.install();
  await launch(page);
  expect((await snapshot(page)).player.inventory).toEqual(["wood"]);
  await click(page, "shop");
  await click(page, "shop-next");
  await click(page, "shop-next");
  for (const id of ["chainmail", "legionary-helm", "trident", "speed-potion"])
    await click(page, `buy-${id}`);
  expect((await snapshot(page)).player.gold).toBe(1520);
  await shot(page, "polearm-and-haste-shop");
  await click(page, "back");
  await click(page, "character");
  for (const id of ["chainmail", "legionary-helm", "trident", "speed-potion"])
    await click(page, `equip-${id}`);
  expect((await snapshot(page)).player.equipment).toMatchObject({
    rightHand: "trident",
    body: "chainmail",
    helmet: "legionary-helm",
    belt1: "speed-potion",
  });
  await shot(page, "legionary-mail-trident-loadout");
  await click(page, "back");
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  await page.clock.runFor(100);
  sharedGrip((await snapshot(page)).rigs![0]);
  await page.keyboard.press("k");
  const attackAt = async (elapsed: number) => {
    for (let i = 0; i < 50; i++) {
      await page.clock.runFor(50);
      const state = await snapshot(page);
      if (
        state.battle?.player.action?.name === "quick" &&
        state.battle.player.action.elapsed >= elapsed
      )
        return state;
    }
    throw Error(`Trident attack did not reach ${elapsed} ms`);
  };
  const drawn = (await attackAt(400)).rigs![0].weapons[0];
  await page.screenshot({
    path: "test-results/screenshots/trident-anticipation.png",
  });
  const s = await attackAt(625);
  sharedGrip(s.rigs![0]);
  expect(s.rigs![0].weapons[0].x - drawn.x).toBeGreaterThan(35);
  const blade = s.geometry![0].blade!;
  expect(Math.abs(blade.b.x - blade.a.x)).toBeGreaterThan(
    Math.abs(blade.b.y - blade.a.y) * 4,
  );
  await page.screenshot({
    path: "test-results/screenshots/trident-thrust.png",
  });
  await page.clock.resume();
});

test("haste drinks at full health, starts a ten-second timer and doubles movement without persisting the buff", async ({
  page,
}) => {
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: liveItems }),
  );
  const p = createPlayer();
  p.inventory.push("speed-potion", "chainmail", "legionary-helm");
  p.equipment = {
    rightHand: "wood",
    body: "chainmail",
    helmet: "legionary-helm",
    belt1: "speed-potion",
  };
  await savedFixture(page, p);
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  await page.keyboard.press("q");
  await page.clock.runFor(1200);
  let s = await snapshot(page);
  expect(s.battle!.player.speedRemaining).toBeGreaterThan(9900);
  expect(s.player.inventory).not.toContain("speed-potion");
  await page.screenshot({ path: "test-results/screenshots/haste-active.png" });
  await page.clock.runFor(600);
  const before = (await snapshot(page)).battle!.player.x;
  await page.keyboard.down("d");
  await page.clock.runFor(200);
  await page.keyboard.up("d");
  s = await snapshot(page);
  expect(s.battle!.player.x - before).toBeGreaterThan(38);
  expect(s.rigs![0].animation).toBe("walkForward");
  expect(s.battle!.player.speedRemaining).toBeLessThan(9300);
  await page.clock.resume();
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.inventory).not.toContain("speed-potion");
});

test("Auto Battle starts enabled, input takes control and B resumes full tactics", async ({
  page,
}) => {
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: liveItems }),
  );
  const p = createPlayer();
  p.inventory.push(
    "cuirass",
    "legionary-helm",
    "speed-potion",
    "throwing-knife",
  );
  p.equipment = {
    rightHand: "wood",
    body: "cuirass",
    helmet: "legionary-helm",
    belt1: "speed-potion",
    belt2: "throwing-knife",
  };
  await savedFixture(page, p);
  await page.clock.install();
  await page.goto("/?seed=42&renderer=canvas");
  await scene(page, "MainMenuScene");
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  await page.clock.runFor(100);
  expect((await snapshot(page)).autoBattle).toBe(true);
  await page.mouse.move(600, 350);
  await page.clock.runFor(32);
  expect((await snapshot(page)).autoBattle).toBe(true);
  await page.keyboard.press("z");
  await page.clock.runFor(32);
  expect((await snapshot(page)).autoBattle).toBe(false);
  await page.keyboard.press("b");
  await page.clock.runFor(32);
  expect((await snapshot(page)).autoBattle).toBe(true);
  const before = (await snapshot(page)).battle!.player.x;
  await page.keyboard.down("d");
  await page.clock.runFor(100);
  await page.keyboard.up("d");
  expect((await snapshot(page)).autoBattle).toBe(false);
  expect((await snapshot(page)).battle!.player.x).toBeGreaterThan(before);
  await page.keyboard.press("b");
  await page.clock.runFor(32);
  await page.mouse.click(600, 350, { button: "middle" });
  await page.clock.runFor(32);
  expect((await snapshot(page)).autoBattle).toBe(false);
  await page.keyboard.press("b");
  await page.clock.runFor(32);
  const observing = page.evaluate(
    () =>
      new Promise<{
        player: string[];
        enemy: string[];
        moved: boolean;
        damage: boolean;
      }>((resolve) => {
        const player = new Set<string>(),
          enemy = new Set<string>();
        let moved = false,
          damage = false;
        const end = performance.now() + 3750;
        const sample = () => {
          const s = (
            window as unknown as { __arena: { snapshot: () => Snapshot } }
          ).__arena.snapshot();
          if (s.battle) {
            for (const [f, set] of [
              [s.battle.player, player],
              [s.battle.enemy, enemy],
            ] as const) {
              if (f.action) set.add(f.action.name);
              if (f.parry) set.add("parry");
              if (f.grapple) set.add("grapple");
              if (f.hop) set.add(f.hop.kind);
            }
            moved ||= Math.abs(s.battle.player.x - 370) > 50;
            damage ||= s.battle.player.hp < 100 || s.battle.enemy.hp < 100;
          }
          if (performance.now() >= end)
            resolve({ player: [...player], enemy: [...enemy], moved, damage });
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
  await page.clock.runFor(3800);
  const observed = await observing;
  expect(observed.moved).toBe(true);
  expect(observed.damage).toBe(true);
  expect(observed.player.length).toBeGreaterThan(1);
  expect(observed.enemy.length).toBeGreaterThan(0);
  expect(observed.player).toContain("drink");
  await page.screenshot({
    path: "test-results/screenshots/auto-battle-live.png",
  });
  await page.clock.resume();
});
for (const boss of [
  { wins: 5, name: "Cassian the Red", size: 1.2, hp: 125 },
  { wins: 11, name: "Brakka Stonefist", size: 1.3, hp: 160 },
  { wins: 17, name: "Vesper Ashwind", size: 1.25, hp: 140 },
])
  test(`ladder encounter: ${boss.name} has a fixed loadout and a correctly scaled rig`, async ({
    page,
  }) => {
    await page.route("**/content/items.json?_=*", (r) =>
      r.fulfill({ json: liveItems }),
    );
    const p = createPlayer();
    p.progress = boss.wins;
    await savedFixture(page, p);
    await page.clock.install();
    await launch(page);
    if (boss.wins === 5) {
      await click(page, "ladder");
      const entries = (await snapshot(page)).ladder!;
      expect(entries).toHaveLength(18);
      expect(entries.filter((e) => e.boss).map((e) => e.name)).toEqual([
        "Cassian the Red",
        "Brakka Stonefist",
        "Vesper Ashwind",
      ]);
      expect(entries.filter((e) => e.state === "defeated")).toHaveLength(5);
      expect(entries.find((e) => e.state === "current")?.index).toBe(5);
      await shot(page, "arena-ladder");
      await click(page, "back");
    }
    await click(page, "battle");
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
    const state = await snapshot(page);
    expect(state.battle!.enemy.model.name).toBe(boss.name);
    expect(state.battle!.enemy.hp).toBe(boss.hp);
    expect(state.rigs![1].scale).toBeCloseTo(boss.size);
    expect(state.battle!.enemy.model.equipment.belt1).toBeTruthy();
    expect(state.battle!.enemy.model.equipment.belt2).toBeTruthy();
    anatomy(state.rigs![1], false);
    await page.screenshot({
      path: `test-results/screenshots/boss-${boss.wins + 1}.png`,
    });
    await page.clock.resume();
  });

test("mouse aiming rotates the held crossbow and launches a bolt toward the low cursor", async ({
  page,
}) => {
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: liveItems }),
  );
  const p = createPlayer();
  p.inventory.push("crossbow", "cuirass");
  p.equipment = { rightHand: "crossbow", body: "cuirass" };
  await savedFixture(page, p);
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  await page.clock.runFor(100);
  await page.mouse.move(170, 490);
  await page.clock.runFor(50);
  expect((await snapshot(page)).battle!.player.facing).toBe(-1);
  const target = { x: 850, y: 515 };
  await page.mouse.move(target.x, target.y);
  await page.clock.runFor(50);
  expect((await snapshot(page)).battle!.player.facing).toBe(1);
  await page.mouse.click(target.x, target.y, { button: "right" });
  let state = await snapshot(page);
  for (
    let i = 0;
    i < 24 && !state.battle!.projectiles.some((p) => p.kind === "bolt");
    i++
  ) {
    await page.clock.runFor(50);
    state = await snapshot(page);
  }
  expect(state.aim).toEqual(target);
  const bolt = state.battle!.projectiles.find((p) => p.kind === "bolt")!;
  expect(bolt).toBeTruthy();
  expect(bolt.vx).toBeGreaterThan(0);
  expect(bolt.vy).toBeGreaterThan(0);
  expect(state.autoBattle).toBe(false);
  const rig = state.rigs![0],
    support = rig.crossbow!.supportGrip!;
  expect(
    Math.hypot(support.x - rig.near.hand.x, support.y - rig.near.hand.y),
  ).toBeLessThan(0.1);
  anatomy(rig, false);
  await page.screenshot({
    path: "test-results/screenshots/crossbow-mouse-aim-down.png",
  });
  await page.clock.resume();
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
  let state = await snapshot(page);
  if (state.scene === "ShopScene" && id.startsWith("buy-") && state.shop) {
    const itemId = id.slice(4),
      category = state.shop.itemCategories[itemId];
    if (category && category !== state.shop.category)
      await click(page, `shop-${category}`);
    state = await snapshot(page);
    const targetPage = Math.floor(state.shop!.items.indexOf(itemId) / 8);
    while (category && state.shop!.page !== targetPage) {
      await click(
        page,
        state.shop!.page < targetPage ? "shop-next" : "shop-prev",
      );
      state = await snapshot(page);
    }
  }

  await expect
    .poll(async () => Boolean((await snapshot(page))?.buttons[id]), {
      timeout: 15000,
    })
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
  await frames(page);
}
async function launch(page: Page) {
  await page.goto("/?seed=42&renderer=canvas&ai=training&manual=1");
  await scene(page, "MainMenuScene");
}
async function steer(page: Page, state: Snapshot) {
  const { player, enemy } = state.battle!;
  const range = player.model.equipment.rightHand?.includes("spear") ? 170 : 120;
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
async function hitEnemy(page: Page) {
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
      await page.keyboard.press("k");
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
    if (s.buttons["finish-battle"]) {
      await page.keyboard.up("a");
      await page.keyboard.up("d");
      await click(page, "finish-battle");
      continue;
    }
    if (s.battle?.state === "Fighting" && attack) {
      const inRange = await steer(page, s);
      if (!s.battle.player.action) {
        if (inRange) await page.keyboard.press("k");
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
  // Owned armor keeps the victory reward scenario stable with equal baselines.
  const player = createPlayer();
  player.inventory.push("plate", "cap");
  player.equipment.body = "plate";
  player.equipment.helmet = "cap";
  await page.addInitScript((p) => {
    if (!localStorage.getItem("arena-of-ash.v3"))
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
      );
  }, player);
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  expect((await snapshot(page)).battle!.player.hp).toBe(100);
  expect((await snapshot(page)).battle!.enemy.hp).toBe(100);
  await shot(page, "arena");
  await page.keyboard.press("k");
  await page.waitForTimeout(720);
  expect((await snapshot(page)).battle!.enemy.hp).toBe(100);
  expect((await snapshot(page)).battle!.contacts).toHaveLength(0);
  await shot(page, "attack-missed-at-distance");
  const hit = await hitEnemy(page);
  expect(hit.damage).toBe(13);
  expect((await snapshot(page)).battle!.enemy.hp).toBe(100 - hit.damage);
  await finish(page);
  expect((await snapshot(page)).player.gold).toBe(150);
  expect((await snapshot(page)).player).not.toHaveProperty("xp");
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
  expect(p).not.toHaveProperty("level");
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
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
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
  await click(page, "shop-armor");
  await expect
    .poll(async () => Boolean((await snapshot(page)).buttons["buy-viking"]))
    .toBe(true);
  expect((await snapshot(page)).buttons["buy-glaives"]).toBeUndefined();
  await shot(page, "new-equipment-shop");
  await click(page, "buy-viking");
  await click(page, "buy-throwing-knife");
  await click(page, "buy-throwing-axe");
  await click(page, "buy-healing-potion");
  expect((await snapshot(page)).player.gold).toBe(315);
  expect((await snapshot(page)).player.inventory).toHaveLength(12);
  await click(page, "back");
  await click(page, "character");
  await click(page, "inventory-next");
  await click(page, "equip-throwing-knife");
  await click(page, "equip-throwing-axe");
  await click(page, "inventory-prev");
  await click(page, "slot-body");
  await click(page, "equip-plate");
  await click(page, "unequip-rightHand");
  await click(page, "slot-rightHand");
  await click(page, "equip-war-spear");
  await click(page, "slot-helmet");
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
  expect(hit.damage).toBe(22);
  await shot(page, "spear-thrust");
  await page.reload();
  await scene(page, "MainMenuScene");
  const loaded = (await snapshot(page)).player;
  expect(loaded.equipment).toEqual({
    rightHand: "war-spear",
    body: "plate",
    belt1: "throwing-knife",
    belt2: "throwing-axe",
    helmet: "viking",
  });
  expect(loaded.gold).toBe(315);
  expect(loaded.inventory).toHaveLength(12);
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
  await expect
    .poll(async () => (await snapshot(page)).battle!.player.x)
    .toBeGreaterThan(initial.origin.x + 10);
  const moving = await snapshot(page);
  expect(moving.battle!.player.x).toBeGreaterThan(initial.origin.x + 10);
  expect(moving.battle!.player.action?.name).toBe("quick");
  expect(moving.rigs![0].animation).toBe("quick");
  // Jump during the same wind-up, before approaching the opponent can cause a stun.
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await snapshot(page)).battle!.player.y)
    .toBeLessThan(-25);
  const jumping = await snapshot(page);
  expect(jumping.battle!.player.y).toBeLessThan(-25);
  expect(jumping.battle!.player.action?.name).toBe("quick");
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
    .toBe("quick");
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  await page.waitForTimeout(1300);
  await click(page, "battle");
  expect((await snapshot(page)).buttons.defend).toBeUndefined();
  expect((await snapshot(page)).buttons.recover).toBeUndefined();
  await page.keyboard.press("l");
  expect((await snapshot(page)).battle!.player.guard).toBe(false);
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
  expect((await snapshot(page)).player.inventory).toEqual(["wood"]);
  expect((await snapshot(page)).player.equipment).toEqual({
    rightHand: "wood",
  });
  expect((await snapshot(page)).rigs![0].belt).toEqual([]);
});
test("default renderer starts without errors", async ({ page }) => {
  await page.goto("/");
  await scene(page, "MainMenuScene");
  await expect(page.locator("canvas")).toBeVisible();
  expect((await snapshot(page)).style).toBe("ash");
  await shot(page, "default-renderer");
});

test("character has gear and health but no attributes, leveling or energy", async ({
  page,
}) => {
  await launch(page);
  const p = (await snapshot(page)).player;
  for (const key of ["attributes", "level", "xp", "points"])
    expect(p).not.toHaveProperty(key);
  await click(page, "character");
  const buttons = (await snapshot(page)).buttons;
  expect(Object.keys(buttons).some((key) => key.startsWith("attribute-"))).toBe(
    false,
  );
  await page.keyboard.press("Escape");
  await click(page, "battle");
  expect((await snapshot(page)).battle!.player).not.toHaveProperty("stamina");
  expect((await snapshot(page)).battle!.player.hp).toBe(100);
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
    count: live.items.length,
    failedImages: 0,
  });
  await click(page, "shop");
  await click(page, "shop-next");
  await click(page, "buy-runtime-spear");
  expect((await snapshot(page)).player.gold).toBe(75);
  await click(page, "back");
  await click(page, "character");
  await click(page, "unequip-rightHand");
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
  expect(firstHit.damage).toBe(24);
  expect((await snapshot(page)).content.revision).toBe("runtime-test-1");
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).content.revision).toBe("runtime-test-2");
  expect((await snapshot(page)).player.equipment.rightHand).toBe(
    "runtime-spear",
  );
  expect(
    imageRequests.some((url) =>
      url.includes("runtime-spear-v2.png?rev=runtime-test-2"),
    ),
  ).toBe(true);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  const secondHit = await hitEnemy(page);
  expect(secondHit.damage).toBe(30);
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
  expect(hit.damage).toBe(13);
});

test("shields are absent and the free front arm stays behind the torso while the armed rear arm renders in front", async ({
  page,
}) => {
  await page.clock.install();
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
  player.equipment = {
    rightHand: "war-spear",
    body: "plate",
    helmet: "viking",
  };
  await page.evaluate(
    (p) =>
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
      ),
    player,
  );
  await page.reload();
  await scene(page, "MainMenuScene");
  await frames(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const equippedFloor = (await snapshot(page)).rigs![0].near.heel.y;
  await page.keyboard.press("Space");
  await page.clock.runFor(500);
  const jumping = await snapshot(page);
  expect(jumping.rigs![0].near.heel.y).toBeLessThan(equippedFloor - 25);
  expect(jumping.previewBounds!.y).toBeGreaterThan(270);
  await page.screenshot({
    path: "test-results/screenshots/camp-equipped-jump.png",
  });
  await page.clock.runFor(800);
  expect((await snapshot(page)).rigs![0].animation).toBe("idleRelaxed");
  await page.clock.resume();
  await click(page, "character");
  await scene(page, "CharacterScene");
  await shot(page, "rig-armored-character");
  await click(page, "back");
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await shot(page, "rig-armored-both-facing");
  await page.keyboard.press("k");
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
  await page.keyboard.press("r");
  await shot(page, "rig-armored-relaxed");
});

test("both legs stay beneath the skirt and arms keep their own shoulder attachments through motion", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await shot(page, "rig-revised-idle");
  await page.keyboard.press("k");
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
  await page.keyboard.press("k");
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
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("walkForward");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].origin.x)
    .toBeGreaterThan(startX + 10);
  const forward = (await snapshot(page)).rigs![0].origin.x;
  expect(forward).toBeGreaterThan(startX + 10);
  await shot(page, "camp-walk-forward");
  await page.keyboard.up("d");
  const backwardStart = (await snapshot(page)).rigs![0].origin.x;
  await page.keyboard.down("a");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("walkBackward");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].origin.x)
    .toBeLessThan(backwardStart - 10);
  await shot(page, "camp-walk-backward");
  await page.keyboard.up("a");
  await page.keyboard.down("Shift");
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("run");
  await shot(page, "camp-run");
  await page.keyboard.up("d");
  await page.keyboard.up("Shift");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleRelaxed");
  await page.waitForTimeout(220);
  const grounded = (await snapshot(page)).rigs![0].near.heel.y;
  const [flight] = await Promise.all([
    page.evaluate(
      () =>
        new Promise<{ seen: boolean; minimum: number }>((resolve, reject) => {
          let seen = false,
            minimum = Infinity;
          const deadline = performance.now() + 8000;
          const sample = () => {
            const rig = (
              window as unknown as { __arena: { snapshot: () => Snapshot } }
            ).__arena.snapshot().rigs![0];
            if (rig.animation === "jump") {
              seen = true;
              minimum = Math.min(minimum, rig.near.heel.y);
            }
            if (seen && rig.animation === "idleRelaxed") {
              resolve({ seen, minimum });
              return;
            }
            if (performance.now() > deadline) {
              reject(Error("Jump did not complete"));
              return;
            }
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }),
    ),
    (async () => {
      await page.keyboard.press("Space");
      await shot(page, "camp-jump");
    })(),
  ]);
  expect(flight.seen).toBe(true);
  expect(flight.minimum).toBeLessThan(grounded - 20);
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleRelaxed");
  await page.keyboard.press("r");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleCombat");
  await shot(page, "camp-combat-idle");
  await page.keyboard.press("r");
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
  await page.keyboard.press("k");
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
  await expect
    .poll(async () => (await snapshot(page)).battle!.player.attackCooldown)
    .toBe(0);
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

test("keyboard movement, jump and boundaries remain responsive without combat buttons", async ({
  page,
}) => {
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const initial = (await snapshot(page)).battle!.player.x;
  expect(Object.keys((await snapshot(page)).buttons)).toEqual([]);
  await page.keyboard.down("a");
  await page.clock.runFor(400);
  await page.keyboard.up("a");
  await page.clock.runFor(50);
  const after = (await snapshot(page)).battle!.player.x;
  expect(after).toBeLessThan(initial - 20);
  await page.clock.runFor(180);
  expect((await snapshot(page)).battle!.player.x).toBeCloseTo(after, 1);
  expect((await snapshot(page)).buttons.defend).toBeUndefined();
  expect((await snapshot(page)).buttons.recover).toBeUndefined();
  await page.clock.resume();
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.y)
    .toBeLessThan(-20);
  await shot(page, "arena-touch-jump");
  await expect
    .poll(async () => (await snapshot(page)).battle?.player.y)
    .toBe(0);
  await page.keyboard.down("a");
  await page.keyboard.down("Shift");
  await expect
    .poll(async () => (await snapshot(page)).battle!.player.x, {
      timeout: 8000,
    })
    .toBe(90);
  await expect
    .poll(async () => Math.abs((await snapshot(page)).battle!.player.vx))
    .toBeLessThan(0.01);
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

test("direction plus Space hops without an automatic attack and bots keep ordinary movement", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  for (const [key, kind, sign] of [
    ["a", "backstep", -1],
    ["d", "forwardHop", 1],
  ] as const) {
    const initial = (await snapshot(page)).battle!.player.x;
    // Observe the complete motion, including short anticipation/landing phases.
    const observing = page.evaluate(
      () =>
        new Promise<NonNullable<Snapshot["battle"]>[]>((resolve) => {
          const poses: NonNullable<Snapshot["battle"]>[] = [],
            end = performance.now() + 1100;
          const sample = () => {
            const s = (
              window as unknown as { __arena: { snapshot: () => Snapshot } }
            ).__arena.snapshot();
            if (s.battle) poses.push(s.battle);
            if (performance.now() < end) requestAnimationFrame(sample);
            else resolve(poses);
          };
          requestAnimationFrame(sample);
        }),
    );
    await page.keyboard.down(key);
    await page.keyboard.press("Space");
    await page.keyboard.up(key);
    const samples = await observing;
    const hopping = samples.filter((s) => s.player.hop?.kind === kind);
    expect(hopping.length).toBeGreaterThan(2);
    expect(hopping.some((s) => s.player.y < -15)).toBe(true);
    expect(hopping.some((s) => s.player.hop?.phase === "landing")).toBe(true);
    expect((hopping.at(-1)!.player.x - initial) * sign).toBeGreaterThan(85);
    expect(samples.every((s) => s.enemy.hop?.kind !== "forwardHop")).toBe(true);
    expect(samples.every((s) => s.player.action === null)).toBe(true);
    expect(
      samples.every((s) =>
        s.contacts.every((e) => e.attackerId !== "wanderer"),
      ),
    ).toBe(true);
    await expect
      .poll(async () => (await snapshot(page)).battle!.player.hop)
      .toBeNull();
    // Keep input checks outside melee range; real hits intentionally interrupt hops/jumps.
    await page.keyboard.press("Escape");
    await scene(page, "MainMenuScene");
    await click(page, "battle");
    await scene(page, "ArenaScene");
  }
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await snapshot(page)).battle!.player.y)
    .toBeLessThan(-25);
  expect((await snapshot(page)).battle!.player.hop).toBeNull();
  await shot(page, "ordinary-jump-after-hops");
});

test("relaxed stance is upright with almost straight legs and an actually lowered weapon", async ({
  page,
}) => {
  await launch(page);
  await expect
    .poll(async () => {
      const r = (await snapshot(page)).rigs![0];
      return Math.abs(r.body.torso.right.y - r.body.torso.origin.y);
    })
    .toBeLessThan(0.001);
  const check = (r: Rig) => {
    expect(Math.abs(r.body.torso.right.y - r.body.torso.origin.y)).toBeLessThan(
      0.001,
    );
    for (const leg of [r.near, r.far]) {
      const a = { x: leg.knee.x - leg.hip.x, y: leg.knee.y - leg.hip.y },
        b = { x: leg.ankle.x - leg.knee.x, y: leg.ankle.y - leg.knee.y };
      const bend = Math.acos(
        Math.max(
          -1,
          Math.min(
            1,
            (a.x * b.x + a.y * b.y) /
              (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)),
          ),
        ),
      );
      expect(bend).toBeGreaterThan(0.025);
      expect(bend).toBeLessThan(0.08);
      expect(Math.abs(leg.heel.y - leg.toe.y)).toBeLessThan(0.01);
    }
  };
  await expect(async () => check((await snapshot(page)).rigs![0])).toPass({
    timeout: 3000,
  });
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await page.keyboard.press("r");
  await expect
    .poll(async () => {
      const r = (await snapshot(page)).rigs![0];
      return Math.abs(r.body.torso.right.y - r.body.torso.origin.y);
    })
    .toBeLessThan(0.001);
  await expect(async () => check((await snapshot(page)).rigs![0])).toPass({
    timeout: 3000,
  });
  const s = await snapshot(page);
  expect(s.battle!.player.relaxed).toBe(true);
  check(s.rigs![0]);
  const blade = s.geometry![0].blade!;
  expect(blade.a.y).toBeGreaterThan(blade.b.y);
  expect(blade.a.y).toBeLessThan(551 - 10);
  await shot(page, "upright-relaxed-arena");
  await page.keyboard.press("k");
  await expect
    .poll(async () => (await snapshot(page)).battle!.player.action?.name)
    .toBe("quick");
  expect((await snapshot(page)).battle!.player.relaxed).toBe(false);
});

test("anatomical slots move weapons between hands and persist two belt attachments", async ({
  page,
}) => {
  await launch(page);
  const p = (await snapshot(page)).player;
  p.gold = 1000;
  p.inventory.push(
    "war-spear",
    "viking",
    "plate",
    "throwing-knife",
    "throwing-axe",
  );
  await page.evaluate(
    (p) =>
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
      ),
    p,
  );
  await page.reload();
  await scene(page, "MainMenuScene");
  await click(page, "character");
  for (const [slot, id] of [
    ["belt1", "throwing-knife"],
    ["belt2", "throwing-axe"],
    ["leftHand", "war-spear"],
    ["helmet", "viking"],
    ["body", "plate"],
  ]) {
    await click(page, `slot-${slot}`);
    await click(page, `equip-${id}`);
  }
  let s = await snapshot(page);
  expect(s.player.equipment).toEqual({
    rightHand: "wood",
    leftHand: "war-spear",
    helmet: "viking",
    body: "plate",
    belt1: "throwing-knife",
    belt2: "throwing-axe",
  });
  expect(s.rigs![0].belt.map((v) => v.slot)).toEqual(["belt1", "belt2"]);
  expect(
    Math.hypot(
      s.rigs![0].offhand!.x - s.rigs![0].near.hand.x,
      s.rigs![0].offhand!.y - s.rigs![0].near.hand.y,
    ),
  ).toBeLessThan(0.02);
  await shot(page, "anatomical-loadout-both-hands-belt");
  await click(page, "unequip-rightHand");
  s = await snapshot(page);
  expect(s.rigs![0].primaryHand).toBe("front");
  expect(s.player.inventory).toContain("wood");
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.equipment).toEqual(s.player.equipment);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  expect((await snapshot(page)).rigs![0].primaryHand).toBe("front");
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await snapshot(page)).battle!.player.action?.name)
    .toBe("quick");
  await shot(page, "left-hand-primary-arena");
});

test("throw preview releases once, opens the palm and returns without consuming equipment", async ({
  page,
}) => {
  await launch(page);
  const before = (await snapshot(page)).player;
  const observing = page.evaluate(
    () =>
      new Promise<Rig[]>((resolve) => {
        const poses: Rig[] = [],
          end = performance.now() + 2200;
        const sample = () => {
          const s = (
            window as unknown as { __arena: { snapshot: () => Snapshot } }
          ).__arena.snapshot();
          poses.push(s.rigs![0]);
          if (performance.now() < end) requestAnimationFrame(sample);
          else resolve(poses);
        };
        requestAnimationFrame(sample);
      }),
  );
  await page.keyboard.press("t");
  const poses = await observing;
  expect(
    poses.some(
      (r) =>
        r.throwing.active && !r.throwing.released && r.throwing.propVisible,
    ),
  ).toBe(true);
  expect(
    poses.some(
      (r) =>
        r.throwing.active && r.throwing.released && !r.throwing.propVisible,
    ),
  ).toBe(true);
  expect(
    poses.some(
      (r) =>
        r.throwing.active &&
        !r.throwing.released &&
        r.far.hand.x < r.far.hip.x - 30 * r.scale,
    ),
  ).toBe(true);
  expect(
    poses.some(
      (r) =>
        r.throwing.released && r.far.hand.x > r.far.shoulder.x + 60 * r.scale,
    ),
  ).toBe(true);

  for (const r of poses.filter((r) => r.throwing.active)) {
    expect(r.weapons[0].visible).toBe(false);
    expect(r.throwing.headFront).toBe(false);
    expect(r.throwing.hand).toBe("rear");
    expect(r.body.layers.indexOf("torso")).toBeLessThan(
      r.body.layers.indexOf("frontTorso"),
    );
    expect(r.body.frontArms).toContain("farArm");
    anatomy(r, false);
  }
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleRelaxed");
  expect((await snapshot(page)).player).toEqual(before);
  await page.keyboard.press("t");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("throw");
  await shot(page, "camp-throw-preview");
});

test("attacks and hops work without energy, defense or recovery controls", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  const buttons = (await snapshot(page)).buttons;
  expect(buttons.defend).toBeUndefined();
  expect(buttons.recover).toBeUndefined();
  await page.keyboard.press("l");
  await page.keyboard.press("4");
  expect((await snapshot(page)).battle!.player.action).toBeNull();
  expect((await snapshot(page)).battle!.player.guard).toBe(false);
  await page.keyboard.press("k");
  await page.keyboard.down("a");
  await page.keyboard.press("Space");
  await page.keyboard.up("a");
  const poses = await page.evaluate(
    () =>
      new Promise<ArenaFighter[]>((resolve) => {
        const poses: ArenaFighter[] = [],
          end = performance.now() + 850;
        const sample = () => {
          poses.push(
            (
              window as unknown as { __arena: { snapshot: () => Snapshot } }
            ).__arena.snapshot().battle!.player,
          );
          if (performance.now() < end) requestAnimationFrame(sample);
          else resolve(poses);
        };
        requestAnimationFrame(sample);
      }),
  );
  expect(poses.some((p) => p.hop && p.action)).toBe(true);
  for (const pose of poses) expect(pose).not.toHaveProperty("stamina");
});

test("mouse buttons select exact hands, empty hands are disabled, and heavy attacks stay disabled", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  const field = async (button: "left" | "right") => {
    const b = await page.locator("canvas").boundingBox();
    await page.mouse.click(b!.x + b!.width * 0.5, b!.y + b!.height * 0.56, {
      button,
    });
  };
  expect((await snapshot(page)).buttons.heavy).toBeUndefined();
  await field("left");
  await page.waitForTimeout(300);
  const front = await snapshot(page);
  expect(front.battle!.player.action).toBeNull();
  expect(front.geometry![0].hands!.front).toBeTruthy();
  expect(front.geometry![0].blades!.front).toBeUndefined();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await field("right");
  await expect
    .poll(async () => (await snapshot(page)).battle!.player.action?.hand)
    .toBe("rear");
  const suppressed = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    const e = new MouseEvent("contextmenu", { cancelable: true });
    canvas.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(suppressed).toBe(true);
  await shot(page, "mouse-rear-hand-light-attack");
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  expect(
    await page.evaluate(() => {
      const e = new MouseEvent("contextmenu", { cancelable: true });
      document.querySelector("canvas")!.dispatchEvent(e);
      return e.defaultPrevented;
    }),
  ).toBe(false);
});

test("front kick makes physical contact and forces a backwards stagger", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  let seen: ContactEvent | undefined;
  const observation = page.evaluate(
    () =>
      new Promise<NonNullable<Snapshot["battle"]>[]>((resolve) => {
        const samples: NonNullable<Snapshot["battle"]>[] = [],
          end = performance.now() + 10000;
        const sample = () => {
          const s = (
            window as unknown as { __arena: { snapshot: () => Snapshot } }
          ).__arena.snapshot();
          if (s.battle) samples.push(s.battle);
          if (performance.now() < end && s.scene === "ArenaScene")
            requestAnimationFrame(sample);
          else resolve(samples);
        };
        requestAnimationFrame(sample);
      }),
  );
  for (let i = 0; i < 75 && !seen; i++) {
    const s = await snapshot(page);
    if (s.scene !== "ArenaScene") break;
    seen = s.battle!.contacts.find(
      (e) => e.attackerId === "wanderer" && e.kind === "kick",
    );
    if (!seen) {
      await steer(page, s);
      await page.keyboard.press("f");
      await page.waitForTimeout(100);
    }
  }
  await page.keyboard.up("a");
  await page.keyboard.up("d");
  expect(seen).toBeTruthy();
  const poses = await observation,
    staggered = poses.filter((s) => s.enemy.reaction?.kind === "stagger");
  expect(staggered.length).toBeGreaterThan(2);
  expect(staggered.some((s) => s.enemy.stun > 0)).toBe(true);
  expect(
    Math.max(...staggered.map((s) => s.enemy.x)) -
      Math.min(...staggered.map((s) => s.enemy.x)),
  ).toBeGreaterThan(100);
  expect(contact(seen!.blade, seen!.body)).not.toBeNull();
  await shot(page, "after-front-kick-stagger");
});

test("backpack lists all unequipped categories, excludes worn items and restores removed gear", async ({
  page,
}) => {
  await launch(page);
  const p = (await snapshot(page)).player;
  p.inventory.push("rust", "plate", "viking", "throwing-knife", "throwing-axe");
  await page.evaluate(
    (p) =>
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
      ),
    p,
  );
  await page.reload();
  await scene(page, "MainMenuScene");
  await click(page, "character");
  let s = await snapshot(page);
  for (const id of [
    "rust",
    "plate",
    "viking",
    "throwing-knife",
    "throwing-axe",
  ])
    expect(s.buttons[`equip-${id}`]).toBeTruthy();
  for (const id of ["wood"]) expect(s.buttons[`equip-${id}`]).toBeUndefined();
  await click(page, "equip-viking");
  expect((await snapshot(page)).buttons["equip-viking"]).toBeUndefined();
  await click(page, "unequip-helmet");
  expect((await snapshot(page)).buttons["equip-viking"]).toBeTruthy();
  await click(page, "slot-leftHand");
  s = await snapshot(page);
  for (const id of ["rust", "plate", "viking"])
    expect(s.buttons[`equip-${id}`]).toBeTruthy();
  await shot(page, "backpack-all-unequipped-items");
});

test("empty-hand mouse and keyboard attacks remain disabled without blocking the armed hand", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  for (const key of ["j", "1"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(100);
    expect((await snapshot(page)).battle!.player.handActions.front).toBeNull();
  }
  expect(
    (await snapshot(page)).battle!.contacts.filter(
      (e) => e.attackerId === "wanderer",
    ),
  ).toEqual([]);
  await page.keyboard.press("k");
  await expect
    .poll(
      async () => (await snapshot(page)).battle!.player.handActions.rear?.hand,
    )
    .toBe("rear");
  await shot(page, "empty-front-hand-disabled");
});

test("physical F kicks with a Ukrainian layout and ignores modified shortcuts", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "\u0430",
        code: "KeyF",
        keyCode: 70,
        ctrlKey: true,
        bubbles: true,
      }),
    ),
  );
  await frames(page);
  expect((await snapshot(page)).battle!.player.action).toBeNull();
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "\u0430",
        code: "KeyF",
        keyCode: 70,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "\u0430",
        code: "KeyF",
        keyCode: 70,
        bubbles: true,
      }),
    );
  });
  await expect
    .poll(async () => (await snapshot(page)).battle!.player.action?.name)
    .toBe("kick");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("kick");
});

test("a seeded kick knocks down on contact, holds one second and rises through a supported get-up", async ({
  page,
}) => {
  await page.goto("/?seed=5&renderer=canvas&manual=1");
  await scene(page, "MainMenuScene");
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await page.keyboard.down("d");
  for (let i = 0; i < 60; i++) {
    const s = (await snapshot(page)).battle!;
    if (s.enemy.x - s.player.x < 190) break;
    await page.clock.runFor(25);
  }
  await page.keyboard.up("d");
  await page.keyboard.press("f");
  let event: ContactEvent | undefined;
  for (let i = 0; i < 45; i++) {
    await page.clock.runFor(16);
    event = (await snapshot(page)).battle!.contacts.find(
      (e) => e.kind === "kick",
    );
    if (event) break;
  }
  expect(event?.knockdown).toBe(true);
  expect(contact(event!.blade, event!.body)).not.toBeNull();
  // Sample inside the browser to avoid a protocol round trip for every pose.
  await page.evaluate(() => {
    const w = window as unknown as {
      __arena: { snapshot: () => Snapshot };
      __knockdownSamples: { state: ArenaFighter; rig: Rig }[];
      __knockdownTimer: ReturnType<typeof setInterval>;
    };
    w.__knockdownSamples = [];
    w.__knockdownTimer = setInterval(() => {
      const s = w.__arena.snapshot();
      w.__knockdownSamples.push({ state: s.battle!.enemy, rig: s.rigs![1] });
    }, 20);
  });
  await page.clock.runFor(600);
  expect((await snapshot(page)).battle!.enemy.knockdown?.phase).toBe("down");
  await page.screenshot({
    path: "test-results/screenshots/kick-knockdown-ground.png",
  });
  await page.clock.runFor(1800);
  expect((await snapshot(page)).battle!.enemy.knockdown?.phase).toBe("getUp");
  await page.screenshot({
    path: "test-results/screenshots/kick-supported-get-up.png",
  });
  await page.clock.runFor(1200);
  const seen = await page.evaluate(() => {
    const w = window as unknown as {
      __knockdownSamples: { state: ArenaFighter; rig: Rig }[];
      __knockdownTimer: ReturnType<typeof setInterval>;
    };
    clearInterval(w.__knockdownTimer);
    return w.__knockdownSamples;
  });
  const down = seen.filter((s) => s.state.knockdown?.phase === "down");
  const up = seen.filter((s) => s.state.knockdown?.phase === "getUp");
  expect(down.length).toBeGreaterThanOrEqual(49);
  expect(up.length).toBeGreaterThanOrEqual(89);
  for (const { state, rig } of [...down, ...up]) {
    expect(state.y).toBe(0);
    expect(state.vy).toBe(0);
    expect(state.action).toBeNull();
    anatomy(rig, false);
    expect(
      Math.max(rig.near.heel.y, rig.near.toe.y, rig.far.heel.y, rig.far.toe.y),
    ).toBeLessThanOrEqual(551.1);
  }
  expect(up.every((s) => s.rig.animation === "getUp")).toBe(true);
  expect((await snapshot(page)).battle!.enemy.knockdown).toBeNull();
  await page.clock.resume();
  await shot(page, "after-heavy-get-up");
});

test("F during a jump performs a physical flying kick and lands normally", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await page.keyboard.down("d");
  for (let i = 0; i < 70; i++) {
    const b = (await snapshot(page)).battle!;
    if (b.enemy.x - b.player.x < 190) break;
    await page.clock.runFor(25);
  }
  await page.keyboard.up("d");
  await page.keyboard.press("Space");
  await page.clock.runFor(100);
  await page.keyboard.press("f");
  let hit: ContactEvent | undefined, airHit: Snapshot | undefined;
  for (let i = 0; i < 40; i++) {
    await page.clock.runFor(16);
    const s = await snapshot(page);
    hit = s.battle!.contacts.find(
      (e) => e.kind === "kick" && e.attackerId === "wanderer",
    );
    if (hit) {
      airHit = s;
      break;
    }
  }
  expect(hit).toBeTruthy();
  expect(hit!.damage).toBe(0);
  expect(airHit!.battle!.enemy.hp).toBe(100);
  expect(airHit!.battle!.player.y).toBeLessThan(0);
  expect(airHit!.battle!.player.action?.name).toBe("kick");
  expect(airHit!.rigs![0].animation).toBe("kick");
  expect(contact(hit!.blade, hit!.body)).not.toBeNull();
  anatomy(airHit!.rigs![0], false);
  await page.screenshot({
    path: "test-results/screenshots/flying-kick-contact.png",
  });
  await page.clock.runFor(1100);
  expect((await snapshot(page)).battle!.player.y).toBe(0);
  expect((await snapshot(page)).battle!.player.vy).toBe(0);
  await page.clock.resume();
});

test("both throw styles remain selectable and the overarm serve releases high in front of the head layer", async ({
  page,
}) => {
  await page.clock.install();
  await launch(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  const before = (await snapshot(page)).player;
  await page.keyboard.press("y");
  const observing = page.evaluate(
    () =>
      new Promise<Rig[]>((resolve) => {
        const poses: Rig[] = [],
          end = performance.now() + 2050;
        const step = () => {
          const s = (
            window as unknown as { __arena: { snapshot: () => Snapshot } }
          ).__arena.snapshot();
          poses.push(s.rigs![0]);
          if (performance.now() < end) requestAnimationFrame(step);
          else resolve(poses);
        };
        requestAnimationFrame(step);
      }),
  );
  await page.clock.runFor(2100);
  const poses = await observing;
  await page.clock.resume();
  expect(
    poses.some(
      (r) =>
        r.animation === "throwOverhand" &&
        r.far.hand.y < r.far.shoulder.y - 65 * r.scale,
    ),
  ).toBe(true);
  for (const r of poses.filter((r) => r.throwing.active)) {
    expect(r.throwing.headFront).toBe(false);
    anatomy(r, false);
  }
  expect((await snapshot(page)).player).toEqual(before);
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleRelaxed");
  await page.keyboard.press("t");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("throw");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("idleRelaxed");
  await click(page, "character");
  expect((await snapshot(page)).buttons["preview-throw"]).toBeUndefined();
  expect((await snapshot(page)).buttons["preview-overhand"]).toBeUndefined();
});

test("hand inputs keep separate animation clocks when staggered", async ({
  page,
}) => {
  const p = createPlayer();
  p.inventory.push("rust");
  p.equipment.leftHand = "rust";
  await savedFixture(page, p);
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.press("k");
  await page.clock.runFor(200);
  await page.keyboard.press("j");
  await page.clock.runFor(50);
  const s = await snapshot(page),
    a = s.battle!.player.handActions;
  expect(a.front).toBeTruthy();
  expect(a.rear).toBeTruthy();
  expect(a.rear!.elapsed - a.front!.elapsed).toBeGreaterThan(150);
  expect(s.rigs![0].animation).toBe("dualAttack");
  anatomy(s.rigs![0]);
  await page.clock.resume();
});

test("simultaneous hand inputs produce two independent physical weapon hits", async ({
  page,
}) => {
  const p = createPlayer();
  p.inventory.push("rust", "plate", "cap");
  p.equipment = {
    ...p.equipment,
    leftHand: "rust",
    body: "plate",
    helmet: "cap",
  };
  await page.addInitScript(
    (p) =>
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
      ),
    p,
  );
  await launch(page);
  await click(page, "battle");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await page.keyboard.down("d");
  for (let i = 0; i < 70; i++) {
    const b = (await snapshot(page)).battle!;
    if (b.enemy.x - b.player.x < 190) break;
    await page.clock.runFor(25);
  }
  await page.keyboard.up("d");
  const canvas = await page.locator("canvas").boundingBox();
  await page.mouse.move(
    canvas!.x + canvas!.width * 0.5,
    canvas!.y + canvas!.height * 0.56,
  );
  await page.mouse.down({ button: "left" });
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "left" });
  await page.mouse.up({ button: "right" });
  await page.clock.runFor(50);
  let s = await snapshot(page);
  expect(s.battle!.player.handActions.front).toBeTruthy();
  expect(s.battle!.player.handActions.rear).toBeTruthy();
  const ids = [
    s.battle!.player.handActions.front!.id,
    s.battle!.player.handActions.rear!.id,
  ];
  await page.clock.runFor(600);
  s = await snapshot(page);
  const hits = s.battle!.contacts.filter(
    (e) => e.attackerId === "wanderer" && ids.includes(e.id),
  );
  expect(hits).toHaveLength(2);
  expect(new Set(hits.map((h) => h.hand)).size).toBe(2);
  for (const hit of hits) {
    expect(hit.kind).toBe("weapon");
    expect(contact(hit.blade, hit.body)).not.toBeNull();
  }
  expect(s.battle!.enemy.hp).toBe(
    100 - hits.reduce((sum, e) => sum + e.damage, 0),
  );
  await page.screenshot({
    path: "test-results/screenshots/dual-weapon-contact.png",
  });
  await page.clock.resume();
});

test("victory progress beyond three persists and generates stronger equipped opponents", async ({
  page,
}) => {
  await launch(page);
  await click(page, "battle");
  const first = (await snapshot(page)).battle!.enemy.model;
  const p = (await snapshot(page)).player;
  p.progress = 9;
  await page.evaluate(
    (p) =>
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
      ),
    p,
  );
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.progress).toBe(9);
  await click(page, "battle");
  const late = (await snapshot(page)).battle!.enemy.model;
  expect(first.equipment.body).toBeUndefined();
  expect(late.equipment.body).toBe("plate");
  expect(late.equipment.helmet).toBe("viking");
  expect(["iron", "war-spear"]).toContain(late.equipment.rightHand);
  await shot(page, "veteran-random-loadout");
});

test("belt knife makes a physical projectile hit, is lost on reload, and can be bought again", async ({
  page,
}) => {
  const p = createPlayer();
  p.inventory.push("throwing-knife");
  p.equipment.belt1 = "throwing-knife";
  await savedFixture(page, p);
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.press("q");
  await page.clock.runFor(350);
  let s = await snapshot(page);
  expect(s.battle!.player.handActions.rear?.name).toBe("throw");
  expect(s.battle!.projectiles).toHaveLength(0);
  expect(s.player.inventory).toContain("throwing-knife");
  await page.clock.runFor(200);
  s = await snapshot(page);
  expect(s.battle!.projectiles).toHaveLength(1);
  expect(s.battle!.projectiles[0].itemId).toBe("throwing-knife");
  expect(s.player.inventory).not.toContain("throwing-knife");
  expect(s.player.equipment.belt1).toBeUndefined();
  expect(s.player.equipment.rightHand).toBe("wood");
  for (
    let i = 0;
    i < 50 && !s.battle!.contacts.some((e) => e.kind === "projectile");
    i++
  ) {
    await page.clock.runFor(25);
    s = await snapshot(page);
  }
  const hits = s.battle!.contacts.filter((e) => e.kind === "projectile");
  expect(hits).toHaveLength(1);
  expect(contact(hits[0].blade, hits[0].body)).not.toBeNull();
  expect(hits[0].damage).toBeGreaterThan(0);
  await page.screenshot({
    path: "test-results/screenshots/throwing-knife-contact.png",
  });
  await page.clock.resume();
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.inventory).not.toContain(
    "throwing-knife",
  );
  await click(page, "shop");
  await click(page, "shop-weapons");
  await click(page, "shop-next");
  expect((await snapshot(page)).buttons["buy-throwing-knife"]).toBeTruthy();
  expect((await snapshot(page)).buttons["buy-throwing-axe"]).toBeTruthy();
  expect((await snapshot(page)).buttons["buy-net"]).toBeUndefined();
  expect((await snapshot(page)).buttons["buy-flask"]).toBeUndefined();
  await click(page, "buy-throwing-knife");
  expect((await snapshot(page)).player.inventory).toContain("throwing-knife");
  expect((await snapshot(page)).player.gold).toBe(75);
});

test("belt axe uses an overarm airborne throw while the front hand attacks independently", async ({
  page,
}) => {
  const p = createPlayer();
  p.inventory.push("throwing-axe", "rust");
  p.equipment.leftHand = "rust";
  p.equipment.belt2 = "throwing-axe";
  await savedFixture(page, p);
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.press("Space");
  await page.clock.runFor(50);
  await page.keyboard.press("e");
  await page.clock.runFor(150);
  await page.keyboard.press("j");
  await page.clock.runFor(100);
  let s = await snapshot(page);
  expect(s.battle!.player.handActions.front?.name).toBe("quick");
  expect(s.battle!.player.handActions.rear?.name).toBe("throw");
  expect(s.battle!.player.y).toBeLessThan(0);
  // Observe the cock/extension phase instead of assuming an exact rendered frame.
  let highRelease = false;
  for (let i = 0; i < 11; i++) {
    await page.clock.runFor(16);
    const rig = (await snapshot(page)).rigs![0];
    highRelease ||= rig.far.hand.y < rig.far.shoulder.y - 55;
  }
  expect(highRelease).toBe(true);
  s = await snapshot(page);
  expect(s.battle!.projectiles[0].itemId).toBe("throwing-axe");
  expect(s.battle!.projectiles[0].spin).not.toBe(0);
  expect(s.battle!.player.y).toBeLessThan(0);
  expect(s.player.inventory).not.toContain("throwing-axe");
  expect(s.player.equipment.rightHand).toBe("wood");
  await page.screenshot({
    path: "test-results/screenshots/airborne-throwing-axe.png",
  });
  await page.clock.resume();
});

test("Ctrl plus each mouse attack throws that hand's actual weapon and leaves bare hands", async ({
  page,
}) => {
  const p = createPlayer();
  p.inventory.push("rust", "war-spear");
  p.equipment.leftHand = "rust";
  p.equipment.rightHand = "war-spear";
  await page.addInitScript((p) => {
    if (!localStorage.getItem("arena-of-ash.v3"))
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
      );
  }, p);
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.down("Control");
  await page.mouse.click(640, 400, { button: "left" });
  await page.mouse.click(640, 400, { button: "right" });
  await page.keyboard.up("Control");
  await page.clock.runFor(350);
  let s = await snapshot(page);
  expect(s.battle!.player.handActions.front?.itemId).toBe("rust");
  expect(s.battle!.player.handActions.rear?.itemId).toBe("war-spear");
  expect(s.rigs![0].body.frontArms).toContain("nearArm");
  expect(s.rigs![0].throwing.headFront).toBe(false);
  for (const arm of [s.rigs![0].near, s.rigs![0].far])
    expect(arm.hand.y).toBeLessThan(arm.shoulder.y - 40);
  await page.clock.runFor(200);
  s = await snapshot(page);
  expect(s.battle!.projectiles).toHaveLength(2);
  expect(s.player.equipment.leftHand).toBeUndefined();
  expect(s.player.equipment.rightHand).toBeUndefined();
  expect(s.player.inventory).not.toContain("rust");
  expect(s.player.inventory).not.toContain("war-spear");
  expect(s.rigs![0].weapons).toHaveLength(0);
  await page.screenshot({
    path: "test-results/screenshots/both-hand-weapons-thrown.png",
  });
  await page.clock.runFor(700);
  await page.keyboard.press("j");
  await page.keyboard.press("k");
  await page.clock.runFor(50);
  s = await snapshot(page);
  expect(s.battle!.player.handActions.front).toBeNull();
  expect(s.battle!.player.handActions.rear).toBeNull();
  expect(s.geometry![0].blades?.front).toBeUndefined();
  expect(s.geometry![0].blades?.rear).toBeUndefined();
  expect(s.rigs![0].body.backArms).toContain("nearArm");
  await page.clock.resume();
});

test("drinking brings an open vial to the mouth and returns to idle without consuming gear", async ({
  page,
}) => {
  await page.clock.install();
  await launch(page);
  const before = (await snapshot(page)).player;
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.press("p");
  await page.clock.runFor(1200);
  const s = await snapshot(page);
  let r = s.rigs![0];
  expect(r.drinking).toBe(true);
  expect(r.drink.vialVisible).toBe(true);
  expect(
    Math.hypot(
      r.drink.neck.x - r.drink.mouth.x,
      r.drink.neck.y - r.drink.mouth.y,
    ) / r.scale,
  ).toBeLessThan(6);
  expect(r.drink.base.x).toBeGreaterThan(r.drink.neck.x);
  expect(r.weapons.every((w) => !w.visible)).toBe(true);
  anatomy(r);
  expect(s.player).toEqual(before);
  await page.screenshot({
    path: "test-results/screenshots/potion-drinking.png",
  });
  await page.clock.runFor(1300);
  r = (await snapshot(page)).rigs![0];
  expect(r.drinking).toBe(false);
  expect(r.drink.vialVisible).toBe(false);
  expect(r.animation).toBe("idleRelaxed");
  expect(r.weapons[0].visible).toBe(true);
  await page.clock.resume();
  await page.keyboard.press("p");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].animation)
    .toBe("drink");
});

test("shop potion equips on the belt, heals at the animated sip and remains spent after reload", async ({
  page,
}) => {
  await page.clock.install();
  await launch(page);
  await click(page, "shop");
  await click(page, "shop-next");
  await click(page, "buy-healing-potion");
  expect((await snapshot(page)).player.gold).toBe(70);
  await shot(page, "throwables-potion-shop");
  await click(page, "back");
  await click(page, "character");
  await click(page, "slot-belt1");
  await click(page, "equip-healing-potion");
  let s = await snapshot(page);
  expect(s.player.equipment.belt1).toBe("healing-potion");
  expect(s.buttons["equip-healing-potion"]).toBeUndefined();
  await click(page, "back");
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.press("q");
  await page.clock.runFor(50);
  expect((await snapshot(page)).battle!.player.action).toBeNull();
  await page.keyboard.down("d");
  for (let i = 0; i < 180; i++) {
    s = await snapshot(page);
    if (s.battle!.player.hp < 100) break;
    await page.clock.runFor(25);
  }
  await page.keyboard.up("d");
  const injured = (await snapshot(page)).battle!.player.hp;
  expect(injured).toBeLessThan(100);
  await page.keyboard.down("a");
  await page.keyboard.down("Shift");
  await page.clock.runFor(1100);
  await page.keyboard.press("q");
  await page.clock.runFor(1000);
  s = await snapshot(page);
  expect(s.battle!.player.handActions.rear?.name).toBe("drink");
  expect(s.battle!.player.hp).toBe(injured);
  expect(s.player.inventory).toContain("healing-potion");
  await page.clock.runFor(250);
  s = await snapshot(page);
  expect(s.battle!.player.hp).toBe(Math.min(100, injured + 35));
  expect(s.player.inventory).not.toContain("healing-potion");
  expect(s.player.equipment.belt1).toBeUndefined();
  const r = s.rigs![0];
  expect(r.drink.vialVisible).toBe(true);
  expect(
    Math.hypot(
      r.drink.neck.x - r.drink.mouth.x,
      r.drink.neck.y - r.drink.mouth.y,
    ) / r.scale,
  ).toBeLessThan(6);
  await page.screenshot({
    path: "test-results/screenshots/potion-sip-heals.png",
  });
  await page.keyboard.up("a");
  await page.keyboard.up("Shift");
  await page.clock.resume();
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.inventory).not.toContain(
    "healing-potion",
  );
  expect((await snapshot(page)).player.gold).toBe(70);
});

const ownedCopies = (p: Player, id: string) =>
  p.inventory.includes(id) ? (p.quantities?.[id] ?? 1) : 0;
async function savedFixture(page: Page, p: Player) {
  await page.addInitScript((p) => {
    if (!localStorage.getItem("arena-of-ash.v3"))
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
      );
  }, p);
}

test("bulk consumables retain backpack reserves while each belt slot carries one copy", async ({
  page,
}) => {
  const p = createPlayer();
  p.gold = 1000;
  p.inventory.push("throwing-knife", "throwing-axe");
  await savedFixture(page, p);
  await page.clock.install();
  await launch(page);
  await click(page, "shop");
  await click(page, "shop-next");
  await click(page, "quantity-5");
  for (const id of ["throwing-knife", "throwing-axe", "healing-potion"])
    await click(page, `buy-${id}`);
  let s = await snapshot(page);
  expect(s.player.gold).toBe(500);
  expect(ownedCopies(s.player, "throwing-knife")).toBe(6);
  expect(ownedCopies(s.player, "throwing-axe")).toBe(6);
  expect(ownedCopies(s.player, "healing-potion")).toBe(5);
  await shot(page, "bulk-consumable-shop");
  await click(page, "back");
  await click(page, "character");
  await click(page, "slot-belt2");
  await click(page, "equip-throwing-knife");
  await click(page, "equip-throwing-knife");
  s = await snapshot(page);
  expect(s.player.equipment.belt1).toBe("throwing-knife");
  expect(s.player.equipment.belt2).toBe("throwing-knife");
  expect(s.buttons["equip-throwing-knife"]).toBeTruthy();
  await shot(page, "stacked-backpack-single-belt-copies");
  await click(page, "back");
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.down("a");
  await page.keyboard.down("Shift");
  await page.keyboard.press("q");
  await page.clock.runFor(600);
  s = await snapshot(page);
  expect(ownedCopies(s.player, "throwing-knife")).toBe(5);
  expect(s.player.equipment.belt1).toBeUndefined();
  expect(s.player.equipment.belt2).toBe("throwing-knife");
  await page.clock.runFor(650);
  await page.keyboard.press("q");
  await page.clock.runFor(100);
  expect((await snapshot(page)).battle!.projectiles).toHaveLength(1);
  await page.keyboard.press("e");
  await page.clock.runFor(600);
  expect(ownedCopies((await snapshot(page)).player, "throwing-knife")).toBe(4);
  await page.keyboard.up("a");
  await page.keyboard.up("Shift");
  await page.clock.resume();
  await page.reload();
  await scene(page, "MainMenuScene");
  s = await snapshot(page);
  expect(ownedCopies(s.player, "throwing-knife")).toBe(4);
  expect(s.player.equipment.belt1).toBeUndefined();
  expect(s.player.equipment.belt2).toBeUndefined();
});

test("a timed C parry deflects a real enemy hit and gives the attacker a full second of stun", async ({
  page,
}) => {
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.down("d");
  for (let i = 0; i < 120; i++) {
    const b = (await snapshot(page)).battle!;
    if (b.enemy.action && b.enemy.x - b.player.x <= 145) break;
    await page.clock.runFor(16);
  }
  await page.keyboard.up("d");
  for (let i = 0; i < 100; i++) {
    const a = (await snapshot(page)).battle!.enemy.handActions.rear;
    if (a && a.name === "quick" && a.elapsed >= 425) break;
    await page.clock.runFor(8);
  }
  const before = (await snapshot(page)).battle!.player.hp;
  await page.keyboard.press("c");
  let s = await snapshot(page);
  for (let i = 0; i < 30; i++) {
    await page.clock.runFor(8);
    s = await snapshot(page);
    if (s.battle!.contacts.some((e) => e.parried)) break;
  }
  const hit = s.battle!.contacts.find((e) => e.parried);
  expect(hit).toBeTruthy();
  expect(hit!.damage).toBe(0);
  expect(contact(hit!.blade, hit!.body)).not.toBeNull();
  expect(s.battle!.player.hp).toBe(before);
  expect(s.battle!.enemy.stun).toBeGreaterThan(900);
  expect(s.battle!.enemy.reaction?.kind).toBe("parried");
  expect(s.rigs![0].animation).toBe("parry");
  anatomy(s.rigs![0]);
  const pushedFrom = s.battle!.enemy.x;
  await page.clock.runFor(160);
  s = await snapshot(page);
  anatomy(s.rigs![0]);
  expect(s.rigs![0].body.frontArms).toContain("nearArm");
  expect(s.rigs![0].near.hand.x).toBeGreaterThan(
    s.rigs![0].near.shoulder.x + 60,
  );
  expect(s.battle!.enemy.x).toBeGreaterThan(pushedFrom);
  expect(s.battle!.enemy.knockdown).toBeNull();
  await page.screenshot({
    path: "test-results/screenshots/timed-parry-stun.png",
  });
  await page.clock.runFor(770);
  s = await snapshot(page);
  expect(s.battle!.enemy.stun).toBeGreaterThan(0);
  expect(s.battle!.enemy.x - pushedFrom).toBeGreaterThan(180);
  expect(s.battle!.enemy.knockdown).toBeNull();
  await page.clock.runFor(200);
  expect((await snapshot(page)).battle!.enemy.stun).toBe(0);
  await page.clock.resume();
});

test("a lethal thrown weapon settles after victory and can be collected for the next match", async ({
  page,
}) => {
  const live = structuredClone(bundled);
  live.items.find((i) => i.id === "wood")!.attack = 150;
  await page.route("**/content/items.json?_=*", (route) =>
    route.fulfill({ json: live }),
  );
  const p = createPlayer();
  p.inventory.push("plate", "cap");
  p.equipment.body = "plate";
  p.equipment.helmet = "cap";
  await savedFixture(page, p);
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.press("Control+k");
  let s = await snapshot(page);
  for (let i = 0; i < 100 && s.battle!.state === "Fighting"; i++) {
    await page.clock.runFor(25);
    s = await snapshot(page);
  }
  expect(s.battle!.state).toBe("Victory");
  expect(s.buttons["finish-battle"]).toBeTruthy();
  await page.clock.runFor(2200);
  s = await snapshot(page);
  expect(s.scene).toBe("ArenaScene");
  const dropped = s.battle!.projectiles.find((p) => p.itemId === "wood")!;
  expect(dropped.state).toBe("landed");
  await page.keyboard.down("Shift");
  for (let i = 0; i < 160; i++) {
    s = await snapshot(page);
    if (Math.abs(s.battle!.player.x - dropped.x) < 60) break;
    const toward = dropped.x > s.battle!.player.x ? "d" : "a",
      away = toward === "d" ? "a" : "d";
    await page.keyboard.up(away);
    await page.keyboard.down(toward);
    await page.clock.runFor(25);
  }
  await page.keyboard.up("a");
  await page.keyboard.up("d");
  await page.keyboard.up("Shift");
  await page.keyboard.press("g");
  await page.clock.runFor(50);
  s = await snapshot(page);
  expect(s.battle!.projectiles.find((p) => p.id === dropped.id)!.state).toBe(
    "pickedUp",
  );
  expect(s.player.equipment.rightHand).toBe("wood");
  expect(ownedCopies(s.player, "wood")).toBe(1);
  await page.screenshot({
    path: "test-results/screenshots/victory-equipment-recovery.png",
  });
  await page.clock.resume();
  await click(page, "finish-battle");
  await scene(page, "ResultScene");
  await click(page, "again");
  await scene(page, "ArenaScene");
  expect((await snapshot(page)).battle!.player.model.equipment.rightHand).toBe(
    "wood",
  );
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.equipment.rightHand).toBe("wood");
});

test("a rare enemy throw leaves a recoverable weapon that becomes permanent player equipment", async ({
  page,
}) => {
  const p = createPlayer();
  p.inventory.push("plate", "cap");
  p.equipment.body = "plate";
  p.equipment.helmet = "cap";
  await savedFixture(page, p);
  await page.clock.install();
  await page.goto("/?seed=2&renderer=canvas&ai=training&manual=1");
  await scene(page, "MainMenuScene");
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500));
  await page.keyboard.down("a");
  await page.keyboard.down("Shift");
  let s = await snapshot(page);
  for (let i = 0; i < 100 && !s.battle!.enemy.action?.itemId; i++) {
    await page.clock.runFor(25);
    s = await snapshot(page);
  }
  expect(s.battle!.enemy.action?.name).toBe("throw");
  const id = s.battle!.enemy.action!.itemId!,
    initial = ownedCopies(s.player, id);
  for (
    let i = 0;
    i < 120 &&
    !s.battle!.projectiles.some(
      (p) => p.ownerId === "enemy" && p.state === "landed",
    );
    i++
  ) {
    await page.clock.runFor(25);
    s = await snapshot(page);
  }
  await page.keyboard.up("a");
  await page.keyboard.up("Shift");
  const dropped = s.battle!.projectiles.find((p) => p.ownerId === "enemy")!;
  expect(dropped.state).toBe("landed");
  expect(s.battle!.enemy.model.equipment[dropped.sourceSlot]).toBeUndefined();
  for (
    let i = 0;
    i < 160 &&
    s.battle!.projectiles.find((p) => p.id === dropped.id)!.state !==
      "pickedUp";
    i++
  ) {
    if (Math.abs(dropped.x - s.battle!.player.x) > 60) {
      await page.keyboard.down(dropped.x > s.battle!.player.x ? "d" : "a");
    } else {
      await page.keyboard.up("d");
      await page.keyboard.up("a");
      await page.keyboard.press("g");
    }
    await page.clock.runFor(16);
    s = await snapshot(page);
  }
  await page.keyboard.up("a");
  await page.keyboard.up("d");
  expect(s.battle!.projectiles.find((p) => p.id === dropped.id)!.state).toBe(
    "pickedUp",
  );
  expect(ownedCopies(s.player, id)).toBe(initial + 1);
  expect(s.player.equipment.leftHand).toBe(id);
  await page.screenshot({
    path: "test-results/screenshots/enemy-thrown-weapon-recovered.png",
  });
  await page.clock.resume();
  await page.reload();
  await scene(page, "MainMenuScene");
  expect(ownedCopies((await snapshot(page)).player, id)).toBe(initial + 1);
});

test("crossbow and rifle previews aim, fire and restore equipment without changing ownership", async ({
  page,
}) => {
  await page.clock.install();
  await launch(page);
  const before = (await snapshot(page)).player;
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  for (const [key, kind, duration] of [
    ["u", 1, 2050],
    ["i", 2, 1850],
  ] as const) {
    await page.keyboard.press(key);
    await page.clock.runFor(duration * 0.4);
    let r = (await snapshot(page)).rigs![0];
    expect(r.shooting.kind).toBe(kind);
    expect(r.weapons.every((w) => !w.visible)).toBe(true);
    expect(r.body.backArms).toContain("nearArm");
    expect(r.body.frontArms).toContain("farArm");
    expect(r.near.hand.x).toBeGreaterThan(r.far.hand.x + 25);
    expect(Math.abs(r.near.hand.y - r.far.hand.y)).toBeLessThan(12);
    anatomy(r);
    await page.clock.runFor(duration * 0.14);
    r = (await snapshot(page)).rigs![0];
    expect(r.shooting.flash).toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/${kind === 1 ? "crossbow" : "rifle"}-shot.png`,
    });
    await page.clock.runFor(duration * 0.6);
    r = (await snapshot(page)).rigs![0];
    expect(r.shooting.kind).toBe(0);
    expect(r.weapons[0].visible).toBe(true);
    expect(r.body.backArms).toContain("nearArm");
    expect((await snapshot(page)).player).toEqual(before);
  }
  await page.clock.resume();
  await page.keyboard.press("i");
  await expect
    .poll(async () => (await snapshot(page)).rigs![0].shooting.kind)
    .toBe(2);
});

test("enemy reacts to an approaching swing with a real backward hop", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/?seed=0&renderer=canvas&manual=1");
  await scene(page, "MainMenuScene");
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.down("d");
  await page.keyboard.down("Shift");
  for (let i = 0; i < 100; i++) {
    const b = (await snapshot(page)).battle!;
    if (b.enemy.x - b.player.x < 185) break;
    await page.clock.runFor(16);
  }
  await page.keyboard.up("d");
  await page.keyboard.up("Shift");
  await page.keyboard.press("k");
  let hopped = false,
    airborne = false;
  for (let i = 0; i < 50; i++) {
    await page.clock.runFor(16);
    const b = (await snapshot(page)).battle!;
    hopped ||= b.enemy.hop?.kind === "backstep";
    airborne ||= b.enemy.hop?.kind === "backstep" && b.enemy.y < -10;
    expect(b.enemy.hop?.kind).not.toBe("forwardHop");
  }
  expect(hopped).toBe(true);
  expect(airborne).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/enemy-backstep.png",
  });
  await page.clock.resume();
});

test("H captures, holds an opponent overhead and throws into supported floor recovery", async ({
  page,
}) => {
  const p = createPlayer();
  p.inventory.push("plate", "viking");
  p.equipment.body = "plate";
  p.equipment.helmet = "viking";
  await page.addInitScript(
    (p) =>
      localStorage.setItem(
        "arena-of-ash.v3",
        JSON.stringify({ version: 3, player: p }),
      ),
    p,
  );
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.keyboard.down("d");
  await page.keyboard.down("Shift");
  for (let i = 0; i < 120; i++) {
    if (
      Math.abs(
        (await snapshot(page)).battle!.enemy.x -
          (await snapshot(page)).battle!.player.x,
      ) <= 94
    )
      break;
    await page.clock.runFor(16);
  }
  await page.keyboard.up("d");
  await page.keyboard.up("Shift");
  for (let i = 0; i < 60; i++) {
    const b = (await snapshot(page)).battle!;
    if (b.enemy.grapple?.role === "target") break;
    if (!b.player.grapple) await page.keyboard.press("h");
    await page.clock.runFor(80);
  }
  expect((await snapshot(page)).battle!.enemy.grapple?.role).toBe("target");
  await page.clock.runFor(1100);
  let s = await snapshot(page);
  expect(s.battle!.player.grapple?.phase).toBe("hold");
  const hp = [s.battle!.player.hp, s.battle!.enemy.hp],
    owned = s.player;
  const hips = (s.rigs![1].near.hip.y + s.rigs![1].far.hip.y) / 2;
  expect(hips).toBeLessThan(s.rigs![0].far.shoulder.y - 80);
  expect(s.rigs![0].far.hand.y).toBeLessThan(s.rigs![0].far.shoulder.y - 55);
  expect(s.rigs![0].body.frontArms).toContain("nearArm");
  for (const r of s.rigs!) anatomy(r, false);
  await page.screenshot({
    path: "test-results/screenshots/opponent-overhead.png",
  });
  const carrierX = s.battle!.player.x;
  await page.keyboard.down("d");
  await page.clock.runFor(250);
  await page.keyboard.up("d");
  expect((await snapshot(page)).battle!.player.x).toBeGreaterThan(
    carrierX + 15,
  );
  await page.keyboard.down("a");
  await page.clock.runFor(250);
  await page.keyboard.up("a");
  s = await snapshot(page);
  expect(s.battle!.player.facing).toBe(-1);
  expect(s.battle!.enemy.facing).toBe(-1);
  expect(s.battle!.enemy.x - s.battle!.player.x).toBeCloseTo(-112, 2);
  await page.screenshot({
    path: "test-results/screenshots/carry-walk-turn-left.png",
  });
  await page.keyboard.press("h");
  await page.clock.runFor(250);
  s = await snapshot(page);
  expect(s.battle!.enemy.grapple?.phase).toBe("air");
  expect(s.battle!.enemy.vx).toBeLessThan(0);
  expect(s.battle!.enemy.vy).toBeLessThan(0);
  await page.screenshot({
    path: "test-results/screenshots/opponent-thrown.png",
  });
  await page.clock.runFor(1100);
  s = await snapshot(page);
  expect(s.battle!.enemy.knockdown?.phase).toBe("down");
  expect([s.battle!.player.hp, s.battle!.enemy.hp]).toEqual(hp);
  expect(s.player).toEqual(owned);
  await page.clock.runFor(1100);
  expect((await snapshot(page)).battle!.enemy.knockdown?.phase).toBe("getUp");
  await page.screenshot({
    path: "test-results/screenshots/opponent-throw-getup.png",
  });
  await page.clock.resume();
});

async function twoHandFixture(page: Page, weapon = "greatsword") {
  await page.route("**/content/items.json?_=*", (route) =>
    route.fulfill({ json: liveItems }),
  );
  const p = createPlayer();
  p.gold = 1000;
  p.inventory.push("greatsword", "war-hammer", "battle-axe", "plate", "viking");
  p.equipment = { rightHand: weapon, body: "plate", helmet: "viking" };
  await savedFixture(page, p);
}
function sharedGrip(r: Rig) {
  expect(r.twoHanded.active).toBe(true);
  expect(r.twoHanded.shoulderCarry).toBe(false);
  expect(r.body.backArms).toContain("nearArm");
  expect(r.body.frontArms).toContain("farArm");
  expect(r.weapons.filter((w) => w.visible)).toHaveLength(1);
  expect(r.twoHanded.supportGrip).not.toBeNull();
  expect(
    Math.hypot(
      r.near.hand.x - r.twoHanded.supportGrip!.x,
      r.near.hand.y - r.twoHanded.supportGrip!.y,
    ),
  ).toBeLessThan(0.01);
  anatomy(r, false);
}
for (const [weapon, duration] of [
  ["greatsword", 1150],
  ["war-hammer", 1350],
  ["battle-axe", 1250],
] as const)
  test(`${weapon} holds one weapon with both hands through its own swing and air movement`, async ({
    page,
  }) => {
    await twoHandFixture(page, weapon);
    await page.clock.install();
    await launch(page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    let resting = (await snapshot(page)).rigs![0];
    expect(resting.twoHanded.shoulderCarry).toBe(true);
    expect(resting.near.hand.y - resting.near.shoulder.y).toBeCloseTo(
      69 * resting.scale,
      2,
    );
    expect(resting.body.backArms).toContain("nearArm");
    expect(resting.body.frontArms).toContain("farArm");
    await page.screenshot({
      path: `test-results/screenshots/${weapon}-shoulder-idle.png`,
    });
    await page.keyboard.press("r");
    await page.clock.runFor(500);
    sharedGrip((await snapshot(page)).rigs![0]);
    await page.keyboard.press("r");
    await page.clock.runFor(500);
    resting = (await snapshot(page)).rigs![0];
    expect(resting.twoHanded.shoulderCarry).toBe(true);
    anatomy(resting, false);
    await page.clock.resume();
    await click(page, "battle");
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
    sharedGrip((await snapshot(page)).rigs![0]);
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.clock.runFor(duration * 0.3);
    let s = await snapshot(page);
    sharedGrip(s.rigs![0]);
    expect(s.battle!.player.handActions.front).toBeNull();
    expect(s.battle!.player.handActions.rear?.duration).toBe(duration);
    await page.screenshot({
      path: `test-results/screenshots/${weapon}-backswing.png`,
    });
    await page.clock.runFor(duration * 0.3);
    sharedGrip((await snapshot(page)).rigs![0]);
    await page.screenshot({
      path: `test-results/screenshots/${weapon}-swing.png`,
    });
    await page.clock.runFor(duration * 0.45 + 500);
    await page.keyboard.press("Space");
    await page.clock.runFor(100);
    s = await snapshot(page);
    expect(s.battle!.player.y).toBeLessThan(0);
    sharedGrip(s.rigs![0]);
    await page.clock.resume();
  });

test("shop offers all three two-handed weapons and equipping one releases the offhand into the backpack", async ({
  page,
}) => {
  await twoHandFixture(page, "wood");
  await launch(page);
  await click(page, "character");
  await click(page, "unequip-rightHand");
  await click(page, "slot-leftHand");
  await click(page, "equip-wood");
  await click(page, "equip-greatsword");
  await expect
    .poll(async () => {
      const r = (await snapshot(page)).rigs![0];
      return (r.near.hand.y - r.near.shoulder.y) / r.scale;
    })
    .toBeCloseTo(69, 2);
  let s = await snapshot(page);
  expect(s.player.equipment.rightHand).toBe("greatsword");
  expect(s.player.equipment.leftHand).toBeUndefined();
  expect(s.player.inventory).toContain("wood");
  const resting = s.rigs![0];
  expect(resting.twoHanded.shoulderCarry).toBe(true);
  expect(resting.body.frontArms).toContain("farArm");
  expect(resting.body.backArms).toContain("nearArm");
  expect(resting.near.hand.y - resting.near.shoulder.y).toBeCloseTo(
    69 * resting.scale,
    2,
  );
  anatomy(resting, false);
  await page.screenshot({
    path: "test-results/screenshots/two-handed-inventory.png",
  });
  await click(page, "back");
  await click(page, "shop");
  await click(page, "shop-weapons");
  await click(page, "shop-prev");
  s = await snapshot(page);
  for (const id of ["greatsword", "war-hammer", "battle-axe"])
    expect(s.buttons[`buy-${id}`]).toBeTruthy();
  await page.screenshot({
    path: "test-results/screenshots/two-handed-shop.png",
  });
});
async function approachClose(page: Page, range: number) {
  await page.keyboard.down("d");
  await page.keyboard.down("Shift");
  for (let i = 0; i < 100; i++) {
    const b = (await snapshot(page)).battle!;
    if (Math.abs(b.enemy.x - b.player.x) <= range) break;
    await page.clock.runFor(32);
  }
  await page.keyboard.up("d");
  await page.keyboard.up("Shift");
}
test("V drives the held shaft into a nearby enemy and pushes without damage or a fall", async ({
  page,
}) => {
  await twoHandFixture(page);
  await page.clock.install();
  await launch(page);
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  await approachClose(page, 78);
  for (let i = 0; i < 60; i++) {
    const b = (await snapshot(page)).battle!;
    if (
      !b.player.action &&
      b.player.stun === 0 &&
      b.player.bodyCooldown === 0 &&
      b.player.handCooldowns.rear === 0 &&
      b.enemy.action &&
      b.enemy.action.elapsed > 720
    )
      break;
    await page.clock.runFor(32);
  }
  const before = (await snapshot(page)).battle!.enemy.hp;
  await page.keyboard.press("v");
  let hit: ContactEvent | undefined,
    x = 0;
  for (let i = 0; i < 35; i++) {
    await page.clock.runFor(16);
    const s = await snapshot(page);
    hit = s.battle!.contacts.find((e) => e.kind === "shove");
    if (hit) {
      x = s.battle!.enemy.x;
      sharedGrip(s.rigs![0]);
      break;
    }
  }
  expect(hit).toBeTruthy();
  expect(hit!.damage).toBe(0);
  expect(contact(hit!.blade, hit!.body)).not.toBeNull();
  await page.screenshot({
    path: "test-results/screenshots/two-handed-shove.png",
  });
  await page.clock.runFor(800);
  const b = (await snapshot(page)).battle!;
  expect(b.enemy.x - x).toBeGreaterThan(150);
  expect(b.enemy.hp).toBe(before);
  expect(b.enemy.knockdown).toBeNull();
  await page.clock.resume();
});
for (const weapon of ["wood", "greatsword"])
  test(`${weapon} physically finishes a grounded opponent in one hit with X`, async ({
    page,
  }) => {
    await twoHandFixture(page, weapon);
    await page.clock.install();
    await launch(page);
    await click(page, "battle");
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
    await approachClose(page, 94);
    for (let i = 0; i < 60; i++) {
      const b = (await snapshot(page)).battle!;
      if (b.enemy.grapple?.role === "target") break;
      if (!b.player.grapple) await page.keyboard.press("h");
      await page.clock.runFor(80);
    }
    expect((await snapshot(page)).battle!.enemy.grapple?.role).toBe("target");
    await page.clock.runFor(1100);
    await page.keyboard.press("h");
    await page.clock.runFor(500);
    await page.keyboard.down("d");
    await page.keyboard.down("Shift");
    let ready = false;
    for (let i = 0; i < 60; i++) {
      await page.clock.runFor(16);
      const s = await snapshot(page),
        b = s.battle!;
      const parts = s.geometry![1].body.filter(
        (c) => Math.min(c.a.y, c.b.y) > 440,
      );
      const left = Math.min(
        ...parts.map((c) => Math.min(c.a.x, c.b.x) - c.radius),
      );
      if (b.enemy.knockdown?.phase === "down" && left - b.player.x <= 70) {
        ready = true;
        break;
      }
    }
    await page.keyboard.up("d");
    await page.keyboard.up("Shift");
    expect(ready).toBe(true);
    const hp = (await snapshot(page)).battle!.enemy.hp;
    await page.keyboard.press("x");
    await page.clock.runFor(300);
    expect((await snapshot(page)).battle!.player.finisher?.role).toBe(
      "executor",
    );
    const boundX = (await snapshot(page)).battle!.player.x;
    await page.keyboard.down("a");
    await page.keyboard.press("Space");
    await page.clock.runFor(100);
    await page.keyboard.up("a");
    expect((await snapshot(page)).battle!.player.x).toBeCloseTo(boundX, 3);
    await page.screenshot({
      path: `test-results/screenshots/${weapon}-finisher-windup.png`,
    });
    let hit: ContactEvent | undefined;
    for (let i = 0; i < 50; i++) {
      await page.clock.runFor(16);
      const s = await snapshot(page);
      hit = s.battle!.contacts.find((e) => e.kind === "finisher");
      if (hit) break;
    }
    expect(hit).toBeTruthy();
    expect(hit!.damage).toBe(hp);
    expect(contact(hit!.blade, hit!.body)).not.toBeNull();
    expect((await snapshot(page)).battle!.state).toBe("Victory");
    await page.screenshot({
      path: `test-results/screenshots/${weapon}-finisher-contact.png`,
    });
    await page.clock.resume();
  });

test("camp, character and active arena expose no demonstration or combat action buttons", async ({
  page,
}) => {
  await launch(page);
  let s = await snapshot(page);
  expect(Object.keys(s.buttons).sort()).toEqual([
    "battle",
    "character",
    "ladder",
    "reset",
    "shop",
  ]);
  await click(page, "character");
  s = await snapshot(page);
  expect(
    Object.keys(s.buttons).some(
      (k) => k.startsWith("preview-") || k.startsWith("move-"),
    ),
  ).toBe(false);
  await click(page, "back");
  await click(page, "battle");
  s = await snapshot(page);
  expect(Object.keys(s.buttons)).toEqual([]);
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(
      async () => (await snapshot(page)).battle!.player.handActions.rear?.name,
    )
    .toBe("quick");
});

test("crossbow is bought and equipped, holds its rear elbow in front and front elbow behind, and fires physical bolts without consuming the item", async ({
  page,
}) => {
  await page.route("**/content/items.json?_=*", (route) =>
    route.fulfill({ json: liveItems }),
  );
  const p = createPlayer();
  p.gold = 1000;
  p.inventory.push("plate", "viking");
  p.equipment.body = "plate";
  p.equipment.helmet = "viking";
  await savedFixture(page, p);
  await page.clock.install();
  await launch(page);
  await click(page, "shop");
  await click(page, "shop-next");
  await click(page, "buy-crossbow");
  await click(page, "back");
  await click(page, "character");
  await click(page, "equip-crossbow");
  expect((await snapshot(page)).player.equipment.rightHand).toBe("crossbow");
  await page.screenshot({
    path: "test-results/screenshots/crossbow-equipment.png",
  });
  await click(page, "back");
  await click(page, "battle");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
  let s = await snapshot(page);
  const owned = s.player;
  expect(s.rigs![0].crossbow?.loaded).toBe(true);
  expect(s.rigs![0].body.backArms).toContain("nearArm");
  expect(s.rigs![0].body.frontArms).toContain("farArm");
  const support = s.rigs![0].crossbow!.supportGrip!;
  expect(
    Math.hypot(
      support.x - s.rigs![0].near.hand.x,
      support.y - s.rigs![0].near.hand.y,
    ),
  ).toBeLessThan(0.01);
  await page.mouse.click(640, 400, { button: "right" });
  await page.clock.runFor(400);
  s = await snapshot(page);
  expect(s.battle!.projectiles.filter((v) => v.kind === "bolt")).toHaveLength(
    0,
  );
  await page.screenshot({
    path: "test-results/screenshots/crossbow-aim-ready.png",
  });
  await page.clock.runFor(180);
  s = await snapshot(page);
  expect(s.battle!.projectiles.filter((v) => v.kind === "bolt")).toHaveLength(
    1,
  );
  expect(s.rigs![0].crossbow?.loaded).toBe(false);
  await page.screenshot({
    path: "test-results/screenshots/crossbow-bolt-release.png",
  });
  await page.clock.runFor(700);
  s = await snapshot(page);
  const hit = s.battle!.contacts.find(
    (e) => e.kind === "projectile" && e.attackerId === "wanderer",
  );
  expect(hit).toBeTruthy();
  expect(hit!.damage).toBeGreaterThan(0);
  expect(s.player).toEqual(owned);
  await page.keyboard.press("k");
  await page.clock.runFor(40);
  expect(
    (await snapshot(page)).battle!.projectiles.filter((v) => v.kind === "bolt"),
  ).toHaveLength(1);
  await page.clock.runFor(1800);
  s = await snapshot(page);
  expect(s.player.equipment.rightHand).toBe("crossbow");
  expect(s.rigs![0].crossbow?.loaded).toBe(true);
  await page.clock.resume();
});

test("fresh belts stay empty, Equip fills free slots, and closed armor buys and survives reload before reset", async ({
  page,
}) => {
  await page.route("**/content/items.json?_=*", (route) =>
    route.fulfill({ json: liveItems }),
  );
  const p = createPlayer();
  p.gold = 1000;
  await savedFixture(page, p);
  await launch(page);
  expect((await snapshot(page)).rigs![0].belt).toEqual([]);
  await click(page, "shop");
  await click(page, "buy-rust");
  await click(page, "shop-next");
  await click(page, "buy-throwing-knife");
  await click(page, "buy-throwing-axe");
  await click(page, "shop-next");
  await click(page, "buy-closed-helm");
  await click(page, "buy-cuirass");
  expect((await snapshot(page)).player.gold).toBe(600);
  await shot(page, "closed-armor-shop");
  await click(page, "back");
  await click(page, "character");
  await click(page, "equip-rust");
  expect((await snapshot(page)).player.equipment).toMatchObject({
    rightHand: "wood",
    leftHand: "rust",
  });
  await click(page, "slot-belt1");
  await click(page, "equip-throwing-knife");
  await click(page, "equip-throwing-axe");
  expect((await snapshot(page)).player.equipment).toMatchObject({
    belt1: "throwing-knife",
    belt2: "throwing-axe",
  });
  await click(page, "equip-closed-helm");
  await click(page, "equip-cuirass");
  await shot(page, "closed-helm-cuirass-character");
  const equipped = (await snapshot(page)).player;
  expect(equipped.equipment).toMatchObject({
    helmet: "closed-helm",
    body: "cuirass",
  });
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player).toEqual(equipped);
  await click(page, "battle");
  await shot(page, "closed-armor-arena");
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  await click(page, "reset");
  await click(page, "resetYes");
  expect((await snapshot(page)).player.equipment).toEqual({
    rightHand: "wood",
  });
  expect((await snapshot(page)).rigs![0].belt).toEqual([]);
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.equipment.belt1).toBeUndefined();
  expect((await snapshot(page)).player.equipment.belt2).toBeUndefined();
});

test("backpack sales remove only spare copies and persist gold and equipped gear", async ({
  page,
}) => {
  const p = createPlayer();
  p.gold = 100;
  p.inventory.push("throwing-knife", "rust", "cap", "leather");
  p.quantities = { "throwing-knife": 3 };
  p.equipment.belt1 = "throwing-knife";
  await savedFixture(page, p);
  await launch(page);
  await click(page, "character");
  expect((await snapshot(page)).buttons["sell-wood"]).toBeUndefined();
  await shot(page, "inventory-sale-controls");
  await click(page, "sell-throwing-knife");
  expect(ownedCopies((await snapshot(page)).player, "throwing-knife")).toBe(2);
  await click(page, "sell-throwing-knife");
  let s = await snapshot(page);
  expect(s.player.equipment.belt1).toBe("throwing-knife");
  expect(s.buttons["sell-throwing-knife"]).toBeUndefined();
  for (const id of ["rust", "cap", "leather"]) await click(page, `sell-${id}`);
  s = await snapshot(page);
  expect(s.player.gold).toBe(183);
  expect(s.player.inventory).toEqual(["wood", "throwing-knife"]);
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player).toEqual(s.player);
});

test("a physical hit shatters only the contacted armor piece and repair never restores it", async ({
  page,
}) => {
  const catalog = structuredClone(liveItems);
  for (const it of catalog.items) if (it.slot === "weapon") it.attack = 60;
  catalog.items.find((it) => it.id === "closed-helm")!.armor = 0;
  catalog.items.find((it) => it.id === "cuirass")!.armor = 0;
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: catalog }),
  );
  const p = createPlayer();
  p.inventory.push("closed-helm", "cuirass");
  p.equipment.helmet = "closed-helm";
  p.equipment.body = "cuirass";
  await savedFixture(page, p);
  await launch(page);
  await click(page, "battle");
  await scene(page, "ArenaScene");
  await expect
    .poll(
      async () =>
        (await snapshot(page)).battle?.armorBreaks.filter(
          (e) => e.ownerId === "wanderer",
        ).length,
      { timeout: 20000 },
    )
    .toBeGreaterThan(0);
  const s = await snapshot(page),
    broken = s.battle!.armorBreaks.find((e) => e.ownerId === "wanderer")!;
  expect(s.player.inventory).not.toContain(broken.itemId);
  expect(s.rigs![0].armor[broken.slot as "helmet" | "body"]).toBeUndefined();
  expect(s.battle!.projectiles).toEqual([]);
  await shot(page, "localized-armor-shattering");
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  const repaired = (await snapshot(page)).player;
  expect(repaired.armorWear ?? {}).toEqual({});
  expect(repaired.inventory).not.toContain(broken.itemId);
  await page.reload();
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.inventory).not.toContain(broken.itemId);
});

test("shop separates Weapons, Armor and Misc while preserving consumable quantities", async ({
  page,
}) => {
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: liveItems }),
  );
  const p = createPlayer();
  p.gold = 2000;
  await savedFixture(page, p);
  await launch(page);
  await click(page, "shop");
  const all = new Set<string>();
  for (const category of ["weapons", "armor", "misc"]) {
    await click(page, `shop-${category}`);
    const s = await snapshot(page);
    expect(s.shop!.category).toBe(category);
    for (const id of s.shop!.items) {
      expect(all.has(id)).toBe(false);
      all.add(id);
    }
    expect(
      s.shop!.items.every((id) => s.shop!.itemCategories[id] === category),
    ).toBe(true);
    await shot(page, `shop-category-${category}`);
  }
  expect(all.size).toBe(liveItems.items.length);
  await click(page, "quantity-5");
  await click(page, "buy-healing-potion");
  expect(ownedCopies((await snapshot(page)).player, "healing-potion")).toBe(5);
  expect((await snapshot(page)).shop!.category).toBe("misc");
  await click(page, "shop-armor");
  expect((await snapshot(page)).buttons["buy-wood"]).toBeUndefined();
  await click(page, "buy-closed-helm");
  expect((await snapshot(page)).player.inventory).toContain("closed-helm");
});

for (const weapon of ["wood", "greatsword"])
  test(`${weapon} melee strike tilts toward the mouse while keeping fixed shoulders`, async ({
    page,
  }) => {
    await page.route("**/content/items.json?_=*", (r) =>
      r.fulfill({ json: liveItems }),
    );
    const p = createPlayer();
    if (weapon !== "wood") p.inventory.push(weapon);
    p.equipment.rightHand = weapon;
    await savedFixture(page, p);
    await page.clock.install();
    const poses: Rig[] = [];
    for (const y of [220, 530]) {
      await launch(page);
      await click(page, "battle");
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
      await page.mouse.move(750, y);
      await page.clock.runFor(32);
      await page.keyboard.press("k");
      await page.clock.runFor(500);
      const s = await snapshot(page);
      expect(s.battle!.player.handActions.rear?.name).toBe("quick");
      poses.push(s.rigs![0]);
      await page.screenshot({
        path: `test-results/screenshots/melee-aim-${weapon}-${y}.png`,
      });
      const geometry = s.geometry![0].blades!.rear!;
      expect(Number.isFinite(geometry.a.y)).toBe(true);
      await page.clock.resume();
    }
    expect(poses[0].far.hand.y).toBeLessThan(poses[1].far.hand.y - 3);
    for (const r of poses) anatomy(r);
  });

test("localized damage shows actual numbers, subtle cracks and repairs survivors on exit", async ({
  page,
}) => {
  await page.route("**/content/items.json?_=*", (r) =>
    r.fulfill({ json: liveItems }),
  );
  const p = createPlayer();
  p.inventory.push("closed-helm", "cuirass");
  p.equipment.helmet = "closed-helm";
  p.equipment.body = "cuirass";
  await savedFixture(page, p);
  await launch(page);
  await click(page, "battle");
  await expect
    .poll(async () => (await snapshot(page)).battle!.contacts.length, {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  let s = await snapshot(page);
  const hit = s.battle!.contacts.find((e) => e.defenderId === "wanderer")!;
  expect(hit.hitRegion).toBeTruthy();
  const damagedId = hit.hitRegion === "helmet" ? "closed-helm" : "cuirass";
  expect(s.player.armorWear?.[damagedId]).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      (value) =>
        (
          window as unknown as {
            __arena: { display: () => { texts: { text: string }[] } };
          }
        ).__arena
          .display()
          .texts.some((t) => t.text === value),
      String(hit.damage),
    ),
  ).toBe(true);
  await expect
    .poll(
      async () =>
        Math.max(...Object.values((await snapshot(page)).rigs![0].armorDamage)),
      { timeout: 25000 },
    )
    .toBeGreaterThan(0.75);
  s = await snapshot(page);
  const ratios = s.rigs![0].armorCracks;
  expect(Math.max(...Object.values(ratios).map((v) => v ?? 0))).toBeGreaterThan(
    0,
  );
  expect(
    Math.max(...Object.values(ratios).map((v) => v ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  await shot(page, "subtle-damaged-armor-cracks");
  const surviving = { ...(await snapshot(page)).player.equipment };
  await page.keyboard.press("Escape");
  await scene(page, "MainMenuScene");
  expect((await snapshot(page)).player.armorWear ?? {}).toEqual({});
  expect((await snapshot(page)).player.equipment).toEqual(surviving);
  expect(
    Object.values((await snapshot(page)).rigs![0].armorCracks).every(
      (v) => v === 0,
    ),
  ).toBe(true);
  await shot(page, "armor-repaired-after-combat");
});
