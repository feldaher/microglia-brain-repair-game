// Building a tissue: agents from a list, and hexagonal packing inside an outline.

import { Kind, type Region, type Seed, type Tissue } from '../contracts';

/** Centre-to-centre spacing of the packing, µm: 1.2 × 2 × 8 (Img2cells_2D.py in the paper's repository). */
export const HEX_SPACING = 1.2 * 2 * 8;

export function createTissue(seeds: Seed[]): Tissue {
  const n = seeds.length;
  const t: Tissue = {
    n,
    pos: new Float64Array(3 * n),
    prevVel: new Float64Array(3 * n),
    motility: new Float64Array(3 * n),
    kind: new Uint8Array(n),
    movable: new Uint8Array(n),
    pulling: new Uint8Array(n),
    time: 0,
  };
  seeds.forEach((s, i) => {
    t.pos[3 * i] = s.x;
    t.pos[3 * i + 1] = s.y;
    t.pos[3 * i + 2] = s.z ?? 0;
    t.kind[i] = s.kind;
    t.movable[i] = s.movable === false ? 0 : 1;
    // In the source every microglia is attached to every other cell from the start.
    t.pulling[i] = s.kind === Kind.Microglia ? 1 : 0;
  });
  return t;
}

/** Lattice points inside `inside`, row by row; every other row is shifted by half a spacing. */
export function hexPack(inside: (x: number, y: number) => boolean, bounds: Region, spacing = HEX_SPACING): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const dy = (spacing * Math.sqrt(3)) / 2;
  for (let row = 0, y = bounds.y0; y <= bounds.y1; row++, y = bounds.y0 + row * dy) {
    const shift = row % 2 ? 0.5 * spacing : 0;
    for (let col = 0, x = bounds.x0 + shift; x <= bounds.x1; col++, x = bounds.x0 + shift + col * spacing) {
      if (inside(x, y)) out.push({ x, y });
    }
  }
  return out;
}
