# RI-001 — Reference Watch

RI-001 is not a production agent. It is a deterministic reference
implementation that drives the entire kernel pipeline end to end —
**Sensor Registry → Signal → Evidence → Event → Hypothesis → Prediction →
Outcome → Domain Trust Update** — and exists to serve as a **permanent
regression test for the architecture** (ADR-0001 through ADR-0011). If a
future change to any kernel package breaks a contract this scenario relies
on, RI-001's tests fail.

## What it contains

| Path | Role |
|---|---|
| `agent.manifest.json` | Declarative manifest for the Reference Watch agent (repo convention) |
| `src/scenario.ts` | The entire scenario as fixed, hardcoded data — no randomness, no clock reads |
| `src/envelope.ts` | Deterministic envelope construction (monotonic id counter, not UUIDs) |
| `src/ReferenceWatchAgent.ts` | Implements `Agent` from `@reality-observatory/agent-sdk`; runs the scenario as a linear script |
| `src/ReferenceCorrelationEngine.ts` | Implements `CorrelationEngine` from `@reality-observatory/correlation-engine`; the domain's sole authoritative Event/Hypothesis producer |
| `src/fixtures/` | Minimal in-memory implementations of `EventBus`, `SensorRegistry`, `TrustEngine`, plus a Correlation Engine domain-exclusivity guard — **not production implementations**, only enough logic to make the contracts runnable and testable |
| `src/pipeline.ts` | Wires the fixtures and constructs `AgentContext`/`CorrelationContext` exactly as a real runtime would |
| `test/` | The regression suite: positive, negative, and a compile-time type-level test |

## Running it

```sh
npm run test --workspace=@reality-observatory/ri-001-reference-watch
```

This builds the package (`tsc --build`, which also rebuilds any kernel
package it depends on if needed) and runs the suite with Node's built-in
test runner (`node --test`) — no external test framework, no external API
calls, no network access.

## What the regression suite checks

- **Positive** (`test/ri-001.positive.test.ts`): the Sensor registers and
  heartbeats successfully; every ontology fact type is published in a
  causally valid order (Evidence before Event, Event before Outcome, Outcome
  before the Prediction's terminal republish); the Prediction reaches a
  `confirmed` terminal state through an Outcome (ADR-0007/0009); Outcome
  ingestion produces a Domain Trust update for the predicting Agent, and
  Evidence ingestion produces one for the originating Sensor (ADR-0004/0008);
  the whole scenario is byte-for-byte deterministic across independent runs.
- **Negative** (`test/ri-001.negative.test.ts`): a non-owner agent cannot
  write to a Sensor it doesn't own, cannot register a Sensor under someone
  else's `ownerAgentId`, and a Sensor cannot be double-registered or written
  to before it exists (ADR-0005); a domain can have at most one registered
  Correlation Engine (ADR-0010); Domain Trust computed in one domain is
  invisible when queried under another (ADR-0008); a Prediction that has
  already reached a terminal state cannot transition again (ADR-0009).
- **Type-level** (`test/type-level.adr-0011.test.ts`): a compile-time-only
  check using `@ts-expect-error` proving an Agent still cannot construct a
  well-typed call that publishes an `Event`, and a Correlation Engine still
  cannot construct one that publishes `Evidence` — if either restriction is
  ever loosened, this file fails to compile (verified by deliberately
  loosening `AgentEventBus.publish` during development and confirming the
  build broke, then reverting).

## Deliberate simplifications (not architectural gaps)

These are scenario choices, not something a future agent must copy:

- The Watch agent resolves its own Prediction (produces the `Outcome`
  itself). ADR-0007 explicitly also allows a distinct resolving agent or
  process — RI-001 just doesn't need that complexity to prove the pipeline.
- The reference Trust Engine's scoring rule (fixed deltas, clamped to
  `[0, 1]`, from a `0.5` baseline) is deliberately naive. It exists to prove
  Evidence nudges Sensor trust and Outcome nudges Agent trust, per domain —
  not to be a production trust algorithm.
- The reference Correlation Engine's correlation rule is a fixed
  claim/polarity/strength threshold check, not real correlation logic.
- Correlation Engine and Trust Engine instances aren't Agents or Sensors,
  yet `Provenance.producedBy` requires `AgentId | SensorId`. RI-001
  attributes their facts via an `AgentId`-shaped cast as a pragmatic
  simplification (see comments in `scenario.ts` and
  `fixtures/InMemoryTrustEngine.ts`) — a dedicated id brand for non-agent,
  non-sensor system services is a candidate future ADR, not something
  RI-001 needed to resolve to prove the pipeline works.
