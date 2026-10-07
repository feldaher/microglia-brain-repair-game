// A preview of the 3D tissue: one lobe of the tectum as a soft body, with its nuclei, the pin's
// track and microglia that hold and pull. A sandbox for the physics; nothing here is calibrated yet.

import type { Vec3 } from '../contracts';
import type { Game } from '../app/game';
import { LINE_STRIDE, SPHERE_STRIDE } from '../render/scene';
import { Region } from '../tissue/anatomy';
import { Tissue } from '../tissue/tissue';
import { $, type Stage, type Station } from './stage';

const hex = (h: string): Vec3 => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
/** The colours of the fluorescent lines of the paper: nuclei (h2a:GFP), microglia (mpeg1:mCherry). */
const DARK: Vec3 = hex('#0a0c0f'), NUCLEUS = hex('#a9e8bf'), SKIN = hex('#e9fff0'), MICROGLIA = hex('#ff5468'), HOLD = hex('#ff5468');
const REACH = 30;

export class Tissue3d implements Station {
  fig = 0;
  extent = 300;
  centre: Vec3 = [0, 0, 0];
  scale = { length: 50, label: '50 µm', note: 'real size' };
  orbit = true;
  tagline = ['A piece of brain,', 'in three dimensions.', 'Drag to turn it.'];
  help = 'A preview. Add microglia around the wound and tighten their hold: the tissue gives, the nuclei ride along, and the wound narrows.';
  fine = 'One lobe of the optic tectum as an elastic solid, with the size and the packing of nuclei measured on Fig. 1C of the paper and the pin track of its Methods (80 µm across, 25° to the horizontal). Each dot is a neuron\'s nucleus, pinned in the tissue. Microglia hold the tissue within 30 µm and shorten their hold. Nothing here is calibrated yet: how hard a microglia pulls and how stiff the tissue is are still free numbers, and the astrocytic fibres are not drawn. The thickness of the lobe and the depth of the neuropil are assumed.';

  private tissue = new Tissue();
  private rest = this.tissue.woundVolume();
  private spheres = new Float32Array(0);
  private lines = new Float32Array(0);
  private count = 12;
  private frames = 0;
  private cost = 0;

  constructor(private stage: Stage) {
    $<HTMLInputElement>('t3-count').addEventListener('input', (e) => { this.count = Number((e.target as HTMLInputElement).value); this.place(); });
    $<HTMLInputElement>('t3-pull').addEventListener('input', (e) => { this.tissue.shortening = Number((e.target as HTMLInputElement).value) / 100; this.readouts(); });
    $('t3-reset').addEventListener('click', () => { this.tissue = new Tissue(); this.place(); });
    this.place();
  }

  private place(): void {
    const pull = Number($<HTMLInputElement>('t3-pull').value) / 100;
    this.tissue.placeMicroglia(Tissue.aroundWound(this.count), REACH);
    this.tissue.shortening = pull;
    this.readouts();
  }

  game(): Game | null { return null; }
  enter(): void {
    document.documentElement.dataset.variety = 'fluorescence';
    document.documentElement.style.setProperty('--bg', '#0a0c0f');
    document.documentElement.style.setProperty('--ink', '#e8e6e1');
  }
  leave(): void {
    delete document.documentElement.dataset.variety;
    document.documentElement.style.removeProperty('--bg');
    document.documentElement.style.removeProperty('--ink');
  }
  point(): void { /* dragging turns the tissue here */ }
  key(): void { /* no keys yet */ }

  frame(): void {
    const t = this.tissue, started = performance.now();
    if (!this.stage.held()) t.step();
    this.cost += performance.now() - started;

    const n = t.nuclei.length / 3, m = t.microglia.length / 3;
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
    this.stage.scene.render(this.stage.cam, s, n + m, this.lines, holds.length * 2, DARK, { depth: 260 });
    if (this.frames++ % 20 === 0) this.readouts();
  }

  private readouts(): void {
    const t = this.tissue;
    $('t3-count-out').textContent = String(this.count);
    $('t3-pull-out').textContent = `${Math.round(100 * t.shortening)}%`;
    $('t3-closed').textContent = String(Math.round(100 * (1 - t.woundVolume() / this.rest)));
    $('t3-nuclei').textContent = (t.nuclei.length / 3).toLocaleString('en');
    if (this.frames > 0) $('t3-ms').textContent = (this.cost / this.frames).toFixed(1);
  }
}
