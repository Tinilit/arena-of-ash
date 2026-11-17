import bundled from "../../public/content/items.json";
import { parseCatalog, type Catalog } from "./schema";

export interface LoadedCatalog extends Catalog {
  source: "live" | "bundled";
}
export const publishedCatalogUrl =
  "https://raw.githubusercontent.com/Tinilit/arena-of-ash/main/public/content/items.json";

export async function loadCatalog(
  url: string,
  request: typeof fetch = fetch,
  fallbackUrl = url,
): Promise<LoadedCatalog> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const fresh = new URL(url);
    fresh.searchParams.set("_", String(Date.now()));
    const response = await request(fresh.href, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw Error(`Catalog HTTP ${response.status}`);
    return { ...parseCatalog(await response.json(), url), source: "live" };
  } catch {
    return { ...parseCatalog(bundled, fallbackUrl), source: "bundled" };
  } finally {
    clearTimeout(timer);
  }
}
