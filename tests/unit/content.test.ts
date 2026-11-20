import { trainedGladiator as createPlayer } from "../fixtures/trained";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import bundled from "../../public/content/items.json";
import fixture from "../fixtures/catalog.json";
import { parseCatalog } from "../../src/content/schema";
import { loadCatalog } from "../../src/content/loadCatalog";
import { items, installCatalog, item } from "../../src/data/catalog";

import { purchase, equip, stats } from "../../src/domain/progression";
import { deserialize, serialize } from "../../src/persistence/save";

const source = "https://example.com/game/content/items.json";
const candidate = () => structuredClone(fixture);
const image = {
  src: "items/test-spear.png",
  width: 38,
  height: 244,
  originX: 0.5,
  originY: 0.63,
};
afterEach(() => {
  installCatalog(parseCatalog(bundled).items);
  vi.useRealTimers();
});

describe("runtime content contract", () => {
  it("validates the published file and every referenced image before content-only publication", () => {
    const raw = JSON.parse(readFileSync("public/content/items.json", "utf8"));
    const catalog = parseCatalog(raw, source);
    expect(catalog.items.length).toBeGreaterThanOrEqual(7);
    for (const entry of raw.items)
      if (entry.image)
        expect(
          existsSync(resolve("public/content", entry.image.src)),
          entry.image.src,
        ).toBe(true);
  });
  it("resolves artwork relative to the catalog and versions the image request", () => {
    const raw = candidate();
    const custom = { ...raw.items[3], id: "test-spear", image };
    const parsed = parseCatalog(
      { ...raw, items: [...raw.items, custom] },
      source,
    );
    expect(parsed.items.at(-1)?.image).toEqual({
      ...image,
      src: `${source.replace("items.json", image.src)}?rev=${raw.revision}`,
    });
  });
  it.each([
    [
      "duplicate ID",
      (raw: ReturnType<typeof candidate>) => raw.items.push(raw.items[0]),
    ],
    [
      "missing starter",
      (raw: ReturnType<typeof candidate>) => raw.items.shift(),
    ],
    [
      "unknown slot",
      (raw: ReturnType<typeof candidate>) => (raw.items[0].slot = "ring"),
    ],
    [
      "invalid visual",
      (raw: ReturnType<typeof candidate>) => (raw.items[0].visual = "missing"),
    ],
    [
      "negative price",
      (raw: ReturnType<typeof candidate>) => (raw.items[0].price = -1),
    ],
    [
      "fractional stats",
      (raw: ReturnType<typeof candidate>) => (raw.items[0].attack = 1.5),
    ],
    [
      "unknown animation",
      (raw: ReturnType<typeof candidate>) =>
        (raw.items[0].weaponType = "magic"),
    ],
    [
      "mismatched spear animation",
      (raw: ReturnType<typeof candidate>) =>
        (raw.items[3].weaponType = "sword"),
    ],
    [
      "unsupported version",
      (raw: ReturnType<typeof candidate>) => (raw.version = 99),
    ],
  ])("rejects %s without changing the active catalog", (_name, mutate) => {
    const raw = candidate(),
      before = JSON.stringify(items);
    mutate(raw);
    expect(() => parseCatalog(raw, source)).toThrow();
    expect(JSON.stringify(items)).toBe(before);
  });
  it.each([
    "../secret.png",
    "/absolute.png",
    "https://other.test/a.png",
    "items/a.svg",
    "items/a.png?x=1",
  ])("rejects unsafe or unsupported art path %s", (src) => {
    const raw = candidate();
    expect(() =>
      parseCatalog(
        {
          ...raw,
          items: [
            ...raw.items,
            { ...raw.items[3], id: "image-test", image: { ...image, src } },
          ],
        },
        source,
      ),
    ).toThrow();
  });
  it("rejects non-finite dimensions and origins outside the image", () => {
    for (const changes of [
      { width: Infinity },
      { height: 0 },
      { originX: -1 },
      { originY: 2 },
    ]) {
      const raw = candidate();
      expect(() =>
        parseCatalog(
          {
            ...raw,
            items: [
              ...raw.items,
              {
                ...raw.items[3],
                id: "image-test",
                image: { ...image, ...changes },
              },
            ],
          },
          source,
        ),
      ).toThrow();
    }
  });
  it("purchases, equips and saves a newly installed definition using live stats", () => {
    const raw = candidate();
    installCatalog(
      parseCatalog({
        ...raw,
        items: [
          ...raw.items,
          { ...raw.items[3], id: "test-spear", price: 20, attack: 17 },
        ],
      }).items,
    );
    const p = createPlayer();
    expect(purchase(p, "test-spear")).toBe(true);
    expect(equip(p, "test-spear", "rightHand")).toBe(true);
    expect(p.gold).toBe(80);
    expect(stats(p).attack).toBe(29);
    expect(deserialize(serialize(p)).equipment.rightHand).toBe("test-spear");
    expect(item("test-spear")?.attack).toBe(29);
  });
});

