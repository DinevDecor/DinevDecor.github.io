import type {
  AgentId,
  Domain,
  Event,
  EventId,
  EventSubjectRef,
  Evidence,
  EvidenceId,
  Hypothesis,
  HypothesisId,
  Outcome,
  OutcomeId,
  Prediction,
  PredictionId,
  SchemaVersion,
  Sensor,
  SensorId,
  Signal,
  SignalId,
  Timestamp,
} from "@reality-observatory/ontology";

/**
 * RI-002's entire scenario is fixed, hardcoded data — no randomness, no
 * clock reads, no external calls, no LLM reasoning. Three independent
 * sensor agents each observe the same real-world phenomenon (an
 * unexpected crude oil inventory build) from a different source; the
 * Correlation Engine must recognize all three Evidence describe the same
 * phenomenon and emit exactly one canonical Event.
 */

export const SCHEMA_VERSION = "1.0.0" as SchemaVersion;

// The domain is deliberately named after the production agent this
// reference is meant to de-risk — "Oil Regime Watch" — while staying under
// the "reference." namespace so it can never be confused with a real feed.
export const DOMAIN = "reference.oil" as Domain;
export const OTHER_DOMAIN = "reference.market" as Domain;

export const CORRELATION_ENGINE_ID = "ri-002-oil-correlation";

export const REUTERS_AGENT_ID = "agent-ri002-reuters" as AgentId;
export const EIA_AGENT_ID = "agent-ri002-eia" as AgentId;
export const SATELLITE_AGENT_ID = "agent-ri002-satellite" as AgentId;
export const ANALYST_AGENT_ID = "agent-ri002-oil-analyst" as AgentId;
export const INTRUDER_AGENT_ID = "agent-ri002-intruder" as AgentId;

export const REUTERS_SENSOR_ID = "sensor-ri002-reuters-feed" as SensorId;
export const EIA_SENSOR_ID = "sensor-ri002-eia-weekly-inventory" as SensorId;
export const SATELLITE_SENSOR_ID = "sensor-ri002-satellite-tanks" as SensorId;

export const REUTERS_SIGNAL_ID = "signal-ri002-reuters-0001" as SignalId;
export const EIA_SIGNAL_ID = "signal-ri002-eia-0001" as SignalId;
export const SATELLITE_SIGNAL_ID = "signal-ri002-satellite-0001" as SignalId;

export const REUTERS_EVIDENCE_ID = "evidence-ri002-reuters-0001" as EvidenceId;
export const EIA_EVIDENCE_ID = "evidence-ri002-eia-0001" as EvidenceId;
export const SATELLITE_EVIDENCE_ID = "evidence-ri002-satellite-0001" as EvidenceId;

export const EVENT_ID = "event-ri002-0001" as EventId;
export const HYPOTHESIS_ID = "hypothesis-ri002-0001" as HypothesisId;
export const PREDICTION_ID = "prediction-ri002-0001" as PredictionId;
export const OUTCOME_ID = "outcome-ri002-0001" as OutcomeId;

// Fixed instants, in scenario order. Never derived from a real clock.
export const T0_REGISTERED = "2026-02-02T00:00:00.000Z" as Timestamp;
export const T1_REUTERS = "2026-02-02T10:30:00.000Z" as Timestamp;
export const T2_EIA = "2026-02-02T10:31:00.000Z" as Timestamp;
export const T3_SATELLITE = "2026-02-02T10:32:00.000Z" as Timestamp;
export const T4_CORRELATED = "2026-02-02T10:32:01.000Z" as Timestamp;
export const T5_RESOLVED = "2026-02-04T16:00:00.000Z" as Timestamp;
export const HORIZON_TO = "2026-02-06T10:32:00.000Z" as Timestamp;

export const SUBJECT: EventSubjectRef = { type: "reference.market-instrument", id: "wti-crude-oil" };

/**
 * The correlation key for this reference's algorithm is `${domain}::${claim}`
 * (see ReferenceCorrelationEngine.ts) — an exact string match on the claim,
 * which is deliberately identical across all three independent sources.
 */
export const CLAIM = "unexpected-crude-oil-inventory-build";
export const UNRELATED_CLAIM = "pipeline-maintenance-outage";

export const CORRELATION_THRESHOLD = 0.6;
export const CORRELATION_QUORUM = 3;

export const HYPOTHESIS_STATEMENT =
  "Independent inventory, newswire, and satellite signals jointly indicate an unplanned crude oil supply glut.";

export const PREDICTED_PRICE_MOVE_PERCENT = -2.5;
export const OBSERVED_PRICE_MOVE_PERCENT = -3.1;

