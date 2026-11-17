import { describe, expect, it } from "vitest";
import { Animator, type Clip } from "../../src/characters/animation";

function sample(frames: Clip["frames"], time: number) {
  const idle: Clip = {
    duration: 1000,
    frames: [
      { time: 0, pose: { x: 0 } },
      { time: 1, pose: { x: 0 } },
    ],
  };
  const animator = new Animator({
    idle,
    move: { duration: 1000, frames, hold: true },
  });
  animator.play("move");
  return animator.update(time).x!;
}

describe("continuous motion between authored poses", () => {
  it("passes through an intermediate pose at a continuous nonzero speed", () => {
    const frames = [
      { time: 0, pose: { x: 0 } },
      { time: 0.5, pose: { x: 10 } },
      { time: 1, pose: { x: 20 } },
    ];
    const left = sample(frames, 499),
      at = sample(frames, 500),
      right = sample(frames, 501);
    expect(at).toBe(10);
    expect(at - left).toBeGreaterThan(0.019);
    expect(right - at).toBeCloseTo(at - left, 6);
  });
  it("keeps irregularly timed curves within each interval's authored range", () => {
    const frames = [
      { time: 0, pose: { x: 0 } },
      { time: 0.2, pose: { x: 10 } },
      { time: 0.8, pose: { x: 11 } },
      { time: 1, pose: { x: -3 } },
    ];
    for (let t = 0; t <= 1000; t += 2) {
      const index = t <= 200 ? 0 : t <= 800 ? 1 : 2;
      const a = frames[index].pose.x,
        b = frames[index + 1].pose.x;
      expect(sample(frames, t)).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-10);
      expect(sample(frames, t)).toBeLessThanOrEqual(Math.max(a, b) + 1e-10);
    }
  });
  it("settles at a turnaround and at the held end pose", () => {
    const frames = [
      { time: 0, pose: { x: 0 } },
      { time: 0.5, pose: { x: 10 } },
      { time: 1, pose: { x: 0 } },
    ];
    expect(sample(frames, 500)).toBe(10);
    expect(10 - sample(frames, 499)).toBeLessThan(0.001);
    expect(sample(frames, 1000)).toBe(0);
    expect(sample(frames, 1500)).toBe(0);
  });
});
