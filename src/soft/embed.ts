// Adapted from Jelly Cells (github.com/feldaher/jelly-cells, commit 27d95c2, src/mesh/surface.ts, the embedding part).
// Pinning points inside the tets of a soft body by barycentric weights, so they ride with it.

import type { SoftMesh } from './types';

/** Spatial lookup of tets by their rest bounding boxes. */
export class TetGrid {
  private cells: Map<number, number[]> = new Map();
  constructor(private sim: SoftMesh, private cell = sim.spacing) {
    const { restPos: p, tets } = sim;
    for (let t = 0; t < tets.length / 4; t++) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < 4; k++) for (let a = 0; a < 3; a++) {
        const x = p[3 * tets[4 * t + k] + a];
        lo[a] = Math.min(lo[a], x); hi[a] = Math.max(hi[a], x);
      }
      for (let i = this.q(lo[0]); i <= this.q(hi[0]); i++)
        for (let j = this.q(lo[1]); j <= this.q(hi[1]); j++)
          for (let k = this.q(lo[2]); k <= this.q(hi[2]); k++) {
            const key = this.key(i, j, k);
            const list = this.cells.get(key);
            if (list) list.push(t); else this.cells.set(key, [t]);
          }
    }
  }
  private q(x: number) { return Math.floor(x / this.cell); }
  private key(i: number, j: number, k: number) { return ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512); }

  /** Barycentric weights of a point in tet t (rest configuration). */
  bary(t: number, x: number, y: number, z: number, out: Float32Array | Float64Array, o = 0) {
    const { restPos: p, tets, restInv: M } = this.sim;
    const i0 = 3 * tets[4 * t];
    const dx = x - p[i0], dy = y - p[i0 + 1], dz = z - p[i0 + 2];
    const m = 9 * t;
    const l1 = M[m] * dx + M[m + 3] * dy + M[m + 6] * dz;
    const l2 = M[m + 1] * dx + M[m + 4] * dy + M[m + 7] * dz;
    const l3 = M[m + 2] * dx + M[m + 5] * dy + M[m + 8] * dz;
    out[o] = 1 - l1 - l2 - l3; out[o + 1] = l1; out[o + 2] = l2; out[o + 3] = l3;
  }

  /** The tet that best contains a point: the one maximising its smallest barycentric weight. */
  locate(x: number, y: number, z: number): { tet: number; minBary: number } {
    const b = new Float64Array(4);
    let best = -1, bestMin = -Infinity;
    const ci = this.q(x), cj = this.q(y), ck = this.q(z);
    for (let r = 0; r <= 4 && (best < 0 || (r <= 1 && bestMin < 0)); r++) {
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (let k = ck - r; k <= ck + r; k++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj), Math.abs(k - ck)) !== r) continue;
        const list = this.cells.get(this.key(i, j, k));
        if (!list) continue;
        for (const t of list) {
          this.bary(t, x, y, z, b);
          const mn = Math.min(b[0], b[1], b[2], b[3]);
          if (mn > bestMin) { bestMin = mn; best = t; }
        }
      }
    }
    return { tet: best, minBary: bestMin };
  }
}

/** Embeds points in a sim mesh. `minBary` < 0 means the point lies outside its tet. */
export function embedPoints(grid: TetGrid, pts: ArrayLike<number>) {
  const n = pts.length / 3;
  const tetId = new Uint32Array(n), bary = new Float32Array(n * 4), minBary = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const { tet, minBary: mb } = grid.locate(pts[3 * v], pts[3 * v + 1], pts[3 * v + 2]);
    tetId[v] = Math.max(0, tet);
    minBary[v] = tet < 0 ? -Infinity : mb;
    if (tet >= 0) grid.bary(tet, pts[3 * v], pts[3 * v + 1], pts[3 * v + 2], bary, 4 * v);
  }
  return { tetId, bary, minBary };
}

/** Writes the current position of each embedded point into `out` (xyz per point). */
export function moveEmbedded(sim: SoftMesh, tetId: Uint32Array, bary: Float32Array, out: Float32Array): void {
  const { pos, tets } = sim;
  for (let k = 0, n = tetId.length; k < n; k++) {
    let x = 0, y = 0, z = 0;
    for (let c = 0; c < 4; c++) {
      const i = 3 * tets[4 * tetId[k] + c], w = bary[4 * k + c];
      x += w * pos[i]; y += w * pos[i + 1]; z += w * pos[i + 2];
    }
    out[3 * k] = x; out[3 * k + 1] = y; out[3 * k + 2] = z;
  }
}
