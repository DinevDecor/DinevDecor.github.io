import type {
  AgentId,
  Confidence,
  Domain,
  EventId,
  EvidenceId,
  HypothesisId,
  OutcomeId,
  PredictionId,
  Provenance,
  Timestamp,
} from "./common.js";
import type { EventSubjectRef } from "./Event.js";

/**
 * See docs/adr/0009 for the full state machine: `pending` is the only
 * non-terminal state; all others are terminal and reached exactly once.
 */
export type PredictionStatus = "pending" | "confirmed" | "falsified" | "inconclusive" | "expired" | "withdrawn";

export interface PredictionHorizon {
  readonly from: Timestamp;
  readonly to: Timestamp;
}

/**
 * A forward-looking, falsifiable claim about a future Event, produced by an
 * agent's model. Explicitly time-bounded (horizon) and resolved exclusively
 * through an Outcome (docs/adr/0007), never directly against an Event.
 */
export interface Prediction<TClaim = unknown> extends Provenance {
  readonly id: PredictionId;
  readonly producedByAgentId: AgentId;
  /** The domain this prediction was made within (docs/adr/0006). */
  readonly domain: Domain;
  readonly subject: EventSubjectRef;
  /** The Hypothesis this prediction operationalizes into a testable claim, if any. */
  readonly hypothesisId?: HypothesisId;
  /** Typed, domain-specific predicted outcome. */
  readonly claim: TClaim;
  readonly horizon: PredictionHorizon;
  readonly confidence: Confidence;
  readonly basis: readonly (EvidenceId | EventId | HypothesisId)[];
  readonly status: PredictionStatus;
  readonly createdAt: Timestamp;
  readonly resolvedAt?: Timestamp;
  readonly resolvingOutcomeId?: OutcomeId;
}
