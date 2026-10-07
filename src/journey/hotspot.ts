// Where a hotspot is in the tissue right now.

import type { Vec3 } from '../contracts';
import type { Anchors, Hotspot } from './types';

export const where = (h: Hotspot, a: Anchors): Vec3 | null => (typeof h.at === 'function' ? h.at(a) : h.at);

/** Follows the first microglia, for as long as there is one. */
export const firstMicroglia = (a: Anchors): Vec3 | null => (a.microglia.length >= 3 ? [a.microglia[0], a.microglia[1], a.microglia[2]] : null);
