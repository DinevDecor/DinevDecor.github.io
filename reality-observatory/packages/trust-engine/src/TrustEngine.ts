import type { Evidence, Prediction, Timestamp, Trust, TrustSubjectRef } from "@reality-observatory/ontology";
import type { Subscription } from "@reality-observatory/event-bus";

export interface TrustHistoryRange {
  readonly from: Timestamp;
  readonly to: Timestamp;
}

export type TrustChangeHandler = (trust: Trust) => Promise<void>;

/**
 * Read-only view of Trust, offered synchronously (in addition to trust.*
 * bus events) so agents can make weighting decisions without waiting on
 * bus latency. This is the interface agents receive via AgentContext.trust.
 */
export interface TrustEngineReader {
  getTrust(subject: TrustSubjectRef): Promise<Trust | undefined>;
  getTrustHistory(subject: TrustSubjectRef, range: TrustHistoryRange): Promise<readonly Trust[]>;
  subscribeToTrustChanges(subject: TrustSubjectRef, handler: TrustChangeHandler): Promise<Subscription>;
}

/**
 * Write path into the Trust Engine. Not exposed to ordinary agents — only the
 * Trust Engine's own ingestion path consumes Evidence/Prediction resolutions
 * from the bus. Agents never call these directly (see docs/adr/0004).
 */
export interface TrustEngineWriter {
  submitEvidence(evidence: Evidence): Promise<void>;
  submitPredictionResolution(prediction: Prediction): Promise<void>;
}

/**
 * The Trust Engine is core infrastructure, not a pluggable agent: it is the
 * sole producer of Trust facts in the system (docs/adr/0004).
 */
export interface TrustEngine extends TrustEngineReader, TrustEngineWriter {}
