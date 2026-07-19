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
 * The permanent compile-time regression test for ADR-0011. None of the
 * functions below ever run (they're never called — the `declare const`
 * values above have no runtime binding); the check IS the compilation
 * itself. If someone widens AgentEventBus or CorrelationEventBus back to
 * the unrestricted EventBus, the `@ts-expect-error` lines stop producing an
 * error and `tsc` fails the whole package build — the same protection the
 * runtime suites give ADR-0005/0008/0009/0010, but for a rule that lives
 * entirely in the type system.
 */
function agentCannotPublishEvent(): void {
  // @ts-expect-error — Event is not an AgentPublishableFact (docs/adr/0011).
  agentContext.bus.publish(eventEnvelope);
}

function correlationEngineCannotPublishEvidence(): void {
  // @ts-expect-error — Evidence is not a CorrelationPublishableFact (docs/adr/0011).
  correlationContext.bus.publish(evidenceEnvelope);
}

// Sanity checks in the other direction: the legitimate calls must still
// compile without any suppression, so this file also fails loudly if the
// restriction is ever made too strict.
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

test("RI-001 type-level: ADR-0011 boundaries are enforced by the compiler (see @ts-expect-error above)", () => {
  // The real assertion already happened when this file was type-checked.
  assert.ok(true);
});
