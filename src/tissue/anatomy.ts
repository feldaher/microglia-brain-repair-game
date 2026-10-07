// The shape of the tissue: one lobe of the optic tectum of a 4-day-old zebrafish larva, with the
// track of the pin through it. Lengths are micrometres. y is up (dorsal), x runs from the midline
// outward, z from caudal to rostral.
//
// Where the numbers come from:
//  - Fig 1C of El-Daher et al. 2024 (h2a:GFP, intact larva, 50 µm scale bar, 3.0 px/µm on the
//    600 dpi page): the field is 215 × 203 µm; the neuropil is an oval of about 110 × 155 µm; the
//    cell-dense periventricular zone around it is 35 to 75 µm thick; nuclei are 5 to 6 µm apart.
//  - Methods, p. 15: the pin is 80 µm across with a bevelled tip, enters at 20 to 30° to the
//    horizontal and goes 200 µm deep.
// Assumed, with no measurement behind it: the thickness of the lobe (100 µm), how deep the neuropil
// reaches, the taper of the track, and that the skin is 6 µm thick.
// (outputs/design/2026-10-06_3d-tissue.md.)

import type { Vec3 } from '../contracts';
import type { Sdf } from '../soft/types';

export const Region = { Pvz: 0, Neuropil: 1, Skin: 2 } as const;
export type RegionId = (typeof Region)[keyof typeof Region];

export const TECTUM = {
  /** Half-axes of the lobe. */
  lobe: [105, 50, 100] as Vec3,
  /** Centre and half-axes of the neuropil, a lens on the outer, upper side of the lobe. */
  neuropilCentre: [38, 24, 8] as Vec3,
  neuropil: [55, 34, 78] as Vec3,
  skinThickness: 6,
  /** Centre-to-centre distance of neuron nuclei in the cell-dense zone. */
  nucleusSpacing: 5.5,
  /** Below this height, and inside this x, the lobe joins the rest of the brain and is held. */
  heldBelow: -36,
  heldInside: -96,
  /** Height of the horizontal section the measurements of Fig 1C are compared in. */
  sectionY: 14,
} as const;

/** The pin's track: a tapered channel from the skin down toward the cell-dense zone. */
export const PIN = {
  diameter: 80,
  /** Degrees below the horizontal. */
  angle: 25,
  depth: 200,
  /** Radius at the tip; the tip is bevelled, so the track narrows. */
  tipRadius: 16,
  /** Where the pin meets the skin, and the horizontal direction it travels in. */
  entry: [88, 30, 28] as Vec3,
  heading: [-0.82, 0, -0.57] as Vec3,
} as const;

const rad = (PIN.angle * Math.PI) / 180;
/** Unit vector along the track, downward. */
export const PIN_AXIS: Vec3 = [PIN.heading[0] * Math.cos(rad), -Math.sin(rad), PIN.heading[2] * Math.cos(rad)];
export const PIN_TIP: Vec3 = [PIN.entry[0] + PIN.depth * PIN_AXIS[0], PIN.entry[1] + PIN.depth * PIN_AXIS[1], PIN.entry[2] + PIN.depth * PIN_AXIS[2]];

/** Signed distance to an ellipsoid (a close approximation, exact on the surface). */
export function ellipsoid(c: Vec3, r: Vec3, x: number, y: number, z: number): number {
  const px = x - c[0], py = y - c[1], pz = z - c[2];
  const k0 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
  const k1 = Math.hypot(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2]));
  return k1 < 1e-12 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

/** How far along the pin's axis a point is (0 at the skin, 1 at the tip) and how far from the axis. */
export function alongPin(x: number, y: number, z: number): { t: number; radial: number } {
  const px = x - PIN.entry[0], py = y - PIN.entry[1], pz = z - PIN.entry[2];
  const s = px * PIN_AXIS[0] + py * PIN_AXIS[1] + pz * PIN_AXIS[2];
  const t = s / PIN.depth;
  return { t, radial: Math.hypot(px - s * PIN_AXIS[0], py - s * PIN_AXIS[1], pz - s * PIN_AXIS[2]) };
}

/** Radius of the track at a position along it. It starts a little outside the skin so the mouth is open. */
export function pinRadius(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return PIN.diameter / 2 + (PIN.tipRadius - PIN.diameter / 2) * u;
}

/** Signed distance to the track (negative inside it). */
export function pinSdf(x: number, y: number, z: number): number {
  const { t, radial } = alongPin(x, y, z);
  const u = Math.min(1, Math.max(-0.3, t));
  const beyond = (t - u) * PIN.depth;
  return Math.hypot(radial, beyond) - pinRadius(u);
}

export const lobeSdf: Sdf = (x, y, z) => ellipsoid([0, 0, 0], TECTUM.lobe, x, y, z);

/** The tissue: the lobe with the pin's track taken out (when `wounded`). */
export function tissueSdf(wounded: boolean): Sdf {
  return wounded ? (x, y, z) => Math.max(lobeSdf(x, y, z), -pinSdf(x, y, z)) : lobeSdf;
}

/** Which part of the tissue a point of the lobe is in. */
export function regionAt(x: number, y: number, z: number): RegionId {
  // The skin covers the upper, outer surface; underneath the lobe meets brain, not skin.
  if (lobeSdf(x, y, z) > -TECTUM.skinThickness && y > TECTUM.heldBelow + 16 && x > TECTUM.heldInside + 16) return Region.Skin;
  return ellipsoid(TECTUM.neuropilCentre, TECTUM.neuropil, x, y, z) < 0 ? Region.Neuropil : Region.Pvz;
}

/** Whether a point of the lobe is held: it is where the lobe joins the rest of the brain. */
export function isHeld(x: number, y: number, _z: number): boolean {
  return y < TECTUM.heldBelow || x < TECTUM.heldInside;
}
