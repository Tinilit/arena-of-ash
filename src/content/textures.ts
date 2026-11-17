import type Phaser from "phaser";
import type { Item } from "../domain/model";

export const itemTextureKey = (id: string) => `content-item:${id}`;

/** Decode each optional image before opening scenes; failed art uses its fallback. */
export async function loadItemTextures(
  scene: Phaser.Scene,
  items: Item[],
): Promise<number> {
  let failed = 0,
    next = 0;
  const deadline = Date.now() + 8000;
  const images = items.filter((i) => i.image);
  const load = (item: Item) =>
    new Promise<void>((resolve) => {
      if (Date.now() >= deadline) {
        failed++;
        resolve();
        return;
      }
      const image = new Image();
      image.crossOrigin = "anonymous";
      const timer = setTimeout(
        () => finish(false),
        Math.max(1, deadline - Date.now()),
      );
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (ok) {
          try {
            scene.textures.addImage(itemTextureKey(item.id), image);
          } catch {
            failed++;
          }
        } else {
          failed++;
          image.removeAttribute("src");
        }
        resolve();
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = item.image!.src;
    });
  // Bound concurrency when a content pack adds many images.
  await Promise.all(
    Array.from({ length: Math.min(6, images.length) }, async () => {
      while (next < images.length) await load(images[next++]);
    }),
  );
  return failed;
}
