import type { CorrelationContext, CorrelationEngine, CorrelationManifest, HealthStatus } from "@reality-observatory/correlation-engine";
import type { AgentId, Event, EventId, Evidence, EvidenceId, Hypothesis } from "@reality-observatory/ontology";
import { makeEnvelope } from "./envelope.js";
import { CORRELATION_ENGINE_ID, DOMAIN, SCHEMA_VERSION, SUBJECT, type EventType } from "./domain.js";

/**
 * Deterministic rule-based correlation: each recognized claim independently
 * and sufficiently constitutes an Event on its own (unlike RI-002's
 * multi-sensor quorum) — a single EIA inventory surprise or a single OPEC+
 * announcement is, on its own, a real-world occurrence worth an Event. No
 * AI, no statistical inference; see README, "Correlation Algorithm".
 * Evidence claims with no entry here (e.g. bare price-move evidence) are
 * deliberately not Event triggers in this initial scope.
 */
const CLAIM_TO_EVENT_TYPE: Readonly<Record<string, EventType>> = {
  "unexpected-crude-oil-inventory-build": "energy.oil.inventory-surprise-build",
  "unexpected-crude-oil-inventory-draw": "energy.oil.inventory-surprise-draw",
  "opec-production-cut": "energy.oil.opec-production-cut",
  "opec-production-increase": "energy.oil.opec-production-increase",
  "opec-supply-disruption": "energy.oil.opec-supply-disruption",
};

const MANIFEST: CorrelationManifest = {
  id: CORRELATION_ENGINE_ID,
  domain: DOMAIN,
  displayName: "Oil Regime Correlation Engine",
  version: "0.1.0",
  owner: "energy-desk",
  description:
    "Deterministic rule-based correlation for Oil Regime Watch: inventory surprises and OPEC+ " +
    "production announcements each independently constitute an Event. No AI, no statistical inference.",
  io: {
    consumesTopics: [`evidence.${DOMAIN}`],
    producesTopics: [`event.${DOMAIN}`, `hypothesis.${DOMAIN}`],
  },
  sandbox: "in-process",
};

/** Deterministic Event id derived from the triggering Evidence id — stable across runs, and makes re-delivery detection trivial. */
export function eventIdForEvidence(evidenceId: EvidenceId): EventId {
  return `event-for-${evidenceId}` as EventId;
}

export class OilRegimeCorrelationEngine implements CorrelationEngine {
  readonly manifest = MANIFEST;
  private context: CorrelationContext | undefined;
  private processedEvidenceIds = new Set<EvidenceId>();

  async onInit(context: CorrelationContext): Promise<void> {
    this.context = context;
  }

  async onStart(): Promise<void> {
    this.requireContext().logger.info("Oil Regime Correlation Engine started", { domain: this.manifest.domain });
  }

  async onEvidence(evidence: Evidence): Promise<void> {
    const context = this.requireContext();

    if (evidence.domain !== this.manifest.domain) return; // domain exclusivity (docs/adr/0010)
    if (evidence.polarity !== "supports") return;
    if (this.processedEvidenceIds.has(evidence.id)) return; // idempotent: never double-correlate the same Evidence

    const eventType = CLAIM_TO_EVENT_TYPE[evidence.claim];
    if (!eventType) return; // no correlation rule for this claim — not an Event trigger by design

    this.processedEvidenceIds.add(evidence.id);

    const event: Event<{ claim: string }> = {
      id: eventIdForEvidence(evidence.id),
      domain: this.manifest.domain,
      type: eventType,
      subject: SUBJECT,
      occurredAt: evidence.observedAt,
      recordedAt: evidence.observedAt,
      evidenceRefs: [evidence.id],
      confidence: evidence.strength,
      payload: { claim: evidence.claim },
      // Correlation Engine instances aren't Agents or Sensors, yet
      // Provenance/Event still require AgentId | SensorId — attributed via
      // an AgentId-shaped cast, the same pragmatic simplification used in
      // RI-001/RI-002.
      detectedByAgentId: this.manifest.id as AgentId,
      producedBy: this.manifest.id as AgentId,
      schemaVersion: SCHEMA_VERSION,
    };

    await context.bus.publish(makeEnvelope(`event.${DOMAIN}`, event, this.manifest.id, evidence.observedAt, SCHEMA_VERSION));
  }

  async onHypothesis(_hypothesis: Hypothesis): Promise<void> {
    // This engine doesn't react to Hypotheses; implemented explicitly since
    // the interface method, while optional, is part of the contract.
  }

  async onHealthCheck(): Promise<HealthStatus> {
    return "healthy";
  }

  async onShutdown(): Promise<void> {
    this.context = undefined;
  }

  private requireContext(): CorrelationContext {
    if (!this.context) throw new Error("OilRegimeCorrelationEngine used before onInit");
    return this.context;
  }
}
