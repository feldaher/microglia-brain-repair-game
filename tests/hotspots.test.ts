import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import type { Vec3 } from '../src/contracts';
import { where } from '../src/journey/hotspot';
import type { Hotspot } from '../src/journey/types';
import { eye, project, viewProj, type Camera } from '../src/render/camera';
import { CHAPTERS } from '../src/teach/chapters';

const feature = await loadFeature('features/hotspots.feature');
const W = 1000, H = 600;
const cam: Camera = { target: [30, 10, -20], dist: 800, yaw: 0.8, pitch: 0.5 };
const draw = (p: Vec3) => project(viewProj(cam, W / H), p, W, H);

describeFeature(feature, ({ Scenario }) => {
  Scenario('A hotspot is drawn where its point is', ({ Given, Then, And }) => {
    Given('a camera looking at a point of the tissue in a window 1000 by 600', () => undefined);
    Then('that point is at the middle of the window', () => {
      const p = draw(cam.target)!;
      expect(p.x).toBeCloseTo(W / 2, 3);
      expect(p.y).toBeCloseTo(H / 2, 3);
    });
    And('a point to the camera\'s right is drawn to the right of the middle, at the same height', () => {
      const p = draw([cam.target[0] + 50 * Math.cos(cam.yaw), cam.target[1], cam.target[2] - 50 * Math.sin(cam.yaw)])!;
      expect(p.x).toBeGreaterThan(W / 2 + 10);
      expect(p.y).toBeCloseTo(H / 2, 3);
    });
  });

  Scenario('A point behind the camera has no hotspot', ({ Given, Then }) => {
    Given('a camera looking at a point of the tissue in a window 1000 by 600', () => undefined);
    Then('a point behind the camera is not drawn', () => {
      const e = eye(cam);
      // As far behind the eye as the target is in front of it.
      const behind: Vec3 = [2 * e[0] - cam.target[0], 2 * e[1] - cam.target[1], 2 * e[2] - cam.target[2]];
      expect(draw(behind)).toBeNull();
    });
  });

  Scenario('A hotspot can follow something that moves', ({ Given, Then, And }) => {
    let h: Hotspot;
    Given('a hotspot that follows the first microglia', () => {
      h = CHAPTERS.flatMap((c) => c.hotspots).find((x) => typeof x.at === 'function')!;
      expect(h).toBeTruthy();
    });
    Then('it is where that microglia is', () => {
      expect(where(h, { microglia: Float32Array.of(7, 8, 9, 1, 2, 3) })).toEqual([7, 8, 9]);
    });
    And('it is absent when there are no microglia', () => {
      expect(where(h, { microglia: new Float32Array(0) })).toBeNull();
    });
  });
});
