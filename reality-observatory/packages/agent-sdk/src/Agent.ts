import type { EventEnvelope } from "@reality-observatory/event-bus";
import type { AgentContext } from "./AgentContext.js";
import type { AgentManifest } from "./AgentManifest.js";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * The contract every independently developed agent implements. This is the
 * only way to add a capability to Reality Observatory (see docs/adr/0001
 * and docs/adr/0003) — the kernel never contains agent-specific logic.
 */
export interface Agent {
  readonly manifest: AgentManifest;
  onInit(context: AgentContext): Promise<void>;
  onStart(): Promise<void>;
  onEvent(envelope: EventEnvelope<unknown>): Promise<void>;
  onHealthCheck(): Promise<HealthStatus>;
  onShutdown(): Promise<void>;
}
