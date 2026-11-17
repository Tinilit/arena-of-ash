import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import bundled from "../../public/content/items.json";
import fixture from "../fixtures/catalog.json";
import { parseCatalog } from "../../src/content/schema";
import { loadCatalog } from "../../src/content/loadCatalog";
import { items, installCatalog, item } from "../../src/data/catalog";
import { createPlayer } from "../../src/domain/model";
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
      (raw: ReturnType<typeof candidate>) => (raw.version = 2),
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
    expect(equip(p, "test-spear", "weapon")).toBe(true);
    expect(p.gold).toBe(80);
    expect(stats(p).attack).toBe(32);
    expect(deserialize(serialize(p)).equipment.weapon).toBe("test-spear");
    expect(item("test-spear")?.attack).toBe(17);
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
