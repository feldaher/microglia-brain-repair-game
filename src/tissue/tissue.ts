// The tissue as it is simulated: the soft body, the nuclei and fibres pinned in it, the microglia
// and their hold on it, and the measure of the wound.

import type { Vec3 } from '../contracts';
import { TetGrid, embedPoints, moveEmbedded } from '../soft/embed';
import { rng } from '../soft/mat3';
import { buildTetMesh } from '../soft/mesh';
import { step, type SolverParams } from '../soft/solver';
import type { SoftMesh } from '../soft/types';
import { PIN, PIN_AXIS, Region, TECTUM, alongPin, isHeld, lobeSdf, pinRadius, pinSdf, regionAt, tissueSdf } from './anatomy';

/** Frame length of the solver, s. */
export const FRAME = 1 / 60;

export const SOLVER: SolverParams = {
  substeps: 2,
  softness: 100,
  // Tissue can lose and take up fluid over hours, so it is far from incompressible on that time scale.
  lambdaOverMu: 2,
  damping: 260,
  // Cell-dense zone, neuropil, skin. The skin is taken to be 4 times stiffer; there is no measurement.
  materialStiffness: [1, 1, 4],
};

export interface TissueOptions {
  /** Lattice spacing of the mesh, µm. */
  spacing?: number;
  wounded?: boolean;
  seed?: number;
}

/** A microglia's hold on one particle of the tissue. */
interface Hold {
  cell: number;
  particle: number;
  /** Distance between them when the hold was made. */
  length: number;
}

export class Tissue {
  readonly mesh: SoftMesh;
  /** Rest positions of the nuclei, xyz, and where they are now. */
  readonly nucleiRest: Float32Array;
  readonly nuclei: Float32Array;
  readonly nucleusRegion: Uint8Array;
  private nucleiIn: { tetId: Uint32Array; bary: Float32Array };

  /** Microglia: position and velocity, xyz each. They are not part of the mesh. */
  microglia = new Float32Array(0);
  private microgliaVel = new Float32Array(0);
  private holds: Hold[] = [];
  /** How much of its length every hold has given up, 0 to 1. */
  shortening = 0;
  /** Stiffness of a hold over (shear modulus × mesh spacing). */
  grip = 1;

  /** Rings of wall particles around the wound, from the skin down, for measuring it. */
  private rings: { particles: number[]; length: number }[] = [];
  readonly params: SolverParams;

  constructor(opts: TissueOptions = {}, params: SolverParams = SOLVER) {
    const spacing = opts.spacing ?? 10, wounded = opts.wounded ?? true;
    this.params = params;
    const sdf = tissueSdf(wounded), L = TECTUM.lobe;
    this.mesh = buildTetMesh(sdf, { lo: [-L[0] - 3, -L[1] - 3, -L[2] - 3], hi: [L[0] + 3, L[1] + 3, L[2] + 3] }, spacing, regionAt);
    const m = this.mesh;
    for (let i = 0; i < m.invMass.length; i++) if (isHeld(m.restPos[3 * i], m.restPos[3 * i + 1], m.restPos[3 * i + 2])) m.invMass[i] = 0;

    // Nuclei: a jittered close-packed lattice in the cell-dense zone, a few in the neuropil and the skin.
    const rand = rng(opts.seed ?? 1), pts: number[] = [], region: number[] = [];
    // Face-centred cubic: hexagonal layers a·√(2/3) apart, each shifted from the one below by a third
    // of the way across a triangle of the layer (the A, B, C positions), so every nucleus has twelve
    // neighbours at the spacing a.
    const a = TECTUM.nucleusSpacing, jitter = 0.1 * a;
    const dy = a * Math.sqrt(2 / 3), dz = (a * Math.sqrt(3)) / 2;
    for (let j = 0, y = -L[1]; y <= L[1]; j++, y = -L[1] + j * dy) {
      const sx = ((j % 3) * a) / 2, sz = ((j % 3) * a * Math.sqrt(3)) / 6;
      for (let k = 0, z = -L[2] + sz; z <= L[2]; k++, z = -L[2] + sz + k * dz) {
        for (let x = -L[0] + sx + ((k % 2) * a) / 2; x <= L[0]; x += a) {
          const p: Vec3 = [x + (rand() - 0.5) * jitter, y + (rand() - 0.5) * jitter, z + (rand() - 0.5) * jitter];
          if (sdf(p[0], p[1], p[2]) > -a / 2) continue;
          const r = regionAt(p[0], p[1], p[2]);
          // The neuropil has a few cell bodies, the skin a single layer of them; the rest is the packed zone.
          if (r === Region.Neuropil && rand() > 0.004) continue;
          if (r === Region.Skin && rand() > 0.12) continue;
          pts.push(...p); region.push(r);
        }
      }
    }
    this.nucleiRest = Float32Array.from(pts);
    this.nucleusRegion = Uint8Array.from(region);
    this.nuclei = this.nucleiRest.slice();
    const e = embedPoints(new TetGrid(m), pts);
    this.nucleiIn = { tetId: e.tetId, bary: e.bary };

    if (wounded) this.findRings();
  }

