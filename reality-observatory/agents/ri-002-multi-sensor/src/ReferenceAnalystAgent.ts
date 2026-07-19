import type { Agent, AgentContext, AgentManifest, HealthStatus } from "@reality-observatory/agent-sdk";
import type { EventEnvelope } from "@reality-observatory/event-bus";
import { makeEnvelope } from "./envelope.js";
import {
  DOMAIN,
  HYPOTHESIS_CORROBORATED,
  HYPOTHESIS_PROPOSED,
  OUTCOME,
  PREDICTION_PENDING,
  PREDICTION_RESOLVED,
  SCHEMA_VERSION,
  T4_CORRELATED,
  T5_RESOLVED,
} from "./scenario.js";

const MANIFEST: AgentManifest = {
  id: "ri-002-oil-analyst",
  displayName: "RI-002 Oil Analyst Agent",
  version: "0.1.0",
  owner: "platform-team",
  description:
    "Deterministic reference analyst agent for RI-002; reacts to the correlated oil Event by " +
    "proposing a Hypothesis, a Prediction, and resolving it with an Outcome. Not a production agent.",
  io: {
    consumesTopics: [`event.${DOMAIN}`],
    producesTopics: [`hypothesis.${DOMAIN}`, `prediction.${DOMAIN}`, `outcome.${DOMAIN}`],
  },
  capabilities: ["hypothesis:publish", "prediction:publish", "outcome:publish", "trust:read", "storage:read", "storage:write"],
  sandbox: "in-process",
};

/**
 * RI-002's analyst agent — unlike RI-001's Watch agent (which ran its
 * whole scenario as a linear script in onStart), this one is
 * event-reactive: it does nothing until the Correlation Engine's Event
 * arrives on the bus, then runs Hypothesis -> Prediction -> Outcome as a
 * deterministic reaction. Demonstrates the architecture supports both
 * patterns.
 */
export class ReferenceAnalystAgent implements Agent {
  readonly manifest = MANIFEST;
  private context: AgentContext | undefined;

  async onInit(context: AgentContext): Promise<void> {
    this.context = context;
  }

  async onStart(): Promise<void> {
    this.requireContext().logger.info("RI-002 analyst agent started, awaiting a correlated Event", {
      domain: DOMAIN,
    });
  }

  async onEvent(envelope: EventEnvelope<unknown>): Promise<void> {
    if (envelope.topic !== `event.${DOMAIN}`) return;
    const ctx = this.requireContext();

    // Hypothesis: propose, then corroborate now that the Event exists
    // (docs/adr/0006 — updates are new immutable records, not mutation).
    const hypothesisProposedEnvelope = makeEnvelope(
      `hypothesis.${DOMAIN}`,
      HYPOTHESIS_PROPOSED,
      this.manifest.id,
      T4_CORRELATED,
      SCHEMA_VERSION
    );
    await ctx.bus.publish(hypothesisProposedEnvelope);
    await ctx.bus.publish(
      makeEnvelope(`hypothesis.${DOMAIN}`, HYPOTHESIS_CORROBORATED, this.manifest.id, T4_CORRELATED, SCHEMA_VERSION, {
        causationId: hypothesisProposedEnvelope.id,
      })
    );

    // Prediction: operationalize the Hypothesis into a falsifiable claim.
    const predictionPendingEnvelope = makeEnvelope(
      `prediction.${DOMAIN}`,
      PREDICTION_PENDING,
      this.manifest.id,
      T4_CORRELATED,
      SCHEMA_VERSION
    );
    await ctx.bus.publish(predictionPendingEnvelope);

    // Outcome: resolve the Prediction. RI-002's analyst plays resolver
    // itself, same scenario simplification as RI-001 (ADR-0007 also
    // permits a distinct resolving agent/process).
    await ctx.bus.publish(makeEnvelope(`outcome.${DOMAIN}`, OUTCOME, this.manifest.id, T5_RESOLVED, SCHEMA_VERSION));

    // Prediction Lifecycle (ADR-0009): republish, never mutate — same id,
    // causationId pointing at the prior envelope, new terminal status.
    await ctx.bus.publish(
      makeEnvelope(`prediction.${DOMAIN}`, PREDICTION_RESOLVED, this.manifest.id, T5_RESOLVED, SCHEMA_VERSION, {
        causationId: predictionPendingEnvelope.id,
      })
    );
  }

  async onHealthCheck(): Promise<HealthStatus> {
    return "healthy";
  }

  async onShutdown(): Promise<void> {
    this.context = undefined;
  }

  private requireContext(): AgentContext {
    if (!this.context) throw new Error("ReferenceAnalystAgent used before onInit");
    return this.context;
  }
}
