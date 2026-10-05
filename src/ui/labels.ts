// The labels that ride over the scene, and the card a label opens.

import type { Game } from '../app/game';
import { CARDS, CREDIT, PAPER_URL, type Card, type Figure } from '../teach/cards';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class Labels {
  private buttons = new Map<Card['id'], HTMLButtonElement>();
  private open: Card | null = null;
  shown = true;

  constructor() {
    const layer = $('labels');
    for (const card of CARDS) {
      const b = document.createElement('button');
      b.className = 'lbl';
      b.style.setProperty('--c', card.colour);
      b.innerHTML = '<i></i>';
      b.append(card.label);
      b.addEventListener('click', () => (this.open === card ? this.close() : this.show(card)));
      layer.append(b);
      this.buttons.set(card.id, b);
    }
    $('card-close').addEventListener('click', () => this.close());
    $('labels-btn').addEventListener('click', () => this.toggle());
  }

  toggle(): void {
    this.shown = !this.shown;
    const b = $('labels-btn');
    b.classList.toggle('on', this.shown);
    b.setAttribute('aria-pressed', String(this.shown));
    if (!this.shown) this.close();
  }

  show(card: Card): void {
    this.fill(card.name, card.size, card.blurb, card.figure, card.colour);
    this.open = card;
    $('card-kind').hidden = true;
    for (const [id, b] of this.buttons) b.classList.toggle('pinned', id === card.id);
  }

  /** Fills and opens the card; also used for the stations. */
  fill(name: string, size: string, blurb: string, figure: Figure, colour: string): void {
    for (const b of this.buttons.values()) b.classList.remove('pinned');
    const card = { name, size, blurb, figure, colour };
    this.open = null;
    $('card-kind').hidden = false;
    $('card').hidden = false;
    $('card').style.setProperty('--c', card.colour);
    $('card-name').textContent = card.name;
    $('card-size').textContent = card.size;
    $('card-blurb').textContent = card.blurb;
    $<HTMLImageElement>('card-img').src = card.figure.src;
    $<HTMLImageElement>('card-img').alt = card.figure.caption;
    $<HTMLAnchorElement>('card-img-link').href = card.figure.src;
    $('card-cap').textContent = card.figure.caption;
    $('card-credit').innerHTML = `${card.figure.panel} of <a href="${PAPER_URL}" target="_blank" rel="noopener">${CREDIT}</a>`;
  }

  close(): void {
    this.open = null;
    $('card').hidden = true;
    for (const b of this.buttons.values()) b.classList.remove('pinned');
  }

  /** Moves each label to where its anchor is on screen. `project` maps the tissue plane to CSS pixels. */
  update(game: Game, project: (x: number, y: number) => { x: number; y: number } | null): void {
    for (const card of CARDS) {
      const b = this.buttons.get(card.id)!;
      const mine = card.id === 'you' || card.id === 'pull';
      const a = mine && game.player < 0 ? null : card.anchor(game), p = this.shown && a ? project(a.x, a.y) : null;
      // "The pull" names the lines, which exist only while the visitor pulls; no microglia, no "You".
      b.hidden = !p || (card.id === 'pull' && !game.pulling) || (card.id === 'you' && game.player < 0);
      if (p) { b.style.left = `${p.x}px`; b.style.top = `${p.y}px`; }
    }
  }
}
