// What every station is handed, and what a station is.

import type { Vec3 } from '../contracts';
import type { Game } from '../app/game';
import type { Point } from '../app/record';
import type { Viewport } from '../journey/types';
import type { Camera, Scene } from '../render/scene';
import type { Labels } from '../ui/labels';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface Stage {
  scene: Scene;
  cam: Camera;
  labels: Labels;
  /** The page colour, rgb 0–1. */
  ground: Vec3;
  /** True while a dialog is open and the tissue should hold still. */
  held(): boolean;
  /** How far the visitor has zoomed, before the fit to the window; 1 is the station's own framing. */
  zoom: number;
  /** The window and the margins the page's text takes in it, for the station on screen. */
  viewport(): Viewport;
}

export interface Station {
  fig: number;
  /** A name for the address bar and the panel's head, where the station is not a figure. */
  id?: string;
  /** Three short lines under the title. */
  tagline: string[];
  help: string;
  fine: string;
  /** The run on screen, for the labels; null where there are none. */
  game(): Game | null;
  /** What the camera frames: the width of the specimen (µm) and its centre in the scene. */
  extent: number;
  centre: Vec3;
  /** Length of the scale bar (µm) and what is written under it. */
  scale: { length: number; label: string; note: string };
  /** True where dragging turns the specimen instead of pointing at it. */
  orbit?: boolean;
  /** The visitor has put a hand on the camera (a drag, the wheel, a pinch). */
  grab?(): void;
  /** The margins this station's text takes in a window of this size, where they are not the usual ones. */
  margins?(width: number, height: number): Omit<Viewport, 'width' | 'height'>;
  enter(): void;
  leave(): void;
  /** Advances and draws one frame; `dt` and `now` are seconds. */
  frame(dt: number, now: number): void;
  /** A press or drag on the tissue plane, in model µm. */
  point(p: Point): void;
  key(e: KeyboardEvent): void;
}
