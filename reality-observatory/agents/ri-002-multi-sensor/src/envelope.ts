import type { EventEnvelope } from "@reality-observatory/event-bus";
import type { SchemaVersion, Timestamp } from "@reality-observatory/ontology";

let envelopeSequence = 0;

/**
 * Deterministic envelope id generator for RI-002: a monotonic counter, not
 * a random UUID, so envelope ids (and therefore causation chains) are
 * identical on every run.
 */
function nextEnvelopeId(): string {
  envelopeSequence += 1;
  return `ri002-envelope-${String(envelopeSequence).padStart(4, "0")}`;
}

export interface MakeEnvelopeOptions {
  readonly correlationId?: string;
  readonly causationId?: string;
}

export function makeEnvelope<TPayload>(
  topic: string,
  payload: TPayload,
  producer: string,
  at: Timestamp,
  schemaVersion: SchemaVersion,
  options: MakeEnvelopeOptions = {}
): EventEnvelope<TPayload> {
  // exactOptionalPropertyTypes forbids `correlationId: undefined` — the key
  // must be entirely absent rather than present-with-undefined, hence the
  // conditional spreads instead of a plain object literal.
  return {
    id: nextEnvelopeId(),
    topic,
    schemaVersion,
    producer,
    occurredAt: at,
    publishedAt: at,
    ...(options.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
    ...(options.causationId !== undefined ? { causationId: options.causationId } : {}),
    payload,
  };
}

/** Resets the deterministic id counter; only tests between independent scenario runs need this. */
export function resetEnvelopeSequence(): void {
  envelopeSequence = 0;
}
