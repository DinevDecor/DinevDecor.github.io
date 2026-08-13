import type { Agent, AgentContext, AgentManifest, HealthStatus } from "@reality-observatory/agent-sdk";
import type { EventEnvelope } from "@reality-observatory/event-bus";
import type { Evidence, Sensor, Signal } from "@reality-observatory/ontology";
import { makeEnvelope } from "./envelope.js";
import { SCHEMA_VERSION } from "./scenario.js";

export interface SensorAgentConfig {
  readonly manifest: AgentManifest;
  readonly sensor: Sensor;
  readonly signal: Signal;
  readonly evidence: Evidence;
}

/**
 * Generic reference sensor agent for RI-002: registers its one owned
 * Sensor, emits its fixed Signal, then publishes its fixed Evidence.
 * Reused for all three independent sources (Reuters, EIA, Satellite)
 * rather than writing three near-identical classes — each instance still
 * has its own manifest, its own Sensor, and never imports another agent's
 * module (docs/repository-structure.md's no-cross-agent-imports rule is
 * about separate `agents/<agent-id>/` folders, not this in-package reuse).
 */
export class ReferenceSensorAgent implements Agent {
  readonly manifest: AgentManifest;
  private context: AgentContext | undefined;

  constructor(private readonly config: SensorAgentConfig) {
    this.manifest = config.manifest;
  }

  async onInit(context: AgentContext): Promise<void> {
    this.context = context;
  }

  async onStart(): Promise<void> {
    const ctx = this.requireContext();
    const { sensor, signal, evidence } = this.config;

    // Observation: register and heartbeat the owned Sensor through the
    // Sensor Registry's owner-scoped writer (docs/adr/0005).
    await ctx.ownSensors.register(sensor);
    await ctx.ownSensors.heartbeat(sensor.id, signal.capturedAt);

    // Observation: emit the fixed Signal reading.
    await ctx.bus.publish(makeEnvelope(`signal.${evidence.domain}`, signal, this.manifest.id, signal.capturedAt, SCHEMA_VERSION));

    // Evidence: interpret the Signal. Publishing this synchronously may
    // trigger the Correlation Engine (subscribed to evidence.<domain>) if
    // quorum is reached, and always triggers the Trust Engine's ingestion —
    // both complete before this publish() call resolves.
    await ctx.bus.publish(makeEnvelope(`evidence.${evidence.domain}`, evidence, this.manifest.id, evidence.observedAt, SCHEMA_VERSION));
  }

  async onEvent(_envelope: EventEnvelope<unknown>): Promise<void> {
    // Sensor agents don't react to Events in this scenario; the Analyst
    // agent does (see ReferenceAnalystAgent.ts).
  }

  async onHealthCheck(): Promise<HealthStatus> {
    return "healthy";
  }

  async onShutdown(): Promise<void> {
    this.context = undefined;
  }

  private requireContext(): AgentContext {
    if (!this.context) throw new Error(`ReferenceSensorAgent "${this.manifest.id}" used before onInit`);
    return this.context;
  }
}
