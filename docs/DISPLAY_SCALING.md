# Sharp rendering on large and high-DPI displays

## Cause and change

A fixed 1280×720 backing canvas was stretched by FIT CSS scaling. On a 2560×1440 viewport, each original pixel covered four screen pixels. Phaser Text also defaulted to a 1× internal bitmap, so increasing only font texture resolution or applying a CSS sharpening filter would leave the whole canvas undersampled.

The game retains a 1280×720 logical world. `displaySizing.ts` computes the fitted CSS scale, multiplies it by the device pixel ratio and rounds upward to an eighth-step density. The backing buffer becomes 1280×density by 720×density. Camera viewport dimensions match it; camera zoom uses the same density and centers on logical (640,360). Phaser's scale/input transforms then map CSS pointer positions back to the same logical buttons and game objects. Art, combat geometry and saves retain their original units.

All shared `label` objects, including button captions, bars, damage numbers and loading text, are rasterized at this density. Existing text is rerasterized when density changes; new labels start with the correct resolution. Text destruction removes it from tracking. Scene changes do not accumulate old labels. Graphics render directly into the larger canvas with normal antialiasing; animation coordinates are not rounded to an integer grid.

## Resize, DPI and resource bounds

Scale Manager resize events update the existing canvas/cameras/text. A cheap DPR comparison before each game step also catches browser zoom or moving to another monitor when no resize/media-query event fires. No scene or battle is restarted. Tiny resize changes stay within eighth-step buckets to avoid excessive GPU reallocations.

Density is at least 1 and at most 4 (5120×2880); WebGL texture/renderbuffer/viewport limits may lower that cap. This covers native 4K, 1080p Retina and 1440p Retina within that resource budget. Beyond the cap, rendering uses the best allowed density rather than allocating an unbounded 8K+ surface. Very small displays downsample from at least the logical resolution. The 16:9 letterbox and portrait rotation message remain.

Future bitmap equipment still needs sufficient source pixels for its display size; density cannot create missing image detail. The default procedural artwork and text are rendered at the selected density.

## Phaser 3.90 API references

- [ScaleManager.setGameSize](https://github.com/phaserjs/phaser/blob/v3.90.0/src/scale/ScaleManager.js): updates backing size and FIT display/input scaling.
- [Camera zoom / world transforms](https://github.com/phaserjs/phaser/blob/v3.90.0/src/cameras/2d/BaseCamera.js): keeps the same logical view through a larger viewport.
- [Text.setResolution / updateText](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/text/Text.js): rasterizes a larger internal canvas while retaining logical text dimensions.

These were checked against the installed 3.90.0 source. The fix does not rely on an unsupported global GameConfig resolution flag.

## Verification

Unit cases cover 720p, 1080p, 1440p, 4K, Retina, fractional DPR, ultrawide letterboxing, density buckets and device limits. Browser cases exercise 1440p WebGL, Retina WebGL, fractional-DPI Canvas and 4K Canvas. They check physical backing density, actual text bitmap sizes, logical camera center/extent, correctly positioned button input, fresh scene cameras and label cleanup. A running session resizes 1440p → 720p → 1080p, then changes DPR from 1 to 2 without reload; existing labels and new arena controls must adapt while game state remains intact.

Read-only `window.__arena.display()` diagnostics are development-only. Screenshots are `display-1440p-webgl.png`, `display-retina-webgl.png`, `display-fractional-dpi-canvas.png` and `display-4k-canvas.png` under `test-results/screenshots/`.
