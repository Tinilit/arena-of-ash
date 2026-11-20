import { hasSkill, skill, skills, type SkillId } from "../domain/skills";
import { actionRequirement, actionAllowed } from "../combat/skillRules";
import { completeBattle } from "../domain/postBattle";
import { repairArmor } from "../combat/armor";
import { bossAt, ladderLength } from "../domain/ladder";
import { twoHandWeapon, primaryWeapon } from "../domain/progression";
import { drawBolt } from "../rendering/crossbow";
import Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { Gladiator } from "../characters/Gladiator";
import { ArenaMotion } from "../characters/ArenaMotion";
import {
  RealtimeBattle,
  arenaRules,
  type ArenaInput,
  type ContactEvent,
  fighterSpeed,
} from "../combat/realtime";
import { ArenaAI } from "../combat/ArenaAI";
import type { CombatGeometry } from "../combat/geometry";
import { seeded } from "../utils/random";
import {
  opponent,
  stats,
  consumeItem,
  addItem,
  equip,
} from "../domain/progression";
import { item } from "../data/catalog";
import { drawGear } from "../rendering/characterVisuals";
import { label, ProgressBar, colors } from "../ui/widgets";
import { en } from "../ui/strings";

export class ArenaScene extends BaseScene {
  battle!: RealtimeBattle;
  private rigs!: [Gladiator, Gladiator];
  private motions!: [ArenaMotion, ArenaMotion];
  private ai!: ArenaAI;
  private playerAI!: ArenaAI;
  private autoBattle = true;
  private aimActive = false;
  private aimPoint?: { x: number; y: number };
  private aimReticle?: Phaser.GameObjects.Graphics;
  private trainingAI = false;
  private speedLabels: Phaser.GameObjects.Text[] = [];
  private bars!: ProgressBar[];
  private status!: Phaser.GameObjects.Text;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private queued: ArenaInput = {};
  private battleId = "";
  private ending = false;
  private lockedSkill?: string;
  private noticeUntil = 0;
  private controlHints: Phaser.GameObjects.Text[] = [];
  private accumulator = 0;
  private debug?: Phaser.GameObjects.Graphics;
  private projectileViews = new Map<number, Phaser.GameObjects.Container>();
  private projectileMask!: Phaser.Display.Masks.GeometryMask;
  private geometry?: [CombatGeometry, CombatGeometry];
  private consumptionCursor = 0;
  private armorBreakCursor = 0;
  private armorRevision = 0;
  private collectionCursor = 0;
  private lootElapsed = 0;
  private pickupHint!: Phaser.GameObjects.Text;
  constructor() {
    super("ArenaScene");
  }
  create() {
    if (!this.prepare(en.arena)) return;
    this.projectileViews.clear();
    const maskSource = this.add
      .graphics()
      .fillStyle(0xffffff)
      .fillRect(0, 180, 1280, 390)
      .setVisible(false);
    this.projectileMask = maskSource.createGeometryMask();
    this.events.once("shutdown", () => this.projectileMask.destroy());
    this.battleId = crypto.randomUUID();
    this.ending = false;
    this.accumulator = 0;
    this.queued = {};
    this.consumptionCursor = this.collectionCursor = this.lootElapsed = 0;
    this.armorBreakCursor = this.armorRevision = 0;
    const query = new URLSearchParams(location.search);
    this.autoBattle = !(import.meta.env.DEV && query.get("manual") === "1");
    this.aimActive = false;
    this.aimPoint = undefined;
    this.aimReticle = this.add.graphics().setDepth(80);
    this.trainingAI = import.meta.env.DEV && query.get("ai") === "training";
    const seed =
      import.meta.env.DEV && query.has("seed")
        ? Number(query.get("seed"))
        : crypto.getRandomValues(new Uint32Array(1))[0];
    this.battle = new RealtimeBattle(
      this.services.player,
      opponent(this.services.player, seeded(seed ^ 0x92)),
      seeded(seed ^ 0x4b1d),
      {
        disarm: seeded(seed ^ 0x78d3),
        hammerKnockdown: seeded(seed ^ 0x3fe1),
        hammerPush: seeded(seed ^ 0x65c2),
        drop: seeded(seed ^ 0x5e17),
        deflect: seeded(seed ^ 0xd3f1),
      },
    );
    this.ai = new ArenaAI(
      seeded(seed),
      seeded(seed ^ 0x92ab),
      seeded(seed ^ 0x9170),
      seeded(seed ^ 0x711c),
      {
        advanced:
          !this.trainingAI || Boolean(this.battle.enemy.model.combatProfile),
      },
    );
    this.playerAI = new ArenaAI(
      seeded(seed ^ 0xa710),
      seeded(seed ^ 0x71ac),
      seeded(seed ^ 0xe72),
      seeded(seed ^ 0xf123),
    );
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
        this.battle.enemy.model.combatProfile?.size ?? 1,
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
      new ProgressBar(this, 891, 109, 345, colors.red),
    ];
    label(this, 399, 109, "HP", 14);
    label(this, 855, 109, "HP", 14);
    this.speedLabels = [
      label(this, 44, 132, "", 14, "#73e4dc"),
      label(this, 1235, 132, "", 14, "#73e4dc").setOrigin(1, 0.5),
    ];
    this.status = label(this, 640, 92, en.fight, 20, "#e8bd72").setOrigin(0.5);
    const boss = bossAt(this.services.player.progress);
    label(
      this,
      640,
      160,
      this.services.player.progress < ladderLength
        ? `Round ${this.services.player.progress + 1} / ${ladderLength}${boss ? ` · BOSS · ${boss.title}` : ""}`
        : "Exhibition match · Ladder complete",
      16,
      "#e8bd72",
    ).setOrigin(0.5);
    this.controlHints = [
      label(
        this,
        640,
        611,
        "A/D: walk · Shift: run · Space: jump · A/D+Space: hop · R: stance · B: resume Auto Battle",
        16,
      ),
      label(
        this,
        640,
        641,
        "Mouse: aim · LMB/J: front hand · RMB/K: rear hand · Ctrl+attack: throw · Q/E: belt",
        16,
      ),
      label(
        this,
        640,
        671,
        "F: kick · C: parry · V: shove · X: finish · H: lift/throw · G: pick up · Esc: camp",
        16,
      ),
    ];
    const learned = this.services.player;
    this.controlHints[1].setText(
      `Mouse: aim · LMB/J: front hand · RMB/K: rear hand · G: pick up${hasSkill(learned, skill.throwing) ? " · Ctrl+attack: throw" : ""}${hasSkill(learned, skill.throwing) || hasSkill(learned, skill.alchemy) ? " · Q/E: belt" : ""}`,
    );
    this.controlHints[2]
      .setText(
        skills
          .filter(
            (s) =>
              s.key &&
              hasSkill(learned, s.id) &&
              !(
                s.id === 2 &&
                item(learned.equipment.leftHand ?? "")?.slot === "shield"
              ) &&
              !(
                s.id === 14 &&
                item(learned.equipment.leftHand ?? "")?.slot !== "shield"
              ),
          )
          .map((s) => `${s.key}: ${s.name}`)
          .join(" · ") + " · Esc: camp",
      )
      .setFontSize(13);
    this.controlHints.forEach((t) => t.setOrigin(0.5));
    this.pickupHint = label(this, 40, 570, "", 13, "#f4d18b")
      .setOrigin(0, 0.5)
      .setDepth(50);
    this.keys =
      (this.input.keyboard?.addKeys({
        left: "A",
        right: "D",
        arrowLeft: "LEFT",
        arrowRight: "RIGHT",
        run: "SHIFT",
        jump: "SPACE",
        control: "CTRL",
        block: "S",
      }) as typeof this.keys) ?? {};
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      // Physical codes keep combat controls working with Ukrainian and other layouts.
      const key = event.code.startsWith("Key")
        ? event.code.slice(3).toLowerCase()
        : event.code.startsWith("Digit")
          ? event.code.slice(5)
          : event.code === "Space"
            ? " "
            : event.key.toLowerCase();
      if (event.repeat) return;
      if (event.metaKey || event.altKey) return;
      if (key !== "b" || event.ctrlKey) this.takeControl();
      if (this.ending) {
        if (this.battle.state === "Victory" && key === "g" && !event.ctrlKey)
          this.queued.pickup = true;
        return;
      }
      if (key === "b" && !event.ctrlKey) {
        this.autoBattle = !this.autoBattle;
        if (this.autoBattle) this.battle.player.aim = undefined;
        this.ai.setAdvanced(
          this.autoBattle ||
            !this.trainingAI ||
            Boolean(this.battle.enemy.model.combatProfile),
        );
        this.clearInput();
        return;
      }
      if (event.ctrlKey) {
        if (key === "j" || key === "1") this.queueHand("front", true);
        if (key === "k" || key === "2") this.queueHand("rear", true);
        return;
      }
      const gate: Record<string, SkillId> = {
        f: skill.kick,
        "3": skill.kick,
        h: skill.wrestling,
        x: skill.execution,
        c: skill.parry,
        z: skill.rage,
        t: skill.superman,
        s: skill.shield,
      };
      if (gate[key] && !hasSkill(this.services.player, gate[key])) {
        this.notifyLocked(gate[key]);
        return;
      }
      if (key === "z") this.queued.rage = true;
      if (key === "t") {
        this.queued.attack = "superman";
        this.queued.hand = this.battle.player.model.equipment.rightHand
          ? "rear"
          : "front";
      }
      if (key === "q") this.queued.belt = "belt1";
      if (key === "c") this.queued.parry = true;
      if (key === "h") this.queued.grapple = true;
      if (key === "g") this.queued.pickup = true;
      if (key === "e") this.queued.belt = "belt2";
      if (key === "j" || key === "1") {
        this.queueHand("front");
      }
      if (key === "k" || key === "2") {
        this.queueHand("rear");
      }
      if (key === "v") {
        const action =
          item(this.battle.player.model.equipment.leftHand ?? "")?.slot ===
          "shield"
            ? "bash"
            : "shove";
        const required = actionRequirement(this.services.player, action);
        if (required && !hasSkill(this.services.player, required))
          this.notifyLocked(required);
        else {
          this.queued.attack = action;
          if (action === "bash") this.queued.hand = "front";
        }
      }
      if (key === "x") this.queued.attack = "finish";
      if (key === "f" || key === "3") this.queued.attack = "kick";
      if (key === " ") this.queueJump();
      if (key === "r") this.queued.toggleStance = true;
    });
    this.input.keyboard?.addCapture(["J", "K"]);
    const useHand = (pointer: Phaser.Input.Pointer) => {
      if (this.ending) return;
      this.takeControl();
      this.updateAim(pointer);
      const point = pointer.positionToCamera(
        this.cameras.main,
      ) as Phaser.Math.Vector2;
      if (point.y < 180 || point.y > 720 || point.x < 0 || point.x > 1280)
        return;
      if (pointer.button === 0 || pointer.button === 2) {
        this.queueHand(
          pointer.button === 0 ? "front" : "rear",
          Boolean((pointer.event as MouseEvent).ctrlKey),
        );
      }
    };
    const contextMenu = (event: Event) => event.preventDefault();
    this.game.canvas.addEventListener("contextmenu", contextMenu);
    const moveAim = (pointer: Phaser.Input.Pointer) => this.updateAim(pointer);
    this.input.on("pointermove", moveAim);
    this.input.on("pointerdown", useHand);
    const releaseInput = () => this.clearInput();
    this.game.events.on(Phaser.Core.Events.BLUR, releaseInput);
    this.game.events.on(Phaser.Core.Events.HIDDEN, releaseInput);
    this.events.once("shutdown", () => {
      if (repairArmor(this.services.player)) this.services.save();
      this.input.off("pointerdown", useHand);
      this.input.off("pointermove", moveAim);
      this.game.canvas.style.cursor = "";
      this.game.canvas.removeEventListener("contextmenu", contextMenu);
      this.game.events.off(Phaser.Core.Events.BLUR, releaseInput);
      this.game.events.off(Phaser.Core.Events.HIDDEN, releaseInput);
      this.clearInput();
      this.input.keyboard?.removeCapture(["J", "K"]);
      for (const key of Object.values(this.keys))
        this.input.keyboard?.removeKey(key, true);
      this.keys = {};
    });
    if (import.meta.env.DEV && query.has("hitboxes"))
      this.debug = this.add.graphics().setDepth(100);
    this.pose(0);
    this.refresh();
  }
  private takeControl() {
    if (!this.autoBattle) return;
    this.autoBattle = false;
    this.queued = {};
    this.updateAim(this.input.activePointer);
    this.ai.setAdvanced(
      !this.trainingAI || Boolean(this.battle.enemy.model.combatProfile),
    );
  }
  private updateAim(pointer: Phaser.Input.Pointer) {
    const point = pointer.positionToCamera(
      this.cameras.main,
    ) as Phaser.Math.Vector2;
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      this.aimActive = true;
      this.aimPoint = { x: point.x, y: point.y };
    }
  }
  private queueHand(hand: "front" | "rear", modified = false) {
    const throwing = modified || this.down("control");
    const required = actionRequirement(
      this.services.player,
      throwing ? "throw" : "quick",
      hand,
    );
    if (required && !hasSkill(this.services.player, required)) {
      this.notifyLocked(required);
      return;
    }
    const field = throwing ? "throws" : "attacks";
    this.queued[field] = [...new Set([...(this.queued[field] ?? []), hand])];
  }
  private notifyLocked(id: SkillId) {
    if (performance.now() < this.noticeUntil) return;
    this.noticeUntil = performance.now() + 700;
    this.lockedSkill = skills.find((s) => s.id === id)!.name;
    const notice = label(
      this,
      640,
      575,
      `Locked: ${this.lockedSkill} · Learn after battle`,
      17,
      "#e8bd72",
    )
      .setOrigin(0.5)
      .setDepth(100);
    this.time.delayedCall(1300, () => notice.destroy());
  }
  private clearInput() {
    this.queued = {};
    Object.values(this.keys).forEach((key) => key.reset());
  }
  private inputState(): ArenaInput {
    const input: ArenaInput = {
      ...this.queued,
      ...(this.aimActive && this.aimPoint ? { aim: this.aimPoint } : {}),
      move: this.direction(),
      run: this.down("run"),
      guard: this.down("block") && actionAllowed(this.services.player, "guard"),
    };
    this.queued = {};
    return input;
  }
  private down(name: string) {
    return Boolean(this.keys[name]?.isDown);
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
    delete this.queued.worldHop;
    if (direction) {
      this.queued.hop = (direction * this.battle.player.facing) as -1 | 1;
      this.queued.worldHop = direction as -1 | 1;
    } else this.queued.jump = true;
  }
  private pose(delta: number) {
    this.battle.fighters.forEach((f, i) => {
      const rig = this.rigs[i];
      rig.syncArena(f);
      rig.setArenaTransform(
        f.x,
        arenaRules.floor + f.y,
        f.facing,
        arenaRules.floor,
      );
      rig.applyPose(
        this.motions[i].update(
          delta === 0 ? 0 : (f.animationDelta ?? delta),
          f,
        ),
        this.motions[i].name,
      );
    });
    this.geometry = [
      this.rigs[0].combatGeometry(),
      this.rigs[1].combatGeometry(),
    ];
  }
  private refresh() {
    if (!this.ending)
      this.status.setText(
        this.autoBattle
          ? "Auto Battle · Any key: manual"
          : "Manual control · B: Auto Battle",
      );
    const aiming =
      !this.autoBattle &&
      this.aimActive &&
      this.aimPoint &&
      primaryWeapon(this.battle.player.model) &&
      this.battle.state === "Fighting";
    this.aimReticle?.clear();
    this.game.canvas.style.cursor = aiming ? "crosshair" : "";
    if (aiming) {
      const { x, y } = this.aimPoint!;
      this.aimReticle!.lineStyle(1.5, 0xf3d493).strokeCircle(x, y, 7);
      this.aimReticle!.lineBetween(x - 12, y, x - 3, y).lineBetween(
        x + 3,
        y,
        x + 12,
        y,
      );
      this.aimReticle!.lineBetween(x, y - 12, x, y - 3).lineBetween(
        x,
        y + 3,
        x,
        y + 12,
      );
    }
    const pickup = this.battle.nearbyPickup(this.battle.player);
    this.pickupHint.setText(
      pickup
        ? `G: Pick up ${item(pickup.itemId)?.name ?? "equipment"}`
        : this.battle.canAttack(this.battle.player, "finish")
          ? "X: Finish grounded opponent"
          : this.battle.player.grapple?.phase === "hold"
            ? "A/D: carry and turn · H: throw"
            : this.battle.state === "Victory"
              ? "Collect grounded equipment, then Continue"
              : "",
    );
    this.battle.fighters.forEach((f, i) => {
      const s = stats(f.model);
      this.bars[i].update(f.hp, s.hp);
      this.speedLabels[i].setText(
        [
          (f.speedRemaining ?? 0) > 0
            ? `Haste ×2 · ${((f.speedRemaining ?? 0) / 1000).toFixed(1)}s`
            : "",
          (f.rageRemaining ?? 0) > 0
            ? `Rage · ${((f.rageRemaining ?? 0) / 1000).toFixed(1)}s`
            : "",
          f.secondWindUsed ? "Second Wind spent" : "",
        ]
          .filter(Boolean)
          .join(" · "),
      );
    });
  }
  private renderProjectiles() {
    for (const projectile of this.battle.projectiles) {
      let view = this.projectileViews.get(projectile.id);
      if (!view) {
        const definition = item(projectile.itemId);
        if (!definition) continue;
        view = (
          projectile.kind === "bolt"
            ? drawBolt(this)
            : drawGear(this, definition)
        ).setMask(this.projectileMask);
        this.projectileViews.set(projectile.id, view);
      }
      view
        .setPosition(projectile.x, projectile.y)
        .setRotation(projectile.angle)
        .setVisible(
          projectile.state !== "expired" && projectile.state !== "pickedUp",
        );
    }
  }
  private present(event: ContactEvent) {
    const defender = this.battle.fighters.findIndex(
      (f) =>
        f.model.id ===
        (event.parried && !event.deflected
          ? event.attackerId
          : event.defenderId),
    );
    this.rigs[defender].flash();
    const text = label(
      this,
      event.point.x,
      event.point.y,
      event.shieldBlocked
        ? "Blocked"
        : event.deflected
          ? "Deflected"
          : event.parried
            ? event.disarmed
              ? "Disarmed"
              : "Parry"
            : event.kind === "shove"
              ? "Pushed back"
              : event.kind === "kick"
                ? event.knockdown
                  ? "Knockdown"
                  : "Off balance"
                : `${event.damage}`,
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
    this.cameras.main.shake(
      event.disarmed ? 110 : 55,
      event.disarmed ? 0.0025 : 0.001,
    );
  }
  private finish() {
    if (this.ending) return;
    this.ending = true;
    this.clearInput();
    this.controlHints.forEach((t) => t.setVisible(false));
    repairArmor(this.services.player);
    this.rigs.forEach((rig, i) => rig.syncArena(this.battle.fighters[i]));
    const win = this.battle.state === "Victory";
    const payout = completeBattle(
      this.services.player,
      this.battleId,
      this.battle.state as "Victory" | "Defeat" | "Draw",
      this.battle.enemy.model.name,
    );
    this.services.save();
    this.status.setText(
      this.battle.state === "Draw" ? en.draw : win ? en.victory : en.defeat,
    );
    this.rigs.forEach((rig, i) =>
      rig.play(this.battle.fighters[i].hp <= 0 ? "death" : "victory"),
    );
    const result = {
      win,
      draw: this.battle.state === "Draw",
      opponent: this.battle.enemy.model.name,
      payout,
    };
    if (win) {
      this.input.keyboard?.once("keydown-ENTER", () =>
        this.scene.start("ResultScene", result),
      );
      this.status.setText("Victory • Collect equipment");
      this.button("finish-battle", 640, 611, 280, "Continue", () =>
        this.scene.start("ResultScene", result),
      );
    } else
      this.time.delayedCall(1500, () =>
        this.scene.start("ResultScene", result),
      );
  }
  private scatterArmor(entry: RealtimeBattle["armorBreaks"][number]) {
    const index = this.battle.fighters.findIndex(
      (f) => f.model.id === entry.ownerId,
    );
    const attachment = this.rigs[index].armorAttachment(entry.slot);
    const art = drawGear(this, entry.itemId);
    const bounds = art.getBounds();
    const crack = this.add.graphics().lineStyle(2.5, 0xe1d6bc);
    crack
      .beginPath()
      .moveTo(bounds.centerX - 16, bounds.centerY - 17)
      .lineTo(bounds.centerX + 2, bounds.centerY - 4)
      .lineTo(bounds.centerX - 6, bounds.centerY + 5)
      .lineTo(bounds.centerX + 15, bounds.centerY + 19)
      .strokePath();
    art.add(crack).setDepth(30);
    art
      .setPosition(
        attachment?.x ?? entry.point.x,
        attachment?.y ?? entry.point.y,
      )
      .setScale(attachment?.scaleX ?? 1, attachment?.scaleY ?? 1)
      .setRotation(attachment?.rotation ?? 0);
    const direction = Math.random() < 0.5 ? -1 : 1;
    const travel = direction * (90 + Math.random() * 70);
    this.tweens.add({
      targets: art,
      x: art.x + travel * 0.5,
      y: art.y - 65,
      rotation: art.rotation + direction * 1.6,
      duration: 230,
      ease: "Sine.Out",
      onComplete: () => {
        this.tweens.add({
          targets: art,
          x: art.x + travel * 0.5,
          y: arenaRules.floor + 80,
          rotation: art.rotation + direction * 3,
          alpha: 0,
          duration: 650,
          ease: "Quad.In",
          onComplete: () => art.destroy(),
        });
      },
    });
    const labelText = label(
      this,
      entry.point.x,
      entry.point.y - 35,
      entry.slot === "helmet" ? "Helmet shattered" : "Armor shattered",
      20,
      "#e8bd72",
    )
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: labelText,
      y: labelText.y - 45,
      alpha: 0,
      duration: 900,
      onComplete: () => labelText.destroy(),
    });
    this.cameras.main.shake(90, 0.002);
  }
  private persistItems() {
    let changed = false;
    const breaks = this.battle.armorBreaks.slice(this.armorBreakCursor);
    breaks.forEach((entry) => this.scatterArmor(entry));
    this.armorBreakCursor = this.battle.armorBreaks.length;
    for (const entry of this.battle.consumedItems.slice(this.consumptionCursor))
      if (entry.ownerId === this.services.player.id)
        changed =
          consumeItem(this.services.player, entry.itemId, entry.sourceSlot) ||
          changed;
    for (const entry of this.battle.collectedItems.slice(this.collectionCursor))
      if (
        entry.ownerId === this.services.player.id &&
        addItem(this.services.player, entry.itemId)
      ) {
        if (entry.slot) equip(this.services.player, entry.itemId, entry.slot);
        const destination = entry.slot
          ? en.equipmentSlots[entry.slot]
          : "Backpack";
        const toast = label(
          this,
          Math.max(230, Math.min(1050, this.battle.player.x)),
          arenaRules.floor - 245,
          `${item(entry.itemId)?.name ?? "Equipment"} → ${destination}`,
          16,
          "#f4d18b",
        )
          .setOrigin(0.5)
          .setDepth(50);
        this.tweens.add({
          targets: toast,
          y: toast.y - 30,
          alpha: 0,
          duration: 1400,
          onComplete: () => toast.destroy(),
        });
        changed = true;
      }
    if (this.armorRevision !== this.battle.armorRevision) {
      const wear = this.battle.player.model.armorWear ?? {};
      if (
        JSON.stringify(wear) !==
        JSON.stringify(this.services.player.armorWear ?? {})
      ) {
        this.services.player.armorWear = { ...wear };
        changed = true;
      }
      this.armorRevision = this.battle.armorRevision;
    }
    this.consumptionCursor = this.battle.consumedItems.length;
    this.collectionCursor = this.battle.collectedItems.length;
    if (changed) this.services.save();
    return changed || breaks.length > 0;
  }
  update(_time: number, delta: number) {
    if (!this.battle) return;
    const elapsed = Math.min(delta, 100);
    if (this.ending) {
      const looting = this.battle.state === "Victory";
      if (looting) {
        this.lootElapsed += elapsed;
        this.battle.advanceAftermath(elapsed, this.inputState());
        if (this.persistItems())
          this.lootElapsed = Math.max(this.lootElapsed, 1001);
      }
      this.rigs.forEach((rig, i) => {
        const f = this.battle.fighters[i];
        if (looting && i === 0) rig.syncArena(f);
        if (f.y < 0 && !(looting && i === 0)) {
          f.y = Math.min(0, f.y + (f.vy * elapsed) / 1000);
          f.vy += (arenaRules.gravity * elapsed) / 1000;
        }
        rig.setArenaTransform(
          f.x,
          arenaRules.floor + f.y,
          f.facing,
          arenaRules.floor,
        );
        if (
          looting &&
          i === 0 &&
          (Math.abs(f.vx) > 0 || this.lootElapsed > 1000)
        ) {
          rig.applyPose(
            this.motions[0].update(elapsed, f),
            this.motions[0].name,
          );
        } else rig.update(elapsed);
      });
      if (looting) {
        this.renderProjectiles();
        this.refresh();
      }
      return;
    }
    this.accumulator += elapsed;
    while (this.accumulator >= arenaRules.step && !this.ending) {
      const manual = this.inputState();
      if (
        this.autoBattle &&
        twoHandWeapon(this.battle.player.model)?.weaponType !== "crossbow"
      )
        this.battle.player.aim = undefined;
      if (twoHandWeapon(this.battle.enemy.model)?.weaponType !== "crossbow")
        this.battle.enemy.aim = undefined;
      const commands = this.autoBattle
        ? this.playerAI.update(
            arenaRules.step * fighterSpeed(this.battle.player),
            this.battle.player,
            this.battle.enemy,
            this.battle.projectiles,
          )
        : manual;
      this.battle.advance(arenaRules.step, [
        commands,
        this.ai.update(
          arenaRules.step * fighterSpeed(this.battle.enemy),
          this.battle.enemy,
          this.battle.player,
          this.battle.projectiles,
        ),
      ]);
      this.pose(arenaRules.step);
      this.battle
        .resolve(this.geometry!)
        .forEach((event) => this.present(event));
      if (this.persistItems()) this.pose(0);
      this.accumulator -= arenaRules.step;
      if (this.battle.state !== "Fighting") this.finish();
    }
    this.renderProjectiles();
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
      autoBattle: this.autoBattle,
      lockedSkill: this.lockedSkill,
      aim: this.aimPoint,
      ai: {
        player: this.playerAI.lastDecision,
        enemy: this.ai.lastDecision,
        playerRecovery: this.playerAI.recoveryTargetId,
        enemyRecovery: this.ai.recoveryTargetId,
      },
      rigs: this.rigs.map((r) => r.jointSnapshot()),
      geometry: structuredClone(this.geometry),
      battle: structuredClone({
        state: this.battle.state,
        player: this.battle.player,
        enemy: this.battle.enemy,
        contacts: this.battle.contacts,
        armorBreaks: this.battle.armorBreaks,
        projectiles: this.battle.projectiles,
        collectedItems: this.battle.collectedItems,
      }),
    };
  }
}
