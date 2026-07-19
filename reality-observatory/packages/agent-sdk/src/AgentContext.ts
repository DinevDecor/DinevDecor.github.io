import type { AgentId } from "@reality-observatory/ontology";
import type { EventBus } from "@reality-observatory/event-bus";
import type { TrustEngineReader } from "@reality-observatory/trust-engine";

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
 * agents' state (see docs/adr/0003).
 */
export interface AgentContext {
  readonly agentId: AgentId;
  readonly bus: EventBus;
  readonly trust: TrustEngineReader;
  readonly storage: AgentStorage;
  readonly logger: AgentLogger;
  readonly clock: AgentClock;
}
