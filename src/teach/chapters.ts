// The journey's chapters: the paper's argument as shots, captions and hotspots on the 3D tissue.
// Numbers are from El-Daher et al. 2024 with their page, or measured on its figures (src/tissue/anatomy.ts).
// Sources and what is not sourced: outputs/design/2026-10-07_journey-architecture.md, section 4.

import type { Vec3 } from '../contracts';
import { firstMicroglia } from '../journey/hotspot';
import type { Chapter, Plane } from '../journey/types';
import { PIN, PIN_AXIS } from '../tissue/anatomy';
import { CARDS, PAPER } from './cards';
import { STATIONS, type ModelKind } from './stations';

/** What a panel says about the thing on screen. The journey's tissue is none of the paper's models yet. */
export const ON_SCREEN: Record<ModelKind, string> = {
  paper: 'On screen: the paper\'s own model.',
  fitted: 'On screen: a model fitted here to the paper\'s data.',
  illustrative: 'On screen: an elastic tissue of ours, not yet calibrated against the paper\'s data.',
};

const station = (fig: number) => STATIONS.find((s) => s.fig === fig)!;
/** A point of the pin's track, `d` µm in from the skin. */
const alongTrack = (d: number): Vec3 => [PIN.entry[0] + d * PIN_AXIS[0], PIN.entry[1] + d * PIN_AXIS[1], PIN.entry[2] + d * PIN_AXIS[2]];
/** The yaw from which the camera looks down the track, from the side the pin came in. */
const DOWN_TRACK = Math.atan2(-PIN.heading[0], -PIN.heading[2]);
/** Seen from there: the horizontal directions to the camera's right and away from it. */
const RIGHT: Vec3 = [Math.cos(DOWN_TRACK), 0, -Math.sin(DOWN_TRACK)], AWAY: Vec3 = [-Math.sin(DOWN_TRACK), 0, -Math.cos(DOWN_TRACK)];
const along = (d: Vec3, k: number): Vec3 => [k * d[0], k * d[1], k * d[2]];

/**
 * The first panel of Fig 1C (4 h after injury) lying flat beside the lobe, on its far side, at the
 * tissue's scale: its field is 215 × 203 µm by its 50 µm bar. It is turned to read upright from the
 * wound chapter's camera. Only the scale is claimed; it is not laid over the model.
 */
const FIG1C_4HPI: Plane = {
  src: 'figures/fig1c-neurons.jpg',
  centre: [230 * AWAY[0], 14, 230 * AWAY[2]],
  u: along(RIGHT, 107.5),
  v: along(AWAY, -101.5),
  crop: [0, 0, 190 / 592, 1],
};

const BAR_50 = { length: 50, label: '50 µm', note: 'real size' };

export const CHAPTERS: Chapter[] = [
  {
    id: 'larva', title: 'A larva, four days old',
    captions: [
      `A zebrafish larva, ${PAPER.ageDpf} days old, is a few millimetres long and transparent. That speck is one half of its optic tectum, the part of the brain that handles what it sees.`,
      'In the paper a wound is made there with a fine pin, and the brain is filmed as it heals.',
    ],
    shot: { centre: [0, 0, 0], extent: 3500, yaw: 0.5, pitch: 0.9 },
    flight: 1,
    show: { microglia: false },
    hotspots: [],
    scale: { length: 1000, label: '1 mm', note: 'real size' },
  },
  {
    id: 'tectum', title: 'One lobe of the tectum',
    captions: [
      'One lobe, about a fifth of a millimetre across. Each dot stands for the nucleus of one neuron, packed five to six micrometres apart as in the fish.',
      'The dark middle is the neuropil, where the neurons\' fibres run. Drag to turn the tissue; scroll or pinch to come closer.',
    ],
    shot: { centre: [0, 0, 0], extent: 300, yaw: 0.2, pitch: 0.9 },
    flight: 5,
    show: { microglia: false },
    hotspots: [],
    stop: 'orbit',
    scale: BAR_50,
  },
  {
    id: 'wound', fig: 1, title: 'The wound',
    captions: [
      `The pin is ${PIN.diameter} micrometres across and goes in at a shallow angle. This is the track it leaves.`,
      `In a living larva the wound is shut ${PAPER.closedBetweenHpi[0]} to ${PAPER.closedBetweenHpi[1]} hours later. Nothing new fills it: the neurons already there are moved, all together.`,
      'Beside it lies the real thing at the same scale: a living larva, four hours after the injury. Open the labels for what the paper measured.',
    ],
    shot: { centre: [105 * AWAY[0], 10, 105 * AWAY[2]], extent: 470, yaw: DOWN_TRACK, pitch: 0.85 },
    flight: 4,
    show: { microglia: false, micrograph: FIG1C_4HPI },
    hotspots: [
      {
        id: 'wound', label: 'The wound', colour: '#e8e6e1', at: alongTrack(45),
        panel: {
          title: station(1).title, numbers: station(1).numbers, text: station(1).finding, figure: station(1).figure,
          source: 'p. 2, Fig 1B and 1D', model: 'illustrative',
        },
      },
      {
        id: 'real', label: 'The real tissue', colour: '#a9e8bf', at: FIG1C_4HPI.centre,
        panel: {
          title: 'The same tissue, alive', numbers: '4 h after injury · the field is 215 × 203 µm',
          text: 'Every bright dot is the nucleus of a cell, made to glow by a fluorescent protein. The dark oval is the neuropil; the arrow in the paper\'s panel marks the wound. The picture lies here at the scale of the tissue beside it, and is not laid over it.',
          figure: CARDS.find((c) => c.id === 'neurons')!.figure,
          source: 'Fig 1C', model: 'illustrative',
        },
      },
    ],
    stop: 'orbit',
    scale: BAR_50,
  },
  {
    id: 'microglia', fig: 4, title: 'Who closes it',
    captions: [
      'What moves them? The paper\'s answer is the microglia, the brain\'s immune cells. They gather at the wound and pull on the tissue around them.',
      `Try it: add microglia and tighten their hold. In fish, the wound closed in ${PAPER.closedWildType[0]} of ${PAPER.closedWildType[1]} normal larvae, and in ${PAPER.closedWithoutMicroglia[0]} of ${PAPER.closedWithoutMicroglia[1]} that have no microglia.`,
      'This tissue is not yet calibrated against the paper. The paper\'s own simulation, and its other figures, are in the strip of figures.',
    ],
    shot: { centre: alongTrack(60), extent: 230, yaw: DOWN_TRACK + 0.5, pitch: 0.7 },
    flight: 3,
    show: { microglia: true },
    hotspots: [
      {
        id: 'microglia', label: 'A microglia', colour: '#ff5468', at: firstMicroglia,
        panel: {
          title: station(4).title, numbers: station(4).numbers, text: station(4).finding, figure: station(4).figure,
          source: 'p. 6, Fig 4C and 4D', model: 'illustrative',
          more: { label: 'Play the paper\'s own simulation', href: '#fig4' },
        },
      },
    ],
    stop: 'experiment',
    scale: BAR_50,
  },
];
