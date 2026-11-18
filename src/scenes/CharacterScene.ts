import { BaseScene } from "./BaseScene";
import { Gladiator } from "../characters/Gladiator";
import { label, panel, ProgressBar, colors } from "../ui/widgets";
import { en } from "../ui/strings";
import {
  attributes,
  equipmentSlots,
  slotCategory,
  type EquipmentSlot,
} from "../domain/model";
import {
  allocate,
  equip,
  canEquip,
  unequip,
  stats,
  threshold,
  primaryWeapon,
} from "../domain/progression";
import { item } from "../data/catalog";
import { drawGear } from "../rendering/characterVisuals";
export class CharacterScene extends BaseScene {
  private rig!: Gladiator;
  constructor() {
    super("CharacterScene");
  }
  create(data: { page?: number; slot?: EquipmentSlot } = {}) {
    this.prepare(en.characterTitle);
    const p = this.services.player,
      slot = data.slot ?? "rightHand";
    const inventory = p.inventory.filter(
      (id) => item(id)?.slot === slotCategory[slot],
    );
    const pages = Math.max(1, Math.ceil(inventory.length / 8));
    const page = Math.max(0, Math.min(data.page ?? 0, pages - 1));
    const restart = (next: { page?: number; slot?: EquipmentSlot } = {}) =>
      this.scene.restart({ page, slot, ...next });
    panel(this, 220, 350, 370, 400);
    panel(this, 620, 350, 390, 400);
    panel(this, 1030, 350, 390, 400);
    label(this, 65, 178, `${p.name} • ${en.level} ${p.level}`, 23);
    this.rig = new Gladiator(
      this,
      210,
      470,
      p,
      false,
      primaryWeapon(p)?.weaponType === "spear" ? 0.66 : 0.74,
      { stance: "relaxed" },
    );
    this.button(
      "preview-throw",
      220,
      515,
      280,
      en.throwPreview,
      () => {
        if (this.rig.animator.name === "throw") return;
        this.rig.play("throw");
      },
      36,
    );
    equipmentSlots.forEach((position, i) => {
      const x = 525 + (i % 2) * 190,
        y = 225 + Math.floor(i / 2) * 112;
      const card = this.button(
        `slot-${position}`,
        x,
        y,
        170,
        "",
        () => restart({ slot: position, page: 0 }),
        100,
      );
      if (position === slot) card.setAlpha(1);
      else card.setAlpha(0.75);
      label(
        this,
        x - 76,
        y - 35,
        en.equipmentSlots[position],
        16,
        position === slot ? "#f4d18b" : "#b9aa8d",
      );
      const definition = item(p.equipment[position] ?? "");
      if (definition) {
        const visual = drawGear(this, definition),
          bounds = visual.getBounds();
        const scale = Math.min(43 / bounds.width, 48 / bounds.height);
        visual
          .setScale(scale)
          .setPosition(
            x - 51 - bounds.centerX * scale,
            y + 3 - bounds.centerY * scale,
          );
        label(this, x - 19, y - 5, definition.name, 14).setWordWrapWidth(
          95,
          true,
        );
        this.button(
          `unequip-${position}`,
          x + 61,
          y + 31,
          32,
          "×",
          () => {
            unequip(p, position);
            this.services.save();
            restart();
          },
          25,
        );
      } else label(this, x, y + 3, en.empty, 17, "#9d947e").setOrigin(0.5);
    });
    label(this, 855, 177, en.equipmentSlots[slot].toUpperCase(), 21);
    inventory.slice(page * 8, (page + 1) * 8).forEach((id, i) => {
      const def = item(id)!,
        y = 218 + i * 35,
        worn = p.equipment[slot] === id;
      const name = label(this, 855, y, def.name, 16);
      if (name.width > 225) name.setFontSize((16 * 225) / name.width);
      this.button(
        `equip-${id}`,
        1168,
        y,
        87,
        worn ? "✓" : en.equip,
        () => {
          if (equip(p, id, slot)) {
            this.services.save();
            restart();
          }
        },
        29,
      ).setEnabled(!worn && canEquip(p, id, slot));
    });
    if (!inventory.length)
      label(this, 855, 230, "No compatible items owned", 17, "#b9aa8d");
    this.button(
      "inventory-prev",
      893,
      520,
      65,
      "←",
      () => restart({ page: page - 1 }),
      30,
    ).setEnabled(page > 0);
    label(this, 1030, 520, `${en.page} ${page + 1} / ${pages}`, 16).setOrigin(
      0.5,
    );
    this.button(
      "inventory-next",
      1168,
      520,
      65,
      "→",
      () => restart({ page: page + 1 }),
      30,
    ).setEnabled(page + 1 < pages);
    const xp = new ProgressBar(this, 65, 568, 310, colors.gold);
    xp.update(p.xp, threshold(p.level));
    const st = stats(p);
    label(
      this,
      65,
      594,
      `HP ${st.hp} • SP ${st.stamina} • ATK ${st.attack} • ARM ${st.armor}`,
      16,
    );
    label(this, 430, 571, en.loadoutHint, 16, "#b9aa8d");
    label(
      this,
      430,
      598,
      `Select a slot to equip items • ${en.points}: ${p.points}`,
      16,
    );
    attributes.forEach((a, i) => {
      const x = 65 + i * 243;
      label(this, x, 633, `${en.attributes[a]}: ${p.attributes[a]}`, 17);
      this.button(
        `attribute-${a}`,
        x + 189,
        633,
        35,
        "+",
        () => {
          if (allocate(p, a)) {
            this.services.save();
            restart();
          }
        },
        27,
      ).setEnabled(p.points > 0);
    });
    this.back();
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      rigs: this.rig ? [this.rig.jointSnapshot()] : [],
    };
  }
  update(_time: number, delta: number) {
    this.rig?.update(delta);
  }
}
