import type {
  AgentId,
  Confidence,
  Domain,
  Evidence,
  Outcome,
  Prediction,
  SchemaVersion,
  Signal,
  SignalId,
  Timestamp,
  Trust,
  TrustBasisRef,
  TrustId,
  TrustSubjectRef,
} from "@reality-observatory/ontology";
import type { EventBus, Subscription } from "@reality-observatory/event-bus";
import type { TrustChangeHandler, TrustEngine, TrustHistoryRange } from "@reality-observatory/trust-engine";
import { assertValidPredictionTransition } from "./predictionLifecycle.js";

const REFERENCE_SCHEMA_VERSION = "1.0.0" as SchemaVersion;

/**
 * Trust Engine isn't an Agent or Sensor, yet Provenance.producedBy requires
 * AgentId | SensorId — attributed via an AgentId-shaped cast, the same
 * pragmatic simplification used across RI-001/RI-002.
 */
const TRUST_ENGINE_ID = "trust-engine-oil-regime-reference" as AgentId;

function subjectKey(subject: TrustSubjectRef): string {
  return `${subject.type}:${subject.id}`;
}

function historyKey(subject: TrustSubjectRef, domain: Domain): string {
  return `${subjectKey(subject)}@${domain}`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface TrustChangeSubscription {
  readonly subjectKey: string;
  readonly domain: Domain;
  readonly handler: TrustChangeHandler;
}

/**
 * Minimal, deterministic in-memory Trust Engine fixture (docs/adr/0004,
 * docs/adr/0008). Ingests Signal/Evidence/Prediction/Outcome autonomously
 * via bus subscriptions — agents never call submitEvidence/submitOutcome
 * directly. Evidence nudges the originating Sensor's domain trust;
 * resolved Outcomes nudge the predicting Agent's domain trust. The scoring
 * rule (fixed deltas, clamped to [0, 1]) is a deliberately naive reference
 * rule, not a production trust algorithm — no production Trust Engine
 * exists yet in this repo (see README, "Production readiness").
 */
export class InMemoryTrustEngine implements TrustEngine {
  private historyBySubjectDomain = new Map<string, Trust[]>();
  private signalsById = new Map<SignalId, Signal>();
  private predictionsById = new Map<string, Prediction>();
  private changeSubscriptions: TrustChangeSubscription[] = [];
  private trustSequence = 0;

  constructor(bus: EventBus) {
    void bus.subscribe<Signal>("signal.*", async (envelope) => {
      this.signalsById.set(envelope.payload.id, envelope.payload);
    });
    void bus.subscribe<Evidence>("evidence.*", async (envelope) => {
      await this.submitEvidence(envelope.payload);
    });
    void bus.subscribe<Prediction>("prediction.*", async (envelope) => {
      const next = envelope.payload;
      assertValidPredictionTransition(this.predictionsById.get(next.id), next);
      this.predictionsById.set(next.id, next);
    });
    void bus.subscribe<Outcome>("outcome.*", async (envelope) => {
      await this.submitOutcome(envelope.payload);
    });
  }

  async getTrust(subject: TrustSubjectRef, domain: Domain): Promise<Trust | undefined> {
    const history = this.historyBySubjectDomain.get(historyKey(subject, domain));
    return history?.[history.length - 1];
  }

  async getTrustHistory(subject: TrustSubjectRef, domain: Domain, range: TrustHistoryRange): Promise<readonly Trust[]> {
    const history = this.historyBySubjectDomain.get(historyKey(subject, domain)) ?? [];
    return history.filter((entry) => entry.computedAt >= range.from && entry.computedAt <= range.to);
  }

  async subscribeToTrustChanges(subject: TrustSubjectRef, domain: Domain, handler: TrustChangeHandler): Promise<Subscription> {
    const entry: TrustChangeSubscription = { subjectKey: subjectKey(subject), domain, handler };
    this.changeSubscriptions.push(entry);
    return {
      id: `oil-regime-trust-sub-${subjectKey(subject)}@${domain}`,
      topicPattern: `trust.${domain}`,
      unsubscribe: async () => {
        this.changeSubscriptions = this.changeSubscriptions.filter((existing) => existing !== entry);
      },
    };
  }

  async submitEvidence(evidence: Evidence): Promise<void> {
    for (const source of evidence.derivedFrom) {
      if (source.type !== "signal") continue;
      const signal = this.signalsById.get(source.id);
      if (!signal) continue;
      const delta =
        evidence.polarity === "supports"
          ? 0.05 * evidence.strength
          : evidence.polarity === "refutes"
            ? -0.05 * evidence.strength
            : 0;
      if (delta === 0) continue;
      const basis: readonly TrustBasisRef[] = [{ type: "evidence", id: evidence.id }];
      await this.applyDelta({ type: "sensor", id: signal.sensorId }, evidence.domain, delta, evidence.observedAt, basis);
    }
  }

  async submitOutcome(outcome: Outcome): Promise<void> {
    const prediction = this.predictionsById.get(outcome.predictionId);
    if (!prediction) return;
    const delta =
      outcome.verdict === "confirmed" ? 0.15 : outcome.verdict === "falsified" ? -0.25 : -0.02;
    const basis: readonly TrustBasisRef[] = [{ type: "prediction", id: prediction.id }];
    await this.applyDelta(
      { type: "agent", id: prediction.producedByAgentId },
      prediction.domain,
      delta,
      outcome.resolvedAt,
      basis
    );
  }

  private async applyDelta(
    subject: TrustSubjectRef,
    domain: Domain,
    delta: number,
    at: Timestamp,
    basis: readonly TrustBasisRef[]
  ): Promise<void> {
    const key = historyKey(subject, domain);
    const history = this.historyBySubjectDomain.get(key) ?? [];
    const previousScore = history[history.length - 1]?.score ?? 0.5;
    this.trustSequence += 1;
    const next: Trust = {
      id: `trust-oil-regime-${this.trustSequence}` as TrustId,
      subject,
      domain,
      score: clamp01(previousScore + delta) as Confidence,
      basis,
      computedAt: at,
      computedByEngineVersion: "oil-regime-watch-reference/0.1.0",
      producedBy: TRUST_ENGINE_ID,
      schemaVersion: REFERENCE_SCHEMA_VERSION,
    };
    history.push(next);
    this.historyBySubjectDomain.set(key, history);
    await this.notifyChange(next);
  }

  private async notifyChange(trust: Trust): Promise<void> {
    for (const subscription of this.changeSubscriptions) {
      if (subscription.subjectKey === subjectKey(trust.subject) && subscription.domain === trust.domain) {
        await subscription.handler(trust);
      }
    }
  }
}
