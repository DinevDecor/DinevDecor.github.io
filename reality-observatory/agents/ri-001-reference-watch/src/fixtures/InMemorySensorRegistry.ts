import type { AgentId, SchemaVersion, Sensor, SensorId, SensorStatus, Timestamp } from "@reality-observatory/ontology";
import type { SensorChangeHandler, SensorQuery, SensorRegistry, SensorRegistryWriter } from "@reality-observatory/sensor-registry";
import type { EventBus, Subscription } from "@reality-observatory/event-bus";
import { makeEnvelope } from "../envelope.js";

const REFERENCE_SCHEMA_VERSION = "1.0.0" as SchemaVersion;

export class SensorNotFoundError extends Error {
  constructor(sensorId: SensorId) {
    super(`Sensor "${sensorId}" is not registered.`);
    this.name = "SensorNotFoundError";
  }
}

export class SensorAlreadyRegisteredError extends Error {
  constructor(sensorId: SensorId) {
    super(`Sensor "${sensorId}" is already registered.`);
    this.name = "SensorAlreadyRegisteredError";
  }
}

export class SensorOwnershipError extends Error {
  constructor(sensorId: SensorId, requestedBy: AgentId) {
    super(`Agent "${requestedBy}" is not the owner of Sensor "${sensorId}" and cannot write to it.`);
    this.name = "SensorOwnershipError";
  }
}

interface ChangeSubscription {
  readonly query: SensorQuery;
  readonly handler: SensorChangeHandler;
}

function matchesQuery(sensor: Sensor, query: SensorQuery): boolean {
  if (query.kind !== undefined && sensor.kind !== query.kind) return false;
  if (query.modality !== undefined && sensor.capabilities.modality !== query.modality) return false;
  if (query.status !== undefined && sensor.status !== query.status) return false;
  return true;
}

/**
 * Minimal, deterministic in-memory Sensor Registry fixture for RI-001
 * (docs/adr/0005). Not a production implementation — no persistence, no
 * distributed uniqueness guarantees beyond a single process's Map. As
 * ADR-0005 requires, every write publishes the resulting Sensor fact onto
 * `sensor.<kind>` in addition to updating internal state, so Sensor
 * lifecycle is observable on the bus like every other ontology fact.
 */
export class InMemorySensorRegistry implements SensorRegistry {
  private sensors = new Map<SensorId, Sensor>();
  private changeSubscriptions: ChangeSubscription[] = [];
  private subscriptionSequence = 0;

  constructor(private readonly bus: EventBus) {}

  async getSensor(id: SensorId): Promise<Sensor | undefined> {
    return this.sensors.get(id);
  }

  async findByKind(kind: string): Promise<readonly Sensor[]> {
    return [...this.sensors.values()].filter((sensor) => sensor.kind === kind);
  }

  async list(query: SensorQuery = {}): Promise<readonly Sensor[]> {
    return [...this.sensors.values()].filter((sensor) => matchesQuery(sensor, query));
  }

  async subscribeToSensorChanges(query: SensorQuery, handler: SensorChangeHandler): Promise<Subscription> {
    this.subscriptionSequence += 1;
    const id = `ri001-sensor-sub-${this.subscriptionSequence}`;
    const entry: ChangeSubscription = { query, handler };
    this.changeSubscriptions.push(entry);
    return {
      id,
      topicPattern: "sensor.*",
      unsubscribe: async () => {
        this.changeSubscriptions = this.changeSubscriptions.filter((existing) => existing !== entry);
      },
    };
  }

  async register(sensor: Sensor): Promise<void> {
    if (this.sensors.has(sensor.id)) {
      throw new SensorAlreadyRegisteredError(sensor.id);
    }
    this.sensors.set(sensor.id, sensor);
    await this.notify(sensor);
  }

  async updateStatus(id: SensorId, status: SensorStatus, at: Timestamp): Promise<void> {
    const updated: Sensor = { ...this.requireSensor(id), status, lastSeenAt: at };
    this.sensors.set(id, updated);
    await this.notify(updated);
  }

  async heartbeat(id: SensorId, at: Timestamp): Promise<void> {
    const updated: Sensor = { ...this.requireSensor(id), lastSeenAt: at };
    this.sensors.set(id, updated);
    await this.notify(updated);
  }

  async retire(id: SensorId, at: Timestamp): Promise<void> {
    const updated: Sensor = { ...this.requireSensor(id), status: "retired", lastSeenAt: at };
    this.sensors.set(id, updated);
    await this.notify(updated);
  }

  private requireSensor(id: SensorId): Sensor {
    const existing = this.sensors.get(id);
    if (!existing) throw new SensorNotFoundError(id);
    return existing;
  }

  private async notify(sensor: Sensor): Promise<void> {
    const at = sensor.lastSeenAt ?? sensor.registeredAt;
    await this.bus.publish(
      makeEnvelope(`sensor.${sensor.kind}`, sensor, sensor.ownerAgentId, at, REFERENCE_SCHEMA_VERSION)
    );
    for (const { query, handler } of this.changeSubscriptions) {
      if (matchesQuery(sensor, query)) {
        await handler(sensor);
      }
    }
  }
}

/**
 * Wraps a SensorRegistry's writer surface so writes are scoped to a single
 * agent — the concrete `AgentContext.ownSensors` binding described in
 * docs/adr/0005's RI-001 clarification. Enforces `ownerAgentId === agentId`
 * before delegating; this ownership check is runtime, not type-level, per
 * the carve-out in docs/adr/0011.
 */
export function createOwnSensorRegistryFor(agentId: AgentId, registry: InMemorySensorRegistry): SensorRegistryWriter {
  const assertOwnership = async (id: SensorId): Promise<void> => {
    const sensor = await registry.getSensor(id);
    if (!sensor) throw new SensorNotFoundError(id);
    if (sensor.ownerAgentId !== agentId) throw new SensorOwnershipError(id, agentId);
  };

  return {
    register: async (sensor: Sensor): Promise<void> => {
      if (sensor.ownerAgentId !== agentId) {
        throw new SensorOwnershipError(sensor.id, agentId);
      }
      await registry.register(sensor);
    },
    updateStatus: async (id: SensorId, status: SensorStatus, at: Timestamp): Promise<void> => {
      await assertOwnership(id);
      await registry.updateStatus(id, status, at);
    },
    heartbeat: async (id: SensorId, at: Timestamp): Promise<void> => {
      await assertOwnership(id);
      await registry.heartbeat(id, at);
    },
    retire: async (id: SensorId, at: Timestamp): Promise<void> => {
      await assertOwnership(id);
      await registry.retire(id, at);
    },
  };
}
