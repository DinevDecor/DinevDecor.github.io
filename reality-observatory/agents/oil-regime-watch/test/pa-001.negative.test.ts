import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPipeline } from "../src/pipeline.js";
import { FixtureInventoryAdapter } from "../src/sources/fixtures/FixtureInventoryAdapter.js";
import { FixturePriceAdapter } from "../src/sources/fixtures/FixturePriceAdapter.js";
import { FixtureOpecAnnouncementAdapter } from "../src/sources/fixtures/FixtureOpecAnnouncementAdapter.js";
import { assertWellFormedEvidence } from "../src/evidenceValidation.js";
import { MalformedEvidenceError, PredictionAlreadyResolvedError, UnknownSourceError } from "../src/errors.js";
import { DOMAIN, Topic, type SourceId } from "../src/domain.js";
import type { ThresholdsConfig } from "../src/config.js";
import type { Evidence, Outcome, Prediction } from "@reality-observatory/ontology";
import type { PriceAdapter, RawPriceObservation } from "../src/sources/SourceAdapter.js";

const THRESHOLDS: ThresholdsConfig = {
  inventorySurpriseThousandBarrels: 3000,
  inventoryTrailingWeeks: 4,
  priceMoveEvidenceThresholdPercent: 1.5,
  priceMoveConfirmationThresholdPercent: 1.5,
  predictionHorizonHours: 120,
};

const BUILD_SURPRISE_INVENTORY = [
  { asOfDate: "2026-02-04", inventoryThousandBarrels: 418000 },
  { asOfDate: "2026-02-11", inventoryThousandBarrels: 419500 },
  { asOfDate: "2026-02-18", inventoryThousandBarrels: 421000 },
  { asOfDate: "2026-02-25", inventoryThousandBarrels: 420500 },
  { asOfDate: "2026-03-04", inventoryThousandBarrels: 428000 },
];

const FLAT_INVENTORY = [
  { asOfDate: "2026-02-04", inventoryThousandBarrels: 420000 },
  { asOfDate: "2026-02-11", inventoryThousandBarrels: 420000 },
  { asOfDate: "2026-02-18", inventoryThousandBarrels: 420000 },
  { asOfDate: "2026-02-25", inventoryThousandBarrels: 420000 },
  { asOfDate: "2026-03-04", inventoryThousandBarrels: 420000 },
];

const OPEC_CUT = {
  id: "opec-2026-03-01-cut",
  announcedAt: "2026-03-01T14:00:00.000Z",
  kind: "cut" as const,
  magnitudeBarrelsPerDay: 1_000_000,
  summary: "Voluntary production cut",
};

/** Both an inventory surprise and an OPEC cut — used only where the test doesn't care which Event fires (duplicate-observation / invalid-source checks). */
function makeAdapters() {
  return {
    eiaInventory: new FixtureInventoryAdapter(BUILD_SURPRISE_INVENTORY),
    opecAnnouncements: new FixtureOpecAnnouncementAdapter([OPEC_CUT]),
    eiaWtiPrice: new FixturePriceAdapter([{ asOfDate: "2026-03-02", pricePerBarrelUsd: 75.0 }]),
    eiaBrentPrice: new FixturePriceAdapter([{ asOfDate: "2026-03-02", pricePerBarrelUsd: 79.0 }]),
  };
}

/**
 * Exactly one triggering scenario (the inventory surprise), with a flat,
 * empty OPEC feed — deliberately isolated so this scenario's Prediction
 * (whose invalidation condition is an opposing OPEC "cut") is not
 * accidentally auto-withdrawn by an unrelated OPEC cut fixture elsewhere
 * in the same test file. Tests about a single Prediction's own lifecycle
 * (expiry, duplicate resolution) need this isolation; tests that only
 * count Evidence or reject bad input (above) don't.
 */
function makeIsolatedInventoryAdapters(eiaWtiPrice: PriceAdapter) {
  return {
    eiaInventory: new FixtureInventoryAdapter(BUILD_SURPRISE_INVENTORY),
    opecAnnouncements: new FixtureOpecAnnouncementAdapter([]),
    eiaWtiPrice,
    eiaBrentPrice: new FixturePriceAdapter([{ asOfDate: "2026-03-02", pricePerBarrelUsd: 79.0 }]),
  };
}

function makeIsolatedOpecAdapters() {
  return {
    eiaInventory: new FixtureInventoryAdapter(FLAT_INVENTORY),
    opecAnnouncements: new FixtureOpecAnnouncementAdapter([OPEC_CUT]),
    eiaWtiPrice: new FixturePriceAdapter([{ asOfDate: "2026-03-02", pricePerBarrelUsd: 75.0 }]),
    eiaBrentPrice: new FixturePriceAdapter([{ asOfDate: "2026-03-02", pricePerBarrelUsd: 79.0 }]),
  };
}

/** Succeeds exactly once (for the Prediction's reference-price fetch), then simulates a feed outage — used to exercise the "expired, no Outcome" pathway. */
class FlakyPriceAdapter implements PriceAdapter {
  private calls = 0;
  constructor(private readonly first: RawPriceObservation) {}
  async fetchLatest(): Promise<RawPriceObservation> {
    this.calls += 1;
    if (this.calls === 1) return this.first;
    throw new Error("simulated EIA price feed outage");
  }
}

