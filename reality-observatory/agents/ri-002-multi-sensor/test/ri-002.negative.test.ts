import { test } from "node:test";
import assert from "node:assert/strict";

import { makeEnvelope, resetEnvelopeSequence } from "../src/envelope.js";
import { buildPipeline, createAgentContext } from "../src/pipeline.js";
import { CorrelationEngineRegistry, DomainAlreadyOwnedError } from "../src/fixtures/CorrelationEngineRegistry.js";
import { SensorOwnershipError } from "../src/fixtures/InMemorySensorRegistry.js";
import { ReferenceCorrelationEngine } from "../src/ReferenceCorrelationEngine.js";
import {
  CROSS_DOMAIN_EVIDENCE,
  DOMAIN,
  EIA_EVIDENCE,
  INTRUDER_AGENT_ID,
  OTHER_DOMAIN,
  REUTERS_AGENT_ID,
  REUTERS_EVIDENCE,
  REUTERS_SENSOR,
  REUTERS_SENSOR_ID,
  SATELLITE_EVIDENCE,
  SCHEMA_VERSION,
  T1_REUTERS,
  UNRELATED_EVIDENCE,
} from "../src/scenario.js";
import type { Event } from "@reality-observatory/ontology";

function evidenceEnvelope(evidence: typeof REUTERS_EVIDENCE, producer: string) {
  return makeEnvelope(`evidence.${evidence.domain}`, evidence, producer, evidence.observedAt, SCHEMA_VERSION);
}

test("RI-002 negative: identical Evidence (same id, resubmitted) never creates a duplicate Event", async () => {
  resetEnvelopeSequence();
  const pipeline = await buildPipeline();

  // Resubmitting the same EvidenceId before quorum must not inflate the count.
  await pipeline.bus.publish(evidenceEnvelope(REUTERS_EVIDENCE, REUTERS_AGENT_ID));
  await pipeline.bus.publish(evidenceEnvelope(REUTERS_EVIDENCE, REUTERS_AGENT_ID));
  await pipeline.bus.publish(evidenceEnvelope(REUTERS_EVIDENCE, REUTERS_AGENT_ID));
  let events = pipeline.bus.published.filter((e) => e.topic === `event.${DOMAIN}`);
  assert.equal(events.length, 0, "three identical submissions of the same Evidence must still count as one source");

  await pipeline.bus.publish(evidenceEnvelope(EIA_EVIDENCE, REUTERS_AGENT_ID));
  await pipeline.bus.publish(evidenceEnvelope(SATELLITE_EVIDENCE, REUTERS_AGENT_ID));
  events = pipeline.bus.published.filter((e) => e.topic === `event.${DOMAIN}`);
  assert.equal(events.length, 1, "the real third distinct source must still complete the quorum exactly once");

  // Resubmitting after emission must not create a second Event either.
  await pipeline.bus.publish(evidenceEnvelope(REUTERS_EVIDENCE, REUTERS_AGENT_ID));
  events = pipeline.bus.published.filter((e) => e.topic === `event.${DOMAIN}`);
  assert.equal(events.length, 1, "re-delivery after the canonical Event already exists must be a no-op");
});

test("RI-002 negative: unrelated Evidence (different claim, same domain) is never merged", async () => {
  resetEnvelopeSequence();
  const pipeline = await buildPipeline();

  await pipeline.bus.publish(evidenceEnvelope(REUTERS_EVIDENCE, REUTERS_AGENT_ID));
  await pipeline.bus.publish(evidenceEnvelope(EIA_EVIDENCE, REUTERS_AGENT_ID));
  await pipeline.bus.publish(evidenceEnvelope(UNRELATED_EVIDENCE, REUTERS_AGENT_ID));

  let events = pipeline.bus.published.filter((e) => e.topic === `event.${DOMAIN}`);
  assert.equal(events.length, 0, "unrelated Evidence must not count toward the inventory-build quorum");

  await pipeline.bus.publish(evidenceEnvelope(SATELLITE_EVIDENCE, REUTERS_AGENT_ID));
  events = pipeline.bus.published.filter((e) => e.topic === `event.${DOMAIN}`);
  assert.equal(events.length, 1);
  const event = events[0]!.payload as Event;
  assert.ok(!event.evidenceRefs.includes(UNRELATED_EVIDENCE.id), "the unrelated Evidence must never appear in the Event's provenance");
});

test("RI-002 negative: Evidence from a different Domain is never correlated, even with an identical claim", async () => {
  resetEnvelopeSequence();
  const pipeline = await buildPipeline();

  await pipeline.bus.publish(evidenceEnvelope(REUTERS_EVIDENCE, REUTERS_AGENT_ID));
  await pipeline.bus.publish(evidenceEnvelope(EIA_EVIDENCE, REUTERS_AGENT_ID));
  await pipeline.bus.publish(evidenceEnvelope(CROSS_DOMAIN_EVIDENCE, REUTERS_AGENT_ID));

  assert.equal(CROSS_DOMAIN_EVIDENCE.claim, REUTERS_EVIDENCE.claim, "sanity check: same claim text as the real evidence");
  assert.equal(CROSS_DOMAIN_EVIDENCE.domain, OTHER_DOMAIN);

  let events = pipeline.bus.published.filter((e) => e.topic === `event.${DOMAIN}`);
  assert.equal(events.length, 0, "an identical claim in a different Domain must not count toward this Domain's quorum");

  await pipeline.bus.publish(evidenceEnvelope(SATELLITE_EVIDENCE, REUTERS_AGENT_ID));
  events = pipeline.bus.published.filter((e) => e.topic === `event.${DOMAIN}`);
  assert.equal(events.length, 1);
  const event = events[0]!.payload as Event;
  assert.ok(!event.evidenceRefs.includes(CROSS_DOMAIN_EVIDENCE.id));
});

test("RI-002 negative: an Event cannot exist without sufficient supporting Evidence", async () => {
  resetEnvelopeSequence();
  const pipeline = await buildPipeline();

  await pipeline.bus.publish(evidenceEnvelope(REUTERS_EVIDENCE, REUTERS_AGENT_ID));
  await pipeline.bus.publish(evidenceEnvelope(EIA_EVIDENCE, REUTERS_AGENT_ID));

  const events = pipeline.bus.published.filter((e) => e.topic === `event.${DOMAIN}`);
  assert.equal(events.length, 0, "two independent sources are not enough evidence to justify an Event in this scenario");
});

test("RI-002 negative: a non-owner agent cannot write to a Sensor it doesn't own (ADR-0005)", async () => {
  const pipeline = await buildPipeline();
  const ownerContext = createAgentContext(REUTERS_AGENT_ID, pipeline.bus, pipeline.sensorRegistry, pipeline.trustEngine);
  await ownerContext.ownSensors.register(REUTERS_SENSOR);

  const intruderContext = createAgentContext(INTRUDER_AGENT_ID, pipeline.bus, pipeline.sensorRegistry, pipeline.trustEngine);
  await assert.rejects(
    () => intruderContext.ownSensors.updateStatus(REUTERS_SENSOR_ID, "offline", T1_REUTERS),
    SensorOwnershipError
  );
});

test("RI-002 negative: a Domain can have at most one registered Correlation Engine (ADR-0010)", () => {
  const registry = new CorrelationEngineRegistry();
  const first = new ReferenceCorrelationEngine();
  const second = new ReferenceCorrelationEngine();
  registry.register(first);
  assert.throws(() => registry.register(second), DomainAlreadyOwnedError);
});
