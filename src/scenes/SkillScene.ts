import { BaseScene } from "./BaseScene";
import { label, panel } from "../ui/widgets";
import { skills, canLearn, hasSkill, type Skill } from "../domain/skills";
import { learnSkill } from "../domain/postBattle";
export class SkillScene extends BaseScene {
  private confirming = false;
  constructor() {
    super("SkillScene");
  }
  create() {
    if (!this.prepare("LEARN A SKILL")) return;
    this.confirming = false;
    label(
      this,
      640,
      88,
      "Choose one permanent ability for this gladiator",
      20,
      "#e8bd72",
    ).setOrigin(0.5);
    skills.forEach((s, i) => {
      const x = 226 + (i % 3) * 414,
        y = 151 + Math.floor(i / 3) * 92;
      const learned = hasSkill(this.services.player, s.id),
        available = canLearn(this.services.player, s.id);
      panel(this, x, y, 396, 85);
      this.button(
        `skill-${s.id}`,
        x,
        y,
        396,
        "",
        () => this.confirm(s),
        85,
      ).setEnabled(available);
      label(
        this,
        x - 184,
        y - 27,
        `${s.id}. ${s.name}`,
        18,
        learned ? "#87c5a0" : "#f4e2bc",
      );
      label(
        this,
        x - 184,
        y - 3,
        s.description,
        12,
        "#cbbda4",
      ).setWordWrapWidth(364, true);
      label(this, x - 184, y + 13, s.enables, 11, "#c6b18d").setWordWrapWidth(
        364,
        true,
      );
      const required = s.requires
        ? ` · Requires ${skills.find((k) => k.id === s.requires)!.name}`
        : "";
      label(
        this,
        x - 184,
        y + 29,
        `${learned ? "LEARNED" : available ? "AVAILABLE" : "LOCKED"}${required}`,
        12,
        learned ? "#87c5a0" : available ? "#e8bd72" : "#b39082",
      );
    });
    label(
      this,
      640,
      692,
      "One skill per completed battle · Your selection is permanent",
      15,
      "#b9aa8d",
    ).setOrigin(0.5);
  }
  private confirm(s: Skill) {
    if (this.confirming || !canLearn(this.services.player, s.id)) return;
    this.confirming = true;
    const shade = this.add
      .rectangle(640, 360, 1280, 720, 0x000000, 0.85)
      .setInteractive();
    const box = panel(this, 640, 360, 650, 310);
    const title = label(
      this,
      640,
      264,
      `Learn ${s.name}?`,
      30,
      "#e8bd72",
    ).setOrigin(0.5);
    const text = label(this, 640, 324, s.description, 19)
      .setOrigin(0.5)
      .setWordWrapWidth(580, true);
    const enable = label(this, 640, 376, s.enables, 17, "#b9aa8d")
      .setOrigin(0.5)
      .setWordWrapWidth(580, true);
    const yes = this.button(
      "confirm-skill",
      505,
      451,
      240,
      "Learn permanently",
      () => {
        if (learnSkill(this.services.player, s.id)) {
          this.services.save();
          this.scene.start("MainMenuScene");
        }
      },
    );
    const no = this.button(
      "cancel-skill",
      775,
      451,
      220,
      "Choose another",
      () => {
        [shade, box, title, text, enable, yes, no].forEach((o) => o.destroy());
        delete this.buttons["confirm-skill"];
        delete this.buttons["cancel-skill"];
        this.confirming = false;
      },
    );
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      skills: skills.map((s) => ({
        ...s,
        status: hasSkill(this.services.player, s.id)
          ? "learned"
          : canLearn(this.services.player, s.id)
            ? "available"
            : "locked",
      })),
    };
  }
}
