import { test } from "node:test";
import assert from "node:assert/strict";

import type { AgentContext } from "@reality-observatory/agent-sdk";
import type { CorrelationContext } from "@reality-observatory/correlation-engine";
import type { EventEnvelope } from "@reality-observatory/event-bus";
import type { Event, Evidence } from "@reality-observatory/ontology";

declare const agentContext: AgentContext;
declare const correlationContext: CorrelationContext;
declare const eventEnvelope: EventEnvelope<Event>;
declare const evidenceEnvelope: EventEnvelope<Evidence>;

/**
 * RI-002's own copy of the permanent compile-time regression test for
 * ADR-0011 (see agents/ri-001-reference-watch for the original). Kept
 * self-contained per repo convention (agents never cross-import), and
 * re-verified here specifically for the multi-sensor scenario: an ordinary
 * sensor/analyst Agent still cannot publish an Event, and the Correlation
 * Engine that merges three Evidence into one Event still cannot publish
 * Evidence itself. None of the functions below ever run — the check IS
 * the compilation.
 */
function agentCannotPublishEvent(): void {
  // @ts-expect-error — Event is not an AgentPublishableFact (docs/adr/0011).
  agentContext.bus.publish(eventEnvelope);
}

function correlationEngineCannotPublishEvidence(): void {
  // @ts-expect-error — Evidence is not a CorrelationPublishableFact (docs/adr/0011).
  correlationContext.bus.publish(evidenceEnvelope);
}

function agentCanStillPublishEvidence(): void {
  agentContext.bus.publish(evidenceEnvelope);
}

function correlationEngineCanStillPublishEvent(): void {
  correlationContext.bus.publish(eventEnvelope);
}

void agentCannotPublishEvent;
void correlationEngineCannotPublishEvidence;
void agentCanStillPublishEvidence;
void correlationEngineCanStillPublishEvent;

test("RI-002 type-level: ADR-0011 boundaries are enforced by the compiler (see @ts-expect-error above)", () => {
  assert.ok(true);
});
