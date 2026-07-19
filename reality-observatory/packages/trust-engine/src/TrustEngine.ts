import type { Domain, Evidence, Outcome, Timestamp, Trust, TrustSubjectRef } from "@reality-observatory/ontology";
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
 * Every query is explicitly domain-scoped (docs/adr/0008) — pass
 * `GLOBAL_DOMAIN` for the aggregate/rollup view.
 */
export interface TrustEngineReader {
  getTrust(subject: TrustSubjectRef, domain: Domain): Promise<Trust | undefined>;
  getTrustHistory(subject: TrustSubjectRef, domain: Domain, range: TrustHistoryRange): Promise<readonly Trust[]>;
  subscribeToTrustChanges(subject: TrustSubjectRef, domain: Domain, handler: TrustChangeHandler): Promise<Subscription>;
}

/**
 * Write path into the Trust Engine. Not exposed to ordinary agents — only the
 * Trust Engine's own ingestion path consumes Evidence and resolved-Prediction
 * Outcomes from the bus (see docs/adr/0004, docs/adr/0007). Agents never call
 * these directly.
 */
export interface TrustEngineWriter {
  submitEvidence(evidence: Evidence): Promise<void>;
  submitOutcome(outcome: Outcome): Promise<void>;
}

/**
 * The Trust Engine is core infrastructure, not a pluggable agent: it is the
 * sole producer of Trust facts in the system (docs/adr/0004, docs/adr/0008).
 */
export interface TrustEngine extends TrustEngineReader, TrustEngineWriter {}
