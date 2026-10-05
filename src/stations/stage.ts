// What every station is handed, and what a station is.

import type { Vec3 } from '../contracts';
import type { Game } from '../app/game';
import type { Point } from '../app/record';
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
}

export interface Station {
  fig: number;
  /** Three short lines under the title. */
  tagline: string[];
  help: string;
  fine: string;
  /** The run on screen, for the labels. */
  game(): Game;
  enter(): void;
  leave(): void;
  /** Advances and draws one frame; `dt` and `now` are seconds. */
  frame(dt: number, now: number): void;
  /** A press or drag on the tissue plane, in model µm. */
  point(p: Point): void;
  key(e: KeyboardEvent): void;
}
