import { BaseScene } from "./BaseScene";
import { label, panel, colors } from "../ui/widgets";
import { ladderEntries, ladderLength } from "../domain/ladder";
import { opponentName } from "../domain/opponents";
import { item } from "../data/catalog";

export class LadderScene extends BaseScene {
  constructor() {
    super("LadderScene");
  }
  create() {
    if (!this.prepare("THE ARENA LADDER")) return;
    const wins = this.services.player.progress;
    label(
      this,
      640,
      106,
      wins >= ladderLength
        ? "Champion · Ladder complete · Exhibition matches unlocked"
        : `Progress: ${wins} / ${ladderLength} · Five challengers, then a boss in each stage`,
      20,
    ).setOrigin(0.5);
    const entries = ladderEntries(wins);
    for (let stage = 0; stage < 3; stage++) {
      const x = 220 + stage * 420;
      panel(this, x, 377, 382, 480);
      label(this, x, 160, `STAGE ${stage + 1}`, 23, "#e8bd72").setOrigin(0.5);
      for (const entry of entries.slice(stage * 6, stage * 6 + 6)) {
        const boss = entry.boss;
        const y = boss ? 527 : 202 + (entry.index % 6) * 51;
        const height = boss ? 153 : 44;
        this.add
          .rectangle(
            x,
            y,
            356,
            height,
            entry.state === "current" ? 0x494031 : 0x222625,
            0.95,
          )
          .setStrokeStyle(
            entry.state === "current" ? 2 : 1,
            entry.state === "current" ? colors.gold : colors.bronze,
            entry.state === "upcoming" ? 0.4 : 1,
          );
        label(
          this,
          x - 166,
          y - (boss ? 57 : 8),
          `${entry.index + 1}. ${boss ? boss.name : entry.name}`,
          boss ? 21 : 19,
          entry.state === "defeated" ? "#89b39a" : "#f4e2bc",
        );
        label(
          this,
          x - 166,
          y + (boss ? -32 : 11),
          `${boss ? "BOSS · " : opponentName(entry.index) + " · "}${entry.state === "current" ? "Next fight" : entry.state === "defeated" ? "Defeated" : "Upcoming"}`,
          13,
          "#b9aa8d",
        );
        if (boss) {
          label(this, x - 166, y - 8, boss.specialty, 13, "#e8bd72");
          label(
            this,
            x - 166,
            y + 24,
            Object.values(boss.equipment)
              .map((id) => item(id!)?.name ?? id)
              .join(" · "),
            13,
          ).setWordWrapWidth(332);
        }
      }
    }
    this.back();
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      ladder: ladderEntries(this.services.player.progress),
    };
  }
}
