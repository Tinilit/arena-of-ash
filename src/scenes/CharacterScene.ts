import { itemRequirements, skills, hasSkill } from "../domain/skills";
import { shopAccess } from "../domain/postBattle";
import { BaseScene } from "./BaseScene";
import { Gladiator } from "../characters/Gladiator";
import { label, panel } from "../ui/widgets";
import { en } from "../ui/strings";
import { equipmentSlots, type EquipmentSlot } from "../domain/model";
import {
  equip,
  canEquip,
  unequip,
  stats,
  primaryWeapon,
  backpack,
  availableQuantity,
  equipmentTarget,
  sell,
  salePrice,
} from "../domain/progression";
import { item } from "../data/catalog";
import { drawGear } from "../rendering/characterVisuals";
export class CharacterScene extends BaseScene {
  private rig!: Gladiator;
  constructor() {
    super("CharacterScene");
  }
  create(data: { page?: number; slot?: EquipmentSlot } = {}) {
    if (!this.prepare(en.characterTitle)) return;
    const p = this.services.player,
      slot = data.slot ?? "rightHand";
    const inventory = backpack(p);
    const pages = Math.max(1, Math.ceil(inventory.length / 8));
    const page = Math.max(0, Math.min(data.page ?? 0, pages - 1));
    const restart = (next: { page?: number; slot?: EquipmentSlot } = {}) =>
      this.scene.restart({ page, slot, ...next });
    panel(this, 220, 350, 370, 400);
    panel(this, 620, 350, 390, 400);
    panel(this, 1030, 350, 390, 400);
    label(this, 65, 178, p.name, 23);
    this.rig = new Gladiator(
      this,
      210,
      470,
      p,
      false,
      primaryWeapon(p)?.weaponType === "spear" ? 0.66 : 0.74,
      { stance: "relaxed" },
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
        () => restart({ slot: position }),
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
        label(
          this,
          x - 19,
          y - 5,
          `${definition.name} ×1`,
          14,
        ).setWordWrapWidth(95, true);
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
      } else
        label(
          this,
          x,
          y + 3,
          position === "leftHand" &&
            item(p.equipment.rightHand ?? "")?.hands === 2
            ? "Supporting grip"
            : en.empty,
          14,
          "#9d947e",
        ).setOrigin(0.5);
    });
    label(this, 855, 177, "BACKPACK · UNEQUIPPED", 21);
    label(
      this,
      855,
      199,
      `Preferred: ${en.equipmentSlots[slot]}`,
      14,
      "#b9aa8d",
    );
    inventory.slice(page * 8, (page + 1) * 8).forEach((id, i) => {
      const def = item(id)!,
        y = 233 + i * 34;
      const target = equipmentTarget(p, id, slot);
      label(
        this,
        855,
        y,
        `${def.name} ×${availableQuantity(p, id)}\n${itemRequirements(def)
          .map((s) => skills.find((k) => k.id === s)!.name)
          .join(", ")}`,
        12,
      ).setWordWrapWidth(164, true);
      this.button(
        `equip-${id}`,
        1067,
        y,
        75,
        en.equip,
        () => {
          if (equip(p, id, target)) {
            this.services.save();
            restart({ slot: target });
          }
        },
        29,
      ).setEnabled(canEquip(p, id, target));
      if (shopAccess(p))
        this.button(
          `sell-${id}`,
          1165,
          y,
          100,
          `Sell ${salePrice(id)} ◈`,
          () => {
            if (sell(p, id)) {
              this.services.save();
              restart();
            }
          },
          29,
        );
    });
    if (!inventory.length)
      label(this, 855, 230, "All owned items are equipped", 17, "#b9aa8d");
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
    const st = stats(p);
    label(this, 65, 515, `Health ${st.hp}`, 16);
    label(this, 430, 580, "LEARNED SKILLS", 16, "#e8bd72");
    const learned = skills.filter((s) => hasSkill(p, s.id));
    if (!learned.length)
      label(this, 430, 608, "No skills learned yet", 16, "#b9aa8d");
    let skillX = 430,
      skillY = 608;
    for (const s of learned) {
      const text = label(this, 0, 0, s.name, 14);
      const width = text.width + 20;
      if (skillX + width > 1230) {
        skillX = 430;
        skillY += 28;
      }
      const chip = panel(this, skillX + width / 2, skillY, width, 23);
      text.setPosition(skillX + 10, skillY).setDepth(1);
      chip.setDepth(0);
      skillX += width + 9;
    }
    this.back();
  }
  override snapshot() {
    return {
      skills: skills.filter((s) => hasSkill(this.services.player, s.id)),
      backpack: backpack(this.services.player),
      backpackQuantities: Object.fromEntries(
        backpack(this.services.player).map((id) => [
          id,
          availableQuantity(this.services.player, id),
        ]),
      ),
      ...super.snapshot(),
      rigs: this.rig ? [this.rig.jointSnapshot()] : [],
    };
  }
  update(_time: number, delta: number) {
    this.rig?.update(delta);
  }
}
