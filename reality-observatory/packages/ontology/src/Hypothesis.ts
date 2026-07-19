import type { AgentId, Confidence, Domain, EvidenceId, HypothesisId, Provenance, Timestamp } from "./common.js";

export type HypothesisStatus = "proposed" | "corroborated" | "refuted" | "retired";

/**
 * A falsifiable candidate explanation an agent proposes, tying together
 * Evidence into a coherent story before it is trusted enough to justify a
 * formal Event or Prediction. See docs/adr/0006.
 */
export interface Hypothesis extends Provenance {
  readonly id: HypothesisId;
  readonly domain: Domain;
  readonly statement: string;
  readonly proposedByAgentId: AgentId;
  readonly status: HypothesisStatus;
  readonly supportingEvidence: readonly EvidenceId[];
  readonly conflictingEvidence: readonly EvidenceId[];
  readonly confidence: Confidence;
  readonly proposedAt: Timestamp;
  readonly updatedAt: Timestamp;
}