  /** Wall particles of the wound, grouped along its axis. */
  private findRings(): void {
    const m = this.mesh, n = 8, by: number[][] = Array.from({ length: n }, () => []);
    // Only the part of the track that lies inside the lobe has a wall.
    let t0 = 1, t1 = 0;
    for (let i = 0; i < m.invMass.length; i++) {
      const x = m.restPos[3 * i], y = m.restPos[3 * i + 1], z = m.restPos[3 * i + 2];
      if (Math.abs(pinSdf(x, y, z)) > 0.35 * m.spacing) continue;
      const { t } = alongPin(x, y, z);
      if (t < 0 || t > 1) continue;
      t0 = Math.min(t0, t); t1 = Math.max(t1, t);
    }
    for (let i = 0; i < m.invMass.length; i++) {
      const x = m.restPos[3 * i], y = m.restPos[3 * i + 1], z = m.restPos[3 * i + 2];
      if (Math.abs(pinSdf(x, y, z)) > 0.35 * m.spacing) continue;
      const { t } = alongPin(x, y, z);
      if (t < t0 || t > t1) continue;
      by[Math.min(n - 1, Math.floor(((t - t0) / (t1 - t0)) * n))].push(i);
    }
    const length = ((t1 - t0) * PIN.depth) / n;
    this.rings = by.filter((r) => r.length >= 4).map((particles) => ({ particles, length }));
  }

  /**
   * Volume of the wound, µm³: for each ring of wall particles, the area of the circle of their mean
   * square distance from the track's axis through their centroid, times the length the ring stands for.
   */
  woundVolume(): number {
    const p = this.mesh.pos;
    let v = 0;
    for (const ring of this.rings) {
      let cx = 0, cy = 0, cz = 0;
      for (const i of ring.particles) { cx += p[3 * i]; cy += p[3 * i + 1]; cz += p[3 * i + 2]; }
      const n = ring.particles.length;
      cx /= n; cy /= n; cz /= n;
      let r2 = 0;
      for (const i of ring.particles) {
        const dx = p[3 * i] - cx, dy = p[3 * i + 1] - cy, dz = p[3 * i + 2] - cz;
        const s = dx * PIN_AXIS[0] + dy * PIN_AXIS[1] + dz * PIN_AXIS[2];
        r2 += dx * dx + dy * dy + dz * dz - s * s;
      }
      v += Math.PI * (r2 / n) * ring.length;
    }
    return v;
  }

  /** The volume of the track inside the lobe, by sampling: what `woundVolume` should give at rest. */
  static channelVolume(stepSize = 2): number {
    const L = TECTUM.lobe;
    let n = 0;
    for (let x = -L[0]; x <= L[0]; x += stepSize) for (let y = -L[1]; y <= L[1]; y += stepSize) for (let z = -L[2]; z <= L[2]; z += stepSize) {
      if (lobeSdf(x, y, z) < 0 && pinSdf(x, y, z) < 0) n++;
    }
    return n * stepSize ** 3;
  }

