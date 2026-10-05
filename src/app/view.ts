// Turns the state of a run into what the scene draws: one sphere per cell, the web of traction
// lines, neuron tracks, the outline of the wound, and whatever marks a station adds.

import { Kind, type Vec3 } from '../contracts';
import { WOUND } from '../model/fig4a';
import { LINE_STRIDE, SPHERE_STRIDE } from '../render/scene';
import type { Game } from './game';
import type { Point } from './record';

const hex = (h: string): Vec3 => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

/** sRGB colours of the scene; the page's stylesheet uses the same ones for the key. */
export const COLOURS = {
  ground: '#e4e0da',
  ink: '#1d1b19',
  neuron: '#d98a72',
  skin: '#8d8478',
  idle: '#9cc4bd',
  pulling: '#2f8f80',
  you: '#e0a52c',
  /** What the visitor has marked or measured on the model, and the same in the plots. */
  model: '#2a78d6',
  /** What was measured in fish, in the plots. */
  fish: '#c8590a',
} as const;
const RGB = Object.fromEntries(Object.entries(COLOURS).map(([k, v]) => [k, hex(v)])) as Record<keyof typeof COLOURS, Vec3>;

/** A pulling microglia draws a line to one cell in this many, so the web stays readable. */
const WEB_EVERY = 14;

export interface ViewOptions {
  /** Positions to draw in place of the live ones: flat x, y per agent. */
  positions?: Float64Array;
  hideMicroglia?: boolean;
  /** The traction web. On unless set to false. */
  web?: boolean;
  /** A line from each neuron's start to where it is. On unless set to false. */
  tracks?: boolean;
  /** Paths the visitor is following, drawn bold. */
  paths?: Point[][];
  /** Cells the visitor is following, drawn in the "model" colour. */
  followed?: number[];
  /** Circles on the ground: a guess, a computed point. */
  rings?: { at: Point; radius: number; colour: keyof typeof COLOURS }[];
}

export class View {
  spheres: Float32Array;
  sphereCount = 0;
  lines: Float32Array;
  lineVerts = 0;
  /** Where every cell was when the run began, for the tracks. */
  private start: Float64Array;

  constructor(game: Game) {
    this.start = game.tissue.pos.slice();
    this.spheres = new Float32Array(game.tissue.n * SPHERE_STRIDE);
    this.lines = new Float32Array((game.microglia().length * Math.ceil(game.tissue.n / WEB_EVERY) * 2 + game.tissue.n * 2 + 4000) * LINE_STRIDE);
  }

  private line(a: Vec3, b: Vec3, rgb: Vec3, alpha: number): void {
    if ((this.lineVerts + 2) * LINE_STRIDE > this.lines.length) return;
    this.lines.set([a[0], a[1], a[2], rgb[0], rgb[1], rgb[2], alpha, b[0], b[1], b[2], rgb[0], rgb[1], rgb[2], alpha], this.lineVerts * LINE_STRIDE);
    this.lineVerts += 2;
  }

  private ring(at: Point, radius: number, rgb: Vec3, alpha: number, height: number): void {
    const n = 28;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * 2 * Math.PI, a1 = ((k + 1) / n) * 2 * Math.PI;
      this.line([at.x + radius * Math.cos(a0), height, -at.y + radius * Math.sin(a0)], [at.x + radius * Math.cos(a1), height, -at.y + radius * Math.sin(a1)], rgb, alpha);
    }
  }

  /** The model's plane (x, y) is the scene's ground (x, −z); cells rest on it. */
  update(game: Game, timeSeconds: number, opts: ViewOptions = {}): void {
    const t = game.tissue, r = game.params.radius, out = this.spheres, P = opts.positions;
    const px = (i: number) => (P ? P[2 * i] : t.pos[3 * i]), py = (i: number) => (P ? P[2 * i + 1] : t.pos[3 * i + 1]);
    const world = (i: number): Vec3 => [px(i), r, -py(i)];
    const followed = new Set(opts.followed ?? []);
    this.sphereCount = t.n;
    this.lineVerts = 0;
    for (let i = 0; i < t.n; i++) {
      const me = i === game.player, mg = t.kind[i] === Kind.Microglia;
      const colour = followed.has(i) ? RGB.model : t.kind[i] === Kind.Neuron ? RGB.neuron : t.kind[i] === Kind.Skin ? RGB.skin : me ? RGB.you : t.pulling[i] ? RGB.pulling : RGB.idle;
      const big = mg ? (me ? 1.35 : 1.15) : followed.has(i) ? 1.25 : 1;
      // The visitor's cell breathes a little so it can be found; it glows while it pulls.
      const pulse = me ? 1 + 0.06 * Math.sin(timeSeconds * 4) : 1;
      const size = mg && opts.hideMicroglia ? 0 : r * big * pulse;
      out.set([px(i), size, -py(i), size, colour[0], colour[1], colour[2], (me && t.pulling[i]) || followed.has(i) ? 0.6 : 0], i * SPHERE_STRIDE);
    }
    // Traction: each pulling microglia is tied to every other cell; a sample of those ties is drawn.
    if (opts.web !== false && !opts.hideMicroglia) {
      let m = 0;
      for (let i = 0; i < t.n; i++) {
        if (t.kind[i] !== Kind.Microglia) continue;
        m++;
        if (!t.pulling[i]) continue;
        const me = i === game.player, a = world(i);
        // Neurons and skin alike: the skin does not give, so it is what holds the microglia out in the neuropil.
        for (let j = (m * 5) % WEB_EVERY; j < t.n; j += WEB_EVERY) {
          if (t.kind[j] !== Kind.Microglia) this.line(a, world(j), me ? RGB.you : RGB.pulling, me ? 0.3 : 0.13);
        }
      }
    }
    // Tracks: a line from where each neuron started to where it is now, once it has moved a radius.
    if (opts.tracks !== false) {
      for (let i = 0; i < t.n; i++) {
        if (t.kind[i] !== Kind.Neuron) continue;
        const sx = this.start[3 * i], sy = this.start[3 * i + 1];
        if (Math.hypot(px(i) - sx, py(i) - sy) > r) this.line([sx, 2 * r + 1, -sy], [px(i), 2 * r + 1, -py(i)], RGB.ink, 0.5);
      }
    }
    for (const path of opts.paths ?? []) {
      for (let k = 1; k < path.length; k++) {
        // Drawn three times side by side: lines are one pixel wide.
        for (const d of [-0.8, 0, 0.8]) this.line([path[k - 1].x + d, 2 * r + 3, -path[k - 1].y + d], [path[k].x + d, 2 * r + 3, -path[k].y + d], RGB.model, 1);
      }
    }
    for (const ring of opts.rings ?? []) {
      for (const d of [0, 1.2, 2.4]) this.ring(ring.at, ring.radius + d, RGB[ring.colour], 0.95, 2 * r + 4);
    }
    // The wound box.
    const y = r, c: Vec3[] = [[WOUND.x0, y, -WOUND.y0], [WOUND.x1, y, -WOUND.y0], [WOUND.x1, y, -WOUND.y1], [WOUND.x0, y, -WOUND.y1]];
    for (let k = 0; k < 4; k++) this.line(c[k], c[(k + 1) % 4], RGB.ink, 0.55);
    // Where the visitor is heading.
    if (game.target && game.player >= 0) this.ring(game.target, 1.6 * r, RGB.ink, 0.6, 1);
  }
}
