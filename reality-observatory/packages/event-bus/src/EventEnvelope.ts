import type { SchemaVersion, Timestamp } from "@reality-observatory/ontology";

/**
 * The transport wrapper for every fact placed on the Event Bus. Carries
 * lineage (correlationId/causationId) so any fact can be traced back through
 * the causal chain that produced it. See docs/adr/0004.
 */
export interface EventEnvelope<TPayload = unknown> {
  /** Unique per envelope; consumers use this for idempotency. */
  readonly id: string;
  readonly topic: string;
  readonly schemaVersion: SchemaVersion;
  /** Stringified AgentId or SensorId of the producer. */
  readonly producer: string;
  readonly occurredAt: Timestamp;
  readonly publishedAt: Timestamp;
  /** Groups all envelopes belonging to the same logical chain of facts. */
  readonly correlationId?: string;
  /** Direct parent envelope id in the causal chain, if any. */
  readonly causationId?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly payload: TPayload;
}
