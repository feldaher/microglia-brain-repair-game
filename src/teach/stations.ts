// The seven stations, one per main figure of El-Daher et al. 2024, and the fish of the Fig 4 station.

import { FIG4A } from '../model/fig4a';
import { PAPER, type Figure } from './cards';

/** What stands behind a station's model (outputs/design/2026-10-05_figure-by-figure.md, section 2). */
export type ModelKind = 'paper' | 'fitted' | 'illustrative';
export const MODEL_KIND: Record<ModelKind, string> = {
  paper: 'The paper\'s own model',
  fitted: 'A standard model, fitted here to the paper\'s data',
  illustrative: 'An illustrative model: the paper has none for this',
};

export interface Station {
  fig: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  /** A line of numbers under the title. */
  numbers: string;
  finding: string;
  figure: Figure;
  model: ModelKind;
  /** Whether the visitor can do the experiment yet. */
  built: boolean;
}

export const STATIONS: Station[] = [
  {
    fig: 1, title: 'The wound closes in a day', model: 'paper', built: false,
    numbers: `closed ${PAPER.closedBetweenHpi[0]}–${PAPER.closedBetweenHpi[1]} h after injury · 11 larvae`,
    finding: 'A pin wound through the brain of a zebrafish larva is shut within a day. No new cells fill it. The neurons that were already there are moved, all together and in straight lines.',
    figure: { src: 'figures/fig1b-wound-closing.jpg', panel: 'Fig 1B', caption: 'One wound (arrow) filmed in a living larva from 4 to 18 hours after injury. Scale bar 50 µm.' },
  },
  {
    fig: 2, title: 'The tissue is pulled shut', model: 'fitted', built: false,
    numbers: 'blebbistatin: 9 control and 12 treated fish',
    finding: 'The tissue changes shape as the wound closes, and the closing follows the curve of a spring pulling through a thick fluid. Blebbistatin, a drug that stops cells from contracting, leaves the wound open.',
    figure: { src: 'figures/fig2g-spring.jpg', panel: 'Fig 2F, G', caption: 'A neuron on a spring in a viscous medium, and the closing of one wound (dots) fitted by that model (red).' },
  },
  {
    fig: 3, title: 'Microglia get there first', model: 'paper', built: false,
    numbers: `at the wound from ${PAPER.arriveHpi} h · gathered by ${PAPER.gatheredHpi} h · 308 cells mapped in 15 larvae`,
    finding: 'The neurons all move toward one spot, and that spot is where the microglia, the brain\'s immune cells, have gathered. They are all there six hours after the injury. Only then does the wound begin to close.',
    figure: { src: 'figures/fig3i-timing.jpg', panel: 'Fig 3I', caption: 'Microglia gathering at the wound (squares) and the wound closing (dots), against time after injury.' },
  },
  {
    fig: 4, title: 'No microglia, no closure', model: 'paper', built: true,
    numbers: `closed in ${PAPER.closedWildType[0]} of ${PAPER.closedWildType[1]} normal fish · ${PAPER.closedWithoutMicroglia[0]} of ${PAPER.closedWithoutMicroglia[1]} without microglia`,
    finding: 'In a computer model where microglia pull on everything around them, the wound closes, and the more microglia the further it closes. Fish that have no microglia are left with an open wound.',
    figure: { src: 'figures/fig4c-irf8.jpg', panel: 'Fig 4C', caption: 'Just after the injury and a day later, in a normal fish (left) and a mutant without microglia (right). Dashed lines mark the wound.' },
  },
  {
    fig: 5, title: 'One pull, close up', model: 'illustrative', built: false,
    numbers: `≈ ${PAPER.pullsPerHour} pulls an hour in each half of the tectum · 54 seen in 43 cells`,
    finding: 'A microglia throws out a thin arm, sticks it to a fibre of the mesh that astrocytes weave through the tissue, and hauls the fibre in. Then it does it again.',
    figure: { src: 'figures/fig5a-traction.jpg', panel: 'Fig 5A', caption: 'Two minutes in a living larva: a microglia (red) sticks to an astrocytic process (green, arrowhead) and pulls it along.' },
  },
  {
    fig: 6, title: 'Cut the rope', model: 'fitted', built: false,
    numbers: `recoil ${PAPER.recoilUmPerS} µm/s · crawling ${PAPER.migrationUmPerS} µm/s`,
    finding: 'Cut the contact between a microglia and a fibre with a laser, and the microglia\'s arm springs back five times faster than it crawls. It was stretched tight. The fibre it held relaxes slowly, over minutes.',
    figure: { src: 'figures/fig6e-laser-cut.jpg', panel: 'Fig 6E', caption: 'The experiment: the contact is cut, the microglia recoils within seconds, the astrocytic processes retract over minutes.' },
  },
  {
    fig: 7, title: 'Break the grip', model: 'paper', built: false,
    numbers: '92% of the cells making L-plastin at the wound are microglia',
    finding: 'Microglia that lack L-plastin, a protein that bundles the actin cables a cell pulls with, still gather at the wound in normal numbers. The wound does not close: they are there, but it is as if they could not pull.',
    figure: { src: 'figures/fig7-lcp1.jpg', panel: 'Fig 7C–E', caption: 'Control and lcp1-deficient fish at 4 and 24 hours; the number of microglia (unchanged) and the repair index (lower).' },
  },
];

export interface Fish {
  id: 'wild-type' | 'ki20227' | 'irf8';
  name: string;
  /** Microglia in the model tissue. */
  microglia: number;
  blurb: string;
}

const ALL = FIG4A.microglia.length;

export const FISH: Fish[] = [
  { id: 'wild-type', name: 'Wild type', microglia: ALL, blurb: `A normal larva: the ${ALL} microglia of the paper's simulation.` },
  // Fig 4H: about 35 microglia in control fish and about 12 in treated ones, read off the box plot.
  { id: 'ki20227', name: 'KI20227', microglia: Math.round(ALL / 3), blurb: 'Treated with KI20227, a drug that removes about two thirds of the microglia.' },
  { id: 'irf8', name: 'irf8 mutant', microglia: 0, blurb: 'A mutant that never makes microglia. There is no cell for you to be: watch.' },
];
