import { test, expect as baseExpect, type Page } from "@playwright/test";
import bundled from "../fixtures/catalog.json" with { type: "json" };
import type { displayFor } from "../../src/app/display";
// Software WebGL at high DPI needs time to rebuild scene text and textures.
const expect = baseExpect.configure({ timeout: 15000 });
type DisplayInfo = ReturnType<ReturnType<typeof displayFor>["snapshot"]>;
interface State {
  scene: string;
  player: { gold: number };
  buttons: Record<string, { x: number; y: number }>;
  rigs?: { origin: { x: number; y: number } }[];
  battle?: { player: { action: { name: string } | null; x: number } };
}
const state = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __arena: { snapshot: () => State } }
    ).__arena.snapshot(),
  );
const display = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __arena: { display: () => DisplayInfo } }
    ).__arena.display(),
  );
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function click(page: Page, id: string) {
  await frames(page);
  const s = await state(page),
    box = await page.locator("canvas").boundingBox(),
    p = s.buttons[id];
  await page.mouse.click(
    box!.x + (p.x * box!.width) / 1280,
    box!.y + (p.y * box!.height) / 720,
  );
}
function sharp(d: DisplayInfo) {
  expect(d.backing.width + 1).toBeGreaterThanOrEqual(d.css.width * d.dpr);
  expect(d.backing.height + 1).toBeGreaterThanOrEqual(d.css.height * d.dpr);
  expect(d.logical).toEqual({ width: 1280, height: 720 });
  expect(d.camera!.center!.x).toBeCloseTo(640, 4);
  expect(d.camera!.center!.y).toBeCloseTo(360, 4);
  expect(d.camera!.width / d.camera!.zoom).toBeCloseTo(1280, 4);
  expect(d.camera!.height / d.camera!.zoom).toBeCloseTo(720, 4);
  expect(d.texts.length).toBeGreaterThan(5);
  for (const text of d.texts) {
    expect(text.resolution).toBe(d.density);
    expect(text.bitmapWidth + 1).toBeGreaterThanOrEqual(text.width * d.density);
    expect(text.bitmapHeight + 1).toBeGreaterThanOrEqual(
      text.height * d.density,
    );
  }
}
for (const profile of [
  {
    name: "1440p-webgl",
    width: 2560,
    height: 1440,
    dpr: 1,
    canvas: false,
    density: 2,
  },
  {
    name: "retina-webgl",
    width: 1280,
    height: 720,
    dpr: 2,
    canvas: false,
    density: 2,
  },
  {
    name: "fractional-dpi-canvas",
    width: 1920,
    height: 1080,
    dpr: 1.25,
    canvas: true,
    density: 1.875,
  },
  {
    name: "4k-canvas",
    width: 3840,
    height: 2160,
    dpr: 1,
    canvas: true,
    density: 3,
  },
]) {
  test.describe(`sharp display ${profile.name}`, () => {
    test.use({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr,
    });
    test("renders at physical resolution and preserves UI/input through scene changes", async ({
      page,
    }) => {
      if (profile.name === "1440p-webgl") test.setTimeout(180000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.route("**/content/items.json?_=*", (route) =>
        route.fulfill({ json: bundled }),
      );
      await page.goto(
        `/?seed=42&manual=1${profile.canvas ? "&renderer=canvas" : ""}`,
      );
      await page.waitForFunction(
        () =>
          (
            window as unknown as { __arena?: { snapshot: () => State } }
          ).__arena?.snapshot()?.scene === "MainMenuScene",
      );
      await frames(page);
      const initial = await display(page);
      expect(initial.density).toBe(profile.density);
      sharp(initial);
      expect(
        initial.texts.find((t) => t.text === "Enter the arena")!.resolution,
      ).toBe(profile.density);
      await page.screenshot({
        path: `test-results/screenshots/display-${profile.name}.png`,
      });
      // Seed a completed fight: the shop is now an exclusive post-battle visit.
      await page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem("arena-of-ash.v3")!);
        const battleId = crypto.randomUUID();
        save.player.rewarded.push(battleId);
        save.player.postBattle = {
          battleId,
          outcome: "Victory",
          opponent: "Display fixture",
          gold: 0,
          choice: "pending",
          consumed: false,
          completed: false,
        };
        localStorage.setItem("arena-of-ash.v3", JSON.stringify(save));
      });
      await page.reload();
      await expect
        .poll(async () => (await state(page))?.scene)
        .toBe("ResultScene");
      sharp(await display(page));
      await click(page, "visit-shop");
      await expect
        .poll(async () => (await state(page)).scene)
        .toBe("ShopScene");
      await frames(page);
      sharp(await display(page));
      await click(page, "back");
      await expect
        .poll(async () => (await state(page)).scene)
        .toBe("MainMenuScene");
      await frames(page);
      expect((await display(page)).texts.length).toBe(initial.texts.length);
      expect((await state(page)).rigs![0].origin.x).toBe(960);
      if (profile.name === "1440p-webgl") {
        await page.setViewportSize({ width: 1280, height: 720 });
        await expect.poll(async () => (await display(page)).density).toBe(1);
        await frames(page);
        sharp(await display(page));
        await page.setViewportSize({ width: 1920, height: 1080 });
        await expect.poll(async () => (await display(page)).density).toBe(1.5);
        await frames(page);
        sharp(await display(page));
        // Simulate moving the existing window to a higher-DPI monitor, without reloading.
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setDeviceMetricsOverride", {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 2,
          mobile: false,
        });
        await expect.poll(async () => (await display(page)).density).toBe(3);
        await frames(page);
        sharp(await display(page));
        expect((await state(page)).player.gold).toBe(100);
        await click(page, "battle");
        await expect
          .poll(async () => (await state(page)).scene)
          .toBe("ArenaScene");
        await frames(page);
        sharp(await display(page));
        expect((await state(page)).battle!.player.x).toBe(370);
        await page.keyboard.press("k");
        await expect
          .poll(async () => (await state(page)).battle?.player.action?.name)
          .toBe("quick");
        await page.keyboard.press("Escape");
        await expect
          .poll(async () => (await state(page)).scene)
          .toBe("MainMenuScene");
        expect((await state(page)).player.gold).toBe(100);
      }
      expect(errors).toEqual([]);
    });
  });
}
