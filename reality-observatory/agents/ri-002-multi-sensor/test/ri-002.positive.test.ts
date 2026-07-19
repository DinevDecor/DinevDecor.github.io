import { test } from "node:test";
import assert from "node:assert/strict";

import { resetEnvelopeSequence } from "../src/envelope.js";
import { runReferenceScenario } from "../src/pipeline.js";
import {
  ANALYST_AGENT_ID,
  DOMAIN,
  EIA_EVIDENCE_ID,
  EIA_SENSOR_ID,
  EVENT_ID,
  HYPOTHESIS_ID,
  OUTCOME_ID,
  PREDICTION_ID,
  REUTERS_EVIDENCE_ID,
  REUTERS_SENSOR_ID,
  SATELLITE_EVIDENCE_ID,
  SATELLITE_SENSOR_ID,
  T0_REGISTERED,
  T5_RESOLVED,
} from "../src/scenario.js";
import type { Event, Hypothesis, Outcome, Prediction } from "@reality-observatory/ontology";

function closeTo(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

test("RI-002 positive: all three independent Sensors register successfully", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceScenario();

  const reuters = await pipeline.sensorRegistry.getSensor(REUTERS_SENSOR_ID);
  const eia = await pipeline.sensorRegistry.getSensor(EIA_SENSOR_ID);
  const satellite = await pipeline.sensorRegistry.getSensor(SATELLITE_SENSOR_ID);

  for (const sensor of [reuters, eia, satellite]) {
    assert.ok(sensor, "sensor should be registered");
    assert.equal(sensor?.status, "active");
  }
});

test("RI-002 positive: three independent Evidence objects correlate into exactly one Event", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceScenario();

  const eventEnvelopes = pipeline.bus.published.filter((envelope) => envelope.topic === `event.${DOMAIN}`);
  assert.equal(eventEnvelopes.length, 1, "exactly one Event must be produced from three Evidence");

  const event = eventEnvelopes[0]!.payload as Event;
  assert.equal(event.id, EVENT_ID);
  assert.equal(event.domain, DOMAIN);

  // Complete provenance: the single Event traces back to all three
  // independent sources, not just the one that happened to trigger it.
  const evidenceRefs = [...event.evidenceRefs].sort();
  assert.deepEqual(evidenceRefs, [REUTERS_EVIDENCE_ID, EIA_EVIDENCE_ID, SATELLITE_EVIDENCE_ID].sort());
});

test("RI-002 positive: no Event is produced until quorum (3 independent sources) is reached", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceScenario();

  const topics = pipeline.bus.published.map((e) => e.topic);
  const evidenceIndices = topics.reduce<number[]>((acc, topic, index) => {
    if (topic === `evidence.${DOMAIN}`) acc.push(index);
    return acc;
  }, []);
  assert.equal(evidenceIndices.length, 3, "Reuters, EIA, and Satellite must each publish one Evidence");
  const [, secondEvidenceIndex, thirdEvidenceIndex] = evidenceIndices;

  const eventIndex = topics.indexOf(`event.${DOMAIN}`);
  assert.ok(eventIndex > thirdEvidenceIndex!, "the Event must not appear before the third (quorum-reaching) Evidence");

  // No Event exists anywhere in the log through the second Evidence publish —
  // two independent sources are not enough to correlate on their own.
  const topicsThroughSecondEvidence = topics.slice(0, secondEvidenceIndex! + 1);
  assert.ok(!topicsThroughSecondEvidence.includes(`event.${DOMAIN}`));
});

test("RI-002 positive: Domain is unchanged across the entire pipeline", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceScenario();

  const event = pipeline.bus.published.find((e) => e.topic === `event.${DOMAIN}`)!.payload as Event;
  const hypotheses = pipeline.bus.published.filter((e) => e.topic === `hypothesis.${DOMAIN}`).map((e) => e.payload as Hypothesis);
  const predictions = pipeline.bus.published.filter((e) => e.topic === `prediction.${DOMAIN}`).map((e) => e.payload as Prediction);

  assert.equal(event.domain, DOMAIN);
  for (const hypothesis of hypotheses) assert.equal(hypothesis.domain, DOMAIN);
  for (const prediction of predictions) assert.equal(prediction.domain, DOMAIN);
});

test("RI-002 positive: Prediction reaches a confirmed terminal state via Outcome, with complete lineage", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceScenario();

  const predictionEnvelopes = pipeline.bus.published.filter((e) => e.topic === `prediction.${DOMAIN}`);
  assert.equal(predictionEnvelopes.length, 2);
  const [pending, resolved] = predictionEnvelopes.map((e) => e.payload as Prediction);

  assert.equal(pending?.status, "pending");
  assert.equal(resolved?.status, "confirmed");
  assert.equal(resolved?.resolvingOutcomeId, OUTCOME_ID);
  assert.equal(resolved?.id, pending?.id);

  // Lineage: basis references every upstream fact (Evidence, Event, Hypothesis).
  assert.ok(pending?.basis.includes(EVENT_ID));
  assert.ok(pending?.basis.includes(HYPOTHESIS_ID));
  assert.ok(pending?.basis.includes(REUTERS_EVIDENCE_ID));
  assert.ok(pending?.basis.includes(EIA_EVIDENCE_ID));
  assert.ok(pending?.basis.includes(SATELLITE_EVIDENCE_ID));

  const outcomeEnvelope = pipeline.bus.published.find((e) => e.topic === `outcome.${DOMAIN}`);
  const outcome = outcomeEnvelope?.payload as Outcome;
  assert.equal(outcome.predictionId, PREDICTION_ID);
  assert.ok(outcome.evidenceEventIds.includes(EVENT_ID));
});

