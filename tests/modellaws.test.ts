import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { Kind, type Tissue } from '../src/contracts';
import { MODEL } from '../src/model/params';
import { rng } from '../src/model/random';
import { step } from '../src/model/step';
import { createTissue } from '../src/model/tissue';
import { QUIET, at, microglia, neuron, skin, vel } from './helpers';

const feature = await loadFeature('features/modellaws.feature');
const k = QUIET.elastic;
const R = 2 * QUIET.radius, S = QUIET.adhesionDistance * R;
const rand = rng(1);

describeFeature(feature, ({ Scenario }) => {
  Scenario('The parameters are those of the repository\'s settings file', ({ Given, Then, And }) => {
    Given('the model parameters', () => undefined);
    Then('microglia move at 3 micrometres per minute and the elastic coefficient is 9e-6 per minute', () => {
      expect(MODEL.kinds[Kind.Microglia].speed).toBe(3);
      expect(MODEL.elastic).toBe(9e-6);
    });
    And('neurons move at 0.01 micrometres per minute and both keep a direction for 10 minutes', () => {
      expect(MODEL.kinds[Kind.Neuron].speed).toBe(0.01);
      expect(MODEL.kinds[Kind.Neuron].persistence).toBe(10);
      expect(MODEL.kinds[Kind.Microglia].persistence).toBe(10);
    });
    And('the radius is 8.4127 micrometres, the time step 0.1 minutes and a run lasts 1200 minutes', () => {
      expect(MODEL.radius).toBeCloseTo(8.4127, 4);
      expect(MODEL.dt).toBe(0.1);
      expect(MODEL.duration).toBe(1200);
    });
  });

  Scenario('Overlapping cells push apart', ({ Given, When, Then }) => {
    let t: Tissue;
    Given('two skin cells 10 micrometres apart', () => { t = createTissue([skin(0), skin(10)]); });
    When('the model takes one step', () => step(t, QUIET, rand));
    Then('each moves away from the other at 50 times the square of one minus the distance over the sum of radii', () => {
      const v = 50 * (1 - 10 / R) ** 2;
      expect(vel(t, 0)[0]).toBeCloseTo(-v, 9);
      expect(vel(t, 1)[0]).toBeCloseTo(v, 9);
    });
  });

  Scenario('Only neurons adhere to each other', ({ Given, When, Then, And }) => {
    let t: Tissue;
    Given('two neurons 19 micrometres apart', () => { t = createTissue([neuron(0), neuron(19)]); });
    When('the model takes one step', () => step(t, QUIET, rand));
    Then('each moves toward the other at 0.04 times the square of one minus the distance over the adhesion range', () => {
      const v = 0.04 * (1 - 19 / S) ** 2;
      expect(vel(t, 0)[0]).toBeCloseTo(v, 12);
      expect(vel(t, 1)[0]).toBeCloseTo(-v, 12);
    });
    And('a neuron and a skin cell at the same distance do not move', () => {
      const u = createTissue([neuron(0), skin(19)]);
      step(u, QUIET, rand);
      expect(vel(u, 0)).toEqual([0, 0, 0]);
      expect(vel(u, 1)).toEqual([0, 0, 0]);
    });
    And('two neurons 22 micrometres apart do not move', () => {
      const u = createTissue([neuron(0), neuron(22)]);
      step(u, QUIET, rand);
      expect(vel(u, 0)).toEqual([0, 0, 0]);
    });
  });

  Scenario('A microglia pulls every other cell toward itself', ({ Given, When, Then, And }) => {
    let t: Tissue;
    Given('a pulling microglia and a neuron 200 micrometres apart', () => { t = createTissue([microglia(0), neuron(200)]); });
    When('the model takes one step', () => step(t, QUIET, rand));
    Then('the neuron moves toward the microglia at the elastic coefficient times the distance', () => {
      expect(vel(t, 1)[0]).toBeCloseTo(-k * 200, 12);
    });
    And('the microglia moves toward the neuron at the same speed', () => {
      expect(vel(t, 0)[0]).toBeCloseTo(k * 200, 12);
    });
  });

  Scenario('Traction adds up over microglia', ({ Given, When, Then }) => {
    let t: Tissue;
    Given('three pulling microglia and a neuron', () => {
      t = createTissue([microglia(0, 0), microglia(90, 0), microglia(0, 120), neuron(300, 240)]);
    });
    When('the model takes one step', () => step(t, QUIET, rand));
    Then('the neuron moves toward their centroid at three times the elastic coefficient times its distance to the centroid', () => {
      expect(vel(t, 3)[0]).toBeCloseTo(3 * k * (30 - 300), 12);
      expect(vel(t, 3)[1]).toBeCloseTo(3 * k * (40 - 240), 12);
    });
  });

  Scenario('Skin cells feel no traction', ({ Given, When, Then }) => {
    let t: Tissue;
    Given('a pulling microglia and a skin cell 200 micrometres apart', () => { t = createTissue([microglia(0), skin(200)]); });
    When('the model takes one step', () => step(t, QUIET, rand));
    Then('the skin cell does not move', () => {
      expect(vel(t, 1)).toEqual([0, 0, 0]);
      expect(at(t, 1)).toEqual([200, 0, 0]);
    });
  });

  Scenario('The skin anchors the microglia', ({ Given, When, Then, And }) => {
    let t: Tissue;
    Given('a pulling microglia between a skin cell 200 micrometres to its right and a neuron 100 micrometres to its left', () => {
      t = createTissue([microglia(0), skin(200), neuron(-100)]);
    });
    When('the model takes one step', () => step(t, QUIET, rand));
    Then('the microglia is pulled toward the skin at the elastic coefficient times 200, less the neuron\'s pull of the elastic coefficient times 100', () => {
      expect(vel(t, 0)[0]).toBeCloseTo(k * 200 - k * 100, 12);
    });
    And('the skin cell does not move', () => { expect(at(t, 1)).toEqual([200, 0, 0]); });
    And('with the skin cell taken away the microglia moves toward the neuron instead', () => {
      const u = createTissue([microglia(0), neuron(-100)]);
      step(u, QUIET, rand);
      expect(vel(u, 0)[0]).toBeCloseTo(-k * 100, 12);
    });
  });

  Scenario('A microglia that lets go pulls nothing', ({ Given, When, Then }) => {
    let t: Tissue;
    Given('a microglia that is not pulling and a neuron 200 micrometres apart', () => {
      t = createTissue([microglia(0), neuron(200)]);
      t.pulling[0] = 0;
    });
    When('the model takes one step', () => step(t, QUIET, rand));
    Then('the neuron does not move', () => { expect(vel(t, 1)).toEqual([0, 0, 0]); });
  });

  Scenario('Held cells stay where they are', ({ Given, When, Then }) => {
    let t: Tissue;
    Given('a pulling microglia and a neuron that is held in place', () => { t = createTissue([microglia(0), neuron(200, 0, false)]); });
    When('the model takes one step', () => step(t, QUIET, rand));
    Then('the neuron has not moved', () => { expect(at(t, 1)).toEqual([200, 0, 0]); });
  });

  Scenario('Positions advance by the Adams-Bashforth rule', ({ Given, When, Then, And }) => {
    let t: Tissue;
    const x: number[] = [];
    Given('a pulling microglia held in place and a neuron 200 micrometres away', () => { t = createTissue([microglia(0, 0, false), neuron(200)]); });
    When('the model takes two steps', () => {
      x.push(at(t, 1)[0]);
      step(t, QUIET, rand); x.push(at(t, 1)[0]);
      step(t, QUIET, rand); x.push(at(t, 1)[0]);
    });
    Then('the first displacement is 1.5 time steps of the first velocity', () => {
      expect(x[1] - x[0]).toBeCloseTo(1.5 * QUIET.dt * (-k * 200), 12);
    });
    And('the second is 1.5 time steps of the second velocity minus 0.5 time steps of the first', () => {
      expect(x[2] - x[1]).toBeCloseTo(QUIET.dt * (1.5 * (-k * x[1]) - 0.5 * (-k * 200)), 12);
    });
  });

  Scenario('A gap between two neurons closes exponentially', ({ Given, When, Then, And }) => {
    let t: Tissue;
    const decay = Math.exp(-4 * k * 600);
    // Each neuron starts 0.5 dt v(0) ahead, and that lead decays like the gap does.
    const lead = 2 * 0.5 * QUIET.dt * (4 * k * 100) * decay;
    Given('four pulling microglia held at the origin and two neurons 100 micrometres either side', () => {
      t = createTissue([0, 1, 2, 3].map(() => microglia(0, 0, false)).concat([neuron(-100), neuron(100)]));
    });
    When('the model runs for 600 minutes', () => { for (let i = 0; i < 6000; i++) step(t, QUIET, rand); });
    Then('the gap is 200 micrometres times the exponential of minus four times the elastic coefficient times 600', () => {
      expect(at(t, 5)[0] - at(t, 4)[0]).toBeCloseTo(200 * decay, 2);
    });
    And('it is smaller by the half step the scheme gains on its first step, which has no previous velocity', () => {
      expect(at(t, 5)[0] - at(t, 4)[0]).toBeCloseTo(200 * decay - lead, 5);
    });
  });

  Scenario('Motile cells walk at their speed and turn at their persistence', ({ Given, When, Then, And }) => {
    let t: Tissue;
    let turns = 0, wrongSpeed = 0;
    Given('a single microglia that is not pulling', () => { t = createTissue([microglia(0)]); t.pulling[0] = 0; });
    When('the model takes 20000 steps', () => {
      const r = rng(7);
      let last = [0, 0, 0];
      for (let i = 0; i < 20000; i++) {
        step(t, MODEL, r);
        const m = [t.motility[0], t.motility[1], t.motility[2]];
        if (m[0] !== last[0] || m[1] !== last[1]) turns++;
        const s = Math.hypot(m[0], m[1], m[2]);
        // The vector is zero until the first draw, as in PhysiCell.
        if (s !== 0 && Math.abs(s - MODEL.kinds[Kind.Microglia].speed) > 1e-9) wrongSpeed++;
        last = m;
      }
    });
    Then('its motility vector always has the microglial speed in three dimensions', () => { expect(wrongSpeed).toBe(0); });
    And('its component out of the plane never moves it', () => { expect(at(t, 0)[2]).toBe(0); });
    And('it changes direction in about one step in a hundred', () => {
      expect(turns).toBeGreaterThan(140);
      expect(turns).toBeLessThan(260);
    });
  });

  Scenario('The visitor steers one cell only', ({ Given, When, Then, And }) => {
    let t: Tissue, alone: Tissue;
    Given('two microglia that are not pulling, one of them the visitor\'s', () => {
      const make = () => { const u = createTissue([microglia(0), microglia(500)]); u.pulling.fill(0); return u; };
      t = make(); alone = make();
    });
    When('the visitor heads along x and the model takes one step', () => {
      const a = rng(3), b = rng(3);
      for (let i = 0; i < 500; i++) {
        step(t, MODEL, a, { input: { agent: 0, heading: [1, 0, 0], pulling: false } });
        step(alone, MODEL, b);
      }
    });
    Then('the visitor\'s cell moves along x at the microglial speed', () => {
      expect(vel(t, 0)).toEqual([3, 0, 0]);
    });
    And('the other microglia keeps its own random walk', () => {
      expect(at(t, 1)).toEqual(at(alone, 1));
      expect(at(t, 1)).not.toEqual([500, 0, 0]);
    });
  });

  Scenario('The visitor\'s hold switches their traction on and off', ({ Given, When, Then }) => {
    let t: Tissue;
    Given('a neuron and the visitor\'s microglia 200 micrometres apart', () => { t = createTissue([neuron(0), microglia(200)]); });
    When('the visitor holds and the model takes one step', () => step(t, QUIET, rand, { input: { agent: 1, heading: null, pulling: true } }));
    Then('the neuron moves toward the visitor\'s cell', () => { expect(vel(t, 0)[0]).toBeCloseTo(k * 200, 9); });
    When('the visitor lets go and the model takes one step', () => step(t, QUIET, rand, { input: { agent: 1, heading: null, pulling: false } }));
    Then('the neuron\'s velocity is zero', () => { expect(vel(t, 0)).toEqual([0, 0, 0]); });
  });

  Scenario('A weaker traction scales the pull and nothing else', ({ Given, When, Then }) => {
    let t: Tissue;
    Given('a pulling microglia and a neuron 200 micrometres apart', () => { t = createTissue([microglia(0), neuron(200)]); });
    When('the model takes one step at half the traction', () => step(t, QUIET, rand, { tractionScale: 0.5 }));
    Then('the neuron moves toward the microglia at half the elastic coefficient times the distance', () => {
      expect(vel(t, 1)[0]).toBeCloseTo(-0.5 * k * 200, 12);
    });
  });
});
