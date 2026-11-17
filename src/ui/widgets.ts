import Phaser from "phaser";
export const colors = {
  ink: 0x201c1c,
  panel: 0x292a29,
  bronze: 0x9f7746,
  gold: 0xe8bd72,
  light: "#f4e2bc",
  muted: "#b9aa8d",
  red: 0xa64036,
  teal: 0x418f89,
};
export function label(
  s: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 22,
  color = colors.light,
) {
  return s.add
    .text(x, y, text, { fontFamily: "Georgia, serif", fontSize: size, color })
    .setOrigin(0, 0.5);
}
export function panel(
  s: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  return s.add
    .rectangle(x, y, w, h, colors.panel, 0.96)
    .setStrokeStyle(1, colors.bronze, 0.8);
}
export class Button extends Phaser.GameObjects.Container {
  private enabled = true;
  private bg: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  constructor(
    s: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    run: () => void,
  ) {
    super(s, x, y);
    this.bg = s.add
      .rectangle(0, 0, w, h, 0x45392d)
      .setStrokeStyle(1, colors.bronze);
    this.title = label(s, 0, 0, text, 20).setOrigin(0.5);
    this.add([this.bg, this.title]);
    this.setSize(w, h).setInteractive({ useHandCursor: true });
    this.on("pointerover", () => {
      if (this.enabled) this.bg.setFillStyle(0x705237);
    });
    this.on("pointerout", () =>
      this.bg.setFillStyle(this.enabled ? 0x45392d : 0x30302e),
    );
    this.on("pointerdown", () => {
      if (this.enabled) this.bg.setFillStyle(0x987345);
    });
    this.on("pointerup", () => {
      if (this.enabled) {
        this.bg.setFillStyle(0x705237);
        run();
      }
    });
    s.add.existing(this);
  }
  setCaption(text: string) {
    this.title.setText(text);
    return this;
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    this.setAlpha(value ? 1 : 0.4);
    this.bg.setFillStyle(value ? 0x45392d : 0x30302e);
    return this;
  }
}
export class ProgressBar {
  private fill: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;
  constructor(
    s: Phaser.Scene,
    x: number,
    y: number,
    private width: number,
    color: number,
  ) {
    s.add
      .rectangle(x, y, width, 17, 0x161a1b)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x807154);
    this.fill = s.add
      .rectangle(x + 2, y, width - 4, 13, color)
      .setOrigin(0, 0.5);
    this.text = label(s, x + width / 2, y, "", 13).setOrigin(0.5);
  }
  update(value: number, max: number) {
    this.fill.width = (this.width - 4) * Math.max(0, Math.min(1, value / max));
    this.text.setText(`${value} / ${max}`);
  }
}
