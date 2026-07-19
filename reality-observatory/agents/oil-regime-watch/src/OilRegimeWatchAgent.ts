import type { Agent, AgentContext, AgentManifest, HealthStatus } from "@reality-observatory/agent-sdk";
import type { EventEnvelope } from "@reality-observatory/event-bus";
import type {
  AgentId,
  Confidence,
  Event,
  EventId,
  Evidence,
  EvidenceId,
  HypothesisId,
  Outcome,
  OutcomeId,
  Prediction,
  PredictionId,
  Sensor,
  Signal,
  SignalId,
  Timestamp,
} from "@reality-observatory/ontology";

import { makeEnvelope } from "./envelope.js";
import {
  DOMAIN,
  SCHEMA_VERSION,
  SENSOR_IDS,
  SENSOR_KINDS,
  SENSOR_MODALITIES,
  SOURCE_IDS,
  SUBJECT,
  Topic,
  type OpecAnnouncementKind,
  type PriceInstrument,
  type SourceId,
} from "./domain.js";
import type { ThresholdsConfig } from "./config.js";
import type { InventoryAdapter, OpecAnnouncementAdapter, PriceAdapter, RawPriceObservation } from "./sources/SourceAdapter.js";
import { buildHypothesis, buildPrediction, evaluatePrediction, type OilPredictionClaim } from "./predictionRules.js";
import { assertWellFormedEvidence } from "./evidenceValidation.js";
import { PredictionAlreadyResolvedError, UnknownPredictionError, UnknownSourceError } from "./errors.js";

export interface OilRegimeWatchAdapters {
  readonly eiaInventory: InventoryAdapter;
  readonly opecAnnouncements: OpecAnnouncementAdapter;
  readonly eiaWtiPrice: PriceAdapter;
  readonly eiaBrentPrice: PriceAdapter;
}

interface TrackedPredictionRecord {
  readonly prediction: Prediction<OilPredictionClaim>;
  readonly eventId: EventId;
  readonly status: "pending" | "resolved" | "withdrawn";
}

const TRACKED_IDS_KEY = "trackedPredictionIds";

function clampConfidence(value: number): Confidence {
  return Math.min(1, Math.max(0, value)) as Confidence;
}

function claimForAnnouncementKind(kind: OpecAnnouncementKind): string {
  return kind === "disruption" ? "opec-supply-disruption" : `opec-production-${kind}`;
}

/**
 * PA-001: Oil Regime Watch. Observes EIA weekly petroleum inventory,
 * OPEC+ production announcements, and WTI/Brent spot prices; publishes
 * Signal -> Evidence for each; never publishes Event itself (that is the
 * Correlation Engine's exclusive job, enforced at the type level by
 * AgentEventBus — see docs/adr/0011); reacts to the resulting Event with a
 * Hypothesis and a measurable, falsifiable Prediction; and resolves an
 * Outcome — automatically, no manual Trust manipulation — once each
 * Prediction's horizon expires or an invalidation condition fires early.
 */
export class OilRegimeWatchAgent implements Agent {
  readonly manifest: AgentManifest;
  private context: AgentContext | undefined;
  private processedEventIds = new Set<EventId>();

  constructor(
    private readonly adapters: OilRegimeWatchAdapters,
    private readonly thresholds: ThresholdsConfig,
    manifest: AgentManifest
  ) {
    this.manifest = manifest;
  }

  async onInit(context: AgentContext): Promise<void> {
    this.context = context;
  }

  async onStart(): Promise<void> {
    const ctx = this.requireContext();
    const now = ctx.clock.now().toISOString() as Timestamp;

    for (const sourceId of SOURCE_IDS) {
      const sensor: Sensor = {
        id: SENSOR_IDS[sourceId],
        kind: SENSOR_KINDS[sourceId],
        displayName: `Oil Regime Watch — ${sourceId}`,
        ownerAgentId: this.manifest.id as AgentId,
        capabilities: { modality: SENSOR_MODALITIES[sourceId] },
        status: "active",
        registeredAt: now,
        producedBy: this.manifest.id as AgentId,
        schemaVersion: SCHEMA_VERSION,
      };
      await ctx.ownSensors.register(sensor);
    }

    await this.pollAll();
  }

