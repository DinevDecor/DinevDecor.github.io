import type { AgentId } from "@reality-observatory/ontology";
import type { TrustEngineReader } from "@reality-observatory/trust-engine";
import type { SensorRegistryReader } from "@reality-observatory/sensor-registry";
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
 */
export interface AgentContext {
  readonly agentId: AgentId;
  readonly bus: AgentEventBus;
  readonly trust: TrustEngineReader;
  readonly sensorRegistry: SensorRegistryReader;
  readonly storage: AgentStorage;
  readonly logger: AgentLogger;
  readonly clock: AgentClock;
}
