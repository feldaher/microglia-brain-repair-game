// What the Fig 1 and Fig 3 stations share: the paper's simulation played, paused and scrubbed.

import type { Game } from '../app/game';
import { Replay } from '../app/replay';
import { View } from '../app/view';
import { $, type Stage } from './stage';

export abstract class Watch {
  protected replay: Replay;
  protected view: View;
  private frames = 0;

  constructor(protected stage: Stage) {
    this.replay = new Replay(Date.now() & 0xffff);
    this.view = new View(this.replay.game);
  }

  game(): Game { return this.replay.game; }

  /** Wires the shared clock; called when the station is entered. */
  enter(): void {
    const scrub = $<HTMLInputElement>('scrub');
    scrub.oninput = () => { this.replay.playing = false; this.replay.seek(Number(scrub.value)); this.sync(); };
    $('play').onclick = () => this.toggle();
    $('again').onclick = () => this.restart();
    this.sync();
  }
  leave(): void { this.replay.playing = false; }

  protected toggle(): void {
    const r = this.replay;
    // At the end of a finished run, Play starts over from the first frame.
    if (!r.playing && r.game.done && r.playhead >= r.game.hpi()) r.seek(4);
    r.playing = !r.playing;
    this.sync();
  }

  protected restart(): void {
    this.replay = new Replay(Date.now() & 0xffff);
    this.view = new View(this.replay.game);
    this.reset();
    this.sync();
  }

  /** Clears what the visitor had measured on the previous run. */
  protected abstract reset(): void;
  /** Redraws the station's own numbers and plot. */
  protected abstract readouts(): void;

  private sync(): void {
    const r = this.replay, scrub = $<HTMLInputElement>('scrub');
    scrub.max = String(r.game.hpi());
    scrub.value = String(r.playhead);
    $('watch-clock').textContent = `${r.playhead.toFixed(1)} h`;
    $('play').textContent = r.playing ? 'Pause' : r.game.done && r.playhead >= r.game.hpi() ? 'Play again' : 'Play';
    this.readouts();
  }

  protected tick(dt: number): void {
    if (!this.stage.held()) this.replay.advance(dt);
    if (this.frames++ % 6 === 0) this.sync();
  }

  key(e: KeyboardEvent): void {
    if (e.code === 'Space' || e.key === 'p' || e.key === 'P') { e.preventDefault(); if (!e.repeat) this.toggle(); }
    else if (e.key === 'r' || e.key === 'R') this.restart();
  }
}
