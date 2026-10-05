import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { Game, RUN_SECONDS } from '../src/app/game';
import { Record } from '../src/app/record';
import { Replay } from '../src/app/replay';
import { PAPER } from '../src/teach/cards';
import { FIG3I_CLOSURE, FIG3I_MICROGLIA } from '../src/teach/fig3i';

const feature = await loadFeature('features/measure.feature');

function run(microglia: number): { game: Game; record: Record } {
  const game = new Game(0, microglia);
  game.callAll();
  const record = new Record(game);
  for (let f = 0; f < (RUN_SECONDS + 1) * 60; f++) { game.advance(1 / 60); record.capture(game); }
  return { game, record };
}
const full = run(19);
/** Value of a digitised curve at or just after `hpi`, as a share of its last value. */
const share = (curve: [number, number][], hpi: number) => curve.find(([t]) => t >= hpi)![1] / curve[curve.length - 1][1];

describeFeature(feature, ({ Background, Scenario }) => {
  const { game, record } = full;
  Background(({ Given }) => {
    Given('the paper\'s simulation, recorded from 4 to 24 hours after injury', () => { expect(game.done).toBe(true); });
  });

  Scenario('One frame every 15 minutes', ({ Then, And }) => {
    Then('the record has 81 frames', () => {
      expect(record.frames.length).toBe(81);
      expect(record.hpi(0)).toBe(4);
      expect(record.hpi(80)).toBe(24);
    });
    And('a neuron\'s track starts where the neuron started and ends where it is now', () => {
      const i = record.neurons()[200], track = record.track(i), start = new Game(0).tissue.pos;
      expect(track[0]).toEqual({ x: start[3 * i], y: start[3 * i + 1] });
      expect(track[80].x).toBeCloseTo(game.tissue.pos[3 * i], 6);
      expect(track[80].y).toBeCloseTo(game.tissue.pos[3 * i + 1], 6);
    });
  });

  Scenario('Neurons are carried, they do not wander (Fig 1K, L)', ({ Then, And }) => {
    const all = record.msdExponent(record.neurons())!;
    Then('the displacement exponent of the neurons is 2.0, within 0.05', () => { expect(Math.abs(all - 2)).toBeLessThan(0.05); });
    And('the paper measured 1.86 in fish, where a random walk gives 1', () => {
      expect(PAPER.msdExponent).toBe(1.86);
      expect(all).toBeGreaterThan(PAPER.msdExponent);
    });
    And('a single tracked neuron gives the same exponent as all of them, within 0.05', () => {
      for (const k of [10, 300, 700]) expect(Math.abs(record.msdExponent([record.neurons()[k]])! - all)).toBeLessThan(0.05);
    });
  });

  Scenario('The model closes steadily where the fish closes late and then stops (Fig 1D, 3I)', ({ Then, And }) => {
    Then('the measured closure of Fig 3I is still below a tenth at 7 hours and is nine tenths done by 16', () => {
      expect(share(FIG3I_CLOSURE, 7)).toBeLessThan(0.1);
      expect(share(FIG3I_CLOSURE, 16)).toBeGreaterThan(0.9);
    });
    And('the model\'s closure is already a tenth done at 7 hours and not nine tenths done until after 20', () => {
      const end = record.closure[80], at = (hpi: number) => record.closure[(hpi - 4) * 4] / end;
      expect(at(7)).toBeGreaterThan(0.1);
      expect(at(20)).toBeLessThan(0.9);
    });
  });

  Scenario('The tracks point at the microglia (Fig 3A, B, F)', ({ Then, And }) => {
    const c = record.convergence()!, m = record.microgliaCentroid()!;
    Then('the neurons\' tracks converge within 20 micrometres of where the microglia have gathered', () => {
      expect(Math.hypot(c.x - m.x, c.y - m.y)).toBeLessThan(20);
    });
    And('a visitor\'s guess is scored by its distance to that point', () => {
      const guess = { x: c.x + 30, y: c.y - 40 };
      expect(Math.hypot(guess.x - c.x, guess.y - c.y)).toBeCloseTo(50, 9);
    });
  });

  Scenario('The microglia gather first (Fig 3G, I)', ({ Then, And }) => {
    const gathered = record.gathered();
    Then('the microglia are nine tenths gathered by 8 hours after injury', () => { expect(gathered[16]).toBeGreaterThan(0.9); });
    And('in fish they reach nine tenths of their plateau by 6.5 hours', () => {
      const top = Math.max(...FIG3I_MICROGLIA.map(([, v]) => v));
      expect(FIG3I_MICROGLIA.find(([, v]) => v >= 0.9 * top)![0]).toBe(6.5);
    });
    And('at 8 hours the model\'s wound is less than a quarter closed', () => { expect(record.closure[16]).toBeLessThan(0.25); });
  });

  Scenario('Without microglia there is nothing to measure', ({ Given, Then, And }) => {
    let empty: Record;
    Given('the same tissue without microglia, recorded to the end', () => { empty = run(0).record; });
    Then('no neuron has moved more than 5 micrometres', () => {
      for (const { from, to } of empty.displacements()) expect(Math.hypot(to.x - from.x, to.y - from.y)).toBeLessThan(5);
    });
    And('there is no convergence point and no microglia to find', () => {
      expect(empty.convergence()).toBeNull();
      expect(empty.microgliaCentroid()).toBeNull();
    });
  });

  Scenario('The record can be scrubbed', ({ Given, Then, And }) => {
    let r: Replay;
    Given('a replay that has played for 10 seconds', () => {
      r = new Replay(0);
      for (let f = 0; f < 600; f++) r.advance(1 / 60);
    });
    Then('its playhead is where the tissue is, a little over 7 hours after injury', () => {
      // The tissue moves in whole steps of 0.1 min, so it may be up to one step ahead of the playhead.
      expect(r.game.hpi() - r.playhead).toBeGreaterThanOrEqual(0);
      expect(r.game.hpi() - r.playhead).toBeLessThan(0.1 / 60 + 1e-9);
      expect(r.playhead).toBeGreaterThan(7.2);
      expect(r.playhead).toBeLessThan(7.5);
    });
    And('scrubbed back to 4 hours it shows every cell where it started', () => {
      r.seek(4);
      expect(Array.from(r.positions())).toEqual(Array.from(r.record.frames[0]));
      expect(r.framesShown()).toBe(1);
    });
    And('it cannot be scrubbed past what has been simulated', () => {
      r.seek(20);
      expect(r.playhead).toBe(r.game.hpi());
    });
    And('nobody is steered in it and every microglia pulls', () => {
      expect(r.game.player).toBe(-1);
      expect(r.game.pullingCount()).toBe(19);
    });
  });
});
