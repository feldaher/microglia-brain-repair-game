// Measuring the wound.

import { Kind, type Region, type Tissue } from '../contracts';

/** Area of `region` (µm²) that no neuron body covers, sampled on a square grid of `sample` µm. */
export function openArea(t: Tissue, region: Region, radius: number, sample = 1): number {
  const nx = Math.round((region.x1 - region.x0) / sample), ny = Math.round((region.y1 - region.y0) / sample);
  const covered = new Uint8Array(nx * ny);
  const r2 = radius * radius;
  for (let i = 0; i < t.n; i++) {
    if (t.kind[i] !== Kind.Neuron) continue;
    const cx = t.pos[3 * i], cy = t.pos[3 * i + 1];
    const i0 = Math.max(0, Math.floor((cx - radius - region.x0) / sample)), i1 = Math.min(nx - 1, Math.ceil((cx + radius - region.x0) / sample));
    const j0 = Math.max(0, Math.floor((cy - radius - region.y0) / sample)), j1 = Math.min(ny - 1, Math.ceil((cy + radius - region.y0) / sample));
    for (let j = j0; j <= j1; j++) {
      const dy = region.y0 + (j + 0.5) * sample - cy;
      for (let k = i0; k <= i1; k++) {
        const dx = region.x0 + (k + 0.5) * sample - cx;
        if (dx * dx + dy * dy <= r2) covered[j * nx + k] = 1;
      }
    }
  }
  let open = 0;
  for (let k = 0; k < covered.length; k++) open += 1 - covered[k];
  return open * sample * sample;
}

/** Repair index, RI = 1 − V(end)/V(start) (Fig 4 legend of the paper: end 24 hpi, start 4 hpi). */
export function repairIndex(vStart: number, vEnd: number): number {
  return 1 - vEnd / vStart;
}
