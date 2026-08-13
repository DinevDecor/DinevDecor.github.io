import type { Prediction } from "@reality-observatory/ontology";

const TERMINAL_STATUSES: ReadonlySet<Prediction["status"]> = new Set([
  "confirmed",
  "falsified",
  "inconclusive",
  "expired",
  "withdrawn",
]);

export class PredictionAlreadyResolvedError extends Error {
  constructor(predictionId: string, previousStatus: string) {
    super(
      `Prediction "${predictionId}" already reached terminal status "${previousStatus}" ` +
        `(docs/adr/0009) and cannot transition again.`
    );
    this.name = "PredictionAlreadyResolvedError";
  }
}

/**
 * Enforces the ADR-0009 Prediction Lifecycle invariant that terminal states
 * are final: once a republish reaches confirmed/falsified/inconclusive/
 * expired/withdrawn, no further transition for that Prediction id is valid.
 * `previous` is the last known record for the same id, if any. This is a
 * defense-in-depth backstop at the Trust Engine ingestion layer; the
 * primary guard for Oil Regime Watch's own Outcome resolution lives in
 * OilRegimeWatchAgent itself (see errors.ts PredictionAlreadyResolvedError).
 */
export function assertValidPredictionTransition(previous: Prediction | undefined, next: Prediction): void {
  if (!previous) return;
  if (TERMINAL_STATUSES.has(previous.status)) {
    throw new PredictionAlreadyResolvedError(previous.id, previous.status);
  }
  void next;
}
