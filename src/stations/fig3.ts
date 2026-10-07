// Fig 3: the neurons all head for one spot, and the microglia are already there.
// The microglia are hidden until the visitor has said where the tracks point.

import type { Vec3 } from '../contracts';
import { SPEED_UP } from '../app/game';
import type { Point } from '../app/record';
import { COLOURS } from '../app/view';
import { PAPER } from '../teach/cards';
import { FIG3I_CLOSURE, FIG3I_MICROGLIA } from '../teach/fig3i';
import { LinePlot } from '../ui/plot';
import { $, type Stage, type Station } from './stage';
import { Watch } from './watch';

export class Fig3 extends Watch implements Station {
  fig = 3;
  extent = 1150;
  centre: Vec3 = [-40, 0, 20];
  scale = { length: 100, label: '100 µm in the model', note: '≈ 25 µm in the fish' };
  tagline = ['Every neuron is heading somewhere.', 'Find the spot.', 'Then see who is there.'];
  help = 'Watch the lines the neurons leave. Click where you think they are all heading, then press Reveal.';
  fine = `The paper's computer model, with its microglia hidden until you reveal them. Time runs ${Math.round(SPEED_UP)} times faster than life and lengths are the model's, about four times the real ones. In the model each neuron is drawn straight toward the middle of the microglia, so the two spots coincide by construction; in fish they were found near each other, which is the evidence. “Gathered” is how far the microglia's scatter has fallen, our measure; the paper counted microglia at the wound.`;

  private guess: Point | null = null;
  private revealed = false;
  private plot = new LinePlot($('plot3'));

  constructor(stage: Stage) {
    super(stage);
    $('reveal').addEventListener('click', () => { if (this.replay.record.convergence()) { this.revealed = true; this.readouts(); } });
  }

  protected reset(): void { this.guess = null; this.revealed = false; }

  point(p: Point): void { if (!this.revealed) { this.guess = p; this.readouts(); } }

  frame(dt: number, now: number): void {
    this.tick(dt);
    const r = this.replay, c = this.revealed ? r.record.convergence() : null;
    const rings = [];
    if (this.guess) rings.push({ at: this.guess, radius: 22, colour: 'model' as const });
    if (c) rings.push({ at: c, radius: 34, colour: 'ink' as const });
    this.view.update(r.game, now, { positions: r.positions(), hideMicroglia: !this.revealed, web: this.revealed, rings });
    this.stage.scene.render(this.stage.cam, this.view.spheres, this.view.sphereCount, this.view.lines, this.view.lineVerts, this.stage.ground);
  }

  protected readouts(): void {
    const r = this.replay, rec = r.record, c = rec.convergence(), m = rec.microgliaCentroid();
    const reveal = $<HTMLButtonElement>('reveal');
    reveal.disabled = !c || !this.guess || this.revealed;
    const d = (a: Point, b: Point) => Math.round(Math.hypot(a.x - b.x, a.y - b.y));
    $('f3-note').textContent = this.revealed && c && m && this.guess
      ? `The tracks meet at the black ring, ${d(this.guess, c)} µm of the model from your guess. The microglia sit ${d(c, m)} µm from it: on a tissue 950 µm across, the same spot. In fish, microglia were there from ${PAPER.arriveHpi} hours after the injury.`
      : !this.guess ? 'Click the spot the neurons seem to be heading for.'
      : !c ? 'Marked. Let the neurons move a little further before you reveal.'
      : 'Marked. Move it if you like, then reveal.';
    const gathered = rec.gathered();
    this.plot.draw({
      title: 'Microglia gathered (dashed), wound closed (solid)', x: [2, 24], y: [0, 1], xTicks: [2, 6, 12, 18, 24], yTicks: [0, 0.5, 1], xUnit: 'h',
      format: (v) => `${Math.round(100 * v)}%`, cursor: r.playhead,
      series: [
        { name: 'gathered, fish', colour: COLOURS.fish, dashed: true, points: FIG3I_MICROGLIA },
        { name: 'closed, fish', colour: COLOURS.fish, points: FIG3I_CLOSURE },
        // The model's microglia stay out of the plot until they are revealed in the tissue.
        { name: 'gathered, model', colour: COLOURS.model, dashed: true, points: this.revealed ? gathered.map((v, f) => [rec.hpi(f), v] as [number, number]) : [] },
        { name: 'closed, model', colour: COLOURS.model, points: rec.closure.map((v, f) => [rec.hpi(f), v] as [number, number]) },
      ],
    });
  }
}
