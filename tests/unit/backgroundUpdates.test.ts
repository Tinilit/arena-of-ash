import { describe, expect, it } from "vitest";
import { BackgroundClock } from "../../src/app/backgroundUpdates";

describe("background combat time", () => {
  it("accounts for a throttled timer gap using bounded scene updates", () => {
    const clock = new BackgroundClock();
    clock.start(100);
    const updates: number[] = [];
    expect(clock.advance(1000, (_time, delta) => updates.push(delta))).toBe(
      true,
    );
    expect(updates.reduce((a, b) => a + b, 0)).toBe(900);
    expect(Math.max(...updates)).toBeLessThanOrEqual(100);
    clock.advance(1000, (_time, delta) => updates.push(delta));
    expect(updates.reduce((a, b) => a + b, 0)).toBe(900);
  });

  it("retains a long suspension and drains it without double-counting or blocking", () => {
    const clock = new BackgroundClock();
    clock.start(0);
    let elapsed = 0;
    const step = (_time: number, delta: number) => (elapsed += delta);
    expect(clock.advance(5500, step)).toBe(false);
    expect(elapsed).toBe(2000);
    clock.start(1200);
    expect(clock.advance(5500, step)).toBe(false);
    expect(elapsed).toBe(4000);
    expect(clock.advance(5500, step)).toBe(true);
    expect(elapsed).toBe(5500);
    clock.stop();
    expect(clock.active).toBe(false);
    clock.advance(5000, step);
    expect(elapsed).toBe(5500);
  });
});
