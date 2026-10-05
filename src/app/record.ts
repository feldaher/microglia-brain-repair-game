// A record of a run, one frame every 15 minutes of tissue time (the paper's frame interval), and
// the measurements of Figs 1 and 3 made on it: tracks, mean-squared displacement, where the
// tracks converge, how tightly the microglia have gathered, how far the wound has closed.

import { Kind } from '../contracts';
import type { Game } from './game';

export const FRAME_MINUTES = 15;

export interface Point { x: number; y: number }

export class Record {
  /** Positions per frame, flat x, y per agent. */
  frames: Float64Array[] = [];
  /** Repair index at each frame. */
  closure: number[] = [];
  readonly kind: Uint8Array;
  readonly movable: Uint8Array;

  constructor(game: Game) {
    this.kind = game.tissue.kind;
    this.movable = game.tissue.movable;
    this.capture(game);
  }

  /** Call after every advance; keeps a frame whenever 15 more minutes have passed. */
  capture(game: Game): void {
    const t = game.tissue;
    while (this.frames.length * FRAME_MINUTES <= t.time + 1e-6) {
      const f = new Float64Array(2 * t.n);
      for (let i = 0; i < t.n; i++) { f[2 * i] = t.pos[3 * i]; f[2 * i + 1] = t.pos[3 * i + 1]; }
      this.frames.push(f);
      this.closure.push(game.repairIndex());
    }
  }

  /** Hours post-injury of frame f. */
  hpi(f: number): number { return 4 + (f * FRAME_MINUTES) / 60; }

  track(i: number): Point[] {
    return this.frames.map((f) => ({ x: f[2 * i], y: f[2 * i + 1] }));
  }

  private of(kind: number, movableOnly = false): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.kind.length; i++) if (this.kind[i] === kind && (!movableOnly || this.movable[i])) out.push(i);
    return out;
  }
  neurons(): number[] { return this.of(Kind.Neuron, true); }

  /** Time-averaged mean-squared displacement of the given cells at each lag: [hours, µm²]. */
  msd(cells: number[]): [number, number][] {
    const out: [number, number][] = [], F = this.frames;
    for (let lag = 1; lag < F.length; lag++) {
      let sum = 0, n = 0;
      for (let f = lag; f < F.length; f++) for (const i of cells) {
        sum += (F[f][2 * i] - F[f - lag][2 * i]) ** 2 + (F[f][2 * i + 1] - F[f - lag][2 * i + 1]) ** 2;
        n++;
      }
      out.push([(lag * FRAME_MINUTES) / 60, sum / n]);
    }
    return out;
  }

  /**
   * The exponent α of MSD ∝ t^α: the slope of log MSD against log lag. 1 for a random walk, 2 for
   * straight, steady movement. Null until there are 8 lags to fit, or if the cells have not moved.
   */
  msdExponent(cells: number[]): number | null {
    const pts = this.msd(cells).filter(([, v]) => v > 1e-9);
    if (cells.length === 0 || pts.length < 8) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const [t, v] of pts) { const x = Math.log(t), y = Math.log(v); sx += x; sy += y; sxx += x * x; sxy += x * y; }
    const n = pts.length;
    return (n * sxy - sx * sy) / (n * sxx - sx * sx);
  }

  /** Displacement of each free neuron from the first frame to the last. */
  displacements(): { from: Point; to: Point }[] {
    const a = this.frames[0], b = this.frames[this.frames.length - 1];
    return this.neurons().map((i) => ({ from: { x: a[2 * i], y: a[2 * i + 1] }, to: { x: b[2 * i], y: b[2 * i + 1] } }));
  }

  /**
   * Where the neurons are heading: the point nearest to all the lines drawn through each neuron's
   * start and end (least squares). Only neurons that have moved more than `minMove` µm count.
   */
  convergence(minMove = 20): Point | null {
    let m00 = 0, m01 = 0, m11 = 0, r0 = 0, r1 = 0, n = 0;
    for (const { from, to } of this.displacements()) {
      const dx = to.x - from.x, dy = to.y - from.y, l = Math.hypot(dx, dy);
      if (l < minMove) continue;
      const ux = dx / l, uy = dy / l;
      // Projector onto the normal of the line: I − u uᵀ.
      const p00 = 1 - ux * ux, p01 = -ux * uy, p11 = 1 - uy * uy;
      m00 += p00; m01 += p01; m11 += p11;
      r0 += p00 * from.x + p01 * from.y; r1 += p01 * from.x + p11 * from.y;
      n++;
    }
    const det = m00 * m11 - m01 * m01;
    if (n < 10 || Math.abs(det) < 1e-9) return null;
    return { x: (m11 * r0 - m01 * r1) / det, y: (m00 * r1 - m01 * r0) / det };
  }

  microgliaCentroid(f = this.frames.length - 1): Point | null {
    const cells = this.of(Kind.Microglia);
    if (!cells.length) return null;
    let x = 0, y = 0;
    for (const i of cells) { x += this.frames[f][2 * i]; y += this.frames[f][2 * i + 1]; }
    return { x: x / cells.length, y: y / cells.length };
  }

  /** How scattered the microglia are at frame f: rms distance to their centroid, µm. */
  spread(f: number): number {
    const cells = this.of(Kind.Microglia), c = this.microgliaCentroid(f);
    if (!c) return 0;
    let s = 0;
    for (const i of cells) s += (this.frames[f][2 * i] - c.x) ** 2 + (this.frames[f][2 * i + 1] - c.y) ** 2;
    return Math.sqrt(s / cells.length);
  }

  /**
   * How far the microglia have gathered at each frame, 0 to 1: the fall of their spread from its
   * starting value, as a share of the largest fall reached in the run. Our measure; the paper counts
   * microglia at the wound.
   */
  gathered(): number[] {
    const s0 = this.spread(0), fall = this.frames.map((_, f) => s0 - this.spread(f));
    const most = Math.max(...fall, 1e-9);
    return fall.map((v) => Math.max(0, v) / most);
  }
}
