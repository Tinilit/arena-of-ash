import type Phaser from "phaser";

/** Keep one timeline shared by hidden RAF callbacks and throttled timer callbacks. */
export class BackgroundClock {
  private cursor?: number;
  get active() {
    return this.cursor !== undefined;
  }
  start(now: number) {
    this.cursor ??= now;
  }
  advance(now: number, step: (time: number, delta: number) => void) {
    if (this.cursor === undefined) return true;
    // Retain excess time for the next callback instead of freezing the page on return.
    const end = Math.min(now, this.cursor + 2000);
    while (this.cursor < end) {
      const delta = Math.min(100, end - this.cursor);
      this.cursor += delta;
      step(this.cursor, delta);
    }
    return this.cursor >= now;
  }
  stop() {
    this.cursor = undefined;
  }
}

/** Installed before Phaser binds its RAF callback in Game.start. */
export function installBackgroundUpdates(game: Phaser.Game) {
  const clock = new BackgroundClock();
  const foregroundStep = game.step.bind(game);
  let lastFrame = performance.now();
  let timer: ReturnType<typeof setInterval> | undefined;
  let destroyed = false;
  const advance = () => {
    const now = performance.now();
    const caughtUp = clock.advance(now, (time, delta) => {
      if (!destroyed) game.headlessStep(time, delta);
    });
    lastFrame = now;
    if (!document.hidden && caughtUp) clock.stop();
  };
  game.step = (time, delta) => {
    if (clock.active) {
      advance();
      // Background steps already advanced scenes, timers, AI and physical contacts.
      if (!document.hidden && !destroyed) foregroundStep(time, 0);
    } else {
      lastFrame = performance.now();
      foregroundStep(time, delta);
    }
  };
  const visibility = () => {
    if (document.hidden) {
      clock.start(lastFrame);
      timer ??= setInterval(advance, 100);
    } else {
      clearInterval(timer);
      timer = undefined;
      // The next RAF drains any unprocessed time, then renders without counting it twice.
    }
  };
  document.addEventListener("visibilitychange", visibility);
  visibility();
  game.events.once("destroy", () => {
    destroyed = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", visibility);
    game.step = foregroundStep;
    clock.stop();
  });
}