test("PA-001 negative: re-polling with no new observations never republishes duplicate Evidence", async () => {
  const adapters = makeAdapters();
  const pipeline = await buildPipeline(adapters, THRESHOLDS);
  await pipeline.agent.onStart(); // first poll: inventory build + OPEC cut + price baselines

  const evidenceCountAfterFirst = pipeline.bus.published.filter((e) => e.topic === Topic.evidence).length;
  assert.ok(evidenceCountAfterFirst > 0);

  await pipeline.agent.pollAll(); // re-poll: same inventory report, same OPEC feed, same prices
  const evidenceCountAfterSecond = pipeline.bus.published.filter((e) => e.topic === Topic.evidence).length;

  assert.equal(evidenceCountAfterSecond, evidenceCountAfterFirst, "identical observations must never be re-published as new Evidence");
});

test("PA-001 negative: polling an unconfigured source is rejected", async () => {
  const adapters = makeAdapters();
  const pipeline = await buildPipeline(adapters, THRESHOLDS);

  await assert.rejects(() => pipeline.agent.pollSource("unknownSource" as SourceId), UnknownSourceError);
});

test("PA-001 negative: malformed Evidence is refused before publication", () => {
  const base: Evidence = {
    id: "evidence-test-0001" as Evidence["id"],
    domain: DOMAIN,
    claim: "unexpected-crude-oil-inventory-build",
    polarity: "supports",
    strength: 0.8 as Evidence["strength"],
    derivedFrom: [{ type: "signal", id: "signal-test-0001" as never }],
    derivedByAgentId: "oil-regime-watch" as Evidence["derivedByAgentId"],
    observedAt: "2026-03-04T00:00:00.000Z" as Evidence["observedAt"],
    producedBy: "oil-regime-watch" as Evidence["producedBy"],
    schemaVersion: "1.0.0" as Evidence["schemaVersion"],
  };

  assert.doesNotThrow(() => assertWellFormedEvidence(base), "sanity check: the base fixture is itself well-formed");
  assert.throws(() => assertWellFormedEvidence({ ...base, claim: "" }), MalformedEvidenceError);
  assert.throws(() => assertWellFormedEvidence({ ...base, strength: 1.5 as Evidence["strength"] }), MalformedEvidenceError);
  assert.throws(() => assertWellFormedEvidence({ ...base, strength: -0.1 as Evidence["strength"] }), MalformedEvidenceError);
  assert.throws(() => assertWellFormedEvidence({ ...base, derivedFrom: [] }), MalformedEvidenceError);
});

test("PA-001 negative: a Prediction expires (no Outcome) when the market price cannot be fetched at resolution time", async () => {
  const adapters = makeIsolatedInventoryAdapters(
    new FlakyPriceAdapter({ asOfDate: "2026-03-02", pricePerBarrelUsd: 75.0 })
  );
  const pipeline = await buildPipeline(adapters, THRESHOLDS);
  await pipeline.agent.onStart(); // reference price fetch succeeds (call #1); prediction reaches "pending"

  const predictionId = (pipeline.bus.published.find((e) => e.topic === Topic.prediction)?.payload as Prediction).id;
  await pipeline.agent.checkExpiredPredictions(new Date("2026-03-08T00:00:00.000Z")); // resolution fetch fails (call #2+)

  const outcomes = pipeline.bus.published.filter((e) => e.topic === Topic.outcome);
  assert.equal(outcomes.length, 0, "an expired Prediction must never have an Outcome");

  const predictions = pipeline.bus.published.filter((e) => e.topic === Topic.prediction).map((e) => e.payload as Prediction);
  const last = predictions[predictions.length - 1]!;
  assert.equal(last.id, predictionId);
  assert.equal(last.status, "expired");
});

test("PA-001 negative: a Prediction cannot receive a second Outcome once already resolved", async () => {
  const adapters = makeIsolatedOpecAdapters();
  const pipeline = await buildPipeline(adapters, THRESHOLDS);
  await pipeline.agent.onStart();

  const predictionId = (pipeline.bus.published.find((e) => e.topic === Topic.prediction)?.payload as Prediction).id;

  adapters.eiaWtiPrice.pushLatest({ asOfDate: "2026-03-08", pricePerBarrelUsd: 78.0 });
  await pipeline.agent.resolvePrediction(predictionId, "2026-03-08T00:00:00.000Z" as never);

  const outcomesAfterFirst = pipeline.bus.published.filter((e) => e.topic === Topic.outcome);
  assert.equal(outcomesAfterFirst.length, 1);

  await assert.rejects(
    () => pipeline.agent.resolvePrediction(predictionId, "2026-03-09T00:00:00.000Z" as never),
    PredictionAlreadyResolvedError
  );

  const outcomesAfterSecondAttempt = pipeline.bus.published.filter((e) => e.topic === Topic.outcome).map((e) => e.payload as Outcome);
  assert.equal(outcomesAfterSecondAttempt.length, 1, "the rejected second attempt must not have published another Outcome");
});
