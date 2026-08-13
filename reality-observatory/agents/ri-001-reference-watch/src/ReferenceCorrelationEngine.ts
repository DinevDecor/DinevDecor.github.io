import type { CorrelationContext, CorrelationEngine, CorrelationManifest, HealthStatus } from "@reality-observatory/correlation-engine";
import type { Evidence, Hypothesis } from "@reality-observatory/ontology";
import { makeEnvelope } from "./envelope.js";
import { CLAIM, CORRELATION_ENGINE_ID, CORRELATION_THRESHOLD, DOMAIN, EVENT, SCHEMA_VERSION } from "./scenario.js";

const MANIFEST: CorrelationManifest = {
  id: CORRELATION_ENGINE_ID,
  domain: DOMAIN,
  displayName: "RI-001 Reference Correlation Engine",
  version: "0.1.0",
  owner: "platform-team",
  description: "Deterministic reference Correlation Engine for RI-001; not production correlation logic.",
  io: {
    consumesTopics: [`evidence.${DOMAIN}`],
    producesTopics: [`event.${DOMAIN}`, `hypothesis.${DOMAIN}`],
  },
  sandbox: "in-process",
};

/**
 * Deterministic reference Correlation Engine for RI-001. Its "correlation
 * rule" is intentionally trivial and fixed: incoming Evidence that matches
 * the scenario's known claim/polarity/strength threshold produces the
 * scenario's fixed Event. Real correlation logic (statistical, ML-based,
 * multi-source) is explicitly out of scope — see docs/adr/0010.
 */
export class ReferenceCorrelationEngine implements CorrelationEngine {
  readonly manifest = MANIFEST;
  private context: CorrelationContext | undefined;

  async onInit(context: CorrelationContext): Promise<void> {
    this.context = context;
  }

  async onStart(): Promise<void> {
    this.requireContext().logger.info("RI-001 reference correlation engine started", {
      domain: this.manifest.domain,
    });
  }

  async onEvidence(evidence: Evidence): Promise<void> {
    const context = this.requireContext();
    if (evidence.domain !== this.manifest.domain) return;
    if (evidence.claim !== CLAIM) return;
    if (evidence.polarity !== "supports") return;
    if (evidence.strength < CORRELATION_THRESHOLD) return;

    await context.bus.publish(
      makeEnvelope(`event.${DOMAIN}`, EVENT, this.manifest.id, EVENT.recordedAt, SCHEMA_VERSION)
    );
  }

  async onHypothesis(_hypothesis: Hypothesis): Promise<void> {
    // RI-001's reference engine doesn't react to Hypotheses; implemented
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
