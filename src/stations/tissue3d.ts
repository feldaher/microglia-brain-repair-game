// A preview of the 3D tissue: one lobe of the tectum as a soft body, with its nuclei, the pin's
// track and microglia that hold and pull. A sandbox for the physics; nothing here is calibrated yet.

import type { Vec3 } from '../contracts';
import type { Game } from '../app/game';
import { $, type Stage, type Station } from './stage';
import { darkField, type TissueView } from './tissueview';

export class Tissue3d implements Station {
  fig = 0;
  extent = 300;
  centre: Vec3 = [0, 0, 0];
  scale = { length: 50, label: '50 µm', note: 'real size' };
  orbit = true;
  tagline = ['A piece of brain,', 'in three dimensions.', 'Drag to turn it.'];
  help = 'A preview. Add microglia around the wound and tighten their hold: the tissue gives, the nuclei ride along, and the wound narrows.';
  fine = 'One lobe of the optic tectum as an elastic solid, with the size and the packing of nuclei measured on Fig. 1C of the paper and the pin track of its Methods (80 µm across, 25° to the horizontal). Each dot is a neuron\'s nucleus, pinned in the tissue. Microglia hold the tissue within 30 µm and shorten their hold. Nothing here is calibrated yet: how hard a microglia pulls and how stiff the tissue is are still free numbers, and the astrocytic fibres are not drawn. The thickness of the lobe and the depth of the neuropil are assumed.';

  private frames = 0;

  constructor(private stage: Stage, private view: TissueView) {
    $<HTMLInputElement>('t3-count').addEventListener('input', () => this.place());
    $<HTMLInputElement>('t3-pull').addEventListener('input', () => this.place());
    $('t3-reset').addEventListener('click', () => { this.view.reset(); this.readouts(); });
  }

  /** Puts the tissue where this station's sliders say. */
  private place(): void {
    this.view.set(Number($<HTMLInputElement>('t3-count').value), Number($<HTMLInputElement>('t3-pull').value) / 100);
    this.readouts();
  }

  game(): Game | null { return null; }
  enter(): void { darkField(true); this.place(); }
  leave(): void { darkField(false); }
  point(): void { /* dragging turns the tissue here */ }
  key(): void { /* no keys yet */ }

  frame(): void {
    if (!this.stage.held()) this.view.step();
    this.view.draw(this.stage);
    if (this.frames++ % 20 === 0) this.readouts();
  }

  private readouts(): void {
    const v = this.view;
    $('t3-count-out').textContent = String(v.count);
    $('t3-pull-out').textContent = `${Math.round(100 * v.tissue.shortening)}%`;
    $('t3-closed').textContent = String(Math.round(100 * v.closed()));
    $('t3-nuclei').textContent = (v.tissue.nuclei.length / 3).toLocaleString('en');
    if (v.cost > 0) $('t3-ms').textContent = v.cost.toFixed(1);
  }
}
