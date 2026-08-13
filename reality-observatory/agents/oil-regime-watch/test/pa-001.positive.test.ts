import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPipeline } from "../src/pipeline.js";
import { FixtureInventoryAdapter } from "../src/sources/fixtures/FixtureInventoryAdapter.js";
import { FixturePriceAdapter } from "../src/sources/fixtures/FixturePriceAdapter.js";
import { FixtureOpecAnnouncementAdapter } from "../src/sources/fixtures/FixtureOpecAnnouncementAdapter.js";
import { AGENT_ID, DOMAIN, SENSOR_IDS, Topic } from "../src/domain.js";
import type { ThresholdsConfig } from "../src/config.js";
import type { Event, Evidence, Hypothesis, Outcome, Prediction } from "@reality-observatory/ontology";
import type { OilPredictionClaim } from "../src/predictionRules.js";
import type { RawOpecAnnouncement } from "../src/sources/SourceAdapter.js";

const THRESHOLDS: ThresholdsConfig = {
  inventorySurpriseThousandBarrels: 3000,
  inventoryTrailingWeeks: 4,
  priceMoveEvidenceThresholdPercent: 1.5,
  priceMoveConfirmationThresholdPercent: 1.5,
  predictionHorizonHours: 120,
};

const FLAT_INVENTORY = [
  { asOfDate: "2026-02-04", inventoryThousandBarrels: 420000 },
  { asOfDate: "2026-02-11", inventoryThousandBarrels: 420000 },
  { asOfDate: "2026-02-18", inventoryThousandBarrels: 420000 },
  { asOfDate: "2026-02-25", inventoryThousandBarrels: 420000 },
  { asOfDate: "2026-03-04", inventoryThousandBarrels: 420000 },
];

const BUILD_SURPRISE_INVENTORY = [
  { asOfDate: "2026-02-04", inventoryThousandBarrels: 418000 },
  { asOfDate: "2026-02-11", inventoryThousandBarrels: 419500 },
  { asOfDate: "2026-02-18", inventoryThousandBarrels: 421000 },
  { asOfDate: "2026-02-25", inventoryThousandBarrels: 420500 },
  { asOfDate: "2026-03-04", inventoryThousandBarrels: 428000 }, // +8250k vs 419750k average -> build surprise
];

function makeAdapters(overrides: {
  inventory?: typeof FLAT_INVENTORY;
  opec?: readonly RawOpecAnnouncement[];
  wtiBaselineUsd?: number;
  brentBaselineUsd?: number;
}) {
  return {
    eiaInventory: new FixtureInventoryAdapter(overrides.inventory ?? FLAT_INVENTORY),
    opecAnnouncements: new FixtureOpecAnnouncementAdapter(overrides.opec ?? []),
    eiaWtiPrice: new FixturePriceAdapter([{ asOfDate: "2026-03-02", pricePerBarrelUsd: overrides.wtiBaselineUsd ?? 75.0 }]),
    eiaBrentPrice: new FixturePriceAdapter([{ asOfDate: "2026-03-02", pricePerBarrelUsd: overrides.brentBaselineUsd ?? 79.0 }]),
  };
}

test("PA-001 positive: an EIA inventory surprise produces Evidence, a correlated Event, a Hypothesis, and a measurable Prediction", async () => {
  const adapters = makeAdapters({ inventory: BUILD_SURPRISE_INVENTORY });
  const pipeline = await buildPipeline(adapters, THRESHOLDS);
  await pipeline.agent.onStart();

  const evidence = pipeline.bus.published
    .filter((e) => e.topic === Topic.evidence)
    .map((e) => e.payload as Evidence)
    .find((e) => e.claim === "unexpected-crude-oil-inventory-build");
  assert.ok(evidence, "expected inventory-build Evidence");
  assert.equal(evidence?.domain, DOMAIN);

  const event = pipeline.bus.published.find((e) => e.topic === Topic.event)?.payload as Event;
  assert.ok(event);
  assert.equal(event.type, "energy.oil.inventory-surprise-build");
  assert.ok(event.evidenceRefs.includes(evidence!.id));

  const hypotheses = pipeline.bus.published.filter((e) => e.topic === Topic.hypothesis).map((e) => e.payload as Hypothesis);
  assert.equal(hypotheses.length, 2, "proposed + corroborated");
  assert.equal(hypotheses[1]?.status, "corroborated");

  const predictionEnvelope = pipeline.bus.published.find((e) => e.topic === Topic.prediction);
  const prediction = predictionEnvelope?.payload as Prediction<OilPredictionClaim>;
  assert.ok(prediction);
  assert.equal(prediction.status, "pending");
  assert.equal(prediction.claim.direction, "down", "a surprise build is bearish for WTI");
  assert.equal(prediction.claim.referencePriceUsd, 75.0);
  assert.equal(prediction.claim.thresholdPercent, THRESHOLDS.priceMoveConfirmationThresholdPercent);
  assert.equal(prediction.claim.invalidation.opposingAnnouncementKind, "cut");
  assert.ok(prediction.basis.includes(event.id));
  assert.ok(prediction.basis.includes(evidence!.id));
});

