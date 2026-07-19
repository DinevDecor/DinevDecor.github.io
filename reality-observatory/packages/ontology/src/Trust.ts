import type {
  AgentId,
  Confidence,
  Domain,
  EvidenceId,
  PredictionId,
  Provenance,
  SensorId,
  Timestamp,
  TrustId,
} from "./common.js";

export type TrustSubjectRef =
  | { readonly type: "sensor"; readonly id: SensorId }
  | { readonly type: "agent"; readonly id: AgentId };

export interface TrustDimensions {
  readonly accuracy?: number;
  readonly timeliness?: number;
  readonly consistency?: number;
  readonly [dimension: string]: number | undefined;
}

export type TrustBasisRef =
  | { readonly type: "evidence"; readonly id: EvidenceId }
  | { readonly type: "prediction"; readonly id: PredictionId };

/**
 * An evolving trust score attached to a (Sensor | Agent, Domain) pair,
 * computed exclusively by the Trust Engine (see docs/adr/0004, docs/adr/0008)
 * from the history of Evidence and resolved Predictions attributable to that
 * subject within that domain. Output of the system, never a self-declared
 * input. Use `GLOBAL_DOMAIN` for the aggregate/rollup view across domains.
 */
export interface Trust extends Provenance {
  readonly id: TrustId;
  readonly subject: TrustSubjectRef;
  readonly domain: Domain;
  readonly score: Confidence;
  readonly dimensions?: TrustDimensions;
  readonly basis: readonly TrustBasisRef[];
  readonly computedAt: Timestamp;
  readonly computedByEngineVersion: string;
}
