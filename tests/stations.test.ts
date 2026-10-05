import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { Game, RUN_SECONDS } from '../src/app/game';
import { FISH, MODEL_KIND, STATIONS } from '../src/teach/stations';

const feature = await loadFeature('features/stations.feature');
const files = Object.keys(import.meta.glob('../public/figures/*')).map((p) => p.replace('../public/', ''));
const fish = (id: string) => FISH.find((f) => f.id === id)!;
const play = (g: Game) => { for (let f = 0; f < (RUN_SECONDS + 1) * 60; f++) g.advance(1 / 60); };

describeFeature(feature, ({ Scenario }) => {
  Scenario('There are seven stations, in the order of the paper', ({ Given, Then, And }) => {
    Given('the stations', () => undefined);
    Then('they are Fig 1 to Fig 7', () => { expect(STATIONS.map((s) => s.fig)).toEqual([1, 2, 3, 4, 5, 6, 7]); });
    And('each has a title, a finding of at most 60 words and a panel that is a file of the site', () => {
      for (const s of STATIONS) {
        expect(s.title.length, `Fig ${s.fig}`).toBeGreaterThan(0);
        expect(s.finding.split(/\s+/).length, `Fig ${s.fig}`).toBeLessThanOrEqual(60);
        expect(files, `Fig ${s.fig}`).toContain(s.figure.src);
        expect(s.figure.panel, `Fig ${s.fig}`).toMatch(new RegExp(`^Fig ${s.fig}`));
      }
    });
    And('each says what kind of model stands behind it: the paper\'s, fitted to the paper\'s data, or illustrative', () => {
      for (const s of STATIONS) expect(MODEL_KIND[s.model], `Fig ${s.fig}`).toBeTruthy();
      // Figs 5 and 6 have no model in the paper.
      expect(STATIONS[4].model).toBe('illustrative');
      expect(STATIONS[5].model).toBe('fitted');
    });
  });

  Scenario('The Fig 4 station can be played', ({ Given, Then, And }) => {
    Given('the stations', () => undefined);
    Then('Fig 4 is built', () => { expect(STATIONS[3].built).toBe(true); });
    And('it offers three fish: wild type, treated with KI20227, and the irf8 mutant', () => {
      expect(FISH.map((f) => f.id)).toEqual(['wild-type', 'ki20227', 'irf8']);
    });
  });

  Scenario('Each fish has the microglia the paper found in it', ({ Given, Then, And }) => {
    Given('the three fish', () => undefined);
    Then('the wild type has the 19 microglia of Fig 4A', () => {
      expect(fish('wild-type').microglia).toBe(19);
      expect(new Game(0, fish('wild-type').microglia).microglia().length).toBe(19);
    });
    And('the KI20227 fish has about a third as many, 6', () => {
      expect(fish('ki20227').microglia).toBe(6);
      expect(new Game(0, 6).microglia().length).toBe(6);
    });
    And('the irf8 mutant has none', () => {
      expect(fish('irf8').microglia).toBe(0);
      expect(new Game(0, 0).microglia().length).toBe(0);
    });
  });

  let none = 0;
  Scenario('A fish without microglia cannot close its wound, and has no cell to steer', ({ Given, When, Then, And }) => {
    let g: Game, called = true;
    Given('a run in the irf8 mutant', () => { g = new Game(0, 0); });
    When('it is played to the end with the visitor trying to pull and to call', () => {
      expect(g.player).toBe(-1);
      g.pulling = true;
      g.target = { x: 0, y: 0 };
      called = g.call();
      play(g);
    });
    Then('nothing was pulling and nobody could be called', () => {
      expect(g.pulling).toBe(false);
      expect(g.pullingCount()).toBe(0);
      expect(called).toBe(false);
      expect(g.done).toBe(true);
    });
    And('the repair index is below 0.05', () => { none = g.repairIndex(); expect(Math.abs(none)).toBeLessThan(0.05); });
  });

  Scenario('Fewer microglia close less', ({ Given, When, Then }) => {
    let g: Game;
    Given('a run in the KI20227 fish with every microglia pulling from the start', () => { g = new Game(0, 6); g.callAll(); });
    When('it is played to the end', () => play(g));
    Then('its repair index is above that of the irf8 mutant and below 0.6', () => {
      console.log('repair index at 24 hpi: irf8', none.toFixed(3), '· KI20227 (6 microglia)', g.repairIndex().toFixed(3));
      expect(g.repairIndex()).toBeGreaterThan(none + 0.05);
      expect(g.repairIndex()).toBeLessThan(0.6);
    });
  });
});
