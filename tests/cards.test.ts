import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { Game } from '../src/app/game';
import { WOUND } from '../src/model/fig4a';
import { CARDS, CREDIT, PAPER } from '../src/teach/cards';

const feature = await loadFeature('features/cards.feature');
const files = Object.keys(import.meta.glob('../public/figures/*')).map((p) => p.replace('../public/', ''));
const card = (id: string) => CARDS.find((c) => c.id === id)!;

describeFeature(feature, ({ Scenario }) => {
  Scenario('Every part of the scene has a card', ({ Given, Then, And }) => {
    Given('the cards', () => undefined);
    Then('there is one for the visitor\'s cell, the neurons, the wound, the neuropil, the pull and the skin', () => {
      expect(CARDS.map((c) => c.id)).toEqual(['you', 'neurons', 'wound', 'neuropil', 'pull', 'skin']);
    });
    And('each has a name and a text of at most 75 words', () => {
      for (const c of CARDS) {
        expect(c.name.length, c.id).toBeGreaterThan(0);
        expect(c.label.length, c.id).toBeGreaterThan(0);
        const words = c.blurb.split(/\s+/).length;
        expect(words, c.id).toBeGreaterThan(15);
        expect(words, c.id).toBeLessThanOrEqual(75);
      }
    });
  });

  Scenario('Every image is the paper\'s and says so', ({ Given, Then, And }) => {
    Given('the cards', () => undefined);
    Then('each card\'s image is a file of the site', () => {
      for (const c of CARDS) expect(files, c.id).toContain(c.figure.src);
    });
    And('each is credited to a numbered figure of El-Daher et al. 2024 under CC BY 4.0', () => {
      for (const c of CARDS) expect(c.figure.panel, c.id).toMatch(/^Fig S?\d[A-Z]?$/);
      expect(CREDIT).toMatch(/El-Daher et al\. 2024/);
      expect(CREDIT).toMatch(/CC BY 4\.0/);
    });
    And('each has a caption', () => {
      for (const c of CARDS) expect(c.figure.caption.length, c.id).toBeGreaterThan(30);
    });
  });

  Scenario('The numbers on the cards are the paper\'s', ({ Given, Then, And }) => {
    Given('the facts the cards quote', () => undefined);
    Then('the wound closes between 18 and 22 hours after injury', () => {
      expect(PAPER.closedBetweenHpi).toEqual([18, 22]);
      expect(card('wound').size).toContain('18 and 22 h');
    });
    And('microglia arrive from 2 hours and are gathered by 6', () => {
      expect([PAPER.arriveHpi, PAPER.gatheredHpi]).toEqual([2, 6]);
      expect(card('you').size).toMatch(/from 2 h.*by 6 h/);
    });
    And('about 20 pulls happen per hour in each half of the tectum', () => {
      expect(PAPER.pullsPerHour).toBe(20);
      expect(card('pull').size).toContain('20 pulls per hour');
    });
    And('a cut microglial process snaps back at 0.89 micrometres per second', () => {
      expect(PAPER.recoilUmPerS).toBe(0.89);
      expect(card('pull').size).toContain('0.89 µm/s');
      // "five times faster than it crawls"
      expect(PAPER.recoilUmPerS / PAPER.migrationUmPerS).toBeCloseTo(5, 0);
    });
    And('the wound closed in 16 of 21 normal fish and 2 of 17 without microglia', () => {
      expect(PAPER.closedWildType).toEqual([16, 21]);
      expect(PAPER.closedWithoutMicroglia).toEqual([2, 17]);
    });
  });

  Scenario('Labels ride with what they name', ({ Given, Then, And }) => {
    let g: Game, before: { x: number; y: number };
    Given('a run in which every microglia has pulled for 10 seconds', () => {
      g = new Game();
      before = card('neurons').anchor(g);
      g.callAll();
      for (let f = 0; f < 600; f++) g.advance(1 / 60);
    });
    Then('the visitor\'s label is on the visitor\'s cell', () => {
      expect(card('you').anchor(g)).toEqual({ x: g.tissue.pos[3 * g.player], y: g.tissue.pos[3 * g.player + 1] });
    });
    And('the neurons\' label has moved with its neuron', () => {
      const now = card('neurons').anchor(g);
      expect(Math.hypot(now.x - before.x, now.y - before.y)).toBeGreaterThan(5);
    });
    And('the wound\'s label is at the centre of the box', () => {
      expect(card('wound').anchor(g)).toEqual({ x: (WOUND.x0 + WOUND.x1) / 2, y: (WOUND.y0 + WOUND.y1) / 2 });
    });
  });
});
