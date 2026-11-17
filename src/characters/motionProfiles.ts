import { basePose, clips, type Clip, type Pose } from "./animation";
import type { VisualStyle } from "./presentation";
export type ClipLibrary = Record<string, Clip>;
const pose = (change: Pose): Pose => ({ ...basePose, ...change });
function enhanced(style: "bronze" | "ash"): ClipLibrary {
  const weight = style === "ash";
  const stance = pose({
    rootY: 2,
    nearArm: -0.4,
    nearElbow: -0.65,
    farArm: 0.25,
    farElbow: -0.7,
    nearThigh: -0.24,
    nearShin: 0.3,
    farThigh: 0.28,
    farShin: -0.2,
    head: weight ? 0.04 : -0.025,
  });
  const p = (change: Pose): Pose => ({ ...stance, ...change });
  return {
    idle: {
      duration: weight ? 2400 : 2000,
      loop: true,
      frames: [
        { time: 0, pose: stance },
        {
          time: 0.45,
          pose: p({ rootY: 0, torso: -0.02, nearArm: -0.34, head: -0.04 }),
        },
        { time: 0.7, pose: p({ rootY: 1, farElbow: -0.64 }) },
        { time: 1, pose: stance },
      ],
    },
    quick: {
      duration: weight ? 650 : 580,
      frames: [
        { time: 0, pose: stance },
        {
          time: 0.22,
          pose: p({
            rootX: -10,
            rootY: 5,
            torso: -0.12,
            nearArm: 0.65,
            nearElbow: -1.1,
            farArm: 0.35,
          }),
        },
        {
          time: 0.46,
          impact: true,
          pose: p({
            rootX: 140,
            rootY: 4,
            torso: 0.18,
            head: -0.08,
            nearArm: -1.4,
            nearElbow: -0.12,
            nearThigh: -0.48,
            nearShin: 0.48,
            farThigh: 0.5,
            farShin: -0.34,
          }),
        },
        {
          time: 0.62,
          pose: p({
            rootX: 132,
            rootY: 6,
            torso: 0.23,
            nearArm: -1.6,
            nearElbow: 0.1,
            nearThigh: -0.42,
            nearShin: 0.5,
          }),
        },
        {
          time: 0.84,
          pose: p({
            rootX: 24,
            rootY: 3,
            nearArm: -0.7,
            nearElbow: -0.5,
            farArm: 0.3,
          }),
        },
        { time: 1, pose: stance },
      ],
    },
    heavy: {
      duration: weight ? 1080 : 980,
      frames: [
        { time: 0, pose: stance },
        {
          time: 0.25,
          pose: p({
            rootX: -16,
            rootY: 10,
            torso: -0.19,
            head: -0.1,
            nearArm: 2.6,
            nearElbow: -0.35,
            nearThigh: -0.42,
            nearShin: 0.6,
            farArm: 0.6,
          }),
        },
        {
          time: 0.45,
          pose: p({
            rootX: -6,
            rootY: 8,
            torso: -0.24,
            nearArm: 2.85,
            nearElbow: -0.3,
            nearThigh: -0.36,
            nearShin: 0.52,
          }),
        },
        {
          time: 0.61,
          impact: true,
          pose: p({
            rootX: 160,
            rootY: 10,
            torso: 0.32,
            head: -0.12,
            nearArm: -1.5,
            nearElbow: 0.06,
            farArm: 0.8,
            nearThigh: -0.55,
            nearShin: 0.65,
            farThigh: 0.48,
            farShin: -0.32,
          }),
        },
        {
          time: 0.73,
          pose: p({
            rootX: 145,
            rootY: 13,
            torso: 0.36,
            nearArm: -1.8,
            nearElbow: 0.3,
            nearThigh: -0.48,
            nearShin: 0.65,
          }),
        },
        {
          time: 0.9,
          pose: p({
            rootX: 18,
            rootY: 7,
            torso: 0.06,
            nearArm: -0.8,
            nearElbow: -0.55,
          }),
        },
        { time: 1, pose: stance },
      ],
    },
    defend: {
      duration: 540,
      frames: [
        { time: 0, pose: stance },
        {
          time: 0.3,
          impact: true,
          pose: p({
            rootX: -5,
            rootY: 9,
            torso: -0.12,
            head: 0.08,
            farArm: -1.2,
            farElbow: -0.65,
            nearArm: -0.7,
            nearElbow: -0.7,
            nearThigh: -0.35,
            nearShin: 0.48,
          }),
        },
        {
          time: 0.68,
          pose: p({
            rootX: -3,
            rootY: 7,
            torso: -0.1,
            farArm: -1.2,
            farElbow: -0.65,
            nearArm: -0.65,
          }),
        },
        { time: 1, pose: stance },
      ],
    },
    recover: {
      duration: 750,
      frames: [
        { time: 0, pose: stance },
        {
          time: 0.25,
          pose: p({
            rootY: 8,
            head: 0.1,
            nearArm: -0.1,
            nearElbow: -0.45,
            torso: 0.06,
          }),
        },
        {
          time: 0.55,
          impact: true,
          pose: p({
            rootY: -2,
            head: -0.1,
            torso: -0.04,
            nearArm: -0.3,
            farArm: 0.12,
          }),
        },
        { time: 1, pose: stance },
      ],
    },
    hit: {
      duration: 400,
      frames: [
        { time: 0, pose: stance },
        {
          time: 0.18,
          pose: p({
            rootX: -18,
            rootY: 5,
            torso: -0.22,
            head: -0.28,
            nearArm: 0.1,
            nearElbow: -0.3,
            farArm: 0.6,
          }),
        },
        {
          time: 0.45,
          pose: p({
            rootX: -12,
            rootY: 8,
            torso: -0.1,
            head: 0.06,
            nearThigh: -0.42,
            nearShin: 0.5,
          }),
        },
        { time: 0.75, pose: p({ rootX: -3, rootY: 3, head: -0.05 }) },
        { time: 1, pose: stance },
      ],
    },
    death: {
      duration: 1100,
      hold: true,
      frames: [
        { time: 0, pose: stance },
        {
          time: 0.25,
          pose: p({
            rootX: -10,
            rootY: 15,
            torso: -0.22,
            head: 0.2,
            nearArm: 0.5,
            nearThigh: -0.8,
            nearShin: 1.2,
            farThigh: 0.65,
          }),
        },
        {
          time: 0.55,
          pose: p({
            rootX: -12,
            rootY: 24,
            rootR: -0.5,
            torso: -0.25,
            nearArm: 1.2,
            nearElbow: 0.25,
            farArm: 0.7,
            nearThigh: -0.7,
            nearShin: 1,
          }),
        },
        {
          time: 0.83,
          pose: p({
            rootX: -12,
            rootY: 2,
            rootR: -1.48,
            torso: -0.1,
            nearArm: 2.6,
            nearElbow: 0.5,
            nearThigh: -0.45,
            nearShin: 0.8,
          }),
        },
        {
          time: 1,
          pose: p({
            rootX: -12,
            rootY: 2,
            rootR: -1.45,
            torso: -0.1,
            nearArm: 2.6,
            nearElbow: 0.5,
            nearThigh: -0.45,
            nearShin: 0.8,
          }),
        },
      ],
    },
    victory: {
      duration: 1300,
      hold: true,
      frames: [
        { time: 0, pose: stance },
        {
          time: 0.2,
          pose: p({ rootY: 7, nearThigh: -0.35, nearShin: 0.5, nearArm: 0.1 }),
        },
        {
          time: 0.55,
          pose: p({
            rootY: -3,
            torso: -0.045,
            head: -0.12,
            nearArm: 2.9,
            nearElbow: -0.15,
            farArm: -0.8,
            farElbow: -0.35,
          }),
        },
        {
          time: 0.75,
          pose: p({
            rootY: 1,
            torso: 0.02,
            nearArm: 2.75,
            nearElbow: -0.2,
            farArm: -0.6,
          }),
        },
        {
          time: 1,
          pose: p({
            rootY: 0,
            nearArm: 2.8,
            nearElbow: -0.2,
            farArm: -0.6,
            head: -0.1,
          }),
        },
      ],
    },
  };
}
export const motionProfiles: Record<VisualStyle, ClipLibrary> = {
  original: clips,
  bronze: enhanced("bronze"),
  ash: enhanced("ash"),
};
