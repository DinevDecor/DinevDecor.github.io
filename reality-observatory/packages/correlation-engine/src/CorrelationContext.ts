import type { Domain } from "@reality-observatory/ontology";
import type { TrustEngineReader } from "@reality-observatory/trust-engine";
import type { SensorRegistryReader } from "@reality-observatory/sensor-registry";
import type { CorrelationEventBus } from "./CorrelationEventBus.js";

export interface CorrelationLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Key-value storage namespaced per Correlation Engine instance. */
export interface CorrelationStorage {
  get<TValue>(key: string): Promise<TValue | undefined>;
  set<TValue>(key: string, value: TValue): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CorrelationClock {
  now(): Date;
}

/**
 * The sole gateway a Correlation Engine instance has to the outside world.
 * Deliberately defined in this package rather than reusing AgentContext —
 * a Correlation Engine is not a kind of Agent (see docs/adr/0010). Scoped
 * to the single `domain` declared in the instance's own manifest. `bus` is
 * a CorrelationEventBus, not the unrestricted EventBus nor the Agent SDK's
 * AgentEventBus — its publish surface is its own distinct type, so its
 * exclusive authority over Event (and Hypothesis) is a compile-time
 * guarantee, not only a runtime/ADR convention (docs/adr/0011).
 */
export interface CorrelationContext {
  readonly engineId: string;
  readonly domain: Domain;
  readonly bus: CorrelationEventBus;
  readonly trust: TrustEngineReader;
  readonly sensorRegistry: SensorRegistryReader;
  readonly storage: CorrelationStorage;
  readonly logger: CorrelationLogger;
  readonly clock: CorrelationClock;
}
