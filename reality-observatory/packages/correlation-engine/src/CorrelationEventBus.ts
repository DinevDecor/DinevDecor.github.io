import type { Event, Hypothesis } from "@reality-observatory/ontology";
import type { EventEnvelope, EventHandler, PublishAck, SubscribeOptions, Subscription, Topic } from "@reality-observatory/event-bus";

/**
 * Ontology facts a Correlation Engine instance may publish — the two facts
 * it exists to produce (docs/adr/0010). Notably excludes Signal, Evidence,
 * Prediction and Outcome: those remain Agent-authored facts, never
 * originated by a Correlation Engine.
 */
export type CorrelationPublishableFact = Event | Hypothesis;

/**
 * The Event Bus surface exposed to a Correlation Engine instance via
 * CorrelationContext. Subscribing is unrestricted (it must consume Evidence
 * and, optionally, existing Hypotheses) but publishing is narrowed at the
 * type level to CorrelationPublishableFact — the engine cannot construct a
 * well-typed call that publishes a Signal, Evidence, Prediction, or
 * Outcome. See docs/adr/0011.
 */
export interface CorrelationEventBus {
  publish<TPayload extends CorrelationPublishableFact>(envelope: EventEnvelope<TPayload>): Promise<PublishAck>;
  subscribe<TPayload>(
    topicPattern: Topic,
    handler: EventHandler<TPayload>,
    options?: SubscribeOptions
  ): Promise<Subscription>;
}
