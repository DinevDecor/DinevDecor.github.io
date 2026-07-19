import type { AgentId, Confidence, Domain, EvidenceId, Provenance, SignalId, Timestamp } from "./common.js";

export type EvidencePolarity = "supports" | "refutes" | "neutral";

export type EvidenceSource =
  | { readonly type: "signal"; readonly id: SignalId }
  | { readonly type: "evidence"; readonly id: EvidenceId };

/**
 * An interpretation of one or more Signals (or other Evidence) that supports
 * or refutes a specific claim with a given strength. The bridge between raw
 * perception and the semantic facts (Event, Prediction) built on top of it.
 */
export interface Evidence extends Provenance {
  readonly id: EvidenceId;
  /** The domain this evidence bears on (docs/adr/0006). */
  readonly domain: Domain;
  /** The assertion this evidence bears on. */
  readonly claim: string;
  readonly polarity: EvidencePolarity;
  readonly strength: Confidence;
  readonly derivedFrom: readonly EvidenceSource[];
  readonly derivedByAgentId: AgentId;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
}