test("PA-001 positive: an OPEC+ production cut announcement produces Evidence, a correlated Event, and a bullish Prediction", async () => {
  const adapters = makeAdapters({
    opec: [
      {
        id: "opec-2026-03-01-cut",
        announcedAt: "2026-03-01T14:00:00.000Z",
        kind: "cut",
        magnitudeBarrelsPerDay: 1_000_000,
        summary: "Voluntary production cut",
      },
    ],
  });
  const pipeline = await buildPipeline(adapters, THRESHOLDS);
  await pipeline.agent.onStart();

  const evidence = pipeline.bus.published
    .filter((e) => e.topic === Topic.evidence)
    .map((e) => e.payload as Evidence)
    .find((e) => e.claim === "opec-production-cut");
  assert.ok(evidence);

  const event = pipeline.bus.published.find((e) => e.topic === Topic.event)?.payload as Event;
  assert.equal(event.type, "energy.oil.opec-production-cut");

  const prediction = pipeline.bus.published.find((e) => e.topic === Topic.prediction)?.payload as Prediction<OilPredictionClaim>;
  assert.equal(prediction.claim.direction, "up", "a production cut is bullish for WTI");
  assert.equal(prediction.claim.invalidation.opposingAnnouncementKind, "increase");
});

test("PA-001 positive: a Prediction that moves in the predicted direction beyond threshold is confirmed", async () => {
  const adapters = makeAdapters({
    opec: [
      {
        id: "opec-2026-03-01-cut",
        announcedAt: "2026-03-01T14:00:00.000Z",
        kind: "cut",
        magnitudeBarrelsPerDay: 1_000_000,
        summary: "Voluntary production cut",
      },
    ],
    wtiBaselineUsd: 75.0,
  });
  const pipeline = await buildPipeline(adapters, THRESHOLDS);
  await pipeline.agent.onStart();

  const predictionId = (pipeline.bus.published.find((e) => e.topic === Topic.prediction)?.payload as Prediction).id;

  // WTI subsequently rises 3.33%, well past the 1.5% threshold, in the predicted "up" direction.
  adapters.eiaWtiPrice.pushLatest({ asOfDate: "2026-03-08", pricePerBarrelUsd: 77.5 });
  await pipeline.agent.checkExpiredPredictions(new Date("2026-03-08T00:00:00.000Z"));

  const outcome = pipeline.bus.published.find((e) => e.topic === Topic.outcome)?.payload as Outcome;
  assert.ok(outcome);
  assert.equal(outcome.verdict, "confirmed");
  assert.equal(outcome.predictionId, predictionId);

  const predictions = pipeline.bus.published.filter((e) => e.topic === Topic.prediction).map((e) => e.payload as Prediction);
  const resolved = predictions[predictions.length - 1]!;
  assert.equal(resolved.status, "confirmed");
  assert.equal(resolved.resolvingOutcomeId, outcome.id);
});

test("PA-001 positive: a Prediction that moves opposite to the predicted direction is falsified", async () => {
  const adapters = makeAdapters({ inventory: BUILD_SURPRISE_INVENTORY, wtiBaselineUsd: 75.0 });
  const pipeline = await buildPipeline(adapters, THRESHOLDS);
  await pipeline.agent.onStart(); // predicts "down" off the inventory build surprise

  // WTI instead rises 4%, the opposite of the predicted "down" direction.
  adapters.eiaWtiPrice.pushLatest({ asOfDate: "2026-03-08", pricePerBarrelUsd: 78.0 });
  await pipeline.agent.checkExpiredPredictions(new Date("2026-03-08T00:00:00.000Z"));

  const outcome = pipeline.bus.published.find((e) => e.topic === Topic.outcome)?.payload as Outcome;
  assert.equal(outcome.verdict, "falsified");

  const predictions = pipeline.bus.published.filter((e) => e.topic === Topic.prediction).map((e) => e.payload as Prediction);
  assert.equal(predictions[predictions.length - 1]?.status, "falsified");
});

test("PA-001 positive: a confirmed Outcome updates Domain Trust for the Agent, and Evidence updates it for the originating Sensor", async () => {
  const adapters = makeAdapters({
    opec: [
      {
        id: "opec-2026-03-01-cut",
        announcedAt: "2026-03-01T14:00:00.000Z",
        kind: "cut",
        magnitudeBarrelsPerDay: 1_000_000,
        summary: "Voluntary production cut",
      },
    ],
  });
  const pipeline = await buildPipeline(adapters, THRESHOLDS);
  await pipeline.agent.onStart();

  adapters.eiaWtiPrice.pushLatest({ asOfDate: "2026-03-08", pricePerBarrelUsd: 78.0 });
  await pipeline.agent.checkExpiredPredictions(new Date("2026-03-08T00:00:00.000Z"));

  const agentTrust = await pipeline.trustEngine.getTrust({ type: "agent", id: AGENT_ID }, DOMAIN);
  assert.ok(agentTrust);
  assert.ok(Math.abs(agentTrust!.score - 0.65) < 1e-9, `expected ~0.65, got ${agentTrust?.score}`);

  const sensorTrust = await pipeline.trustEngine.getTrust(
    { type: "sensor", id: SENSOR_IDS.opecAnnouncements },
    DOMAIN
  );
  assert.ok(sensorTrust);
  assert.ok(Math.abs(sensorTrust!.score - (0.5 + 0.05 * 0.9)) < 1e-9);
});
