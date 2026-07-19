import type { AgentId } from "@reality-observatory/ontology";
import type { TrustEngineReader } from "@reality-observatory/trust-engine";
import type { SensorRegistryReader, SensorRegistryWriter } from "@reality-observatory/sensor-registry";
import type { AgentEventBus } from "./AgentEventBus.js";

export interface AgentLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Key-value storage namespaced per agent; one agent can never read another's. */
export interface AgentStorage {
  get<TValue>(key: string): Promise<TValue | undefined>;
  set<TValue>(key: string, value: TValue): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface AgentClock {
  now(): Date;
}

/**
 * The sole gateway an agent has to the outside world. Injected by the
 * runtime, scoped exactly to the topics and capabilities declared in the
 * agent's own manifest — no ambient access to the kernel or to other
 * agents' state (see docs/adr/0003). `bus` is an AgentEventBus, not the
 * unrestricted EventBus — publishing an Event is unrepresentable here at
 * the type level, not merely undeclared as a capability (docs/adr/0011).
 *
 * `sensorRegistry` is read-only discovery (gated by `sensor:discover`).
 * `ownSensors` is the write path for Sensors this agent owns (gated by
 * `sensor:register`) — the runtime binds it per-agent and must reject any
 * write whose target Sensor's `ownerAgentId` doesn't match `agentId`; this
 * ownership check is runtime-enforced, not type-enforced, per the carve-out
 * in docs/adr/0011 (SensorId uniqueness/ownership isn't expressible purely
 * in types). See docs/adr/0005.
 */
export interface AgentContext {
  readonly agentId: AgentId;
  readonly bus: AgentEventBus;
  readonly trust: TrustEngineReader;
  readonly sensorRegistry: SensorRegistryReader;
  readonly ownSensors: SensorRegistryWriter;
  readonly storage: AgentStorage;
  readonly logger: AgentLogger;
  readonly clock: AgentClock;
}
