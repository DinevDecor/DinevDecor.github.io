import type { TrustDimensions } from "@reality-observatory/ontology";

export interface DecayPolicy {
  /** Time for a trust contribution's influence to halve. */
  readonly halfLifeMs: number;
}

export interface WeightingPolicy {
  readonly dimensionWeights: TrustDimensions;
}

/**
 * Configuration contract for how the Trust Engine ages and weighs the
 * Evidence/Prediction history it consumes. Versioned independently from the
 * engine implementation itself — see docs/adr/0004.
 */
export interface TrustPolicy {
  readonly id: string;
  readonly version: string;
  readonly decay: DecayPolicy;
  readonly weighting: WeightingPolicy;
}
