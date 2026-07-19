/**
 * Ontology-type topic prefixes. Concrete topics are `${prefix}.${domainOrKind}`,
 * e.g. "signal.iot.temperature", "evidence.market", "trust.agent".
 * See docs/adr/0004-event-bus-topology-and-trust-engine.md and, for
 * Hypothesis/Outcome, docs/adr/0006 and docs/adr/0007.
 */
export const TopicPrefix = {
  Sensor: "sensor",
  Signal: "signal",
  Evidence: "evidence",
  Event: "event",
  Hypothesis: "hypothesis",
  Outcome: "outcome",
  Prediction: "prediction",
  Trust: "trust",
  AgentLifecycle: "agent.lifecycle",
} as const;

export type TopicPrefix = (typeof TopicPrefix)[keyof typeof TopicPrefix];

/** A concrete topic or a subscription pattern (e.g. "signal.*", "evidence.>"). */
export type Topic = string;
