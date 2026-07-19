import type { Topic } from "@reality-observatory/event-bus";
import type { AgentCapability } from "./capabilities.js";

/** How the runtime isolates an agent's execution. Chosen by the runtime, not self-declared trust. */
export type SandboxMode = "in-process" | "subprocess" | "container";

export interface ResourceProfile {
  readonly cpuMillicores?: number;
  readonly memoryMb?: number;
  readonly timeoutMs?: number;
}

export interface AgentIo {
  /** Topic patterns this agent subscribes to, e.g. "signal.iot.*". */
  readonly consumesTopics: readonly Topic[];
  /** Topic patterns this agent is allowed to publish to. */
  readonly producesTopics: readonly Topic[];
}

/**
 * Static, declarative description of an agent — validated by the runtime
 * before activation. Nothing an agent does at runtime may exceed what is
 * declared here (see docs/adr/0003-agent-sdk-and-isolation-model.md).
 */
export interface AgentManifest {
  /** Stable, unique identifier across the whole fleet. */
  readonly id: string;
  readonly displayName: string;
  /** Semver. */
  readonly version: string;
  /** Owning team or contact. */
  readonly owner: string;
  readonly description?: string;
  readonly io: AgentIo;
  readonly capabilities: readonly AgentCapability[];
  readonly sandbox: SandboxMode;
  readonly resourceProfile?: ResourceProfile;
  readonly healthCheckIntervalMs?: number;
}
