// The paper's simulation as something to watch and scrub: every microglia pulls from the start,
// the run is recorded as it plays, and the playhead can go back over what has been recorded.

import { Game, MINUTES_PER_SECOND } from './game';
import { FRAME_MINUTES, Record } from './record';

export class Replay {
  readonly game: Game;
  readonly record: Record;
  /** Hours post-injury being shown. */
  playhead = 4;
  playing = true;

  constructor(seed = 0, microglia?: number) {
    this.game = new Game(seed, microglia);
    this.game.callAll();
    // Nobody is steered here: the visitor watches and measures.
    this.game.player = -1;
    this.record = new Record(this.game);
  }

  /** Moves the playhead on by `seconds` of play, simulating further when it reaches the end of the record. */
  advance(seconds: number): void {
    if (!this.playing) return;
    const want = this.playhead + (seconds * MINUTES_PER_SECOND) / 60;
    if (want > this.game.hpi()) {
      this.game.advance(seconds);
      this.record.capture(this.game);
    }
    this.playhead = Math.min(want, this.game.hpi());
    if (this.game.done && this.playhead >= this.game.hpi()) this.playing = false;
  }

  /** Puts the playhead at `hpi`, within what has been simulated so far. */
  seek(hpi: number): void {
    this.playhead = Math.min(Math.max(hpi, 4), this.game.hpi());
  }

  /** Number of frames up to the playhead (at least 1). */
  framesShown(): number {
    return Math.min(this.record.frames.length, Math.floor(((this.playhead - 4) * 60) / FRAME_MINUTES + 1e-6) + 1);
  }

  /** Positions at the playhead, flat x, y per agent, interpolated between recorded frames. */
  positions(): Float64Array {
    const F = this.record.frames, at = ((this.playhead - 4) * 60) / FRAME_MINUTES;
    const a = Math.min(Math.floor(at), F.length - 1);
    if (a >= F.length - 1) {
      // Past the last frame kept: the live tissue.
      const t = this.game.tissue, live = new Float64Array(2 * t.n);
      for (let i = 0; i < t.n; i++) { live[2 * i] = t.pos[3 * i]; live[2 * i + 1] = t.pos[3 * i + 1]; }
      return this.playhead >= this.game.hpi() - 1e-9 ? live : F[a];
    }
    const w = at - a, out = new Float64Array(F[a].length);
    for (let k = 0; k < out.length; k++) out[k] = (1 - w) * F[a][k] + w * F[a + 1][k];
    return out;
  }
}
