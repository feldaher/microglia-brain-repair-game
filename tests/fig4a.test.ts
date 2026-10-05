import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { Kind, type Tissue } from '../src/contracts';
import { FIG4A, fig4aSeeds } from '../src/model/fig4a';
import { MODEL } from '../src/model/params';
import { rng } from '../src/model/random';
import { step } from '../src/model/step';
import { HEX_SPACING, createTissue } from '../src/model/tissue';

const feature = await loadFeature('features/fig4a.feature');
const r = MODEL.radius;

/** Extent of the cell bodies of one kind along an axis, µm. */
function span(t: Tissue, kind: number, axis: 0 | 1, keep: (i: number) => boolean = () => true): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < t.n; i++) if (t.kind[i] === kind && keep(i)) {
    lo = Math.min(lo, t.pos[3 * i + axis] - r);
    hi = Math.max(hi, t.pos[3 * i + axis] + r);
  }
  return [lo, hi];
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The starting layout is the one in the figure', ({ Given, Then, And }) => {
    let t: Tissue;
    Given('the cells read from the 4 hours panel of Fig 4A', () => { t = createTissue(fig4aSeeds(r)); });
    Then('there are 950 neurons, 437 skin cells and 19 microglia', () => {
      expect([FIG4A.neurons.length, FIG4A.skin.length, FIG4A.microglia.length]).toEqual([950, 437, 19]);
      expect(t.n).toBe(1406);
    });
    And('they sit on the lattice of the paper\'s packing script, 19.2 micrometres apart', () => {
      const all = [...FIG4A.neurons, ...FIG4A.skin];
      for (const a of all.filter((_, i) => i % 25 === 0)) {
        const nearest = Math.min(...all.filter((b) => b !== a).map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
        expect(nearest).toBeCloseTo(HEX_SPACING, 6);
      }
    });
    And('three neurons, at the top edge of the domain, are held in place', () => {
      const held = [...t.movable].map((m, i) => (m ? -1 : i)).filter((i) => i >= 0);
      expect(held.length).toBe(3);
      for (const i of held) {
        expect(t.kind[i]).toBe(Kind.Neuron);
        expect(t.pos[3 * i + 1]).toBeGreaterThan(480);
      }
    });
  });

  Scenario('After 1200 minutes the tissue has the shape of the 24 hours panel', ({ Given, When, Then, And }) => {
    let t: Tissue, start: Float64Array;
    Given('the cells read from the 4 hours panel of Fig 4A', () => { t = createTissue(fig4aSeeds(r)); start = t.pos.slice(); });
    When('the model runs for 1200 minutes', () => {
      const rand = rng(0);
      for (let i = 0; i < MODEL.duration / MODEL.dt; i++) step(t, MODEL, rand);
    });
    Then('the neurons span -399 to 373 micrometres in x, as measured on the figure, within 5', () => {
      const [lo, hi] = span(t, Kind.Neuron, 0);
      expect(Math.abs(lo + 399)).toBeLessThan(5);
      expect(Math.abs(hi - 373)).toBeLessThan(5);
    });
    And('they span -375 to 414 micrometres in y, the held row apart, within 5', () => {
      const [lo, hi] = span(t, Kind.Neuron, 1, (i) => t.movable[i] === 1);
      expect(Math.abs(lo + 375)).toBeLessThan(5);
      expect(Math.abs(hi - 414)).toBeLessThan(5);
    });
    And('the microglia have gathered around -21, 39 micrometres, within 15', () => {
      let x = 0, y = 0, n = 0;
      for (let i = 0; i < t.n; i++) if (t.kind[i] === Kind.Microglia) { x += t.pos[3 * i]; y += t.pos[3 * i + 1]; n++; }
      expect(Math.hypot(x / n + 21, y / n - 39)).toBeLessThan(15);
    });
    And('the skin has not moved by more than 3 micrometres', () => {
      for (let i = 0; i < t.n; i++) if (t.kind[i] === Kind.Skin) {
        expect(Math.hypot(t.pos[3 * i] - start[3 * i], t.pos[3 * i + 1] - start[3 * i + 1])).toBeLessThan(3);
      }
    });
  });
});
