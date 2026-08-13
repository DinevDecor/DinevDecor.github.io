import { test } from "node:test";
import assert from "node:assert/strict";

import { makeEnvelope, resetEnvelopeSequence } from "../src/envelope.js";
import { buildPipeline, createAgentContext, runReferenceWatchScenario } from "../src/pipeline.js";
import { CorrelationEngineRegistry, DomainAlreadyOwnedError } from "../src/fixtures/CorrelationEngineRegistry.js";
import {
  SensorAlreadyRegisteredError,
  SensorNotFoundError,
  SensorOwnershipError,
} from "../src/fixtures/InMemorySensorRegistry.js";
import { PredictionAlreadyResolvedError } from "../src/fixtures/predictionLifecycle.js";
import { ReferenceCorrelationEngine } from "../src/ReferenceCorrelationEngine.js";
import {
  DOMAIN,
  INTRUDER_AGENT_ID,
  OTHER_DOMAIN,
  PREDICTION_RESOLVED,
  SCHEMA_VERSION,
  SENSOR,
  SENSOR_ID,
  T1_OBSERVED,
  T3_RESOLVED,
  WATCH_AGENT_ID,
} from "../src/scenario.js";

test("RI-001 negative: a non-owner agent cannot write to a Sensor it doesn't own (ADR-0005)", async () => {
  const pipeline = await buildPipeline();
  const ownerContext = createAgentContext(WATCH_AGENT_ID, pipeline.bus, pipeline.sensorRegistry, pipeline.trustEngine);
  await ownerContext.ownSensors.register(SENSOR);

  const intruderContext = createAgentContext(
    INTRUDER_AGENT_ID,
    pipeline.bus,
    pipeline.sensorRegistry,
    pipeline.trustEngine
  );
  await assert.rejects(
    () => intruderContext.ownSensors.updateStatus(SENSOR_ID, "offline", T1_OBSERVED),
    SensorOwnershipError
  );

  // The legitimate owner is unaffected by the rejected intrusion attempt.
  await assert.doesNotReject(() => ownerContext.ownSensors.heartbeat(SENSOR_ID, T1_OBSERVED));
  const sensor = await pipeline.sensorRegistry.getSensor(SENSOR_ID);
  assert.equal(sensor?.status, "active", "the rejected write must not have taken effect");
});

test("RI-001 negative: registering a Sensor under someone else's ownerAgentId is rejected at register-time", async () => {
  const pipeline = await buildPipeline();
  const intruderContext = createAgentContext(
    INTRUDER_AGENT_ID,
    pipeline.bus,
    pipeline.sensorRegistry,
    pipeline.trustEngine
  );
  await assert.rejects(() => intruderContext.ownSensors.register(SENSOR), SensorOwnershipError);
  assert.equal(await pipeline.sensorRegistry.getSensor(SENSOR_ID), undefined);
});

test("RI-001 negative: a Sensor cannot be registered twice under the same id", async () => {
  const pipeline = await buildPipeline();
  const ownerContext = createAgentContext(WATCH_AGENT_ID, pipeline.bus, pipeline.sensorRegistry, pipeline.trustEngine);
  await ownerContext.ownSensors.register(SENSOR);
  await assert.rejects(() => ownerContext.ownSensors.register(SENSOR), SensorAlreadyRegisteredError);
});

test("RI-001 negative: writing to an unregistered Sensor id is rejected", async () => {
  const pipeline = await buildPipeline();
  const ownerContext = createAgentContext(WATCH_AGENT_ID, pipeline.bus, pipeline.sensorRegistry, pipeline.trustEngine);
  await assert.rejects(() => ownerContext.ownSensors.heartbeat(SENSOR_ID, T1_OBSERVED), SensorNotFoundError);
});

test("RI-001 negative: a domain can have at most one registered Correlation Engine (ADR-0010)", () => {
  const registry = new CorrelationEngineRegistry();
  const first = new ReferenceCorrelationEngine();
  const second = new ReferenceCorrelationEngine();
  registry.register(first);
  assert.throws(() => registry.register(second), DomainAlreadyOwnedError);
});

test("RI-001 negative: Domain Trust is isolated — invisible when queried under a different domain (ADR-0008)", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceWatchScenario();

  const trustInOtherDomain = await pipeline.trustEngine.getTrust({ type: "agent", id: WATCH_AGENT_ID }, OTHER_DOMAIN);
  assert.equal(trustInOtherDomain, undefined, "a domain that never received Evidence/Outcome must have no Trust");

  const trustInOwnDomain = await pipeline.trustEngine.getTrust({ type: "agent", id: WATCH_AGENT_ID }, DOMAIN);
  assert.ok(trustInOwnDomain, "sanity check: the same subject does have Trust in the domain it actually acted in");
});

test("RI-001 negative: a terminal Prediction cannot transition again (ADR-0009)", async () => {
  resetEnvelopeSequence();
  const pipeline = await runReferenceWatchScenario();

  const repeatAttempt = { ...PREDICTION_RESOLVED, status: "falsified" as const };
  await assert.rejects(
    () =>
      pipeline.bus.publish(
        makeEnvelope(`prediction.${DOMAIN}`, repeatAttempt, WATCH_AGENT_ID, T3_RESOLVED, SCHEMA_VERSION)
      ),
    PredictionAlreadyResolvedError
  );
});
