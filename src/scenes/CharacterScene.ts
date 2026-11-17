import { BaseScene } from "./BaseScene";
import { Gladiator } from "../characters/Gladiator";
import { label, panel, ProgressBar, colors } from "../ui/widgets";
import { en } from "../ui/strings";
import { attributes } from "../domain/model";
import {
  allocate,
  equip,
  canEquip,
  stats,
  threshold,
} from "../domain/progression";
import { item, items } from "../data/catalog";
export class CharacterScene extends BaseScene {
  private rig!: Gladiator;
  constructor() {
    super("CharacterScene");
  }
  create(data: { page?: number } = {}) {
    this.prepare(en.characterTitle);
    const p = this.services.player;
    const pages = Math.max(1, Math.ceil(p.inventory.length / 8)),
      page = Math.max(0, Math.min(data.page ?? 0, pages - 1));
    const large =
      item(p.equipment.weapon ?? "")?.weaponType === "spear" ||
      item(p.equipment.helmet ?? "")?.visual === "viking";
    panel(this, 268, 352, 460, 400);
    panel(this, 880, 368, 678, 432);
    this.rig = new Gladiator(this, 255, 432, p, false, large ? 0.74 : 0.82, {
      stance: "relaxed",
    });
    label(this, 70, 183, `${p.name} • ${en.level} ${p.level}`, 25);
    const xp = new ProgressBar(this, 70, 468, 390, colors.gold);
    xp.update(p.xp, threshold(p.level));
    const st = stats(p);
    label(
      this,
      70,
      508,
      `HP ${st.hp} • SP ${st.stamina} • ⚔ ${st.attack.toFixed(0)} • ◇ ${st.armor}`,
      19,
    );
    label(this, 570, 181, `${en.points}: ${p.points}`, 24);
    attributes.forEach((a, i) => {
      const y = 222 + i * 40;
      label(this, 570, y, `${en.attributes[a]}: ${p.attributes[a]}`, 21);
      this.button(
        `attribute-${a}`,
        820,
        y,
        45,
        "+",
        () => {
          if (allocate(p, a)) {
            this.services.save();
            this.scene.restart({ page });
          }
        },
        32,
      ).setEnabled(p.points > 0);
    });
    label(this, 920, 181, en.inventory, 19);
    p.inventory.slice(page * 8, (page + 1) * 8).forEach((id, i) => {
      const def = item(id)!;
      const y = 220 + i * 41;
      const worn = p.equipment[def.slot] === id;
      const name = label(this, 905, y, def.name, 17);
      if (name.width > 193) name.setFontSize((17 * 193) / name.width);
      this.button(
        `equip-${id}`,
        1160,
        y,
        105,
        worn ? "✓" : canEquip(p, id, def.slot) ? en.equip : en.blocked,
        () => {
          if (equip(p, id, def.slot)) {
            this.services.save();
            this.scene.restart({ page });
          }
        },
        32,
      ).setEnabled(!worn && canEquip(p, id, def.slot));
    });
    Object.entries(en.slots)
      .filter(([slot]) => items.some((it) => it.slot === slot))
      .forEach(([slot, name], i) => {
        const id = p.equipment[slot as keyof typeof p.equipment];
        const gear = label(
          this,
          568,
          420 + i * 39,
          `${name}: ${id ? item(id)?.name : en.noGear}`,
          19,
        );
        if (gear.width > 320) gear.setFontSize((19 * 320) / gear.width);
      });
    this.button(
      "inventory-prev",
      941,
      550,
      65,
      "←",
      () => this.scene.restart({ page: page - 1 }),
      32,
    ).setEnabled(page > 0);
    label(this, 1063, 550, `${en.page} ${page + 1} / ${pages}`, 16).setOrigin(
      0.5,
    );
    this.button(
      "inventory-next",
      1185,
      550,
      65,
      "→",
      () => this.scene.restart({ page: page + 1 }),
      32,
    ).setEnabled(page + 1 < pages);
    this.back();
  }
  update(_time: number, delta: number) {
    this.rig?.update(delta);
  }
}
