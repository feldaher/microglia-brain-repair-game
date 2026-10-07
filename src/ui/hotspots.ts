// The journey's hotspots: labels that ride on points of the 3D tissue and open the paper's panel.

import type { Hotspot } from '../journey/types';
import { ON_SCREEN } from '../teach/chapters';
import type { Labels } from './labels';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hotspots {
  private layer = $('hotspots');
  private buttons = new Map<string, HTMLButtonElement>();
  private spots: Hotspot[] = [];
  private pinned: string | null = null;

  constructor(private labels: Labels) {}

  /** The hotspots of the chapter on screen. */
  set(spots: Hotspot[]): void {
    if (this.pinned) this.labels.close();
    this.pinned = null;
    this.layer.replaceChildren();
    this.buttons.clear();
    this.spots = spots;
    for (const h of spots) {
      const b = document.createElement('button');
      b.className = 'lbl';
      b.style.setProperty('--c', h.colour);
      b.innerHTML = '<i></i>';
      b.append(h.label);
      b.addEventListener('click', () => (this.pinned === h.id && !$('card').hidden ? this.close() : this.show(h)));
      this.layer.append(b);
      this.buttons.set(h.id, b);
    }
  }

  private show(h: Hotspot): void {
    const p = h.panel;
    this.labels.fill(p.title, p.numbers, p.text, p.figure, h.colour);
    $('card-kind').textContent = `${p.source} of the paper. ${ON_SCREEN[p.model]}`;
    const more = $<HTMLAnchorElement>('card-more');
    more.hidden = !p.more;
    if (p.more) { more.textContent = `${p.more.label} →`; more.href = p.more.href; }
    this.pinned = h.id;
    for (const [id, b] of this.buttons) b.classList.toggle('pinned', id === h.id);
  }

  close(): void {
    this.labels.close();
    this.pinned = null;
    for (const b of this.buttons.values()) b.classList.remove('pinned');
  }

  /** Moves each hotspot to where its point is on the page; `place` gives null for one that is not to be seen. */
  update(place: (h: Hotspot) => { x: number; y: number } | null): void {
    for (const h of this.spots) {
      const b = this.buttons.get(h.id)!, p = place(h);
      b.hidden = !p;
      if (p) { b.style.left = `${p.x}px`; b.style.top = `${p.y}px`; }
    }
  }
}
