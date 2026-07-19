import { test } from "node:test";
import assert from "node:assert/strict";

import { resetEnvelopeSequence } from "../src/envelope.js";
import { runReferenceWatchScenario } from "../src/pipeline.js";
import { DOMAIN, OUTCOME_ID, SENSOR_ID, T0_REGISTERED, T1_OBSERVED, T3_RESOLVED, WATCH_AGENT_ID } from "../src/scenario.js";
import type { Prediction } from "@reality-observatory/ontology";

function closeTo(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

test("RI-001 positive: Sensor Registry accepts registration and heartbeat", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceWatchScenario();

  const sensor = await pipeline.sensorRegistry.getSensor(SENSOR_ID);
  assert.ok(sensor, "sensor should be registered");
  assert.equal(sensor?.status, "active");
  assert.equal(sensor?.lastSeenAt, T1_OBSERVED);
  assert.equal(sensor?.ownerAgentId, WATCH_AGENT_ID);
});

test("RI-001 positive: every ontology fact type is published, in causally valid order", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceWatchScenario();

  const topics = pipeline.bus.published.map((envelope) => envelope.topic);
  const countOf = (topic: string) => topics.filter((t) => t === topic).length;

  assert.equal(topics.length, 10, `unexpected envelope count: ${JSON.stringify(topics)}`);
  assert.equal(countOf(`sensor.reference.thermometer`), 2, "register + heartbeat");
  assert.equal(countOf(`signal.${DOMAIN}`), 1);
  assert.equal(countOf(`evidence.${DOMAIN}`), 1);
  assert.equal(countOf(`event.${DOMAIN}`), 1);
  assert.equal(countOf(`hypothesis.${DOMAIN}`), 2, "proposed + corroborated");
  assert.equal(countOf(`prediction.${DOMAIN}`), 2, "pending + resolved");
  assert.equal(countOf(`outcome.${DOMAIN}`), 1);

  // Causal ordering invariants that must hold regardless of exact indices:
  // Evidence precedes the Event it correlates into; the Event precedes the
  // Outcome that references it (docs/adr/0007); the Outcome precedes the
  // Prediction's terminal republish (docs/adr/0009).
  const firstIndexOf = (topic: string) => topics.indexOf(topic);
  const lastIndexOf = (topic: string) => topics.lastIndexOf(topic);
  assert.ok(firstIndexOf(`evidence.${DOMAIN}`) < firstIndexOf(`event.${DOMAIN}`));
  assert.ok(firstIndexOf(`event.${DOMAIN}`) < firstIndexOf(`outcome.${DOMAIN}`));
  assert.ok(firstIndexOf(`outcome.${DOMAIN}`) < lastIndexOf(`prediction.${DOMAIN}`));
});

test("RI-001 positive: Prediction reaches a confirmed terminal state via Outcome (ADR-0009)", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceWatchScenario();

  const predictionEnvelopes = pipeline.bus.published.filter((envelope) => envelope.topic === `prediction.${DOMAIN}`);
  assert.equal(predictionEnvelopes.length, 2);

  const [pending, resolved] = predictionEnvelopes.map((envelope) => envelope.payload as Prediction);
  assert.equal(pending?.status, "pending");
  assert.equal(resolved?.status, "confirmed");
  assert.equal(resolved?.resolvingOutcomeId, OUTCOME_ID);
  assert.equal(resolved?.id, pending?.id, "republish must keep the same Prediction id");
  assert.equal(resolved?.resolvedAt, T3_RESOLVED);
});

test("RI-001 positive: Outcome ingestion produces a Domain Trust update for the predicting Agent", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceWatchScenario();

  const agentTrust = await pipeline.trustEngine.getTrust({ type: "agent", id: WATCH_AGENT_ID }, DOMAIN);
  assert.ok(agentTrust, "expected a Domain Trust record for the Watch agent");
  assert.equal(agentTrust?.domain, DOMAIN);
  assert.equal(agentTrust?.subject.id, WATCH_AGENT_ID);
  closeTo(agentTrust!.score, 0.65); // 0.5 baseline + 0.15 confirmed-outcome delta

  const history = await pipeline.trustEngine.getTrustHistory(
    { type: "agent", id: WATCH_AGENT_ID },
    DOMAIN,
    { from: T0_REGISTERED, to: T3_RESOLVED }
  );
  assert.equal(history.length, 1, "exactly one resolved Outcome should have produced exactly one Trust update");
});

test("RI-001 positive: Evidence ingestion produces a Domain Trust update for the originating Sensor", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceWatchScenario();

  const sensorTrust = await pipeline.trustEngine.getTrust({ type: "sensor", id: SENSOR_ID }, DOMAIN);
  assert.ok(sensorTrust, "expected a Domain Trust record for the Sensor");
  assert.equal(sensorTrust?.domain, DOMAIN);
  closeTo(sensorTrust!.score, 0.5 + 0.05 * 0.82); // supports polarity delta from EVIDENCE_STRENGTH
});

test("RI-001 positive: the scenario is fully deterministic across independent runs", async () => {
  resetEnvelopeSequence();
  const first = await runReferenceWatchScenario();
  const firstTopics = first.bus.published.map((e) => e.topic);
  const firstAgentTrust = await first.trustEngine.getTrust({ type: "agent", id: WATCH_AGENT_ID }, DOMAIN);
  const firstSensorTrust = await first.trustEngine.getTrust({ type: "sensor", id: SENSOR_ID }, DOMAIN);

  resetEnvelopeSequence();
  const second = await runReferenceWatchScenario();
  const secondTopics = second.bus.published.map((e) => e.topic);
  const secondAgentTrust = await second.trustEngine.getTrust({ type: "agent", id: WATCH_AGENT_ID }, DOMAIN);
  const secondSensorTrust = await second.trustEngine.getTrust({ type: "sensor", id: SENSOR_ID }, DOMAIN);

  assert.deepEqual(firstTopics, secondTopics);
  assert.equal(firstAgentTrust?.score, secondAgentTrust?.score);
  assert.equal(firstSensorTrust?.score, secondSensorTrust?.score);
  assert.deepEqual(
    first.bus.published.map((e) => e.id),
    second.bus.published.map((e) => e.id),
    "envelope ids must also be identical run-to-run once the sequence counter is reset"
  );
});
