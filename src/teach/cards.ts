// The label cards: what each part of the scene is, in the paper's numbers, beside a panel of
// one of the paper's figures. Everything quoted is from El-Daher et al. 2024 (CC BY 4.0).

import { Kind } from '../contracts';
import type { Game } from '../app/game';
import { FIG4A, WOUND } from '../model/fig4a';

/** The measurements the cards quote, with the page of the paper each is on. */
export const PAPER = {
  /** Hours post-injury between which the wound is closed, n = 11 larvae (p. 2, Fig 1D). */
  closedBetweenHpi: [18, 22],
  /** Age of the larvae at injury, days post-fertilisation (p. 2). */
  ageDpf: 4,
  /** Microglia are recruited from 2 hpi and fully gathered by 6 hpi (p. 4–6, Fig 3G, 3I). */
  arriveHpi: 2,
  gatheredHpi: 6,
  /** Sense–adhere–traction events per hour per hemi-tectum; 54 events in 43 cells (p. 8). */
  pullsPerHour: 20,
  /** Recoil of a severed microglial process in the first 3 s, µm/s, and its speed afterwards (p. 8). */
  recoilUmPerS: 0.89,
  migrationUmPerS: 0.18,
  /** Fish with a closed wound (repair index > 0.5) at 24 hpi (p. 6). */
  closedWildType: [16, 21],
  closedWithoutMicroglia: [2, 17],
} as const;

export interface Figure {
  /** Path under the site root. */
  src: string;
  /** Which figure of the paper the panel is from, e.g. "Fig 3G". */
  panel: string;
  caption: string;
}

export interface Card {
  id: 'you' | 'neurons' | 'wound' | 'neuropil' | 'pull' | 'skin';
  /** Text on the label. */
  label: string;
  name: string;
  /** A line of numbers under the name. */
  size: string;
  blurb: string;
  figure: Figure;
  /** Colour of the label's dot, as in the key. */
  colour: string;
  /** Where the label sits, in the tissue plane (µm). */
  anchor(game: Game): { x: number; y: number };
}

export const CREDIT = 'El-Daher et al. 2024, Life Science Alliance 8:e202403052, CC BY 4.0';
export const PAPER_URL = 'https://doi.org/10.26508/lsa.202403052';

/** Index of the cell of a kind that starts nearest a point; the layout is the same in every run. */
function nearest(kind: number, x: number, y: number): number {
  const cells = kind === Kind.Neuron ? FIG4A.neurons : FIG4A.skin;
  const offset = kind === Kind.Neuron ? 0 : FIG4A.neurons.length;
  let best = 0, bestD = Infinity;
  cells.forEach((c, i) => { const d = Math.hypot(c.x - x, c.y - y); if (d < bestD) { bestD = d; best = i; } });
  return offset + best;
}
const NEURON = nearest(Kind.Neuron, -400, 150), SKIN = nearest(Kind.Skin, 330, 230);
const at = (game: Game, i: number) => ({ x: game.tissue.pos[3 * i], y: game.tissue.pos[3 * i + 1] });

export const CARDS: Card[] = [
  {
    id: 'you', label: 'You', name: 'You, a microglia', colour: '#e0a52c',
    size: `at the wound from ${PAPER.arriveHpi} h · gathered by ${PAPER.gatheredHpi} h`,
    blurb: 'Microglia are the immune cells that live in the brain. They are the first to reach an injury, and in a larva this young they are the only immune cells there. They eat debris, and this paper shows that they also pull.',
    figure: { src: 'figures/fig3g-microglia-arrive.jpg', panel: 'Fig 3G', caption: 'Microglia (green) gather over the wound between 2 and 12 hours after injury. Neurons are red. Scale bar 50 µm.' },
    anchor: (g) => at(g, g.player),
  },
  {
    id: 'neurons', label: 'Neurons', name: 'Neurons', colour: '#d98a72',
    size: `${FIG4A.neurons.length} cell bodies in this slice`,
    blurb: 'The packed cell bodies of the optic tectum, the part of the fish brain that handles vision. No new neurons are born to fill the wound and none crawl into it. The whole tissue is dragged, each neuron keeping its neighbours.',
    figure: { src: 'figures/fig1c-neurons.jpg', panel: 'Fig 1C', caption: 'Cell nuclei in a living larva 4 and 22 hours after injury (arrow: the wound), and an uninjured brain. Scale bar 50 µm.' },
    anchor: (g) => at(g, NEURON),
  },
  {
    id: 'wound', label: 'The wound', name: 'The wound', colour: '#1d1b19',
    size: `closed between ${PAPER.closedBetweenHpi[0]} and ${PAPER.closedBetweenHpi[1]} h after injury`,
    blurb: `Made with an insect pin pushed into the optic tectum of a ${PAPER.ageDpf}-day-old zebrafish larva. A mammal's brain repairs such damage very poorly. In the larva the wound is shut within a day, and the brain is fully repaired in a few days.`,
    figure: { src: 'figures/fig1b-wound-closing.jpg', panel: 'Fig 1B', caption: 'One wound (arrow) filmed in a living larva from 4 to 18 hours after injury. Scale bar 50 µm.' },
    anchor: () => ({ x: (WOUND.x0 + WOUND.x1) / 2, y: (WOUND.y0 + WOUND.y1) / 2 }),
  },
  {
    id: 'neuropil', label: 'Neuropil', name: 'The neuropil', colour: '#9cc4bd',
    size: 'nerve fibres and astrocytic processes, no cell bodies',
    blurb: 'The space the neurons wrap around. It looks empty here because the model leaves out what fills it: nerve fibres and a fine mesh of astrocytic processes that runs on between the neurons. The microglia gather in it, over the wound.',
    figure: { src: 'figures/fig2a-astrocytes.jpg', panel: 'Fig 2A', caption: 'The astrocytic processes of the same region, made fluorescent in a living larva. Scale bar 50 µm.' },
    anchor: () => ({ x: 60, y: -40 }),
  },
  {
    id: 'pull', label: 'The pull', name: 'The pull', colour: '#2f8f80',
    size: `≈ ${PAPER.pullsPerHour} pulls per hour · recoil ${PAPER.recoilUmPerS} µm/s when cut`,
    blurb: `A microglia reaches out, sticks to an astrocytic process and draws it in. Cut the contact with a laser and the microglial process snaps back five times faster than it crawls: it was under tension. The lines stand for that tension, passed on through the mesh.`,
    figure: { src: 'figures/fig5a-traction.jpg', panel: 'Fig 5A', caption: 'Two minutes in a living larva: a microglia (red) sticks to an astrocytic process (green, arrowhead) and pulls it along.' },
    anchor: (g) => { const a = at(g, g.player), b = at(g, NEURON); return { x: a.x + 0.4 * (b.x - a.x), y: a.y + 0.4 * (b.y - a.y) }; },
  },
  {
    id: 'skin', label: 'Skin', name: 'The skin', colour: '#8d8478',
    size: `${FIG4A.skin.length} cells in this slice`,
    blurb: 'The outer edge of the head. In the model it is the one thing that does not give: microglia are tied to it as they are to the neurons, but only the neurons move. That tie holds the microglia out in the neuropil, where they gather in real fish, and the wound closes further for it.',
    figure: { src: 'figures/figs3-skin.jpg', panel: 'Fig S3', caption: 'The skin outline (red) drawn over a tectum in a living larva, as used to measure where microglia gather.' },
    anchor: (g) => at(g, SKIN),
  },
];
