// A small line chart in SVG: the model's curve against the one measured in fish.
// Lines are 2 px, the grid is faint, each line is named at its end and in the legend,
// and hovering shows the values under a crosshair.

export interface Series {
  name: string;
  /** Colour of the mark; text never takes it. */
  colour: string;
  points: [number, number][];
  /** A second thing measured on the same source is told apart by a dashed line, not another hue. */
  dashed?: boolean;
}

export interface PlotSpec {
  title: string;
  x: [number, number];
  y: [number, number];
  xTicks: number[];
  yTicks: number[];
  xUnit: string;
  /** How a y value is written in the tooltip and on the axis. */
  format: (v: number) => string;
  series: Series[];
  /** A vertical line at this x: where the playhead is. */
  cursor?: number;
}

const W = 380, H = 176, L = 34, R = 12, B = 24;

/** The y of a series at x, interpolated between its points; null outside its range. */
export function valueAt(points: [number, number][], x: number): number | null {
  if (!points.length || x < points[0][0] || x > points[points.length - 1][0]) return null;
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      return x1 === x0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

export class LinePlot {
  private spec: PlotSpec | null = null;
  private hover: number | null = null;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointermove', (e) => {
      if (!this.spec) return;
      const box = el.getBoundingClientRect(), s = this.spec;
      const x = s.x[0] + (((e.clientX - box.left) / box.width) * W - L) / (W - L - R) * (s.x[1] - s.x[0]);
      this.hover = Math.min(s.x[1], Math.max(s.x[0], x));
      this.render();
    });
    el.addEventListener('pointerleave', () => { this.hover = null; this.render(); });
  }

  draw(spec: PlotSpec): void { this.spec = spec; this.render(); }

  private render(): void {
    const s = this.spec!;
    // The legend wraps onto as many rows as it needs, and the plot starts below it.
    const keys: { q: Series; x: number; row: number }[] = [];
    let lx = 0, row = 0;
    for (const q of s.series) {
      const w = 28 + q.name.length * 5.4;
      if (lx > 0 && lx + w > W) { lx = 0; row++; }
      keys.push({ q, x: lx, row });
      lx += w;
    }
    const T = 32 + 13 * row + 8;
    const X = (v: number) => L + ((v - s.x[0]) / (s.x[1] - s.x[0])) * (W - L - R);
    const Y = (v: number) => H - B - ((v - s.y[0]) / (s.y[1] - s.y[0])) * (H - T - B);
    const clampY = (v: number) => Math.min(s.y[1], Math.max(s.y[0], v));
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${s.title}: ${s.series.map((q) => q.name).join(' and ')}">`;
    svg += `<text class="p-title" x="0" y="11">${s.title}</text>`;
    // Legend: a short stroke of the mark's colour beside its name, in text colour.
    for (const { q, x, row: r } of keys) {
      const y = 23 + 13 * r;
      svg += `<line x1="${x}" x2="${x + 16}" y1="${y}" y2="${y}" stroke="${q.colour}" stroke-width="2"${q.dashed ? ' stroke-dasharray="4 3"' : ''}/><text class="p-key" x="${x + 20}" y="${y + 3}">${q.name}</text>`;
    }
    for (const t of s.yTicks) svg += `<line class="p-grid" x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}"/><text class="p-tick" x="${L - 5}" y="${Y(t) + 3}" text-anchor="end">${s.format(t)}</text>`;
    for (const t of s.xTicks) svg += `<text class="p-tick" x="${X(t)}" y="${H - 8}" text-anchor="middle">${t}${t === s.xTicks[s.xTicks.length - 1] ? ' ' + s.xUnit : ''}</text>`;
    if (s.cursor !== undefined) svg += `<line class="p-cursor" x1="${X(s.cursor)}" x2="${X(s.cursor)}" y1="${T}" y2="${H - B}"/>`;
    for (const q of s.series) {
      if (q.points.length < 2) continue;
      svg += `<polyline fill="none" stroke="${q.colour}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${q.dashed ? ' stroke-dasharray="5 4"' : ''} points="${q.points.map(([x, y]) => `${X(x).toFixed(1)},${Y(clampY(y)).toFixed(1)}`).join(' ')}"/>`;
    }
    if (this.hover !== null) {
      const hx = X(this.hover);
      svg += `<line class="p-cross" x1="${hx}" x2="${hx}" y1="${T}" y2="${H - B}"/>`;
      const rows = s.series.map((q) => ({ q, v: valueAt(q.points, this.hover!) })).filter((r) => r.v !== null);
      rows.forEach(({ q, v }) => { svg += `<circle cx="${hx}" cy="${Y(clampY(v!))}" r="4" fill="${q.colour}" stroke="var(--bg)" stroke-width="2"/>`; });
      const left = hx > W / 2, tx = left ? hx - 8 : hx + 8, w = 132, h = 16 + 13 * rows.length;
      svg += `<rect class="p-tip" x="${left ? tx - w : tx}" y="${T + 2}" width="${w}" height="${h}" rx="2"/>`;
      svg += `<text class="p-tiphead" x="${(left ? tx - w : tx) + 6}" y="${T + 14}">${this.hover.toFixed(1)} ${s.xUnit}</text>`;
      rows.forEach(({ q, v }, i) => {
        const y = T + 27 + 13 * i, x0 = (left ? tx - w : tx) + 6;
        svg += `<line x1="${x0}" x2="${x0 + 10}" y1="${y - 3}" y2="${y - 3}" stroke="${q.colour}" stroke-width="2"${q.dashed ? ' stroke-dasharray="3 2"' : ''}/><text class="p-tiprow" x="${x0 + 14}" y="${y}">${q.name}: ${s.format(v!)}</text>`;
      });
    }
    svg += '</svg>';
    // The same numbers as a table, for readers who cannot see the chart.
    let table = `<table class="sr-only"><caption>${s.title}</caption><tr><th>${s.xUnit}</th>${s.series.map((q) => `<th>${q.name}</th>`).join('')}</tr>`;
    for (const t of s.xTicks) table += `<tr><td>${t}</td>${s.series.map((q) => { const v = valueAt(q.points, t); return `<td>${v === null ? '' : s.format(v)}</td>`; }).join('')}</tr>`;
    this.el.innerHTML = svg + table + '</table>';
  }
}
