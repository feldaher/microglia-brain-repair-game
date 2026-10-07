import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import type { Vec3 } from '../src/contracts';
import { Director } from '../src/journey/director';
import { frame } from '../src/journey/camera';
import type { Chapter, DirectorState, Shot, Viewport } from '../src/journey/types';
import { project, viewProj } from '../src/render/camera';
import { CHAPTERS } from '../src/teach/chapters';
import { MODEL_KIND } from '../src/teach/stations';

const feature = await loadFeature('features/journey.feature');
const files = Object.keys(import.meta.glob('../public/figures/*')).map((p) => p.replace('../public/', ''));
const last = CHAPTERS.length - 1;
const lines = (c: Chapter) => c.captions.length;
const snapshot = (d: Director): DirectorState => ({ ...d.state });
const same = (a: Shot, b: Shot) => {
  for (let k = 0; k < 3; k++) expect(a.centre[k]).toBeCloseTo(b.centre[k], 6);
  expect(a.extent).toBeCloseTo(b.extent, 6);
  expect(a.yaw).toBeCloseTo(b.yaw, 6);
  expect(a.pitch).toBeCloseTo(b.pitch, 6);
};
/** Presses next until the director is on another chapter. */
const onward = (d: Director, from?: Shot) => { const i = d.state.index; for (let k = 0; k < 20 && d.state.index === i; k++) d.next(from); };
/** A director that has flown to chapter i and landed. */
const arrivedAt = (i: number): Director => {
  const d = new Director(CHAPTERS);
  if (i > 0) { d.goto(i); d.tick(1e3); }
  return d;
};
const shot = (over: Partial<Shot>): Shot => ({ centre: [0, 0, 0], extent: 300, yaw: 0, pitch: 0.9, ...over });
const chapter = (s: Shot): Chapter => ({ id: 'x', title: 'x', captions: ['x'], shot: s, flight: 2, show: { microglia: false }, hotspots: [], scale: { length: 1, label: '', note: '' } });
const withStop = CHAPTERS.findIndex((c) => c.stop), withoutStop = CHAPTERS.findIndex((c) => !c.stop);