  /**
   * Places for `count` microglia: in the neuropil, 8 to 30 µm from the wall of the wound along the
   * upper two thirds of the track, and at least 14 µm from each other. In fish they gather in the
   * superficial neuropil over the injury (p. 4, Fig 3C–F).
   */
  static aroundWound(count: number, seed = 1): Vec3[] {
    const rand = rng(seed), out: Vec3[] = [], L = TECTUM.lobe;
    for (let tries = 0; tries < 200000 && out.length < count; tries++) {
      const p: Vec3 = [(2 * rand() - 1) * L[0], (2 * rand() - 1) * L[1], (2 * rand() - 1) * L[2]];
      if (lobeSdf(p[0], p[1], p[2]) > -4 || regionAt(p[0], p[1], p[2]) !== Region.Neuropil) continue;
      const d = pinSdf(p[0], p[1], p[2]), { t } = alongPin(p[0], p[1], p[2]);
      if (d < 8 || d > 30 || t < 0.05 || t > 0.7) continue;
      if (out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 14)) continue;
      out.push(p);
    }
    return out;
  }

  /** Puts microglia at these points; each takes hold of the particles within `reach` of it. */
  placeMicroglia(points: Vec3[], reach: number): void {
    const m = this.mesh;
    this.microglia = Float32Array.from(points.flat());
    this.microgliaVel = new Float32Array(this.microglia.length);
    this.holds = [];
    points.forEach((c, cell) => {
      for (let i = 0; i < m.invMass.length; i++) {
        const length = Math.hypot(m.pos[3 * i] - c[0], m.pos[3 * i + 1] - c[1], m.pos[3 * i + 2] - c[2]);
        if (length < reach && length > 1e-6) this.holds.push({ cell, particle: i, length });
      }
    });
  }

  get holdCount(): number { return this.holds.length; }

  /** One hold in `every`, for drawing a microglia's arms. */
  heldParticles(every: number): { cell: number; particle: number }[] {
    return this.holds.filter((_, k) => k % every === 0);
  }

  /**
   * The microglia's pull, one substep: each hold is a spring toward its shortened length, acting
   * equally and oppositely on the particle and on the cell (XPBD distance constraint with compliance).
   */
  private pull = (h: number): void => {
    if (!this.holds.length) return;
    const m = this.mesh, p = m.pos, c = this.microglia;
    const mu = (m.spacing * m.spacing) / (this.params.softness * h * h);
    const alpha = 1 / (this.grip * mu * m.spacing) / (h * h);
    // A microglia is given the mass of one mesh particle's worth of tissue.
    const wCell = 2 / m.spacing ** 3;
    for (const hold of this.holds) {
      const i = 3 * hold.particle, k = 3 * hold.cell, w = m.invMass[hold.particle];
      const dx = p[i] - c[k], dy = p[i + 1] - c[k + 1], dz = p[i + 2] - c[k + 2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 1e-9) continue;
      const dl = -(d - hold.length * (1 - this.shortening)) / (w + wCell + alpha);
      const sx = (dl * dx) / d, sy = (dl * dy) / d, sz = (dl * dz) / d;
      p[i] += w * sx; p[i + 1] += w * sy; p[i + 2] += w * sz;
      c[k] -= wCell * sx; c[k + 1] -= wCell * sy; c[k + 2] -= wCell * sz;
    }
  };

  /** Advances the tissue by one frame. */
  step(): void {
    const c = this.microglia, v = this.microgliaVel, h = FRAME / this.params.substeps;
    const before = c.slice();
    step(this.mesh, this.params, FRAME, this.pull);
    // The microglia are heavily damped bodies: they keep a fraction of the motion the holds gave them.
    for (let k = 0; k < c.length; k++) { v[k] = ((c[k] - before[k]) / FRAME) * Math.exp(-this.params.damping * h); }
    moveEmbedded(this.mesh, this.nucleiIn.tetId, this.nucleiIn.bary, this.nuclei);
  }

  /** Mean squared speed of the particles, (µm/s)²: near zero when the tissue has settled. */
  agitation(): number {
    const v = this.mesh.vel;
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * v[i];
    return s / (v.length / 3);
  }

  /** Radius of the track at the skin and at the tip, for the tests. */
  static pinRadii(): [number, number] { return [pinRadius(0), pinRadius(1)]; }
}
