import type { Sensor, SensorCapabilities, SensorId, SensorStatus, Timestamp } from "@reality-observatory/ontology";
import type { Subscription } from "@reality-observatory/event-bus";

export interface SensorQuery {
  readonly kind?: string;
  readonly modality?: SensorCapabilities["modality"];
  readonly status?: SensorStatus;
}

export type SensorChangeHandler = (sensor: Sensor) => Promise<void>;

/**
 * Read-only discovery over the registered Sensor fleet. Exposed to any agent
 * holding the `sensor:discover` capability via AgentContext (see docs/adr/0005).
 */
export interface SensorRegistryReader {
  getSensor(id: SensorId): Promise<Sensor | undefined>;
  findByKind(kind: string): Promise<readonly Sensor[]>;
  list(query?: SensorQuery): Promise<readonly Sensor[]>;
  subscribeToSensorChanges(query: SensorQuery, handler: SensorChangeHandler): Promise<Subscription>;
}

/**
 * Write path into the Sensor Registry. Only the declared `ownerAgentId` of a
 * Sensor (capability `sensor:register`) may call these for that Sensor; the
 * registry rejects writes from any other agent (docs/adr/0005).
 */
export interface SensorRegistryWriter {
  register(sensor: Sensor): Promise<void>;
  updateStatus(id: SensorId, status: SensorStatus, at: Timestamp): Promise<void>;
  heartbeat(id: SensorId, at: Timestamp): Promise<void>;
  retire(id: SensorId, at: Timestamp): Promise<void>;
}

/**
 * The Sensor Registry is core infrastructure, not a pluggable agent: it is
 * the sole writer of Sensor facts and the sole authority on SensorId
 * uniqueness (docs/adr/0005).
 */
export interface SensorRegistry extends SensorRegistryReader, SensorRegistryWriter {}
