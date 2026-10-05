import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { Kind, type Region, type Seed, type Tissue } from '../src/contracts';
import { openArea, repairIndex } from '../src/model/measure';
import { MODEL } from '../src/model/params';
import { rng } from '../src/model/random';
import { step } from '../src/model/step';
import { HEX_SPACING, createTissue, hexPack } from '../src/model/tissue';

const feature = await loadFeature('features/tissue.feature');
const square: Region = { x0: -100, y0: -100, x1: 100, y1: 100 };
const p = MODEL;

/**
 * A synthetic tissue, not the tectum: a band of neurons with a wound through it and held ends,
 * a layer of skin above, and microglia in between. The repair index is measured in the wound,
 * in a region that follows the band.
 */
function band(microgliaCount: number): number {
  const seeds: Seed[] = [];
  for (const c of hexPack((x) => Math.abs(x) > 30, { x0: -200, y0: -60, x1: 200, y1: 60 })) {
    seeds.push({ ...c, kind: Kind.Neuron, movable: Math.abs(c.x) < 180 });
  }
  for (const c of hexPack(() => true, { x0: -200, y0: 300, x1: 200, y1: 420 })) seeds.push({ ...c, kind: Kind.Skin });
  const place = rng(11);
  for (let i = 0; i < microgliaCount; i++) seeds.push({ x: -150 + 300 * place(), y: 150 + 60 * place(), kind: Kind.Microglia });
  const t = createTissue(seeds);
  const wound = (): number => {
    let y = 0, n = 0;
    for (let i = 0; i < t.n; i++) if (t.kind[i] === Kind.Neuron && t.movable[i]) { y += t.pos[3 * i + 1]; n++; }
    y /= n;
    return openArea(t, { x0: -30, y0: y - 50, x1: 30, y1: y + 50 }, p.radius);
  };
  const before = wound();
  const rand = rng(5);
  for (let i = 0; i < 20 * 60 / p.dt; i++) step(t, p, rand);
  return repairIndex(before, wound());
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('Cells are hexagonally packed at the script\'s spacing', ({ Given, When, Then, And }) => {
    let cells: { x: number; y: number }[] = [];
    Given('a square outline 200 micrometres wide', () => undefined);
    When('it is packed with cells', () => { cells = hexPack(() => true, square); });
    Then('nearest neighbours are 19.2 micrometres apart', () => {
      expect(HEX_SPACING).toBeCloseTo(19.2, 12);
      for (const a of cells) {
        const nearest = Math.min(...cells.filter((b) => b !== a).map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
        expect(nearest).toBeCloseTo(19.2, 9);
      }
    });
    And('every cell lies inside the outline', () => {
      expect(cells.length).toBeGreaterThan(100);
      for (const c of cells) expect(Math.max(Math.abs(c.x), Math.abs(c.y))).toBeLessThanOrEqual(100);
    });
  });

  Scenario('The wound is a gap in the packing', ({ Given, When, Then }) => {
    let cells: { x: number; y: number }[] = [];
    Given('a square outline 200 micrometres wide with a wound 60 micrometres wide through its middle', () => undefined);
    When('it is packed with neurons', () => { cells = hexPack((x) => Math.abs(x) > 30, square); });
    Then('no neuron lies in the wound', () => {
      expect(cells.length).toBeGreaterThan(50);
      for (const c of cells) expect(Math.abs(c.x)).toBeGreaterThan(30);
    });
  });

  Scenario('An empty region is all wound and a covered one has none', ({ Given, Then, And }) => {
    const region: Region = { x0: 0, y0: 0, x1: 40, y1: 40 };
    Given('a region 40 micrometres square', () => undefined);
    Then('with no neuron its open area is 1600 square micrometres', () => {
      expect(openArea(createTissue([]), region, p.radius)).toBe(1600);
    });
    And('with a neuron on every lattice point 8 micrometres apart its open area is zero', () => {
      const seeds: Seed[] = [];
      for (let x = 0; x <= 40; x += 8) for (let y = 0; y <= 40; y += 8) seeds.push({ x, y, kind: Kind.Neuron });
      const t: Tissue = createTissue(seeds);
      expect(openArea(t, region, p.radius)).toBe(0);
    });
  });

  Scenario('The repair index is the fraction of the wound that has closed', ({ Given, Then, And }) => {
    Given('wound volumes of 1000 at 4 hours and 250 at 24 hours', () => undefined);
    Then('the repair index is 0.75', () => { expect(repairIndex(1000, 250)).toBeCloseTo(0.75, 12); });
    And('a wound that does not change has a repair index of 0', () => { expect(repairIndex(1000, 1000)).toBe(0); });
    And('a wound that grows has a negative repair index', () => { expect(repairIndex(1000, 1200)).toBeLessThan(0); });
  });

  Scenario('Without microglia the wound stays open and with more of them it closes further', ({ Given, When, Then, And }) => {
    let ri: number[] = [];
    Given('a synthetic wounded band of neurons with held edges', () => undefined);
    When('it runs for 20 hours with 0, 20 and 60 microglia', () => { ri = [0, 20, 60].map(band); });
    Then('with none the repair index is below 0.05', () => { expect(Math.abs(ri[0])).toBeLessThan(0.05); });
    And('the repair index rises with the number of microglia', () => {
      console.log('repair index for 0, 20, 60 microglia (synthetic band):', ri.map((x) => x.toFixed(3)).join(', '));
      expect(ri[1]).toBeGreaterThan(ri[0] + 0.05);
      expect(ri[2]).toBeGreaterThan(ri[1] + 0.05);
    });
  });
});
