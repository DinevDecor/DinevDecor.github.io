import type { AgentId, Provenance, SensorId, Timestamp } from "./common.js";

export type SensorModality =
  | "numeric"
  | "text"
  | "image"
  | "audio"
  | "geospatial"
  | "structured"
  | "derived";

export type SensorStatus = "active" | "degraded" | "offline" | "retired";

export interface SensorCapabilities {
  readonly modality: SensorModality;
  readonly samplingIntervalMs?: number;
  readonly unit?: string;
  readonly geo?: boolean;
}

/**
 * A registered source of Signals — a physical sensor, an API poller, a scraper,
 * a human-input channel, or another agent acting as a data source.
 * Describes the source's capabilities and status, never the data itself.
 */
export interface Sensor extends Provenance {
  readonly id: SensorId;
  /** Namespaced taxonomy, e.g. "iot.temperature", "web.scraper.price". */
  readonly kind: string;
  readonly displayName: string;
  readonly description?: string;
  readonly ownerAgentId: AgentId;
  readonly capabilities: SensorCapabilities;
  readonly status: SensorStatus;
  readonly registeredAt: Timestamp;
  readonly lastSeenAt?: Timestamp;
}
