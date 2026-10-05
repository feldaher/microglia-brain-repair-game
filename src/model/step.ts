// One mechanics step of the model, as PhysiCell 1.7.1 and the paper's custom module run it
// (outputs/design/2026-10-05_architecture.md, section 3):
//   v_i = Σ_j [√(c_r,i c_r,j)(1 − d/R)² − √(c_a,i c_a,j)(1 − d/S)²] (r_i − r_j)/d  + motility_i
//         + k Σ_{j attached to i} (r_j − r_i)
//   r_i += dt (1.5 v_i − 0.5 v_i,previous)

import { Kind, type ModelParams, type StepOptions, type Tissue } from '../contracts';

export function step(t: Tissue, p: ModelParams, rand: () => number, opts: StepOptions = {}): void {
  const { n, pos, kind, movable, pulling, motility } = t;
  const input = opts.input;
  if (input) pulling[input.agent] = input.pulling ? 1 : 0;
  const vel = new Float64Array(3 * n);

  // Repulsion and adhesion between cells closer than the adhesion range. All radii are equal.
  const R = 2 * p.radius, S = p.adhesionDistance * R;
  const grid = new Map<number, number[]>();
  const cellOf = (x: number) => Math.floor(x / S);
  // Exact key for grid cells within ±512 of the origin (the tissue spans a few tens).
  const key = (a: number, b: number, c: number) => ((a + 512) * 1024 + (b + 512)) * 1024 + (c + 512);
  for (let i = 0; i < n; i++) {
    const k = key(cellOf(pos[3 * i]), cellOf(pos[3 * i + 1]), cellOf(pos[3 * i + 2]));
    const list = grid.get(k);
    if (list) list.push(i); else grid.set(k, [i]);
  }
  for (let i = 0; i < n; i++) {
    if (!movable[i]) continue;
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    const ki = p.kinds[kind[i]];
    const a = cellOf(x), b = cellOf(y), c = cellOf(z);
    for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (let dc = -1; dc <= 1; dc++) {
      const list = grid.get(key(a + da, b + db, c + dc));
      if (!list) continue;
      for (const j of list) {
        if (j === i) continue;
        const dx = x - pos[3 * j], dy = y - pos[3 * j + 1], dz = z - pos[3 * j + 2];
        const d = Math.max(Math.hypot(dx, dy, dz), 1e-5);
        if (d >= S) continue;
        const kj = p.kinds[kind[j]];
        let f = d < R ? Math.sqrt(ki.repulsion * kj.repulsion) * (1 - d / R) ** 2 : 0;
        f -= Math.sqrt(ki.adhesion * kj.adhesion) * (1 - d / S) ** 2;
        f /= d;
        vel[3 * i] += f * dx; vel[3 * i + 1] += f * dy; vel[3 * i + 2] += f * dz;
      }
    }
  }

  // Motility: with probability dt/persistence the cell picks a new uniformly random direction.
  for (let i = 0; i < n; i++) {
    const ki = p.kinds[kind[i]];
    if (!ki.motile || !movable[i]) continue;
    if (rand() < p.dt / ki.persistence || ki.persistence < p.dt) {
      const theta = 2 * Math.PI * rand(), phi = Math.PI * rand();
      motility[3 * i] = ki.speed * Math.cos(theta) * Math.sin(phi);
      motility[3 * i + 1] = ki.speed * Math.sin(theta) * Math.sin(phi);
      motility[3 * i + 2] = ki.speed * Math.cos(phi);
    }
    if (input && input.agent === i && input.heading) {
      for (let c = 0; c < 3; c++) motility[3 * i + c] = ki.speed * input.heading[c];
    }
    for (let c = 0; c < 3; c++) vel[3 * i + c] += motility[3 * i + c];
  }

  // Elastic traction. A pulling microglia is attached to every other cell, at any distance.
  // The sum over a set of cells is (sum of their positions) − (their number) × r_i.
  const k = p.elastic * (opts.tractionScale ?? 1);
  const all = [0, 0, 0], pull = [0, 0, 0];
  let nPull = 0;
  for (let i = 0; i < n; i++) {
    const mine = kind[i] === Kind.Microglia && pulling[i];
    for (let c = 0; c < 3; c++) {
      all[c] += pos[3 * i + c];
      if (mine) pull[c] += pos[3 * i + c];
    }
    if (mine) nPull++;
  }
  for (let i = 0; i < n; i++) {
    if (kind[i] === Kind.Skin || !movable[i]) continue;
    const mine = kind[i] === Kind.Microglia && pulling[i];
    for (let c = 0; c < 3; c++) {
      const r = pos[3 * i + c];
      vel[3 * i + c] += k * (mine ? all[c] - n * r : pull[c] - nPull * r);
    }
  }

  // Adams–Bashforth position update.
  for (let i = 0; i < n; i++) {
    if (!movable[i]) continue;
    if (p.twoD) vel[3 * i + 2] = 0;
    for (let c = 0; c < 3; c++) {
      pos[3 * i + c] += p.dt * (1.5 * vel[3 * i + c] - 0.5 * t.prevVel[3 * i + c]);
      t.prevVel[3 * i + c] = vel[3 * i + c];
    }
  }
  t.time += p.dt;
}
