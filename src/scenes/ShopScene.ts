import { BaseScene } from "./BaseScene";
import { items } from "../data/catalog";
import { purchase, quantity } from "../domain/progression";
import { label, panel } from "../ui/widgets";
import { drawGear } from "../rendering/characterVisuals";
import { en } from "../ui/strings";
import {
  shopCategory,
  shopStock,
  shopCategories,
  type ShopCategory,
} from "../domain/shop";
const PAGE_SIZE = 8;
export class ShopScene extends BaseScene {
  private category: ShopCategory = "weapons";
  private page = 0;
  constructor() {
    super("ShopScene");
  }
  create(
    data: { page?: number; amount?: number; category?: ShopCategory } = {},
  ) {
    this.prepare(en.shopTitle);
    const category = shopCategories.includes(data.category!)
      ? data.category!
      : "weapons";
    this.category = category;
    const stock = shopStock(items, category);
    const p = this.services.player,
      pages = Math.max(1, Math.ceil(stock.length / PAGE_SIZE)),
      page = Math.max(0, Math.min(data.page ?? 0, pages - 1)),
      amount = [1, 5, 10].includes(data.amount ?? 1) ? (data.amount ?? 1) : 1;
    this.page = page;
    shopCategories.forEach((name, i) =>
      this.button(
        `shop-${name}`,
        135 + i * 160,
        108,
        145,
        name[0].toUpperCase() + name.slice(1),
        () => this.scene.restart({ category: name, amount }),
        34,
      ).setAlpha(name === category ? 1 : 0.65),
    );
    label(this, 545, 108, "Consumable quantity", 16);
    [1, 5, 10].forEach((n, i) =>
      this.button(
        `quantity-${n}`,
        760 + i * 104,
        108,
        90,
        `×${n}`,
        () => this.scene.restart({ page, category, amount: n }),
        32,
      ).setAlpha(n === amount ? 1 : 0.65),
    );
    stock.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).forEach((it, i) => {
      const x = 42 + (i % 2) * 626,
        y = 192 + Math.floor(i / 2) * 108;
      panel(this, x + 285, y + 20, 570, 96);
      const visual = drawGear(this, it),
        b = visual.getBounds(),
        scale = Math.min(58 / b.width, 74 / b.height);
      visual
        .setScale(scale)
        .setPosition(x + 42 - b.centerX * scale, y + 20 - b.centerY * scale);
      const name = label(this, x + 85, y - 10, it.name, 21);
      if (name.width > 290) name.setFontSize((21 * 290) / name.width);
      const owned = quantity(p, it.id),
        count = it.use ? amount : 1;
      const info = label(
        this,
        x + 85,
        y + 17,
        `${it.effect === "haste" ? "×2 speed · 10s" : it.heal ? `+${it.heal} HP` : it.attack ? `${it.attack} damage` : `+${it.armor} ${en.armor}`} • ${it.price} ◈ each • Owned: ${owned}`,
        16,
        "#b9aa8d",
      );
      if (info.width > 290) info.setFontSize((16 * 290) / info.width);
      if (it.description)
        label(this, x + 85, y + 42, it.description, 13, "#d0c2a6");
      this.button(
        `buy-${it.id}`,
        x + 466,
        y + 18,
        155,
        it.use ? `Buy ×${count}` : owned ? en.owned : en.buy,
        () => {
          if (purchase(p, it.id, count)) {
            this.services.save();
            this.scene.restart({ page, category, amount });
          }
        },
        42,
      ).setEnabled((Boolean(it.use) || !owned) && p.gold >= it.price * count);
    });
    this.back();
    this.button("shop-prev", 500, 670, 200, en.previous, () =>
      this.scene.restart({ page: page - 1, category, amount }),
    ).setEnabled(page > 0);
    label(this, 735, 670, `${en.page} ${page + 1} / ${pages}`, 20).setOrigin(
      0.5,
    );
    this.button("shop-next", 970, 670, 200, en.nextPage, () =>
      this.scene.restart({ page: page + 1, category, amount }),
    ).setEnabled(page + 1 < pages);
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      shop: {
        category: this.category,
        page: this.page,
        itemCategories: Object.fromEntries(
          items.map((item) => [item.id, shopCategory(item)]),
        ),
        items: shopStock(items, this.category).map((item) => item.id),
      },
    };
  }
}