  /**
   * Polls every configured source once, in a fixed order. Safe to call
   * repeatedly (each source dedups its own observations). A single
   * source's failure (feed outage, malformed response) is logged and does
   * not stop the remaining sources from being polled in the same cycle —
   * `pollSource` called directly (e.g. to validate a source id) still
   * throws normally; only this aggregate loop isolates failures.
   */
  async pollAll(): Promise<void> {
    const ctx = this.requireContext();
    for (const sourceId of SOURCE_IDS) {
      try {
        await this.pollSource(sourceId);
      } catch (error) {
        ctx.logger.error(`Polling source "${sourceId}" failed; continuing with the remaining sources`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /** Dispatches to the poller for a single configured source; rejects anything not in config/sources.json. */
  async pollSource(sourceId: SourceId): Promise<void> {
    switch (sourceId) {
      case "eiaInventory":
        return this.pollInventory();
      case "opecAnnouncements":
        return this.pollOpecAnnouncements();
      case "eiaWtiPrice":
        return this.pollPrice("wti");
      case "eiaBrentPrice":
        return this.pollPrice("brent");
      default:
        throw new UnknownSourceError(sourceId);
    }
  }

  async onEvent(envelope: EventEnvelope<unknown>): Promise<void> {
    if (envelope.topic !== Topic.event) return;
    const event = envelope.payload as Event;
    if (this.processedEventIds.has(event.id)) return; // idempotent: never react to the same Event twice
    this.processedEventIds.add(event.id);

    const ctx = this.requireContext();
    const nowIso = ctx.clock.now().toISOString() as Timestamp;

    const hypothesisId = `hypothesis-for-${event.id}` as HypothesisId;
    const hypothesisProposed = buildHypothesis({
      id: hypothesisId,
      domain: DOMAIN,
      proposedByAgentId: this.manifest.id as AgentId,
      event,
      at: nowIso,
      schemaVersion: SCHEMA_VERSION,
    });
    const proposedEnvelope = makeEnvelope(Topic.hypothesis, hypothesisProposed, this.manifest.id, nowIso, SCHEMA_VERSION);
    await ctx.bus.publish(proposedEnvelope);
    const corroborated = { ...hypothesisProposed, status: "corroborated" as const, updatedAt: nowIso };
    await ctx.bus.publish(
      makeEnvelope(Topic.hypothesis, corroborated, this.manifest.id, nowIso, SCHEMA_VERSION, {
        causationId: proposedEnvelope.id,
      })
    );

    // The Hypothesis above is already published and durable even if the
    // reference-price fetch below fails: a feed outage degrades this Event
    // to "no measurable Prediction yet" rather than crashing the poll cycle
    // that produced it (that cycle may cover unrelated sources — see
    // README, "Known limitations").
    let referencePrice: { readonly pricePerBarrelUsd: number };
    try {
      referencePrice = await this.adapters.eiaWtiPrice.fetchLatest();
    } catch (error) {
      ctx.logger.warn("Could not fetch a WTI reference price; skipping Prediction for this Event", {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const predictionId = `prediction-for-${event.id}` as PredictionId;
    const horizonTo = new Date(
      ctx.clock.now().getTime() + this.thresholds.predictionHorizonHours * 3_600_000
    ).toISOString() as Timestamp;

    const prediction = buildPrediction({
      id: predictionId,
      domain: DOMAIN,
      subject: SUBJECT,
      producedByAgentId: this.manifest.id as AgentId,
      hypothesisId,
      event,
      referencePriceUsd: referencePrice.pricePerBarrelUsd,
      thresholdPercent: this.thresholds.priceMoveConfirmationThresholdPercent,
      createdAt: nowIso,
      horizonTo,
      schemaVersion: SCHEMA_VERSION,
    });
    await ctx.bus.publish(makeEnvelope(Topic.prediction, prediction, this.manifest.id, nowIso, SCHEMA_VERSION));

    await this.trackPrediction({ prediction, eventId: event.id, status: "pending" });
  }

  /** Resolves every tracked pending Prediction whose horizon has passed `now` (defaults to the agent's clock). */
  async checkExpiredPredictions(now?: Date): Promise<void> {
    const ctx = this.requireContext();
    const nowIso = (now ?? ctx.clock.now()).toISOString() as Timestamp;
    const ids = await this.getTrackedIds();
    for (const id of ids) {
      const record = await this.getRecord(id);
      if (!record || record.status !== "pending") continue;
      if (record.prediction.horizon.to > nowIso) continue;
      await this.resolvePrediction(id, nowIso);
    }
  }

  /**
   * Resolves a single Prediction against the current market price. Throws
   * if it is unknown or already terminal — no duplicate Outcome is ever
   * possible. If the market price cannot be fetched at all, the Prediction
   * expires without an Outcome (ADR-0009: expired Predictions have no
   * Outcome — `OutcomeVerdict` only has confirmed/falsified/inconclusive,
   * there is no "expired" verdict) rather than throwing and leaving the
   * Prediction stuck pending forever.
   */
  async resolvePrediction(predictionId: PredictionId, atIso: Timestamp): Promise<void> {
    const ctx = this.requireContext();
    const record = await this.getRecord(predictionId);
    if (!record) throw new UnknownPredictionError(predictionId);
    if (record.status !== "pending") throw new PredictionAlreadyResolvedError(predictionId, record.status);

    const priceAdapter = record.prediction.claim.instrument === "wti" ? this.adapters.eiaWtiPrice : this.adapters.eiaBrentPrice;
    let current: RawPriceObservation;
    try {
      current = await priceAdapter.fetchLatest();
    } catch {
      await this.expirePrediction(record, atIso);
      return;
    }
    const { verdict, movePercent } = evaluatePrediction(record.prediction.claim, current.pricePerBarrelUsd);

    const outcomeId = `outcome-for-${predictionId}` as OutcomeId;
    const outcome: Outcome = {
      id: outcomeId,
      predictionId,
      verdict,
      method: "automatic",
      evidenceEventIds: [record.eventId],
      resolvedByAgentId: this.manifest.id as AgentId,
      resolvedAt: atIso,
      rationale:
        `${record.prediction.claim.instrument.toUpperCase()} moved ${movePercent.toFixed(2)}% vs reference ` +
        `$${record.prediction.claim.referencePriceUsd.toFixed(2)}; threshold was ${record.prediction.claim.thresholdPercent}% ` +
        `in the "${record.prediction.claim.direction}" direction.`,
      producedBy: this.manifest.id as AgentId,
      schemaVersion: SCHEMA_VERSION,
    };
    // Trust Engine — not this agent — updates Domain Trust once it ingests
    // this Outcome from the bus (docs/adr/0004); there is no writer surface
    // this agent could use to touch Trust even if it tried.
    await ctx.bus.publish(makeEnvelope(Topic.outcome, outcome, this.manifest.id, atIso, SCHEMA_VERSION));

    const resolved: Prediction<OilPredictionClaim> = {
      ...record.prediction,
      status: verdict,
      resolvedAt: atIso,
      resolvingOutcomeId: outcomeId,
    };
    await ctx.bus.publish(makeEnvelope(Topic.prediction, resolved, this.manifest.id, atIso, SCHEMA_VERSION));

    await this.trackPrediction({ prediction: resolved, eventId: record.eventId, status: "resolved" });
  }

  async onHealthCheck(): Promise<HealthStatus> {
    return "healthy";
  }

  async onShutdown(): Promise<void> {
    this.context = undefined;
  }

  // --- Per-source polling -------------------------------------------------

  private async pollInventory(): Promise<void> {
    const ctx = this.requireContext();
    const latest = await this.adapters.eiaInventory.fetchLatest();

    const lastProcessed = await ctx.storage.get<string>("lastProcessed:eiaInventory");
    if (lastProcessed === latest.asOfDate) return; // duplicate observation — already processed

    const history = await this.adapters.eiaInventory.fetchTrailingHistory(this.thresholds.inventoryTrailingWeeks + 1);
    const priorWeeks = history.slice(0, -1);
    await ctx.storage.set("lastProcessed:eiaInventory", latest.asOfDate);
    if (priorWeeks.length === 0) return; // cold start: no trailing baseline yet

    const average = priorWeeks.reduce((sum, obs) => sum + obs.inventoryThousandBarrels, 0) / priorWeeks.length;
    const surprise = latest.inventoryThousandBarrels - average;
    if (Math.abs(surprise) < this.thresholds.inventorySurpriseThousandBarrels) return;

    const nowIso = ctx.clock.now().toISOString() as Timestamp;
    const asOf = `${latest.asOfDate}T00:00:00.000Z` as Timestamp;
    const signalId = `signal-eiaInventory-${latest.asOfDate}` as SignalId;

    const signal: Signal<{ inventoryThousandBarrels: number }> = {
      id: signalId,
      sensorId: SENSOR_IDS.eiaInventory,
      modality: "numeric",
      capturedAt: asOf,
      ingestedAt: nowIso,
      payload: { inventoryThousandBarrels: latest.inventoryThousandBarrels },
      unit: "thousand-barrels",
      producedBy: SENSOR_IDS.eiaInventory,
      schemaVersion: SCHEMA_VERSION,
    };
    await ctx.bus.publish(makeEnvelope(Topic.signal, signal, this.manifest.id, asOf, SCHEMA_VERSION));

    const claim = surprise > 0 ? "unexpected-crude-oil-inventory-build" : "unexpected-crude-oil-inventory-draw";
    const strength = clampConfidence(0.6 + Math.abs(surprise) / (this.thresholds.inventorySurpriseThousandBarrels * 5));
    const evidence: Evidence = {
      id: `evidence-eiaInventory-${latest.asOfDate}` as EvidenceId,
      domain: DOMAIN,
      claim,
      polarity: "supports",
      strength,
      derivedFrom: [{ type: "signal", id: signalId }],
      derivedByAgentId: this.manifest.id as AgentId,
      observedAt: asOf,
      producedBy: this.manifest.id as AgentId,
      schemaVersion: SCHEMA_VERSION,
    };
    assertWellFormedEvidence(evidence);
    await ctx.bus.publish(makeEnvelope(Topic.evidence, evidence, this.manifest.id, asOf, SCHEMA_VERSION));
  }

  private async pollOpecAnnouncements(): Promise<void> {
    const ctx = this.requireContext();
    const lastSeenId = await ctx.storage.get<string>("lastSeenOpecAnnouncementId");
    const newAnnouncements = await this.adapters.opecAnnouncements.fetchNewAnnouncementsSince(lastSeenId);
    if (newAnnouncements.length === 0) return; // duplicate poll — nothing new since last time

    for (const announcement of newAnnouncements) {
      const nowIso = ctx.clock.now().toISOString() as Timestamp;
      const announcedAt = announcement.announcedAt as Timestamp;
      const signalId = `signal-opec-${announcement.id}` as SignalId;

      const signal: Signal<{ kind: string; magnitudeBarrelsPerDay: number; summary: string }> = {
        id: signalId,
        sensorId: SENSOR_IDS.opecAnnouncements,
        modality: "structured",
        capturedAt: announcedAt,
        ingestedAt: nowIso,
        payload: {
          kind: announcement.kind,
          magnitudeBarrelsPerDay: announcement.magnitudeBarrelsPerDay,
          summary: announcement.summary,
        },
        producedBy: SENSOR_IDS.opecAnnouncements,
        schemaVersion: SCHEMA_VERSION,
      };
      await ctx.bus.publish(makeEnvelope(Topic.signal, signal, this.manifest.id, announcedAt, SCHEMA_VERSION));

      const evidence: Evidence = {
        id: `evidence-opec-${announcement.id}` as EvidenceId,
        domain: DOMAIN,
        claim: claimForAnnouncementKind(announcement.kind),
        polarity: "supports",
        strength: 0.9 as Confidence,
        derivedFrom: [{ type: "signal", id: signalId }],
        derivedByAgentId: this.manifest.id as AgentId,
        observedAt: announcedAt,
        producedBy: this.manifest.id as AgentId,
        schemaVersion: SCHEMA_VERSION,
      };
      assertWellFormedEvidence(evidence);
      await ctx.bus.publish(makeEnvelope(Topic.evidence, evidence, this.manifest.id, announcedAt, SCHEMA_VERSION));

      await this.checkInvalidations(announcement.kind, nowIso);
    }

    const lastEntry = newAnnouncements[newAnnouncements.length - 1]!;
    await ctx.storage.set("lastSeenOpecAnnouncementId", lastEntry.id);
  }

  private async pollPrice(instrument: PriceInstrument): Promise<void> {
    const ctx = this.requireContext();
    const adapter = instrument === "wti" ? this.adapters.eiaWtiPrice : this.adapters.eiaBrentPrice;
    const sensorId = instrument === "wti" ? SENSOR_IDS.eiaWtiPrice : SENSOR_IDS.eiaBrentPrice;
    const latest = await adapter.fetchLatest();

    const dedupKey = `lastProcessed:price:${instrument}`;
    const lastProcessed = await ctx.storage.get<string>(dedupKey);
    if (lastProcessed === latest.asOfDate) return; // duplicate observation
    await ctx.storage.set(dedupKey, latest.asOfDate);

    const priorKey = `lastPrice:${instrument}`;
    const prior = await ctx.storage.get<RawPriceObservation>(priorKey);
    await ctx.storage.set(priorKey, latest);
    if (!prior) return; // cold start: no baseline yet

    const changePercent = ((latest.pricePerBarrelUsd - prior.pricePerBarrelUsd) / prior.pricePerBarrelUsd) * 100;
    if (Math.abs(changePercent) < this.thresholds.priceMoveEvidenceThresholdPercent) return;

    const nowIso = ctx.clock.now().toISOString() as Timestamp;
    const asOf = `${latest.asOfDate}T00:00:00.000Z` as Timestamp;
    const signalId = `signal-${instrument}Price-${latest.asOfDate}` as SignalId;

    const signal: Signal<{ pricePerBarrelUsd: number }> = {
      id: signalId,
      sensorId,
      modality: "numeric",
      capturedAt: asOf,
      ingestedAt: nowIso,
      payload: { pricePerBarrelUsd: latest.pricePerBarrelUsd },
      unit: "usd-per-barrel",
      producedBy: sensorId,
      schemaVersion: SCHEMA_VERSION,
    };
    await ctx.bus.publish(makeEnvelope(Topic.signal, signal, this.manifest.id, asOf, SCHEMA_VERSION));

    const claim = `${instrument}-price-${changePercent > 0 ? "surge" : "slump"}`;
    const strength = clampConfidence(0.55 + Math.abs(changePercent) / (this.thresholds.priceMoveEvidenceThresholdPercent * 6));
    const evidence: Evidence = {
      id: `evidence-${instrument}Price-${latest.asOfDate}` as EvidenceId,
      domain: DOMAIN,
      claim,
      polarity: "supports",
      strength,
      derivedFrom: [{ type: "signal", id: signalId }],
      derivedByAgentId: this.manifest.id as AgentId,
      observedAt: asOf,
      producedBy: this.manifest.id as AgentId,
      schemaVersion: SCHEMA_VERSION,
    };
    assertWellFormedEvidence(evidence);
    await ctx.bus.publish(makeEnvelope(Topic.evidence, evidence, this.manifest.id, asOf, SCHEMA_VERSION));
  }

  // --- Prediction tracking (invalidation + expiry) ------------------------

  private async checkInvalidations(kind: OpecAnnouncementKind, atIso: Timestamp): Promise<void> {
    const ids = await this.getTrackedIds();
    for (const id of ids) {
      const record = await this.getRecord(id);
      if (!record || record.status !== "pending") continue;
      if (record.prediction.claim.invalidation.opposingAnnouncementKind !== kind) continue;
      await this.withdrawPrediction(id, atIso);
    }
  }

  private async withdrawPrediction(predictionId: PredictionId, atIso: Timestamp): Promise<void> {
    const ctx = this.requireContext();
    const record = await this.getRecord(predictionId);
    if (!record) throw new UnknownPredictionError(predictionId);
    if (record.status !== "pending") throw new PredictionAlreadyResolvedError(predictionId, record.status);

    const withdrawn: Prediction<OilPredictionClaim> = {
      ...record.prediction,
      status: "withdrawn",
      resolvedAt: atIso,
    };
    await ctx.bus.publish(makeEnvelope(Topic.prediction, withdrawn, this.manifest.id, atIso, SCHEMA_VERSION));
    await this.trackPrediction({ prediction: withdrawn, eventId: record.eventId, status: "withdrawn" });
  }

  /** Terminal, Outcome-less transition for when the horizon passed but no market price could be fetched to evaluate against. */
  private async expirePrediction(record: TrackedPredictionRecord, atIso: Timestamp): Promise<void> {
    const ctx = this.requireContext();
    const expired: Prediction<OilPredictionClaim> = {
      ...record.prediction,
      status: "expired",
      resolvedAt: atIso,
    };
    await ctx.bus.publish(makeEnvelope(Topic.prediction, expired, this.manifest.id, atIso, SCHEMA_VERSION));
    await this.trackPrediction({ prediction: expired, eventId: record.eventId, status: "resolved" });
  }

  private async getTrackedIds(): Promise<PredictionId[]> {
    return (await this.requireContext().storage.get<PredictionId[]>(TRACKED_IDS_KEY)) ?? [];
  }

  private recordKey(id: PredictionId): string {
    return `tracked:${id}`;
  }

  private async getRecord(id: PredictionId): Promise<TrackedPredictionRecord | undefined> {
    return this.requireContext().storage.get<TrackedPredictionRecord>(this.recordKey(id));
  }

  private async trackPrediction(record: TrackedPredictionRecord): Promise<void> {
    const ctx = this.requireContext();
    const isNew = !(await this.getRecord(record.prediction.id));
    await ctx.storage.set(this.recordKey(record.prediction.id), record);
    if (isNew) {
      const ids = await this.getTrackedIds();
      await ctx.storage.set(TRACKED_IDS_KEY, [...ids, record.prediction.id]);
    }
  }

  private requireContext(): AgentContext {
    if (!this.context) throw new Error("OilRegimeWatchAgent used before onInit");
    return this.context;
  }
}
