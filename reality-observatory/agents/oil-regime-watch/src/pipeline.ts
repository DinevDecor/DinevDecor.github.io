import type { AgentContext, AgentManifest } from "@reality-observatory/agent-sdk";
import type { CorrelationContext } from "@reality-observatory/correlation-engine";
import type { AgentId, Domain } from "@reality-observatory/ontology";

import { InMemoryEventBus } from "./fixtures/InMemoryEventBus.js";
import { InMemorySensorRegistry, createOwnSensorRegistryFor } from "./fixtures/InMemorySensorRegistry.js";
import { InMemoryTrustEngine } from "./fixtures/InMemoryTrustEngine.js";
import { CorrelationEngineRegistry } from "./fixtures/CorrelationEngineRegistry.js";
import { createConsoleLogger, createFixedClock, createInMemoryStorage, type SupportClock } from "./fixtures/support.js";
import { OilRegimeWatchAgent, type OilRegimeWatchAdapters } from "./OilRegimeWatchAgent.js";
import { OilRegimeCorrelationEngine } from "./OilRegimeCorrelationEngine.js";
import { AGENT_ID, DOMAIN, Topic } from "./domain.js";
import type { ThresholdsConfig } from "./config.js";

const MANIFEST: AgentManifest = {
  id: AGENT_ID,
  displayName: "Oil Regime Watch",
  version: "0.1.0",
  owner: "energy-desk",
  description: "PA-001 — production Watch agent for EIA inventory, OPEC+ announcements, and WTI/Brent spot prices.",
  io: {
    consumesTopics: [Topic.event],
    producesTopics: [Topic.signal, Topic.evidence, Topic.hypothesis, Topic.prediction, Topic.outcome],
  },
  capabilities: [
    "sensor:register",
    "sensor:discover",
    "sensor:emit-signal",
    "evidence:publish",
    "hypothesis:publish",
    "prediction:publish",
    "outcome:publish",
    "trust:read",
    "storage:read",
    "storage:write",
  ],
  sandbox: "in-process",
};

export function createAgentContext(
  agentId: AgentId,
  bus: InMemoryEventBus,
  sensorRegistry: InMemorySensorRegistry,
  trustEngine: InMemoryTrustEngine,
  clock: SupportClock
): AgentContext {
  return {
    agentId,
    bus,
    trust: trustEngine,
    sensorRegistry,
    ownSensors: createOwnSensorRegistryFor(agentId, sensorRegistry),
    storage: createInMemoryStorage(),
    logger: createConsoleLogger(`oil-regime:${agentId}`),
    clock,
  };
}

export function createCorrelationContext(
  engineId: string,
  domain: Domain,
  bus: InMemoryEventBus,
  sensorRegistry: InMemorySensorRegistry,
  trustEngine: InMemoryTrustEngine,
  clock: SupportClock
): CorrelationContext {
  return {
    engineId,
    domain,
    bus,
    trust: trustEngine,
    sensorRegistry,
    storage: createInMemoryStorage(),
    logger: createConsoleLogger(`oil-regime:${engineId}`),
    clock,
  };
}

export interface Pipeline {
  readonly bus: InMemoryEventBus;
  readonly sensorRegistry: InMemorySensorRegistry;
  readonly trustEngine: InMemoryTrustEngine;
  readonly correlationRegistry: CorrelationEngineRegistry;
  readonly correlationEngine: OilRegimeCorrelationEngine;
  readonly agent: OilRegimeWatchAgent;
}

/**
 * Wires the minimal in-memory kernel fixtures together and constructs the
 * real AgentContext / CorrelationContext exactly as a real runtime would
 * (per docs/adr/0003, docs/adr/0010). No production Event Bus / Trust
 * Engine / Sensor Registry exists yet in this repo (see README,
 * "Production readiness") — this is the same fixture pattern RI-001/RI-002
 * used, now testing PA-001's real business logic instead of a fixed
 * reference scenario.
 */
export async function buildPipeline(
  adapters: OilRegimeWatchAdapters,
  thresholds: ThresholdsConfig,
  clockIso = "2026-03-02T00:00:00.000Z"
): Promise<Pipeline> {
  const clock = createFixedClock(clockIso);
  const bus = new InMemoryEventBus();
  const sensorRegistry = new InMemorySensorRegistry(bus);
  const trustEngine = new InMemoryTrustEngine(bus);
  const correlationRegistry = new CorrelationEngineRegistry();

  const correlationEngine = new OilRegimeCorrelationEngine();
  correlationRegistry.register(correlationEngine);
  await correlationEngine.onInit(
    createCorrelationContext(correlationEngine.manifest.id, DOMAIN, bus, sensorRegistry, trustEngine, clock)
  );
  await correlationEngine.onStart();
  await bus.subscribe(Topic.evidence, async (envelope) => {
    await correlationEngine.onEvidence(envelope.payload as Parameters<typeof correlationEngine.onEvidence>[0]);
  });

  const agent = new OilRegimeWatchAgent(adapters, thresholds, MANIFEST);
  await agent.onInit(createAgentContext(AGENT_ID, bus, sensorRegistry, trustEngine, clock));
  await bus.subscribe(Topic.event, async (envelope) => {
    await agent.onEvent(envelope);
  });

  return { bus, sensorRegistry, trustEngine, correlationRegistry, correlationEngine, agent };
}