test("RI-002 positive: Outcome ingestion updates Domain Trust for the Analyst agent", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceScenario();

  const agentTrust = await pipeline.trustEngine.getTrust({ type: "agent", id: ANALYST_AGENT_ID }, DOMAIN);
  assert.ok(agentTrust);
  assert.equal(agentTrust?.domain, DOMAIN);
  closeTo(agentTrust!.score, 0.65);

  const history = await pipeline.trustEngine.getTrustHistory(
    { type: "agent", id: ANALYST_AGENT_ID },
    DOMAIN,
    { from: T0_REGISTERED, to: T5_RESOLVED }
  );
  assert.equal(history.length, 1);
});

test("RI-002 positive: each of the three Sensors accrues its own independent Domain Trust", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceScenario();

  const reutersTrust = await pipeline.trustEngine.getTrust({ type: "sensor", id: REUTERS_SENSOR_ID }, DOMAIN);
  const eiaTrust = await pipeline.trustEngine.getTrust({ type: "sensor", id: EIA_SENSOR_ID }, DOMAIN);
  const satelliteTrust = await pipeline.trustEngine.getTrust({ type: "sensor", id: SATELLITE_SENSOR_ID }, DOMAIN);

  assert.ok(reutersTrust);
  assert.ok(eiaTrust);
  assert.ok(satelliteTrust);
  closeTo(reutersTrust!.score, 0.5 + 0.05 * 0.7);
  closeTo(eiaTrust!.score, 0.5 + 0.05 * 0.85);
  closeTo(satelliteTrust!.score, 0.5 + 0.05 * 0.78);

  // Each Sensor's Trust is its own record — one is not an average of the
  // others, proving per-subject (not per-Event) Domain Trust partitioning.
  const scores = [reutersTrust!.score, eiaTrust!.score, satelliteTrust!.score];
  assert.equal(new Set(scores).size, 3, "all three Sensor trust scores must be distinct, reflecting distinct evidence strengths");
});

test("RI-002 positive: the full scenario publishes exactly the expected fact counts", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceScenario();

  const topics = pipeline.bus.published.map((e) => e.topic);
  const countOf = (topic: string) => topics.filter((t) => t === topic).length;

  assert.equal(topics.length, 18, `unexpected envelope count: ${JSON.stringify(topics)}`);
  assert.equal(countOf(`sensor.reference.newswire.reuters`), 2);
  assert.equal(countOf(`sensor.reference.eia.weekly-inventory`), 2);
  assert.equal(countOf(`sensor.reference.satellite.tank-imagery`), 2);
  assert.equal(countOf(`signal.${DOMAIN}`), 3);
  assert.equal(countOf(`evidence.${DOMAIN}`), 3);
  assert.equal(countOf(`event.${DOMAIN}`), 1);
  assert.equal(countOf(`hypothesis.${DOMAIN}`), 2);
  assert.equal(countOf(`prediction.${DOMAIN}`), 2);
  assert.equal(countOf(`outcome.${DOMAIN}`), 1);
});

test("RI-002 positive: the scenario is fully deterministic across independent runs", async () => {
  resetEnvelopeSequence();
  const first = await runReferenceScenario();
  const firstTopics = first.bus.published.map((e) => e.topic);
  const firstEvent = first.bus.published.find((e) => e.topic === `event.${DOMAIN}`)!.payload as Event;
  const firstAgentTrust = await first.trustEngine.getTrust({ type: "agent", id: ANALYST_AGENT_ID }, DOMAIN);

  resetEnvelopeSequence();
  const second = await runReferenceScenario();
  const secondTopics = second.bus.published.map((e) => e.topic);
  const secondEvent = second.bus.published.find((e) => e.topic === `event.${DOMAIN}`)!.payload as Event;
  const secondAgentTrust = await second.trustEngine.getTrust({ type: "agent", id: ANALYST_AGENT_ID }, DOMAIN);

  assert.deepEqual(firstTopics, secondTopics);
  assert.deepEqual(firstEvent.evidenceRefs, secondEvent.evidenceRefs);
  assert.equal(firstAgentTrust?.score, secondAgentTrust?.score);
  assert.deepEqual(
    first.bus.published.map((e) => e.id),
    second.bus.published.map((e) => e.id)
  );
});