describeFeature(feature, ({ Scenario }) => {
  Scenario('The journey starts on its first chapter, already there', ({ Given, Then, And }) => {
    let d: Director;
    Given('a director on the chapters of the journey', () => { d = new Director(CHAPTERS); });
    Then('it is on the first chapter, on its first line, arrived', () => {
      expect(d.state).toMatchObject({ index: 0, line: 0, phase: 'arrived' });
      expect(d.caption()).toBe(CHAPTERS[0].captions[0]);
    });
    And('the camera is on that chapter\'s shot', () => same(d.pose(), CHAPTERS[0].shot));
  });

  Scenario('Next reads the chapter out, then flies on', ({ Given, When, Then, And }) => {
    let d: Director;
    Given('a director on the chapters of the journey', () => { d = new Director(CHAPTERS); });
    When('next is pressed once for each remaining line of the first chapter', () => { for (let k = 1; k < lines(CHAPTERS[0]); k++) d.next(); });
    Then('it is still on the first chapter, on its last line', () => {
      expect(d.state).toMatchObject({ index: 0, line: lines(CHAPTERS[0]) - 1, phase: 'arrived' });
    });
    When('next is pressed again', () => { d.next(); });
    Then('it is flying to the second chapter, on its first line', () => {
      expect(d.state).toMatchObject({ index: 1, line: 0, phase: 'flying', t: 0 });
      expect(d.caption()).toBe(CHAPTERS[1].captions[0]);
    });
    And('the camera has not moved yet', () => same(d.pose(), CHAPTERS[0].shot));
  });

  Scenario('A flight ends exactly on the shot', ({ Given, When, Then, And }) => {
    let d: Director;
    Given('a director flying to the second chapter', () => { d = new Director(CHAPTERS); d.goto(1); });
    When('the flight\'s time has passed', () => {
      // In frames, as the page does it, and a little over.
      for (let f = 0; f < CHAPTERS[1].flight * 60 + 2; f++) d.tick(1 / 60);
    });
    Then('it has arrived', () => expect(d.state).toMatchObject({ index: 1, phase: 'arrived', t: 1 }));
    And('the camera is on the second chapter\'s shot', () => same(d.pose(), CHAPTERS[1].shot));
  });

  Scenario('Halfway through a descent the scale is the geometric mean', ({ Given, When, Then }) => {
    let d: Director;
    Given('a flight from a shot 3500 micrometres wide to one 350 wide', () => {
      d = new Director([chapter(shot({ extent: 3500 })), chapter(shot({ extent: 350 }))]);
      d.goto(1);
    });
    When('half the flight\'s time has passed', () => { d.tick(1); });
    Then('the camera frames about 1107 micrometres', () => expect(d.pose().extent).toBeCloseTo(Math.sqrt(3500 * 350), 0));
  });

  Scenario('The camera turns the short way round', ({ Given, When, Then }) => {
    let d: Director;
    Given('a flight from a yaw of 3 radians to a yaw of -3 radians', () => {
      d = new Director([chapter(shot({ yaw: 3 })), chapter(shot({ yaw: -3 }))]);
      d.goto(1);
    });
    When('half the flight\'s time has passed', () => { d.tick(1); });
    Then('the yaw is within 0.2 of pi, not near zero', () => {
      const yaw = d.pose().yaw, turns = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      expect(Math.PI - Math.abs(turns)).toBeLessThan(0.2);
    });
  });

  Scenario('Next during a flight lands it', ({ Given, When, Then }) => {
    let d: Director;
    Given('a director flying to the second chapter', () => { d = new Director(CHAPTERS); d.goto(1); d.tick(0.1); });
    When('next is pressed', () => { d.next(); });
    Then('it has arrived at the second chapter, on its first line', () => {
      expect(d.state).toMatchObject({ index: 1, line: 0, phase: 'arrived', t: 1 });
      same(d.pose(), CHAPTERS[1].shot);
    });
  });

  Scenario('Back retraces the steps', ({ Given, When, Then }) => {
    let d: Director, before: DirectorState;
    Given('a director arrived at the second chapter', () => { d = arrivedAt(1); });
    When('back is pressed', () => { d.back(); });
    Then('it is flying to the first chapter, on its last line', () => {
      expect(d.state).toMatchObject({ index: 0, line: lines(CHAPTERS[0]) - 1, phase: 'flying' });
      same(d.pose(), CHAPTERS[1].shot);
    });
    When('back is pressed at the first line of the first chapter', () => {
      d = new Director(CHAPTERS);
      before = snapshot(d);
      expect(d.back()).toBe(false);
    });
    Then('nothing changes', () => expect(d.state).toEqual(before));
  });

  Scenario('The last chapter has no next', ({ Given, When, Then }) => {
    let d: Director, before: DirectorState;
    Given('a director arrived at the last chapter, on its last line', () => {
      d = arrivedAt(last);
      for (let k = 1; k < lines(CHAPTERS[last]); k++) d.next();
      expect(d.state.line).toBe(lines(CHAPTERS[last]) - 1);
    });
    When('next is pressed', () => { before = snapshot(d); expect(d.next()).toBe(false); });
    Then('nothing changes', () => expect(d.state).toEqual(before));
  });

  Scenario('Any chapter can be reached directly', ({ Given, When, Then }) => {
    let d: Director, before: DirectorState;
    Given('a director on the chapters of the journey', () => { d = new Director(CHAPTERS); });
    When('the visitor goes to the last chapter', () => { expect(d.goto(last)).toBe(true); });
    Then('it is flying to the last chapter, on its first line', () => expect(d.state).toMatchObject({ index: last, line: 0, phase: 'flying' }));
    When('the visitor goes to a chapter that does not exist', () => {
      before = snapshot(d);
      expect(d.goto(CHAPTERS.length)).toBe(false);
      expect(d.goto(-1)).toBe(false);
    });
    Then('nothing changes', () => expect(d.state).toEqual(before));
  });

  Scenario('With reduced motion a flight is a cut', ({ Given, When, Then }) => {
    let d: Director;
    Given('a director for a visitor who asked for reduced motion', () => { d = new Director(CHAPTERS, { reducedMotion: true }); });
    When('next is pressed until the chapter changes', () => onward(d));
    Then('it has arrived at once, without flying', () => {
      expect(d.state).toMatchObject({ index: 1, phase: 'arrived', t: 1 });
      same(d.pose(), CHAPTERS[1].shot);
    });
  });

  Scenario('At a stop the visitor takes the camera', ({ Given, When, Then }) => {
    let d: Director;
    const left = shot({ centre: [10, 20, 30], extent: 123, yaw: 2, pitch: 0.3 });
    Given('a director arrived at a chapter with a stop', () => {
      expect(withStop).toBeGreaterThanOrEqual(0);
      expect(withStop).toBeLessThan(last);
      d = arrivedAt(withStop);
    });
    When('the visitor takes the camera', () => { expect(d.release()).toBe(true); });
    Then('the camera is free', () => expect(d.state.phase).toBe('free'));
    When('next is pressed until the chapter changes, from where the visitor left the camera', () => onward(d, left));
    Then('the flight starts from where the visitor left it', () => {
      expect(d.state).toMatchObject({ index: withStop + 1, phase: 'flying', t: 0 });
      same(d.pose(), left);
    });
  });

  Scenario('Where there is no stop the camera cannot be taken', ({ Given, When, Then }) => {
    let d: Director;
    Given('a director arrived at a chapter without a stop', () => {
      expect(withoutStop).toBeGreaterThanOrEqual(0);
      d = arrivedAt(withoutStop);
    });
    When('the visitor takes the camera', () => { expect(d.release()).toBe(false); });
    Then('the camera is still the director\'s', () => expect(d.state.phase).toBe('arrived'));
  });

  Scenario('The chapters say where their numbers come from', ({ Given, Then, And }) => {
    const panels = CHAPTERS.flatMap((c) => c.hotspots.map((h) => h.panel));
    Given('the chapters of the journey', () => expect(CHAPTERS.length).toBeGreaterThanOrEqual(3));
    Then('each has a title, at least one caption, and captions of at most 40 words', () => {
      expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
      for (const c of CHAPTERS) {
        expect(c.title.length, c.id).toBeGreaterThan(0);
        expect(c.captions.length, c.id).toBeGreaterThan(0);
        for (const line of c.captions) expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(40);
        expect(c.flight, c.id).toBeGreaterThan(0);
        expect(c.shot.extent, c.id).toBeGreaterThan(0);
      }
    });
    And('each chapter about a figure has a hotspot', () => {
      for (const c of CHAPTERS) if (c.fig) expect(c.hotspots.length, c.id).toBeGreaterThan(0);
    });
    And('every panel names a page or a figure of the paper, a kind of model, and a picture that is a file of the site', () => {
      expect(panels.length).toBeGreaterThan(0);
      for (const p of panels) {
        expect(p.source, p.title).toMatch(/p\. \d+|Fig S?\d/);
        expect(MODEL_KIND[p.model], p.title).toBeTruthy();
        expect(files, p.title).toContain(p.figure.src);
        expect(p.text.split(/\s+/).length, p.title).toBeLessThanOrEqual(70);
      }
    });
    And('every micrograph in the scene is a file of the site', () => {
      const planes = CHAPTERS.flatMap((c) => (c.show.micrograph ? [c.show.micrograph] : []));
      expect(planes.length).toBeGreaterThan(0);
      for (const p of planes) {
        expect(files).toContain(p.src);
        const [l, t, r, b] = p.crop;
        expect(l).toBeGreaterThanOrEqual(0); expect(t).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1); expect(b).toBeLessThanOrEqual(1);
        expect(r).toBeGreaterThan(l); expect(b).toBeGreaterThan(t);
      }
    });
    And('the chapter about Fig 4 sends the visitor on to the paper\'s own simulation', () => {
      const fig4 = CHAPTERS.find((c) => c.fig === 4)!;
      expect(fig4.stop).toBe('experiment');
      expect(fig4.hotspots.some((h) => h.panel.more?.href === '#fig4')).toBe(true);
    });
  });

  Scenario('The same chapter frames the same tissue in any window', ({ Given, When, Then, And }) => {
    const s = shot({ centre: [20, 10, -5], yaw: 0.7, pitch: 0.6 });
    let vp: Viewport;
    const drawn = (p: Vec3) => project(viewProj(frame(s, vp), vp.width / vp.height), p, vp.width, vp.height)!;
    const middle = () => {
      const c = drawn(s.centre);
      expect(c.x).toBeCloseTo(vp.left + (vp.width - vp.left - vp.right) / 2, 3);
      expect(c.y).toBeCloseTo(vp.top + (vp.height - vp.top - vp.bottom) / 2, 3);
    };
    Given('a shot 300 micrometres wide', () => expect(s.extent).toBe(300));
    When('it is framed in a window 1400 by 900 with 470 pixels of text on the left and 290 on the right', () => {
      vp = { width: 1400, height: 900, left: 470, right: 290, top: 0, bottom: 0 };
    });
    Then('300 micrometres span the 640 free pixels', () => {
      // Along the camera's right, through the centre.
      const right: Vec3 = [Math.cos(s.yaw), 0, -Math.sin(s.yaw)];
      const at = (k: number): Vec3 => [s.centre[0] + k * right[0], s.centre[1], s.centre[2] + k * right[2]];
      expect(drawn(at(150)).x - drawn(at(-150)).x).toBeCloseTo(640, 2);
    });
    And('the shot\'s centre is drawn in the middle of the free area', middle);
    When('it is framed in a window 390 by 800 with 110 pixels of title at the top and 360 pixels of controls at the bottom', () => {
      vp = { width: 390, height: 800, left: 0, right: 0, top: 110, bottom: 360 };
    });
    Then('the shot\'s centre is drawn in the middle of the free area', middle);
  });
});
