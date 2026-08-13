# Operations Runbook — Oil Regime Watch (PA-001)

This is the operational README: how to actually run this agent, as
distinct from `README.md`'s architecture/design notes. Read this before
deploying, not before developing against it.

## Status: not yet deployable

There is no production runtime in this repo yet — no concrete Event Bus,
Trust Engine, Sensor Registry, or Correlation Engine implementation exists
outside of in-memory test fixtures (see the Final Report). **This runbook
describes what will be required to operate the agent once such a runtime
exists**; it cannot be deployed today. Treat it as the checklist for that
future work, not as steps you can run right now.

## Prerequisites (once a runtime exists)

1. **EIA API key.** Register at https://www.eia.gov/opendata/register.php
   and set the environment variable named in `config/sources.json`'s
   `apiKeyEnvVar` (default `EIA_API_KEY`).
2. **Verify the EIA route/facet configuration.** This session's network
   policy blocked outbound access to `api.eia.gov`, so the `route`/`facets`
   in `config/sources.json` were written from EIA's documented API v2
   conventions but never exercised against the live API. Before first
   deployment: manually call each configured route with `curl` (or the
   EIA API browser) and confirm the response shape matches what
   `EiaHttpClient.fetchSeries` expects (`{ response: { data: [{ period,
   value }] } }`). Adjust `route`/`facets` if EIA's current schema differs.
3. **OPEC+ announcement feed.** Copy `config/opec-announcements.example.json`
   to `config/opec-announcements.json` and assign an analyst/desk owner to
   keep it updated as real announcements happen. This is a manual,
   structured curation step by design (see README, "Scope") — there is no
   automatic ingestion path for this source.
4. **A scheduler for polling and expiry checks.** The agent exposes
   `pollAll()` (call periodically — inventory is weekly, prices are daily,
   so hourly is more than sufficient headroom) and
   `checkExpiredPredictions()` (call at least as often as your shortest
   `predictionHorizonHours` requires granularity for). Neither method
   schedules itself; wire them to whatever job runner the eventual runtime
   provides (cron, a queue consumer, etc.).

## Configuration reference

See `README.md`, "Configuration" for the full field list. The two values
most likely to need tuning per deployment:

- `thresholds.inventorySurpriseThousandBarrels` — set too low, every
  routine week looks like an "unexpected" surprise; set too high, real
  surprises are missed. Start at the documented value (3,000 thousand
  barrels ≈ 3 million barrels) and revisit after a few months of real data.
- `thresholds.predictionHorizonHours` — how long the agent waits before
  evaluating a Prediction. Shorter horizons resolve (and update Trust)
  faster but are noisier; longer horizons are more meaningful but slower
  to accrue Trust history.

## Monitoring signals

Once deployed, watch for:

- **`pollAll` per-source failures** — logged via `ctx.logger.error` with
  the source id and error message, and isolated (one source's failure
  doesn't stop the others). Repeated failures for the same source over
  multiple cycles indicate a real outage or a config/credential problem,
  not noise to ignore.
- **Predictions ending "expired"** — means the WTI price feed was
  unavailable at resolution time. Occasional expiry is tolerable; frequent
  expiry means the price adapter needs attention before Trust accrual
  becomes meaningless (an agent that can't resolve its own Predictions
  can't build real Trust).
- **Domain Trust trend** (`trust.energy.oil` — via `TrustEngineReader` once
  a real Trust Engine exists) for both the agent itself and each of the
  four Sensors. A sustained downward trend for the agent's own Trust means
  its Prediction rules are directionally wrong more often than not and the
  regime rules in `predictionRules.ts` need revisiting — this is exactly
  the kind of signal Reality Observatory is meant to surface.

## Incident runbook

- **"Sensor already registered" on startup** — the agent attempted to
  re-register a Sensor id that's already active. Expected on a warm
  restart; if it persists across a clean environment, check for a stale
  Sensor Registry entry from a previous, uncleanly-shut-down instance.
- **A Prediction is stuck "pending" past its horizon** — `pollAll`'s poll
  scheduler and `checkExpiredPredictions`'s scheduler are two different
  jobs; confirm both are actually running. This agent does not self-drive
  expiry checks from inside `pollAll`.
- **Suspected duplicate Evidence for a real-world event** — check the
  agent's own storage keys (`lastProcessed:eiaInventory`,
  `lastProcessed:price:wti`, `lastProcessed:price:brent`,
  `lastSeenOpecAnnouncementId`) before assuming a Kernel or Correlation
  Engine bug; the dedup logic lives entirely in this agent, keyed off the
  source's own natural observation key (report date / announcement id).
