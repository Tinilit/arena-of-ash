import { BaseScene } from "./BaseScene";
import { Gladiator } from "../characters/Gladiator";
import {
  Battle,
  actions,
  type Action,
  type CombatEvent,
} from "../combat/engine";
import { decide } from "../combat/ai";
import { seeded } from "../utils/random";
import { opponent, stats, reward } from "../domain/progression";
import { label, ProgressBar, colors } from "../ui/widgets";
import { en } from "../ui/strings";
import type Phaser from "phaser";
export class ArenaScene extends BaseScene {
  battle!: Battle;
  private rigs!: Gladiator[];
  private bars!: ProgressBar[];
  private turn!: Phaser.GameObjects.Text;
  private log!: Phaser.GameObjects.Text;
  private messages: string[] = [];
  private battleId = "";
  private ending = false;
  private rng = seeded(1);
  constructor() {
    super("ArenaScene");
  }
  create() {
    this.prepare(en.arena);
    this.messages = [];
    this.ending = false;
    this.battleId = crypto.randomUUID();
    const query = new URLSearchParams(location.search);
    const seed =
      import.meta.env.DEV && query.has("seed")
        ? Number(query.get("seed"))
        : crypto.getRandomValues(new Uint32Array(1))[0];
    this.rng = seeded(seed);
    this.battle = new Battle(
      structuredClone(this.services.player),
      opponent(this.services.player),
      this.rng,
    );
    this.rigs = [
      new Gladiator(this, 490, 533, this.battle.player.model),
      new Gladiator(this, 790, 533, this.battle.enemy.model, true),
    ];
    label(this, 44, 83, this.battle.player.model.name, 23);
    label(this, 1235, 83, this.battle.enemy.model.name, 23).setOrigin(1, 0.5);
    this.bars = [
      new ProgressBar(this, 44, 109, 345, colors.red),
      new ProgressBar(this, 44, 130, 345, colors.teal),
      new ProgressBar(this, 891, 109, 345, colors.red),
      new ProgressBar(this, 891, 130, 345, colors.teal),
    ];
    label(this, 399, 109, "HP", 14);
    label(this, 399, 130, "SP", 14);
    label(this, 855, 109, "HP", 14);
    label(this, 855, 130, "SP", 14);
    this.turn = label(this, 640, 92, en.turn, 23, "#e8bd72").setOrigin(0.5);
    label(this, 640, 169, en.hint, 17).setOrigin(0.5);
    (["quick", "heavy", "defend", "recover"] as Action[]).forEach((a, i) =>
      this.button(
        a,
        173 + i * 310,
        611,
        280,
        `${i + 1}  ${en[a]}  ${actions[a].cost || "+" + (a === "defend" ? 8 : 25)}`,
        () => this.act(a),
      ),
    );
    this.log = label(this, 640, 672, "", 18).setOrigin(0.5);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const a = (["quick", "heavy", "defend", "recover"] as Action[])[
        Number(event.key) - 1
      ];
      if (a) this.act(a);
    });
    this.refresh();
  }
  private refresh() {
    [this.battle.player, this.battle.enemy].forEach((f, i) => {
      const s = stats(f.model);
      this.bars[i * 2].update(f.hp, s.hp);
      this.bars[i * 2 + 1].update(f.stamina, s.stamina);
    });
    this.turn.setText(
      this.battle.state === "PlayerTurn"
        ? en.turn
        : this.battle.state === "PlayerAnimating"
          ? en.playerActing
          : en.enemyTurn,
    );
    for (const a of Object.keys(actions) as Action[])
      this.buttons[a].setEnabled(
        this.battle.state === "PlayerTurn" &&
          this.battle.player.stamina >= actions[a].cost,
      );
    this.log.setText(this.messages.slice(-2).join("\n"));
  }
  private act(a: Action) {
    if (this.battle.state !== "PlayerTurn") return;
    const event = this.battle.begin(a);
    if (event) this.present(event);
  }
  private present(event: CombatEvent) {
    this.refresh();
    const index = event.attackerId === this.battle.player.model.id ? 0 : 1;
    const attacker = this.rigs[index];
    const defender = this.rigs[1 - index];
    attacker.play(
      event.action,
      () => {
        if (!this.battle.impact(event)) return;
        let message =
          event.action === "defend"
            ? en.guard
            : event.action === "recover"
              ? en.rest
              : !event.hit
                ? en.miss
                : `${event.critical ? en.critical + " " : ""}−${event.damage}`;
        message = `${index === 0 ? this.battle.player.model.name : this.battle.enemy.model.name}: ${message}`;
        this.messages.push(message);
        if (actions[event.action].multiplier) {
          if (event.hit) {
            defender.flash();
            defender.play(event.outcome ? "death" : "hit");
            this.cameras.main.shake(80, 0.002);
          }
          const text = label(
            this,
            defender.root.x,
            290,
            event.hit ? `−${event.damage}` : en.miss,
            32,
            event.critical ? "#e8bd72" : "#f4e2bc",
          ).setOrigin(0.5);
          this.tweens.add({
            targets: text,
            y: 245,
            alpha: 0,
            duration: 900,
            onComplete: () => text.destroy(),
          });
        }
        this.refresh();
      },
      () => {
        this.battle.complete();
        this.refresh();
        if (this.battle.state === "Victory" || this.battle.state === "Defeat") {
          this.finish();
        } else if (this.battle.state === "EnemyThinking") {
          this.time.delayedCall(320, () => {
            const e = this.battle.begin(decide(this.battle.enemy, this.rng));
            if (e) this.present(e);
          });
        }
      },
    );
  }
  private finish() {
    if (this.ending) return;
    this.ending = true;
    const win = this.battle.state === "Victory";
    const payout = reward(this.services.player, this.battleId, win);
    this.services.save();
    this.rigs[win ? 0 : 1].play("victory");
    this.time.delayedCall(1400, () =>
      this.scene.start("ResultScene", {
        win,
        opponent: this.battle.enemy.model.name,
        payout,
      }),
    );
  }
  update(_time: number, delta: number) {
    this.rigs?.forEach((r) => r.update(delta));
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      rigs: this.rigs.map((rig) => rig.jointSnapshot()),
      battle: structuredClone({
        state: this.battle.state,
        player: this.battle.player,
        enemy: this.battle.enemy,
        pending: this.battle.pending,
      }),
    };
  }
}
