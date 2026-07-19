import type { AgentId, Domain, EventSubjectRef, Sensor, SchemaVersion, SensorId } from "@reality-observatory/ontology";

export const DOMAIN = "energy.oil" as Domain;
export const SCHEMA_VERSION = "1.0.0" as SchemaVersion;

export const AGENT_ID = "oil-regime-watch" as AgentId;
export const CORRELATION_ENGINE_ID = "oil-regime-correlation";

/** The primary tracked instrument for Predictions/Outcomes; Brent is a corroborating price source only (see README, "Scope"). */
export const SUBJECT: EventSubjectRef = { type: "energy.market-instrument", id: "wti-crude-oil" };

export const Topic = {
  signal: `signal.${DOMAIN}`,
  evidence: `evidence.${DOMAIN}`,
  event: `event.${DOMAIN}`,
  hypothesis: `hypothesis.${DOMAIN}`,
  prediction: `prediction.${DOMAIN}`,
  outcome: `outcome.${DOMAIN}`,
} as const;

export type SourceId = "eiaInventory" | "opecAnnouncements" | "eiaWtiPrice" | "eiaBrentPrice";

export const SOURCE_IDS: readonly SourceId[] = ["eiaInventory", "opecAnnouncements", "eiaWtiPrice", "eiaBrentPrice"];

export type OpecAnnouncementKind = "cut" | "increase" | "disruption";

export type EventType =
  | "energy.oil.inventory-surprise-build"
  | "energy.oil.inventory-surprise-draw"
  | "energy.oil.opec-production-cut"
  | "energy.oil.opec-production-increase"
  | "energy.oil.opec-supply-disruption";

export type PriceInstrument = "wti" | "brent";

export const SENSOR_IDS: Readonly<Record<SourceId, SensorId>> = {
  eiaInventory: "sensor-oil-regime-eia-inventory" as SensorId,
  opecAnnouncements: "sensor-oil-regime-opec-announcements" as SensorId,
  eiaWtiPrice: "sensor-oil-regime-eia-wti-price" as SensorId,
  eiaBrentPrice: "sensor-oil-regime-eia-brent-price" as SensorId,
};

export const SENSOR_KINDS: Readonly<Record<SourceId, string>> = {
  eiaInventory: "energy.eia.weekly-petroleum-status",
  opecAnnouncements: "energy.opec.production-announcements",
  eiaWtiPrice: "energy.eia.wti-spot-price",
  eiaBrentPrice: "energy.eia.brent-spot-price",
};

export const SENSOR_MODALITIES: Readonly<Record<SourceId, Sensor["capabilities"]["modality"]>> = {
  eiaInventory: "numeric",
  opecAnnouncements: "structured",
  eiaWtiPrice: "numeric",
  eiaBrentPrice: "numeric",
};
