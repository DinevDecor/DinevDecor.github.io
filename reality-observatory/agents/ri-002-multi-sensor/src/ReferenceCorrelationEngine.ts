import type { CorrelationContext, CorrelationEngine, CorrelationManifest, HealthStatus } from "@reality-observatory/correlation-engine";
import type { Evidence, EvidenceId, Hypothesis } from "@reality-observatory/ontology";
import { makeEnvelope } from "./envelope.js";
import { buildCanonicalEvent, CORRELATION_QUORUM, CORRELATION_THRESHOLD, DOMAIN, SCHEMA_VERSION, T4_CORRELATED } from "./scenario.js";

const MANIFEST: CorrelationManifest = {
  id: "ri-002-oil-correlation",
  domain: DOMAIN,
  displayName: "RI-002 Reference Multi-Sensor Correlation Engine",
  version: "0.1.0",
  owner: "platform-team",
  description:
    "Deterministic reference Correlation Engine for RI-002. Accumulates independent Evidence " +
    "referring to the same phenomenon and emits exactly one canonical Event once a fixed quorum " +
    "is reached. Not production correlation logic — see README.md for the algorithm.",
  io: {
    consumesTopics: [`evidence.${DOMAIN}`],
    producesTopics: [`event.${DOMAIN}`, `hypothesis.${DOMAIN}`],
  },
  sandbox: "in-process",
};

interface AccumulatorEntry {
  /** A Set so identical (same-id) Evidence resubmission never inflates the count — see docs/adr/0009-style idempotency. */
  readonly evidenceIds: Set<EvidenceId>;
  emitted: boolean;
}

/**
 * The correlation key: an exact match on `${domain}::${claim}`. This is
 * deliberately the simplest possible rule-based algorithm — no statistics,
 * no AI, no fuzzy matching — because RI-002 exists to validate that the
 * architecture *can* correlate multiple independent Evidence into one
 * Event, not to demonstrate a sophisticated correlation strategy. See
 * README.md, "Correlation Algorithm".
 */
function correlationKey(domain: string, claim: string): string {
  return `${domain}::${claim}`;
}

/**
 * Deterministic reference Correlation Engine for RI-002. Accumulates
 * Evidence per correlation key and emits the scenario's fixed canonical
 * Event — with `evidenceRefs` built from whatever EvidenceIds actually
 * reached quorum, in arrival order — exactly once per key. Any Evidence
 * received after emission (including exact duplicates before or after
 * emission) is ignored for that key: no second Event is ever produced.
 */
export class ReferenceCorrelationEngine implements CorrelationEngine {
  readonly manifest = MANIFEST;
  private context: CorrelationContext | undefined;
  private accumulator = new Map<string, AccumulatorEntry>();

  async onInit(context: CorrelationContext): Promise<void> {
    this.context = context;
  }

  async onStart(): Promise<void> {
    this.requireContext().logger.info("RI-002 reference correlation engine started", {
      domain: this.manifest.domain,
      quorum: CORRELATION_QUORUM,
    });
  }

  async onEvidence(evidence: Evidence): Promise<void> {
    const context = this.requireContext();

    // Domain exclusivity: this engine instance is authoritative only for
    // its own domain (docs/adr/0010) — Evidence from any other domain is
    // simply not this engine's concern, never merged.
    if (evidence.domain !== this.manifest.domain) return;
    if (evidence.polarity !== "supports") return;
    if (evidence.strength < CORRELATION_THRESHOLD) return;

    const key = correlationKey(evidence.domain, evidence.claim);
    const entry = this.accumulator.get(key) ?? { evidenceIds: new Set<EvidenceId>(), emitted: false };
    this.accumulator.set(key, entry);

    if (entry.emitted) return; // already correlated into a canonical Event; ignore further Evidence for this key

    entry.evidenceIds.add(evidence.id); // Set: resubmitting the same EvidenceId is a no-op

    if (entry.evidenceIds.size < CORRELATION_QUORUM) return; // not enough independent corroboration yet

    entry.emitted = true;
    const event = buildCanonicalEvent([...entry.evidenceIds]);
    await context.bus.publish(makeEnvelope(`event.${DOMAIN}`, event, this.manifest.id, T4_CORRELATED, SCHEMA_VERSION));
  }

  async onHypothesis(_hypothesis: Hypothesis): Promise<void> {
    // RI-002's reference engine doesn't react to Hypotheses; implemented
    // explicitly since the interface method, while optional, is part of
    // the contract this engine is exercising.
  }

  async onHealthCheck(): Promise<HealthStatus> {
    return "healthy";
  }

  async onShutdown(): Promise<void> {
    this.context = undefined;
  }

  private requireContext(): CorrelationContext {
    if (!this.context) throw new Error("ReferenceCorrelationEngine used before onInit");
    return this.context;
  }
}
