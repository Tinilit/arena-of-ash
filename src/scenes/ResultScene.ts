import { BaseScene } from "./BaseScene";
import { label, panel } from "../ui/widgets";
import { choosePostBattle, progressionScene } from "../domain/postBattle";
import { allSkillIds } from "../domain/skills";
export class ResultScene extends BaseScene {
  constructor() {
    super("ResultScene");
  }
  create() {
    if (!this.prepare("AFTER THE ARENA")) return;
    const p = this.services.player,
      s = p.postBattle!;
    label(this, 640, 175, s.outcome, 54, "#e8bd72").setOrigin(0.5);
    label(this, 640, 234, `${s.opponent} · +${s.gold} gold`, 22).setOrigin(0.5);
    label(this, 640, 298, "Choose your next step", 30).setOrigin(0.5);
    const choose = (choice: "skill" | "shop") => {
      if (choosePostBattle(p, choice)) {
        this.services.save();
        this.scene.start(progressionScene(p));
      }
    };
    panel(this, 355, 447, 480, 225);
    panel(this, 925, 447, 480, 225);
    const complete = allSkillIds.every((id) => p.skills?.includes(id));
    label(
      this,
      355,
      391,
      complete ? "All 17 skills learned" : "One new combat ability",
      23,
      "#e8bd72",
    ).setOrigin(0.5);
    label(
      this,
      355,
      438,
      "Permanent training for your gladiator",
      18,
    ).setOrigin(0.5);
    if (!complete)
      this.button("learn-skill", 355, 505, 360, "LEARN A SKILL", () =>
        choose("skill"),
      ).setEnabled(!complete);
    label(this, 925, 391, "Prepare your equipment", 23, "#e8bd72").setOrigin(
      0.5,
    );
    label(this, 925, 438, "Buy supplies and sell spare gear", 18).setOrigin(
      0.5,
    );
    this.button("visit-shop", 925, 505, 360, "VISIT SHOP", () =>
      choose("shop"),
    );
    label(
      this,
      640,
      625,
      "One choice per completed battle · Saved immediately",
      18,
      "#b9aa8d",
    ).setOrigin(0.5);
  }
}