describe("runtime catalog fetching", () => {
  it("requests fresh content and validates before returning it", async () => {
    const raw = candidate();
    raw.revision = "new-revision";
    raw.items[0].price = 99;
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(raw)));
    const loaded = await loadCatalog(source, request);
    expect(loaded.source).toBe("live");
    expect(loaded.revision).toBe("new-revision");
    expect(loaded.items[0].price).toBe(99);
    expect(request.mock.calls[0][0]).toMatch(/items.json\?_=/);
    expect(request.mock.calls[0][1]?.cache).toBe("no-store");
  });
  it.each(["network", "http", "json", "schema"])(
    "uses the bundled fallback after a %s failure",
    async (failure) => {
      const request = vi.fn<typeof fetch>();
      if (failure === "network") request.mockRejectedValue(Error("Offline"));
      else
        request.mockResolvedValue(
          failure === "http"
            ? new Response("missing", { status: 404 })
            : new Response(failure === "json" ? "{" : '{"items":[]}'),
        );
      const loaded = await loadCatalog(source, request);
      expect(loaded.source).toBe("bundled");
      expect(loaded.items).toEqual(parseCatalog(bundled).items);
    },
  );
  it("aborts a stalled request and permits startup with included equipment", async () => {
    vi.useFakeTimers();
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options!.signal!.addEventListener("abort", () =>
              reject(Error("Aborted")),
            ),
          ),
      );
    const pending = loadCatalog(source, request);
    await vi.advanceTimersByTimeAsync(8000);
    expect((await pending).source).toBe("bundled");
  });
});

it("supports runtime throwable profiles and healing values while rejecting invalid use contracts", () => {
  const raw = candidate();
  const knife = raw.items.find((i) => i.id === "throwing-knife")!;
  const potion = raw.items.find((i) => i.id === "healing-potion")!;
  const catalog = parseCatalog({
    ...raw,
    items: raw.items.map((i) =>
      i.id === knife.id
        ? { ...i, hitbox: { startY: -50, endY: -9, radius: 3 } }
        : i.id === potion.id
          ? { ...i, heal: 50 }
          : i,
    ),
  });
  expect(catalog.items.find((i) => i.id === knife.id)?.hitbox?.startY).toBe(
    -50,
  );
  expect(catalog.items.find((i) => i.id === potion.id)?.heal).toBe(50);
  for (const replacement of [
    { ...potion, heal: 0 },
    { ...potion, heal: 101 },
    { ...potion, heal: undefined },
    { ...knife, heal: 30 },
    { ...knife, use: "heal" },
    { ...raw.items[0], use: "throw" },
  ]) {
    expect(() =>
      parseCatalog({
        ...raw,
        items: raw.items.map((i) =>
          i.id === replacement.id ? replacement : i,
        ),
      }),
    ).toThrow();
  }
});
it("drops retired belt items without losing coins or other equipment", () => {
  const p = createPlayer();
  p.gold = 777;
  p.inventory.push("net", "flask");
  p.equipment.belt1 = "net";
  p.equipment.belt2 = "flask";
  const loaded = deserialize(serialize(p));
  expect(loaded.gold).toBe(777);
  expect(loaded.equipment.rightHand).toBe("wood");
  expect(loaded.inventory).not.toContain("net");
  expect(loaded.inventory).not.toContain("flask");
  expect(loaded.equipment.belt1).toBeUndefined();
  expect(loaded.equipment.belt2).toBeUndefined();
});

it("normalizes legacy bonuses once while version 2 keeps complete damage", () => {
  const legacy = candidate();
  legacy.items.find((i) => i.id === "wood")!.attack = 6;
  const normalized = parseCatalog(legacy);
  expect(normalized.version).toBe(2);
  expect(normalized.items.find((i) => i.id === "wood")!.attack).toBe(18);
  expect(
    parseCatalog(normalized).items.find((i) => i.id === "wood")!.attack,
  ).toBe(18);
});
