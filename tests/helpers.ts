import { Kind, type ModelParams, type Seed, type Tissue } from '../src/contracts';
import { MODEL } from '../src/model/params';

/** The model with every random walk switched off, so a test sees one force at a time. */
export const QUIET: ModelParams = { ...MODEL, kinds: MODEL.kinds.map((k) => ({ ...k, motile: false })) as ModelParams['kinds'] };

export const neuron = (x: number, y = 0, movable = true): Seed => ({ x, y, kind: Kind.Neuron, movable });
export const microglia = (x: number, y = 0, movable = true): Seed => ({ x, y, kind: Kind.Microglia, movable });
export const skin = (x: number, y = 0): Seed => ({ x, y, kind: Kind.Skin });

/** Velocity the last step gave agent i (µm/min). */
export const vel = (t: Tissue, i: number): [number, number, number] => [t.prevVel[3 * i], t.prevVel[3 * i + 1], t.prevVel[3 * i + 2]];
export const at = (t: Tissue, i: number): [number, number, number] => [t.pos[3 * i], t.pos[3 * i + 1], t.pos[3 * i + 2]];
