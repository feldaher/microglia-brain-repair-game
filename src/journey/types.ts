// The journey's contract: the paper told as chapters on one tissue. A chapter is data; the director
// plays it; the station draws it. Lengths are micrometres, angles radians, times seconds.
// Design: outputs/design/2026-10-07_journey-architecture.md.

import type { Vec3 } from '../contracts';
import type { Figure } from '../teach/cards';
import type { ModelKind } from '../teach/stations';

/**
 * What the camera frames, whatever the window: the point it looks at, the width of tissue that
 * fits the free part of the window, and the direction it is seen from (as `Camera` of the renderer).
 */
export interface Shot {
  centre: Vec3;
  extent: number;
  yaw: number;
  pitch: number;
}

/** What a hotspot opens: the paper's panel, its numbers, and where in the paper they are. */
export interface Panel {
  title: string;
  /** A line of numbers under the title. */
  numbers: string;
  text: string;
  figure: Figure;
  /** Page or figure of the paper the numbers are from, e.g. "p. 2, Fig 1D". */
  source: string;
  /** What stands behind the thing on screen. */
  model: ModelKind;
  /** Somewhere to go on from here, e.g. the paper's own simulation. */
  more?: { label: string; href: string };
}

/** The moving things a hotspot can ride on. */
export interface Anchors {
  /** Positions of the microglia, xyz each. */
  microglia: Float32Array;
}

export interface Hotspot {
  id: string;
  label: string;
  /** Colour of the label's dot. */
  colour: string;
  /** A fixed point of the tissue, or one that follows something; null while that thing is absent. */
  at: Vec3 | ((a: Anchors) => Vec3 | null);
  panel: Panel;
}

/** A flat picture in the scene: its centre, the two half-edges that span it, and the part of the image shown. */
export interface Plane {
  src: string;
  centre: Vec3;
  /** Half the width, along the image's u, and half the height, along its v (down the image). */
  u: Vec3;
  v: Vec3;
  /** Left, top, right, bottom of the part of the image shown, 0 to 1. */
  crop: [number, number, number, number];
}

export type Stop = 'orbit' | 'experiment';

export interface Chapter {
  id: string;
  /** The main figure of the paper the chapter is about, if any. */
  fig?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  /** Shown one at a time; each at most two sentences. */
  captions: string[];
  shot: Shot;
  /** Seconds the camera takes to reach the shot. */
  flight: number;
  show: { microglia: boolean; micrograph?: Plane };
  hotspots: Hotspot[];
  /** What the visitor may do on arrival; absent where the chapter is only watched. */
  stop?: Stop;
  scale: { length: number; label: string; note: string };
  /** A sound cue under public/, for when there is sound. */
  audio?: string;
}

/** Where the camera stands: the director's while flying or arrived, the visitor's once free. */
export type Phase = 'flying' | 'arrived' | 'free';

export interface DirectorState {
  /** Index of the chapter on screen, or being flown to. */
  index: number;
  /** Index of the caption shown. */
  line: number;
  phase: Phase;
  /** Progress of the flight, 0 to 1. */
  t: number;
}

/** The window as the framing needs it: its size and the margins the page's text takes, CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}
