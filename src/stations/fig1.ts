// Fig 1: the wound closes in a day, and the neurons are carried there in straight lines.
// The visitor watches the paper's simulation beside the real time-lapse and follows neurons.

import { Kind } from '../contracts';
import { SPEED_UP } from '../app/game';
import type { Point } from '../app/record';
import { COLOURS } from '../app/view';
import { PAPER } from '../teach/cards';
import { FIG3I_CLOSURE } from '../teach/fig3i';
import { LinePlot } from '../ui/plot';
import { $, type Stage, type Station } from './stage';
import { Watch } from './watch';

const MOST = 8;

export class Fig1 extends Watch implements Station {
  fig = 1;
  tagline = ['A wound in the brain,', 'shut within a day.', 'Follow a neuron and see how.'];
  help = 'Click a neuron to follow it. Drag the clock back and forth.';
  fine = `The tissue is the paper's computer model, started from the cell layout of its Fig. 4A with all its microglia pulling. The film is a real larva. The model is about four times larger than the real tissue and time runs ${Math.round(SPEED_UP)} times faster than life. The exponent says how distance grows with time: 1 for a cell wandering at random, 2 for one carried in a straight line at steady speed. The model's wound closes steadily; the real one waits, then closes, then stops. The model does not capture that.`;

  private followed: number[] = [];
  private plot = new LinePlot($('plot1'));
  private movie = $<HTMLVideoElement>('movie-video');

  constructor(stage: Stage) {
    super(stage);
    $('unfollow').addEventListener('click', () => { this.followed = []; this.readouts(); });
  }

  enter(): void { super.enter(); $('movie').hidden = false; }
  leave(): void { super.leave(); $('movie').hidden = true; }
  protected reset(): void { this.followed = []; }

  /** The neuron under the pointer is followed, or let go if it already was. */
  point(p: Point): void {
    const t = this.replay.game.tissue, P = this.replay.positions();
    let best = -1, bestD = 2 * this.replay.game.params.radius;
    for (let i = 0; i < t.n; i++) {
      if (t.kind[i] !== Kind.Neuron) continue;
      const d = Math.hypot(P[2 * i] - p.x, P[2 * i + 1] - p.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return;
    const at = this.followed.indexOf(best);
    if (at >= 0) this.followed.splice(at, 1);
    else { this.followed.push(best); if (this.followed.length > MOST) this.followed.shift(); }
    this.readouts();
  }

  frame(dt: number, now: number): void {
    this.tick(dt);
    const r = this.replay, shown = r.framesShown();
    const P = r.positions();
    const paths = this.followed.map((i) => [...r.record.track(i).slice(0, shown), { x: P[2 * i], y: P[2 * i + 1] }]);
    this.view.update(r.game, now, { positions: P, web: false, tracks: false, paths, followed: this.followed });
    this.stage.scene.render(this.stage.cam, this.view.spheres, this.view.sphereCount, this.view.lines, this.view.lineVerts, this.stage.ground);
    // The film covers 4 to 22 hours after injury.
    if (this.movie.duration) {
      const want = Math.min(1, Math.max(0, (r.playhead - 4) / 18)) * (this.movie.duration - 0.05);
      if (Math.abs(this.movie.currentTime - want) > 0.08) this.movie.currentTime = want;
    }
  }

  protected readouts(): void {
    const r = this.replay, rec = r.record;
    const alpha = this.followed.length ? rec.msdExponent(this.followed) : null;
    $('f1-n').textContent = String(this.followed.length);
    $('f1-alpha').textContent = alpha === null ? '—' : alpha.toFixed(2);
    $('f1-fish').textContent = String(PAPER.msdExponent);
    $('f1-note').textContent = this.followed.length === 0 ? 'Click a neuron in the tissue to follow it.'
      : alpha === null ? 'Let it run for two hours of tissue time to measure how it moves.'
      : 'In four times the time, a wandering cell gets twice as far. These get nearly four times as far: they are carried.';
    this.plot.draw({
      title: 'Wound closed', x: [4, 24], y: [0, 1], xTicks: [4, 8, 12, 16, 20, 24], yTicks: [0, 0.5, 1], xUnit: 'h',
      format: (v) => `${Math.round(100 * v)}%`, cursor: r.playhead,
      series: [
        { name: 'model', colour: COLOURS.model, points: rec.closure.map((v, f) => [rec.hpi(f), v] as [number, number]) },
        { name: 'fish (Fig 3I)', colour: COLOURS.fish, points: FIG3I_CLOSURE },
      ],
    });
  }
}
