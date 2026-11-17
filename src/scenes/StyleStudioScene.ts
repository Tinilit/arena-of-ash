import type Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { Gladiator } from "../characters/Gladiator";
import { visualStyles, type VisualStyle } from "../characters/presentation";
import { label, panel } from "../ui/widgets";
import { en } from "../ui/strings";
interface Preview {
  kit?: boolean;
  mirrored?: boolean;
  clip?: string;
}
export class StyleStudioScene extends BaseScene {
  private rigs: Gladiator[] = [];
  private status!: Phaser.GameObjects.Text;
  private kit = true;
  private mirrored = false;
  private clip = "idle";
  constructor() {
    super("StyleStudioScene");
  }
  create(data: Preview = {}) {
    this.prepare(en.studioTitle);
    this.rigs = [];
    this.kit = data.kit ?? true;
    this.mirrored = data.mirrored ?? false;
    this.clip = data.clip ?? "idle";
    label(this, 640, 100, en.studioHint, 20).setOrigin(0.5);
    visualStyles.forEach((style, index) => {
      const x = 220 + index * 420;
      panel(this, x, 351, 390, 394);
      label(
        this,
        x,
        185,
        en.styleNames[style],
        30,
        style === "ash" ? "#b5ced6" : "#e8bd72",
      ).setOrigin(0.5);
      label(this, x, 233, en.styleDescriptions[style], 18)
        .setOrigin(0.5)
        .setAlign("center");
      const model = structuredClone(this.services.player);
      // Showcase ownership is intentionally confined to cloned preview models.
      if (this.kit)
        model.equipment = {
          weapon: "iron",
          chest: "plate",
          helmet: "cap",
          shield: "shield",
        };
      const rig = new Gladiator(
        this,
        x,
        481,
        model,
        this.mirrored,
        0.88,
        style,
        0.12,
      );
      rig.play(this.clip);
      this.rigs.push(rig);
      this.button(
        `style-${style}`,
        x,
        520,
        320,
        en.useStyle,
        () => this.choose(style),
        40,
      );
    });
    this.status = label(this, 640, 562, "", 17).setOrigin(0.5);
    this.refresh();
    const clips = [
      "idle",
      "quick",
      "heavy",
      "defend",
      "recover",
      "hit",
      "death",
      "victory",
    ] as const;
    clips.forEach((clip, index) => {
      const caption = clip === "victory" ? en.celebrate : en[clip];
      this.button(
        `preview-${clip}`,
        80 + index * 160,
        608,
        148,
        caption,
        () => {
          this.clip = clip;
          this.rigs.forEach((r) => r.play(clip));
        },
        42,
      );
    });
    this.back();
    this.button(
      "preview-gear",
      450,
      670,
      300,
      this.kit ? en.previewKit : en.previewOwned,
      () =>
        this.scene.restart({
          kit: !this.kit,
          mirrored: this.mirrored,
          clip: this.clip,
        }),
    );
    this.button(
      "preview-mirror",
      760,
      670,
      280,
      this.mirrored ? en.previewNormal : en.previewMirror,
      () =>
        this.scene.restart({
          kit: this.kit,
          mirrored: !this.mirrored,
          clip: this.clip,
        }),
    );
    this.button(
      "preview-motion",
      1095,
      670,
      310,
      this.services.motion === "grounded" ? en.motionGrounded : en.motionLegacy,
      () => {
        this.services.selectMotion(
          this.services.motion === "grounded" ? "legacy" : "grounded",
        );
        this.scene.restart({
          kit: this.kit,
          mirrored: this.mirrored,
          clip: this.clip,
        });
      },
    );
  }
  private choose(style: VisualStyle) {
    this.refresh(this.services.selectStyle(style));
  }
  private refresh(saved?: boolean) {
    visualStyles.forEach((style) =>
      this.buttons[`style-${style}`]
        .setCaption(
          this.services.style === style ? en.activeStyle : en.useStyle,
        )
        .setEnabled(this.services.style !== style),
    );
    this.status.setText(
      `${en.styleNames[this.services.style]} • ${saved === undefined ? en.styleNeutralStatus : saved ? en.styleSaved : en.styleSession}`,
    );
  }
  update(_time: number, delta: number) {
    this.rigs.forEach((rig, index) => {
      rig.update(delta);
      // Frame the entire articulated pose inside its preview stage, including
      // raised weapons and held collapses. Arena motion is never adjusted here.
      const center = 220 + index * 420;
      const direction = this.mirrored ? -1 : 1;
      rig.root.setScale(0.88 * direction, 0.88);
      let bounds = rig.root.getBounds();
      const fit = Math.min(1, 230 / bounds.height, 350 / bounds.width);
      if (fit < 1) {
        rig.root.setScale(0.88 * fit * direction, 0.88 * fit);
        bounds = rig.root.getBounds();
      }
      rig.root.x += Math.max(
        center - 175 - bounds.left,
        Math.min(0, center + 175 - bounds.right),
      );
      rig.root.y += Math.max(
        260 - bounds.top,
        Math.min(0, 490 - bounds.bottom),
      );
    });
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      preview: {
        kit: this.kit,
        mirrored: this.mirrored,
        clip: this.clip,
        rigs: this.rigs.map((rig) => rig.jointSnapshot()),
        bounds: this.rigs.map((rig) => {
          const b = rig.root.getBounds();
          return { x: b.x, y: b.y, width: b.width, height: b.height };
        }),
      },
    };
  }
}
