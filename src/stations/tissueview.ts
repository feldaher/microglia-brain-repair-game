// The 3D tissue on screen: one lobe of the tectum with its nuclei, the microglia around the wound
// and what they hold. Built once and shared by the stations that show it.

import type { Vec3 } from '../contracts';
import { LINE_STRIDE, SPHERE_STRIDE, type Extras } from '../render/scene';
import { Region } from '../tissue/anatomy';
import { Tissue } from '../tissue/tissue';
import type { Stage } from './stage';

const hex = (h: string): Vec3 => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
/** The colours of the fluorescent lines of the paper: nuclei (h2a:GFP), microglia (mpeg1:mCherry). */
export const DARK_FIELD = '#0a0c0f';
const DARK = hex(DARK_FIELD), NUCLEUS = hex('#a9e8bf'), SKIN = hex('#e9fff0'), MICROGLIA = hex('#ff5468'), HOLD = hex('#ff5468');
/** How far a microglia reaches to take hold, µm. */
const REACH = 30;
/** Frames the tissue is given to come to rest after a change (it settles in about 300; see the design note). */
const SETTLE = 600;

export class TissueView {
  tissue = new Tissue();
  /** Volume of the wound before anything pulls, µm³. */
  readonly rest = this.tissue.woundVolume();
  count = -1;
  /** Milliseconds of physics per frame, averaged over the frames that ran it. */
  cost = 0;
  private spheres = new Float32Array(0);
  private lines = new Float32Array(0);
  private settling = 0;
  private stepped = 0;
  private spent = 0;

  /** `count` microglia around the wound, each shortening its hold by the fraction `pull`. */
  set(count: number, pull: number): void {
    if (count !== this.count) this.tissue.placeMicroglia(Tissue.aroundWound(count), REACH);
    this.count = count;
    this.tissue.shortening = pull;
    this.settling = SETTLE;
  }

  /** The tissue as it was before anything pulled, with the same microglia. */
  reset(): void {
    const pull = this.tissue.shortening, count = this.count;
    this.tissue = new Tissue();
    this.count = -1;
    this.set(count, pull);
  }

  /** Share of the wound's volume that has closed, 0 to 1. */
  closed(): number { return 1 - this.tissue.woundVolume() / this.rest; }

  /** One frame of physics, while there is something for the tissue to answer to. */
  step(): void {
    if (this.count <= 0 && this.settling <= 0) return;
    this.settling--;
    const started = performance.now();
    this.tissue.step();
    this.spent += performance.now() - started;
    this.cost = this.spent / ++this.stepped;
  }

  draw(stage: Stage, extras?: Extras): void {
    const t = this.tissue, n = t.nuclei.length / 3, m = t.microglia.length / 3;
    if (this.spheres.length < (n + m) * SPHERE_STRIDE) this.spheres = new Float32Array((n + m) * SPHERE_STRIDE);
    const s = this.spheres;
    for (let i = 0; i < n; i++) {
      const skin = t.nucleusRegion[i] === Region.Skin, c = skin ? SKIN : NUCLEUS;
      s.set([t.nuclei[3 * i], t.nuclei[3 * i + 1], t.nuclei[3 * i + 2], 2.3, c[0], c[1], c[2], skin ? 0.5 : 0], i * SPHERE_STRIDE);
    }
    for (let k = 0; k < m; k++) {
      s.set([t.microglia[3 * k], t.microglia[3 * k + 1], t.microglia[3 * k + 2], 5.5, MICROGLIA[0], MICROGLIA[1], MICROGLIA[2], 0.6], (n + k) * SPHERE_STRIDE);
    }
    // A microglia's arms: a line to a sample of what it holds.
    const holds = t.heldParticles(6);
    if (this.lines.length < holds.length * 2 * LINE_STRIDE) this.lines = new Float32Array(holds.length * 2 * LINE_STRIDE);
    const p = t.mesh.pos, c = t.microglia;
    holds.forEach(({ cell, particle }, k) => {
      this.lines.set([c[3 * cell], c[3 * cell + 1], c[3 * cell + 2], HOLD[0], HOLD[1], HOLD[2], 0.55,
        p[3 * particle], p[3 * particle + 1], p[3 * particle + 2], HOLD[0], HOLD[1], HOLD[2], 0.05], k * 2 * LINE_STRIDE);
    });
    stage.scene.render(stage.cam, s, n + m, this.lines, holds.length * 2, DARK, { depth: 260 }, extras);
  }
}

/** The page in the dark of a fluorescence microscope, and back. */
export function darkField(on: boolean): void {
  const root = document.documentElement;
  if (on) {
    root.dataset.variety = 'fluorescence';
    root.style.setProperty('--bg', DARK_FIELD);
    root.style.setProperty('--ink', '#e8e6e1');
  } else {
    delete root.dataset.variety;
    root.style.removeProperty('--bg');
    root.style.removeProperty('--ink');
  }
}
