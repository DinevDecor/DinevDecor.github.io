import type { Evidence, Hypothesis } from "@reality-observatory/ontology";
import type { CorrelationContext } from "./CorrelationContext.js";
import type { CorrelationManifest } from "./CorrelationManifest.js";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * The contract a Correlation Engine instance implements to turn Evidence
 * (and optionally existing Hypotheses) into Event and Hypothesis facts for
 * its single authoritative domain. Typed directly to ontology facts rather
 * than to a raw EventEnvelope — unlike a generic Agent, its only job is
 * ontology-level correlation (see docs/adr/0010).
 */
export interface CorrelationEngine {
  readonly manifest: CorrelationManifest;
  onInit(context: CorrelationContext): Promise<void>;
  onStart(): Promise<void>;
  onEvidence(evidence: Evidence): Promise<void>;
  onHypothesis?(hypothesis: Hypothesis): Promise<void>;
  onHealthCheck(): Promise<HealthStatus>;
  onShutdown(): Promise<void>;
}
