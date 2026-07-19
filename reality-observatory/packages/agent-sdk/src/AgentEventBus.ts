import type { Evidence, Hypothesis, Outcome, Prediction, Signal } from "@reality-observatory/ontology";
import type { EventEnvelope, EventHandler, PublishAck, SubscribeOptions, Subscription, Topic } from "@reality-observatory/event-bus";

/**
 * Ontology facts an ordinary Agent may publish. Deliberately excludes
 * `Event` — authoring Event is reserved exclusively for a registered
 * Correlation Engine instance (docs/adr/0010).
 */
export type AgentPublishableFact = Signal | Evidence | Hypothesis | Prediction | Outcome;

/**
 * The Event Bus surface exposed to Agents via AgentContext. Subscribing is
 * unrestricted (an Agent may read any fact, including Event, e.g. to build
 * a Prediction's basis) but publishing is narrowed to AgentPublishableFact
 * at the type level — an Agent cannot construct a well-typed call that
 * publishes an Event, independent of whatever capabilities a manifest
 * happens to declare. See docs/adr/0011.
 */
export interface AgentEventBus {
  publish<TPayload extends AgentPublishableFact>(envelope: EventEnvelope<TPayload>): Promise<PublishAck>;
  subscribe<TPayload>(
    topicPattern: Topic,
    handler: EventHandler<TPayload>,
    options?: SubscribeOptions
  ): Promise<Subscription>;
}
