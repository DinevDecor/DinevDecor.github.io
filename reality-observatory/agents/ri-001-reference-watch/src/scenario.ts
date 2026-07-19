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
 * RI-001's entire scenario is fixed, hardcoded data — no randomness, no
 * clock reads, no external calls. Every fact below is fully determined at
 * import time, so the pipeline it drives produces byte-identical results on
 * every run. This is what makes RI-001 usable as a permanent regression
 * test (see agents/ri-001-reference-watch/README.md).
 */

export const SCHEMA_VERSION = "1.0.0" as SchemaVersion;

export const DOMAIN = "reference.weather" as Domain;
export const OTHER_DOMAIN = "reference.market" as Domain;

export const WATCH_AGENT_ID = "agent-ri001-watch" as AgentId;
export const INTRUDER_AGENT_ID = "agent-ri001-intruder" as AgentId;
export const CORRELATION_ENGINE_ID = "ri-001-reference-correlation";

export const SENSOR_ID = "sensor-ri001-thermo-01" as SensorId;

export const SIGNAL_ID = "signal-ri001-0001" as SignalId;
export const EVIDENCE_ID = "evidence-ri001-0001" as EvidenceId;
export const HYPOTHESIS_ID = "hypothesis-ri001-0001" as HypothesisId;
export const EVENT_ID = "event-ri001-0001" as EventId;
export const PREDICTION_ID = "prediction-ri001-0001" as PredictionId;
export const OUTCOME_ID = "outcome-ri001-0001" as OutcomeId;

// Fixed instants, in scenario order. Never derived from a real clock.
export const T0_REGISTERED = "2026-01-01T00:00:00.000Z" as Timestamp;
export const T1_OBSERVED = "2026-01-01T00:05:00.000Z" as Timestamp;
export const T2_DETECTED = "2026-01-01T00:06:00.000Z" as Timestamp;
export const T3_RESOLVED = "2026-01-01T06:00:00.000Z" as Timestamp;
export const HORIZON_TO = "2026-01-02T00:05:00.000Z" as Timestamp;

export const SUBJECT: EventSubjectRef = { type: "reference.site", id: "site-ri001-alpha" };

export const CLAIM = "sustained-heatwave-risk";
export const TEMPERATURE_THRESHOLD_C = 35;
export const OBSERVED_TEMPERATURE_C = 38.4;
export const EVIDENCE_STRENGTH = 0.82;
export const CORRELATION_THRESHOLD = 0.75;

export const HYPOTHESIS_STATEMENT =
  "Sensor readings indicate a sustained heatwave forming over site-ri001-alpha.";

export const PREDICTED_PEAK_TEMPERATURE_C = 41;
export const OBSERVED_PEAK_TEMPERATURE_C = 41.2;

export const SENSOR: Sensor = {
  id: SENSOR_ID,
  kind: "reference.thermometer",
  displayName: "RI-001 Reference Thermometer",
  description: "Fixed reference sensor for RI-001; not a real device.",
  ownerAgentId: WATCH_AGENT_ID,
  capabilities: { modality: "numeric", unit: "celsius" },
  status: "active",
  registeredAt: T0_REGISTERED,
  producedBy: WATCH_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const SIGNAL: Signal<{ temperatureC: number }> = {
  id: SIGNAL_ID,
  sensorId: SENSOR_ID,
  modality: "numeric",
  capturedAt: T1_OBSERVED,
  ingestedAt: T1_OBSERVED,
  payload: { temperatureC: OBSERVED_TEMPERATURE_C },
  unit: "celsius",
  producedBy: SENSOR_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const EVIDENCE: Evidence = {
  id: EVIDENCE_ID,
  domain: DOMAIN,
  claim: CLAIM,
  polarity: "supports",
  strength: EVIDENCE_STRENGTH as Evidence["strength"],
  derivedFrom: [{ type: "signal", id: SIGNAL_ID }],
  derivedByAgentId: WATCH_AGENT_ID,
  observedAt: T1_OBSERVED,
  producedBy: WATCH_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const HYPOTHESIS_PROPOSED: Hypothesis = {
  id: HYPOTHESIS_ID,
  domain: DOMAIN,
  statement: HYPOTHESIS_STATEMENT,
  proposedByAgentId: WATCH_AGENT_ID,
  status: "proposed",
  supportingEvidence: [EVIDENCE_ID],
  conflictingEvidence: [],
  confidence: 0.8 as Hypothesis["confidence"],
  proposedAt: T1_OBSERVED,
  updatedAt: T1_OBSERVED,
  producedBy: WATCH_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const HYPOTHESIS_CORROBORATED: Hypothesis = {
  ...HYPOTHESIS_PROPOSED,
  status: "corroborated",
  updatedAt: T2_DETECTED,
};

export const EVENT: Event<{ temperatureC: number; thresholdC: number }> = {
  id: EVENT_ID,
  domain: DOMAIN,
  type: "reference.weather.heatwave-risk-detected",
  subject: SUBJECT,
  occurredAt: T1_OBSERVED,
  recordedAt: T2_DETECTED,
  evidenceRefs: [EVIDENCE_ID],
  confidence: EVIDENCE_STRENGTH as Event["confidence"],
  payload: { temperatureC: OBSERVED_TEMPERATURE_C, thresholdC: TEMPERATURE_THRESHOLD_C },
  // Correlation Engine instances aren't Agents or Sensors; Provenance/Event
  // still require AgentId | SensorId, so the engine id is attributed via an
  // AgentId-shaped cast as a pragmatic simplification for this reference
  // implementation. A dedicated CorrelationEngineId brand is a candidate
  // follow-up, not something RI-001 needs to resolve.
  detectedByAgentId: CORRELATION_ENGINE_ID as AgentId,
  producedBy: CORRELATION_ENGINE_ID as AgentId,
  schemaVersion: SCHEMA_VERSION,
};

export const PREDICTION_PENDING: Prediction<{ expectedPeakTemperatureC: number }> = {
  id: PREDICTION_ID,
  producedByAgentId: WATCH_AGENT_ID,
  domain: DOMAIN,
  subject: SUBJECT,
  hypothesisId: HYPOTHESIS_ID,
  claim: { expectedPeakTemperatureC: PREDICTED_PEAK_TEMPERATURE_C },
  horizon: { from: T1_OBSERVED, to: HORIZON_TO },
  confidence: 0.8 as Prediction["confidence"],
  basis: [EVIDENCE_ID, EVENT_ID, HYPOTHESIS_ID],
  status: "pending",
  createdAt: T1_OBSERVED,
  producedBy: WATCH_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const OUTCOME: Outcome = {
  id: OUTCOME_ID,
  predictionId: PREDICTION_ID,
  verdict: "confirmed",
  method: "automatic",
  evidenceEventIds: [EVENT_ID],
  resolvedByAgentId: WATCH_AGENT_ID,
  resolvedAt: T3_RESOLVED,
  rationale: `Observed peak ${OBSERVED_PEAK_TEMPERATURE_C}C met predicted ${PREDICTED_PEAK_TEMPERATURE_C}C threshold.`,
  producedBy: WATCH_AGENT_ID,
  schemaVersion: SCHEMA_VERSION,
};

export const PREDICTION_RESOLVED: Prediction<{ expectedPeakTemperatureC: number }> = {
  ...PREDICTION_PENDING,
  status: OUTCOME.verdict,
  resolvedAt: OUTCOME.resolvedAt,
  resolvingOutcomeId: OUTCOME.id,
};
