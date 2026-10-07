// The soft body the tissue is made of. Units are whatever the caller uses for length (µm here);
// density is 1 per unit volume.

/** A signed distance: negative inside the body. */
export type Sdf = (x: number, y: number, z: number) => number;

/** Tetrahedral simulation mesh. Arrays are flat xyz / 4-index. */
export interface SoftMesh {
  restPos: Float32Array;
  pos: Float32Array;
  prevPos: Float32Array;
  vel: Float32Array;
  /** 0 for a particle that is held in place. */
  invMass: Float32Array;
  tets: Uint32Array;
  /** Region of each tet, as given by the caller's material function. */
  tetMaterial: Uint8Array;
  /** Inverse rest edge matrix Dm⁻¹ per tet, 9 floats column-major. */
  restInv: Float32Array;
  restVol: Float32Array;
  /** Unique tet edges, 2 indices each (for damping). */
  edges: Uint32Array;
  /** Lattice spacing the mesh was built with. */
  spacing: number;
}
