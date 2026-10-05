import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import html from '../index.html?raw';
import { markWelcomed, shouldWelcome, type SeenStore } from '../src/ui/welcome';

const feature = await loadFeature('features/welcome.feature');
/** The files served from public/video. */
const videos = Object.keys(import.meta.glob('../public/video/*')).map((p) => p.replace('../public/', ''));
const block = (open: string, close: string) => html.slice(html.indexOf(open), html.indexOf(close, html.indexOf(open)));
const dialog = block('<dialog class="welcome" id="welcome"', '</dialog>');
const fallback = block('<div class="fallback"', '<script');
const text = dialog.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const memory = (): SeenStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
};
const broken: SeenStore = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };

describeFeature(feature, ({ Scenario }) => {
  Scenario('The welcome says what this is and what you can do', ({ Given, Then, And }) => {
    Given('the page markup', () => expect(dialog.length).toBeGreaterThan(0));
    Then('the welcome is a dialog with a title and a start button', () => {
      expect(dialog).toMatch(/aria-labelledby="welcome-title"/);
      expect(dialog).toMatch(/<h2 id="welcome-title"/);
      expect(dialog).toMatch(/<button[^>]*id="welcome-start"/);
    });
    And('it says the visitor is a microglia in a wounded zebrafish brain', () => {
      for (const w of [/microglia/i, /zebrafish/i, /wound/i, /brain/i]) expect(text).toMatch(w);
    });
    And('it tells the visitor they can crawl, pull and call', () => {
      for (const w of [/\bcrawl\b/i, /\bpull\b/i, /\bcall\b/i]) expect(text).toMatch(w);
    });
    And('it is short: under 120 words', () => expect(text.split(' ').length).toBeLessThan(120));
    And('a button on the page opens it again', () => expect(html).toMatch(/<button[^>]*id="welcome-open"/));
  });

  Scenario('The welcome shows once', ({ Given, When, Then, And }) => {
    let store: SeenStore, show = false;
    Given('a visitor who has never been here', () => { store = memory(); });
    When('the page decides whether to welcome them', () => { show = shouldWelcome(store); });
    Then('it does', () => expect(show).toBe(true));
    And('after they start, it does not welcome them again', () => {
      markWelcomed(store);
      expect(shouldWelcome(store)).toBe(false);
    });
  });

  Scenario('A browser that refuses storage still gets a welcome', ({ Given, When, Then, And }) => {
    let show = false;
    Given('a browser whose storage throws', () => undefined);
    When('the page decides whether to welcome them', () => { show = shouldWelcome(broken); });
    Then('it does', () => expect(show).toBe(true));
    And('starting does not fail', () => expect(() => markWelcomed(broken)).not.toThrow());
  });

  Scenario('A browser without WebGPU is shown the real thing instead', ({ Given, Then, And }) => {
    Given('the page markup', () => expect(fallback.length).toBeGreaterThan(0));
    Then('the fallback plays the paper\'s wound-closure video and its simulation video', () => {
      const sources = [...fallback.matchAll(/<video src="([^"]+)"/g)].map((m) => m[1]);
      expect(sources).toEqual(['video/video1-wound-closure.mov', 'video/video3-simulation.mov']);
      for (const s of sources) expect(videos, s).toContain(s);
    });
    And('it credits the paper and its licence', () => {
      expect(fallback).toMatch(/El-Daher et al\. 2024/);
      expect(fallback).toMatch(/CC BY 4\.0/);
      expect(fallback).toMatch(/10\.26508\/lsa\.202403052/);
    });
  });
});
