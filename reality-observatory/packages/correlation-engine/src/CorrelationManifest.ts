import type { Domain } from "@reality-observatory/ontology";
import type { Topic } from "@reality-observatory/event-bus";

/** How the runtime isolates a Correlation Engine instance's execution. */
export type SandboxMode = "in-process" | "subprocess" | "container";

export interface ResourceProfile {
  readonly cpuMillicores?: number;
  readonly memoryMb?: number;
  readonly timeoutMs?: number;
}

export interface CorrelationIo {
  /** Evidence/Hypothesis topic patterns this engine consumes, e.g. "evidence.weather". */
  readonly consumesTopics: readonly Topic[];
  /** Must resolve to `event.<domain>` / `hypothesis.<domain>` for this engine's own domain. */
  readonly producesTopics: readonly Topic[];
}

/**
 * Static, declarative description of a Correlation Engine instance. The
 * runtime accepts at most one registered instance per `domain` — this is
 * what makes the engine the sole authoritative producer of Event and
 * Hypothesis facts for that domain (see docs/adr/0010).
 */
export interface CorrelationManifest {
  readonly id: string;
  /** The single domain this instance is authoritative for. */
  readonly domain: Domain;
  readonly displayName: string;
  readonly version: string;
  readonly owner: string;
  readonly description?: string;
  readonly io: CorrelationIo;
  readonly sandbox: SandboxMode;
  readonly resourceProfile?: ResourceProfile;
  readonly healthCheckIntervalMs?: number;
}
