import type { EventEnvelope } from "./EventEnvelope.js";
import type { Topic } from "./Topics.js";

export interface PublishAck {
  readonly id: string;
  readonly acceptedAt: string;
}

export interface Subscription {
  readonly id: string;
  readonly topicPattern: Topic;
  unsubscribe(): Promise<void>;
}

export type EventHandler<TPayload = unknown> = (envelope: EventEnvelope<TPayload>) => Promise<void>;

export interface SubscribeOptions {
  /** Competing-consumers group; envelopes are load-balanced across members. */
  readonly consumerGroup?: string;
  readonly fromOffset?: "earliest" | "latest";
}

/**
 * The sole channel through which agents exchange ontology facts. Delivery is
 * at-least-once with per-partition-key ordering only — no global ordering
 * guarantee (see docs/adr/0004). Consumers must be idempotent on envelope id.
 */
export interface EventBus {
  publish<TPayload>(envelope: EventEnvelope<TPayload>): Promise<PublishAck>;
  subscribe<TPayload>(
    topicPattern: Topic,
    handler: EventHandler<TPayload>,
    options?: SubscribeOptions
  ): Promise<Subscription>;
}
