// Turns the state of the game into what the scene draws: one sphere per cell, the web of
// traction lines, the outline of the wound and the visitor's waypoint.

import { Kind, type Vec3 } from '../contracts';
import { WOUND } from '../model/fig4a';
import { LINE_STRIDE, SPHERE_STRIDE } from '../render/scene';
import type { Game } from './game';

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
} as const;
const RGB = Object.fromEntries(Object.entries(COLOURS).map(([k, v]) => [k, hex(v)])) as Record<keyof typeof COLOURS, Vec3>;

/** A pulling microglia draws a line to one neuron in this many, so the web stays readable. */
const WEB_EVERY = 14;

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
    this.lines = new Float32Array((game.microglia().length * Math.ceil(game.tissue.n / WEB_EVERY) * 2 + game.tissue.n * 2 + 200) * LINE_STRIDE);
  }

  private line(a: Vec3, b: Vec3, rgb: Vec3, alpha: number): void {
    this.lines.set([a[0], a[1], a[2], rgb[0], rgb[1], rgb[2], alpha, b[0], b[1], b[2], rgb[0], rgb[1], rgb[2], alpha], this.lineVerts * LINE_STRIDE);
    this.lineVerts += 2;
  }

  /** The model's plane (x, y) is the scene's ground (x, −z); cells rest on it. */
  update(game: Game, timeSeconds: number): void {
    const t = game.tissue, r = game.params.radius, out = this.spheres;
    this.sphereCount = t.n;
    this.lineVerts = 0;
    const world = (i: number): Vec3 => [t.pos[3 * i], r, -t.pos[3 * i + 1]];
    for (let i = 0; i < t.n; i++) {
      const me = i === game.player;
      const colour = t.kind[i] === Kind.Neuron ? RGB.neuron : t.kind[i] === Kind.Skin ? RGB.skin : me ? RGB.you : t.pulling[i] ? RGB.pulling : RGB.idle;
      const big = t.kind[i] === Kind.Microglia ? (me ? 1.35 : 1.15) : 1;
      // The visitor's cell breathes a little so it can be found; it glows while it pulls.
      const pulse = me ? 1 + 0.06 * Math.sin(timeSeconds * 4) : 1;
      const p = world(i);
      out.set([p[0], r * big * pulse, p[2], r * big * pulse, colour[0], colour[1], colour[2], me && t.pulling[i] ? 0.6 : 0], i * SPHERE_STRIDE);
    }
    // Traction: each pulling microglia is tied to every other cell; a sample of those ties is drawn.
    let m = 0;
    for (let i = 0; i < t.n; i++) {
      if (t.kind[i] !== Kind.Microglia) continue;
      m++;
      if (!t.pulling[i]) continue;
      const me = i === game.player, a = world(i);
      // Neurons and skin alike: the skin does not give, so it is what the microglia brace against.
      for (let j = (m * 5) % WEB_EVERY; j < t.n; j += WEB_EVERY) {
        if (t.kind[j] !== Kind.Microglia) this.line(a, world(j), me ? RGB.you : RGB.pulling, me ? 0.3 : 0.13);
      }
    }
    // Tracks: a line from where each neuron started to where it is now, once it has moved a radius.
    for (let i = 0; i < t.n; i++) {
      if (t.kind[i] !== Kind.Neuron) continue;
      const sx = this.start[3 * i], sy = this.start[3 * i + 1];
      if (Math.hypot(t.pos[3 * i] - sx, t.pos[3 * i + 1] - sy) > r) this.line([sx, 2 * r + 1, -sy], [t.pos[3 * i], 2 * r + 1, -t.pos[3 * i + 1]], RGB.ink, 0.5);
    }
    // The wound box.
    const y = r, c: Vec3[] = [[WOUND.x0, y, -WOUND.y0], [WOUND.x1, y, -WOUND.y0], [WOUND.x1, y, -WOUND.y1], [WOUND.x0, y, -WOUND.y1]];
    for (let k = 0; k < 4; k++) this.line(c[k], c[(k + 1) % 4], RGB.ink, 0.55);
    // Where the visitor is heading.
    if (game.target) {
      const cx = game.target.x, cz = -game.target.y, n = 20, rad = 1.6 * r;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * 2 * Math.PI, a1 = ((k + 1) / n) * 2 * Math.PI;
        this.line([cx + rad * Math.cos(a0), 1, cz + rad * Math.sin(a0)], [cx + rad * Math.cos(a1), 1, cz + rad * Math.sin(a1)], RGB.ink, 0.6);
      }
    }
  }
}
