// The director: which chapter and which line the visitor is on, and where the camera stands.
// A state machine with no page and no GPU in it; the station asks it for a pose each frame.

import { between, ease } from './camera';
import type { Chapter, DirectorState, Shot } from './types';

export class Director {
  readonly state: DirectorState = { index: 0, line: 0, phase: 'arrived', t: 1 };
  /** Where the flight under way started. */
  private from: Shot;
  private cut: boolean;

  constructor(readonly chapters: Chapter[], opts: { reducedMotion?: boolean } = {}) {
    this.from = chapters[0].shot;
    this.cut = opts.reducedMotion ?? false;
  }

  get chapter(): Chapter { return this.chapters[this.state.index]; }
  caption(): string { return this.chapter.captions[this.state.line]; }

  /** Where the camera is. Once the visitor has taken it, where the chapter would have it. */
  pose(): Shot {
    return this.state.phase === 'flying' ? between(this.from, this.chapter.shot, ease(this.state.t)) : this.chapter.shot;
  }

  private flyTo(index: number, line: number, from: Shot): void {
    const s = this.state;
    this.from = from;
    s.index = index; s.line = line;
    s.phase = this.cut ? 'arrived' : 'flying';
    s.t = this.cut ? 1 : 0;
  }

  /**
   * The next line, or the next chapter after the last one; during a flight, lands it. `left` is
   * where the visitor left the camera, if they took it. False if there was nowhere to go.
   */
  next(left?: Shot): boolean {
    const s = this.state;
    if (s.phase === 'flying') { s.phase = 'arrived'; s.t = 1; return true; }
    if (s.line < this.chapter.captions.length - 1) { s.line++; return true; }
    if (s.index >= this.chapters.length - 1) return false;
    this.flyTo(s.index + 1, 0, left ?? this.pose());
    return true;
  }

  /** The line before, or the last line of the chapter before. */
  back(left?: Shot): boolean {
    const s = this.state;
    if (s.phase !== 'flying' && s.line > 0) { s.line--; return true; }
    if (s.index === 0) return false;
    this.flyTo(s.index - 1, this.chapters[s.index - 1].captions.length - 1, left ?? this.pose());
    return true;
  }

  /** Straight to the first line of a chapter. */
  goto(index: number, left?: Shot): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.chapters.length || index === this.state.index) return false;
    this.flyTo(index, 0, left ?? this.pose());
    return true;
  }

  /** The visitor takes the camera: only once arrived, and only where the chapter has a stop. */
  release(): boolean {
    if (this.state.phase !== 'arrived' || !this.chapter.stop) return false;
    this.state.phase = 'free';
    return true;
  }

  tick(dt: number): void {
    const s = this.state;
    if (s.phase !== 'flying') return;
    s.t = Math.min(1, s.t + dt / this.chapter.flight);
    if (s.t >= 1) s.phase = 'arrived';
  }
}
