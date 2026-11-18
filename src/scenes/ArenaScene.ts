import Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { Gladiator } from "../characters/Gladiator";
import { ArenaMotion } from "../characters/ArenaMotion";
import {
  RealtimeBattle,
  arenaRules,
  type ArenaInput,
  type ContactEvent,
} from "../combat/realtime";
import { ArenaAI } from "../combat/ArenaAI";
import { hopDefinitions, hopKind } from "../combat/hops";
import type { CombatGeometry } from "../combat/geometry";
import { actions } from "../combat/engine";
import { seeded } from "../utils/random";
import { opponent, stats, reward } from "../domain/progression";
import { label, ProgressBar, colors } from "../ui/widgets";
import { en } from "../ui/strings";

export class ArenaScene extends BaseScene {
  battle!: RealtimeBattle;
  private rigs!: [Gladiator, Gladiator];
  private motions!: [ArenaMotion, ArenaMotion];
  private ai!: ArenaAI;
  private bars!: ProgressBar[];
  private status!: Phaser.GameObjects.Text;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private queued: ArenaInput = {};
  private held = new Map<string, Set<number>>();
  private battleId = "";
  private ending = false;
  private accumulator = 0;
  private paused = false;
  private debug?: Phaser.GameObjects.Graphics;
  private geometry?: [CombatGeometry, CombatGeometry];
  constructor() {
    super("ArenaScene");
  }
  create() {
    this.prepare(en.arena);
    this.battleId = crypto.randomUUID();
    this.ending = false;
    this.accumulator = 0;
    this.queued = {};
    this.held.clear();
    this.paused = false;
    const query = new URLSearchParams(location.search);
    const seed =
      import.meta.env.DEV && query.has("seed")
        ? Number(query.get("seed"))
        : crypto.getRandomValues(new Uint32Array(1))[0];
    this.battle = new RealtimeBattle(
      this.services.player,
      opponent(this.services.player),
    );
    this.ai = new ArenaAI(seeded(seed));
    this.rigs = [
      new Gladiator(
        this,
        this.battle.player.x,
        arenaRules.floor,
        this.battle.player.model,
        false,
        1,
      ),
      new Gladiator(
        this,
        this.battle.enemy.x,
        arenaRules.floor,
        this.battle.enemy.model,
        true,
        1,
      ),
    ];
    this.motions = [
      new ArenaMotion(this.battle.player.model),
      new ArenaMotion(this.battle.enemy.model),
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
    this.status = label(this, 640, 92, en.fight, 23, "#e8bd72").setOrigin(0.5);
    label(this, 640, 166, en.arenaHint, 14).setOrigin(0.5);
    (["quick", "heavy"] as const).forEach((a, i) =>
      this.button(
        a,
        475 + i * 330,
        611,
        300,
        `${i + 1}  ${en[a]}  ${actions[a].cost}`,
        () => {
          this.queued.attack = a;
        },
      ),
    );
    for (const [id, text, x] of [
      ["left", "←", 408],
      ["right", "→", 524],
      ["run", en.run, 640],
    ] as const) {
      const button = this.button(
        `arena-${id}`,
        x,
        667,
        104,
        text,
        () => {},
        38,
      );
      const pointers = new Set<number>();
      this.held.set(id, pointers);
      button.on("pointerdown", (p: Phaser.Input.Pointer) => pointers.add(p.id));
      button.on("pointerout", (p: Phaser.Input.Pointer) =>
        pointers.delete(p.id),
      );
    }
    this.button(
      "arena-jump",
      756,
      667,
      104,
      `${en.jump} 10`,
      () => this.queueJump(),
      38,
    );
    this.button(
      "arena-stance",
      872,
      667,
      104,
      en.stance,
      () => {
        this.queued.toggleStance = true;
      },
      38,
    );
    if (this.input.manager.pointersTotal < 4)
      this.input.addPointer(4 - this.input.manager.pointersTotal);
    const releasePointer = (p: Phaser.Input.Pointer) =>
      this.held.forEach((set) => set.delete(p.id));
    const releaseAllPointers = () => this.held.forEach((set) => set.clear());
    this.input.on("pointerup", releasePointer);
    this.input.on("gameout", releaseAllPointers);
    this.keys =
      (this.input.keyboard?.addKeys({
        left: "A",
        right: "D",
        arrowLeft: "LEFT",
        arrowRight: "RIGHT",
        run: "SHIFT",
        jump: "SPACE",
      }) as typeof this.keys) ?? {};
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat || this.ending) return;
      const key = event.key.toLowerCase();
      if (key === "j" || key === "1") {
        this.queued.attack = "quick";
      }
      if (key === "k" || key === "2") {
        this.queued.attack = "heavy";
      }
      if (key === " ") this.queueJump();
      if (key === "r") this.queued.toggleStance = true;
    });
    const pause = () => {
      this.paused = true;
      this.clearInput();
      this.accumulator = 0;
    };
    const resume = () => {
      this.paused = false;
      this.accumulator = 0;
    };
    this.game.events.on(Phaser.Core.Events.BLUR, pause);
    this.game.events.on(Phaser.Core.Events.FOCUS, resume);
    this.events.once("shutdown", () => {
      this.input.off("pointerup", releasePointer);
      this.input.off("gameout", releaseAllPointers);
      this.game.events.off(Phaser.Core.Events.BLUR, pause);
      this.game.events.off(Phaser.Core.Events.FOCUS, resume);
      this.clearInput();
      for (const key of Object.values(this.keys))
        this.input.keyboard?.removeKey(key, true);
      this.keys = {};
    });
    if (import.meta.env.DEV && query.has("hitboxes"))
      this.debug = this.add.graphics().setDepth(100);
    this.pose(0);
    this.refresh();
  }
  private clearInput() {
    this.queued = {};
    this.held.forEach((set) => set.clear());
    Object.values(this.keys).forEach((key) => key.reset());
  }
  private inputState(): ArenaInput {
    const input: ArenaInput = {
      ...this.queued,
      move: this.direction(),
      run: this.down("run"),
    };
    this.queued = {};
    return input;
  }
  private down(name: string) {
    return Boolean(this.keys[name]?.isDown || this.held.get(name)?.size);
  }
  private direction() {
    return (
      Number(this.down("right") || this.down("arrowRight")) -
      Number(this.down("left") || this.down("arrowLeft"))
    );
  }
  private queueJump() {
    const direction = this.direction();
    delete this.queued.jump;
    delete this.queued.hop;
    if (direction)
      this.queued.hop = (direction * this.battle.player.facing) as -1 | 1;
    else this.queued.jump = true;
  }
  private pose(delta: number) {
    this.battle.fighters.forEach((f, i) => {
      const rig = this.rigs[i];
      rig.setArenaTransform(
        f.x,
        arenaRules.floor + f.y,
        f.facing,
        arenaRules.floor,
      );
      rig.applyPose(this.motions[i].update(delta, f), this.motions[i].name);
    });
    this.geometry = [
      this.rigs[0].combatGeometry(),
      this.rigs[1].combatGeometry(),
    ];
  }
  private refresh() {
    this.battle.fighters.forEach((f, i) => {
      const s = stats(f.model);
      this.bars[i * 2].update(f.hp, s.hp);
      this.bars[i * 2 + 1].update(Math.floor(f.stamina), s.stamina);
    });
    for (const a of ["quick", "heavy"] as const)
      this.buttons[a].setEnabled(this.battle.canAttack(this.battle.player, a));
    const player = this.battle.player,
      direction = this.direction();
    if (direction) {
      const relative = (direction * player.facing) as -1 | 1,
        kind = hopKind(relative);
      this.buttons["arena-jump"]
        .setCaption(
          `${kind === "backstep" ? en.backHop : en.forwardHop} ${hopDefinitions[kind].cost}`,
        )
        .setEnabled(this.battle.canHop(player, relative));
    } else
      this.buttons["arena-jump"]
        .setCaption(`${en.jump} ${arenaRules.jumpCost}`)
        .setEnabled(
          !this.ending &&
            !player.hop &&
            player.y === 0 &&
            player.vy === 0 &&
            player.stamina >= arenaRules.jumpCost,
        );
    for (const name of ["left", "right", "run", "stance"])
      this.buttons[`arena-${name}`].setEnabled(!this.ending);
  }
  private present(event: ContactEvent) {
    const defender = this.battle.fighters.findIndex(
      (f) => f.model.id === event.defenderId,
    );
    this.rigs[defender].flash();
    const text = label(
      this,
      event.point.x,
      event.point.y,
      `${event.blocked ? en.blocked + " " : ""}−${event.damage}`,
      26,
      event.blocked ? "#9bc6d1" : "#f4e2bc",
    ).setOrigin(0.5);
    this.tweens.add({
      targets: text,
      y: text.y - 50,
      alpha: 0,
      duration: 700,
      onComplete: () => text.destroy(),
    });
    this.cameras.main.shake(55, 0.001);
  }
  private finish() {
    if (this.ending) return;
    this.ending = true;
    this.clearInput();
    const win = this.battle.state === "Victory";
    const payout = reward(this.services.player, this.battleId, win);
    this.services.save();
    this.status.setText(
      this.battle.state === "Draw" ? en.draw : win ? en.victory : en.defeat,
    );
    this.rigs.forEach((rig, i) =>
      rig.play(this.battle.fighters[i].hp <= 0 ? "death" : "victory"),
    );
    this.time.delayedCall(1500, () =>
      this.scene.start("ResultScene", {
        win,
        draw: this.battle.state === "Draw",
        opponent: this.battle.enemy.model.name,
        payout,
      }),
    );
  }
  update(_time: number, delta: number) {
    if (!this.battle || this.paused) return;
    const elapsed = Math.min(delta, 100);
    if (this.ending) {
      this.rigs.forEach((rig, i) => {
        const f = this.battle.fighters[i];
        if (f.y < 0) {
          f.y = Math.min(0, f.y + (f.vy * elapsed) / 1000);
          f.vy += (arenaRules.gravity * elapsed) / 1000;
        }
        rig.setArenaTransform(
          f.x,
          arenaRules.floor + f.y,
          f.facing,
          arenaRules.floor,
        );
        rig.update(elapsed);
      });
      return;
    }
    this.accumulator += elapsed;
    while (this.accumulator >= arenaRules.step && !this.ending) {
      const commands = this.inputState();
      this.battle.advance(arenaRules.step, [
        commands,
        this.ai.update(arenaRules.step, this.battle.enemy, this.battle.player),
      ]);
      this.pose(arenaRules.step);
      this.battle
        .resolve(this.geometry!)
        .forEach((event) => this.present(event));
      this.accumulator -= arenaRules.step;
      if (this.battle.state !== "Fighting") this.finish();
    }
    this.refresh();
    if (this.debug && this.geometry) {
      this.debug.clear();
      this.geometry.forEach((g) => {
        for (const part of g.body) {
          this.debug!.lineStyle(part.radius * 2, 0x22ccff, 0.25);
          this.debug!.lineBetween(part.a.x, part.a.y, part.b.x, part.b.y);
        }
        if (g.blade) {
          this.debug!.lineStyle(g.blade.radius * 2, 0xff4444, 0.8);
          this.debug!.lineBetween(
            g.blade.a.x,
            g.blade.a.y,
            g.blade.b.x,
            g.blade.b.y,
          );
        }
      });
    }
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      rigs: this.rigs.map((r) => r.jointSnapshot()),
      geometry: structuredClone(this.geometry),
      battle: structuredClone({
        state: this.battle.state,
        player: this.battle.player,
        enemy: this.battle.enemy,
        contacts: this.battle.contacts,
      }),
    };
  }
}
