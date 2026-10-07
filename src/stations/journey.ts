// The journey: the paper told as chapters on the 3D tissue. The director flies the camera from
// chapter to chapter; at a stop the visitor takes it, opens the hotspots, and tries the experiment.
// Design: outputs/design/2026-10-07_journey-architecture.md.

import type { Vec3 } from '../contracts';
import type { Game } from '../app/game';
import { frame as frameShot } from '../journey/camera';
import { Director } from '../journey/director';
import { where } from '../journey/hotspot';
import type { Chapter, Shot, Viewport } from '../journey/types';
import { project } from '../render/camera';
import { CHAPTERS } from '../teach/chapters';
import { Hotspots } from '../ui/hotspots';
import { $, type Stage, type Station } from './stage';
import { darkField, type TissueView } from './tissueview';

/** Depth of field and glow of the last pass; left out where the pointer is a finger, to spare a phone's GPU. */
const EFFECTS = { blur: 20, glow: 0.45 };

export class Journey implements Station {
  fig = -1;
  id = 'journey';
  tagline = ['A wound in a young brain,', 'and what closes it.'];
  help = '';
  fine = 'The tissue is one lobe of the optic tectum as an elastic solid of ours, with the size and the packing of nuclei measured on Fig. 1C of the paper and the pin track of its Methods. It is not the paper\'s model, which is two-dimensional, and it is not yet calibrated: how hard a microglia pulls and how stiff the tissue is are free numbers, so what the sliders do shows the idea and no measured amount. The astrocytic fibres are not drawn. The thickness of the lobe is assumed. The picture of the real tissue is shown at the scale of the model and is not laid over it.';

  private director: Director;
  private hotspots: Hotspots;
  private on: Chapter | null = null;
  private line = -1;
  private frames = 0;
  private effects = window.matchMedia('(pointer: coarse)').matches ? undefined : EFFECTS;
  private dots: HTMLButtonElement[];

  constructor(private stage: Stage, private view: TissueView) {
    this.director = new Director(CHAPTERS, { reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    this.hotspots = new Hotspots(stage.labels);
    $('j-next').addEventListener('click', () => this.director.next(this.left()));
    $('j-back').addEventListener('click', () => this.director.back(this.left()));
    this.dots = CHAPTERS.map((c, i) => {
      const b = document.createElement('button');
      b.textContent = String(i + 1);
      b.title = c.title;
      b.setAttribute('aria-label', `Chapter ${i + 1}: ${c.title}`);
      b.addEventListener('click', () => this.director.goto(i, this.left()));
      $('j-dots').append(b);
      return b;
    });
    $<HTMLInputElement>('j-count').addEventListener('input', () => this.place());
    $<HTMLInputElement>('j-pull').addEventListener('input', () => this.place());
  }

  private get chapter(): Chapter { return this.director.chapter; }
  get extent(): number { return this.chapter.shot.extent; }
  get centre(): Vec3 { return this.chapter.shot.centre; }
  get scale(): Chapter['scale'] { return this.chapter.scale; }
  /** The visitor may turn the tissue once the camera has arrived at a stop. */
  get orbit(): boolean { return this.director.state.phase !== 'flying' && !!this.chapter.stop; }

  /** Where the visitor left the camera, if they took it. */
  private left(): Shot | undefined {
    if (this.director.state.phase !== 'free') return undefined;
    const { cam, zoom } = this.stage;
    return { centre: this.chapter.shot.centre, extent: this.chapter.shot.extent * zoom, yaw: cam.yaw, pitch: cam.pitch };
  }

  /** The tissue as the chapter on screen has it: with the microglia the sliders ask for, or none. */
  private place(): void {
    const count = Number($<HTMLInputElement>('j-count').value), pull = Number($<HTMLInputElement>('j-pull').value) / 100;
    if (this.chapter.show.microglia) this.view.set(count, pull); else this.view.set(0, 0);
    $('j-count-out').textContent = String(count);
    $('j-pull-out').textContent = `${Math.round(100 * pull)}%`;
  }

  /** Puts the chapter and the line the director is on into the page. */
  private tell(): void {
    const { index, line } = this.director.state, c = this.chapter;
    if (c !== this.on) {
      this.on = c;
      this.line = -1;
      this.hotspots.set(c.hotspots);
      this.place();
      $('j-where').textContent = `${index + 1} / ${CHAPTERS.length} · ${c.title}`;
      $('j-experiment').hidden = c.stop !== 'experiment';
      $('scale-label').textContent = c.scale.label;
      $('scale-note').textContent = c.scale.note;
      this.dots.forEach((b, i) => { if (i === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    }
    if (line !== this.line) $('j-caption').textContent = this.director.caption();
    this.line = line;
    $<HTMLButtonElement>('j-back').disabled = index === 0 && line === 0;
    $<HTMLButtonElement>('j-next').disabled = index === CHAPTERS.length - 1 && line === c.captions.length - 1 && this.director.state.phase !== 'flying';
  }

  game(): Game | null { return null; }
  enter(): void {
    darkField(true);
    document.body.classList.add('journey');
    this.on = null; this.line = -1;
    this.tell();
  }
  leave(): void {
    darkField(false);
    document.body.classList.remove('journey');
    this.hotspots.set([]);
  }
  point(): void { /* dragging turns the tissue at a stop */ }
  grab(): void { this.director.release(); }

  key(e: KeyboardEvent): void {
    // The arrows belong to a slider while it has the focus.
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); this.director.next(this.left()); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.director.back(this.left()); }
    else if (/^[1-9]$/.test(e.key)) this.director.goto(Number(e.key) - 1, this.left());
  }

  /** On a wide window the story is a column on the left; on a narrow one a sheet at the bottom, under the title and the strip of figures. */
  margins(width: number, height: number): Omit<Viewport, 'width' | 'height'> {
    if (width > 900) return { left: Math.min(470, 0.33 * width), right: 0, top: 0, bottom: 0 };
    return { left: 0, right: 0, top: $('stations').getBoundingClientRect().bottom, bottom: Math.max(0, height - $('readout').getBoundingClientRect().top) };
  }

  frame(dt: number): void {
    const { stage, director } = this;
    if (!stage.held()) { director.tick(dt); this.view.step(); }
    this.tell();
    // Until the visitor takes it, the camera is the director's, whatever the wheel has asked for.
    if (director.state.phase !== 'free') {
      stage.zoom = 1;
      Object.assign(stage.cam, frameShot(director.pose(), stage.viewport()));
    }
    const picture = this.chapter.show.micrograph;
    this.view.draw(stage, { pictures: picture ? [picture] : [], effects: this.effects });

    const canvas = stage.scene.canvas, vp = stage.scene.viewProj(stage.cam), anchors = { microglia: this.view.tissue.microglia };
    // Hotspots wait for the camera to arrive: a label that flies past cannot be read or pressed.
    const arrived = director.state.phase !== 'flying';
    this.hotspots.update((h) => {
      const p = arrived ? where(h, anchors) : null;
      return p ? project(vp, p, canvas.clientWidth, canvas.clientHeight) : null;
    });
    if (this.frames++ % 20 === 0) $('j-closed').textContent = String(Math.round(100 * this.view.closed()));
  }
}
