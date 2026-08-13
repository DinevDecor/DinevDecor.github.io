import type { AgentContext, AgentManifest } from "@reality-observatory/agent-sdk";
import type { CorrelationContext } from "@reality-observatory/correlation-engine";
import type { AgentId, Domain } from "@reality-observatory/ontology";

import { InMemoryEventBus } from "./fixtures/InMemoryEventBus.js";
import { InMemorySensorRegistry, createOwnSensorRegistryFor } from "./fixtures/InMemorySensorRegistry.js";
import { InMemoryTrustEngine } from "./fixtures/InMemoryTrustEngine.js";
import { CorrelationEngineRegistry } from "./fixtures/CorrelationEngineRegistry.js";
import { createConsoleLogger, createFixedClock, createInMemoryStorage } from "./fixtures/support.js";
import { ReferenceSensorAgent } from "./ReferenceSensorAgent.js";
import { ReferenceAnalystAgent } from "./ReferenceAnalystAgent.js";
import { ReferenceCorrelationEngine } from "./ReferenceCorrelationEngine.js";
import {
  DOMAIN,
  EIA_AGENT_ID,
  EIA_EVIDENCE,
  EIA_SENSOR,
  EIA_SIGNAL,
  REUTERS_AGENT_ID,
  REUTERS_EVIDENCE,
  REUTERS_SENSOR,
  REUTERS_SIGNAL,
  SATELLITE_AGENT_ID,
  SATELLITE_EVIDENCE,
  SATELLITE_SENSOR,
  SATELLITE_SIGNAL,
} from "./scenario.js";

const FIXED_CLOCK_ISO = "2026-02-02T00:00:00.000Z";

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
    logger: createConsoleLogger(`ri002:${agentId}`),
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
    logger: createConsoleLogger(`ri002:${engineId}`),
    clock: createFixedClock(FIXED_CLOCK_ISO),
  };
}

const REUTERS_MANIFEST: AgentManifest = {
  id: "ri-002-reuters-feed",
  displayName: "RI-002 Reuters Feed Sensor Agent",
  version: "0.1.0",
  owner: "platform-team",
  description: "Deterministic reference sensor agent for RI-002; publishes newswire-derived Evidence.",
  io: { consumesTopics: [], producesTopics: [`signal.${DOMAIN}`, `evidence.${DOMAIN}`] },
  capabilities: ["sensor:register", "sensor:emit-signal", "evidence:publish", "trust:read", "storage:read", "storage:write"],
  sandbox: "in-process",
};

const EIA_MANIFEST: AgentManifest = {
  id: "ri-002-eia-weekly-inventory",
  displayName: "RI-002 EIA Weekly Inventory Sensor Agent",
  version: "0.1.0",
  owner: "platform-team",
  description: "Deterministic reference sensor agent for RI-002; publishes EIA weekly inventory Evidence.",
  io: { consumesTopics: [], producesTopics: [`signal.${DOMAIN}`, `evidence.${DOMAIN}`] },
  capabilities: ["sensor:register", "sensor:emit-signal", "evidence:publish", "trust:read", "storage:read", "storage:write"],
  sandbox: "in-process",
};

const SATELLITE_MANIFEST: AgentManifest = {
  id: "ri-002-satellite-observation",
  displayName: "RI-002 Satellite Observation Sensor Agent",
  version: "0.1.0",
  owner: "platform-team",
  description: "Deterministic reference sensor agent for RI-002; publishes satellite tank-imagery Evidence.",
  io: { consumesTopics: [], producesTopics: [`signal.${DOMAIN}`, `evidence.${DOMAIN}`] },
  capabilities: ["sensor:register", "sensor:emit-signal", "evidence:publish", "trust:read", "storage:read", "storage:write"],
  sandbox: "in-process",
};

export interface Pipeline {
  readonly bus: InMemoryEventBus;
  readonly sensorRegistry: InMemorySensorRegistry;
  readonly trustEngine: InMemoryTrustEngine;
  readonly correlationRegistry: CorrelationEngineRegistry;
  readonly correlationEngine: ReferenceCorrelationEngine;
  readonly reutersAgent: ReferenceSensorAgent;
  readonly eiaAgent: ReferenceSensorAgent;
  readonly satelliteAgent: ReferenceSensorAgent;
  readonly analystAgent: ReferenceAnalystAgent;
}

/**
 * Wires the minimal in-memory kernel fixtures together and constructs every
 * AgentContext / CorrelationContext exactly as a real runtime would (per
 * docs/adr/0003, docs/adr/0010) — no shortcuts bypassing the actual
 * contracts. Three independent sensor agents and one analyst agent share
 * the same bus/registry/trust engine, exactly as independently developed
 * agents would in production.
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

  const reutersAgent = new ReferenceSensorAgent({
    manifest: REUTERS_MANIFEST,
    sensor: REUTERS_SENSOR,
    signal: REUTERS_SIGNAL,
    evidence: REUTERS_EVIDENCE,
  });
  await reutersAgent.onInit(createAgentContext(REUTERS_AGENT_ID, bus, sensorRegistry, trustEngine));

  const eiaAgent = new ReferenceSensorAgent({
    manifest: EIA_MANIFEST,
    sensor: EIA_SENSOR,
    signal: EIA_SIGNAL,
    evidence: EIA_EVIDENCE,
  });
  await eiaAgent.onInit(createAgentContext(EIA_AGENT_ID, bus, sensorRegistry, trustEngine));

  const satelliteAgent = new ReferenceSensorAgent({
    manifest: SATELLITE_MANIFEST,
    sensor: SATELLITE_SENSOR,
    signal: SATELLITE_SIGNAL,
    evidence: SATELLITE_EVIDENCE,
  });
  await satelliteAgent.onInit(createAgentContext(SATELLITE_AGENT_ID, bus, sensorRegistry, trustEngine));

  const analystAgent = new ReferenceAnalystAgent();
  await analystAgent.onInit(createAgentContext(analystAgent.manifest.id as AgentId, bus, sensorRegistry, trustEngine));
  await analystAgent.onStart();
  await bus.subscribe(`event.${DOMAIN}`, async (envelope) => {
    await analystAgent.onEvent(envelope);
  });

  return { bus, sensorRegistry, trustEngine, correlationRegistry, correlationEngine, reutersAgent, eiaAgent, satelliteAgent, analystAgent };
}

/**
 * Runs RI-002 end to end: builds the pipeline, then drives all three
 * independent sensor agents in a fixed order (Reuters, EIA, Satellite).
 * The Satellite agent's Evidence publish is the one that reaches quorum,
 * synchronously triggering the Correlation Engine's Event, which
 * synchronously triggers the Analyst agent's whole Hypothesis -> Prediction
 * -> Outcome reaction — all nested awaits resolve before this function
 * returns.
 */
export async function runReferenceScenario(): Promise<Pipeline> {
  const pipeline = await buildPipeline();
  await pipeline.reutersAgent.onStart();
  await pipeline.eiaAgent.onStart();
  await pipeline.satelliteAgent.onStart();
  return pipeline;
}