// --- Sensors -----------------------------------------------------------

export const REUTERS_SENSOR: Sensor = {
  id: REUTERS_SENSOR_ID,
  kind: "reference.newswire.reuters",
  displayName: "RI-002 Reuters Feed (reference)",
  description: "Fixed reference newswire sensor for RI-002; not a real feed.",
  ownerAgentId: REUTERS_AGENT_ID,
  capabilities: { modality: "text" },
  status: "active",
  registeredAt: T0_REGISTERED,
  producedBy: REUTERS_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const EIA_SENSOR: Sensor = {
  id: EIA_SENSOR_ID,
  kind: "reference.eia.weekly-inventory",
  displayName: "RI-002 EIA Weekly Inventory (reference)",
  description: "Fixed reference statistical sensor for RI-002; not a real feed.",
  ownerAgentId: EIA_AGENT_ID,
  capabilities: { modality: "numeric", unit: "million-barrels" },
  status: "active",
  registeredAt: T0_REGISTERED,
  producedBy: EIA_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const SATELLITE_SENSOR: Sensor = {
  id: SATELLITE_SENSOR_ID,
  kind: "reference.satellite.tank-imagery",
  displayName: "RI-002 Satellite Tank Imagery (reference)",
  description: "Fixed reference remote-sensing sensor for RI-002; not a real feed.",
  ownerAgentId: SATELLITE_AGENT_ID,
  capabilities: { modality: "numeric", unit: "percent-fill-change" },
  status: "active",
  registeredAt: T0_REGISTERED,
  producedBy: SATELLITE_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

// --- Signals -------------------------------------------------------------

export const REUTERS_SIGNAL: Signal<{ headline: string }> = {
  id: REUTERS_SIGNAL_ID,
  sensorId: REUTERS_SENSOR_ID,
  modality: "text",
  capturedAt: T1_REUTERS,
  ingestedAt: T1_REUTERS,
  payload: { headline: "Crude oil inventories unexpectedly rise, traders say" },
  producedBy: REUTERS_SENSOR_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const EIA_SIGNAL: Signal<{ inventoryChangeMillionBarrels: number }> = {
  id: EIA_SIGNAL_ID,
  sensorId: EIA_SENSOR_ID,
  modality: "numeric",
  capturedAt: T2_EIA,
  ingestedAt: T2_EIA,
  payload: { inventoryChangeMillionBarrels: 8.4 },
  unit: "million-barrels",
  producedBy: EIA_SENSOR_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const SATELLITE_SIGNAL: Signal<{ estimatedFillLevelChangePercent: number }> = {
  id: SATELLITE_SIGNAL_ID,
  sensorId: SATELLITE_SENSOR_ID,
  modality: "numeric",
  capturedAt: T3_SATELLITE,
  ingestedAt: T3_SATELLITE,
  payload: { estimatedFillLevelChangePercent: 3.2 },
  unit: "percent-fill-change",
  producedBy: SATELLITE_SENSOR_ID,
  schemaVersion: SCHEMA_VERSION,
};

// --- Evidence (three independent sources, same domain + claim) ----------

export const REUTERS_EVIDENCE: Evidence = {
  id: REUTERS_EVIDENCE_ID,
  domain: DOMAIN,
  claim: CLAIM,
  polarity: "supports",
  strength: 0.7 as Evidence["strength"],
  derivedFrom: [{ type: "signal", id: REUTERS_SIGNAL_ID }],
  derivedByAgentId: REUTERS_AGENT_ID,
  observedAt: T1_REUTERS,
  producedBy: REUTERS_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const EIA_EVIDENCE: Evidence = {
  id: EIA_EVIDENCE_ID,
  domain: DOMAIN,
  claim: CLAIM,
  polarity: "supports",
  strength: 0.85 as Evidence["strength"],
  derivedFrom: [{ type: "signal", id: EIA_SIGNAL_ID }],
  derivedByAgentId: EIA_AGENT_ID,
  observedAt: T2_EIA,
  producedBy: EIA_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const SATELLITE_EVIDENCE: Evidence = {
  id: SATELLITE_EVIDENCE_ID,
  domain: DOMAIN,
  claim: CLAIM,
  polarity: "supports",
  strength: 0.78 as Evidence["strength"],
  derivedFrom: [{ type: "signal", id: SATELLITE_SIGNAL_ID }],
  derivedByAgentId: SATELLITE_AGENT_ID,
  observedAt: T3_SATELLITE,
  producedBy: SATELLITE_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

/** Same claim text, but a different domain — must never be correlated with the oil Event. */
export const CROSS_DOMAIN_EVIDENCE: Evidence = {
  id: "evidence-ri002-cross-domain-0001" as EvidenceId,
  domain: OTHER_DOMAIN,
  claim: CLAIM,
  polarity: "supports",
  strength: 0.9 as Evidence["strength"],
  derivedFrom: [{ type: "signal", id: REUTERS_SIGNAL_ID }],
  derivedByAgentId: REUTERS_AGENT_ID,
  observedAt: T1_REUTERS,
  producedBy: REUTERS_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

/** Same domain, unrelated claim — must never be merged into the inventory-build correlation. */
export const UNRELATED_EVIDENCE: Evidence = {
  id: "evidence-ri002-unrelated-0001" as EvidenceId,
  domain: DOMAIN,
  claim: UNRELATED_CLAIM,
  polarity: "supports",
  strength: 0.9 as Evidence["strength"],
  derivedFrom: [{ type: "signal", id: REUTERS_SIGNAL_ID }],
  derivedByAgentId: REUTERS_AGENT_ID,
  observedAt: T1_REUTERS,
  producedBy: REUTERS_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

// --- Event, Hypothesis, Prediction, Outcome ------------------------------

/**
 * Template for the canonical Event; `evidenceRefs` is filled in by the
 * Correlation Engine from whichever EvidenceIds actually reached quorum
 * (see ReferenceCorrelationEngine.ts) rather than hardcoded here, so the
 * scenario proves the accumulation, not just replays a fixed array.
 */
export function buildCanonicalEvent(evidenceRefs: readonly EvidenceId[]): Event<{ claim: string }> {
  return {
    id: EVENT_ID,
    domain: DOMAIN,
    type: "reference.oil.inventory-build-detected",
    subject: SUBJECT,
    occurredAt: T3_SATELLITE,
    recordedAt: T4_CORRELATED,
    evidenceRefs,
    confidence: 0.9 as Event["confidence"],
    payload: { claim: CLAIM },
    detectedByAgentId: CORRELATION_ENGINE_ID as AgentId,
    producedBy: CORRELATION_ENGINE_ID as AgentId,
    schemaVersion: SCHEMA_VERSION,
  };
}

export const HYPOTHESIS_PROPOSED: Hypothesis = {
  id: HYPOTHESIS_ID,
  domain: DOMAIN,
  statement: HYPOTHESIS_STATEMENT,
  proposedByAgentId: ANALYST_AGENT_ID,
  status: "proposed",
  supportingEvidence: [REUTERS_EVIDENCE_ID, EIA_EVIDENCE_ID, SATELLITE_EVIDENCE_ID],
  conflictingEvidence: [],
  confidence: 0.85 as Hypothesis["confidence"],
  proposedAt: T4_CORRELATED,
  updatedAt: T4_CORRELATED,
  producedBy: ANALYST_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const HYPOTHESIS_CORROBORATED: Hypothesis = {
  ...HYPOTHESIS_PROPOSED,
  status: "corroborated",
  updatedAt: T4_CORRELATED,
};

export const PREDICTION_PENDING: Prediction<{ expectedPriceMovePercent: number }> = {
  id: PREDICTION_ID,
  producedByAgentId: ANALYST_AGENT_ID,
  domain: DOMAIN,
  subject: SUBJECT,
  hypothesisId: HYPOTHESIS_ID,
  claim: { expectedPriceMovePercent: PREDICTED_PRICE_MOVE_PERCENT },
  horizon: { from: T4_CORRELATED, to: HORIZON_TO },
  confidence: 0.8 as Prediction["confidence"],
  basis: [REUTERS_EVIDENCE_ID, EIA_EVIDENCE_ID, SATELLITE_EVIDENCE_ID, EVENT_ID, HYPOTHESIS_ID],
  status: "pending",
  createdAt: T4_CORRELATED,
  producedBy: ANALYST_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const OUTCOME: Outcome = {
  id: OUTCOME_ID,
  predictionId: PREDICTION_ID,
  verdict: "confirmed",
  method: "automatic",
  evidenceEventIds: [EVENT_ID],
  resolvedByAgentId: ANALYST_AGENT_ID,
  resolvedAt: T5_RESOLVED,
  rationale: `Observed WTI move ${OBSERVED_PRICE_MOVE_PERCENT}% exceeded predicted ${PREDICTED_PRICE_MOVE_PERCENT}% threshold.`,
  producedBy: ANALYST_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const PREDICTION_RESOLVED: Prediction<{ expectedPriceMovePercent: number }> = {
  ...PREDICTION_PENDING,
  status: OUTCOME.verdict,
  resolvedAt: OUTCOME.resolvedAt,
  resolvingOutcomeId: OUTCOME.id,
};
