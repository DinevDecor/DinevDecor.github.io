/**
 * Shared primitives for the Reality Observatory ontology.
 * See docs/adr/0002-domain-ontology-as-shared-contract.md.
 */

/** Nominal typing helper — prevents mixing structurally-identical string/number types. */
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

/** Opaque identifier for an ontology entity of a given kind. */
export type Id<TKind extends string = string> = Brand<string, `Id:${TKind}`>;

/** ISO-8601 UTC timestamp. */
export type Timestamp = Brand<string, "Timestamp">;

/** Semantic version of a type's schema, e.g. "1.2.0". */
export type SchemaVersion = Brand<string, "SchemaVersion">;

/** Normalized confidence/strength/score in the closed interval [0, 1]. */
export type Confidence = Brand<number, "Confidence">;

export type SensorId = Id<"Sensor">;
export type SignalId = Id<"Signal">;
export type EvidenceId = Id<"Evidence">;
export type EventId = Id<"Event">;
export type PredictionId = Id<"Prediction">;
export type TrustId = Id<"Trust">;
export type AgentId = Id<"Agent">;

/** Every ontology fact carries an explicit producer and the schema version it was authored against. */
export interface Provenance {
  readonly producedBy: AgentId | SensorId;
  readonly schemaVersion: SchemaVersion;
}

/** Lightweight reference to another ontology entity, for composable provenance chains. */
export interface Ref<TId extends Id> {
  readonly id: TId;
}
