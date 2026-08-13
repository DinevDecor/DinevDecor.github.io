import type { Evidence } from "@reality-observatory/ontology";
import { MalformedEvidenceError } from "./errors.js";

/**
 * Defensive validation the agent runs on every Evidence it is about to
 * publish. Not a Kernel change — `Evidence` the ontology type already
 * permits any string/number here; this is Oil Regime Watch refusing to
 * ever emit a fact that violates its own data-quality bar, the same way a
 * production service validates its own outputs before writing them.
 */
export function assertWellFormedEvidence(evidence: Evidence): void {
  if (!evidence.domain) {
    throw new MalformedEvidenceError("domain is required");
  }
  if (!evidence.claim || evidence.claim.trim().length === 0) {
    throw new MalformedEvidenceError("claim must be a non-empty string");
  }
  if (!Number.isFinite(evidence.strength) || evidence.strength < 0 || evidence.strength > 1) {
    throw new MalformedEvidenceError(`strength must be a finite number within [0, 1], got ${evidence.strength}`);
  }
  if (evidence.derivedFrom.length === 0) {
    throw new MalformedEvidenceError("derivedFrom must reference at least one Signal or Evidence source");
  }
  if (!evidence.observedAt) {
    throw new MalformedEvidenceError("observedAt is required");
  }
}
