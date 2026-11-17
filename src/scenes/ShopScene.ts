import { BaseScene } from "./BaseScene";
import { items } from "../data/catalog";
import { purchase } from "../domain/progression";
import { label, panel } from "../ui/widgets";
import { en } from "../ui/strings";
export class ShopScene extends BaseScene {
  constructor() {
    super("ShopScene");
  }
  create() {
    this.prepare(en.shopTitle);
    const p = this.services.player;
    items.forEach((it, i) => {
      const x = 42 + (i % 2) * 626;
      const y = 192 + Math.floor(i / 2) * 108;
      panel(this, x + 285, y + 20, 570, 96);
      label(this, x + 18, y - 4, it.name, 23);
      label(
        this,
        x + 18,
        y + 29,
        `${en.slots[it.slot]} • ${it.attack ? `+${it.attack} ${en.damage}` : `+${it.armor} ${en.armor}`} • ${it.price} ◈`,
        17,
        "#b9aa8d",
      );
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
            this.scene.restart();
          }
        },
        42,
      ).setEnabled(!owned && p.gold >= it.price);
    });
    this.back();
  }
}
