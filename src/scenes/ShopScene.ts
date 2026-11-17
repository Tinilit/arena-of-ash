import { BaseScene } from "./BaseScene";
import { items } from "../data/catalog";
import { purchase } from "../domain/progression";
import { label, panel } from "../ui/widgets";
import { drawGear } from "../rendering/characterVisuals";
import { en } from "../ui/strings";
const PAGE_SIZE = 8;
export class ShopScene extends BaseScene {
  constructor() {
    super("ShopScene");
  }
  create(data: { page?: number } = {}) {
    this.prepare(en.shopTitle);
    const p = this.services.player,
      pages = Math.ceil(items.length / PAGE_SIZE),
      page = Math.max(0, Math.min(data.page ?? 0, pages - 1));
    items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).forEach((it, i) => {
      const x = 42 + (i % 2) * 626,
        y = 192 + Math.floor(i / 2) * 108;
      panel(this, x + 285, y + 20, 570, 96);
      const visual = drawGear(this, it.visual),
        b = visual.getBounds(),
        scale = Math.min(58 / b.width, 74 / b.height);
      visual
        .setScale(scale)
        .setPosition(x + 42 - b.centerX * scale, y + 20 - b.centerY * scale);
      label(this, x + 85, y - 10, it.name, 21);
      label(
        this,
        x + 85,
        y + 17,
        `${en.slots[it.slot]} • ${it.attack ? `+${it.attack} ${en.damage}` : `+${it.armor} ${en.armor}`} • ${it.price} ◈`,
        16,
        "#b9aa8d",
      );
      if (it.description)
        label(this, x + 85, y + 42, it.description, 13, "#d0c2a6");
      const owned = p.inventory.includes(it.id);
      this.button(
        `buy-${it.id}`,
        x + 466,
        y + 18,
        155,
        owned ? en.owned : en.buy,
        () => {
          if (purchase(p, it.id)) {
            this.services.save();
            this.scene.restart({ page });
          }
        },
        42,
      ).setEnabled(!owned && p.gold >= it.price);
    });
    this.back();
    this.button("shop-prev", 500, 670, 200, en.previous, () =>
      this.scene.restart({ page: page - 1 }),
    ).setEnabled(page > 0);
    label(this, 735, 670, `${en.page} ${page + 1} / ${pages}`, 20).setOrigin(
      0.5,
    );
    this.button("shop-next", 970, 670, 200, en.nextPage, () =>
      this.scene.restart({ page: page + 1 }),
    ).setEnabled(page + 1 < pages);
  }
}
