// Act 2 as a state machine with no rendering in it: the paper's tissue, a clock, the visitor's
// cell, and how many microglia pull.

import { Kind, type PlayerInput, type Tissue, type Vec3 } from '../contracts';
import { WOUND, fig4aSeeds } from '../model/fig4a';
import { openArea, repairIndex } from '../model/measure';
import { MODEL } from '../model/params';
import { rng } from '../model/random';
import { step } from '../model/step';
import { createTissue } from '../model/tissue';

/** The simulation starts 4 hours after the injury (Fig 4A). */
export const HPI_START = 4;
/**
 * Real seconds a whole run takes. Over a run the fastest neuron travels about 120 µm, so a longer
 * run makes the tissue's movement too slow to see.
 */
export const RUN_SECONDS = 60;
/** Tissue minutes per real second, and the same as a plain factor. */
export const MINUTES_PER_SECOND = MODEL.duration / RUN_SECONDS;
export const SPEED_UP = MINUTES_PER_SECOND * 60;
/** Most model steps taken in one call, so a stalled tab does not freeze on return. */
const MAX_STEPS = 40;

export class Game {
  readonly params = MODEL;
  tissue: Tissue;
  /** Index of the visitor's cell. */
  player: number;
  /** Point of the tissue plane the visitor is heading for, µm. */
  target: { x: number; y: number } | null = null;
  private rand: () => number;
  private owed = 0;
  private woundAtStart: number;

  constructor(seed = 0) {
    this.rand = rng(seed);
    this.tissue = createTissue(fig4aSeeds(MODEL.radius));
    this.tissue.pulling.fill(0);
    const cx = (WOUND.x0 + WOUND.x1) / 2, cy = (WOUND.y0 + WOUND.y1) / 2;
    let best = -1, bestD = Infinity;
    for (const i of this.microglia()) {
      const d = Math.hypot(this.tissue.pos[3 * i] - cx, this.tissue.pos[3 * i + 1] - cy);
      if (d < bestD) { bestD = d; best = i; }
    }
    this.player = best;
    this.woundAtStart = this.woundArea();
  }

  microglia(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.tissue.n; i++) if (this.tissue.kind[i] === Kind.Microglia) out.push(i);
    return out;
  }

  /** Whether the visitor's cell is pulling. */
  get pulling(): boolean { return this.tissue.pulling[this.player] === 1; }
  set pulling(on: boolean) { this.tissue.pulling[this.player] = on ? 1 : 0; }

  /** Hours post-injury. */
  hpi(): number { return HPI_START + this.tissue.time / 60; }
  get done(): boolean { return this.tissue.time >= MODEL.duration - 1e-6; }
  pullingCount(): number { return this.microglia().filter((i) => this.tissue.pulling[i]).length; }

  /** Open area of the wound box, µm². */
  woundArea(): number { return openArea(this.tissue, WOUND, MODEL.radius, 2); }
  repairIndex(): number { return repairIndex(this.woundAtStart, this.woundArea()); }

  /** Sets every microglia pulling, as in the paper's simulation. */
  callAll(): void {
    for (const i of this.microglia()) this.tissue.pulling[i] = 1;
  }

  /** The idle microglia nearest the visitor's cell starts pulling. False when none is left. */
  call(): boolean {
    const p = this.tissue.pos, me = this.player;
    let best = -1, bestD = Infinity;
    for (const i of this.microglia()) {
      if (i === me || this.tissue.pulling[i]) continue;
      const d = Math.hypot(p[3 * i] - p[3 * me], p[3 * i + 1] - p[3 * me + 1]);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return false;
    this.tissue.pulling[best] = 1;
    return true;
  }

  private input(): PlayerInput {
    let heading: Vec3 | null = null;
    if (this.target) {
      const dx = this.target.x - this.tissue.pos[3 * this.player], dy = this.target.y - this.tissue.pos[3 * this.player + 1];
      const d = Math.hypot(dx, dy);
      // Within a radius of the target the model's own random walk takes over again.
      if (d > MODEL.radius) heading = [dx / d, dy / d, 0];
    }
    return { agent: this.player, heading, pulling: this.pulling };
  }

  /** Advances the tissue by `seconds` of play. Returns the number of model steps taken. */
  advance(seconds: number): number {
    if (this.done) return 0;
    this.owed += (seconds * MINUTES_PER_SECOND) / MODEL.dt;
    let steps = Math.min(Math.floor(this.owed + 1e-9), MAX_STEPS);
    steps = Math.min(steps, Math.round((MODEL.duration - this.tissue.time) / MODEL.dt));
    this.owed = Math.min(this.owed - steps, MAX_STEPS);
    for (let i = 0; i < steps; i++) step(this.tissue, MODEL, this.rand, { input: this.input() });
    return steps;
  }
}
