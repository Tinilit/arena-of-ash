import Phaser from "phaser";
import { displaySize, logicalSize, maximumDensity } from "./displaySizing";

const displays = new WeakMap<Phaser.Game, Display>();

class Display {
  density = 1;
  private limit = maximumDensity;
  private updating = false;
  private texts = new Set<Phaser.GameObjects.Text>();
  private dpr = window.devicePixelRatio || 1;
  constructor(private game: Phaser.Game) {
    const renderer = game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const gl = renderer.gl;
      const maximum = Math.min(
        gl.getParameter(gl.MAX_TEXTURE_SIZE),
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      );
      const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
      this.limit = Math.min(
        maximumDensity,
        maximum / logicalSize.width,
        viewport[0] / logicalSize.width,
        viewport[1] / logicalSize.height,
      );
    }
    game.scale.on(Phaser.Scale.Events.RESIZE, this.update);
    game.events.on(Phaser.Core.Events.PRE_STEP, this.checkDpr);
    game.events.once(Phaser.Core.Events.DESTROY, this.destroy);
    this.update();
  }
  track(text: Phaser.GameObjects.Text) {
    this.texts.add(text);
    text.once(Phaser.GameObjects.Events.DESTROY, () => this.texts.delete(text));
  }
  snapshot() {
    const rect = this.game.canvas.getBoundingClientRect();
    const camera = this.game.scene.getScenes(true)[0]?.cameras.main;
    const center = camera?.getWorldPoint(
      this.game.canvas.width / 2,
      this.game.canvas.height / 2,
    );
    return {
      density: this.density,
      dpr: window.devicePixelRatio,
      logical: { ...logicalSize },
      backing: {
        width: this.game.canvas.width,
        height: this.game.canvas.height,
      },
      css: { width: rect.width, height: rect.height },
      camera: camera
        ? {
            zoom: camera.zoom,
            width: camera.width,
            height: camera.height,
            center: center ? { x: center.x, y: center.y } : null,
          }
        : null,
      texts: [...this.texts].map((text) => ({
        text: text.text,
        resolution: text.style.resolution,
        width: text.width,
        height: text.height,
        bitmapWidth: text.canvas.width,
        bitmapHeight: text.canvas.height,
      })),
    };
  }
  prepare(scene: Phaser.Scene) {
    const camera = scene.cameras.main;
    if (!camera) return;
    camera.setViewport(
      0,
      0,
      this.game.scale.gameSize.width,
      this.game.scale.gameSize.height,
    );
    camera.setZoom(this.density);
    camera.centerOn(logicalSize.width / 2, logicalSize.height / 2);
  }
  private update = () => {
    if (this.updating) return;
    this.updating = true;
    try {
      const parent = this.game.scale.parentSize;
      this.dpr = window.devicePixelRatio || 1;
      const size = displaySize(
        parent.width,
        parent.height,
        this.dpr,
        this.limit,
      );
      this.density = size.density;
      if (
        this.game.scale.gameSize.width !== size.width ||
        this.game.scale.gameSize.height !== size.height
      )
        this.game.scale.setGameSize(size.width, size.height);
      for (const scene of this.game.scene.getScenes(true)) this.prepare(scene);
      for (const text of this.texts)
        if (text.style.resolution !== this.density)
          text.setResolution(this.density);
    } finally {
      this.updating = false;
    }
  };
  // A monitor/zoom change need not fire resize or a media-query event.
  private checkDpr = () => {
    if ((window.devicePixelRatio || 1) !== this.dpr) this.update();
  };
  private destroy = () => {
    this.game.scale.off(Phaser.Scale.Events.RESIZE, this.update);
    this.game.events.off(Phaser.Core.Events.PRE_STEP, this.checkDpr);
    this.texts.clear();
    displays.delete(this.game);
  };
}

export function displayFor(game: Phaser.Game) {
  let display = displays.get(game);
  if (!display) {
    display = new Display(game);
    displays.set(game, display);
  }
  return display;
}
export function prepareDisplay(scene: Phaser.Scene) {
  displayFor(scene.game).prepare(scene);
}
export function displaySnapshot(game: Phaser.Game) {
  return displays.get(game)?.snapshot() ?? null;
}
