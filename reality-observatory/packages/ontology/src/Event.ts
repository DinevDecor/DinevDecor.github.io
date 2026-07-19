import type { AgentId, Confidence, Domain, EventId, EvidenceId, Provenance, Timestamp } from "./common.js";

export interface EventSubjectRef {
  /** Subject taxonomy, e.g. "site.location", "market.instrument" — distinct from Domain. */
  readonly type: string;
  readonly id: string;
}

/**
 * A discrete, timestamped occurrence in the domain model — the fact the rest
 * of the system reasons about. Produced by correlating one or more Evidence
 * (see the Correlation Engine, docs/adr/0010). Bi-temporal: distinguishes
 * real-world time from system-recording time.
 */
export interface Event<TPayload = unknown> extends Provenance {
  readonly id: EventId;
  /** The domain this event was correlated within (docs/adr/0006). */
  readonly domain: Domain;
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
