import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { PIN, PIN_AXIS, Region, TECTUM, isHeld, pinSdf, regionAt, tissueSdf } from '../src/tissue/anatomy';
import { SOLVER, Tissue } from '../src/tissue/tissue';
import { tetVolume } from '../src/soft/mesh';

const feature = await loadFeature('features/tissue3d.feature');
const tissue = new Tissue();
const rest = tissue.woundVolume();

/** The tissue settles in about 300 frames (see the design note); 600 are run. */
const settle = (t: Tissue, frames = 600) => { for (let f = 0; f < frames; f++) t.step(); };

describeFeature(feature, ({ Background, Scenario }) => {
  Background(({ Given }) => { Given('the tectum, built once', () => { expect(tissue.mesh.tets.length).toBeGreaterThan(0); }); });

  Scenario('The shape is the one measured on Fig 1C', ({ Then, And }) => {
    const sdf = tissueSdf(false), y = TECTUM.sectionY;
    const extent = (axis: 0 | 2, inside: (x: number, z: number) => boolean) => {
      let lo = Infinity, hi = -Infinity;
      for (let a = -130; a <= 130; a += 0.5) for (let b = -130; b <= 130; b += 2) {
        const x = axis === 0 ? a : b, z = axis === 0 ? b : a;
        if (inside(x, z)) { lo = Math.min(lo, a); hi = Math.max(hi, a); }
      }
      return hi - lo;
    };
    Then('the lobe is 210 micrometres across and 200 long in a horizontal section', () => {
      expect(Math.abs(extent(0, (x, z) => sdf(x, 0, z) < 0) - 210)).toBeLessThan(3);
      expect(Math.abs(extent(2, (x, z) => sdf(x, 0, z) < 0) - 200)).toBeLessThan(3);
    });
    And('the neuropil is an oval of about 110 by 155 micrometres in that section', () => {
      const np = (x: number, z: number) => sdf(x, y, z) < 0 && regionAt(x, y, z) === Region.Neuropil;
      expect(Math.abs(extent(0, np) - 110)).toBeLessThan(15);
      expect(Math.abs(extent(2, np) - 155)).toBeLessThan(15);
    });
    And('the cell-dense zone, the neuropil and the skin are all present in the mesh', () => {
      const count = [0, 0, 0];
      for (const r of tissue.mesh.tetMaterial) count[r]++;
      for (const c of count) expect(c).toBeGreaterThan(300);
    });
    And('the tissue is held where it joins the rest of the brain, and free elsewhere', () => {
      const m = tissue.mesh;
      let held = 0;
      for (let i = 0; i < m.invMass.length; i++) {
        const h = isHeld(m.restPos[3 * i], m.restPos[3 * i + 1], m.restPos[3 * i + 2]);
        expect(m.invMass[i] === 0).toBe(h);
        if (h) held++;
      }
      expect(held).toBeGreaterThan(100);
      expect(held).toBeLessThan(0.35 * m.invMass.length);
    });
  });

  Scenario('The mesh is one the solver can carry', ({ Then, And }) => {
    const m = tissue.mesh;
    Then('every tetrahedron has a positive volume', () => {
      for (let t = 0; t < m.tets.length; t += 4) expect(tetVolume(m.restPos, m.tets[t], m.tets[t + 1], m.tets[t + 2], m.tets[t + 3])).toBeGreaterThan(0);
    });
    And('there are between 3000 and 9000 particles', () => {
      console.log('tissue mesh:', m.invMass.length, 'particles,', m.tets.length / 4, 'tetrahedra;', tissue.nuclei.length / 3, 'nuclei');
      expect(m.invMass.length).toBeGreaterThan(3000);
      expect(m.invMass.length).toBeLessThan(9000);
    });
    And('the mesh is one connected body', () => {
      const parent = Array.from({ length: m.invMass.length }, (_, i) => i);
      const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
      for (let t = 0; t < m.tets.length; t += 4) for (let k = 1; k < 4; k++) parent[find(m.tets[t])] = find(m.tets[t + k]);
      expect(new Set(parent.map((_, i) => find(i))).size).toBe(1);
    });
  });

  Scenario('Neurons are packed as in the fish', ({ Then, And }) => {
    const p = tissue.nucleiRest, n = p.length / 3;
    Then('there are more than 8000 nuclei', () => { expect(n).toBeGreaterThan(8000); });
    And('each has its nearest neighbour between 4.5 and 6.5 micrometres away, as in Fig 1C', () => {
      // Checked on every 40th nucleus of the cell-dense zone, away from its edges.
      const cell = new Map<string, number[]>(), key = (i: number) => `${Math.floor(p[3 * i] / 8)},${Math.floor(p[3 * i + 1] / 8)},${Math.floor(p[3 * i + 2] / 8)}`;
      for (let i = 0; i < n; i++) { const k = key(i); cell.set(k, [...(cell.get(k) ?? []), i]); }
      const sdf = tissueSdf(true);
      let checked = 0;
      for (let i = 0; i < n; i += 40) {
        if (tissue.nucleusRegion[i] !== Region.Pvz || sdf(p[3 * i], p[3 * i + 1], p[3 * i + 2]) > -12) continue;
        let best = Infinity;
        const [a, b, c] = key(i).split(',').map(Number);
        for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (let dc = -1; dc <= 1; dc++) {
          for (const j of cell.get(`${a + da},${b + db},${c + dc}`) ?? []) if (j !== i) best = Math.min(best, Math.hypot(p[3 * i] - p[3 * j], p[3 * i + 1] - p[3 * j + 1], p[3 * i + 2] - p[3 * j + 2]));
        }
        // Deep in the zone, but the lens of the neuropil and the skin thin it out at their borders.
        if (regionAt(p[3 * i] + 7, p[3 * i + 1] + 7, p[3 * i + 2]) !== Region.Pvz || regionAt(p[3 * i] - 7, p[3 * i + 1] - 7, p[3 * i + 2]) !== Region.Pvz) continue;
        expect(best).toBeGreaterThan(4.5);
        expect(best).toBeLessThan(6.5);
        checked++;
      }
      expect(checked).toBeGreaterThan(60);
    });
    And('none lies in the wound, and nearly all lie in the cell-dense zone', () => {
      let dense = 0;
      for (let i = 0; i < n; i++) {
        expect(pinSdf(p[3 * i], p[3 * i + 1], p[3 * i + 2])).toBeGreaterThan(0);
        if (tissue.nucleusRegion[i] === Region.Pvz) dense++;
      }
      expect(dense / n).toBeGreaterThan(0.9);
    });
  });

  Scenario('The wound is the track of the pin', ({ Then, And }) => {
    Then('the wound is a channel 80 micrometres wide at the skin, entering at 25 degrees', () => {
      expect(2 * Tissue.pinRadii()[0]).toBe(80);
      expect((Math.asin(-PIN_AXIS[1]) * 180) / Math.PI).toBeCloseTo(25, 6);
      expect(PIN.depth).toBe(200);
    });
    And('its measured volume is within a quarter of the volume of that channel inside the tissue', () => {
      const channel = Tissue.channelVolume();
      console.log('wound volume: measured on the mesh', Math.round(rest), 'µm³; the channel inside the lobe', Math.round(channel), 'µm³');
      expect(Math.abs(rest / channel - 1)).toBeLessThan(0.25);
    });
  });

  Scenario('Nothing moves by itself', ({ When, Then, And }) => {
    const t = new Tissue();
    When('the tissue runs for 5 seconds with nothing pulling', () => settle(t, 300));
    Then('the wound\'s volume has changed by less than 1 percent', () => { expect(Math.abs(t.woundVolume() / rest - 1)).toBeLessThan(0.01); });
    And('no nucleus has moved by more than half a micrometre', () => {
      let most = 0;
      for (let k = 0; k < t.nuclei.length; k += 3) most = Math.max(most, Math.hypot(t.nuclei[k] - t.nucleiRest[k], t.nuclei[k + 1] - t.nucleiRest[k + 1], t.nuclei[k + 2] - t.nucleiRest[k + 2]));
      expect(most).toBeLessThan(0.5);
    });
  });

  let pulled2 = 0;
  Scenario('Microglia over the wound pull it shut, and it springs back when they let go', ({ Given, When, Then, And }) => {
    const t = new Tissue(), cells = Tissue.aroundWound(12);
    Given('twelve microglia in the neuropil around the wound, each holding the tissue within reach', () => {
      t.placeMicroglia(cells, 30);
      expect(cells.length).toBe(12);
      for (const c of cells) expect(regionAt(c[0], c[1], c[2])).toBe(Region.Neuropil);
      expect(t.holdCount).toBeGreaterThan(cells.length * 10);
    });
    When('they shorten their hold by half and the tissue settles', () => { t.shortening = 0.5; settle(t); });
    Then('the wound is smaller by more than a tenth', () => {
      pulled2 = t.woundVolume();
      console.log('wound volume with', cells.length, 'microglia pulling:', (pulled2 / rest).toFixed(3), 'of rest; agitation', t.agitation().toExponential(1));
      expect(pulled2 / rest).toBeLessThan(0.9);
    });
    And('nuclei near the microglia have moved toward them, more than nuclei far away', () => {
      const c = cells.reduce((s, q) => [s[0] + q[0] / cells.length, s[1] + q[1] / cells.length, s[2] + q[2] / cells.length], [0, 0, 0]);
      let near = 0, nNear = 0, far = 0, nFar = 0, toward = 0;
      for (let k = 0; k < t.nuclei.length; k += 3) {
        const d0 = Math.hypot(t.nucleiRest[k] - c[0], t.nucleiRest[k + 1] - c[1], t.nucleiRest[k + 2] - c[2]);
        const d1 = Math.hypot(t.nuclei[k] - c[0], t.nuclei[k + 1] - c[1], t.nuclei[k + 2] - c[2]);
        const moved = Math.hypot(t.nuclei[k] - t.nucleiRest[k], t.nuclei[k + 1] - t.nucleiRest[k + 1], t.nuclei[k + 2] - t.nucleiRest[k + 2]);
        if (d0 < 60) { near += moved; nNear++; toward += d0 - d1; } else if (d0 > 120) { far += moved; nFar++; }
      }
      console.log('nuclei within 60 µm of the microglia moved', (near / nNear).toFixed(1), 'µm on average (', nNear, 'nuclei); beyond 120 µm', (far / nFar).toFixed(1), 'µm (', nFar, ')');
      expect(nNear).toBeGreaterThan(100);
      expect(nFar).toBeGreaterThan(100);
      expect(toward / nNear).toBeGreaterThan(0);
      expect(near / nNear).toBeGreaterThan(2 * (far / nFar));
    });
    When('they let go and the tissue settles', () => { t.shortening = 0; settle(t); });
    Then('the wound is back to within 3 percent of what it was', () => { expect(Math.abs(t.woundVolume() / rest - 1)).toBeLessThan(0.03); });
  });

  Scenario('What the tissue settles to does not depend on the solver\'s substeps', ({ Given, Then }) => {
    let four = 0;
    Given('the same microglia and the same pull, solved with 2 and with 4 substeps', () => {
      const t = new Tissue({}, { ...SOLVER, substeps: 4 });
      t.placeMicroglia(Tissue.aroundWound(12), 30);
      t.shortening = 0.5;
      settle(t);
      four = t.woundVolume();
    });
    Then('the two wound volumes agree within 3 percent', () => {
      console.log('wound volume, fraction of rest: 2 substeps', (pulled2 / rest).toFixed(3), '· 4 substeps', (four / rest).toFixed(3));
      expect(Math.abs(four / pulled2 - 1)).toBeLessThan(0.03);
    });
  });
});
