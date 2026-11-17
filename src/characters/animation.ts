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
export class Animator {
  private elapsed = 0;
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
  get running() {
    return (
      !this.stopped &&
      (this.clip.loop === true || this.elapsed < this.clip.duration)
    );
  }
  play(name: string, impact?: () => void, complete?: () => void) {
    const source = this.library[name] ?? this.library.idle;
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
    for (const key of this.poseKeys)
      result[key] =
        (left.pose[key] ?? this.rest[key] ?? 0) +
        ((right.pose[key] ?? this.rest[key] ?? 0) -
          (left.pose[key] ?? this.rest[key] ?? 0)) *
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
