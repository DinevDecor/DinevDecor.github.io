import type { Agent, AgentContext, AgentManifest, HealthStatus } from "@reality-observatory/agent-sdk";
import type { EventEnvelope } from "@reality-observatory/event-bus";
import { makeEnvelope } from "./envelope.js";
import {
  DOMAIN,
  EVIDENCE,
  HYPOTHESIS_CORROBORATED,
  HYPOTHESIS_PROPOSED,
  OUTCOME,
  PREDICTION_PENDING,
  PREDICTION_RESOLVED,
  SCHEMA_VERSION,
  SENSOR,
  SENSOR_ID,
  SIGNAL,
  T1_OBSERVED,
  T2_DETECTED,
  T3_RESOLVED,
  WATCH_AGENT_ID,
} from "./scenario.js";

/**
 * Mirrors agents/ri-001-reference-watch/agent.manifest.json — kept in sync
 * by hand since this reference implementation doesn't load the manifest
 * file at runtime (see docs/repository-structure.md for the declarative
 * manifest convention).
 */
const MANIFEST: AgentManifest = {
  id: "ri-001-reference-watch",
  displayName: "RI-001 Reference Watch",
  version: "0.1.0",
  owner: "platform-team",
  description:
    "Deterministic reference implementation exercising the full kernel pipeline " +
    "(Sensor Registry -> Signal -> Evidence -> Event -> Hypothesis -> Prediction -> " +
    "Outcome -> Domain Trust). Not a production Watch agent.",
  io: {
    consumesTopics: [`event.${DOMAIN}`],
    producesTopics: [
      `signal.${DOMAIN}`,
      `evidence.${DOMAIN}`,
      `hypothesis.${DOMAIN}`,
      `prediction.${DOMAIN}`,
      `outcome.${DOMAIN}`,
    ],
  },
  capabilities: [
    "sensor:register",
    "sensor:discover",
    "sensor:emit-signal",
    "evidence:publish",
    "hypothesis:publish",
    "prediction:publish",
    "outcome:publish",
    "trust:read",
    "storage:read",
    "storage:write",
  ],
  sandbox: "in-process",
};

/**
 * RI-001: the reference Watch agent. Runs the scenario's steps as a linear,
 * deterministic script rather than reacting to bus events — a real Watch
 * agent would likely be event-reactive, but a straight-line script keeps
 * this reference easy to reason about and to assert on in tests.
 */
export class ReferenceWatchAgent implements Agent {
  readonly manifest = MANIFEST;
  private context: AgentContext | undefined;

  async onInit(context: AgentContext): Promise<void> {
    this.context = context;
  }

  async onStart(): Promise<void> {
    const ctx = this.requireContext();

    // 1. Observation: register and heartbeat the owned Sensor through the
    //    Sensor Registry's owner-scoped writer (docs/adr/0005).
    await ctx.ownSensors.register(SENSOR);
    await ctx.ownSensors.heartbeat(SENSOR_ID, T1_OBSERVED);

    // 2. Observation: emit the fixed Signal reading.
    await ctx.bus.publish(makeEnvelope(`signal.${DOMAIN}`, SIGNAL, WATCH_AGENT_ID, T1_OBSERVED, SCHEMA_VERSION));

    // 3. Evidence: interpret the Signal. Publishing this synchronously
    //    triggers the Correlation Engine (subscribed to evidence.<domain>)
    //    to emit the Event, and the Trust Engine to ingest the Evidence —
    //    both complete before this publish() call resolves (see
    //    fixtures/InMemoryEventBus.ts).
    await ctx.bus.publish(makeEnvelope(`evidence.${DOMAIN}`, EVIDENCE, WATCH_AGENT_ID, T1_OBSERVED, SCHEMA_VERSION));

    // 4. Hypothesis: propose, then corroborate once the Event exists
    //    (docs/adr/0006 — updates are new immutable records, not mutation).
    const hypothesisProposedEnvelope = makeEnvelope(
      `hypothesis.${DOMAIN}`,
      HYPOTHESIS_PROPOSED,
      WATCH_AGENT_ID,
      T1_OBSERVED,
      SCHEMA_VERSION
    );
    await ctx.bus.publish(hypothesisProposedEnvelope);
    await ctx.bus.publish(
      makeEnvelope(`hypothesis.${DOMAIN}`, HYPOTHESIS_CORROBORATED, WATCH_AGENT_ID, T2_DETECTED, SCHEMA_VERSION, {
        causationId: hypothesisProposedEnvelope.id,
      })
    );

    // 5. Prediction: operationalize the Hypothesis into a falsifiable claim.
    const predictionPendingEnvelope = makeEnvelope(
      `prediction.${DOMAIN}`,
      PREDICTION_PENDING,
      WATCH_AGENT_ID,
      T1_OBSERVED,
      SCHEMA_VERSION
    );
    await ctx.bus.publish(predictionPendingEnvelope);

    // 6. Outcome: resolve the Prediction. RI-001's Watch agent plays
    //    resolver itself; ADR-0007 also permits a distinct resolving
    //    agent/process — this is a scenario simplification, not a rule.
    await ctx.bus.publish(makeEnvelope(`outcome.${DOMAIN}`, OUTCOME, WATCH_AGENT_ID, T3_RESOLVED, SCHEMA_VERSION));

    // 7. Prediction Lifecycle (ADR-0009): republish, never mutate — same
    //    id, causationId pointing at the prior envelope, new terminal
    //    status. This is what closes the loop into Domain Trust: the Trust
    //    Engine ingested the Outcome above and already updated Trust by
    //    the time this call resolves.
    await ctx.bus.publish(
      makeEnvelope(`prediction.${DOMAIN}`, PREDICTION_RESOLVED, WATCH_AGENT_ID, T3_RESOLVED, SCHEMA_VERSION, {
        causationId: predictionPendingEnvelope.id,
      })
    );
  }

  async onEvent(envelope: EventEnvelope<unknown>): Promise<void> {
    this.requireContext().logger.debug("RI-001 watch agent observed an Event", { topic: envelope.topic });
  }

  async onHealthCheck(): Promise<HealthStatus> {
    return "healthy";
  }

  async onShutdown(): Promise<void> {
    this.context = undefined;
  }

  private requireContext(): AgentContext {
    if (!this.context) throw new Error("ReferenceWatchAgent used before onInit");
    return this.context;
  }
}
