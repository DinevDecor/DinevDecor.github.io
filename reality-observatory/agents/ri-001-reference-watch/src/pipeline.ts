import type { AgentContext } from "@reality-observatory/agent-sdk";
import type { CorrelationContext } from "@reality-observatory/correlation-engine";
import type { AgentId, Domain } from "@reality-observatory/ontology";

import { InMemoryEventBus } from "./fixtures/InMemoryEventBus.js";
import { InMemorySensorRegistry, createOwnSensorRegistryFor } from "./fixtures/InMemorySensorRegistry.js";
import { InMemoryTrustEngine } from "./fixtures/InMemoryTrustEngine.js";
import { CorrelationEngineRegistry } from "./fixtures/CorrelationEngineRegistry.js";
import { createConsoleLogger, createFixedClock, createInMemoryStorage } from "./fixtures/support.js";
import { ReferenceWatchAgent } from "./ReferenceWatchAgent.js";
import { ReferenceCorrelationEngine } from "./ReferenceCorrelationEngine.js";
import { DOMAIN, WATCH_AGENT_ID } from "./scenario.js";

const FIXED_CLOCK_ISO = "2026-01-01T00:00:00.000Z";

export function createAgentContext(
  agentId: AgentId,
  bus: InMemoryEventBus,
  sensorRegistry: InMemorySensorRegistry,
  trustEngine: InMemoryTrustEngine
): AgentContext {
  return {
    agentId,
    bus,
    trust: trustEngine,
    sensorRegistry,
    ownSensors: createOwnSensorRegistryFor(agentId, sensorRegistry),
    storage: createInMemoryStorage(),
    logger: createConsoleLogger(`ri001:${agentId}`),
    clock: createFixedClock(FIXED_CLOCK_ISO),
  };
}

export function createCorrelationContext(
  engineId: string,
  domain: Domain,
  bus: InMemoryEventBus,
  sensorRegistry: InMemorySensorRegistry,
  trustEngine: InMemoryTrustEngine
): CorrelationContext {
  return {
    engineId,
    domain,
    bus,
    trust: trustEngine,
    sensorRegistry,
    storage: createInMemoryStorage(),
    logger: createConsoleLogger(`ri001:${engineId}`),
    clock: createFixedClock(FIXED_CLOCK_ISO),
  };
}

export interface Pipeline {
  readonly bus: InMemoryEventBus;
  readonly sensorRegistry: InMemorySensorRegistry;
  readonly trustEngine: InMemoryTrustEngine;
  readonly correlationRegistry: CorrelationEngineRegistry;
  readonly watchAgent: ReferenceWatchAgent;
  readonly correlationEngine: ReferenceCorrelationEngine;
}

/**
 * Wires the minimal in-memory kernel fixtures together and constructs the
 * AgentContext / CorrelationContext exactly as a real runtime would (per
 * docs/adr/0003, docs/adr/0010) — no shortcuts bypassing the actual
 * contracts. Returns the handles so tests can drive additional scenarios
 * (a second Correlation Engine registration, a non-owner Sensor write,
 * an out-of-domain Trust query) against the same wiring.
 */
export async function buildPipeline(): Promise<Pipeline> {
  const bus = new InMemoryEventBus();
  const sensorRegistry = new InMemorySensorRegistry(bus);
  const trustEngine = new InMemoryTrustEngine(bus);
  const correlationRegistry = new CorrelationEngineRegistry();

  const correlationEngine = new ReferenceCorrelationEngine();
  correlationRegistry.register(correlationEngine);
  await correlationEngine.onInit(
    createCorrelationContext(correlationEngine.manifest.id, DOMAIN, bus, sensorRegistry, trustEngine)
  );
  await correlationEngine.onStart();
  await bus.subscribe(`evidence.${DOMAIN}`, async (envelope) => {
    await correlationEngine.onEvidence(envelope.payload as Parameters<typeof correlationEngine.onEvidence>[0]);
  });

  const watchAgent = new ReferenceWatchAgent();
  await watchAgent.onInit(createAgentContext(WATCH_AGENT_ID, bus, sensorRegistry, trustEngine));
  await bus.subscribe(`event.${DOMAIN}`, async (envelope) => {
    await watchAgent.onEvent(envelope);
  });

  return { bus, sensorRegistry, trustEngine, correlationRegistry, watchAgent, correlationEngine };
}

/** Runs RI-001 end to end: builds the pipeline, then drives the Watch agent's deterministic scenario. */
export async function runReferenceWatchScenario(): Promise<Pipeline> {
  const pipeline = await buildPipeline();
  await pipeline.watchAgent.onStart();
  return pipeline;
}
