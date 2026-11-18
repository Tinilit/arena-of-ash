import { BaseScene } from "./BaseScene";
import { label, panel } from "../ui/widgets";
import { en } from "../ui/strings";
import { Gladiator } from "../characters/Gladiator";
interface Result {
  win: boolean;
  draw?: boolean;
  opponent: string;
  payout: { gold: number; xp: number; levels: number } | null;
}
export class ResultScene extends BaseScene {
  private rig!: Gladiator;
  constructor() {
    super("ResultScene");
  }
  create(data: Result) {
    this.prepare(data.draw ? en.draw : data.win ? en.victory : en.defeat);
    panel(this, 425, 342, 660, 350);
    label(
      this,
      425,
      230,
      data.draw ? en.draw : data.win ? en.victory : en.defeat,
      56,
      "#e8bd72",
    ).setOrigin(0.5);
    label(this, 425, 290, data.opponent, 26).setOrigin(0.5);
    label(
      this,
      425,
      337,
      data.win ? en.resultWin : en.resultLose,
      20,
    ).setOrigin(0.5);
    label(
      this,
      425,
      395,
      `+${data.payout?.gold ?? 0} ${en.gold}    +${data.payout?.xp ?? 0} ${en.xp}`,
      26,
    ).setOrigin(0.5);
    if (data.payout?.levels)
      label(
        this,
        425,
        446,
        `${en.levelUp}: ${data.payout.levels} • +${data.payout.levels * 2} ${en.points}`,
        20,
      ).setOrigin(0.5);
    this.rig = new Gladiator(this, 965, 534, this.services.player);
    this.rig.play(data.win ? "victory" : "recover");
    this.back();
    this.button("again", 1028, 670, 280, en.again, () =>
      this.scene.start("ArenaScene"),
    );
  }
  update(_time: number, delta: number) {
    this.rig?.update(delta);
  }
}
