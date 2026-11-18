import { describe, expect, it } from "vitest";
import { displaySize } from "../../src/app/displaySizing";

describe("physical display resolution", () => {
  it.each([
    [1280, 720, 1, 1280, 720],
    [1920, 1080, 1, 1920, 1080],
    [2560, 1440, 1, 2560, 1440],
    [3840, 2160, 1, 3840, 2160],
    [1280, 720, 2, 2560, 1440],
    [2560, 1440, 2, 5120, 2880],
    [1920, 1080, 1.25, 2400, 1350],
    [3440, 1440, 1, 2560, 1440],
  ])(
    "fits %s×%s at DPR %s without upscaling the backing buffer",
    (w, h, dpr, width, height) => {
      expect(displaySize(w, h, dpr)).toMatchObject({ width, height });
    },
  );
  it("bounds pixel allocation and respects a device's renderbuffer limit", () => {
    expect(displaySize(7680, 4320, 3)).toEqual({
      density: 4,
      width: 5120,
      height: 2880,
    });
    expect(displaySize(3840, 2160, 2, 4096 / 1280)).toEqual({
      density: 3.125,
      width: 4000,
      height: 2250,
    });
  });
  it("retains the logical aspect ratio and avoids reallocating on tiny resize steps", () => {
    const a = displaySize(1400, 900, 1),
      b = displaySize(1401, 901, 1);
    expect(a).toEqual(b);
    expect(a.width / a.height).toBeCloseTo(16 / 9);
    expect(displaySize(0, NaN, 0)).toEqual({
      density: 1,
      width: 1280,
      height: 720,
    });
  });
});
