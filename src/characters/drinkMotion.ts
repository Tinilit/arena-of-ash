import type { Clip, Pose } from "./animation";
import { combatRest } from "./locomotion";
/** Raise a vial to the mouth, tilt for a sip, then lower and stow it. */
export function drinkClip(): Clip {
  const p = (pose: Pose): Pose => ({ ...combatRest, drinkPreview: 1, ...pose });
  return {
    duration: 2100,
    blendIn: 140,
    discrete: ["drinkPreview"],
    sample: (phase) => ({ drinkPreview: phase < 0.96 ? 1 : 0 }),
    frames: [
      { time: 0, pose: p({}) },
      { time: 0.18, pose: p({ farHandX: 20, farHandY: 64, farWrist: 0.05 }) },
      {
        time: 0.4,
        pose: p({ farHandX: 63, farHandY: -20, farWrist: 1.24, head: -0.08 }),
      },
      {
        time: 0.55,
        pose: p({ farHandX: 63, farHandY: -20, farWrist: 1.3, head: -0.15 }),
      },
      {
        time: 0.68,
        pose: p({ farHandX: 63, farHandY: -20, farWrist: 1.3, head: -0.15 }),
      },
      {
        time: 0.82,
        pose: p({ farHandX: 46, farHandY: 20, farWrist: 0.2, head: -0.03 }),
      },
      { time: 1, pose: p({ drinkPreview: 0 }) },
    ],
  };
}
