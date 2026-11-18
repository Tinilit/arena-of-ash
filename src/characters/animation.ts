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
  blendIn?: number;
  blendRanges?: Record<string, [number, number]>;
  sample?: (phase: number) => Pose;
}
export class Animator {
  private elapsed = 0;
  private age = 0;
  private transition: Pose = {};
  private idleKey = "idle";
  private currentName = "idle";
  private clip: Clip;
  private fired = false;
  private onImpact?: () => void;
  private onComplete?: () => void;
  private stopped = false;
  private current: Pose;
  private rest: Pose;
  private poseKeys: string[];
  constructor(private library: Record<string, Clip>) {
    this.clip = library.idle;
    this.rest = { ...library.idle.frames[0].pose };
    this.current = { ...this.rest };
    this.poseKeys = [
      ...new Set(
        Object.values(library).flatMap((clip) =>
          clip.frames.flatMap((frame) => Object.keys(frame.pose)),
        ),
      ),
    ];
  }
  get name() {
    return this.currentName;
  }
  setIdle(name: string) {
    if (!this.library[name]) return;
    const idle =
      this.currentName === this.idleKey || this.currentName === "idle";
    this.idleKey = name;
    if (idle) this.play("idle");
  }
  get running() {
    return (
      !this.stopped &&
      (this.clip.loop === true || this.elapsed < this.clip.duration)
    );
  }
  play(name: string, impact?: () => void, complete?: () => void, from?: Pose) {
    if (from) this.current = { ...from };
    this.currentName = name === "idle" ? this.idleKey : name;
    const source = this.library[this.currentName] ?? this.library.idle;
    this.transition = { ...this.current };
    this.age = 0;
    this.clip = {
      ...source,
      frames: source.frames.map((f, i) =>
        i === 0 && !source.blendIn ? { ...f, pose: { ...this.current } } : f,
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
  private tangent(index: number, key: string) {
    const frames = this.clip.frames;
    // Rest at clip boundaries and at direction changes. Otherwise retain a
    // shared velocity through a key instead of stopping at every authored pose.
    if (index === 0 || index === frames.length - 1) return 0;
    const value = (i: number) => frames[i].pose[key] ?? this.rest[key] ?? 0;
    const before = frames[index].time - frames[index - 1].time;
    const after = frames[index + 1].time - frames[index].time;
    if (before <= 0 || after <= 0) return 0;
    const incoming = (value(index) - value(index - 1)) / before;
    const outgoing = (value(index + 1) - value(index)) / after;
    if (incoming * outgoing <= 0) return 0;
    const w1 = 2 * after + before,
      w2 = after + 2 * before;
    return (w1 + w2) / (w1 / incoming + w2 / outgoing);
  }
  update(delta: number): Pose {
    if (this.stopped) return {};
    this.elapsed += delta;
    this.age += delta;
    const t = Math.min(1, this.elapsed / this.clip.duration);
    const frames = this.clip.frames;
    for (const frame of frames)
      if (frame.impact && t >= frame.time && !this.fired) {
        this.fired = true;
        this.onImpact?.();
      }
    let index = Math.max(0, frames.length - 2);
    for (let i = 1; i < frames.length; i++)
      if (t <= frames[i].time) {
        index = i - 1;
        break;
      }
    const left = frames[index],
      right = frames[index + 1] ?? left;
    const f = Math.max(
      0,
      Math.min(1, (t - left.time) / (right.time - left.time || 1)),
    );
    const f2 = f * f,
      f3 = f2 * f,
      span = right.time - left.time;
    const result: Pose = {};
    for (const key of this.poseKeys) {
      const start = left.pose[key] ?? this.rest[key] ?? 0;
      const end = right.pose[key] ?? this.rest[key] ?? 0;
      result[key] =
        (2 * f3 - 3 * f2 + 1) * start +
        (f3 - 2 * f2 + f) * span * this.tangent(index, key) +
        (-2 * f3 + 3 * f2) * end +
        (f3 - f2) *
          span *
          this.tangent(Math.min(index + 1, frames.length - 1), key);
    }
    if (this.clip.sample)
      Object.assign(
        result,
        this.clip.sample(
          this.clip.loop
            ? (this.elapsed % this.clip.duration) / this.clip.duration
            : t,
        ),
      );
    if (this.clip.blendIn && this.age < this.clip.blendIn) {
      for (const key of this.poseKeys) {
        const [start, end] = this.clip.blendRanges?.[key] ?? [0, 1];
        const v = Math.max(
          0,
          Math.min(1, (this.age / this.clip.blendIn - start) / (end - start)),
        );
        const blend = v * v * (3 - 2 * v);
        result[key] =
          (this.transition[key] ?? result[key] ?? 0) +
          ((result[key] ?? 0) - (this.transition[key] ?? result[key] ?? 0)) *
            blend;
      }
    }
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
