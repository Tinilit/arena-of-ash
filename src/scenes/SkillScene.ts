import { BaseScene } from "./BaseScene";
import { label } from "../ui/widgets";
import { skills } from "../domain/skills";
import { ensureSkillOffers, learnSkill } from "../domain/postBattle";
export class SkillScene extends BaseScene {
  constructor() {
    super("SkillScene");
  }
  create() {
    if (!this.prepare("LEARN A SKILL")) return;
    ensureSkillOffers(this.services.player);
    this.services.save();
    label(
      this,
      640,
      130,
      "Choose one permanent ability",
      26,
      "#e8bd72",
    ).setOrigin(0.5);
    const offers = this.services.player.postBattle?.offers ?? [];
    offers.forEach((id, index) => {
      const s = skills.find((s) => s.id === id)!;
      const x = offers.length === 1 ? 640 : 365 + index * 550;
      this.button(
        `skill-${id}`,
        x,
        350,
        510,
        "",
        () => {
          if (learnSkill(this.services.player, id)) {
            this.services.save();
            this.scene.start("MainMenuScene");
          }
        },
        280,
      );
      label(this, x, 260, s.name, 29, "#e8bd72").setOrigin(0.5);
      label(this, x, 335, s.description, 21)
        .setOrigin(0.5)
        .setWordWrapWidth(450, true);
      label(this, x, 425, s.enables, 17, "#c6b18d")
        .setOrigin(0.5)
        .setWordWrapWidth(450, true);
    });
    label(
      this,
      640,
      590,
      "Select to learn immediately · One skill per completed battle",
      18,
      "#b9aa8d",
    ).setOrigin(0.5);
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      skills: (this.services.player.postBattle?.offers ?? []).map((id) => ({
        ...skills.find((s) => s.id === id)!,
        status: "available",
      })),
    };
  }
}
