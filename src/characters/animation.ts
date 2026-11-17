export type Pose = Partial<Record<string, number>>;
export interface Frame {
  time: number;
  pose: Pose;
  impact?: boolean;
}
export interface Clip {
  duration: number;
  frames: Frame[];
  loop?: boolean;
  hold?: boolean;
}
const neutral: Pose = {
  rootX: 0,
  rootY: 0,
  rootR: 0,
  torso: 0,
  head: 0,
  nearArm: -0.25,
  nearElbow: -0.55,
  farArm: 0.2,
  farElbow: -0.45,
  nearThigh: -0.18,
  farThigh: 0.22,
  nearShin: 0.15,
  farShin: -0.15,
};
export const basePose = neutral;
export const clips: Record<string, Clip> = {
  idle: {
    duration: 1800,
    loop: true,
    frames: [
      { time: 0, pose: neutral },
      {
        time: 0.5,
        pose: { ...neutral, rootY: -3, torso: 0.025, nearArm: -0.2 },
      },
      { time: 1, pose: neutral },
    ],
  },
  quick: {
    duration: 600,
    frames: [
      { time: 0, pose: neutral },
      {
        time: 0.25,
        pose: { ...neutral, torso: -0.13, nearArm: 1.2, nearElbow: -1 },
      },
      {
        time: 0.48,
        impact: true,
        pose: {
          ...neutral,
          rootX: 140,
          torso: 0.2,
          nearArm: -1.35,
          nearElbow: -0.2,
        },
      },
      { time: 1, pose: neutral },
    ],
  },
  heavy: {
    duration: 1000,
    frames: [
      { time: 0, pose: neutral },
      {
        time: 0.45,
        pose: {
          ...neutral,
          rootY: 6,
          torso: -0.2,
          nearArm: 2.6,
          nearElbow: -0.2,
          nearThigh: -0.35,
        },
      },
      {
        time: 0.65,
        impact: true,
        pose: {
          ...neutral,
          rootX: 160,
          torso: 0.32,
          nearArm: -1.7,
          nearElbow: 0,
        },
      },
      { time: 1, pose: neutral },
    ],
  },
  defend: {
    duration: 500,
    frames: [
      { time: 0, pose: neutral },
      {
        time: 0.45,
        impact: true,
        pose: {
          ...neutral,
          farArm: -0.9,
          farElbow: -0.8,
          torso: -0.08,
          rootY: 5,
        },
      },
      { time: 1, pose: neutral },
    ],
  },
  recover: {
    duration: 650,
    frames: [
      { time: 0, pose: neutral },
      {
        time: 0.5,
        impact: true,
        pose: { ...neutral, rootY: 8, head: 0.12, nearArm: 0.15 },
      },
      { time: 1, pose: neutral },
    ],
  },
  hit: {
    duration: 350,
    frames: [
      { time: 0, pose: neutral },
      {
        time: 0.25,
        pose: { ...neutral, rootX: -17, torso: -0.22, head: -0.3 },
      },
      { time: 1, pose: neutral },
    ],
  },
  death: {
    duration: 950,
    hold: true,
    frames: [
      { time: 0, pose: neutral },
      {
        time: 0.45,
        pose: {
          ...neutral,
          rootY: 20,
          torso: -0.3,
          nearThigh: -0.7,
          farThigh: 0.7,
        },
      },
      {
        time: 1,
        pose: {
          ...neutral,
          rootY: 23,
          rootR: -1.45,
          nearArm: 0.8,
          nearElbow: 0.3,
          nearThigh: -0.4,
          nearShin: 1,
        },
      },
    ],
  },
  victory: {
    duration: 1200,
    hold: true,
    frames: [
      { time: 0, pose: neutral },
      {
        time: 0.6,
        pose: {
          ...neutral,
          nearArm: 2.9,
          nearElbow: -0.25,
          farArm: -0.8,
          head: -0.08,
          rootY: -5,
        },
      },
      {
        time: 1,
        pose: { ...neutral, nearArm: 2.8, nearElbow: -0.25, farArm: -0.6 },
      },
    ],
  },
};
export class Animator {
  private elapsed = 0;
  private clip: Clip = clips.idle;
  private fired = false;
  private onImpact?: () => void;
  private onComplete?: () => void;
  private stopped = false;
  private current: Pose = { ...neutral };
  get running() {
    return (
      !this.stopped &&
      (this.clip.loop === true || this.elapsed < this.clip.duration)
    );
  }
  play(name: string, impact?: () => void, complete?: () => void) {
    const source = clips[name] ?? clips.idle;
    this.clip = {
      ...source,
      frames: source.frames.map((f, i) =>
        i === 0 ? { ...f, pose: { ...this.current } } : f,
      ),
    };
    this.elapsed = 0;
    this.fired = false;
    this.onImpact = impact;
    this.onComplete = complete;
    this.stopped = false;
  }
  stop() {
    this.stopped = true;
    this.onImpact = undefined;
    this.onComplete = undefined;
  }
  update(delta: number): Pose {
    if (this.stopped) return {};
    this.elapsed += delta;
    const t = Math.min(1, this.elapsed / this.clip.duration);
    const frames = this.clip.frames;
    for (const frame of frames)
      if (frame.impact && t >= frame.time && !this.fired) {
        this.fired = true;
        this.onImpact?.();
      }
    let left = frames[0],
      right = frames[frames.length - 1];
    for (let i = 1; i < frames.length; i++)
      if (t <= frames[i].time) {
        left = frames[i - 1];
        right = frames[i];
        break;
      }
    const f = Math.max(
      0,
      Math.min(1, (t - left.time) / (right.time - left.time || 1)),
    );
    const smooth = f * f * (3 - 2 * f);
    const result: Pose = {};
    for (const key of Object.keys(neutral))
      result[key] =
        (left.pose[key] ?? neutral[key] ?? 0) +
        ((right.pose[key] ?? neutral[key] ?? 0) -
          (left.pose[key] ?? neutral[key] ?? 0)) *
          smooth;
    this.current = result;
    if (t === 1) {
      const complete = this.onComplete;
      this.onComplete = undefined;
      if (this.clip.loop) this.elapsed %= this.clip.duration;
      else if (!this.clip.hold) this.play("idle");
      complete?.();
    }
    return result;
  }
}
