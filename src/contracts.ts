// Shared shapes for every layer. This file is the contract: the model, the measurements,
// the renderer and the UI agree on these types and nothing else.
//
// Units: micrometres and minutes, as in the paper's model. Hours post-injury (hpi) only in the UI.
// The model is the multi-agent model of El-Daher et al. 2024 (Life Science Alliance 8:e202403052)
// as its source code runs it; see outputs/design/2026-10-05_architecture.md, section 3.
// The source also defines a `neuropil_cell` type; the published runs had none (François, 2026-10-05), so it is left out.

export type Vec3 = [number, number, number];

/** Agent types. The numeric values index `ModelParams.kinds`. */
export const Kind = {
  Neuron: 0,
  Microglia: 1,
  Skin: 2,
} as const;
export type KindId = (typeof Kind)[keyof typeof Kind];
export const KIND_COUNT = 3;

export interface KindParams {
  /** Whether the cell has a motility vector at all. */
  motile: boolean;
  /** Migration speed, µm/min. */
  speed: number;
  /** Mean time a direction is kept, min. */
  persistence: number;
  /** Cell–cell repulsion strength (PhysiCell default × the type's relative value). */
  repulsion: number;
  /** Cell–cell adhesion strength (PhysiCell default × the type's relative value). */
  adhesion: number;
}

export interface ModelParams {
  name: string;
  /** Where the values come from. */
  source: string;
  /** Cell radius, µm; the same for every type. */
  radius: number;
  /** Adhesion acts up to this multiple of the sum of the two radii. */
  adhesionDistance: number;
  kinds: [KindParams, KindParams, KindParams];
  /** Elastic coefficient k of the traction term, 1/min. */
  elastic: number;
  /** Mechanics time step, min. */
  dt: number;
  /** Length of a run, min. */
  duration: number;
  /** The published model is 2D: velocities along z are dropped. */
  twoD: boolean;
}

/** The state of the tissue. Arrays are flat: xyz per agent, or one entry per agent. */
export interface Tissue {
  n: number;
  pos: Float64Array;
  /** Velocity used in the last step (µm/min); the Adams–Bashforth update needs it. */
  prevVel: Float64Array;
  /** Current motility vector (µm/min). */
  motility: Float64Array;
  kind: Uint8Array;
  /** 0 for cells held in place (tissue edges). */
  movable: Uint8Array;
  /** Microglia only: 1 while the cell pulls, i.e. is attached to every other cell. */
  pulling: Uint8Array;
  /** Minutes since the start of the run. */
  time: number;
}

/** One agent as handed to `createTissue`. */
export interface Seed {
  x: number;
  y: number;
  z?: number;
  kind: KindId;
  movable?: boolean;
}

/** What the visitor does to the one microglia they steer. */
export interface PlayerInput {
  /** Index of the visitor's cell. */
  agent: number;
  /** Unit direction to move in; null leaves the model's random walk in charge. */
  heading: Vec3 | null;
  pulling: boolean;
}

export interface StepOptions {
  input?: PlayerInput;
  /** Multiplies the elastic coefficient (1 = the model as published). */
  tractionScale?: number;
}

/** An experimental condition, for the later acts. */
export interface Condition {
  microgliaCount: number;
  tractionScale: number;
}

/** Axis-aligned region in the plane of the tissue, µm. */
export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
