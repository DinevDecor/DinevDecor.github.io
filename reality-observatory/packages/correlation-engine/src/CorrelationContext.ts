import type { Domain } from "@reality-observatory/ontology";
import type { EventBus } from "@reality-observatory/event-bus";
import type { TrustEngineReader } from "@reality-observatory/trust-engine";
import type { SensorRegistryReader } from "@reality-observatory/sensor-registry";

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
 * to the single `domain` declared in the instance's own manifest.
 */
export interface CorrelationContext {
  readonly engineId: string;
  readonly domain: Domain;
  readonly bus: EventBus;
  readonly trust: TrustEngineReader;
  readonly sensorRegistry: SensorRegistryReader;
  readonly storage: CorrelationStorage;
  readonly logger: CorrelationLogger;
  readonly clock: CorrelationClock;
}
