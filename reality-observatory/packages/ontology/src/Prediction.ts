import type { AgentId, Confidence, EventId, EvidenceId, PredictionId, Provenance, Timestamp } from "./common.js";
import type { EventSubjectRef } from "./Event.js";

export type PredictionStatus = "pending" | "confirmed" | "falsified" | "expired" | "withdrawn";

export interface PredictionHorizon {
  readonly from: Timestamp;
  readonly to: Timestamp;
}

/**
 * A forward-looking, falsifiable claim about a future Event, produced by an
 * agent's model. Explicitly time-bounded (horizon) and resolved against a
 * later Event outcome.
 */
export interface Prediction<TClaim = unknown> extends Provenance {
  readonly id: PredictionId;
  readonly producedByAgentId: AgentId;
  readonly subject: EventSubjectRef;
  /** Typed, domain-specific predicted outcome. */
  readonly claim: TClaim;
  readonly horizon: PredictionHorizon;
  readonly confidence: Confidence;
  readonly basis: readonly (EvidenceId | EventId)[];
  readonly status: PredictionStatus;
  readonly createdAt: Timestamp;
  readonly resolvedAt?: Timestamp;
  readonly resolvingEventId?: EventId;
}
