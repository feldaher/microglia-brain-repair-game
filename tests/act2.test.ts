import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { Kind } from '../src/contracts';
import { Game, MINUTES_PER_SECOND, RUN_SECONDS, SPEED_UP } from '../src/app/game';
import { FIG4A, WOUND } from '../src/model/fig4a';

const feature = await loadFeature('features/act2.feature');
/** Plays `seconds` at 60 frames a second. */
const play = (g: Game, seconds: number) => { for (let f = 0; f < Math.round(seconds * 60); f++) g.advance(1 / 60); };

describeFeature(feature, ({ Scenario }) => {
  Scenario('The run starts as the paper\'s simulation does, with nobody pulling yet', ({ Given, Then, And }) => {
    let g: Game;
    Given('a new run', () => { g = new Game(); });
    Then('the clock reads 4 hours after injury', () => { expect(g.hpi()).toBe(4); });
    And('the tissue is the layout of Fig 4A', () => {
      expect(g.tissue.n).toBe(FIG4A.neurons.length + FIG4A.skin.length + FIG4A.microglia.length);
    });
    And('no microglia is pulling', () => { expect(g.pullingCount()).toBe(0); });
    And('the visitor\'s cell is the microglia nearest the wound', () => {
      expect(g.tissue.kind[g.player]).toBe(Kind.Microglia);
      const cx = (WOUND.x0 + WOUND.x1) / 2, cy = (WOUND.y0 + WOUND.y1) / 2;
      const d = (i: number) => Math.hypot(g.tissue.pos[3 * i] - cx, g.tissue.pos[3 * i + 1] - cy);
      for (const i of g.microglia()) expect(d(g.player)).toBeLessThanOrEqual(d(i));
    });
    And('the repair index is 0', () => { expect(g.repairIndex()).toBe(0); });
  });

  Scenario('Twenty hours pass in one minute', ({ Given, When, Then, And }) => {
    let g: Game;
    Given('a new run', () => { g = new Game(); });
    When('60 seconds of play go by', () => { expect(RUN_SECONDS).toBe(60); play(g, 60.5); });
    Then('the clock reads 24 hours after injury', () => { expect(g.hpi()).toBeCloseTo(24, 6); });
    And('the run is over', () => {
      expect(g.done).toBe(true);
      expect(g.advance(1)).toBe(0);
    });
    And('time ran 1200 times faster than life', () => { expect(SPEED_UP).toBeCloseTo(1200, 6); });
  });

  Scenario('The visitor\'s cell crawls toward where they point, at a microglia\'s speed', ({ Given, When, Then }) => {
    let g: Game, x0 = 0;
    Given('a new run', () => { g = new Game(); });
    When('the visitor points 200 micrometres to the right of their cell for 2 seconds', () => {
      x0 = g.tissue.pos[3 * g.player];
      g.target = { x: x0 + 200, y: g.tissue.pos[3 * g.player + 1] };
      play(g, 2);
    });
    Then('their cell has moved right by about 3 micrometres per minute of tissue time', () => {
      const minutes = g.tissue.time;
      expect(minutes).toBeCloseTo(2 * MINUTES_PER_SECOND, 0);
      expect((g.tissue.pos[3 * g.player] - x0) / minutes).toBeCloseTo(3, 1);
    });
  });

  Scenario('Calling microglia adds them one at a time', ({ Given, When, Then, And }) => {
    let g: Game;
    Given('a new run', () => { g = new Game(); });
    When('the visitor pulls and calls 5 microglia', () => {
      g.pulling = true;
      g.advance(1 / 60);
      for (let i = 0; i < 5; i++) expect(g.call()).toBe(true);
    });
    Then('6 microglia are pulling', () => { expect(g.pullingCount()).toBe(6); });
    And('calling 20 more leaves all 19 pulling and no one left to call', () => {
      for (let i = 0; i < 20; i++) g.call();
      expect(g.pullingCount()).toBe(19);
      expect(g.call()).toBe(false);
    });
  });

  Scenario('One cell is not enough, many are', ({ Given, Then, And }) => {
    let alone = 0, together = 0;
    Given('a run in which the visitor pulls alone to the end', () => {
      const g = new Game();
      g.pulling = true;
      play(g, RUN_SECONDS + 1);
      alone = g.repairIndex();
    });
    And('a run in which every microglia pulls from the start', () => {
      const g = new Game();
      g.callAll();
      play(g, RUN_SECONDS + 1);
      together = g.repairIndex();
    });
    Then('alone the repair index stays below 0.2', () => {
      console.log('repair index at 24 hpi: visitor alone', alone.toFixed(3), '· all 19 microglia', together.toFixed(3));
      expect(alone).toBeLessThan(0.2);
    });
    And('together it is above 0.6', () => { expect(together).toBeGreaterThan(0.6); });
  });
});
