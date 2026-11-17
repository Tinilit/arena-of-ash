import { describe, it, expect } from "vitest";
import { Animator, clips } from "../../src/characters/animation";
import { motionProfiles } from "../../src/characters/motionProfiles";
import {
  visualStyles,
  parseStyle,
  loadStyle,
  saveStyle,
} from "../../src/characters/presentation";

describe("non-destructive presentation variants", () => {
  it("keeps the original animation library as the original option", () =>
    expect(motionProfiles.original).toBe(clips));
  it.each([null, "", "unknown", '{"style":"ash"}'])(
    "falls back safely for %s",
    (value) => expect(parseStyle(value)).toBe("original"),
  );
  it.each(visualStyles)("accepts the %s preference", (style) =>
    expect(parseStyle(style)).toBe(style),
  );
  it("survives unavailable browser storage", () => {
    expect(loadStyle()).toBe("original");
    expect(saveStyle("ash")).toBe(false);
  });
  for (const style of visualStyles) {
    describe(style, () => {
      it("has complete, finite, ordered keyframes", () => {
        for (const name of Object.keys(clips)) {
          const clip = motionProfiles[style][name];
          expect(clip.duration).toBeGreaterThan(0);
          expect(clip.frames[0].time).toBe(0);
          expect(clip.frames.at(-1)!.time).toBe(1);
          clip.frames.forEach((frame, i) => {
            if (i) expect(frame.time).toBeGreaterThan(clip.frames[i - 1].time);
            for (const value of Object.values(frame.pose))
              expect(Number.isFinite(value)).toBe(true);
          });
        }
      });
      it.each(["quick", "heavy", "defend", "recover"])(
        "%s applies its impact once, including skipped frames",
        (name) => {
          const animator = new Animator(motionProfiles[style]);
          let impacts = 0,
            completions = 0;
          animator.play(
            name,
            () => impacts++,
            () => completions++,
          );
          animator.update(4000);
          animator.update(4000);
          expect(impacts).toBe(1);
          expect(completions).toBe(1);
        },
      );
      it("can interrupt and stop without stale impacts", () => {
        const animator = new Animator(motionProfiles[style]);
        let hits = 0;
        animator.play("heavy", () => hits++);
        animator.update(20);
        animator.play("defend");
        animator.update(2000);
        animator.play("quick", () => hits++);
        animator.stop();
        animator.update(2000);
        expect(hits).toBe(0);
      });
      it("holds the defeated pose and can restart a preview", () => {
        const animator = new Animator(motionProfiles[style]);
        animator.play("death");
        const final = animator.update(2000);
        expect(animator.update(500)).toEqual(final);
        expect(animator.running).toBe(false);
        animator.play("idle");
        expect(animator.running).toBe(true);
        expect(animator.update(16).rootR).toBeGreaterThanOrEqual(final.rootR!);
      });
    });
  }
  it("does not mutate any clip data during repeated playback", () => {
    const before = JSON.stringify(motionProfiles);
    for (const style of visualStyles) {
      const animator = new Animator(motionProfiles[style]);
      for (const name of Object.keys(clips)) {
        animator.play(name);
        animator.update(2000);
      }
    }
    expect(JSON.stringify(motionProfiles)).toBe(before);
  });
});
