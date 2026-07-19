import type { AgentId, Confidence, EventId, EvidenceId, Provenance, Timestamp } from "./common.js";

export interface EventSubjectRef {
  /** Domain-defined subject taxonomy, e.g. "site.location", "market.instrument". */
  readonly type: string;
  readonly id: string;
}

/**
 * A discrete, timestamped occurrence in the domain model — the fact the rest
 * of the system reasons about. Produced by correlating one or more Evidence.
 * Bi-temporal: distinguishes real-world time from system-recording time.
 */
export interface Event<TPayload = unknown> extends Provenance {
  readonly id: EventId;
  /** Namespaced event type, e.g. "reality.anomaly.detected". */
  readonly type: string;
  readonly subject: EventSubjectRef;
  /** Real-world time the occurrence happened. */
  readonly occurredAt: Timestamp;
  /** System time the occurrence was recorded. */
  readonly recordedAt: Timestamp;
  readonly evidenceRefs: readonly EvidenceId[];
  readonly causedByEventIds?: readonly EventId[];
  readonly confidence: Confidence;
  readonly payload: TPayload;
  readonly detectedByAgentId: AgentId;
}
