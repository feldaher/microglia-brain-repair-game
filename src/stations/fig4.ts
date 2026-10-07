// Fig 4: no microglia, no closure. The visitor is a microglia in one of three fish.

import { Game, SPEED_UP } from '../app/game';
import type { Vec3 } from '../contracts';
import type { Point } from '../app/record';
import { View } from '../app/view';
import { PAPER } from '../teach/cards';
import { FISH, type Fish } from '../teach/stations';
import { $, type Stage, type Station } from './stage';

export class Fig4 implements Station {
  fig = 4;
  extent = 1150;
  centre: Vec3 = [-40, 0, 20];
  scale = { length: 100, label: '100 µm in the model', note: '≈ 25 µm in the fish' };
  tagline = ['A needle went through a young brain.', 'You are one of its immune cells.', 'Pull.'];
  help = 'Click the tissue and your yellow cell crawls there. Press Space to pull, and C to call another microglia.';
  fine = `The tissue moves by the computer model of El-Daher et al. 2024, with its published settings and the cell layout of its Fig. 4A. Each pulling microglia is tied to every other cell, however far, as if through the mesh of astrocyte fibres that fills the tissue. The skin does not give; being tied to it keeps the microglia out in the open space, over the wound. The model is a flat slice, drawn about four times larger than the real tissue. Time runs ${Math.round(SPEED_UP)} times faster than life. “Wound closed” is the share of the boxed region that neurons have covered; in the paper the wound was outlined by hand, so these numbers are not the paper's.`;

  private fish: Fish = FISH[0];
  private run: Game;
  private view: View;
  private paused = false;
  private shown = false;
  private frames = 0;
  private result = $<HTMLDialogElement>('result');
  private fishButtons: HTMLButtonElement[];

  constructor(private stage: Stage) {
    this.run = new Game(Date.now() & 0xffff, this.fish.microglia);
    this.view = new View(this.run);
    this.fishButtons = FISH.map((f) => {
      const b = document.createElement('button');
      b.className = 'tool';
      b.setAttribute('role', 'radio');
      b.textContent = f.name;
      b.addEventListener('click', () => { this.choose(f); this.restart(); });
      $('fish').append(b);
      return b;
    });
    this.choose(this.fish);
    $('pull').addEventListener('click', () => this.pull(!this.run.pulling));
    $('call').addEventListener('click', () => this.run.call());
    $('restart').addEventListener('click', () => this.restart());
    $('pause').addEventListener('click', () => this.pause());
    $('result-again').addEventListener('click', () => { this.result.close(); this.restart(); });
    $('speed').textContent = `${Math.round(SPEED_UP)}× life`;
  }

  game(): Game { return this.run; }
  enter(): void { /* the run carries on where it was */ }
  leave(): void { if (this.result.open) this.result.close(); }

  private choose(f: Fish): void {
    this.fish = f;
    this.fishButtons.forEach((b, i) => { b.classList.toggle('active', FISH[i] === f); b.setAttribute('aria-checked', String(FISH[i] === f)); });
    $('fish-blurb').textContent = f.blurb;
    $('s-of').textContent = `of ${f.microglia} microglia`;
    $('pull').toggleAttribute('disabled', f.microglia === 0);
  }

  private pull(on: boolean): void {
    this.run.pulling = on;
    $('pull').classList.toggle('on', this.run.pulling);
    $('pull').setAttribute('aria-pressed', String(this.run.pulling));
  }

  private restart(): void {
    this.run = new Game(Date.now() & 0xffff, this.fish.microglia);
    this.view = new View(this.run);
    this.shown = false;
    this.paused = false;
    this.pull(false);
    $('pause').textContent = 'Pause';
  }

  private pause(): void {
    this.paused = !this.paused;
    $('pause').textContent = this.paused ? 'Resume' : 'Pause';
  }

  point(p: Point): void { this.run.target = p; }

  key(e: KeyboardEvent): void {
    if (this.result.open) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.pull(!this.run.pulling); }
    else if (e.key === 'c' || e.key === 'C') this.run.call();
    else if (e.key === 'r' || e.key === 'R') this.restart();
    else if (e.key === 'p' || e.key === 'P') this.pause();
  }

  frame(dt: number, now: number): void {
    const g = this.run;
    if (!this.paused && !this.stage.held() && !this.result.open) g.advance(dt);
    this.view.update(g, now);
    this.stage.scene.render(this.stage.cam, this.view.spheres, this.view.sphereCount, this.view.lines, this.view.lineVerts, this.stage.ground);
    if (this.frames++ % 6 === 0) this.readouts();
    if (g.done && !this.shown) this.finish();
  }

  private readouts(): void {
    const g = this.run, hpi = g.hpi(), n = g.pullingCount(), total = g.microglia().length;
    $('clock').textContent = `${hpi.toFixed(1)} h`;
    $('s-hpi').textContent = hpi.toFixed(1);
    $('clock-bar').style.width = `${(100 * (hpi - 4)) / 20}%`;
    $('s-ri').textContent = String(Math.round(100 * g.repairIndex()));
    $('s-pull').textContent = String(n);
    const idle = Math.max(0, total - n - (g.pulling ? 0 : 1));
    $<HTMLButtonElement>('call').disabled = idle === 0;
    $('crew').textContent = total === 0 ? 'This fish has no microglia. Nothing pulls.'
      : n === 0 ? `Nobody is pulling. ${idle} microglia are idle.`
      : n === 1 && g.pulling ? `You are pulling alone. ${idle} microglia are idle.`
      : `${n} microglia are pulling${g.pulling ? ', you among them' : ', but not you'}.`;
  }

  private finish(): void {
    this.shown = true;
    const ri = this.run.repairIndex(), n = this.run.pullingCount(), fish = this.fish;
    $('result-title').textContent = ri > 0.5 ? 'Closed.' : ri > 0.2 ? 'Half shut.' : 'Still open.';
    const share = Math.round(100 * ri) <= 0 ? 'None of the wound has closed' : `${Math.round(100 * ri)}% of the wound has closed`;
    $('result-lead').textContent = fish.microglia === 0 ? `${share}, in a fish with no microglia.`
      : `${share}, with ${n === 0 ? 'no microglia' : n === 1 ? 'one microglia' : `${n} microglia`} pulling at the end.`;
    $('result-note').textContent = fish.id === 'irf8'
      ? `With no microglia nothing in the model pulls, and the wound is as it was. In real irf8 mutants the wound closed in ${PAPER.closedWithoutMicroglia[0]} of ${PAPER.closedWithoutMicroglia[1]} fish, against ${PAPER.closedWildType[0]} of ${PAPER.closedWildType[1]} normal fish, and in 10 of the 17 it grew. The model cannot make a wound grow.`
      : fish.id === 'ki20227'
      ? 'In the model, a third of the microglia close about a third as much of the wound. In real fish treated with KI20227 the wound also closed less than in untreated ones.'
      : ri > 0.5
      ? 'This is what the paper found in living fish: microglia gather at the wound within six hours and it is shut within a day. Fish without microglia, or with microglia that cannot grip, are left with an open wound.'
      : 'A wound closes only when enough microglia pull for long enough. Fish that lack microglia are left with an open wound, and in most of them it grows. Start again, and call the others early.';
    this.result.showModal();
  }
}
