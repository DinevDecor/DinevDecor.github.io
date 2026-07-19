import type { EventBus, EventEnvelope, EventHandler, PublishAck, SubscribeOptions, Subscription, Topic } from "@reality-observatory/event-bus";

interface StoredSubscription {
  readonly id: string;
  readonly topicPattern: Topic;
  // Payload types differ per subscription; the registry necessarily erases
  // them, matching the generic dispatch every real Event Bus does at runtime.
  readonly handler: EventHandler<any>;
}

function topicMatches(pattern: Topic, topic: string): boolean {
  if (pattern === topic) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return topic === prefix || topic.startsWith(`${prefix}.`);
  }
  return false;
}

/**
 * Minimal, deterministic in-memory Event Bus fixture for RI-002. Delivers to
 * matching subscribers synchronously and in subscription order, awaiting
 * each handler before moving to the next — not a production Event Bus
 * (see docs/adr/0004); it exists solely to let RI-002 exercise the real
 * EventBus/AgentEventBus/CorrelationEventBus contracts end-to-end.
 */
export class InMemoryEventBus implements EventBus {
  private subscriptions: StoredSubscription[] = [];
  private subscriptionSequence = 0;
  readonly published: EventEnvelope<unknown>[] = [];

  async publish<TPayload>(envelope: EventEnvelope<TPayload>): Promise<PublishAck> {
    this.published.push(envelope as EventEnvelope<unknown>);
    for (const subscription of this.subscriptions) {
      if (topicMatches(subscription.topicPattern, envelope.topic)) {
        await subscription.handler(envelope);
      }
    }
    return { id: envelope.id, acceptedAt: envelope.publishedAt };
  }

  async subscribe<TPayload>(
    topicPattern: Topic,
    handler: EventHandler<TPayload>,
    _options?: SubscribeOptions
  ): Promise<Subscription> {
    this.subscriptionSequence += 1;
    const id = `ri002-sub-${this.subscriptionSequence}`;
    const stored: StoredSubscription = { id, topicPattern, handler };
    this.subscriptions.push(stored);
    return {
      id,
      topicPattern,
      unsubscribe: async () => {
        this.subscriptions = this.subscriptions.filter((entry) => entry.id !== id);
      },
    };
  }
}
