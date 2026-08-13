import type { AgentId, EventId, OutcomeId, PredictionId, Provenance, Timestamp } from "./common.js";

export type OutcomeVerdict = "confirmed" | "falsified" | "inconclusive";

export type OutcomeMethod = "automatic" | "human-reviewed";

/**
 * The authoritative resolution record for a Prediction — decouples "what a
 * Prediction claimed" from "what the system later observed" (Event) by
 * introducing an explicit, accountable verdict step. See docs/adr/0007.
 */
export interface Outcome extends Provenance {
  readonly id: OutcomeId;
  readonly predictionId: PredictionId;
  readonly verdict: OutcomeVerdict;
  readonly method: OutcomeMethod;
  readonly evidenceEventIds: readonly EventId[];
  readonly resolvedByAgentId: AgentId;
  readonly resolvedAt: Timestamp;
  readonly rationale?: string;
}
