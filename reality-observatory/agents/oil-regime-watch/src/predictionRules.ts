import type {
  AgentId,
  Domain,
  Event,
  EventSubjectRef,
  Hypothesis,
  HypothesisId,
  Prediction,
  PredictionId,
  SchemaVersion,
  Timestamp,
} from "@reality-observatory/ontology";
import type { EventType, OpecAnnouncementKind } from "./domain.js";

/**
 * The measurable, falsifiable shape of every Prediction this agent makes:
 * a directional price-move claim on WTI, with an explicit threshold
 * (measurable condition) and an explicit invalidation condition (an
 * opposing OPEC+ announcement before the horizon expires cancels the
 * thesis). No Prediction is constructed without every one of these fields.
 */
export interface OilPredictionClaim {
  readonly instrument: "wti";
  readonly direction: "up" | "down";
  readonly thresholdPercent: number;
  readonly referencePriceUsd: number;
  readonly invalidation: {
    readonly opposingAnnouncementKind: OpecAnnouncementKind;
  };
}

interface RegimeRule {
  readonly hypothesisStatement: string;
  readonly direction: "up" | "down";
  readonly opposingAnnouncementKind: OpecAnnouncementKind;
}

/**
 * Deterministic, rule-based mapping from correlated Event type to the
 * regime thesis it implies. No AI, no statistical inference — see
 * README, "Correlation Algorithm" and "Prediction Rules".
 */
const REGIME_RULES: Readonly<Record<EventType, RegimeRule>> = {
  "energy.oil.inventory-surprise-build": {
    hypothesisStatement: "Unexpected US crude inventory build signals near-term oversupply pressure on WTI.",
    direction: "down",
    opposingAnnouncementKind: "cut",
  },
  "energy.oil.inventory-surprise-draw": {
    hypothesisStatement: "Unexpected US crude inventory draw signals near-term demand/supply tightness supporting WTI.",
    direction: "up",
    opposingAnnouncementKind: "increase",
  },
  "energy.oil.opec-production-cut": {
    hypothesisStatement: "An OPEC+ production cut signals tightening supply, supporting WTI.",
    direction: "up",
    opposingAnnouncementKind: "increase",
  },
  "energy.oil.opec-production-increase": {
    hypothesisStatement: "An OPEC+ production increase signals a supply glut, pressuring WTI.",
    direction: "down",
    opposingAnnouncementKind: "cut",
  },
  "energy.oil.opec-supply-disruption": {
    hypothesisStatement: "An unplanned OPEC+ supply disruption signals a supply shock, supporting WTI.",
    direction: "up",
    opposingAnnouncementKind: "increase",
  },
};

export function regimeRuleFor(eventType: EventType): RegimeRule {
  const rule = REGIME_RULES[eventType];
  if (!rule) throw new Error(`No regime rule configured for Event type "${eventType}"`);
  return rule;
}

export interface BuildHypothesisParams {
  readonly id: HypothesisId;
  readonly domain: Domain;
  readonly proposedByAgentId: AgentId;
  readonly event: Event;
  readonly at: Timestamp;
  readonly schemaVersion: SchemaVersion;
}

export function buildHypothesis(params: BuildHypothesisParams): Hypothesis {
  const rule = regimeRuleFor(params.event.type as EventType);
  return {
    id: params.id,
    domain: params.domain,
    statement: rule.hypothesisStatement,
    proposedByAgentId: params.proposedByAgentId,
    status: "proposed",
    supportingEvidence: params.event.evidenceRefs,
    conflictingEvidence: [],
    confidence: params.event.confidence,
    proposedAt: params.at,
    updatedAt: params.at,
    producedBy: params.proposedByAgentId,
    schemaVersion: params.schemaVersion,
  };
}

export interface BuildPredictionParams {
  readonly id: PredictionId;
  readonly domain: Domain;
  readonly subject: EventSubjectRef;
  readonly producedByAgentId: AgentId;
  readonly hypothesisId: HypothesisId;
  readonly event: Event;
  readonly referencePriceUsd: number;
  readonly thresholdPercent: number;
  readonly createdAt: Timestamp;
  readonly horizonTo: Timestamp;
  readonly schemaVersion: SchemaVersion;
}

/**
 * Every Prediction built here has, by construction, all six required
 * elements: a clear expected outcome (`claim.direction`), a measurable
 * condition (`claim.thresholdPercent` against `claim.referencePriceUsd`),
 * a time horizon (`horizon`), an invalidation condition
 * (`claim.invalidation`), supporting Evidence and an originating Event
 * (`basis`). See README, "Prediction Rules".
 */
export function buildPrediction(params: BuildPredictionParams): Prediction<OilPredictionClaim> {
  const rule = regimeRuleFor(params.event.type as EventType);
  return {
    id: params.id,
    producedByAgentId: params.producedByAgentId,
    domain: params.domain,
    subject: params.subject,
    hypothesisId: params.hypothesisId,
    claim: {
      instrument: "wti",
      direction: rule.direction,
      thresholdPercent: params.thresholdPercent,
      referencePriceUsd: params.referencePriceUsd,
      invalidation: { opposingAnnouncementKind: rule.opposingAnnouncementKind },
    },
    horizon: { from: params.createdAt, to: params.horizonTo },
    confidence: params.event.confidence,
    basis: [...params.event.evidenceRefs, params.event.id, params.hypothesisId],
    status: "pending",
    createdAt: params.createdAt,
    producedBy: params.producedByAgentId,
    schemaVersion: params.schemaVersion,
  };
}

export type EvaluationVerdict = "confirmed" | "falsified" | "inconclusive";

export interface EvaluationResult {
  readonly verdict: EvaluationVerdict;
  readonly movePercent: number;
}

/**
 * The measurable condition, evaluated: how far did WTI actually move from
 * the Prediction's reference price, and did it cross the threshold in the
 * predicted direction (confirmed), the opposite direction (falsified), or
 * neither (inconclusive)? Pure function, fully deterministic.
 */
export function evaluatePrediction(claim: OilPredictionClaim, currentPriceUsd: number): EvaluationResult {
  const movePercent = ((currentPriceUsd - claim.referencePriceUsd) / claim.referencePriceUsd) * 100;
  const movedInPredictedDirection =
    claim.direction === "up" ? movePercent >= claim.thresholdPercent : movePercent <= -claim.thresholdPercent;
  const movedOppositeDirection =
    claim.direction === "up" ? movePercent <= -claim.thresholdPercent : movePercent >= claim.thresholdPercent;

  if (movedInPredictedDirection) return { verdict: "confirmed", movePercent };
  if (movedOppositeDirection) return { verdict: "falsified", movePercent };
  return { verdict: "inconclusive", movePercent };
}
