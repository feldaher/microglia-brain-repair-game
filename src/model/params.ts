// The model's constants, with where each comes from. They are those of the settings file in the
// paper's code repository, which produced Fig 4 (François, 2026-10-05; the port reproduces the
// 24 hpi panel of Fig 4A with them). Table 2 of the paper prints two different values:
// microglia speed 1 µm/min and elastic coefficient 5·10⁻⁷ min⁻¹.

import type { KindParams, ModelParams } from '../contracts';

/** PhysiCell 1.7.1 defaults (core/PhysiCell_phenotype.cpp: Geometry, Mechanics). */
export const PHYSICELL = {
  /** µm; the radius of the default 2494 µm³ cell. */
  radius: 8.412710547954228,
  repulsion: 10,
  adhesion: 0.4,
  /** relative_maximum_adhesion_distance */
  adhesionDistance: 1.25,
  /** mechanics_dt, min */
  dt: 0.1,
} as const;

/** Relative repulsion 5 for every type; relative adhesion 0.1 for neurons and 0 for the others. */
const REPULSION = PHYSICELL.repulsion * 5;
const skin: KindParams = { motile: false, speed: 0, persistence: 0, repulsion: REPULSION, adhesion: 0 };

/** github.com/feldaher/microglia @ 35cdbf1, PhysiCell_settings.xml. The run lasts 1200 min: 4 to 24 hpi. */
export const MODEL: ModelParams = {
  name: 'El-Daher et al. 2024',
  source: 'github.com/feldaher/microglia @ 35cdbf1, PhysiCell_settings.xml',
  radius: PHYSICELL.radius,
  adhesionDistance: PHYSICELL.adhesionDistance,
  kinds: [
    { motile: true, speed: 0.01, persistence: 10, repulsion: REPULSION, adhesion: PHYSICELL.adhesion * 0.1 },
    { motile: true, speed: 3, persistence: 10, repulsion: REPULSION, adhesion: 0 },
    skin,
  ],
  elastic: 9e-6,
  dt: PHYSICELL.dt,
  duration: 1200,
  twoD: true,
};
