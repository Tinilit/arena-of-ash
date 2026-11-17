import { BaseScene } from "./BaseScene";
import { Gladiator } from "../characters/Gladiator";
import { label, panel, ProgressBar, colors } from "../ui/widgets";
import { en } from "../ui/strings";
import { attributes } from "../domain/model";
import { allocate, equip, stats, threshold } from "../domain/progression";
import { item } from "../data/catalog";
export class CharacterScene extends BaseScene {
  private rig!: Gladiator;
  constructor() {
    super("CharacterScene");
  }
  create() {
    this.prepare(en.characterTitle);
    const p = this.services.player;
    panel(this, 268, 352, 460, 400);
    panel(this, 880, 368, 678, 432);
    this.rig = new Gladiator(this, 255, 432, p, false, 0.9);
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
            this.scene.restart();
          }
        },
        32,
      ).setEnabled(p.points > 0);
    });
    label(this, 920, 181, en.inventory, 19);
    p.inventory.forEach((id, i) => {
      const def = item(id)!;
      const y = 220 + i * 41;
      const worn = p.equipment[def.slot] === id;
      label(this, 905, y, def.name, 17);
      this.button(
        `equip-${id}`,
        1160,
        y,
        105,
        worn ? "✓" : en.equip,
        () => {
          if (equip(p, id, def.slot)) {
            this.services.save();
            this.scene.restart();
          }
        },
        32,
      ).setEnabled(!worn);
    });
    Object.entries(en.slots).forEach(([slot, name], i) => {
      const id = p.equipment[slot as keyof typeof p.equipment];
      label(
        this,
        568,
        420 + i * 39,
        `${name}: ${id ? item(id)?.name : en.noGear}`,
        19,
      );
    });
    this.back();
  }
  update(_time: number, delta: number) {
    this.rig?.update(delta);
  }
}
